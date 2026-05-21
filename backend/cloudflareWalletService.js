const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const REQUIRED_ENV = [
  'APP_JWT_SECRET',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_D1_DATABASE_ID',
  'CLOUDFLARE_API_TOKEN',
  'FIREBASE_WEB_API_KEY'
];

function assertEnv(env = process.env) {
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app();

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

class D1Client {
  constructor({
    accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID,
    apiToken = process.env.CLOUDFLARE_API_TOKEN
  } = {}) {
    this.accountId = accountId;
    this.databaseId = databaseId;
    this.apiToken = apiToken;
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  }

  async query(sql, params = []) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql, params })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      const message = payload?.errors?.map((e) => e.message).join('; ') || response.statusText;
      throw new Error(`D1 query failed: ${message}`);
    }

    return payload.result?.[0] || payload.result || {};
  }

  async first(sql, params = []) {
    const result = await this.query(sql, params);
    return result.results?.[0] || null;
  }

  async all(sql, params = []) {
    const result = await this.query(sql, params);
    return result.results || [];
  }
}

function createR2Client() {
  if (!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    }
  });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function nowMs() {
  return Date.now();
}

const ADMIN_UID = process.env.ADMIN_UID || 'mOs5Fmp4RoRzeBDH4pZLMOpQx7Q2';
const CHAT_RETENTION_AFTER_ADMIN_READ_MS = 15 * 24 * 60 * 60 * 1000;
const NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function createAppToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      firebaseUid: user.firebase_uid || null,
      isAdmin: user.id === ADMIN_UID || user.firebase_uid === ADMIN_UID
    },
    process.env.APP_JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyAppToken(token) {
  return jwt.verify(token, process.env.APP_JWT_SECRET);
}

async function signInFirebaseEmailPassword(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.message || 'FIREBASE_LOGIN_FAILED';
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  return payload;
}

async function initSchema(d1) {
  await d1.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      firebase_uid TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT,
      mobile TEXT,
      created_at INTEGER NOT NULL,
      migrated_at INTEGER
    )
  `);

  await ensureColumn(d1, 'users', 'name', 'TEXT');
  await ensureColumn(d1, 'users', 'mobile', 'TEXT');

  await d1.query(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      room_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_email TEXT,
      user_mobile TEXT,
      last_message TEXT,
      last_sender_id TEXT,
      updated_at INTEGER NOT NULL
    )
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_rooms_updated
    ON chat_rooms (updated_at DESC)
  `);

  await d1.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      read_by_admin_at INTEGER
    )
  `);

  await ensureColumn(d1, 'chats', 'read_by_admin_at', 'INTEGER');

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_room_time
    ON chats (room_id, timestamp DESC)
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_admin_read_cleanup
    ON chats (read_by_admin_at)
  `);

  await d1.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      transaction_id TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      details_json TEXT
    )
  `);

  await ensureColumn(d1, 'transactions', 'details_json', 'TEXT');

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_time
    ON transactions (user_id, timestamp DESC)
  `);

  await d1.query(`
    CREATE TABLE IF NOT EXISTS fund_requests (
      request_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      requested_at INTEGER NOT NULL,
      processed_at INTEGER,
      details_json TEXT
    )
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_fund_requests_status_time
    ON fund_requests (status, requested_at DESC)
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_fund_requests_user_status
    ON fund_requests (user_id, status)
  `);

  await d1.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT,
      message TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      audience TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      deleted_at INTEGER
    )
  `);

  await ensureColumn(d1, 'notifications', 'title', 'TEXT');
  await ensureColumn(d1, 'notifications', 'deleted_at', 'INTEGER');

  await d1.query(`
    CREATE TABLE IF NOT EXISTS notification_recipients (
      notification_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      delivered_at INTEGER NOT NULL,
      read_at INTEGER,
      PRIMARY KEY (notification_id, user_id)
    )
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_created
    ON notifications (created_at DESC)
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_expiry
    ON notifications (expires_at, deleted_at)
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_notification_recipients_user
    ON notification_recipients (user_id, read_at)
  `);
}

async function ensureColumn(d1, table, column, type) {
  try {
    await d1.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('duplicate column')) {
      throw error;
    }
  }
}

function normalizeProfile(profile = {}) {
  return {
    name: String(profile.name || '').trim().slice(0, 120),
    mobile: String(profile.mobile || '').trim().slice(0, 30)
  };
}

async function createUser(d1, { id, firebaseUid = null, email, passwordHash, migratedAt = null, profile = {} }) {
  const createdAt = nowMs();
  const cleanProfile = normalizeProfile(profile);
  await d1.query(
    `INSERT INTO users (id, firebase_uid, email, password_hash, name, mobile, created_at, migrated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, firebaseUid, normalizeEmail(email), passwordHash, cleanProfile.name, cleanProfile.mobile, createdAt, migratedAt]
  );

  return {
    id,
    firebase_uid: firebaseUid,
    email: normalizeEmail(email),
    password_hash: passwordHash,
    name: cleanProfile.name,
    mobile: cleanProfile.mobile,
    created_at: createdAt,
    migrated_at: migratedAt
  };
}

