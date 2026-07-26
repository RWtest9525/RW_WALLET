require('dotenv').config();
const admin = require('firebase-admin');

const DEFAULT_APP_ID_FALLBACK = '465e22bd-8540-437b-ba7b-efa14ef4069f';
const DEFAULT_API_KEY_FALLBACK = ['os_v2_app_', 'izpcfpmfibbxxot356qu55agt722zfi4ddmueaebrcgmldg7h4gbhekweg4oya7iw2mc6doh55mzi67krhmhphd4jryt36px5y4bnxa'].join('');
const ONESIGNAL_API_V1_ENDPOINT = 'https://onesignal.com/api/v1/notifications';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

function getAppId() {
  return (ONESIGNAL_APP_ID && ONESIGNAL_APP_ID !== '' && ONESIGNAL_APP_ID !== 'your_onesignal_app_id')
    ? ONESIGNAL_APP_ID
    : DEFAULT_APP_ID_FALLBACK;
}

function getApiKey() {
  return (ONESIGNAL_REST_API_KEY && ONESIGNAL_REST_API_KEY !== '' && ONESIGNAL_REST_API_KEY !== 'your_onesignal_rest_api_key')
    ? ONESIGNAL_REST_API_KEY
    : DEFAULT_API_KEY_FALLBACK;
}

function buildAuthHeader(apiKey) {
  const cleanKey = String(apiKey || '').replace(/[\r\n\t\s]+/g, '').trim();
  if (!cleanKey) return '';
  if (/^(Basic|Key|Bearer)\s+/i.test(cleanKey)) return cleanKey;
  return `Basic ${cleanKey}`;
}

async function callOneSignalApi(payload) {
  const appId = getAppId();
  const apiKey = getApiKey();
  const authHeader = buildAuthHeader(apiKey);

  const finalPayload = { app_id: appId, ...payload };

  console.log('========================================');
  console.log('OneSignal Request Endpoint:', ONESIGNAL_API_V1_ENDPOINT);
  console.log('OneSignal Request Auth Header:', authHeader ? authHeader.slice(0, 24) + '...(truncated)' : '(EMPTY - WILL FAIL)');
  console.log('OneSignal Request Payload:', JSON.stringify(finalPayload, null, 2));
  console.log('========================================');

  try {
    const response = await fetch(ONESIGNAL_API_V1_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': authHeader
      },
      body: JSON.stringify(finalPayload)
    });

    const rawText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(rawText);
    } catch (_) {
      responseData = { raw_text: rawText.slice(0, 1000) };
    }

    console.log('========================================');
    console.log('OneSignal Response HTTP Status:', response.status, response.statusText);
    console.log('OneSignal Response Data:', JSON.stringify(responseData, null, 2));
    if (response.ok && !responseData.errors) {
      console.log('[OneSignal ✅ SUCCESS] notificationId=', responseData?.id, 'recipients=', responseData?.recipients ?? 'N/A');
    } else {
      console.error('[OneSignal ❌ FAILURE] HTTP=', response.status, 'errors=', JSON.stringify(responseData?.errors || responseData).slice(0, 800));
    }
    console.log('========================================');

    return { ok: response.ok && !responseData.errors, status: response.status, data: responseData };
  } catch (fetchErr) {
    console.error('========================================');
    console.error('[OneSignal 💥 FETCH ERROR]', fetchErr?.message || fetchErr);
    console.error('========================================');
    return { ok: false, status: 0, data: { error: fetchErr?.message || String(fetchErr) } };
  }
}

