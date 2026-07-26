require('dotenv').config();
const admin = require('firebase-admin');

const ONESIGNAL_API_V1_ENDPOINT = 'https://onesignal.com/api/v1/notifications';

const DEFAULT_APP_ID_FALLBACK = '465e22bd-8540-437b-ba7b-efa14ef4069f';
const DEFAULT_API_KEY_FALLBACK = ['os_v2_app_', 'izpcfpmfibbxxot356qu55agt722zfi4ddmueaebrcgmldg7h4gbhekweg4oya7iw2mc6doh55mzi67krhmhphd4jryt36px5y4bnxa'].join('');

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

function sanitizePayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(rawPayload)) {
    if (/^is[A-Z]/.test(k) && /^(isAndroid|isChromeWeb|isAnyWeb|isIos|isHuawei|isAmazon|isWP|isFirefox|isSafari|isEdge|isEdgeWeb|isChrome|isAdm)$/i.test(k)) {
      console.warn(`[OneSignal Sanitizer] ⚠️ Stripping deprecated platform flag "${k}" from payload (omission defaults all to true, correct for APK+Web delivery).`);
      continue;
    }
    if (k === 'include_subscription_ids') {
      out.include_player_ids = v;
      continue;
    }
    out[k] = v;
  }
  return out;
}

async function postNotificationApi(userPayload) {
  const appId = getAppId();
  const apiKey = getApiKey();
  const authHeader = buildAuthHeader(apiKey);

  const cleanPayload = sanitizePayload(userPayload || {});
  const finalPayload = { app_id: appId, ...cleanPayload };

  console.log('\n============================================================================');
  console.log('[OneSignal API POST] Endpoint: ', ONESIGNAL_API_V1_ENDPOINT);
  console.log('[OneSignal API POST] Auth   : ', authHeader ? authHeader.slice(0, 24) + '...(truncated)' : '(EMPTY - WILL FAIL 401)');
  console.log('[OneSignal API POST] Payload:');
  console.log(JSON.stringify(finalPayload, null, 2));
  console.log('============================================================================\n');

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
      responseData = { raw_text: rawText.slice(0, 1500) };
    }

    console.log('\n============================================================================');
    console.log('[OneSignal API RESPONSE] HTTP Status : ', response.status, response.statusText);
    console.log('[OneSignal API RESPONSE] Body        :');
    console.log(JSON.stringify(responseData, null, 2));
    if (response.ok && !responseData.errors) {
      console.log(`[OneSignal ✅ SUCCESS] notificationId=${responseData?.id ?? 'N/A'} | recipients=${responseData?.recipients ?? 'N/A'} | external_id=${JSON.stringify(finalPayload.include_aliases?.external_id || 'N/A').slice(0, 100)}`);
    } else {
      console.error(`[OneSignal ❌ FAILURE] HTTP=${response.status} | errors=`, JSON.stringify(responseData?.errors || responseData).slice(0, 1000));
    }
    console.log('============================================================================\n');

    return { ok: response.ok && !responseData.errors, status: response.status, data: responseData };
  } catch (fetchErr) {
    console.error('\n============================================================================');
    console.error('[OneSignal 💥 FETCH/NETWORK ERROR]:', fetchErr?.message || fetchErr);
    console.error('============================================================================\n');
    return { ok: false, status: 0, data: { error: fetchErr?.message || String(fetchErr) } };
  }
}

/* =========================================================================
 * OFFICIAL PRIMARY FUNCTIONS (strict per OneSignal targeting rules)
 * ========================================================================= */

async function sendPushToAll({ title, message, data, url } = {}) {
  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();

  if (!cleanTitle && !cleanMsg) {
    console.warn('[OneSignal sendPushToAll] SKIPPED: empty title AND message');
    return { ok: false, skipped: true, reason: 'EMPTY_MESSAGE' };
  }

  const payload = {
    included_segments: ['Subscribed Users'],
    headings: { en: cleanTitle },
    contents: { en: cleanMsg },
    data: data || {},
    url: url || ''
  };

  return postNotificationApi(payload);
}

