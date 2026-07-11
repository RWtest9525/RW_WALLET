const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const { google } = require('googleapis');
const { Readable } = require('stream');
const gplay = require('google-play-scraper');

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
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
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
  const role = (user.id === ADMIN_UID || firebaseUid === ADMIN_UID || email === 'reviewsworld01@gmail.com') ? 'owner' : (user.role || 'user');
  const isAdmin = role === 'owner' || role === 'admin';
  return jwt.sign(
    {
      sub: effectiveUserId,
      d1UserId: user.id,
      email,
      firebaseUid,
      isAdmin,
      role,
      status: user.status || 'active'
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
  await ensureColumn(d1, 'users', 'role', 'TEXT');
  await ensureColumn(d1, 'users', 'status', 'TEXT');
  await ensureColumn(d1, 'users', 'parent_admin', 'TEXT');
  await ensureColumn(d1, 'users', 'referral_code', 'TEXT');

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

  await ensureColumn(d1, 'task_submissions', 'day3_status', 'TEXT');
  await ensureColumn(d1, 'task_submissions', 'day7_status', 'TEXT');
  await ensureColumn(d1, 'task_submissions', 'day3_paid', 'INTEGER');
  await ensureColumn(d1, 'task_submissions', 'day7_paid', 'INTEGER');

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

  await d1.query(`
    CREATE TABLE IF NOT EXISTS live_lists (
      id TEXT PRIMARY KEY,
      app_name TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await d1.query(`
    CREATE TABLE IF NOT EXISTS compiled_lists (
      task_id TEXT NOT NULL,
      date TEXT NOT NULL,
      compiled_at INTEGER NOT NULL,
      drive_folder_id TEXT,
      PRIMARY KEY (task_id, date)
    )
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

async function createUser(d1, { id, firebaseUid = null, email, passwordHash, migratedAt = null, profile = {}, role = 'user', parentAdmin = null, referralCode = null, status = 'active' }) {
  const createdAt = nowMs();
  const cleanProfile = normalizeProfile(profile);
  await d1.query(
    `INSERT INTO users (id, firebase_uid, email, password_hash, name, mobile, created_at, migrated_at, role, parent_admin, referral_code, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, firebaseUid, normalizeEmail(email), passwordHash, cleanProfile.name, cleanProfile.mobile, createdAt, migratedAt, role, parentAdmin, referralCode, status]
  );

  return {
    id,
    firebase_uid: firebaseUid,
    email: normalizeEmail(email),
    password_hash: passwordHash,
    name: cleanProfile.name,
    mobile: cleanProfile.mobile,
    created_at: createdAt,
    migrated_at: migratedAt,
    role,
    parent_admin: parentAdmin,
    referral_code: referralCode,
    status
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

  let role = (firebaseUid === ADMIN_UID || email === 'reviewsworld01@gmail.com') ? 'owner' : 'user';
  let parentAdmin = null;
  let referralCode = null;
  let status = 'active';

  const appId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
  try {
    const firestoreUserSnap = await admin.firestore().doc(`artifacts/${appId}/public/data/users/${firebaseUid}`).get();
    if (firestoreUserSnap.exists) {
      const fData = firestoreUserSnap.data();
      role = fData.role || ((firebaseUid === ADMIN_UID || email === 'reviewsworld01@gmail.com') ? 'owner' : 'user');
      parentAdmin = fData.parent_admin || fData.parentAdmin || null;
      referralCode = fData.referralCode || fData.referral_code || null;
      status = fData.status || 'active';
    }
  } catch (err) {
    console.error('Failed to fetch user from Firestore during session creation:', err);
  }

  const existing = await d1.first(
    'SELECT * FROM users WHERE firebase_uid = ? OR email = ? LIMIT 1',
    [firebaseUid, email]
  );

  if (existing) {
    if (!existing.firebase_uid) {
      await d1.query('UPDATE users SET firebase_uid = ? WHERE id = ?', [firebaseUid, existing.id]);
      existing.firebase_uid = firebaseUid;
    }
    await d1.query(
      `UPDATE users
       SET name = COALESCE(NULLIF(?, ''), name),
           mobile = COALESCE(NULLIF(?, ''), mobile),
           role = ?,
           parent_admin = ?,
           referral_code = ?,
           status = ?
       WHERE id = ?`,
      [cleanProfile.name, cleanProfile.mobile, role, parentAdmin, referralCode, status, existing.id]
    );
    existing.name = cleanProfile.name || existing.name;
    existing.mobile = cleanProfile.mobile || existing.mobile;
    existing.role = role;
    existing.parent_admin = parentAdmin;
    existing.referral_code = referralCode;
    existing.status = status;
    return existing;
  }

  return createUser(d1, {
    id: firebaseUid,
    firebaseUid,
    email,
    passwordHash: '',
    migratedAt: nowMs(),
    profile: cleanProfile,
    role,
    parentAdmin,
    referralCode,
    status
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

async function listFundRequests(d1, { status = 'pending', type = null, userId = null, parentAdmin = null, limit = 200 } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('fr.status = ?');
    params.push(status);
  }
  if (type) {
    conditions.push('fr.type = ?');
    params.push(type);
  }
  if (userId) {
    conditions.push('fr.user_id = ?');
    params.push(userId);
  }
  if (parentAdmin) {
    conditions.push('u.parent_admin = ?');
    params.push(parentAdmin);
  }
  params.push(limit);

  const rows = await d1.all(
    `SELECT fr.request_id, fr.user_id, fr.type, fr.amount, fr.status, fr.requested_at, fr.processed_at, fr.details_json
     FROM fund_requests fr
     ${parentAdmin ? 'INNER JOIN users u ON fr.user_id = u.id' : ''}
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY fr.requested_at DESC
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

  const chunkSize = 25;
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
  // Use dedicated Drive SA key, or fallback to Firebase SA key (same Google Cloud project)
  const saJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) return null;
  try {
    const credentials = typeof saJson === 'string' ? JSON.parse(saJson) : saJson;
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    _driveClient = google.drive({ version: 'v3', auth });
    console.log(`Google Drive client initialized with SA: ${credentials.client_email}`);
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

async function extractAndStoreReviewerAvatar({ imageBuffer, reviewerName, nameLine = null, r2, userId = 'user', appName = 'Avatars' }) {
  return { avatarUrl: '', avatarHash: '', avatarCrop: null };
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

async function checkIsBulker(d1, userId) {
  try {
    const db = admin.firestore();
    const userDoc = await db.doc(`artifacts/digital-wallet-prod/public/data/users/${userId}`).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return !!(data.bulkTaskMode || data.taskBulkMode || data.isBulkTaskUser);
    }
  } catch (err) {
    console.error('Error checking isBulker in Firestore:', err);
  }
  return false;
}

async function cleanupExpiredReservations(d1) {
  await d1.query(
    `UPDATE task_comment_reservations SET status = 'expired' WHERE status = 'reserved' AND expires_at <= ?`,
    [nowMs()]
  );
}

async function reserveTaskComment(d1, { taskId, userId, userName, userEmail, comments, reservationMs = TASK_RESERVATION_MS }) {
  await cleanupExpiredReservations(d1);

  const isBulker = await checkIsBulker(d1, userId);

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

  // Check already submitted (only for non-bulkers)
  if (!isBulker) {
    const submitted = await d1.first(
      `SELECT id FROM task_submissions WHERE task_id = ? AND user_id = ? LIMIT 1`,
      [taskId, userId]
    );
    if (submitted) throw new Error('TASK_ALREADY_SUBMITTED');
  }

  // Find used comments by other active reservations
  let activeReservations;
  if (isBulker) {
    // Bulkers shouldn't reuse comments they themselves or others have already reserved or submitted
    activeReservations = await d1.all(
      `SELECT comment FROM task_comment_reservations WHERE task_id = ? AND status IN ('reserved', 'submitted') AND (expires_at > ? OR status = 'submitted')`,
      [taskId, nowMs()]
    );
  } else {
    activeReservations = await d1.all(
      `SELECT comment FROM task_comment_reservations WHERE task_id = ? AND status IN ('reserved', 'submitted') AND (expires_at > ? OR status = 'submitted') AND user_id != ?`,
      [taskId, nowMs(), userId]
    );
  }
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

async function listTaskSubmissions(d1, { taskId = null, userId = null, manualStatus = null, ocrStatus = null, payoutStatus = null, limit = 200, parentAdmin = null } = {}) {
  const conditions = [];
  const params = [];
  if (taskId) { conditions.push('ts.task_id = ?'); params.push(taskId); }
  if (userId) { conditions.push('ts.user_id = ?'); params.push(userId); }
  if (manualStatus) { conditions.push('ts.manual_status = ?'); params.push(manualStatus); }
  if (ocrStatus) { conditions.push('ts.ocr_status = ?'); params.push(ocrStatus); }
  if (payoutStatus) { conditions.push('ts.payout_status = ?'); params.push(payoutStatus); }
  if (parentAdmin) { conditions.push('u.parent_admin = ?'); params.push(parentAdmin); }
  params.push(limit);
  return d1.all(
    `SELECT ts.*, u.mobile as user_mobile 
     FROM task_submissions ts
     LEFT JOIN users u ON ts.user_id = u.id OR ts.user_id = u.firebase_uid
     ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} 
     ORDER BY ts.submitted_at DESC LIMIT ?`,
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
  if (updates.detailsJson !== undefined) { fields.push('details_json = ?'); params.push(JSON.stringify(updates.detailsJson)); }
  if (!fields.length) return;
  params.push(submissionId);
  await d1.query(`UPDATE task_submissions SET ${fields.join(', ')} WHERE id = ?`, params);
}

async function processOcrAndGmailProfile(d1, r2, submissionId) {
  try {
    const submission = await d1.first('SELECT * FROM task_submissions WHERE id = ? LIMIT 1', [submissionId]);
    if (!submission || !submission.screenshot_url) return;

    console.log(`[OCR] Auto-processing submission ${submissionId}...`);

    // Download image from URL
    const imgResponse = await fetch(submission.screenshot_url);
    if (!imgResponse.ok) throw new Error(`Image download failed: ${imgResponse.status}`);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

    // Run Tesseract OCR
    const { data } = await Tesseract.recognize(imgBuffer, 'eng');
    const text = (data.text || '').trim();
    const confidence = (data.confidence || 0) / 100;

    let gmailName = '';
    let gmailLogoUrl = '';
    let nameLine = null;

    if (data.lines && data.lines.length > 0) {
      // Look for assigned comment
      const assignedComment = submission.assigned_comment || '';
      const cleanedComment = assignedComment.toLowerCase().replace(/[^a-z0-9]/g, '');
      let foundIndex = -1;

      for (let j = 0; j < data.lines.length; j++) {
        const cleanedLine = data.lines[j].text.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanedLine && (cleanedLine.includes(cleanedComment) || cleanedComment.includes(cleanedLine) || (cleanedComment.length > 5 && cleanedLine.length > 5 && cleanedLine.indexOf(cleanedComment.slice(0, 10)) !== -1))) {
          foundIndex = j;
          break;
        }
      }

      if (foundIndex !== -1) {
        // Look for reviewer name 1-3 lines above comment line
        for (let k = foundIndex - 1; k >= Math.max(0, foundIndex - 3); k--) {
          const txt = data.lines[k].text.trim();
          const isRatingOrDate = /^[0-9★☆\s]+$/.test(txt) || txt.toLowerCase().includes('ago') || txt.toLowerCase().includes('edited') || /\d/.test(txt) && (txt.includes('/') || txt.includes('-'));
          if (txt && !isRatingOrDate && txt.length > 2 && txt.length < 50) {
            nameLine = data.lines[k];
            break;
          }
        }
        if (!nameLine && foundIndex >= 2) nameLine = data.lines[foundIndex - 2];
        if (!nameLine && foundIndex >= 1) nameLine = data.lines[foundIndex - 1];
      }

      // Fallback: search first 10 lines
      if (!nameLine) {
        for (let j = 0; j < Math.min(data.lines.length, 10); j++) {
          const txt = data.lines[j].text.trim();
          const isRatingOrDate = /^[0-9★☆\s]+$/.test(txt) || txt.toLowerCase().includes('ago') || txt.toLowerCase().includes('edited') || txt.length < 3 || txt.length > 40;
          if (txt && !isRatingOrDate) {
            nameLine = data.lines[j];
            break;
          }
        }
      }
    }

    if (nameLine) {
      gmailName = nameLine.text.trim().replace(/[\r\n]+/g, ' ');
      gmailLogoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(gmailName)}&background=random`;
    }

    if (!gmailName) {
      gmailName = 'Unknown User';
    }

    const details = {};
    try {
      if (submission.details_json) {
        Object.assign(details, JSON.parse(submission.details_json));
      }
    } catch {}
    try {
      const avatarResult = await extractAndStoreReviewerAvatar({
        imageBuffer: imgBuffer,
        reviewerName: gmailName,
        nameLine,
        r2,
        userId: submission.user_id,
        appName: submission.app_name || 'Avatars'
      });
      if (avatarResult.avatarUrl) gmailLogoUrl = avatarResult.avatarUrl;
      if (avatarResult.avatarHash) details.avatarHash = avatarResult.avatarHash;
      if (avatarResult.avatarCrop) details.avatarCrop = avatarResult.avatarCrop;
    } catch (avatarErr) {
      console.warn('[OCR] Reviewer avatar capture skipped:', avatarErr.message || avatarErr);
    }
    details.gmailLogoUrl = gmailLogoUrl;

    await updateTaskSubmission(d1, submissionId, {
      ocrStatus: 'completed',
      ocrExtractedText: text.slice(0, 4000),
      ocrExtractedName: gmailName.slice(0, 200),
      ocrConfidence: confidence,
      detailsJson: details
    });

    console.log(`[OCR] Auto-process complete for ${submissionId}: name="${gmailName}", logo="${gmailLogoUrl}"`);
  } catch (err) {
    console.error(`[OCR] Auto-processing failed for ${submissionId}:`, err);
    await updateTaskSubmission(d1, submissionId, { ocrStatus: 'failed' }).catch(() => {});
  }
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
       AND NOT (task_link LIKE '%play.google.com%' OR task_link LIKE '%details?id=%')
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

async function processPeriodicLiveChecksAndPayouts(d1) {
  const now = nowMs();
  const db = admin.firestore();

  console.log('[Scheduler] Starting 3rd and 7th day live check and payout processor...');

  // --- DAY 3 PROCESSING ---
  const day3Eligible = await d1.all(
    `SELECT * FROM task_submissions
     WHERE manual_status = 'approved'
       AND scraper_status = 'live_confirmed'
       AND day3_status IS NULL
       AND (task_link LIKE '%play.google.com%' OR task_link LIKE '%details?id=%')
       AND submitted_at <= (? - (3 * 86400000))
     ORDER BY submitted_at ASC LIMIT 100`,
    [now]
  );

  const day3ReportRows = [['Submission ID', 'User Name', 'App Name', 'Reviewer Name', 'Comment', 'Submitted At', '3rd Day Status', 'Payout Amount', 'Paid Status']];

  for (const sub of day3Eligible) {
    try {
      const packageId = extractPackageId(sub.task_link);
      const reviewerName = String(sub.ocr_extracted_name || '').trim().toLowerCase();
      let isStillLive = false;

      if (packageId && reviewerName && reviewerName !== 'unknown user') {
        const playReviews = await fetchPlayStoreReviewsForDate(packageId, sub.submitted_at);
        isStillLive = playReviews.some(r => {
          const rName = String(r.userName || '').trim().toLowerCase();
          return rName.includes(reviewerName) || reviewerName.includes(rName);
        });
      }

      const reward = Number(sub.reward || 0);
      let paidStatus = 'not_applicable';
      let payAmount = 0;

      if (isStillLive) {
        await updateTaskSubmission(d1, sub.id, {
          day3Status: 'live',
          day3Paid: 0
        });
        paidStatus = 'live_not_paid';
      } else {
        await updateTaskSubmission(d1, sub.id, {
          day3Status: 'dropped',
          day3Paid: 0
        });
        paidStatus = 'dropped_not_paid';
      }

      day3ReportRows.push([
        sub.id,
        sub.user_name || '',
        sub.app_name || '',
        sub.ocr_extracted_name || '',
        sub.assigned_comment || '',
        new Date(sub.submitted_at).toISOString(),
        isStillLive ? 'Live' : 'Dropped',
        String(payAmount),
        paidStatus
      ]);
    } catch (err) {
      console.error(`Day 3 verification/payout failed for ${sub.id}:`, err);
    }
  }

  // --- DAY 7 PROCESSING ---
  const day7Eligible = await d1.all(
    `SELECT * FROM task_submissions
     WHERE manual_status = 'approved'
       AND scraper_status = 'live_confirmed'
       AND day3_status = 'live'
       AND day7_status IS NULL
       AND (task_link LIKE '%play.google.com%' OR task_link LIKE '%details?id=%')
       AND submitted_at <= (? - (7 * 86400000))
     ORDER BY submitted_at ASC LIMIT 100`,
    [now]
  );

  const day7ReportRows = [['Submission ID', 'User Name', 'App Name', 'Reviewer Name', 'Comment', 'Submitted At', '7th Day Status', 'Payout Amount', 'Paid Status']];

  for (const sub of day7Eligible) {
    try {
      const packageId = extractPackageId(sub.task_link);
      const reviewerName = String(sub.ocr_extracted_name || '').trim().toLowerCase();
      let isStillLive = false;

      if (packageId && reviewerName && reviewerName !== 'unknown user') {
        const playReviews = await fetchPlayStoreReviewsForDate(packageId, sub.submitted_at);
        isStillLive = playReviews.some(r => {
          const rName = String(r.userName || '').trim().toLowerCase();
          return rName.includes(reviewerName) || reviewerName.includes(rName);
        });
      }

      const reward = Number(sub.reward || 0);
      let paidStatus = 'skipped';
      let payAmount = 0;

      if (isStillLive) {
        payAmount = reward;
        if (reward > 0) {
          const transactionId = `task_payout_day7_${sub.id}_${now}`;
          await saveTransaction(d1, {
            userId: sub.user_id,
            transactionId,
            type: 'credit',
            amount: reward,
            status: 'completed',
            timestamp: now,
            details: {
              comment: `Day 7 Reward: ${sub.app_name || 'Task'}`,
              source: 'task_auto_payout_day7',
              taskId: sub.task_id,
              submissionId: sub.id
            }
          });

          // Sync to Firestore
          const userRef = db.doc(`artifacts/digital-wallet-prod/public/data/users/${sub.user_id}`);
          await userRef.update({
            balance: admin.firestore.FieldValue.increment(reward)
          }).catch(e => console.error(`[Day7-Payout] Firestore user balance update failed for ${sub.user_id}:`, e));

          // Deduct from owner's wallet
          const ownerRefDay7 = db.doc(`artifacts/digital-wallet-prod/public/data/users/${ADMIN_UID}`);
          await ownerRefDay7.update({
            balance: admin.firestore.FieldValue.increment(-reward)
          }).catch(e => console.error(`[Day7-Payout] Owner fund deduction failed:`, e));

          const txnId = `txn_${now}_${Math.random().toString(36).substr(2, 9)}`;
          const txnRef = db.doc(`artifacts/digital-wallet-prod/public/data/users/${sub.user_id}/transactions/${txnId}`);
          await txnRef.set({
            type: 'credit',
            amount: reward,
            comment: `Day 7 Live Review Reward: ${sub.app_name || 'Task'}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            transactionId: txnId,
            status: 'completed',
            isAdminTransaction: true,
            senderName: 'Reviews World',
            recipientName: sub.user_name || 'User'
          }).catch(e => console.error(`[Day7-Payout] Firestore transaction write failed:`, e));

          paidStatus = 'paid';
        }

        await updateTaskSubmission(d1, sub.id, {
          day7Status: 'live',
          day7Paid: 1,
          payoutStatus: 'paid',
          paidAt: now
        });
      } else {
        await updateTaskSubmission(d1, sub.id, {
          day7Status: 'dropped',
          day7Paid: 0
        });
        paidStatus = 'not_paid_dropped';
      }

      day7ReportRows.push([
        sub.id,
        sub.user_name || '',
        sub.app_name || '',
        sub.ocr_extracted_name || '',
        sub.assigned_comment || '',
        new Date(sub.submitted_at).toISOString(),
        isStillLive ? 'Live' : 'Dropped',
        String(payAmount),
        paidStatus
      ]);
    } catch (err) {
      console.error(`Day 7 verification/payout failed for ${sub.id}:`, err);
    }
  }

  // --- REPORT GENERATION & DRIVE UPLOADING ---
  const drive = getGoogleDriveClient();
  if (drive) {
    const todayDateStr = new Date(now + 330 * 60 * 1000).toISOString().slice(0, 10);
    const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';

    try {
      const rwWalletRootId = await findOrCreateDriveFolder(drive, driveFolderId, 'rw wallet');
      const reportsRootId = await findOrCreateDriveFolder(drive, rwWalletRootId, 'Reports');

      if (day3Eligible.length > 0) {
        const day3FolderId = await findOrCreateDriveFolder(drive, reportsRootId, '3rd_Day_Reports');
        const csvContent = day3ReportRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        await drive.files.create({
          requestBody: {
            name: `Day_3_Payout_Report_${todayDateStr}`,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [day3FolderId]
          },
          media: { mimeType: 'text/csv', body: Readable.from([csvContent]) }
        });
        console.log(`[Scheduler] Uploaded Day 3 payout report to Drive.`);
      }

      if (day7Eligible.length > 0) {
        const day7FolderId = await findOrCreateDriveFolder(drive, reportsRootId, '7th_Day_Reports');
        const csvContent = day7ReportRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        await drive.files.create({
          requestBody: {
            name: `Day_7_Payout_Report_${todayDateStr}`,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [day7FolderId]
          },
          media: { mimeType: 'text/csv', body: Readable.from([csvContent]) }
        });
        console.log(`[Scheduler] Uploaded Day 7 payout report to Drive.`);
      }
    } catch (driveErr) {
      console.error('[Scheduler] Drive upload for payout reports failed:', driveErr.message);
    }
  }

  console.log('[Scheduler] Finished 3rd and 7th day live check and payout processor.');
}

async function processDailyLists(d1) {
  try {
    const drive = getGoogleDriveClient();
    if (!drive) {
      console.warn('[Scheduler] Google Drive is not configured, skipping daily list sync.');
      return;
    }

    const db = admin.firestore();
    const tasksSnap = await db.collection('artifacts/digital-wallet-prod/public/data/tasks').get().catch(() => null);
    if (!tasksSnap || tasksSnap.empty) return;

    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentHours = istDate.getHours();
    const currentMinutes = istDate.getMinutes();
    const todayDateStr = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;

    console.log(`[Scheduler] Checking daily lists at IST ${currentHours}:${currentMinutes} for ${todayDateStr}...`);

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();
      const listTime = task.listTime || task.list_time;
      if (!listTime || task.status === 'draft') continue;

      const [listH, listM] = listTime.split(':').map(Number);
      if (currentHours < listH || (currentHours === listH && currentMinutes < listM)) {
        continue;
      }

      // Check if today is the correct compile day (listDate + listDays)
      const listDays = Number(task.listDays ?? task.list_days ?? 7);
      const listDateStr = task.listDate || task.list_date || (task.targetDate ? task.targetDate.split('T')[0] : null);
      if (!listDateStr) continue;

      const [lyear, lmonth, lday] = listDateStr.split('-').map(Number);
      const compileDate = new Date(lyear, lmonth - 1, lday);
      compileDate.setDate(compileDate.getDate() + listDays);

      const targetCompileDateStr = `${compileDate.getFullYear()}-${String(compileDate.getMonth() + 1).padStart(2, '0')}-${String(compileDate.getDate()).padStart(2, '0')}`;
      if (todayDateStr !== targetCompileDateStr) {
        continue;
      }

      const alreadyCompiled = await d1.first(
        'SELECT * FROM compiled_lists WHERE task_id = ? AND date = ? LIMIT 1',
        [taskDoc.id, todayDateStr]
      );
      if (alreadyCompiled) {
        continue;
      }

      console.log(`[Scheduler] Compiling list for task "${task.title}" (${taskDoc.id})...`);

      const submissions = await d1.all(
        'SELECT * FROM task_submissions WHERE task_id = ?',
        [taskDoc.id]
      );

      if (!submissions.length) {
        console.log(`[Scheduler] No submissions for task ${taskDoc.id}, marking compiled.`);
        await d1.query(
          'INSERT INTO compiled_lists (task_id, date, compiled_at, drive_folder_id) VALUES (?, ?, ?, ?)',
          [taskDoc.id, todayDateStr, Date.now(), 'empty']
        );
        continue;
      }

      const appNameLower = String(task.appName || task.title || '').trim().toLowerCase();
      const liveList = await d1.first(
        'SELECT * FROM live_lists WHERE LOWER(app_name) = ? ORDER BY date DESC LIMIT 1',
        [appNameLower]
      );

      for (const sub of submissions) {
        if (sub.scraper_status !== 'live_confirmed') {
          const userFullName = String(sub.user_name || '').trim().toLowerCase();
          const ocrReviewerName = String(sub.ocr_extracted_name || '').trim().toLowerCase();
          const isExactNameMatch = userFullName && ocrReviewerName && (userFullName === ocrReviewerName) && (ocrReviewerName !== 'unknown user');

          let isLive = false;
          if (!isExactNameMatch) {
            if (liveList && sub.ocr_extracted_name && sub.ocr_extracted_name.toLowerCase() !== 'unknown user') {
              const lines = liveList.content.split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(Boolean);
              const nameClean = sub.ocr_extracted_name.trim().toLowerCase();
              isLive = lines.some(line => {
                const lineNameOnly = line.replace(/[a-f0-9]{32,64}/g, '').trim();
                return line.includes(nameClean) || nameClean.includes(lineNameOnly);
              });
            }

            const isPlayStore = String(sub.task_link || '').includes('play.google.com');
            if (!isLive && isPlayStore) {
              const packageId = extractPackageId(sub.task_link);
              if (packageId && sub.ocr_extracted_name && sub.ocr_extracted_name.toLowerCase() !== 'unknown user') {
                try {
                  const playReviews = await fetchPlayStoreReviewsForDate(packageId, sub.submitted_at);
                  const nameClean = sub.ocr_extracted_name.trim().toLowerCase();
                  const foundReview = playReviews.find(r => {
                    const rName = String(r.userName || '').trim().toLowerCase();
                    return rName.includes(nameClean) || nameClean.includes(rName);
                  });
                  if (foundReview) {
                    isLive = true;
                  }
                } catch (scrapeErr) {
                  console.error(`[Scheduler-Scraper] Play Store check failed for sub ${sub.id}:`, scrapeErr.message);
                }
              }
            }
          }

          if (isExactNameMatch) {
            await d1.query(
              "UPDATE task_submissions SET scraper_status = 'name_matched_manual' WHERE id = ?",
              [sub.id]
            );
            const firestoreSubRef = db.doc(`artifacts/digital-wallet-prod/public/data/task_submissions/${sub.id}`);
            await firestoreSubRef.update({
              scraperStatus: 'name_matched_manual'
            }).catch(e => console.error(`[Scheduler] Firestore name_matched_manual sync failed for ${sub.id}:`, e));
            sub.scraper_status = 'name_matched_manual';
          } else if (isLive) {
            await d1.query(
              "UPDATE task_submissions SET scraper_status = 'live_confirmed', manual_status = 'approved', verified_at = ? WHERE id = ?",
              [Date.now(), sub.id]
            );
            const firestoreSubRef = db.doc(`artifacts/digital-wallet-prod/public/data/task_submissions/${sub.id}`);
            await firestoreSubRef.update({
              scraperStatus: 'live_confirmed',
              manualStatus: 'approved',
              status: 'approved',
              verifiedAt: admin.firestore.FieldValue.serverTimestamp()
            }).catch(e => console.error(`[Scheduler] Firestore sync failed for ${sub.id}:`, e));
            
            sub.scraper_status = 'live_confirmed';
            sub.manual_status = 'approved';
          } else {
            await d1.query(
              "UPDATE task_submissions SET scraper_status = 'not_live' WHERE id = ?",
              [sub.id]
            );
            const firestoreSubRef = db.doc(`artifacts/digital-wallet-prod/public/data/task_submissions/${sub.id}`);
            await firestoreSubRef.update({
              scraperStatus: 'not_live'
            }).catch(e => console.error(`[Scheduler] Firestore sync failed for ${sub.id}:`, e));

            sub.scraper_status = 'not_live';
          }
        }
      }

      const csvRows = [
        ['Submission ID', 'User Name', 'User Email', 'Submitted At', 'Assigned Comment', 'Gmail Name', 'Gmail Logo URL', 'Live Status', 'Payout Status']
      ];
      for (const sub of submissions) {
        let details = {};
        try { details = sub.details_json ? JSON.parse(sub.details_json) : {}; } catch {}
        const gmailLogoUrl = details.gmailLogoUrl || '';
        const submittedDateStr = new Date(sub.submitted_at).toISOString();
        const liveStatus = sub.scraper_status === 'live_confirmed' ? 'Live' : 'Not Live';
        csvRows.push([
          sub.id,
          sub.user_name || '',
          sub.user_email || '',
          submittedDateStr,
          sub.assigned_comment || '',
          sub.ocr_extracted_name || '',
          gmailLogoUrl,
          liveStatus,
          sub.payout_status || 'pending'
        ]);
      }
      const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

      try {
        const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
        const rwWalletRootId = await findOrCreateDriveFolder(drive, driveFolderId, 'rw wallet');
        const appFolderId = await findOrCreateDriveFolder(drive, rwWalletRootId, task.appName || task.title || 'App Task');
        const dateFolderId = await findOrCreateDriveFolder(drive, appFolderId, todayDateStr);

        await drive.files.create({
          requestBody: {
            name: `Submissions_List_${todayDateStr}`,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [dateFolderId]
          },
          media: {
            mimeType: 'text/csv',
            body: Readable.from([csvContent])
          },
          fields: 'id, webViewLink'
        });

        await d1.query(
          'INSERT INTO compiled_lists (task_id, date, compiled_at, drive_folder_id) VALUES (?, ?, ?, ?)',
          [taskDoc.id, todayDateStr, Date.now(), dateFolderId]
        );
      } catch (driveErr) {
        console.error(`[Scheduler] Google Drive sync failed for task ${taskDoc.id}:`, driveErr);
      }
    }
  } catch (err) {
    console.error('[Scheduler] daily list processor failed:', err);
  }
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
  // ── Partner Investment Endpoints ─────────────────────────────────────────
  app.post('/api/partner-investments', requireHttpAuth, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const { amount, months, monthlyInterest, totalInterest, startDate, endDate } = req.body;

      if (!amount || amount < 25) {
        return res.status(400).json({ ok: false, error: 'INVALID_AMOUNT', message: 'Minimum partner investment is ₹25.' });
      }
      if (!months || months <= 0 || months > 60) {
        return res.status(400).json({ ok: false, error: 'INVALID_MONTHS', message: 'Invalid investment duration.' });
      }

      const db = admin.firestore();
      const userRef = db.doc(`artifacts/digital-wallet-prod/public/data/users/${userId}`);
      const investmentRef = db.collection(`artifacts/digital-wallet-prod/public/data/partner_investments`).doc();
      const invoiceId = `INV-${investmentRef.id.slice(0, 8).toUpperCase()}`;

      await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new Error('User account not found.');
        const userData = userDoc.data();
        const balance = Number(userData.balance || 0);

        const getLoanReservedAmount = (user) => {
          if (Number(user.activeLoanVersion || 0) < 2) return 0;
          const reserveStartValue = user.loanReserveStartsAt || user.activeLoanDueDate || user.loanDueDate;
          const reserveStartsAt = reserveStartValue && reserveStartValue.toDate ? reserveStartValue.toDate() : (reserveStartValue ? new Date(reserveStartValue) : null);
          const repaymentBasis = String(user.activeLoanRepaymentBasis || user.loanRepaymentBasis || '').toLowerCase();
          if (reserveStartsAt && reserveStartsAt > new Date()) return 0;
          if (!reserveStartsAt && repaymentBasis.includes('withdrawal')) return 0;
          const explicit = Number(user.loanLockedAmount ?? user.loan_locked_amount ?? 0);
          const rawReserve = Number.isFinite(explicit) && explicit > 0 ? explicit : 0;
          return Math.max(0, Math.min(Number(user.balance || 0), rawReserve));
        };

        const spendable = Math.max(0, balance - getLoanReservedAmount(userData));
        if (spendable < amount) throw new Error('Insufficient wallet balance.');

        tx.update(userRef, { balance: balance - amount });

        const start = new Date(startDate);
        const end = new Date(endDate);
        const nextPayout = new Date(start);
        nextPayout.setDate(nextPayout.getDate() + 30);

        tx.set(investmentRef, {
          userId,
          userName: userData.name || 'User',
          userEmail: userData.email || req.auth.email || '',
          userMobile: userData.mobile || '',
          amount,
          months,
          interestRate: 0.01,
          monthlyInterest,
          totalInterest,
          paidInterest: 0,
          monthsPaid: 0,
          startDate: admin.firestore.Timestamp.fromDate(start),
          endDate: admin.firestore.Timestamp.fromDate(end),
          nextPayoutAt: admin.firestore.Timestamp.fromDate(nextPayout),
          status: 'active',
          invoiceId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const txRef = userRef.collection('transactions').doc();
        tx.set(txRef, {
          type: 'debit',
          amount,
          comment: 'Partner Investment Started',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          transactionId: investmentRef.id,
          status: 'completed',
          recipientName: 'Reviews World Partner Plan',
          recipientMobile: ''
        });
      });

      res.status(201).json({ ok: true, investmentId: investmentRef.id, invoiceId });
    } catch (error) {
      console.error('Create partner investment failed:', error);
      res.status(500).json({ ok: false, error: 'INVESTMENT_FAILED', message: error.message });
    }
  });

  app.get('/api/partner-investments/user/:userId', requireHttpAuth, async (req, res) => {
    try {
      const userId = req.params.userId;
      if (req.auth.sub !== userId && !req.auth.isAdmin) {
        return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
      }

      const db = admin.firestore();
      const snap = await db.collection('artifacts/digital-wallet-prod/public/data/partner_investments')
        .where('userId', '==', userId)
        .get();
      const investments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      investments.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0);
        return timeB - timeA;
      });
      res.json({ ok: true, investments });
    } catch (error) {
      console.error('List user partner investments failed:', error);
      res.status(500).json({ ok: false, error: 'LOAD_INVESTMENTS_FAILED', message: error.message });
    }
  });

  app.get('/api/partner-investments', requireHttpAuth, async (req, res) => {
    try {
      if (!req.auth.isAdmin) {
        return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
      }

      const db = admin.firestore();
      const snap = await db.collection('artifacts/digital-wallet-prod/public/data/partner_investments')
        .orderBy('createdAt', 'desc')
        .get();
      const investments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ ok: true, investments });
    } catch (error) {
      console.error('List all partner investments failed:', error);
      res.status(500).json({ ok: false, error: 'LOAD_ALL_INVESTMENTS_FAILED', message: error.message });
    }
  });

  app.post('/api/partner-investments/:investmentId/interest', requireHttpAuth, async (req, res) => {
    try {
      const investmentId = req.params.investmentId;
      const db = admin.firestore();
      const investmentRef = db.doc(`artifacts/digital-wallet-prod/public/data/partner_investments/${investmentId}`);

      const invDocCheck = await investmentRef.get();
      if (!invDocCheck.exists) {
        return res.status(404).json({ ok: false, error: 'NOT_FOUND', message: 'Investment not found.' });
      }
      const invData = invDocCheck.data();
      if (invData.userId !== req.auth.sub && !req.auth.isAdmin) {
        return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: 'Access denied.' });
      }

      await db.runTransaction(async (tx) => {
        const invDoc = await tx.get(investmentRef);
        if (!invDoc.exists) throw new Error('Investment not found.');
        const inv = invDoc.data();
        if (inv.status !== 'active') throw new Error('Investment is not active.');
        const nextPayout = inv.nextPayoutAt && inv.nextPayoutAt.toDate ? inv.nextPayoutAt.toDate() : (inv.nextPayoutAt ? new Date(inv.nextPayoutAt) : null);
        if (!nextPayout || nextPayout > new Date()) throw new Error('30 days are not completed yet.');

        const userRef = db.doc(`artifacts/digital-wallet-prod/public/data/users/${inv.userId}`);
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new Error('User not found.');

        const monthsPaid = inv.monthsPaid || 0;
        const nextMonthsPaid = monthsPaid + 1;
        const monthlyInterest = inv.monthlyInterest || Number(((inv.amount || 0) * (inv.interestRate || 0.01)).toFixed(2));
        const isFinal = nextMonthsPaid >= (inv.months || 1);
        const creditAmount = isFinal ? Number((monthlyInterest + (inv.amount || 0)).toFixed(2)) : monthlyInterest;

        tx.update(userRef, { balance: (userDoc.data().balance || 0) + creditAmount });

        const invUpdates = {
          paidInterest: Number(((inv.paidInterest || 0) + monthlyInterest).toFixed(2)),
          monthsPaid: nextMonthsPaid,
          status: isFinal ? 'completed' : 'active'
        };

        if (isFinal) {
          invUpdates.nextPayoutAt = admin.firestore.FieldValue.delete();
          invUpdates.completedAt = admin.firestore.FieldValue.serverTimestamp();
        } else {
          const nextPayoutDate = new Date(nextPayout);
          nextPayoutDate.setDate(nextPayoutDate.getDate() + 30);
          invUpdates.nextPayoutAt = admin.firestore.Timestamp.fromDate(nextPayoutDate);
        }

        tx.update(investmentRef, invUpdates);

        const txRef = userRef.collection('transactions').doc();
        tx.set(txRef, {
          type: 'credit',
          amount: creditAmount,
          comment: isFinal ? 'Partner Investment Maturity' : 'Partner Investment Interest',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          transactionId: `PARTNER-${investmentId}-${nextMonthsPaid}`,
          status: 'completed',
          isAdminTransaction: true,
          senderName: 'Reviews World',
          recipientName: inv.userName || 'User',
          recipientMobile: inv.userMobile || ''
        });
      });

      res.json({ ok: true });
    } catch (error) {
      console.error('Process partner interest failed:', error);
      res.status(500).json({ ok: false, error: 'PAYOUT_FAILED', message: error.message });
    }
  });

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

  app.post('/api/admin/create-sub-admin', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== ADMIN_UID && req.auth.role !== 'owner') {
      return res.status(403).json({ ok: false, error: 'ONLY_OWNER_CAN_CREATE_SUB_ADMINS' });
    }

    const { email, password, name, mobile, referralCode } = req.body;
    if (!email || !password || !name || !referralCode) {
      return res.status(400).json({ ok: false, error: 'MISSING_REQUIRED_FIELDS' });
    }

    try {
      let uid;
      let userRecord;
      const cleanMobile = mobile ? mobile.replace(/\D/g, '').slice(-10) : '';

      try {
        userRecord = await admin.auth().createUser({
          email,
          password,
          displayName: name,
          phoneNumber: mobile ? (mobile.startsWith('+') ? mobile : `+91${mobile}`) : undefined
        });
        uid = userRecord.uid;
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-exists' || (authErr.message && authErr.message.includes('already in use'))) {
          userRecord = await admin.auth().getUserByEmail(email);
          uid = userRecord.uid;
          await admin.auth().updateUser(uid, {
            password,
            displayName: name,
            phoneNumber: mobile ? (mobile.startsWith('+') ? mobile : `+91${mobile}`) : undefined
          });
        } else {
          throw authErr;
        }
      }

      const db = admin.firestore();
      const appId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
      await db.doc(`artifacts/${appId}/public/data/users/${uid}`).set({
        uid,
        email: normalizeEmail(email),
        name,
        mobile: cleanMobile,
        phoneNumber: cleanMobile,
        role: 'admin',
        status: 'active',
        referralCode: referralCode,
        passwordText: password,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        signupApprovalStatus: 'approved',
        accountStatus: 'active',
        balance: 0
      }, { merge: true });

      const passwordHash = await bcrypt.hash(password, 12);
      const existingDbUser = await findUserByEmail(d1, email);
      if (existingDbUser) {
        await d1.query(
          `UPDATE users SET password_hash = ?, name = ?, mobile = ?, role = ?, referral_code = ?, status = ? WHERE id = ?`,
          [passwordHash, name, cleanMobile, 'admin', referralCode, 'active', existingDbUser.id]
        );
      } else {
        await createUser(d1, {
          id: uid,
          firebaseUid: uid,
          email,
          passwordHash,
          profile: { name, mobile: cleanMobile },
          role: 'admin',
          parentAdmin: null,
          referralCode,
          status: 'active'
        });
      }

      return res.json({ ok: true, uid });
    } catch (err) {
      console.error('Failed to create sub-admin:', err);
      return res.status(500).json({ ok: false, error: err.message || 'FAILED_TO_CREATE_SUB_ADMIN' });
    }
  });

  app.post('/api/admin/impersonate-sub-admin', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== ADMIN_UID && req.auth.role !== 'owner') {
      return res.status(403).json({ ok: false, error: 'ONLY_OWNER_CAN_IMPERSONATE_SUB_ADMINS' });
    }

    const { targetUid } = req.body;
    if (!targetUid) return res.status(400).json({ ok: false, error: 'TARGET_UID_REQUIRED' });

    try {
      const db = admin.firestore();
      const appId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
      const targetUserDoc = await db.doc(`artifacts/${appId}/public/data/users/${targetUid}`).get();
      if (!targetUserDoc.exists) {
        return res.status(404).json({ ok: false, error: 'SUB_ADMIN_NOT_FOUND' });
      }

      const targetUserData = targetUserDoc.data();
      if (targetUserData.role !== 'admin') {
        return res.status(400).json({ ok: false, error: 'TARGET_USER_IS_NOT_SUB_ADMIN' });
      }

      const targetDbUser = await findUserByEmail(d1, targetUserData.email);
      if (!targetDbUser) {
        return res.status(404).json({ ok: false, error: 'SUB_ADMIN_NOT_FOUND_IN_DB' });
      }

      const token = createAppToken(targetDbUser);

      return res.json({
        ok: true,
        token,
        user: {
          id: targetDbUser.id,
          email: targetDbUser.email,
          firebaseUid: targetDbUser.firebase_uid,
          name: targetDbUser.name || '',
          mobile: targetDbUser.mobile || ''
        },
        userData: targetUserData
      });
    } catch (err) {
      console.error('Impersonation failed:', err);
      return res.status(500).json({ ok: false, error: err.message || 'IMPERSONATION_FAILED' });
    }
  });

  app.post('/api/admin/suspend-sub-admin', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== ADMIN_UID && req.auth.role !== 'owner') {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }
    const { targetUid } = req.body;
    if (!targetUid) return res.status(400).json({ ok: false, error: 'TARGET_UID_REQUIRED' });

    try {
      const db = admin.firestore();
      const appId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
      await db.doc(`artifacts/${appId}/public/data/users/${targetUid}`).update({
        status: 'suspended',
        isDisabled: true
      });
      await d1.query('UPDATE users SET status = ? WHERE id = ?', ['suspended', targetUid]);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/unsuspend-sub-admin', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== ADMIN_UID && req.auth.role !== 'owner') {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }
    const { targetUid } = req.body;
    if (!targetUid) return res.status(400).json({ ok: false, error: 'TARGET_UID_REQUIRED' });

    try {
      const db = admin.firestore();
      const appId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
      await db.doc(`artifacts/${appId}/public/data/users/${targetUid}`).update({
        status: 'active',
        isDisabled: false
      });
      await d1.query('UPDATE users SET status = ? WHERE id = ?', ['active', targetUid]);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/delete-sub-admin', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== ADMIN_UID && req.auth.role !== 'owner') {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }
    const { targetUid } = req.body;
    if (!targetUid) return res.status(400).json({ ok: false, error: 'TARGET_UID_REQUIRED' });

    try {
      await admin.auth().deleteUser(targetUid).catch(() => {});
      const db = admin.firestore();
      const appId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
      await db.doc(`artifacts/${appId}/public/data/users/${targetUid}`).delete();
      await d1.query('DELETE FROM users WHERE id = ?', [targetUid]);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
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

async function verifyTransactionWithFirestore(userId, transaction) {
  const transactionId = transaction.transactionId || transaction.id;
  if (!transactionId) return false;
  
  const appId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
  const db = admin.firestore();
  
  try {
    // Try directly using transactionId
    let docRef = db.doc(`artifacts/${appId}/public/data/users/${userId}/transactions/${transactionId}`);
    let docSnap = await docRef.get();
    
    // If not found, try with a sanitized safe ID
    if (!docSnap.exists) {
      const safeId = String(transactionId).replace(/[\/\\#?[\]]/g, '-').slice(0, 120);
      docRef = db.doc(`artifacts/${appId}/public/data/users/${userId}/transactions/${safeId}`);
      docSnap = await docRef.get();
    }
    
    // If still not found, search the collection
    if (!docSnap.exists) {
      const txQuery = await db.collection(`artifacts/${appId}/public/data/users/${userId}/transactions`)
        .where('transactionId', '==', transactionId)
        .limit(1)
        .get();
      if (!txQuery.empty) {
        docSnap = txQuery.docs[0];
      }
    }

    if (!docSnap.exists) {
      console.warn(`Transaction verification failed: ${transactionId} not found in Firestore for user ${userId}`);
      return false;
    }

    const fData = docSnap.data();
    
    // Verify fields match (amount, type)
    const dbAmount = Number(fData.amount || 0);
    const postAmount = Number(transaction.amount || 0);
    if (Math.abs(dbAmount) !== Math.abs(postAmount)) {
      console.warn(`Transaction verification failed: amount mismatch for ${transactionId} (Firestore: ${dbAmount}, D1 Sync: ${postAmount})`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error verifying transaction ${transactionId} in Firestore:`, error);
    return false;
  }
}

  app.post('/api/transactions', requireHttpAuth, async (req, res) => {
    if (req.auth.sub !== req.body.userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }

    // Verify transaction with Firestore
    const isVerified = await verifyTransactionWithFirestore(req.body.userId, req.body);
    if (!isVerified) {
      return res.status(400).json({ ok: false, error: 'UNVERIFIED_TRANSACTION_PAYLOAD' });
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
    let imported = 0;
    for (const transaction of limited) {
      const isVerified = await verifyTransactionWithFirestore(userId, transaction);
      if (isVerified) {
        await saveTransaction(d1, { ...transaction, userId });
        imported++;
      }
    }
    res.json({ ok: true, imported });
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

    // Verify sender transaction with Firestore
    const isSenderVerified = await verifyTransactionWithFirestore(sender.userId, sender);
    if (!isSenderVerified) {
      return res.status(400).json({ ok: false, error: 'UNVERIFIED_SENDER_TRANSACTION_PAYLOAD' });
    }

    // Verify recipient transaction with Firestore
    const isRecipientVerified = await verifyTransactionWithFirestore(recipient.userId, recipient);
    if (!isRecipientVerified) {
      return res.status(400).json({ ok: false, error: 'UNVERIFIED_RECIPIENT_TRANSACTION_PAYLOAD' });
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

    // Set parentAdmin limit for sub-admins
    let parentAdmin = null;
    if (req.auth.isAdmin && req.auth.role === 'admin') {
      parentAdmin = req.auth.sub;
    }

    const requestedStatus = req.query.status ? String(req.query.status) : 'pending';
    const requests = await listFundRequests(d1, {
      status: requestedStatus === 'all' ? null : requestedStatus,
      type: req.query.type ? String(req.query.type) : null,
      userId,
      parentAdmin,
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

  app.post('/api/revy-bot', requireHttpAuth, async (req, res) => {
    try {
      const { question, history, userContext } = req.body;
      if (!question) {
        return res.status(400).json({ ok: false, error: 'QUESTION_REQUIRED' });
      }

      const formattedHistory = Array.isArray(history) ? history : [];
      
      const db = admin.firestore();
      
      // Securely verify user email from Firestore
      let callerEmail = (req.auth.email || '').toLowerCase().trim();
      try {
        const userDoc = await db.doc(`artifacts/digital-wallet-prod/public/data/users/${req.auth.sub}`).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData && userData.email) {
            callerEmail = userData.email.toLowerCase().trim();
          }
        }
      } catch (err) {
        console.error('Error verifying user email in Firestore:', err);
      }
      
      const isCallerAdmin = (callerEmail === 'reviewsworld01@gmail.com');

      // Fetch dynamic chatbot memories from Firestore
      let memories = [];
      const memoryRef = db.doc(`artifacts/digital-wallet-prod/public/data/bot_memory/global`);
      try {
        const memoryDoc = await memoryRef.get();
        if (memoryDoc.exists) {
          memories = memoryDoc.data().memories || [];
        }
      } catch (err) {
        console.error('Error fetching bot memory:', err);
      }

      let memoriesContext = "";
      if (memories.length > 0) {
        memoriesContext = "\nIMPORTANT: You have stored the following custom information from the admin in your memory. Follow these instructions/facts strictly:\n" + 
          memories.map((m, idx) => `${idx + 1}. ${m}`).join('\n') + "\n";
      }

      let contextStr = "None";
      if (userContext) {
        contextStr = `
- User Name: ${userContext.userName || 'User'}
- Email: ${callerEmail}
- Mobile: ${userContext.userMobile || ''}
- Current Wallet Balance: ₹${userContext.balance || 0}
- Active Loan Status: ${userContext.activeLoan ? `₹${userContext.activeLoan.amount} (${userContext.activeLoan.status})` : 'No active loan'}
- Active Partner Investment: ${userContext.activeInvestment ? `₹${userContext.activeInvestment.amount} (${userContext.activeInvestment.status})` : 'No active investment'}
- Pending Withdrawal: ${userContext.pendingWithdrawal ? `₹${userContext.pendingWithdrawal.amount} via ${userContext.pendingWithdrawal.method} requested on ${userContext.pendingWithdrawal.requestedAt} is currently ${userContext.pendingWithdrawal.status}` : 'No pending withdrawal'}
- Recent 5 Transactions:
${userContext.latestTransactions && userContext.latestTransactions.length ? userContext.latestTransactions.map((t, idx) => `  ${idx+1}. ${t}`).join('\n') : '  No transactions found.'}
`;
      }

      const systemMessage = {
        role: "system",
        content: `You are REVY, the official AI support chatbot for the "RW Wallet" (also known as "REVIEWS WORLD") web app, developed by the owner, YASH VISHAL.
Your job is to answer questions about the app's features (earning, task verification, add fund deposit, pay to wallet transfer, bank/UPI withdrawals, mobile recharges, gift codes, partner investments, loans), the owner, and greetings.

CRITICAL RULES:
1. Match the user's language/style of communication EXACTLY:
   * If the user writes in English, reply in English.
   * If the user writes in Hinglish (Hindi written using Latin/English characters, e.g., "recharge kaise karein"), reply in Hinglish.
   * If the user writes in Hindi (using Devanagari script, e.g., "रिचार्ज कैसे करें"), reply in Hindi.
   * Match other languages (e.g. Spanish, Bengali) if the user writes in them.
   * Keep responses friendly, brief, conversational, and direct.
2. Keep responses EXTREMELY short, direct, and to-the-point (MAX 2-3 lines). Avoid generic filler paragraphs.
3. Use the following Live User Context to answer user queries about their balance, transactions, withdrawals, loans, or investments:
${contextStr}
4. Address greetings (hi, hello, who are you, help, etc.) naturally and briefly as REVY.
5. If the user asks anything completely unrelated to the app, the owner, or greetings, reply EXACTLY with this:
"Sorry, I can help only with RW Wallet, REVIEWS WORLD, earning, account, wallet, transaction, withdrawal, add fund, pay to wallet, recharge, gift code, loan, partner investment, profile, and app usage questions. Would you like me to transfer your problem to ADMIN?"

ADMIN MEMORY TRAINING:
The user with email 'reviewsworld01@gmail.com' is the ADMIN.
- If the admin (email: reviewsworld01@gmail.com) explicitly tells you to remember, save, or note down any fact, rule, or information, you must accept and confirm it briefly, AND you MUST append a special tag at the very end of your response: [SAVE_MEMORY: <the exact details/info to save>].
  * Example instruction: "admin says remember that withdrawal takes 2 hours"
  * Example response: "Got it admin, I have noted that withdrawals take 2 hours. [SAVE_MEMORY: Withdrawals take 2 hours]"
- Do NOT output this [SAVE_MEMORY: ...] tag for any other user (non-admin). If a non-admin user asks you to remember or save something, reply that only the administrator can train or update your memory.
${memoriesContext}`
      };

      const messages = [systemMessage, ...formattedHistory, { role: "user", content: question }];

      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer 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"
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: messages,
          temperature: 0.2,
          top_p: 0.7,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        throw new Error(`Nvidia API error: status ${response.status}`);
      }

      const data = await response.json();
      let answer = data.choices?.[0]?.message?.content || "";

      // Process and save memory if admin and [SAVE_MEMORY: ...] tag exists
      const saveMemoryRegex = /\[SAVE_MEMORY:\s*(.*?)\]/i;
      const match = answer.match(saveMemoryRegex);
      if (match) {
        const newMemory = match[1].trim();
        if (newMemory && isCallerAdmin) {
          try {
            await db.runTransaction(async (transaction) => {
              const doc = await transaction.get(memoryRef);
              let currentMemories = [];
              if (doc.exists) {
                currentMemories = doc.data().memories || [];
              }
              if (!currentMemories.includes(newMemory)) {
                currentMemories.push(newMemory);
                transaction.set(memoryRef, { memories: currentMemories }, { merge: true });
              }
            });
            console.log('Saved admin memory:', newMemory);
          } catch (saveErr) {
            console.error('Error saving admin memory to Firestore:', saveErr);
          }
        }
        // Always clean up the tag so the end user never sees it in the chat
        answer = answer.replace(/\[SAVE_MEMORY:\s*(.*?)\]/gi, '').trim();
      }

      res.json({ ok: true, answer });
    } catch (error) {
      console.error('Revy Bot API error:', error);
      res.status(500).json({ ok: false, error: 'BOT_ERROR', detail: error.message });
    }
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
    try {
      const notification = await createNotification(d1, {
        title: req.body.title,
        message: req.body.message,
        audience: req.body.audience,
        recipients: req.body.recipients,
        senderId: req.auth.sub
      });
      res.json({ ok: true, notification });
    } catch (error) {
      console.error('Create notification failed:', error);
      res.status(500).json({ ok: false, error: 'CREATE_NOTIFICATION_FAILED', message: error.message });
    }
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

  app.get('/api/admin/task-reservations/:taskId', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      await cleanupExpiredReservations(d1);
      const reservations = await d1.all(
        `SELECT * FROM task_comment_reservations WHERE task_id = ? ORDER BY reserved_at DESC`,
        [req.params.taskId]
      );
      const formatted = reservations.map(r => {
        let details = {};
        try { details = r.details_json ? JSON.parse(r.details_json) : {}; } catch {}
        return {
          ...r,
          userName: details.userName || '',
          userEmail: details.userEmail || '',
          expiresAt: r.expires_at // make sure to format matching frontend expectation
        };
      });
      res.json({ ok: true, reservations: formatted });
    } catch (error) {
      console.error('Failed to get task reservations:', error);
      res.status(500).json({ ok: false, error: 'GET_RESERVATIONS_FAILED' });
    }
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
  // ── Screenshot Upload Endpoint ───────────────────────────────────────────
  app.post('/api/uploads/task-screenshot', requireHttpAuth, rateLimit({ windowMs: 60000, maxRequests: 10 }), async (req, res) => {
    try {
      const db = admin.firestore();
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

      // --- OCR PRE-VERIFICATION ---
      // 1. Fetch Task data from Firestore
      const taskDoc = await db.doc(`artifacts/digital-wallet-prod/public/data/tasks/${taskId}`).get();
      if (!taskDoc.exists) {
        return res.status(404).json({ ok: false, error: 'TASK_NOT_FOUND', detail: 'The requested task was not found.' });
      }
      const taskData = taskDoc.data();

      // 2. Fetch User data to determine tier/role
      const userDoc = await db.doc(`artifacts/digital-wallet-prod/public/data/users/${req.auth.sub}`).get();
      const userData = userDoc.data() || {};
      const userTier = userData.taskTier || (userData.bulkTaskMode || userData.isBulkTaskUser ? 'bulker' : 'single');
      const isBulk = (userTier === 'bulker' || userTier === 'super_bulker');

      // 3. Get comment pool for the task
      const getTaskCommentPool = (t = {}) => {
        const src = Array.isArray(t.reviewComments) && t.reviewComments.length
            ? t.reviewComments
            : String(t.reviewComment || t.commentToCopy || t.reviewText || t.copyText || 'good app').split(/\r?\n/);
        return src.map(v => String(v || '').trim()).filter(Boolean);
      };
      const commentPool = getTaskCommentPool(taskData);

      // 4. Calculate remaining comments
      let targetComments = [];
      if (isBulk) {
        // Query D1 today submissions
        const todayStart = (() => {
          const d = new Date();
          const istTime = d.getTime() + (5.5 * 60 * 60 * 1000);
          const istDate = new Date(istTime);
          const startOfTodayIST = Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate(), 0, 0, 0, 0);
          return startOfTodayIST - (5.5 * 60 * 60 * 1000);
        })();

        const todaySubmissions = await d1.all(
          `SELECT assigned_comment FROM task_submissions WHERE task_id = ? AND user_id = ? AND submitted_at >= ?`,
          [taskId, req.auth.sub, todayStart]
        ).catch(() => []);
        const submittedComments = new Set(todaySubmissions.map(s => String(s.assigned_comment || '').trim()));
        targetComments = commentPool.filter(c => !submittedComments.has(String(c).trim()));
        
        if (targetComments.length === 0) {
          return res.status(400).json({ ok: false, error: 'NO_COMMENTS_REMAINING', detail: 'All comments for this task have already been submitted.' });
        }
      } else {
        // Single user gets their active reservation comment or falls back
        const reservation = await d1.first(
          `SELECT comment FROM task_comment_reservations WHERE task_id = ? AND user_id = ? AND status = 'reserved' AND expires_at > ? LIMIT 1`,
          [taskId, req.auth.sub, Date.now()]
        ).catch(() => null);
        const targetComment = reservation ? reservation.comment : (req.query.assignedComment || commentPool[0]);
        targetComments = [targetComment];
      }

      // 5. Run Puter client-side OCR bypass or standard Tesseract OCR
      const skipOcr = req.query.skipOcr === 'true';
      let ocrText = '';
      let ocrConfidence = 0;
      let ocrResult = null;
      let matchedComment = null;
      let gmailName = 'Unknown User';
      let gmailLogoUrl = '';
      let avatarHash = '';
      let avatarCrop = null;

      if (skipOcr) {
        ocrText = req.query.ocrText ? String(req.query.ocrText).trim() : '';
        ocrConfidence = Number(req.query.ocrConfidence || 1.0);
        gmailName = req.query.gmailName ? String(req.query.gmailName).trim() : 'Unknown User';
        gmailLogoUrl = req.query.gmailLogoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(gmailName)}&background=random`;
        matchedComment = req.query.matchedComment || req.query.assignedComment || '';
        if (!matchedComment && targetComments.length > 0) {
          matchedComment = targetComments[0];
        }
      } else {
        let ocrSuccess = false;
        const ocrApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';
        try {
          const formData = new FormData();
          const blob = new Blob([body], { type: contentType });
          formData.append('file', blob, originalName);
          formData.append('language', 'eng');
          formData.append('OCREngine', '2');
          formData.append('apikey', ocrApiKey);

          const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData
          });

          if (ocrResponse.ok) {
            const ocrData = await ocrResponse.json();
            if (ocrData.OCRExitCode === 1 && ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
              ocrText = ocrData.ParsedResults[0].ParsedText || '';
              ocrConfidence = 0.99;
              ocrSuccess = true;
              console.log('[OCR-Upload] OCR.space Engine 2 completed successfully.');
            } else {
              console.warn('[OCR-Upload] OCR.space API returned error exit code:', ocrData.ErrorMessage || ocrData.OCRExitCode);
            }
          } else {
            console.warn('[OCR-Upload] OCR.space HTTP error:', ocrResponse.status);
          }
        } catch (err) {
          console.warn('[OCR-Upload] OCR.space API call failed, falling back to Tesseract:', err.message);
        }

        let tesseractLines = [];
        if (!ocrSuccess) {
          try {
            ocrResult = await Tesseract.recognize(body, 'eng');
            ocrText = (ocrResult.data.text || '').trim();
            ocrConfidence = (ocrResult.data.confidence || 0) / 100;
            tesseractLines = ocrResult.data.lines || [];
            console.log('[OCR-Upload] Tesseract fallback completed.');
          } catch (ocrErr) {
            console.error('[OCR-Upload] Tesseract OCR failed:', ocrErr);
            return res.status(500).json({ ok: false, error: 'OCR_FAILED', detail: 'Screenshot text recognition failed' });
          }
        }

        // 6. Match comment (first 2 words check with merged fallback)
        const cleanStr = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const ocrTextLower = ocrText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        
        for (const comment of targetComments) {
          const expectedCommentWords = String(comment || '').trim().split(/\s+/).filter(Boolean);
          let matchFound = false;

          if (expectedCommentWords.length >= 2) {
            const word1 = cleanStr(expectedCommentWords[0]);
            const word2 = cleanStr(expectedCommentWords[1]);
            const combined = word1 + word2;
            const normalizedFullText = ocrTextLower.replace(/\s+/g, '');
            
            if (normalizedFullText.includes(combined) || 
                (ocrTextLower.includes(word1) && ocrTextLower.includes(word2))) {
              matchFound = true;
            }
          } else if (expectedCommentWords.length === 1) {
            const word1 = cleanStr(expectedCommentWords[0]);
            if (ocrTextLower.includes(word1)) {
              matchFound = true;
            }
          }

          if (matchFound) {
            matchedComment = comment;
            break;
          }
        }

        if (!matchedComment) {
          console.warn(`[OCR-Upload] Comment mismatch for user ${req.auth.sub}. OCR: "${ocrText}"`);
          return res.status(400).json({
            ok: false,
            error: 'COMMENT_NOT_MATCHED',
            detail: 'Your comment is wrong. Copy the same comment as given.'
          });
        }

        // 7. Extract name using older app algorithm (Your review + skip patterns)
        const lines = ocrText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const skipPatterns = [
          /^\d{1,2}:\d{2}/,           // Time (e.g., "10:30")
          /^\d{1,3}%$/,               // Battery percentage
          /LTE|WIFI|4G|5G|VoLTE|KB\/S/i,  // Carrier + Data speed
          /Google Play/i,             // "Google Play" header
          /^Search/i, /^Apps/i, /^Games/i, /^Offers/i,
          /^Movies/i, /^Books/i,
          /^Ratings and reviews/i,
          /^See all reviews/i,
          /^Post/i, /^Cancel/i,
          /^Edit your review/i,
          /^Edit/i,
          /^Episode/i,
          /^[★☆* ]+\d{1,2}/,         // Star ratings
          /^[0-9.]+ stars/,
          /^[0-9.,]+ reviews/,
          /^[0-9.]+ [KMG]B/,         // App size
          /No reviews/i,
          /VoLTE/i, /KB\/S/i,
          /Personal into/i,
          /No data collected/i,
          /Developer contact/i,
          /About this app/i,
          /Rate this app/i,
          /Tell us what you think/i,
          /Write a review/i,
          /Safety/i, /Data privacy/i, /Security/i, /Verified/i,
        ];

        gmailName = 'Unknown User';

        // STEP 1: Look for "Your review" header in the text
        const yourReviewPattern = /Your review/i;
        let yourReviewIdx = -1;

        for (let i = 0; i < lines.length; i++) {
          if (yourReviewPattern.test(lines[i])) {
            yourReviewIdx = i;
            break;
          }
        }

        if (yourReviewIdx !== -1) {
          // Name is usually in the next 3 lines after "Your review"
          for (let j = 1; j <= 3; j++) {
            if (yourReviewIdx + j < lines.length) {
              const line = lines[yourReviewIdx + j];
              const isSystemLine = skipPatterns.some(p => p.test(line));
              if (!isSystemLine && line.length > 2 && /[a-zA-Z]/.test(line) && line.length < 35) {
                gmailName = line;
                break;
              }
            }
          }
        }

        // Fallback Logic
        if (gmailName === 'Unknown User' || gmailName === 'Unknown') {
          for (const line of lines) {
            const isSystemLine = skipPatterns.some(p => p.test(line));
            if (!isSystemLine && line.length > 2 && /[a-zA-Z]/.test(line) && line.length < 35) {
              gmailName = line;
              break;
            }
          }
        }

        gmailLogoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(gmailName)}&background=random`;
        avatarHash = '';
        avatarCrop = null;
      }
      const safeComment = (matchedComment || 'screenshot').slice(0, 30).replace(/[<>:"/\\|?*]+/g, '_').trim();

      // 8. Upload Full Screenshot with Date/App nested naming structure
      const safeGmailName = gmailName.replace(/[<>:"/\\|?*]+/g, '_').trim().slice(0, 30) || 'Unknown';
      const screenshotFileName = `${safeGmailName} - ${safeComment} (screenshot)${ext}`;

      let screenshotResult = {};
      const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (driveFolderId && (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) {
        try {
          const driveResult = await uploadToGoogleDrive(body, screenshotFileName, contentType, driveFolderId, { appName });
          screenshotResult = {
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
          };
        } catch (driveError) {
          console.error('[OCR-Upload] Google Drive upload failed, falling back to R2:', driveError.message);
        }
      }

      if (!screenshotResult.url && r2 && process.env.CLOUDFLARE_R2_BUCKET && process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL) {
        const key = `task-screenshots/${userSegment}/${screenshotFileName}`;
        const url = await putR2Object(r2, key, body, contentType);
        screenshotResult = {
          name: originalName,
          size: body.length,
          type: contentType,
          key,
          url,
          storage: 'r2',
          uploadedAt: nowMs()
        };
      }

      if (!screenshotResult.url) {
        return res.status(503).json({ ok: false, error: 'NO_STORAGE_CONFIGURED' });
      }

      res.json({
        ok: true,
        screenshot: screenshotResult,
        verification: {
          ocrStatus: 'completed',
          ocrText: ocrText.slice(0, 4000),
          ocrConfidence,
          gmailName: gmailName.slice(0, 200),
          gmailLogoUrl,
          avatarHash,
          avatarCrop,
          matchedComment
        }
      });
    } catch (error) {
      if (error?.code === 'UPLOAD_TOO_LARGE') return res.status(413).json({ ok: false, error: 'UPLOAD_TOO_LARGE' });
      console.error('Task screenshot upload failed:', error);
      return res.status(500).json({ ok: false, error: 'SCREENSHOT_UPLOAD_FAILED' });
    }
  });

  // ── Task Submission Endpoints ────────────────────────────────────────────
  app.post('/api/task-submissions', requireHttpAuth, rateLimit({ windowMs: 60000, maxRequests: 10 }), async (req, res) => {
    try {
      const { taskId, assignedComment, screenshotUrl } = req.body;
      const userId = req.auth.sub;

      // check if it's a read_news task
      const db = admin.firestore();
      const taskDoc = await db.doc(`artifacts/digital-wallet-prod/public/data/tasks/${taskId}`).get();
      const taskData = taskDoc.data();
      if (taskData && taskData.taskSubtype === 'read_news') {
        const submissionId = `sub_${taskId.slice(0, 12)}_${userId.slice(0, 12)}_${Date.now()}`;
        const reward = Number(taskData.rate || taskData.reward || 0);

        // 1. Save submission to D1
        await saveTaskSubmission(d1, {
          id: submissionId,
          taskId,
          userId,
          assignedComment: 'Read News Task Completed',
          screenshotUrl: 'https://cdn-icons-png.flaticon.com/512/2540/2540832.png',
          reward,
          taskLink: taskData.taskLink || '',
          appName: taskData.appName || taskData.title || 'News Task',
          userName: req.auth.name || req.auth.email || 'User',
          userEmail: req.auth.email || '',
          payoutDelayDays: 0
        });

        // 2. Mark submission approved and paid instantly in D1
        await updateTaskSubmission(d1, submissionId, {
          ocrStatus: 'completed',
          manualStatus: 'approved',
          payoutStatus: 'paid',
          paidAt: Date.now()
        });

        // 3. Save credit transaction in D1
        if (reward > 0) {
          const transactionId = `task_payout_${submissionId}_${Date.now()}`;
          await saveTransaction(d1, {
            userId,
            transactionId,
            type: 'credit',
            amount: reward,
            status: 'completed',
            timestamp: Date.now(),
            details: {
              comment: `Task reward: ${taskData.title}`,
              source: 'task_auto_payout',
              taskId,
              submissionId
            }
          });
        }

        // 4. Update user balance in Firestore (Cloudflare is source of truth)
        const userRef = db.doc(`artifacts/digital-wallet-prod/public/data/users/${userId}`);
        await userRef.update({
          balance: admin.firestore.FieldValue.increment(reward)
        }).catch(e => console.error(`[News Task] Firestore user balance update failed:`, e));

        // 4b. Deduct from owner's wallet
        const ownerRefNews = db.doc(`artifacts/digital-wallet-prod/public/data/users/${ADMIN_UID}`);
        await ownerRefNews.update({
          balance: admin.firestore.FieldValue.increment(-reward)
        }).catch(e => console.error(`[News Task] Owner fund deduction failed:`, e));

        // 5. Save transaction in Firestore
        const txnId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const txnRef = db.doc(`artifacts/digital-wallet-prod/public/data/users/${userId}/transactions/${txnId}`);
        const userDoc = await userRef.get().catch(() => null);
        const userData = userDoc ? userDoc.data() : null;
        await txnRef.set({
          type: 'credit',
          amount: reward,
          comment: `Read News Task: ${taskData.title}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          transactionId: txnId,
          status: 'completed',
          isAdminTransaction: true,
          senderName: 'Reviews World',
          recipientName: userData?.name || req.auth.name || 'User',
          recipientMobile: userData?.mobile || ''
        }).catch(e => console.error(`[News Task] Firestore transaction write failed:`, e));

        // 6. Save submission in Firestore
        const firestoreSubRef = db.doc(`artifacts/digital-wallet-prod/public/data/task_submissions/${submissionId}`);
        await firestoreSubRef.set({
          id: submissionId,
          taskId: taskId,
          taskCode: taskData.taskCode || taskId,
          taskTitle: taskData.title,
          taskFamily: 'social',
          taskSubtype: 'read_news',
          taskSubtypeLabel: 'Earn from read news',
          appName: taskData.appName || taskData.title || 'News Task',
          userId: userId,
          userName: userData?.name || req.auth.name || 'User',
          userEmail: req.auth.email || userData?.email || '',
          userMobile: userData?.mobile || '',
          reward: reward,
          status: 'approved',
          manualStatus: 'approved',
          payoutStatus: 'paid',
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          paidAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(e => console.error(`[News Task] Firestore submission write failed:`, e));

        return res.json({ ok: true, submissionId, instantPaid: true });
      }

      if (!screenshotUrl) {
        return res.status(400).json({ ok: false, error: 'SCREENSHOT_REQUIRED' });
      }

      let ocrText = req.body.ocrExtractedText || '';
      let ocrConfidence = req.body.ocrConfidence || 0;
      let gmailName = req.body.ocrExtractedName || '';
      let gmailLogoUrl = req.body.details?.gmailLogoUrl || '';
      let avatarHash = req.body.details?.avatarHash || '';
      let avatarCrop = req.body.details?.avatarCrop || null;
      let ocrStatus = req.body.ocrStatus || 'pending';
      let matched = !!ocrText;

      // Only run OCR if it wasn't pre-verified and passed from client
      if (!matched) {
        // 1. Download image from URL synchronously
        let imgBuffer;
        try {
          const imgResponse = await fetch(screenshotUrl);
          if (!imgResponse.ok) throw new Error(`Status ${imgResponse.status}`);
          imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
        } catch (err) {
          console.error('[OCR-Submit] Image fetch failed:', err);
          return res.status(400).json({ ok: false, error: 'SCREENSHOT_FETCH_FAILED', detail: 'Could not retrieve screenshot for validation' });
        }

        // 2. Run Tesseract OCR synchronously
        let data = null;
        try {
          const ocrResult = await Tesseract.recognize(imgBuffer, 'eng');
          data = ocrResult.data;
          ocrText = (data.text || '').trim();
          ocrConfidence = (data.confidence || 0) / 100;
        } catch (ocrErr) {
          console.error('[OCR-Submit] Tesseract OCR failed:', ocrErr);
          return res.status(500).json({ ok: false, error: 'OCR_FAILED', detail: 'Screenshot text recognition failed' });
        }

        const cleanStr = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanedComment = cleanStr(assignedComment);

        if (data && data.lines && data.lines.length > 0) {
          let foundIndex = -1;
          for (let j = 0; j < data.lines.length; j++) {
            const cleanedLine = cleanStr(data.lines[j].text);
            if (cleanedLine && (cleanedLine.includes(cleanedComment) || cleanedComment.includes(cleanedLine) || (cleanedComment.length > 5 && cleanedLine.length > 5 && cleanedLine.indexOf(cleanedComment.slice(0, 10)) !== -1))) {
              matched = true;
              foundIndex = j;
              break;
            }
          }

          let nameLine = null;
          if (foundIndex !== -1) {
            // Look for reviewer name 1-3 lines above comment line
            for (let k = foundIndex - 1; k >= Math.max(0, foundIndex - 3); k--) {
              const txt = data.lines[k].text.trim();
              const isRatingOrDate = /^[0-9★☆\s]+$/.test(txt) || txt.toLowerCase().includes('ago') || txt.toLowerCase().includes('edited') || /\d/.test(txt) && (txt.includes('/') || txt.includes('-'));
              if (txt && !isRatingOrDate && txt.length > 2 && txt.length < 50) {
                nameLine = data.lines[k];
                break;
              }
            }
            if (!nameLine && foundIndex >= 2) nameLine = data.lines[foundIndex - 2];
            if (!nameLine && foundIndex >= 1) nameLine = data.lines[foundIndex - 1];
          }

          // Fallback: search first 10 lines
          if (!nameLine) {
            for (let j = 0; j < Math.min(data.lines.length, 10); j++) {
              const txt = data.lines[j].text.trim();
              const isRatingOrDate = /^[0-9★☆\s]+$/.test(txt) || txt.toLowerCase().includes('ago') || txt.toLowerCase().includes('edited') || txt.length < 3 || txt.length > 40;
              if (txt && !isRatingOrDate) {
                nameLine = data.lines[j];
                break;
              }
            }
          }

          if (nameLine) {
            gmailName = nameLine.text.trim().replace(/[\r\n]+/g, ' ');
            // Crop Gmail profile avatar using Jimp synchronously
            try {
              const image = await Jimp.read(imgBuffer);
              const imgWidth = image.bitmap.width;
              const imgHeight = image.bitmap.height;
              const bbox = nameLine.bbox;

              if (bbox) {
                const cropX = Math.max(0, Math.min(bbox.x0 - 85, imgWidth - 75));
                const cropY = Math.max(0, Math.min(bbox.y0 - 15, imgHeight - 75));
                const cropW = Math.min(75, imgWidth - cropX);
                const cropH = Math.min(75, imgHeight - cropY);

                if (cropW > 10 && cropH > 10) {
                  const avatar = image.clone().crop(cropX, cropY, cropW, cropH);
                  const avatarBuffer = await avatar.getBufferAsync(Jimp.MIME_JPEG);
                  const safeComment = assignedComment.slice(0, 30).replace(/[<>:"/\\|?*]+/g, '_').trim();
                  const safeGmailName = gmailName.replace(/[<>:"/\\|?*]+/g, '_').trim().slice(0, 30) || 'Unknown';
                  const avatarFileName = `${safeGmailName} - ${safeComment} (logo).jpg`;

                  const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
                  if (driveFolderId && (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) {
                    try {
                      const driveResult = await uploadToGoogleDrive(avatarBuffer, avatarFileName, 'image/jpeg', driveFolderId, { appName });
                      gmailLogoUrl = driveResult.directUrl;
                    } catch (driveErr) {
                      console.error('[OCR-Submit] Avatar Drive upload failed:', driveErr.message);
                    }
                  }

                  if (!gmailLogoUrl && r2 && process.env.CLOUDFLARE_R2_BUCKET) {
                    const key = `task-screenshots/avatars/${userId}/${avatarFileName}`;
                    gmailLogoUrl = await putR2Object(r2, key, avatarBuffer, 'image/jpeg');
                  }
                }
              }
            } catch (cropErr) {
              console.error('[OCR-Submit] Avatar cropping failed:', cropErr);
            }
          }
        }

        if (!matched) {
          console.warn(`[OCR-Submit] Comment mismatch for user ${userId}. Assigned comment: "${assignedComment}". OCR Extracted: "${ocrText}"`);
          return res.status(400).json({
            ok: false,
            error: 'COMMENT_NOT_MATCHED',
            detail: 'Your comment is wrong. Copy the same comment as given.'
          });
        }
        
        ocrStatus = 'completed';
      }

      if (!gmailName) {
        gmailName = 'Unknown User';
      }

      // 3. Save task submission to D1
      const submissionId = await saveTaskSubmission(d1, { ...req.body, userId });

      if (req.body.reservationId) {
        await markReservationSubmitted(d1, req.body.reservationId).catch(e => console.warn('Reservation mark failed:', e));
      }

      const details = {};
      try {
        if (req.body.details) {
          Object.assign(details, req.body.details);
        }
      } catch {}
      if (gmailLogoUrl) {
        details.gmailLogoUrl = gmailLogoUrl;
      }
      if (avatarHash) {
        details.avatarHash = avatarHash;
      }
      if (avatarCrop) {
        details.avatarCrop = avatarCrop;
      }

      // Update OCR fields directly in D1
      await updateTaskSubmission(d1, submissionId, {
        ocrStatus,
        ocrExtractedText: ocrText.slice(0, 4000),
        ocrExtractedName: gmailName.slice(0, 200),
        ocrConfidence,
        detailsJson: details
      });

      console.log(`[OCR-Submit] Save completed for ${submissionId}`);
      res.json({ ok: true, submissionId });
    } catch (error) {
      console.error('[OCR-Submit] Task submission save failed:', error);
      res.status(500).json({ ok: false, error: 'SUBMISSION_FAILED' });
    }
  });

  const taskLogoCache = {};

  app.get('/api/admin/task-submissions', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    const isSubAdmin = req.auth.role === 'admin' && req.auth.sub !== ADMIN_UID;
    const db = admin.firestore();
    const submissions = await listTaskSubmissions(d1, {
      taskId: req.query.taskId || null,
      userId: req.query.userId || null,
      manualStatus: req.query.manualStatus || null,
      ocrStatus: req.query.ocrStatus || null,
      payoutStatus: req.query.payoutStatus || null,
      limit: Math.min(Number(req.query.limit || 200), 500),
      parentAdmin: isSubAdmin ? req.auth.sub : null
    });

    const missingTaskIds = [...new Set(submissions.map(s => s.task_id).filter(id => id && taskLogoCache[id] === undefined))];
    if (missingTaskIds.length > 0) {
      await Promise.all(missingTaskIds.map(async (taskId) => {
        try {
          const taskDoc = await db.doc(`artifacts/digital-wallet-prod/public/data/tasks/${taskId}`).get();
          if (taskDoc.exists) {
            const taskData = taskDoc.data();
            taskLogoCache[taskId] = taskData.imageUrl || taskData.logoUrl || taskData.iconUrl || '';
          } else {
            taskLogoCache[taskId] = '';
          }
        } catch (err) {
          console.warn(`[Admin-Submissions] Failed to load task logo for ${taskId}:`, err.message);
          taskLogoCache[taskId] = '';
        }
      }));
    }

    for (const s of submissions) {
      s.app_logo_url = s.task_id ? (taskLogoCache[s.task_id] || '') : '';
    }

    res.json({ ok: true, submissions });
  });

  app.patch('/api/admin/task-submissions/:submissionId', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const subId = req.params.submissionId;
      const updates = req.body;
      const sub = await d1.first('SELECT * FROM task_submissions WHERE id = ? LIMIT 1', [subId]);
      if (!sub) return res.status(404).json({ ok: false, error: 'SUBMISSION_NOT_FOUND' });

      if (updates.payoutStatus === 'paid' && sub.payout_status !== 'paid') {
        const reward = Number(sub.reward || 0);
        if (reward > 0) {
          const now = Date.now();
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
              source: 'task_manual_payout',
              taskId: sub.task_id,
              submissionId: sub.id
            }
          });
          updates.paidAt = now;
        }
      }

      await updateTaskSubmission(d1, subId, updates);
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
      let ocrSuccess = false;
      let imgBuffer = null;

      if (submission.screenshot_url) {
        try {
          // Download image from URL
          const imgResponse = await fetch(submission.screenshot_url);
          if (!imgResponse.ok) throw new Error(`Image download failed: ${imgResponse.status}`);
          imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

          // Try OCR.space API first
          const ocrApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';
          try {
            const formData = new FormData();
            const blob = new Blob([imgBuffer], { type: 'image/jpeg' });
            formData.append('file', blob, 'screenshot.jpg');
            formData.append('language', 'eng');
            formData.append('OCREngine', '2');
            formData.append('apikey', ocrApiKey);

            const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
              method: 'POST',
              body: formData
            });

            if (ocrResponse.ok) {
              const ocrData = await ocrResponse.json();
              if (ocrData.OCRExitCode === 1 && ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
                ocrResult.text = (ocrData.ParsedResults[0].ParsedText || '').trim();
                ocrResult.confidence = 0.99;
                ocrResult.status = 'completed';
                ocrSuccess = true;
                console.log(`[Admin-OCR] OCR.space completed for ${req.params.submissionId}`);
              }
            }
          } catch (spaceErr) {
            console.warn('[Admin-OCR] OCR.space API failed, falling back to Tesseract:', spaceErr.message);
          }

          // Fallback to Tesseract
          if (!ocrSuccess) {
            const { data } = await Tesseract.recognize(imgBuffer, 'eng', {
              logger: () => {}
            });
            ocrResult.text = (data.text || '').trim();
            ocrResult.confidence = (data.confidence || 0) / 100;
            ocrResult.status = ocrResult.text ? 'completed' : 'completed';
            console.log(`[Admin-OCR] Tesseract fallback completed for ${req.params.submissionId}`);
          }
        } catch (ocrError) {
          console.error('[Admin-OCR] OCR process error:', ocrError);
          ocrResult = { text: '', confidence: 0, status: 'failed' };
        }
      } else {
        ocrResult = { text: '[No screenshot URL available for OCR]', confidence: 0, status: 'failed' };
      }

      // Extract Name if OCR text is populated
      let extractedName = submission.ocr_extracted_name || 'Unknown User';
      if (ocrResult.text) {
        const lines = ocrResult.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const skipPatterns = [
          /^\d{1,2}:\d{2}/,
          /^\d{1,3}%$/,
          /LTE|WIFI|4G|5G|VoLTE|KB\/S/i,
          /Google Play/i,
          /^Search/i, /^Apps/i, /^Games/i, /^Offers/i,
          /^Movies/i, /^Books/i,
          /^Ratings and reviews/i,
          /^See all reviews/i,
          /^Post/i, /^Cancel/i,
          /^Edit your review/i,
          /^Edit/i,
          /^Episode/i,
          /^[★☆* ]+\d{1,2}/,
          /^[0-9.]+ stars/,
          /^[0-9.,]+ reviews/,
          /^[0-9.]+ [KMG]B/,
          /No reviews/i,
          /VoLTE/i, /KB\/S/i,
          /Personal into/i,
          /No data collected/i,
          /Developer contact/i,
          /About this app/i,
          /Rate this app/i,
          /Tell us what you think/i,
          /Write a review/i,
          /Safety/i, /Data privacy/i, /Security/i, /Verified/i,
        ];

        let reviewerName = 'Unknown User';
        const yourReviewPattern = /Your review/i;
        let yourReviewIdx = -1;

        for (let i = 0; i < lines.length; i++) {
          if (yourReviewPattern.test(lines[i])) {
            yourReviewIdx = i;
            break;
          }
        }

        if (yourReviewIdx !== -1) {
          for (let j = 1; j <= 3; j++) {
            if (yourReviewIdx + j < lines.length) {
              const line = lines[yourReviewIdx + j];
              const isSystemLine = skipPatterns.some(p => p.test(line));
              if (!isSystemLine && line.length > 2 && /[a-zA-Z]/.test(line) && line.length < 35) {
                reviewerName = line;
                break;
              }
            }
          }
        }

        if (reviewerName === 'Unknown User' || reviewerName === 'Unknown') {
          for (const line of lines) {
            const isSystemLine = skipPatterns.some(p => p.test(line));
            if (!isSystemLine && line.length > 2 && /[a-zA-Z]/.test(line) && line.length < 35) {
              reviewerName = line;
              break;
            }
          }
        }
        extractedName = reviewerName;
      }

      let details = {};
      try { details = submission.details_json ? JSON.parse(submission.details_json) : {}; } catch {}
      if (imgBuffer && extractedName && extractedName.toLowerCase() !== 'unknown user') {
        try {
          const avatarResult = await extractAndStoreReviewerAvatar({
            imageBuffer: imgBuffer,
            reviewerName: extractedName,
            r2,
            userId: submission.user_id,
            appName: submission.app_name || 'Avatars'
          });
          if (avatarResult.avatarUrl) details.gmailLogoUrl = avatarResult.avatarUrl;
          if (avatarResult.avatarHash) details.avatarHash = avatarResult.avatarHash;
          if (avatarResult.avatarCrop) details.avatarCrop = avatarResult.avatarCrop;
        } catch (avatarErr) {
          console.warn('[Admin-OCR] Reviewer avatar capture skipped:', avatarErr.message || avatarErr);
        }
      }

      await updateTaskSubmission(d1, req.params.submissionId, {
        ocrStatus: ocrResult.status,
        ocrExtractedText: ocrResult.text.slice(0, 4000),
        ocrConfidence: ocrResult.confidence,
        ocrExtractedName: extractedName,
        detailsJson: details
      });

      res.json({ ok: true, ocr: { ...ocrResult, name: extractedName, avatarHash: details.avatarHash || '', gmailLogoUrl: details.gmailLogoUrl || '' } });
    } catch (error) {
      console.error('OCR processing failed:', error);
      res.status(500).json({ ok: false, error: 'OCR_FAILED' });
    }
  });