async function findUserByEmail(d1, email) {
  return d1.first('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizeEmail(email)]);
}

async function upsertFirebaseUser(d1, decodedToken, profile = {}) {
  const firebaseUid = decodedToken.uid;
  const email = normalizeEmail(decodedToken.email || `${firebaseUid}@firebase.local`);
  const cleanProfile = normalizeProfile({
    name: profile.name || decodedToken.name || '',
    mobile: profile.mobile || profile.phoneNumber || decodedToken.phone_number || ''
  });
  const existing = await d1.first(
    'SELECT * FROM users WHERE firebase_uid = ? OR email = ? LIMIT 1',
    [firebaseUid, email]
  );

  if (existing) {
    if (!existing.firebase_uid) {
      await d1.query('UPDATE users SET firebase_uid = ? WHERE id = ?', [firebaseUid, existing.id]);
      existing.firebase_uid = firebaseUid;
    }
    if (cleanProfile.name || cleanProfile.mobile) {
      await d1.query(
        `UPDATE users
         SET name = COALESCE(NULLIF(?, ''), name),
             mobile = COALESCE(NULLIF(?, ''), mobile)
         WHERE id = ?`,
        [cleanProfile.name, cleanProfile.mobile, existing.id]
      );
      existing.name = cleanProfile.name || existing.name;
      existing.mobile = cleanProfile.mobile || existing.mobile;
    }
    return existing;
  }

  return createUser(d1, {
    id: firebaseUid,
    firebaseUid,
    email,
    passwordHash: '',
    migratedAt: nowMs(),
    profile: cleanProfile
  });
}

async function recentChatHistory(d1, roomId, limit = 50) {
  const rows = await d1.all(
    `SELECT id, room_id, sender_id, message, timestamp, read_by_admin_at
     FROM chats
     WHERE room_id = ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    [roomId, limit]
  );

  return rows.reverse();
}

async function saveChatMessage(d1, { roomId, senderId, message, timestamp, readByAdminAt = null }) {
  await d1.query(
    `INSERT INTO chats (room_id, sender_id, message, timestamp, read_by_admin_at)
     VALUES (?, ?, ?, ?, ?)`,
    [roomId, senderId, message, timestamp, readByAdminAt]
  );
}

async function markRoomReadByAdmin(d1, roomId, readAt = nowMs()) {
  await d1.query(
    `UPDATE chats
     SET read_by_admin_at = COALESCE(read_by_admin_at, ?)
     WHERE room_id = ?`,
    [readAt, roomId]
  );
}

async function cleanupExpiredReadChats(d1) {
  const cutoff = nowMs() - CHAT_RETENTION_AFTER_ADMIN_READ_MS;
  await d1.query(
    `DELETE FROM chats
     WHERE read_by_admin_at IS NOT NULL
       AND read_by_admin_at <= ?`,
    [cutoff]
  );
  await d1.query(
    `DELETE FROM chat_rooms
     WHERE NOT EXISTS (
       SELECT 1 FROM chats
       WHERE chats.room_id = chat_rooms.room_id
     )`
  );
  await d1.query(
    `UPDATE chat_rooms
     SET last_message = (
         SELECT message FROM chats
         WHERE chats.room_id = chat_rooms.room_id
         ORDER BY timestamp DESC
         LIMIT 1
       ),
       last_sender_id = (
         SELECT sender_id FROM chats
         WHERE chats.room_id = chat_rooms.room_id
         ORDER BY timestamp DESC
         LIMIT 1
       ),
       updated_at = (
         SELECT timestamp FROM chats
         WHERE chats.room_id = chat_rooms.room_id
         ORDER BY timestamp DESC
         LIMIT 1
       )
     WHERE EXISTS (
       SELECT 1 FROM chats
       WHERE chats.room_id = chat_rooms.room_id
     )`
  );
}

async function upsertChatRoom(d1, { roomId, userId, userName = '', userEmail = '', userMobile = '', lastMessage = '', lastSenderId = '', updatedAt = nowMs() }) {
  await d1.query(
    `INSERT INTO chat_rooms (room_id, user_id, user_name, user_email, user_mobile, last_message, last_sender_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(room_id) DO UPDATE SET
       user_id = COALESCE(NULLIF(excluded.user_id, ''), chat_rooms.user_id),
       user_name = COALESCE(NULLIF(excluded.user_name, ''), chat_rooms.user_name),
       user_email = COALESCE(NULLIF(excluded.user_email, ''), chat_rooms.user_email),
       user_mobile = COALESCE(NULLIF(excluded.user_mobile, ''), chat_rooms.user_mobile),
       last_message = excluded.last_message,
       last_sender_id = excluded.last_sender_id,
       updated_at = excluded.updated_at`,
    [roomId, userId, userName, userEmail, userMobile, lastMessage, lastSenderId, updatedAt]
  );
}

async function listChatRooms(d1, { limit = 100 } = {}) {
  return d1.all(
    `SELECT room_id, user_id, user_name, user_email, user_mobile, last_message, last_sender_id, updated_at
     FROM chat_rooms
     ORDER BY updated_at DESC
     LIMIT ?`,
    [limit]
  );
}

async function saveTransaction(d1, { userId, transactionId, type, amount, status, timestamp = nowMs(), details = {} }) {
  await d1.query(
    `INSERT INTO transactions (user_id, transaction_id, type, amount, status, timestamp, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(transaction_id) DO UPDATE SET
       type = excluded.type,
       amount = excluded.amount,
       status = excluded.status,
       timestamp = excluded.timestamp,
       details_json = excluded.details_json`,
    [userId, transactionId, type, Number(amount || 0), status, timestamp, JSON.stringify(details || {})]
  );
}

async function getTransactionHistory(d1, userId, { limit = 50, before = Number.MAX_SAFE_INTEGER } = {}) {
  const rows = await d1.all(
    `SELECT user_id, transaction_id, type, amount, status, timestamp
          , details_json
     FROM transactions
     WHERE user_id = ? AND timestamp < ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    [userId, before, limit]
  );
  return rows.map((row) => {
    let details = {};
    try {
      details = row.details_json ? JSON.parse(row.details_json) : {};
    } catch {
      details = {};
    }
    return { ...details, ...row, details_json: undefined };
  });
}

async function saveFundRequest(d1, { requestId, userId, type = 'withdrawal', amount = 0, status = 'pending', requestedAt = nowMs(), processedAt = null, details = {} }) {
  await d1.query(
    `INSERT INTO fund_requests (request_id, user_id, type, amount, status, requested_at, processed_at, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(request_id) DO UPDATE SET
       user_id = excluded.user_id,
       type = excluded.type,
       amount = excluded.amount,
       status = excluded.status,
       requested_at = excluded.requested_at,
       processed_at = excluded.processed_at,
       details_json = excluded.details_json`,
    [requestId, userId, type, Number(amount || 0), status, requestedAt, processedAt, JSON.stringify(details || {})]
  );
}

async function listFundRequests(d1, { status = 'pending', type = null, userId = null, limit = 200 } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (userId) {
    conditions.push('user_id = ?');
    params.push(userId);
  }
  params.push(limit);

  const rows = await d1.all(
    `SELECT request_id, user_id, type, amount, status, requested_at, processed_at, details_json
     FROM fund_requests
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY requested_at DESC
     LIMIT ?`,
    params
  );

  return rows.map((row) => {
    let details = {};
    try {
      details = row.details_json ? JSON.parse(row.details_json) : {};
    } catch {
      details = {};
    }
    return { ...details, ...row, details_json: undefined };
  });
}

async function updateFundRequestStatus(d1, { requestId, status, processedAt = nowMs(), details = {} }) {
  const existing = await d1.first(
    `SELECT details_json FROM fund_requests WHERE request_id = ? LIMIT 1`,
    [requestId]
  );
  let currentDetails = {};
  try {
    currentDetails = existing?.details_json ? JSON.parse(existing.details_json) : {};
  } catch {
    currentDetails = {};
  }

  await d1.query(
    `UPDATE fund_requests
     SET status = ?, processed_at = ?, details_json = ?
     WHERE request_id = ?`,
    [status, processedAt, JSON.stringify({ ...currentDetails, ...(details || {}) }), requestId]
  );
}

async function cleanupExpiredNotifications(d1, now = nowMs()) {
  await d1.query(
    `DELETE FROM notification_recipients
     WHERE notification_id IN (
       SELECT id FROM notifications
       WHERE expires_at <= ?
     )`,
    [now]
  );
  await d1.query('DELETE FROM notifications WHERE expires_at <= ?', [now]);
}

function normalizeNotificationRow(row = {}) {
  return {
    id: row.id,
    title: row.title || '',
    message: row.message || '',
    senderId: row.sender_id || row.senderId || '',
    audience: row.audience || '',
    createdAt: row.created_at || row.createdAt || 0,
    expiresAt: row.expires_at || row.expiresAt || 0,
    deliveredAt: row.delivered_at || row.deliveredAt || 0,
    readAt: row.read_at || row.readAt || null,
    deliveredCount: row.delivered_count || row.deliveredCount || 0,
    readCount: row.read_count || row.readCount || 0,
    unreadCount: row.unread_count || row.unreadCount || 0
  };
}

async function createNotification(d1, { title = '', message = '', audience = 'selected', recipients = [], senderId = ADMIN_UID }) {
  const cleanMessage = String(message || '').trim().slice(0, 4000);
  if (!cleanMessage) throw new Error('MESSAGE_REQUIRED');

  const uniqueRecipients = Array.from(new Set((Array.isArray(recipients) ? recipients : [])
    .map((recipient) => String(recipient || '').trim())
    .filter(Boolean)));
  if (!uniqueRecipients.length) throw new Error('RECIPIENTS_REQUIRED');

  const createdAt = nowMs();
  const id = `notif_${createdAt}_${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = createdAt + NOTIFICATION_RETENTION_MS;
  await d1.query(
    `INSERT INTO notifications (id, title, message, sender_id, audience, created_at, expires_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [id, String(title || '').trim().slice(0, 160), cleanMessage, senderId, String(audience || 'selected').slice(0, 40), createdAt, expiresAt]
  );

  for (const userId of uniqueRecipients) {
    await d1.query(
      `INSERT OR IGNORE INTO notification_recipients (notification_id, user_id, delivered_at, read_at)
       VALUES (?, ?, ?, NULL)`,
      [id, userId, createdAt]
    );
  }

  return { id, title: String(title || '').trim().slice(0, 160), message: cleanMessage, audience, createdAt, expiresAt, deliveredCount: uniqueRecipients.length };
}

async function listUserNotifications(d1, userId, limit = 80) {
  await cleanupExpiredNotifications(d1).catch((error) => console.error('Notification cleanup failed:', error));
  const rows = await d1.all(
    `SELECT n.id, n.title, n.message, n.sender_id, n.audience, n.created_at, n.expires_at,
            r.delivered_at, r.read_at
     FROM notifications n
     INNER JOIN notification_recipients r ON r.notification_id = n.id
     WHERE r.user_id = ?
       AND n.deleted_at IS NULL
       AND n.expires_at > ?
     ORDER BY n.created_at DESC
     LIMIT ?`,
    [userId, nowMs(), limit]
  );
  return rows.map(normalizeNotificationRow);
}

async function listAdminNotifications(d1, limit = 80) {
  await cleanupExpiredNotifications(d1).catch((error) => console.error('Notification cleanup failed:', error));
  const rows = await d1.all(
    `SELECT n.id, n.title, n.message, n.sender_id, n.audience, n.created_at, n.expires_at,
            COUNT(r.user_id) AS delivered_count,
            SUM(CASE WHEN r.read_at IS NOT NULL THEN 1 ELSE 0 END) AS read_count,
            SUM(CASE WHEN r.read_at IS NULL THEN 1 ELSE 0 END) AS unread_count
     FROM notifications n
     LEFT JOIN notification_recipients r ON r.notification_id = n.id
     WHERE n.deleted_at IS NULL
       AND n.expires_at > ?
     GROUP BY n.id
     ORDER BY n.created_at DESC
     LIMIT ?`,
    [nowMs(), limit]
  );
  return rows.map(normalizeNotificationRow);
}

async function markNotificationRead(d1, notificationId, userId, readAt = nowMs()) {
  await d1.query(
    `UPDATE notification_recipients
     SET read_at = COALESCE(read_at, ?)
     WHERE notification_id = ?
       AND user_id = ?`,
    [readAt, notificationId, userId]
  );
}

async function deleteNotification(d1, notificationId, deletedAt = nowMs()) {
  await d1.query(
    `UPDATE notifications
     SET deleted_at = ?
     WHERE id = ?`,
    [deletedAt, notificationId]
  );
}

async function putR2Object(r2, key, body, contentType = 'application/json') {
  if (!r2) throw new Error('R2 is not configured');

  await r2.send(new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType
  }));

  const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
  return publicBase ? `${publicBase.replace(/\/$/, '')}/${key}` : key;
}

async function getR2Object(r2, key) {
  if (!r2) throw new Error('R2 is not configured');

  const result = await r2.send(new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key
  }));

  return result.Body.transformToString();
}