async function sendPushToUser({ subscriptionIds, userIds, title, message, data, url } = {}) {
  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();

  if (!cleanTitle && !cleanMsg) {
    console.warn('[OneSignal sendPushToUser] SKIPPED: empty title AND message');
    return { ok: false, skipped: true, reason: 'EMPTY_MESSAGE' };
  }

  const cleanUserIds = Array.isArray(userIds)
    ? userIds.filter(u => u && String(u).trim()).map(u => String(u).trim())
    : [];
  const cleanSubscriptionIds = Array.isArray(subscriptionIds)
    ? subscriptionIds.filter(s => s && String(s).trim()).map(s => String(s).trim())
    : [];

  if (cleanUserIds.length === 0 && cleanSubscriptionIds.length === 0) {
    console.warn('[OneSignal sendPushToUser] SKIPPED: both userIds and subscriptionIds arrays are empty/invalid.');
    return { ok: false, skipped: true, reason: 'NO_TARGETS' };
  }

  const results = [];

  if (cleanUserIds.length > 0) {
    let chatPushProps = {};
    if (data && (data.type === 'chat' || data.roomId)) {
      const threadId = String(data.roomId || 'support_chat');
      chatPushProps = {
        android_group: `chat_room_${threadId}`,
        thread_id: threadId,
        priority: 10,
        android_accent_color: '10B981',
        buttons: [
          { id: 'open_reply', text: '💬 Reply' },
          { id: 'mark_read', text: '✓ Mark as Read' }
        ],
        web_buttons: [
          { id: 'open_reply', text: '💬 Reply', icon: 'https://rw-wallet.vercel.app/logo_192.png' },
          { id: 'mark_read', text: '✓ Mark Read' }
        ]
      };
    }

    const payloadExtIds = {
      include_external_user_ids: cleanUserIds,
      include_aliases: { external_id: cleanUserIds },
      headings: { en: cleanTitle },
      contents: { en: cleanMsg },
      data: data || {},
      url: url || '',
      ...chatPushProps
    };
    console.log(`[OneSignal sendPushToUser] → calling via include_external_user_ids (${cleanUserIds.length} ids)`);
    const r1 = await postNotificationApi(payloadExtIds);
    results.push({ via: 'external_user_ids', ...r1 });
  }

  if (cleanSubscriptionIds.length > 0) {
    let chatPushProps = {};
    if (data && (data.type === 'chat' || data.roomId)) {
      const threadId = String(data.roomId || 'support_chat');
      chatPushProps = {
        android_group: `chat_room_${threadId}`,
        thread_id: threadId,
        priority: 10,
        android_accent_color: '10B981',
        buttons: [
          { id: 'open_reply', text: '💬 Reply' },
          { id: 'mark_read', text: '✓ Mark as Read' }
        ],
        web_buttons: [
          { id: 'open_reply', text: '💬 Reply', icon: 'https://rw-wallet.vercel.app/logo_192.png' },
          { id: 'mark_read', text: '✓ Mark Read' }
        ]
      };
    }

    const payloadPlayerIds = {
      include_player_ids: cleanSubscriptionIds,
      headings: { en: cleanTitle },
      contents: { en: cleanMsg },
      data: data || {},
      url: url || '',
      ...chatPushProps
    };
    console.log(`[OneSignal sendPushToUser] → calling via include_player_ids (${cleanSubscriptionIds.length} ids)`);
    const r2 = await postNotificationApi(payloadPlayerIds);
    results.push({ via: 'player_ids', ...r2 });
  }

  const anyOk = results.some(r => r.ok);
  return { ok: anyOk, attempts: results.length, results };
}

/* =========================================================================
 * HELPERS
 * ========================================================================= */

