const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const Tesseract = require('tesseract.js');
const { google } = require('googleapis');
const { Readable } = require('stream');

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
const LOAN_DOCUMENT_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const LOAN_DOCUMENT_TYPES = new Set(['aadhaar', 'selfie']);

function createAppToken(user) {
  const firebaseUid = user.firebase_uid || user.firebaseUid || null;
  const email = normalizeEmail(user.email);
  const effectiveUserId = firebaseUid || user.id;
  const isAdmin = user.id === ADMIN_UID || firebaseUid === ADMIN_UID || email === 'reviewsworld01@gmail.com';
  return jwt.sign(
    {
      sub: effectiveUserId,
      d1UserId: user.id,
      email,
      firebaseUid,
      isAdmin
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
      read_by_admin_at INTEGER,
      read_by_user_at INTEGER,
      client_message_id TEXT
    )
  `);

  await ensureColumn(d1, 'chats', 'read_by_admin_at', 'INTEGER');
  await ensureColumn(d1, 'chats', 'read_by_user_at', 'INTEGER');
  await ensureColumn(d1, 'chats', 'client_message_id', 'TEXT');

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_room_time
    ON chats (room_id, timestamp DESC)
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_admin_read_cleanup
    ON chats (read_by_admin_at)
  `);

  await d1.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_client_message_id
    ON chats (client_message_id)
    WHERE client_message_id IS NOT NULL
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
    CREATE TABLE IF NOT EXISTS loan_requests (
      request_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_at INTEGER NOT NULL,
      processed_at INTEGER,
      details_json TEXT
    )
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_loan_requests_status_time
    ON loan_requests (status, requested_at DESC)
  `);

  await d1.query(`
    CREATE INDEX IF NOT EXISTS idx_loan_requests_user_status
    ON loan_requests (user_id, status)
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

  await d1.query(`
    CREATE TABLE IF NOT EXISTS task_comment_reservations (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      comment TEXT NOT NULL,
      comment_index INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'reserved',
      reserved_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      submitted_at INTEGER,
      details_json TEXT
    )
  `);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_task_reservations_task_status ON task_comment_reservations (task_id, status, expires_at)`);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_task_reservations_user ON task_comment_reservations (user_id, status)`);

  await d1.query(`
    CREATE TABLE IF NOT EXISTS task_submissions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reservation_id TEXT,
      assigned_comment TEXT,
      screenshot_url TEXT,
      screenshot_key TEXT,
      screenshot_view_url TEXT,
      screenshot_drive_path TEXT,
      ocr_status TEXT DEFAULT 'pending',
      ocr_extracted_text TEXT,
      ocr_extracted_name TEXT,
      ocr_confidence REAL DEFAULT 0,
      scraper_status TEXT DEFAULT 'not_configured',
      scraper_result_json TEXT,
      manual_status TEXT DEFAULT 'pending',
      payout_status TEXT DEFAULT 'pending',
      payout_delay_days INTEGER DEFAULT 7,
      reward REAL DEFAULT 0,
      task_link TEXT,
      app_name TEXT,
      user_name TEXT,
      user_email TEXT,
      submitted_at INTEGER NOT NULL,
      verified_at INTEGER,
      paid_at INTEGER,
      details_json TEXT
    )
  `);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_task_submissions_task ON task_submissions (task_id, submitted_at DESC)`);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_task_submissions_user ON task_submissions (user_id, submitted_at DESC)`);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_task_submissions_ocr ON task_submissions (ocr_status)`);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_task_submissions_manual ON task_submissions (manual_status, submitted_at DESC)`);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_task_submissions_payout ON task_submissions (payout_status, manual_status, submitted_at)`);

  await d1.query(`
    CREATE TABLE IF NOT EXISTS sync_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    )
  `);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_sync_audit_status ON sync_audit_log (status, created_at DESC)`);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_sync_audit_entity ON sync_audit_log (entity_type, entity_id)`);
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
    `SELECT id, room_id, sender_id, message, timestamp, read_by_admin_at, read_by_user_at, client_message_id
     FROM chats
     WHERE room_id = ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    [roomId, limit]
  );

  return rows.reverse();
}