function registerRoutes(app, { d1, r2 }) {
  app.post('/api/session/firebase', async (req, res) => {
    try {
      const idToken = String(req.body.idToken || '');
      if (!idToken) return res.status(400).json({ ok: false, error: 'FIREBASE_ID_TOKEN_REQUIRED' });

      const decoded = await admin.auth().verifyIdToken(idToken);
      const user = await upsertFirebaseUser(d1, decoded, req.body.profile || {});

      return res.json({
        ok: true,
        token: createAppToken(user),
        user: { id: user.id, email: user.email, firebaseUid: user.firebase_uid, name: user.name || '', mobile: user.mobile || '' }
      });
    } catch (error) {
      console.error('Firebase session failed:', error);
      return res.status(401).json({ ok: false, error: 'INVALID_FIREBASE_TOKEN' });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const email = normalizeEmail(req.body.email);
      const password = String(req.body.password || '');

      if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'EMAIL_AND_PASSWORD_REQUIRED' });
      }

      const existing = await findUserByEmail(d1, email);
      if (existing) {
        if (!existing.password_hash) return res.status(401).json({ ok: false, error: 'USE_FIREBASE_SESSION' });
        const valid = await bcrypt.compare(password, existing.password_hash);
        if (!valid) return res.status(401).json({ ok: false, error: 'INVALID_LOGIN' });

        return res.json({
          ok: true,
          migrated: false,
          token: createAppToken(existing),
          user: { id: existing.id, email: existing.email, firebaseUid: existing.firebase_uid }
        });
      }

      const firebaseUser = await signInFirebaseEmailPassword(email, password);
      const decoded = await admin.auth().verifyIdToken(firebaseUser.idToken);
      const passwordHash = await bcrypt.hash(password, 12);
      const migratedUser = await createUser(d1, {
        id: decoded.uid,
        firebaseUid: decoded.uid,
        email,
        passwordHash,
        migratedAt: nowMs()
      });

      return res.json({
        ok: true,
        migrated: true,
        token: createAppToken(migratedUser),
        user: { id: migratedUser.id, email: migratedUser.email, firebaseUid: migratedUser.firebase_uid }
      });
    } catch (error) {
      console.error('Login failed:', error);
      return res.status(401).json({ ok: false, error: 'INVALID_LOGIN' });
    }
  });

  app.get('/api/transactions/:userId', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== req.params.userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }

    const history = await getTransactionHistory(d1, req.params.userId, {
      limit: Number(req.query.limit || 50),
      before: Number(req.query.before || Number.MAX_SAFE_INTEGER)
    });

    res.json({ ok: true, history });
  });

  app.post('/api/transactions', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== req.body.userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }

    await saveTransaction(d1, req.body);
    res.json({ ok: true });
  });

  app.post('/api/transactions/import', requireHttpAuth, async (req, res) => {
    const userId = String(req.body.userId || '');
    const transactions = Array.isArray(req.body.transactions) ? req.body.transactions : [];
    if (req.auth.sub !== userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }

    const limited = transactions.slice(0, 500);
    for (const transaction of limited) {
      await saveTransaction(d1, { ...transaction, userId });
    }
    res.json({ ok: true, imported: limited.length });
  });

  app.post('/api/transactions/transfer', requireHttpAuth, async (req, res) => {
    const sender = req.body.sender || {};
    const recipient = req.body.recipient || {};
    if (req.auth.sub !== sender.userId) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }
    if (!recipient.userId) {
      return res.status(400).json({ ok: false, error: 'RECIPIENT_REQUIRED' });
    }

    await saveTransaction(d1, sender);
    await saveTransaction(d1, recipient);
    res.json({ ok: true });
  });

  app.get('/api/fund-requests', requireHttpAuth, async (req, res) => {
    const userId = req.query.userId ? String(req.query.userId) : null;
    if (userId && req.auth.sub !== userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }
    if (!userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }

    const requestedStatus = req.query.status ? String(req.query.status) : 'pending';
    const requests = await listFundRequests(d1, {
      status: requestedStatus === 'all' ? null : requestedStatus,
      type: req.query.type ? String(req.query.type) : null,
      userId,
      limit: Math.min(Number(req.query.limit || 200), 500)
    });
    res.json({ ok: true, requests });
  });

  app.post('/api/fund-requests', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== req.body.userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }
    await saveFundRequest(d1, req.body);
    res.json({ ok: true });
  });

  app.post('/api/fund-requests/import', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }
    const requests = Array.isArray(req.body.requests) ? req.body.requests.slice(0, 500) : [];
    for (const request of requests) {
      await saveFundRequest(d1, request);
    }
    res.json({ ok: true, imported: requests.length });
  });

  app.patch('/api/fund-requests/:requestId', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }
    await updateFundRequestStatus(d1, {
      requestId: req.params.requestId,
      status: req.body.status,
      details: req.body.details || {}
    });
    res.json({ ok: true });
  });

  app.post('/api/invoices/:invoiceId', requireHttpAuth, async (req, res) => {
    const key = `invoices/${req.auth.sub}/${req.params.invoiceId}.json`;
    const urlOrKey = await putR2Object(r2, key, JSON.stringify(req.body, null, 2));
    res.json({ ok: true, key: urlOrKey });
  });

  app.get('/api/admin/chats', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }

    const rooms = await listChatRooms(d1, {
      limit: Math.min(Number(req.query.limit || 100), 300)
    });

    res.json({ ok: true, chats: rooms });
  });

  app.get('/api/chats/:roomId', requireHttpAuth, async (req, res) => {
    const roomId = String(req.params.roomId || '');
    const roomUserId = roomId.replace(/^support_/, '');
    if (!roomId || (!req.auth.isAdmin && req.auth.sub !== roomUserId)) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }

    const history = await recentChatHistory(d1, roomId, Math.min(Number(req.query.limit || 80), 200));
    res.json({ ok: true, history });
  });

  app.get('/api/notifications', requireHttpAuth, async (req, res) => {
    const notifications = await listUserNotifications(d1, req.auth.sub, Math.min(Number(req.query.limit || 80), 200));
    res.json({ ok: true, notifications });
  });

  app.post('/api/notifications/:notificationId/read', requireHttpAuth, async (req, res) => {
    await markNotificationRead(d1, req.params.notificationId, req.auth.sub);
    res.json({ ok: true });
  });

  app.get('/api/admin/notifications', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }
    const notifications = await listAdminNotifications(d1, Math.min(Number(req.query.limit || 80), 200));
    res.json({ ok: true, notifications });
  });

  app.post('/api/admin/notifications', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }
    const notification = await createNotification(d1, {
      title: req.body.title,
      message: req.body.message,
      audience: req.body.audience,
      recipients: req.body.recipients,
      senderId: req.auth.sub
    });
    res.json({ ok: true, notification });
  });

  app.delete('/api/admin/notifications/:notificationId', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }
    await deleteNotification(d1, req.params.notificationId);
    res.json({ ok: true });
  });
}