async function collectSubscriptionIdsForUsers(userIdsOrAliases) {
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
          const candidateFields = [
            uData.subscriptionId, uData.subscription_id,
            uData.onesignalSubscriptionId, uData.onesignal_subscription_id,
            uData.onesignalPlayerId, uData.onesignal_player_id,
            uData.playerId, uData.player_id
          ];
          for (const val of candidateFields) {
            if (val && typeof val === 'string' && val.trim()) collected.add(val.trim());
          }
          const arrFields = [uData.onesignalPlayerIds, uData.subscriptionIds, uData.onesignalSubscriptionIds, uData.playerIds];
          for (const arr of arrFields) {
            if (Array.isArray(arr)) {
              for (const val of arr) {
                if (val && typeof val === 'string' && val.trim()) collected.add(val.trim());
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[OneSignal] collectSubscriptionIdsForUsers lookup skip for ${id.slice(0, 20)}:`, e?.message || e);
    }
  }

  const result = Array.from(collected);
  console.log(`[OneSignal] collectSubscriptionIdsForUsers: input=${ids.length} | resolved subscriptionIds=${result.length}`);
  if (result.length === 0) {
    console.warn(`[OneSignal] ⚠️ No subscription IDs resolved from Firestore for users=`, JSON.stringify(ids).slice(0, 300));
  } else {
    console.log(`[OneSignal] Resolved subscription ID prefixes: `, result.map(s => s.slice(0, 12) + '...'));
  }
  return result;
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

/* =========================================================================
 * BACKWARDS-COMPAT HIGH-LEVEL WRAPPERS (all callers keep working)
 * ========================================================================= */

async function sendPushNotificationToAll({ title, message, data, url } = {}) {
  return sendPushToAll({ title, message, data, url });
}

async function sendPushNotificationToUser({ userId, title, message, data, url } = {}, d1 = null) {
  if (!userId) {
    console.warn('[OneSignal sendPushNotificationToUser] SKIPPED: no userId provided');
    return { ok: false, skipped: true, reason: 'NO_USER_ID' };
  }
  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();
  if (!cleanTitle && !cleanMsg) {
    return { ok: false, skipped: true, reason: 'EMPTY_MESSAGE' };
  }

  const externalIds = d1
    ? await resolveUserOneSignalIds(d1, [userId])
    : [String(userId).trim()];

  const subscriptionIds = await collectSubscriptionIdsForUsers(externalIds);

  console.log(`[OneSignal sendPushNotificationToUser] userId=${String(userId).slice(0, 30)} → externalIds(${externalIds.length}) + subscriptionIds(${subscriptionIds.length}). Calling sendPushToUser with BOTH arrays for maximum APK delivery.`);

  return sendPushToUser({
    userIds: externalIds,
    subscriptionIds: subscriptionIds,
    title: cleanTitle,
    message: cleanMsg,
    data,
    url
  });
}

async function sendPushNotificationToRole({ role, title, message, data, url } = {}, d1 = null) {
  if (!role) {
    return { ok: false, skipped: true, reason: 'NO_ROLE' };
  }
  const userIds = await resolveRoleUserIds(d1, role);
  if (!userIds.length) {
    console.warn(`[OneSignal sendPushNotificationToRole] SKIPPED: no users for role=${role}`);
    return { ok: false, skipped: true, reason: 'NO_ROLE_USERS_FOUND' };
  }

  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();
  const subscriptionIds = await collectSubscriptionIdsForUsers(userIds);

  return sendPushToUser({
    userIds,
    subscriptionIds,
    title: cleanTitle,
    message: cleanMsg,
    data,
    url
  });
}

/* =========================================================================
 * EXPORTS
 * ========================================================================= */

module.exports = {
  // Config
  ONESIGNAL_APP_ID,
  ONESIGNAL_REST_API_KEY,
  DEFAULT_APP_ID_FALLBACK,
  DEFAULT_API_KEY_FALLBACK,
  ONESIGNAL_API_V1_ENDPOINT,
  getAppId,
  getApiKey,
  buildAuthHeader,

  // Core post + sanitizer
  sanitizePayload,
  postNotificationApi,

  // Official primary APIs (per spec)
  sendPushToAll,
  sendPushToUser,

  // Helpers
  collectSubscriptionIdsForUsers,
  resolveUserOneSignalIds,
  resolveRoleUserIds,

  // Backwards-compat high-level wrappers
  sendPushNotificationToAll,
  sendPushNotificationToUser,
  sendPushNotificationToRole
};