async function saveChatMessage(d1, { roomId, senderId, message, timestamp, readByAdminAt = null, readByUserAt = null, clientMessageId = null }) {
  const cleanClientMessageId = clientMessageId ? String(clientMessageId).slice(0, 120) : null;
  await d1.query(
    `INSERT OR IGNORE INTO chats (room_id, sender_id, message, timestamp, read_by_admin_at, read_by_user_at, client_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [roomId, senderId, message, timestamp, readByAdminAt, readByUserAt, cleanClientMessageId]
  );
  if (!cleanClientMessageId) return true;
  const row = await d1.first(
    `SELECT sender_id, timestamp FROM chats WHERE client_message_id = ? LIMIT 1`,
    [cleanClientMessageId]
  );
  return !!row && row.sender_id === senderId && Number(row.timestamp) === Number(timestamp);
}

async function markRoomReadByAdmin(d1, roomId, readAt = nowMs()) {
  await d1.query(
    `UPDATE chats
     SET read_by_admin_at = COALESCE(read_by_admin_at, ?)
     WHERE room_id = ?
       AND sender_id != ?`,
    [readAt, roomId, ADMIN_UID]
  );
  return readAt;
}

async function markRoomReadByUser(d1, roomId, readAt = nowMs()) {
  await d1.query(
    `UPDATE chats
     SET read_by_user_at = COALESCE(read_by_user_at, ?)
     WHERE room_id = ?
       AND sender_id = ?`,
    [readAt, roomId, ADMIN_UID]
  );
  return readAt;
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

async function saveLoanRequest(d1, { requestId, userId, status = 'pending', requestedAt = nowMs(), processedAt = null, details = {} }) {
  await d1.query(
    `INSERT INTO loan_requests (request_id, user_id, status, requested_at, processed_at, details_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(request_id) DO UPDATE SET
       user_id = excluded.user_id,
       status = excluded.status,
       requested_at = excluded.requested_at,
       processed_at = excluded.processed_at,
       details_json = excluded.details_json`,
    [requestId, userId, status, requestedAt, processedAt, JSON.stringify(details || {})]
  );
}

async function listLoanRequests(d1, { status = 'pending', userId = null, limit = 300 } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (userId) {
    conditions.push('user_id = ?');
    params.push(userId);
  }
  params.push(limit);

  const rows = await d1.all(
    `SELECT request_id, user_id, status, requested_at, processed_at, details_json
     FROM loan_requests
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

async function updateLoanRequestStatus(d1, { requestId, status, processedAt = nowMs(), details = {} }) {
  const existing = await d1.first(
    `SELECT details_json FROM loan_requests WHERE request_id = ? LIMIT 1`,
    [requestId]
  );
  let currentDetails = {};
  try {
    currentDetails = existing?.details_json ? JSON.parse(existing.details_json) : {};
  } catch {
    currentDetails = {};
  }

  await d1.query(
    `UPDATE loan_requests
     SET status = ?, processed_at = ?, details_json = ?
     WHERE request_id = ?`,
    [status, processedAt, JSON.stringify({ ...currentDetails, ...(details || {}) }), requestId]
  );
}

async function cleanupExpiredNotifications(d1, now = nowMs()) {
  const readCutoff = now - NOTIFICATION_RETENTION_MS;
  await d1.query(
    `DELETE FROM notification_recipients
     WHERE read_at IS NOT NULL
       AND read_at <= ?`,
    [readCutoff]
  );
  await d1.query(
    `DELETE FROM notification_recipients
     WHERE notification_id IN (
       SELECT id FROM notifications
       WHERE expires_at <= ?
     )`,
    [now]
  );
  await d1.query('DELETE FROM notifications WHERE expires_at <= ?', [now]);
  await d1.query(
    `DELETE FROM notifications
     WHERE NOT EXISTS (
       SELECT 1 FROM notification_recipients
       WHERE notification_recipients.notification_id = notifications.id
     )`
  );
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

  const chunkSize = 100;
  for (let index = 0; index < uniqueRecipients.length; index += chunkSize) {
    const chunk = uniqueRecipients.slice(index, index + chunkSize);
    const valuesSql = chunk.map(() => '(?, ?, ?, NULL)').join(', ');
    const params = chunk.flatMap((userId) => [id, userId, createdAt]);
    await d1.query(
      `INSERT OR IGNORE INTO notification_recipients (notification_id, user_id, delivered_at, read_at)
       VALUES ${valuesSql}`,
      params
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

async function listNotificationRecipients(d1, notificationId, limit = 1000) {
  const rows = await d1.all(
    `SELECT notification_id, user_id, delivered_at, read_at
     FROM notification_recipients
     WHERE notification_id = ?
     ORDER BY
       CASE WHEN read_at IS NOT NULL THEN 0 ELSE 1 END,
       COALESCE(read_at, delivered_at) DESC
     LIMIT ?`,
    [notificationId, limit]
  );
  return rows.map((row) => ({
    notificationId: row.notification_id,
    userId: row.user_id,
    deliveredAt: row.delivered_at || 0,
    readAt: row.read_at || null
  }));
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

function sanitizeUploadFileName(fileName = 'document') {
  const cleaned = String(fileName || 'document')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(-80);
  return cleaned || 'document';
}

// ── Google Drive Upload Helper (Organized Folders) ──────────────────────────
let _driveClient = null;
const _driveFolderCache = new Map(); // cache: "parentId/folderName" → folderId

function getGoogleDriveClient() {
  if (_driveClient) return _driveClient;
  const saJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (!saJson) return null;
  try {
    const credentials = typeof saJson === 'string' ? JSON.parse(saJson) : saJson;
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    _driveClient = google.drive({ version: 'v3', auth });
    return _driveClient;
  } catch (err) {
    console.error('Google Drive auth failed:', err.message);
    return null;
  }
}

/**
 * Find or create a subfolder inside a parent folder.
 * Caches folder IDs in memory to avoid repeated API lookups.
 */
async function findOrCreateDriveFolder(drive, parentId, folderName) {
  const cacheKey = `${parentId}/${folderName}`;
  if (_driveFolderCache.has(cacheKey)) return _driveFolderCache.get(cacheKey);

  // Search for existing folder
  const searchResult = await drive.files.list({
    q: `'${parentId}' in parents AND name = '${folderName.replace(/'/g, "\\'")}' AND mimeType = 'application/vnd.google-apps.folder' AND trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1
  });

  if (searchResult.data.files && searchResult.data.files.length > 0) {
    const folderId = searchResult.data.files[0].id;
    _driveFolderCache.set(cacheKey, folderId);
    return folderId;
  }

  // Create new folder
  const createResult = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id'
  });

  const newFolderId = createResult.data.id;

  // Make folder publicly viewable (so admin can browse from Drive)
  await drive.permissions.create({
    fileId: newFolderId,
    requestBody: { role: 'reader', type: 'anyone' }
  }).catch(() => {}); // non-critical if parent already has public access

  _driveFolderCache.set(cacheKey, newFolderId);
  return newFolderId;
}

/**
 * Upload screenshot to Google Drive with organized folder structure:
 *   Root Folder → DD-MM-YYYY → AppName → screenshot files
 */
async function uploadToGoogleDrive(buffer, fileName, mimeType, rootFolderId, { appName = 'Unknown App' } = {}) {
  const drive = getGoogleDriveClient();
  if (!drive) throw new Error('GOOGLE_DRIVE_NOT_CONFIGURED');

  // Step 1: Find or create date folder (DD-MM-YYYY)
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const dateFolderId = await findOrCreateDriveFolder(drive, rootFolderId, dateStr);

  // Step 2: Find or create app name folder inside date folder
  const safeAppName = String(appName || 'Unknown App').replace(/[<>:"/\\|?*]+/g, '_').trim().slice(0, 100) || 'Unknown App';
  const appFolderId = await findOrCreateDriveFolder(drive, dateFolderId, safeAppName);

  // Step 3: Upload file into app folder
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [appFolderId]
    },
    media: {
      mimeType: mimeType || 'image/jpeg',
      body: Readable.from(buffer)
    },
    fields: 'id, name, webViewLink, webContentLink, size'
  });

  const fileId = response.data.id;

  // Make the file publicly viewable
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' }
  });

  return {
    fileId,
    name: response.data.name,
    dateFolderName: dateStr,
    appFolderName: safeAppName,
    viewUrl: response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    downloadUrl: response.data.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
    directUrl: `https://lh3.googleusercontent.com/d/${fileId}`
  };
}

// Clear folder cache every hour to pick up any manual Drive changes
setInterval(() => _driveFolderCache.clear(), 60 * 60 * 1000);

function sanitizePathSegment(value = 'user') {
  const cleaned = String(value || 'user').replace(/[^\w-]+/g, '_').slice(0, 80);
  return cleaned || 'user';
}

function normalizeContentType(value) {
  return String(value || 'application/octet-stream').split(';')[0].trim().toLowerCase() || 'application/octet-stream';
}

function getLoanDocumentExtension(fileName, contentType) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (ext && ext.length <= 8) return ext;
  if (contentType === 'application/pdf') return '.pdf';
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  if (contentType === 'image/heic') return '.heic';
  if (contentType === 'image/heif') return '.heif';
  return '.jpg';
}

function isSupportedLoanDocument(documentType, fileName, contentType) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const isImage = contentType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(ext);
  const isPdf = contentType === 'application/pdf' || ext === '.pdf';
  return documentType === 'selfie' ? isImage : isImage || isPdf;
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let finished = false;

    const fail = (error) => {
      if (finished) return;
      finished = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      if (finished) return;
      total += chunk.length;
      if (total > maxBytes) {
        const error = new Error('UPLOAD_TOO_LARGE');
        error.code = 'UPLOAD_TOO_LARGE';
        fail(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (finished) return;
      finished = true;
      resolve(Buffer.concat(chunks, total));
    });

    req.on('error', fail);
  });
}

// ── Task Reservation helpers ───────────────────────────────────────────────
const TASK_RESERVATION_MS = 5 * 60 * 1000;
const TASK_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

async function cleanupExpiredReservations(d1) {
  await d1.query(
    `UPDATE task_comment_reservations SET status = 'expired' WHERE status = 'reserved' AND expires_at <= ?`,
    [nowMs()]
  );
}

async function reserveTaskComment(d1, { taskId, userId, userName, userEmail, comments, reservationMs = TASK_RESERVATION_MS }) {
  await cleanupExpiredReservations(d1);

  // Check existing active reservation for this user+task
  const existing = await d1.first(
    `SELECT * FROM task_comment_reservations WHERE task_id = ? AND user_id = ? AND status = 'reserved' AND expires_at > ? LIMIT 1`,
    [taskId, userId, nowMs()]
  );
  if (existing) {
    let details = {};
    try { details = existing.details_json ? JSON.parse(existing.details_json) : {}; } catch { details = {}; }
    return { ...details, ...existing, details_json: undefined };
  }

  // Check already submitted
  const submitted = await d1.first(
    `SELECT id FROM task_submissions WHERE task_id = ? AND user_id = ? LIMIT 1`,
    [taskId, userId]
  );
  if (submitted) throw new Error('TASK_ALREADY_SUBMITTED');

  // Find used comments by other active reservations
  const activeReservations = await d1.all(
    `SELECT comment FROM task_comment_reservations WHERE task_id = ? AND status IN ('reserved', 'submitted') AND (expires_at > ? OR status = 'submitted') AND user_id != ?`,
    [taskId, nowMs(), userId]
  );
  const usedComments = new Set(activeReservations.map(r => r.comment));

  // Pick first available comment
  const commentsList = Array.isArray(comments) ? comments : ['good app'];
  const comment = commentsList.find(c => !usedComments.has(c)) || commentsList[0];
  const commentIndex = Math.max(0, commentsList.indexOf(comment));

  const now = nowMs();
  const expiresAt = now + reservationMs;
  const id = `res_${taskId.slice(0,12)}_${userId.slice(0,12)}_${now}`;

  const detailsObj = { userName: userName || '', userEmail: userEmail || '' };

  await d1.query(
    `INSERT INTO task_comment_reservations (id, task_id, user_id, comment, comment_index, status, reserved_at, expires_at, details_json)
     VALUES (?, ?, ?, ?, ?, 'reserved', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       comment = excluded.comment, comment_index = excluded.comment_index,
       status = 'reserved', reserved_at = excluded.reserved_at,
       expires_at = excluded.expires_at, details_json = excluded.details_json`,
    [id, taskId, userId, comment, commentIndex, now, expiresAt, JSON.stringify(detailsObj)]
  );

  return { id, task_id: taskId, user_id: userId, comment, comment_index: commentIndex, status: 'reserved', reserved_at: now, expires_at: expiresAt, ...detailsObj };
}

async function getTaskReservation(d1, taskId, userId) {
  await cleanupExpiredReservations(d1);
  const row = await d1.first(
    `SELECT * FROM task_comment_reservations WHERE task_id = ? AND user_id = ? AND status = 'reserved' AND expires_at > ? LIMIT 1`,
    [taskId, userId, nowMs()]
  );
  if (!row) return null;
  let details = {};
  try { details = row.details_json ? JSON.parse(row.details_json) : {}; } catch { details = {}; }
  return { ...details, ...row, details_json: undefined };
}

async function markReservationSubmitted(d1, reservationId) {
  await d1.query(
    `UPDATE task_comment_reservations SET status = 'submitted', submitted_at = ? WHERE id = ?`,
    [nowMs(), reservationId]
  );
}

// ── Task Submission helpers ────────────────────────────────────────────────
async function saveTaskSubmission(d1, { id, taskId, userId, reservationId, assignedComment, screenshotUrl, screenshotKey, screenshotViewUrl, screenshotDrivePath, reward, taskLink, appName, userName, userEmail, payoutDelayDays = 7, details = {} }) {
  const submittedAt = nowMs();
  const submissionId = id || `sub_${taskId.slice(0,12)}_${userId.slice(0,12)}_${submittedAt}`;
  await d1.query(
    `INSERT INTO task_submissions (id, task_id, user_id, reservation_id, assigned_comment, screenshot_url, screenshot_key, screenshot_view_url, screenshot_drive_path, reward, task_link, app_name, user_name, user_email, payout_delay_days, submitted_at, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       screenshot_url = excluded.screenshot_url, screenshot_key = excluded.screenshot_key,
       screenshot_view_url = excluded.screenshot_view_url, screenshot_drive_path = excluded.screenshot_drive_path,
       details_json = excluded.details_json`,
    [submissionId, taskId, userId, reservationId || null, assignedComment || '', screenshotUrl || '', screenshotKey || '', screenshotViewUrl || '', screenshotDrivePath || '', Number(reward || 0), taskLink || '', appName || '', userName || '', userEmail || '', payoutDelayDays, submittedAt, JSON.stringify(details || {})]
  );
  return submissionId;
}

async function listTaskSubmissions(d1, { taskId = null, userId = null, manualStatus = null, ocrStatus = null, payoutStatus = null, limit = 200 } = {}) {
  const conditions = [];
  const params = [];
  if (taskId) { conditions.push('task_id = ?'); params.push(taskId); }
  if (userId) { conditions.push('user_id = ?'); params.push(userId); }
  if (manualStatus) { conditions.push('manual_status = ?'); params.push(manualStatus); }
  if (ocrStatus) { conditions.push('ocr_status = ?'); params.push(ocrStatus); }
  if (payoutStatus) { conditions.push('payout_status = ?'); params.push(payoutStatus); }
  params.push(limit);
  return d1.all(
    `SELECT * FROM task_submissions ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY submitted_at DESC LIMIT ?`,
    params
  );
}

async function updateTaskSubmission(d1, submissionId, updates = {}) {
  const fields = [];
  const params = [];
  if (updates.manualStatus !== undefined) { fields.push('manual_status = ?'); params.push(updates.manualStatus); }
  if (updates.ocrStatus !== undefined) { fields.push('ocr_status = ?'); params.push(updates.ocrStatus); }
  if (updates.ocrExtractedText !== undefined) { fields.push('ocr_extracted_text = ?'); params.push(updates.ocrExtractedText); }
  if (updates.ocrExtractedName !== undefined) { fields.push('ocr_extracted_name = ?'); params.push(updates.ocrExtractedName); }
  if (updates.ocrConfidence !== undefined) { fields.push('ocr_confidence = ?'); params.push(updates.ocrConfidence); }
  if (updates.scraperStatus !== undefined) { fields.push('scraper_status = ?'); params.push(updates.scraperStatus); }
  if (updates.scraperResultJson !== undefined) { fields.push('scraper_result_json = ?'); params.push(JSON.stringify(updates.scraperResultJson)); }
  if (updates.payoutStatus !== undefined) { fields.push('payout_status = ?'); params.push(updates.payoutStatus); }
  if (updates.verifiedAt !== undefined) { fields.push('verified_at = ?'); params.push(updates.verifiedAt); }
  if (updates.paidAt !== undefined) { fields.push('paid_at = ?'); params.push(updates.paidAt); }
  if (!fields.length) return;
  params.push(submissionId);
  await d1.query(`UPDATE task_submissions SET ${fields.join(', ')} WHERE id = ?`, params);
}

// ── Sync Audit helpers ─────────────────────────────────────────────────────
async function logSyncAudit(d1, { entityType, entityId, source, target, status = 'failed', errorMessage = '' }) {
  await d1.query(
    `INSERT INTO sync_audit_log (entity_type, entity_id, source, target, status, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, source, target, status, String(errorMessage || '').slice(0, 2000), nowMs()]
  );
}

async function listSyncAuditLogs(d1, { entityType = null, status = null, limit = 200 } = {}) {
  const conditions = [];
  const params = [];
  if (entityType) { conditions.push('entity_type = ?'); params.push(entityType); }
  if (status) { conditions.push('status = ?'); params.push(status); }
  params.push(limit);
  return d1.all(
    `SELECT * FROM sync_audit_log ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`,
    params
  );
}

async function resolveSyncAuditLog(d1, logId) {
  await d1.query(
    `UPDATE sync_audit_log SET status = 'resolved', resolved_at = ? WHERE id = ?`,
    [nowMs(), logId]
  );
}

async function getSyncAuditSummary(d1) {
  const rows = await d1.all(
    `SELECT entity_type, status, COUNT(*) as count FROM sync_audit_log GROUP BY entity_type, status ORDER BY entity_type, status`
  );
  const totalFailed = await d1.first(`SELECT COUNT(*) as count FROM sync_audit_log WHERE status = 'failed'`);
  const totalPending = await d1.first(`SELECT COUNT(*) as count FROM sync_audit_log WHERE status = 'pending'`);
  const totalResolved = await d1.first(`SELECT COUNT(*) as count FROM sync_audit_log WHERE status = 'resolved'`);
  return {
    breakdown: rows,
    totalFailed: totalFailed?.count || 0,
    totalPending: totalPending?.count || 0,
    totalResolved: totalResolved?.count || 0
  };
}

// ── Auto-Payout ────────────────────────────────────────────────────────────
async function processAutoPayouts(d1) {
  const now = nowMs();
  // Find submissions where: manual_status='approved', payout_status='pending',
  // scraper_status IN ('live_confirmed','not_applicable','checked'),
  // submitted_at <= now - (payout_delay_days * 86400000)
  const eligible = await d1.all(
    `SELECT * FROM task_submissions
     WHERE manual_status = 'approved'
       AND payout_status = 'pending'
       AND scraper_status IN ('live_confirmed', 'not_applicable', 'checked', 'not_configured')
       AND submitted_at <= (? - (payout_delay_days * 86400000))
     ORDER BY submitted_at ASC
     LIMIT 100`,
    [now]
  );

  let paidCount = 0;
  for (const sub of eligible) {
    try {
      const reward = Number(sub.reward || 0);
      if (reward <= 0) continue;

      // Create transaction
      const transactionId = `task_payout_${sub.id}_${now}`;
      await saveTransaction(d1, {
        userId: sub.user_id,
        transactionId,
        type: 'credit',
        amount: reward,
        status: 'completed',
        timestamp: now,
        details: {
          comment: `Task reward: ${sub.app_name || 'Task'}`,
          source: 'task_auto_payout',
          taskId: sub.task_id,
          submissionId: sub.id
        }
      });

      // Update submission
      await updateTaskSubmission(d1, sub.id, {
        payoutStatus: 'paid',
        paidAt: now,
        verifiedAt: sub.verified_at || now
      });

      paidCount++;
    } catch (error) {
      console.error(`Auto-payout failed for submission ${sub.id}:`, error);
      await logSyncAudit(d1, {
        entityType: 'task_payout',
        entityId: sub.id,
        source: 'auto_payout',
        target: 'd1',
        status: 'failed',
        errorMessage: error.message
      }).catch(() => {});
    }
  }

  if (paidCount) console.log(`Auto-payout: processed ${paidCount} task rewards`);
  return paidCount;
}

// ── Rate Limiter ───────────────────────────────────────────────────────────
const rateLimitBuckets = new Map();
function rateLimit({ windowMs = 60000, maxRequests = 60 } = {}) {
  return (req, res, next) => {
    const key = req.auth?.sub || req.ip || 'anon';
    const now = Date.now();
    let bucket = rateLimitBuckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { windowStart: now, count: 0 };
      rateLimitBuckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > maxRequests) {
      return res.status(429).json({ ok: false, error: 'RATE_LIMIT_EXCEEDED' });
    }
    next();
  };
}
// Cleanup stale buckets periodically
setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.windowStart < cutoff) rateLimitBuckets.delete(key);
  }
}, 60000).unref?.();

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

  app.post('/api/login', rateLimit({ windowMs: 60000, maxRequests: 10 }), async (req, res) => {
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

    // Server-side balance validation for transfers
    const senderAmount = Number(sender.amount || 0);
    const recipientAmount = Number(recipient.amount || 0);
    if (senderAmount >= 0) {
      return res.status(400).json({ ok: false, error: 'SENDER_AMOUNT_MUST_BE_NEGATIVE' });
    }
    if (recipientAmount <= 0) {
      return res.status(400).json({ ok: false, error: 'RECIPIENT_AMOUNT_MUST_BE_POSITIVE' });
    }
    if (Math.abs(senderAmount) !== Math.abs(recipientAmount)) {
      return res.status(400).json({ ok: false, error: 'TRANSFER_AMOUNTS_MISMATCH' });
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

  app.get('/api/loan-requests', requireHttpAuth, async (req, res) => {
    const userId = req.query.userId ? String(req.query.userId) : null;
    if (userId && req.auth.sub !== userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }
    if (!userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }

    const requestedStatus = req.query.status ? String(req.query.status) : 'pending';
    const requests = await listLoanRequests(d1, {
      status: requestedStatus === 'all' ? null : requestedStatus,
      userId,
      limit: Math.min(Number(req.query.limit || 300), 800)
    });
    res.json({ ok: true, requests });
  });

  app.post('/api/loan-requests', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== req.body.userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }
    await saveLoanRequest(d1, req.body);
    res.json({ ok: true });
  });

  app.post('/api/loan-requests/import', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }
    const requests = Array.isArray(req.body.requests) ? req.body.requests.slice(0, 800) : [];
    for (const request of requests) {
      await saveLoanRequest(d1, request);
    }
    res.json({ ok: true, imported: requests.length });
  });

  app.patch('/api/loan-requests/:requestId', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }
    await updateLoanRequestStatus(d1, {
      requestId: req.params.requestId,
      status: req.body.status,
      details: req.body.details || {}
    });
    res.json({ ok: true });
  });

  app.post('/api/uploads/loan-document', requireHttpAuth, async (req, res) => {
    try {
      if (!r2 || !process.env.CLOUDFLARE_R2_BUCKET) {
        return res.status(503).json({ ok: false, error: 'R2_NOT_CONFIGURED' });
      }
      if (!process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL) {
        return res.status(503).json({ ok: false, error: 'R2_PUBLIC_URL_NOT_CONFIGURED' });
      }

      const documentType = String(req.query.documentType || '').trim().toLowerCase();
      if (!LOAN_DOCUMENT_TYPES.has(documentType)) {
        return res.status(400).json({ ok: false, error: 'INVALID_DOCUMENT_TYPE' });
      }

      const declaredSize = Number(req.headers['content-length'] || req.query.size || 0);
      if (declaredSize > LOAN_DOCUMENT_UPLOAD_MAX_BYTES) {
        return res.status(413).json({ ok: false, error: 'UPLOAD_TOO_LARGE' });
      }

      const originalName = sanitizeUploadFileName(req.query.fileName || `${documentType}.jpg`);
      const contentType = normalizeContentType(req.headers['content-type'] || req.query.contentType);
      if (!isSupportedLoanDocument(documentType, originalName, contentType)) {
        return res.status(400).json({ ok: false, error: 'UNSUPPORTED_DOCUMENT_TYPE' });
      }

      const body = await readRequestBody(req, LOAN_DOCUMENT_UPLOAD_MAX_BYTES);
      if (!body.length) {
        return res.status(400).json({ ok: false, error: 'EMPTY_UPLOAD' });
      }

      const ext = getLoanDocumentExtension(originalName, contentType);
      const baseName = sanitizeUploadFileName(path.basename(originalName, path.extname(originalName)) || documentType);
      const userSegment = sanitizePathSegment(req.auth.sub || req.auth.firebaseUid || req.auth.d1UserId);
      const key = `loan-documents/${userSegment}/${Date.now()}-${documentType}-${baseName}${ext}`;
      const url = await putR2Object(r2, key, body, contentType);

      return res.json({
        ok: true,
        document: {
          name: originalName,
          size: body.length,
          type: contentType,
          path: key,
          key,
          url,
          storage: 'cloudflare-r2',
          uploadedAt: nowMs()
        }
      });
    } catch (error) {
      if (error?.code === 'UPLOAD_TOO_LARGE' || error?.message === 'UPLOAD_TOO_LARGE') {
        return res.status(413).json({ ok: false, error: 'UPLOAD_TOO_LARGE' });
      }
      console.error('Loan document upload failed:', error);
      return res.status(500).json({ ok: false, error: 'LOAN_DOCUMENT_UPLOAD_FAILED' });
    }
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

  app.get('/api/admin/notifications/:notificationId/recipients', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    }
    const recipients = await listNotificationRecipients(d1, req.params.notificationId, Math.min(Number(req.query.limit || 1000), 3000));
    res.json({ ok: true, recipients });
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

  // ── Task Reservation Endpoints ───────────────────────────────────────────
  app.post('/api/task-reservations', requireHttpAuth, rateLimit({ windowMs: 60000, maxRequests: 20 }), async (req, res) => {
    try {
      const { taskId, comments, reservationMs } = req.body;
      if (!taskId) return res.status(400).json({ ok: false, error: 'TASK_ID_REQUIRED' });
      const reservation = await reserveTaskComment(d1, {
        taskId,
        userId: req.auth.sub,
        userName: req.body.userName || '',
        userEmail: req.auth.email || '',
        comments: Array.isArray(comments) ? comments : ['good app'],
        reservationMs: Math.min(Number(reservationMs || TASK_RESERVATION_MS), 10 * 60 * 1000)
      });
      res.json({ ok: true, reservation });
    } catch (error) {
      if (error.message === 'TASK_ALREADY_SUBMITTED') return res.status(409).json({ ok: false, error: error.message });
      console.error('Task reservation failed:', error);
      res.status(500).json({ ok: false, error: 'RESERVATION_FAILED' });
    }
  });

  app.get('/api/task-reservations/:taskId', requireHttpAuth, async (req, res) => {
    const reservation = await getTaskReservation(d1, req.params.taskId, req.auth.sub);
    res.json({ ok: true, reservation });
  });

  app.post('/api/task-reservations/:reservationId/submit', requireHttpAuth, async (req, res) => {
    try {
      await markReservationSubmitted(d1, req.params.reservationId);
      res.json({ ok: true });
    } catch (error) {
      console.error('Reservation submit marking failed:', error);
      res.status(500).json({ ok: false, error: 'SUBMISSION_MARKING_FAILED' });
    }
  });

  // ── Screenshot Upload Endpoint ───────────────────────────────────────────
  app.post('/api/uploads/task-screenshot', requireHttpAuth, rateLimit({ windowMs: 60000, maxRequests: 10 }), async (req, res) => {
    try {
      const declaredSize = Number(req.headers['content-length'] || req.query.size || 0);
      if (declaredSize > TASK_SCREENSHOT_MAX_BYTES) {
        return res.status(413).json({ ok: false, error: 'UPLOAD_TOO_LARGE' });
      }

      const taskId = sanitizePathSegment(req.query.taskId || 'unknown');
      const originalName = sanitizeUploadFileName(req.query.fileName || 'screenshot.jpg');
      const appName = req.query.appName || 'Unknown App';
      const contentType = normalizeContentType(req.headers['content-type'] || 'image/jpeg');
      if (!contentType.startsWith('image/')) {
        return res.status(400).json({ ok: false, error: 'ONLY_IMAGES_ALLOWED' });
      }

      const body = await readRequestBody(req, TASK_SCREENSHOT_MAX_BYTES);
      if (!body.length) return res.status(400).json({ ok: false, error: 'EMPTY_UPLOAD' });

      const ext = getLoanDocumentExtension(originalName, contentType);
      const userSegment = sanitizePathSegment(req.auth.sub);
      const timestamp = Date.now();
      const fileName = `${timestamp}-${taskId}-${sanitizeUploadFileName(path.basename(originalName, path.extname(originalName)))}${ext}`;

      // Try Google Drive first (free 2TB storage)
      const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (driveFolderId && process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) {
        try {
          const driveResult = await uploadToGoogleDrive(body, fileName, contentType, driveFolderId, { appName });
          console.log(`Screenshot uploaded to Google Drive: ${driveResult.dateFolderName}/${driveResult.appFolderName}/${driveResult.name} (${body.length} bytes)`);
          return res.json({
            ok: true,
            screenshot: {
              name: originalName,
              size: body.length,
              type: contentType,
              key: `gdrive:${driveResult.fileId}`,
              url: driveResult.directUrl,
              viewUrl: driveResult.viewUrl,
              thumbnailUrl: driveResult.thumbnailUrl,
              drivePath: `${driveResult.dateFolderName}/${driveResult.appFolderName}`,
              storage: 'google_drive',
              uploadedAt: nowMs()
            }
          });
        } catch (driveError) {
          console.error('Google Drive upload failed, falling back to R2:', driveError.message);
        }
      }

      // Fallback to R2
      if (r2 && process.env.CLOUDFLARE_R2_BUCKET && process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL) {
        const key = `task-screenshots/${userSegment}/${fileName}`;
        const url = await putR2Object(r2, key, body, contentType);
        return res.json({
          ok: true,
          screenshot: { name: originalName, size: body.length, type: contentType, key, url, storage: 'r2', uploadedAt: nowMs() }
        });
      }

      return res.status(503).json({ ok: false, error: 'NO_STORAGE_CONFIGURED' });
    } catch (error) {
      if (error?.code === 'UPLOAD_TOO_LARGE') return res.status(413).json({ ok: false, error: 'UPLOAD_TOO_LARGE' });
      console.error('Task screenshot upload failed:', error);
      return res.status(500).json({ ok: false, error: 'SCREENSHOT_UPLOAD_FAILED' });
    }
  });

  // ── Task Submission Endpoints ────────────────────────────────────────────
  app.post('/api/task-submissions', requireHttpAuth, rateLimit({ windowMs: 60000, maxRequests: 10 }), async (req, res) => {
    try {
      const submissionId = await saveTaskSubmission(d1, { ...req.body, userId: req.auth.sub });
      if (req.body.reservationId) {
        await markReservationSubmitted(d1, req.body.reservationId).catch(e => console.warn('Reservation mark failed:', e));
      }
      res.json({ ok: true, submissionId });
    } catch (error) {
      console.error('Task submission save failed:', error);
      res.status(500).json({ ok: false, error: 'SUBMISSION_FAILED' });
    }
  });

  app.get('/api/admin/task-submissions', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    const submissions = await listTaskSubmissions(d1, {
      taskId: req.query.taskId || null,
      userId: req.query.userId || null,
      manualStatus: req.query.manualStatus || null,
      ocrStatus: req.query.ocrStatus || null,
      payoutStatus: req.query.payoutStatus || null,
      limit: Math.min(Number(req.query.limit || 200), 500)
    });
    res.json({ ok: true, submissions });
  });

  app.patch('/api/admin/task-submissions/:submissionId', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      await updateTaskSubmission(d1, req.params.submissionId, req.body);
      res.json({ ok: true });
    } catch (error) {
      console.error('Task submission update failed:', error);
      res.status(500).json({ ok: false, error: 'UPDATE_FAILED' });
    }
  });

  // ── OCR Endpoint ─────────────────────────────────────────────────────────
  app.post('/api/admin/ocr-process/:submissionId', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const submission = await d1.first('SELECT * FROM task_submissions WHERE id = ? LIMIT 1', [req.params.submissionId]);
      if (!submission) return res.status(404).json({ ok: false, error: 'SUBMISSION_NOT_FOUND' });

      let ocrResult = { text: '', confidence: 0, status: 'completed' };

      if (submission.screenshot_url) {
        try {
          // Download image from URL
          const imgResponse = await fetch(submission.screenshot_url);
          if (!imgResponse.ok) throw new Error(`Image download failed: ${imgResponse.status}`);
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

          // Run Tesseract OCR (free, no API key needed)
          const { data } = await Tesseract.recognize(imgBuffer, 'eng', {
            logger: () => {} // suppress progress logs
          });

          ocrResult.text = (data.text || '').trim();
          ocrResult.confidence = (data.confidence || 0) / 100; // normalize to 0-1
          ocrResult.status = ocrResult.text ? 'completed' : 'completed';

          console.log(`OCR completed for ${req.params.submissionId}: ${ocrResult.text.length} chars, confidence ${(ocrResult.confidence * 100).toFixed(1)}%`);
        } catch (ocrError) {
          console.error('Tesseract OCR error:', ocrError);
          ocrResult = { text: '', confidence: 0, status: 'failed' };
        }
      } else {
        ocrResult = { text: '[No screenshot URL available for OCR]', confidence: 0, status: 'failed' };
      }

      await updateTaskSubmission(d1, req.params.submissionId, {
        ocrStatus: ocrResult.status,
        ocrExtractedText: ocrResult.text.slice(0, 4000),
        ocrConfidence: ocrResult.confidence
      });

      res.json({ ok: true, ocr: ocrResult });
    } catch (error) {
      console.error('OCR processing failed:', error);
      res.status(500).json({ ok: false, error: 'OCR_FAILED' });
    }
  });

  // ── Scraper Endpoints ────────────────────────────────────────────────────
  app.post('/api/admin/scraper/check-review', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const { submissionId, taskLink, assignedComment, appName } = req.body;
      if (!submissionId) return res.status(400).json({ ok: false, error: 'SUBMISSION_ID_REQUIRED' });

      const isPlayStore = String(taskLink || '').includes('play.google.com');
      let scraperResult = {
        checked: true,
        isPlayStore,
        found: false,
        message: isPlayStore
          ? 'Play Store review check requires external Python scraper. Run your scraper script and update via PATCH endpoint.'
          : 'Non-Play-Store link — manual verification required.',
        checkedAt: nowMs()
      };

      const newStatus = isPlayStore ? 'awaiting_scraper' : 'not_applicable';
      await updateTaskSubmission(d1, submissionId, {
        scraperStatus: newStatus,
        scraperResultJson: scraperResult
      });

      res.json({ ok: true, result: scraperResult });
    } catch (error) {
      console.error('Scraper check failed:', error);
      res.status(500).json({ ok: false, error: 'SCRAPER_CHECK_FAILED' });
    }
  });

  app.post('/api/admin/scraper/confirm-live', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const { submissionId } = req.body;
      if (!submissionId) return res.status(400).json({ ok: false, error: 'SUBMISSION_ID_REQUIRED' });
      await updateTaskSubmission(d1, submissionId, {
        scraperStatus: 'live_confirmed',
        verifiedAt: nowMs()
      });
      res.json({ ok: true });
    } catch (error) {
      console.error('Scraper confirm failed:', error);
      res.status(500).json({ ok: false, error: 'CONFIRM_FAILED' });
    }
  });

  app.post('/api/admin/auto-payout/run', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const paidCount = await processAutoPayouts(d1);
      res.json({ ok: true, paidCount });
    } catch (error) {
      console.error('Manual auto-payout trigger failed:', error);
      res.status(500).json({ ok: false, error: 'AUTO_PAYOUT_FAILED' });
    }
  });

  app.get('/api/admin/auto-payout/pending', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    const pending = await d1.all(
      `SELECT *, (submitted_at + (payout_delay_days * 86400000)) as payout_due_at
       FROM task_submissions
       WHERE manual_status = 'approved' AND payout_status = 'pending'
       ORDER BY submitted_at ASC LIMIT 200`
    );
    res.json({ ok: true, pending });
  });

  // ── Audit Endpoints ──────────────────────────────────────────────────────
  app.get('/api/admin/audit/summary', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const summary = await getSyncAuditSummary(d1);
      const d1UserCount = await d1.first('SELECT COUNT(*) as count FROM users');
      const d1TransactionCount = await d1.first('SELECT COUNT(*) as count FROM transactions');
      const d1FundRequestCount = await d1.first('SELECT COUNT(*) as count FROM fund_requests');
      const d1SubmissionCount = await d1.first('SELECT COUNT(*) as count FROM task_submissions');
      const d1ReservationCount = await d1.first('SELECT COUNT(*) as count FROM task_comment_reservations WHERE status = \'reserved\' AND expires_at > ' + nowMs());
      res.json({
        ok: true,
        sync: summary,
        d1Counts: {
          users: d1UserCount?.count || 0,
          transactions: d1TransactionCount?.count || 0,
          fundRequests: d1FundRequestCount?.count || 0,
          taskSubmissions: d1SubmissionCount?.count || 0,
          activeReservations: d1ReservationCount?.count || 0
        }
      });
    } catch (error) {
      console.error('Audit summary failed:', error);
      res.status(500).json({ ok: false, error: 'AUDIT_SUMMARY_FAILED' });
    }
  });

  app.get('/api/admin/audit/failed-syncs', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    const logs = await listSyncAuditLogs(d1, {
      entityType: req.query.entityType || null,
      status: req.query.status || 'failed',
      limit: Math.min(Number(req.query.limit || 200), 500)
    });
    res.json({ ok: true, logs });
  });

  app.post('/api/admin/audit/resolve/:logId', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    await resolveSyncAuditLog(d1, Number(req.params.logId));
    res.json({ ok: true });
  });

  // Frontend sync failure reporting (any authenticated user can report their own sync failures)
  app.post('/api/admin/audit/log-sync-failure', requireHttpAuth, async (req, res) => {
    try {
      const { entityType, entityId, source, target, errorMessage } = req.body || {};
      if (!entityType) return res.status(400).json({ ok: false, error: 'MISSING_ENTITY_TYPE' });
      await logSyncAudit(d1, {
        entityType: String(entityType).slice(0, 50),
        entityId: String(entityId || req.auth.userId || 'unknown').slice(0, 100),
        source: String(source || 'firebase').slice(0, 20),
        target: String(target || 'd1').slice(0, 20),
        status: 'failed',
        errorMessage: String(errorMessage || '').slice(0, 2000)
      });
      res.json({ ok: true });
    } catch (error) {
      console.error('Sync failure log failed:', error);
      res.status(500).json({ ok: false, error: 'LOG_FAILED' });
    }
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
  const userRooms = new Map();
  const adminSockets = new Set();
  const recentlyHandledClientMessages = new Map();
  const recentlyHandledMessageSignatures = new Map();

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

  const addUserRoomPresence = (roomId, socketId) => {
    const sockets = userRooms.get(roomId) || new Set();
    sockets.add(socketId);
    userRooms.set(roomId, sockets);
  };

  const removeUserRoomPresence = (roomId, socketId) => {
    const sockets = userRooms.get(roomId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) userRooms.delete(roomId);
  };

  const wasClientMessageRecentlyHandled = (clientMessageId) => {
    if (!clientMessageId) return false;
    const now = nowMs();
    for (const [key, seenAt] of recentlyHandledClientMessages.entries()) {
      if (now - seenAt > 30000) recentlyHandledClientMessages.delete(key);
    }
    if (recentlyHandledClientMessages.has(clientMessageId)) return true;
    recentlyHandledClientMessages.set(clientMessageId, now);
    return false;
  };

  const wasMessageSignatureRecentlyHandled = ({ roomId, senderId, message }) => {
    const now = nowMs();
    for (const [key, seenAt] of recentlyHandledMessageSignatures.entries()) {
      if (now - seenAt > 2500) recentlyHandledMessageSignatures.delete(key);
    }
    const normalizedText = String(message || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const key = `${roomId}|${senderId}|${normalizedText}`;
    if (recentlyHandledMessageSignatures.has(key)) return true;
    recentlyHandledMessageSignatures.set(key, now);
    return false;
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
    socket.userJoinedRooms = new Set();
    if (socket.user.isAdmin) adminSockets.add(socket.id);

    socket.on('join_room', async ({ roomId, limit = 50, markRead = true }, ack) => {
      try {
        if (!roomId) throw new Error('ROOM_REQUIRED');
        socket.join(roomId);
        if (markRead) {
          let readAt = null;
          if (socket.user.isAdmin) {
            addAdminRoomPresence(roomId, socket.id);
            socket.adminJoinedRooms.add(roomId);
            readAt = await markRoomReadByAdmin(d1, roomId);
            cleanupExpiredReadChats(d1).catch((error) => console.error('Chat cleanup failed:', error));
            io.to(roomId).emit('chat_read', { roomId, readerRole: 'admin', readAt });
          } else {
            addUserRoomPresence(roomId, socket.id);
            socket.userJoinedRooms.add(roomId);
            readAt = await markRoomReadByUser(d1, roomId);
            io.to(roomId).emit('chat_read', { roomId, readerRole: 'user', readAt });
          }
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
        removeUserRoomPresence(roomId, socket.id);
        socket.adminJoinedRooms.delete(roomId);
        socket.userJoinedRooms.delete(roomId);
      }
      if (ack) ack({ ok: true });
    });

    socket.on('send_message', async ({ roomId, message, userMeta = {}, clientMessageId = null }, ack) => {
      try {
        if (!roomId || !String(message || '').trim()) throw new Error('ROOM_AND_MESSAGE_REQUIRED');
        const cleanClientMessageId = clientMessageId ? String(clientMessageId).slice(0, 120) : null;
        if (wasClientMessageRecentlyHandled(cleanClientMessageId)) {
          if (ack) ack({ ok: true, duplicate: true });
          return;
        }
        if (wasMessageSignatureRecentlyHandled({ roomId, senderId: socket.user.sub, message })) {
          if (ack) ack({ ok: true, duplicate: true });
          return;
        }

        const timestamp = nowMs();
        const readByAdminAt = (!socket.user.isAdmin && adminRooms.has(roomId)) ? timestamp : null;
        const readByUserAt = (socket.user.isAdmin && userRooms.has(roomId)) ? timestamp : null;
        const chatMessage = {
          roomId,
          senderId: socket.user.sub,
          message: String(message).slice(0, 4000),
          timestamp,
          readByAdminAt,
          readByUserAt,
          clientMessageId: cleanClientMessageId
        };

        const inserted = await saveChatMessage(d1, chatMessage);
        if (!inserted) {
          if (ack) ack({ ok: true, duplicate: true });
          return;
        }
        io.to(roomId).emit('new_message', chatMessage);
        if (!socket.user.isAdmin) {
          adminSockets.forEach((socketId) => {
            io.to(socketId).emit('new_message', chatMessage);
          });
        }
        upsertChatRoom(d1, {
            roomId,
            userId: userMeta.userId || roomId.replace(/^support_/, ''),
            userName: String(userMeta.userName || '').slice(0, 120),
            userEmail: normalizeEmail(userMeta.userEmail || ''),
            userMobile: String(userMeta.userMobile || '').slice(0, 30),
            lastMessage: chatMessage.message,
            lastSenderId: chatMessage.senderId,
            updatedAt: timestamp
        }).catch((error) => console.error('Async chat room persist failed:', error));

        if (ack) ack({ ok: true, message: chatMessage });
      } catch (error) {
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      adminSockets.delete(socket.id);
      socket.adminJoinedRooms.forEach((roomId) => removeAdminRoomPresence(roomId, socket.id));
      socket.userJoinedRooms.forEach((roomId) => removeUserRoomPresence(roomId, socket.id));
      socket.adminJoinedRooms.clear();
      socket.userJoinedRooms.clear();
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
  cleanupExpiredReservations(d1).catch((error) => console.error('Initial reservation cleanup failed:', error));
  const cleanupTimer = setInterval(() => {
    cleanupExpiredReadChats(d1).catch((error) => console.error('Scheduled chat cleanup failed:', error));
    cleanupExpiredNotifications(d1).catch((error) => console.error('Scheduled notification cleanup failed:', error));
    processAutoPayouts(d1).catch((error) => console.error('Scheduled auto-payout failed:', error));
  }, 60 * 60 * 1000);
  cleanupTimer.unref?.();

  // Schedule auto-payout at 8 PM IST daily
  const scheduleAutoPayoutAt8PM = () => {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const target = new Date(ist);
    target.setHours(20, 0, 0, 0);
    if (target <= ist) target.setDate(target.getDate() + 1);
    const delay = target.getTime() - ist.getTime();
    setTimeout(() => {
      processAutoPayouts(d1).catch(e => console.error('Scheduled auto-payout failed:', e));
      setInterval(() => {
        processAutoPayouts(d1).catch(e => console.error('Daily auto-payout failed:', e));
      }, 24 * 60 * 60 * 1000).unref?.();
    }, delay).unref?.();
  };
  scheduleAutoPayoutAt8PM();

  return {
    d1,
    r2,
    registerRoutes: (app) => registerRoutes(app, { d1, r2 }),
    registerSocketHandlers: (io) => registerSocketHandlers(io, { d1 }),
    saveTransaction: (transaction) => saveTransaction(d1, transaction),
    getTransactionHistory: (userId, options) => getTransactionHistory(d1, userId, options),
    saveFundRequest: (request) => saveFundRequest(d1, request),
    listFundRequests: (options) => listFundRequests(d1, options),
    saveLoanRequest: (request) => saveLoanRequest(d1, request),
    listLoanRequests: (options) => listLoanRequests(d1, options),
    listChatRooms: (options) => listChatRooms(d1, options),
    putInvoice: (userId, invoiceId, data) =>
      putR2Object(r2, `invoices/${userId}/${invoiceId}.json`, JSON.stringify(data, null, 2)),
    getInvoice: (userId, invoiceId) =>
      getR2Object(r2, `invoices/${userId}/${invoiceId}.json`),
    reserveTaskComment: (opts) => reserveTaskComment(d1, opts),
    getTaskReservation: (taskId, userId) => getTaskReservation(d1, taskId, userId),
    markReservationSubmitted: (reservationId) => markReservationSubmitted(d1, reservationId),
    saveTaskSubmission: (opts) => saveTaskSubmission(d1, opts),
    listTaskSubmissions: (opts) => listTaskSubmissions(d1, opts),
    updateTaskSubmission: (submissionId, updates) => updateTaskSubmission(d1, submissionId, updates),
    logSyncAudit: (opts) => logSyncAudit(d1, opts),
    listSyncAuditLogs: (opts) => listSyncAuditLogs(d1, opts),
    resolveSyncAuditLog: (logId) => resolveSyncAuditLog(d1, logId),
    getSyncAuditSummary: () => getSyncAuditSummary(d1),
    processAutoPayouts: () => processAutoPayouts(d1)
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
  saveLoanRequest,
  listLoanRequests,
  updateLoanRequestStatus,
  listChatRooms,
  reserveTaskComment,
  getTaskReservation,
  markReservationSubmitted,
  saveTaskSubmission,
  listTaskSubmissions,
  updateTaskSubmission,
  logSyncAudit,
  listSyncAuditLogs,
  resolveSyncAuditLog,
  getSyncAuditSummary,
  processAutoPayouts
};