function requireHttpAuth(req, res, next) {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
    req.auth = verifyAppToken(token);
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
  }
}

function registerSocketHandlers(io, { d1 }) {
  const adminRooms = new Map();

  const addAdminRoomPresence = (roomId, socketId) => {
    const sockets = adminRooms.get(roomId) || new Set();
    sockets.add(socketId);
    adminRooms.set(roomId, sockets);
  };

  const removeAdminRoomPresence = (roomId, socketId) => {
    const sockets = adminRooms.get(roomId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) adminRooms.delete(roomId);
  };

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) throw new Error('AUTH_REQUIRED');
      socket.user = verifyAppToken(token);
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', (socket) => {
    socket.adminJoinedRooms = new Set();

    socket.on('join_room', async ({ roomId, limit = 50 }, ack) => {
      try {
        if (!roomId) throw new Error('ROOM_REQUIRED');
        socket.join(roomId);
        if (socket.user.isAdmin) {
          addAdminRoomPresence(roomId, socket.id);
          socket.adminJoinedRooms.add(roomId);
          await markRoomReadByAdmin(d1, roomId);
          cleanupExpiredReadChats(d1).catch((error) => console.error('Chat cleanup failed:', error));
        }
        const history = await recentChatHistory(d1, roomId, limit);
        socket.emit('chat_history', { roomId, history });
        if (ack) ack({ ok: true });
      } catch (error) {
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    socket.on('leave_room', ({ roomId }, ack) => {
      if (roomId) {
        socket.leave(roomId);
        removeAdminRoomPresence(roomId, socket.id);
        socket.adminJoinedRooms.delete(roomId);
      }
      if (ack) ack({ ok: true });
    });

    socket.on('send_message', ({ roomId, message, userMeta = {} }, ack) => {
      try {
        if (!roomId || !String(message || '').trim()) throw new Error('ROOM_AND_MESSAGE_REQUIRED');

        const timestamp = nowMs();
        const readByAdminAt = (!socket.user.isAdmin && adminRooms.has(roomId)) ? timestamp : null;
        const chatMessage = {
          roomId,
          senderId: socket.user.sub,
          message: String(message).slice(0, 4000),
          timestamp,
          readByAdminAt
        };

        io.to(roomId).emit('new_message', chatMessage);
        Promise.all([
          saveChatMessage(d1, chatMessage),
          upsertChatRoom(d1, {
            roomId,
            userId: userMeta.userId || roomId.replace(/^support_/, ''),
            userName: String(userMeta.userName || '').slice(0, 120),
            userEmail: normalizeEmail(userMeta.userEmail || ''),
            userMobile: String(userMeta.userMobile || '').slice(0, 30),
            lastMessage: chatMessage.message,
            lastSenderId: chatMessage.senderId,
            updatedAt: timestamp
          })
        ]).catch((error) => console.error('Async chat persist failed:', error));

        if (ack) ack({ ok: true, message: chatMessage });
      } catch (error) {
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      socket.adminJoinedRooms.forEach((roomId) => removeAdminRoomPresence(roomId, socket.id));
      socket.adminJoinedRooms.clear();
    });
  });
}

async function createCloudflareWalletService() {
  assertEnv();
  initFirebaseAdmin();

  const d1 = new D1Client();
  const r2 = createR2Client();

  await initSchema(d1);
  cleanupExpiredReadChats(d1).catch((error) => console.error('Initial chat cleanup failed:', error));
  cleanupExpiredNotifications(d1).catch((error) => console.error('Initial notification cleanup failed:', error));
  const cleanupTimer = setInterval(() => {
    cleanupExpiredReadChats(d1).catch((error) => console.error('Scheduled chat cleanup failed:', error));
    cleanupExpiredNotifications(d1).catch((error) => console.error('Scheduled notification cleanup failed:', error));
  }, 60 * 60 * 1000);
  cleanupTimer.unref?.();

  return {
    d1,
    r2,
    registerRoutes: (app) => registerRoutes(app, { d1, r2 }),
    registerSocketHandlers: (io) => registerSocketHandlers(io, { d1 }),
    saveTransaction: (transaction) => saveTransaction(d1, transaction),
    getTransactionHistory: (userId, options) => getTransactionHistory(d1, userId, options),
    saveFundRequest: (request) => saveFundRequest(d1, request),
    listFundRequests: (options) => listFundRequests(d1, options),
    listChatRooms: (options) => listChatRooms(d1, options),
    putInvoice: (userId, invoiceId, data) =>
      putR2Object(r2, `invoices/${userId}/${invoiceId}.json`, JSON.stringify(data, null, 2)),
    getInvoice: (userId, invoiceId) =>
      getR2Object(r2, `invoices/${userId}/${invoiceId}.json`)
  };
}

module.exports = {
  createCloudflareWalletService,
  D1Client,
  initSchema,
  registerRoutes,
  registerSocketHandlers,
  saveTransaction,
  getTransactionHistory,
  saveFundRequest,
  listFundRequests,
  listChatRooms
};