function extractPackageId(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      const packageId = url.searchParams.get('id');
      return packageId ? packageId.trim() : '';
    } catch {
      return '';
    }
  }
  return raw;
}

async function fetchPlayStoreReviewsForDate(packageId, targetDateMs) {
  const targetDateStr = new Date(targetDateMs + 330 * 60 * 1000).toISOString().slice(0, 10);
  let continuationToken;
  let keepGoing = true;
  let pageCount = 0;
  const allReviews = [];

  console.log(`[Scraper] Fetching reviews for package ${packageId}, target IST date ${targetDateStr}`);
  while (keepGoing && pageCount < 15) {
    try {
      const response = await gplay.reviews({
        appId: packageId,
        sort: gplay.sort.NEWEST,
        paginate: true,
        nextPaginationToken: continuationToken,
        lang: 'en',
        country: 'in',
        num: 150
      });

      if (!response.data || response.data.length === 0) {
        break;
      }

      allReviews.push(...response.data);
      continuationToken = response.nextPaginationToken;
      pageCount++;

      const oldestReview = response.data[response.data.length - 1];
      const oldestDateStr = new Date(oldestReview.date + 330 * 60 * 1000).toISOString().slice(0, 10);
      if (oldestDateStr < targetDateStr) {
        keepGoing = false;
      }

      if (!continuationToken) {
        keepGoing = false;
      }
    } catch (err) {
      console.error(`[Scraper] gplay.reviews page ${pageCount} error:`, err.message);
      break;
    }
  }

  const filtered = allReviews.filter(review => {
    const reviewDateStr = new Date(review.date + 330 * 60 * 1000).toISOString().slice(0, 10);
    return reviewDateStr === targetDateStr;
  });
  console.log(`[Scraper] Done. Total fetched ${allReviews.length}, target date matches: ${filtered.length}`);
  return filtered;
}

  // ── Scraper Endpoints ────────────────────────────────────────────────────
  app.post('/api/admin/scraper/check-review', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const { submissionId, taskLink, assignedComment, appName } = req.body;
      if (!submissionId) return res.status(400).json({ ok: false, error: 'SUBMISSION_ID_REQUIRED' });

      // Retrieve submission from D1
      const sub = await d1.first('SELECT * FROM task_submissions WHERE id = ? LIMIT 1', [submissionId]);
      if (!sub) return res.status(404).json({ ok: false, error: 'SUBMISSION_NOT_FOUND' });

      const appNameLower = String(sub.app_name || appName || '').trim().toLowerCase();
      const liveList = await d1.first(
        'SELECT * FROM live_lists WHERE LOWER(app_name) = ? ORDER BY date DESC LIMIT 1',
        [appNameLower]
      );

      const userFullName = String(sub.user_name || '').trim().toLowerCase();
      const ocrReviewerName = String(sub.ocr_extracted_name || '').trim().toLowerCase();
      const isExactNameMatch = userFullName && ocrReviewerName && (userFullName === ocrReviewerName) && (ocrReviewerName !== 'unknown user');

      let isLive = false;
      let matchSource = '';

      if (isExactNameMatch) {
        console.warn(`[Scraper-Check] Exact name match security warning for user ${sub.user_name} on submission ${submissionId}`);
        const scraperResult = {
          checked: true,
          isPlayStore: String(sub.task_link || taskLink || '').includes('play.google.com'),
          found: false,
          message: 'Security bypass: Reviewer name matches platform name exactly. Admin manual review required.',
          checkedAt: nowMs()
        };

        await updateTaskSubmission(d1, submissionId, {
          scraperStatus: 'name_matched_manual',
          scraperResultJson: scraperResult
        });

        // Sync to Firestore
        const db = admin.firestore();
        const firestoreSubRef = db.doc(`artifacts/digital-wallet-prod/public/data/task_submissions/${submissionId}`);
        await firestoreSubRef.update({
          scraperStatus: 'name_matched_manual'
        }).catch(e => console.error(`[Scraper-Check] Firestore sync failed for ${submissionId}:`, e));

        return res.json({ ok: true, result: scraperResult });
      }

      // Check live list (name only)
      if (liveList && sub.ocr_extracted_name && sub.ocr_extracted_name.toLowerCase() !== 'unknown user') {
        const lines = liveList.content.split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(Boolean);
        const nameClean = sub.ocr_extracted_name.trim().toLowerCase();
        isLive = lines.some(line => {
          const lineNameOnly = line.replace(/[a-f0-9]{32,64}/g, '').trim();
          return line.includes(nameClean) || nameClean.includes(lineNameOnly);
        });
        if (isLive) matchSource = 'live_list_name';
      }

      const isPlayStore = String(sub.task_link || taskLink || '').includes('play.google.com');

      // Scraper fallback check
      if (!isLive && isPlayStore) {
        const packageId = extractPackageId(sub.task_link || taskLink);
        if (packageId && sub.ocr_extracted_name && sub.ocr_extracted_name.toLowerCase() !== 'unknown user') {
          try {
            const playReviews = await fetchPlayStoreReviewsForDate(packageId, sub.submitted_at);
            const nameClean = sub.ocr_extracted_name.trim().toLowerCase();
            const foundReview = playReviews.find(r => {
              const rName = String(r.userName || '').trim().toLowerCase();
              return rName.includes(nameClean) || nameClean.includes(rName);
            });
            if (foundReview) {
              isLive = true;
              matchSource = 'play_store_live_scraper';
            }
          } catch (scrapeErr) {
            console.error('Play Store scraper check failed:', scrapeErr);
          }
        }
      }

      const db = admin.firestore();
      if (isLive) {
        // Automatically confirm and approve submission
        const scraperResult = {
          checked: true,
          isPlayStore,
          found: true,
          source: matchSource,
          reviewerName: sub.ocr_extracted_name || '',
          message: 'Review verified: Reviewer found on Play Store / List!',
          checkedAt: nowMs()
        };

        await updateTaskSubmission(d1, submissionId, {
          scraperStatus: 'live_confirmed',
          manualStatus: 'approved',
          verifiedAt: nowMs(),
          scraperResultJson: scraperResult
        });

        // Sync to Firestore
        const firestoreSubRef = db.doc(`artifacts/digital-wallet-prod/public/data/task_submissions/${submissionId}`);
        await firestoreSubRef.update({
          scraperStatus: 'live_confirmed',
          manualStatus: 'approved',
          status: 'approved',
          verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(e => console.error(`[Scraper-Check] Firestore sync failed for ${submissionId}:`, e));

        return res.json({ ok: true, result: scraperResult });
      } else {
        // Not found
        const scraperResult = {
          checked: true,
          isPlayStore,
          found: false,
          message: isPlayStore
            ? 'Not found on Play Store or list. Review might not be live yet or deleted.'
            : 'Non-Play-Store link or reviewer name not found — manual verification required.',
          checkedAt: nowMs()
        };

        const newStatus = isPlayStore ? 'not_live' : 'not_applicable';
        await updateTaskSubmission(d1, submissionId, {
          scraperStatus: newStatus,
          scraperResultJson: scraperResult
        });

        // Sync to Firestore
        const firestoreSubRef = db.doc(`artifacts/digital-wallet-prod/public/data/task_submissions/${submissionId}`);
        await firestoreSubRef.update({
          scraperStatus: newStatus
        }).catch(e => console.error(`[Scraper-Check] Firestore sync failed for ${submissionId}:`, e));

        return res.json({ ok: true, result: scraperResult });
      }
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

  // Play Store Scraper API
  app.post('/api/admin/scrape-playstore', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ ok: false, error: 'URL_REQUIRED' });
      if (!url.includes('play.google.com')) return res.status(400).json({ ok: false, error: 'NOT_A_PLAY_STORE_URL' });

      let html = '';
      
      // Step 1: Direct Fetch
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
          }
        });
        if (response.ok) {
          html = await response.text();
        } else {
          console.warn(`Direct Play Store fetch failed with status ${response.status}`);
        }
      } catch (err) {
        console.warn(`Direct Play Store fetch failed with error: ${err.message}`);
      }

      // Step 2: Codetabs Proxy
      if (!html) {
        try {
          const proxyUrl = 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url);
          const response = await fetch(proxyUrl);
          if (response.ok) {
            html = await response.text();
          } else {
            console.warn(`Codetabs proxy failed with status ${response.status}`);
          }
        } catch (err) {
          console.warn(`Codetabs proxy failed with error: ${err.message}`);
        }
      }

      // Step 3: AllOrigins Proxy
      if (!html) {
        try {
          const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const json = await response.json();
            html = json.contents || '';
          } else {
            console.warn(`AllOrigins proxy failed with status ${response.status}`);
          }
        } catch (err) {
          console.warn(`AllOrigins proxy failed with error: ${err.message}`);
        }
      }

      if (!html) {
        throw new Error('Failed to retrieve Play Store HTML content');
      }
      
      let title = '';
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitleMatch) {
        title = ogTitleMatch[1];
      } else {
        const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleTagMatch) title = titleTagMatch[1];
      }
      title = title.replace(/\s*-\s*Apps on Google Play/gi, '').trim();

      let logoUrl = '';
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogImageMatch) {
        logoUrl = ogImageMatch[1];
      }

      res.json({ ok: true, name: title, logoUrl });
    } catch (error) {
      console.error('Play Store scraping failed:', error);
      res.status(500).json({ ok: false, error: 'SCRAPE_FAILED', message: error.message });
    }
  });

  // User submissions history
  app.get('/api/task-submissions', requireHttpAuth, async (req, res) => {
    try {
      const db = admin.firestore();
      const submissions = await listTaskSubmissions(d1, {
        userId: req.auth.sub,
        limit: Math.min(Number(req.query.limit || 100), 300)
      });

      const missingTaskIds = [...new Set(submissions.map(s => s.task_id).filter(id => id && taskLogoCache[id] === undefined))];
      if (missingTaskIds.length > 0) {
        await Promise.all(missingTaskIds.map(async (taskId) => {
          try {
            const taskDoc = await db.doc(`artifacts/digital-wallet-prod/public/data/tasks/${taskId}`).get();
            if (taskDoc.exists) {
              const taskData = taskDoc.data();
              taskLogoCache[taskId] = taskData.imageUrl || taskData.logoUrl || taskData.iconUrl || '';
            } else {
              taskLogoCache[taskId] = '';
            }
          } catch (err) {
            console.warn(`[User-Submissions] Failed to load task logo for ${taskId}:`, err.message);
            taskLogoCache[taskId] = '';
          }
        }));
      }

      for (const s of submissions) {
        s.app_logo_url = s.task_id ? (taskLogoCache[s.task_id] || '') : '';
      }

      res.json({ ok: true, submissions });
    } catch (error) {
      console.error('List user submissions failed:', error);
      res.status(500).json({ ok: false, error: 'LOAD_SUBMISSIONS_FAILED' });
    }
  });

  // Live Lists management API (List Finder integration)
  app.get('/api/lists', async (req, res) => {
    try {
      const appName = String(req.query.appName || '').trim().toLowerCase();
      const date = String(req.query.date || '').trim();
      let sql = 'SELECT * FROM live_lists';
      const params = [];
      const conditions = [];
      if (appName) {
        conditions.push('LOWER(app_name) LIKE ?');
        params.push(`%${appName}%`);
      }
      if (date) {
        conditions.push('date = ?');
        params.push(date);
      }
      if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY created_at DESC LIMIT 500';
      const lists = await d1.all(sql, params);
      
      const formatted = lists.map(item => {
        const lines = item.content.split(/\r?\n/).filter(Boolean);
        return {
          id: item.id,
          appName: item.app_name,
          date: item.date,
          preview: lines.slice(0, 3).join('\n'),
          lineCount: lines.length,
          content: item.content,
          createdAt: new Date(item.created_at).toISOString()
        };
      });
      res.json({ ok: true, lists: formatted });
    } catch (error) {
      console.error('Fetch live lists failed:', error);
      res.status(500).json({ ok: false, error: 'FETCH_LISTS_FAILED' });
    }
  });

  app.get('/api/lists/:id', async (req, res) => {
    try {
      const item = await d1.first('SELECT * FROM live_lists WHERE id = ? LIMIT 1', [req.params.id]);
      if (!item) return res.status(404).json({ ok: false, error: 'LIST_NOT_FOUND' });
      const lines = item.content.split(/\r?\n/).filter(Boolean);
      res.json({
        ok: true,
        list: {
          id: item.id,
          appName: item.app_name,
          date: item.date,
          content: item.content,
          lineCount: lines.length,
          createdAt: new Date(item.created_at).toISOString()
        }
      });
    } catch (error) {
      console.error('Fetch live list failed:', error);
      res.status(500).json({ ok: false, error: 'FETCH_LIST_FAILED' });
    }
  });

  app.post('/api/lists', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const { appName, date, content } = req.body;
      if (!appName || !date || !content) {
        return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const now = Date.now();
      await d1.query(
        `INSERT INTO live_lists (id, app_name, date, content, created_at) VALUES (?, ?, ?, ?, ?)`,
        [id, appName, date, content, now]
      );
      res.status(201).json({ ok: true, list: { id, appName, date, content, createdAt: new Date(now).toISOString() } });
    } catch (error) {
      console.error('Save live list failed:', error);
      res.status(500).json({ ok: false, error: 'SAVE_LIST_FAILED' });
    }
  });

  app.delete('/api/lists/:id', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      await d1.query('DELETE FROM live_lists WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete live list failed:', error);
      res.status(500).json({ ok: false, error: 'DELETE_LIST_FAILED' });
    }
  });

  // Partner Investments APIs
  app.get('/api/partner-investments', requireHttpAuth, async (req, res) => {
    if (!req.auth.isAdmin) return res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' });
    try {
      const db = admin.firestore();
      const snap = await db.collection('artifacts/rw-wallet-june-26/public/data/partner_investments')
        .orderBy('createdAt', 'desc')
        .get();
      const investments = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate ? data.startDate.toDate().toISOString() : null,
          endDate: data.endDate ? data.endDate.toDate().toISOString() : null,
          nextPayoutAt: data.nextPayoutAt ? data.nextPayoutAt.toDate().toISOString() : null,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
        };
      });
      res.json(investments);
    } catch (error) {
      console.error('Fetch all partner investments failed:', error);
      res.status(500).json({ ok: false, error: 'FETCH_INVESTMENTS_FAILED', message: error.message });
    }
  });

  app.get('/api/partner-investments/user/:userId', requireHttpAuth, async (req, res) => {
    const { userId } = req.params;
    if (req.auth.sub !== userId && !req.auth.isAdmin) {
      return res.status(403).json({ ok: false, error: 'UNAUTHORIZED' });
    }
    try {
      const db = admin.firestore();
      const snap = await db.collection('artifacts/rw-wallet-june-26/public/data/partner_investments')
        .where('userId', '==', userId)
        .get();
      const investments = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate ? data.startDate.toDate().toISOString() : null,
          endDate: data.endDate ? data.endDate.toDate().toISOString() : null,
          nextPayoutAt: data.nextPayoutAt ? data.nextPayoutAt.toDate().toISOString() : null,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
        };
      });
      res.json(investments);
    } catch (error) {
      console.error('Fetch user partner investments failed:', error);
      res.status(500).json({ ok: false, error: 'FETCH_USER_INVESTMENTS_FAILED', message: error.message });
    }
  });

  app.post('/api/partner-investments', requireHttpAuth, async (req, res) => {
    const userId = req.auth.sub;
    const { amount, months, monthlyInterest, totalInterest, startDate, endDate } = req.body;
    if (!amount || amount <= 0 || !months || months <= 0) {
      return res.status(400).json({ ok: false, error: 'INVALID_PARAMETERS' });
    }
    const PARTNER_MIN_INVESTMENT = 100;
    if (amount < PARTNER_MIN_INVESTMENT) {
      return res.status(400).json({ ok: false, error: 'MINIMUM_INVESTMENT_REQUIRED' });
    }

    try {
      const db = admin.firestore();
      const userRef = db.doc(`artifacts/rw-wallet-june-26/public/data/users/${userId}`);
      const investmentRef = db.collection('artifacts/rw-wallet-june-26/public/data/partner_investments').doc();
      const invoiceId = `INV-${investmentRef.id.slice(0, 8).toUpperCase()}`;

      let result = await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new Error('User account not found.');
        const userData = userDoc.data();
        const balance = userData.balance || 0;

        // Spendable balance check
        const locked = userData.loanLockedAmount || 0;
        const pro = userData.isProProfile ? (userData.proLockAmount || 0) : 0;
        const spendable = balance - locked - pro;

        if (spendable < amount) {
          throw new Error('Insufficient wallet balance.');
        }

        // 1. Deduct user balance
        tx.update(userRef, { balance: balance - amount });

        // 2. Create investment document
        tx.set(investmentRef, {
          userId,
          userName: userData.name || 'User',
          userEmail: userData.email || '',
          userMobile: userData.mobile || '',
          amount,
          months,
          interestRate: 0.01,
          monthlyInterest,
          totalInterest,
          paidInterest: 0,
          monthsPaid: 0,
          startDate: admin.firestore.Timestamp.fromDate(new Date(startDate)),
          endDate: admin.firestore.Timestamp.fromDate(new Date(endDate)),
          nextPayoutAt: admin.firestore.Timestamp.fromDate(new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000)),
          status: 'active',
          invoiceId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. Log transaction
        const txRef = userRef.collection('transactions').doc();
        tx.set(txRef, {
          type: 'debit',
          amount,
          comment: 'Partner Investment Started',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          transactionId: investmentRef.id,
          status: 'completed',
          recipientName: 'Reviews World Partner Plan',
          recipientMobile: ''
        });

        return { investmentId: investmentRef.id, invoiceId };
      });

      res.json({ ok: true, ...result });
    } catch (error) {
      console.error('Create partner investment transaction failed:', error);
      res.status(500).json({ ok: false, error: 'TRANSACTION_FAILED', message: error.message });
    }
  });

  app.post('/api/partner-investments/:investmentId/interest', requireHttpAuth, async (req, res) => {
    const { investmentId } = req.params;
    try {
      const db = admin.firestore();
      const investmentRef = db.doc(`artifacts/rw-wallet-june-26/public/data/partner_investments/${investmentId}`);

      await db.runTransaction(async (tx) => {
        const invDoc = await tx.get(investmentRef);
        if (!invDoc.exists) throw new Error('Investment not found.');
        const inv = invDoc.data();
        if (inv.status !== 'active') throw new Error('Investment is not active.');
        
        // Authorization check: User can process their own, or admin
        if (req.auth.sub !== inv.userId && !req.auth.isAdmin) {
          throw new Error('Unauthorized');
        }

        const nextPayout = inv.nextPayoutAt ? inv.nextPayoutAt.toDate() : null;
        if (!nextPayout || nextPayout > new Date()) throw new Error('30 days are not completed yet.');

        const userRef = db.doc(`artifacts/rw-wallet-june-26/public/data/users/${inv.userId}`);
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new Error('User not found.');

        const monthsPaid = inv.monthsPaid || 0;
        const nextMonthsPaid = monthsPaid + 1;
        const monthlyInterest = inv.monthlyInterest || Number(((inv.amount || 0) * 0.01).toFixed(2));
        const isFinal = nextMonthsPaid >= (inv.months || 1);
        const creditAmount = isFinal ? Number((monthlyInterest + (inv.amount || 0)).toFixed(2)) : monthlyInterest;

        tx.update(userRef, { balance: (userDoc.data().balance || 0) + creditAmount });
        
        const nextPayoutAtDate = new Date(nextPayout.getTime() + 30 * 24 * 60 * 60 * 1000);
        tx.update(investmentRef, {
          paidInterest: Number(((inv.paidInterest || 0) + monthlyInterest).toFixed(2)),
          monthsPaid: nextMonthsPaid,
          nextPayoutAt: isFinal ? admin.firestore.FieldValue.delete() : admin.firestore.Timestamp.fromDate(nextPayoutAtDate),
          status: isFinal ? 'completed' : 'active',
          completedAt: isFinal ? admin.firestore.FieldValue.serverTimestamp() : (inv.completedAt || null)
        });

        const txRef = userRef.collection('transactions').doc();
        tx.set(txRef, {
          type: 'credit',
          amount: creditAmount,
          comment: isFinal ? 'Partner Investment Maturity' : 'Partner Investment Interest',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          transactionId: `PARTNER-${investmentId}-${nextMonthsPaid}`,
          status: 'completed',
          isAdminTransaction: true,
          senderName: 'Reviews World',
          recipientName: inv.userName || 'User',
          recipientMobile: inv.userMobile || ''
        });
      });

      res.json({ ok: true });
    } catch (error) {
      console.error('Process partner interest failed:', error);
      res.status(500).json({ ok: false, error: 'INTEREST_PROCESS_FAILED', message: error.message });
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

  try {
    await initSchema(d1);
  } catch (error) {
    console.warn('Cloudflare D1 schema initialization failed (expected if local D1 is not configured):', error.message);
  }
  cleanupExpiredReadChats(d1).catch((error) => console.warn('Initial chat cleanup skipped:', error.message));
  cleanupExpiredNotifications(d1).catch((error) => console.warn('Initial notification cleanup skipped:', error.message));
  cleanupExpiredReservations(d1).catch((error) => console.warn('Initial reservation cleanup skipped:', error.message));
  const cleanupTimer = setInterval(() => {
    cleanupExpiredReadChats(d1).catch((error) => console.error('Scheduled chat cleanup failed:', error));
    cleanupExpiredNotifications(d1).catch((error) => console.error('Scheduled notification cleanup failed:', error));
    processAutoPayouts(d1).catch((error) => console.error('Scheduled auto-payout failed:', error));
    processPeriodicLiveChecksAndPayouts(d1).catch((error) => console.error('Scheduled periodic live checks payout failed:', error));
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
      processPeriodicLiveChecksAndPayouts(d1).catch(e => console.error('Scheduled periodic live checks failed:', e));
      setInterval(() => {
        processAutoPayouts(d1).catch(e => console.error('Daily auto-payout failed:', e));
        processPeriodicLiveChecksAndPayouts(d1).catch(e => console.error('Daily periodic live checks failed:', e));
      }, 24 * 60 * 60 * 1000).unref?.();
    }, delay).unref?.();
  };
  scheduleAutoPayoutAt8PM();

  processDailyLists(d1).catch((error) => console.warn('Initial daily list compilation skipped:', error.message));
  const dailyListTimer = setInterval(() => {
    processDailyLists(d1).catch((error) => console.error('Scheduled daily list compilation failed:', error));
  }, 15 * 60 * 1000);
  dailyListTimer.unref?.();

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
    processAutoPayouts: () => processAutoPayouts(d1),
    processPeriodicLiveChecksAndPayouts: () => processPeriodicLiveChecksAndPayouts(d1)
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
  processAutoPayouts,
  processPeriodicLiveChecksAndPayouts
};