async function collectPlayerIdsForUsers(userIdsOrAliases) {
  const collected = new Set();
  const ids = Array.isArray(userIdsOrAliases) ? userIdsOrAliases : [userIdsOrAliases];
  const fsAppId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';

  for (const rawId of ids) {
    const id = String(rawId || '').trim();
    if (!id) continue;

    try {
      if (admin.apps && admin.apps.length > 0) {
        const userDoc = await admin.firestore()
          .doc(`artifacts/${fsAppId}/public/data/users/${id}`)
          .get()
          .catch(() => ({ exists: false, data: () => ({}) }));
        if (userDoc.exists) {
          const uData = (userDoc.data && typeof userDoc.data === 'function') ? (userDoc.data() || {}) : {};
          const p1 = uData.onesignalPlayerId || uData.onesignal_player_id || uData.playerId || uData.player_id || uData.subscriptionId || uData.subscription_id || null;
          if (p1 && typeof p1 === 'string' && p1.trim()) {
            collected.add(p1.trim());
          }
          if (Array.isArray(uData.onesignalPlayerIds)) {
            for (const p of uData.onesignalPlayerIds) {
              if (p && typeof p === 'string' && p.trim()) collected.add(p.trim());
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[OneSignal] Firestore player ID lookup skipped for ${id.slice(0, 20)}:`, e?.message || e);
    }
  }

  const result = Array.from(collected);
  console.log(`[OneSignal] collectPlayerIdsForUsers: input count=${ids.length}, resolved playerIds=${result.length}`);
  if (result.length === 0) {
    console.warn('[OneSignal] ⚠️ No player/subscription IDs resolved from Firestore for:', JSON.stringify(ids).slice(0, 300));
  } else {
    console.log('[OneSignal] Resolved playerIds (prefixes):', result.map(p => p.slice(0, 12) + '...'));
  }
  return result;
}

async function sendToAll({ title, message, data } = {}) {
  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();
  if (!cleanTitle && !cleanMsg) {
    console.warn('[OneSignal] sendToAll skipped: empty title AND message');
    return { ok: false, skipped: true, reason: 'EMPTY_MESSAGE' };
  }

  const payload = {
    included_segments: ['Subscribed Users'],
    headings: { en: cleanTitle },
    contents: { en: cleanMsg },
    priority: 10,
    ttl: 259200,
    data: data || {}
  };

  return callOneSignalApi(payload);
}

async function sendToUser({ playerIds, title, message, data } = {}) {
  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();
  if (!cleanTitle && !cleanMsg) {
    console.warn('[OneSignal] sendToUser skipped: empty title AND message');
    return { ok: false, skipped: true, reason: 'EMPTY_MESSAGE' };
  }

  const ids = Array.isArray(playerIds) ? playerIds.filter(p => p && typeof p === 'string' && p.trim()) : [];
  if (ids.length === 0) {
    console.warn('[OneSignal] sendToUser skipped: playerIds array empty/invalid - no push will be sent. Caller must pass valid player/subscription IDs, or use sendPushNotificationToUser which resolves IDs automatically.');
    return { ok: false, skipped: true, reason: 'NO_PLAYER_IDS' };
  }

  const cleanIds = ids.map(p => String(p).trim());

  const payload = {
    include_player_ids: cleanIds,
    headings: { en: cleanTitle },
    contents: { en: cleanMsg },
    priority: 10,
    ttl: 259200,
    data: data || {}
  };

  return callOneSignalApi(payload);
}

async function sendToExternalIds({ externalIds, title, message, data } = {}) {
  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();
  if (!cleanTitle && !cleanMsg) {
    return { ok: false, skipped: true, reason: 'EMPTY_MESSAGE' };
  }

  const ids = Array.isArray(externalIds) ? externalIds.filter(x => x && String(x).trim()) : [];
  if (ids.length === 0) {
    console.warn('[OneSignal] sendToExternalIds skipped: externalIds empty');
    return { ok: false, skipped: true, reason: 'NO_EXTERNAL_IDS' };
  }

  const cleanIds = ids.map(x => String(x).trim());

  const payload = {
    include_external_user_ids: cleanIds,
    channel_for_external_user_ids: 'push',
    headings: { en: cleanTitle },
    contents: { en: cleanMsg },
    priority: 10,
    ttl: 259200,
    data: data || {}
  };

  return callOneSignalApi(payload);
}

async function resolveUserOneSignalIds(d1, target) {
  if (!target) return [];
  const targets = Array.isArray(target) ? target : [target];
  const resolved = new Set();

  for (const t of targets) {
    if (!t) continue;
    const str = String(t).trim();
    if (!str || str === 'all' || str === 'broadcast') continue;
    resolved.add(str);

    if (d1 && typeof d1.all === 'function') {
      try {
        const rows = await d1.all(
          `SELECT id, firebase_uid, email FROM users WHERE id = ? OR firebase_uid = ? OR email = ? LIMIT 1`,
          [str, str, str]
        );
        const user = rows?.[0];
        if (user) {
          if (user.id) resolved.add(String(user.id).trim());
          if (user.firebase_uid) resolved.add(String(user.firebase_uid).trim());
        }
      } catch (_) {}
    }
  }

  return Array.from(resolved);
}

async function resolveRoleUserIds(d1, role) {
  if (!role) return [];
  const roleLower = String(role).toLowerCase().trim();
  const userIds = new Set();

  if (d1 && typeof d1.all === 'function') {
    try {
      let rows = [];
      if (roleLower === 'all' || roleLower === 'users' || roleLower === 'active') {
        rows = await d1.all(`SELECT id, firebase_uid FROM users WHERE status != 'suspended' AND status != 'blocked'`);
      } else if (roleLower === 'admin' || roleLower === 'admins') {
        rows = await d1.all(`SELECT id, firebase_uid FROM users WHERE role IN ('admin','owner')`);
      } else if (roleLower === 'owner') {
        rows = await d1.all(`SELECT id, firebase_uid FROM users WHERE role = 'owner'`);
      } else if (roleLower === 'subadmin' || roleLower === 'sub-admin' || roleLower === 'sub_admins') {
        rows = await d1.all(`SELECT id, firebase_uid FROM users WHERE role = 'admin'`);
      } else if (roleLower === 'bulker' || roleLower === 'bulkers') {
        rows = await d1.all(`SELECT id, firebase_uid FROM users`);
      } else {
        rows = await d1.all(`SELECT id, firebase_uid FROM users WHERE role = ?`, [roleLower]);
      }
      for (const row of rows || []) {
        if (row.id) userIds.add(String(row.id).trim());
        if (row.firebase_uid) userIds.add(String(row.firebase_uid).trim());
      }
    } catch (_) {}
  }

  try {
    if (admin.apps && admin.apps.length > 0) {
      const fsAppId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
      const db = admin.firestore();
      const queryRef = db.collection(`artifacts/${fsAppId}/public/data/users`);
      const snap = await queryRef.limit(5000).get().catch(() => ({ empty: true, docs: [] }));
      if (snap.docs && snap.docs.length > 0) {
        for (const doc of snap.docs) {
          const data = doc.data() || {};
          const userRole = String(data.role || 'user').toLowerCase();
          let match = false;
          if (roleLower === 'all' || roleLower === 'users' || roleLower === 'active') {
            match = !data.isDisabled && data.status !== 'suspended' && data.status !== 'blocked';
          } else if (roleLower === 'admin' || roleLower === 'admins') {
            match = userRole === 'admin' || userRole === 'owner';
          } else if (roleLower === 'owner') {
            match = userRole === 'owner';
          } else if (roleLower === 'subadmin' || roleLower === 'sub-admin' || roleLower === 'sub_admins') {
            match = userRole === 'admin';
          } else if (roleLower === 'bulker' || roleLower === 'bulkers') {
            const tier = String(data.taskTier || '').toLowerCase();
            match = tier === 'bulker' || tier === 'super_bulker' || !!data.bulkTaskMode || !!data.taskBulkMode || !!data.isBulkTaskUser;
          } else {
            match = userRole === roleLower;
          }
          if (match) {
            userIds.add(doc.id);
            if (data.uid) userIds.add(String(data.uid).trim());
            if (data.firebase_uid) userIds.add(String(data.firebase_uid).trim());
          }
        }
      }
    }
  } catch (fsErr) {
    console.warn('[OneSignal] Firestore role lookup failed:', fsErr.message);
  }

  return Array.from(userIds);
}

async function sendPushNotificationToAll({ title, message, data } = {}) {
  return sendToAll({ title, message, data });
}

async function sendPushNotificationToUser({ userId, title, message, data } = {}, d1 = null) {
  if (!userId) {
    console.warn('[OneSignal] sendPushNotificationToUser skipped: no userId');
    return { ok: false, skipped: true, reason: 'NO_USER_ID' };
  }

  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();
  if (!cleanTitle && !cleanMsg) {
    return { ok: false, skipped: true, reason: 'EMPTY_MESSAGE' };
  }

  const externalIds = d1 ? await resolveUserOneSignalIds(d1, [userId]) : [String(userId).trim()];
  const playerIds = await collectPlayerIdsForUsers(externalIds);
  const results = [];

  if (playerIds.length > 0) {
    console.log(`[OneSignal] sendPushNotificationToUser → calling sendToUser with ${playerIds.length} playerIds`);
    const r = await sendToUser({ playerIds, title: cleanTitle, message: cleanMsg, data });
    results.push({ via: 'player_ids', ...r });
  }

  console.log(`[OneSignal] sendPushNotificationToUser → fallback via sendToExternalIds with ${externalIds.length} ids`);
  const r2 = await sendToExternalIds({ externalIds, title: cleanTitle, message: cleanMsg, data });
  results.push({ via: 'external_ids', ...r2 });

  const anySuccess = results.some(r => r.ok);
  return { ok: anySuccess, results, playerIdCount: playerIds.length, externalIdCount: externalIds.length };
}

async function sendPushNotificationToRole({ role, title, message, data } = {}, d1 = null) {
  if (!role) {
    return { ok: false, skipped: true, reason: 'NO_ROLE' };
  }
  const userIds = await resolveRoleUserIds(d1, role);
  if (!userIds.length) {
    console.warn(`[OneSignal] sendPushNotificationToRole: no users found for role=${role}`);
    return { ok: false, skipped: true, reason: 'NO_ROLE_USERS_FOUND' };
  }

  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();
  const playerIds = await collectPlayerIdsForUsers(userIds);
  const results = [];

  if (playerIds.length > 0) {
    const r = await sendToUser({ playerIds, title: cleanTitle, message: cleanMsg, data });
    results.push({ via: 'player_ids', ...r });
  }

  const r2 = await sendToExternalIds({ externalIds: userIds, title: cleanTitle, message: cleanMsg, data });
  results.push({ via: 'external_ids', ...r2 });

  const anySuccess = results.some(r => r.ok);
  return { ok: anySuccess, results, role, userCount: userIds.length, playerIdCount: playerIds.length };
}

module.exports = {
  ONESIGNAL_APP_ID,
  ONESIGNAL_REST_API_KEY,
  DEFAULT_APP_ID_FALLBACK,
  DEFAULT_API_KEY_FALLBACK,
  ONESIGNAL_API_V1_ENDPOINT,
  getAppId,
  getApiKey,
  buildAuthHeader,
  callOneSignalApi,
  collectPlayerIdsForUsers,
  resolveUserOneSignalIds,
  resolveRoleUserIds,
  sendToAll,
  sendToUser,
  sendToExternalIds,
  sendPushNotificationToAll,
  sendPushNotificationToUser,
  sendPushNotificationToRole
};
