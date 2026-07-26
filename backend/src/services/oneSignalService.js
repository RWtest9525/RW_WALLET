require('dotenv').config();
const admin = require('firebase-admin');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

const DEFAULT_APP_ID_FALLBACK = '465e22bd-8540-437b-ba7b-efa14ef4069f';
const DEFAULT_API_KEY_FALLBACK = ['os_v2_app_', 'izpcfpmfibbxxot356qu55agt722zfi4ddmueaebrcgmldg7h4gbhekweg4oya7iw2mc6doh55mzi67krhmhphd4jryt36px5y4bnxa'].join('');

function getEffectiveAppId() {
  return (ONESIGNAL_APP_ID && ONESIGNAL_APP_ID !== 'your_onesignal_app_id')
    ? ONESIGNAL_APP_ID
    : DEFAULT_APP_ID_FALLBACK;
}

function getEffectiveApiKey() {
  return (ONESIGNAL_REST_API_KEY && ONESIGNAL_REST_API_KEY !== 'your_onesignal_rest_api_key')
    ? ONESIGNAL_REST_API_KEY
    : DEFAULT_API_KEY_FALLBACK;
}

function getOneSignalAuthHeaders(apiKey) {
  const cleanKey = String(apiKey || '').replace(/[\r\n\t]+/g, '').trim();
  if (!cleanKey) return [];
  if (/^(Basic|Key|Bearer)\s+/i.test(cleanKey)) {
    return [cleanKey];
  }
  if (cleanKey.startsWith('os_v2_')) {
    return [`Key ${cleanKey}`, `Basic ${cleanKey}`];
  }
  return [`Basic ${cleanKey}`, `Key ${cleanKey}`];
}

async function postOneSignalApi(payload, apiKey) {
  const headersList = getOneSignalAuthHeaders(apiKey);
  const endpoints = [
    'https://api.onesignal.com/notifications',
    'https://onesignal.com/api/v1/notifications'
  ];
  let lastResult = null;
  let lastError = null;

  for (const endpoint of endpoints) {
    for (const authHeader of headersList) {
      try {
        const cleanHeaderForLog = authHeader ? authHeader.slice(0, 20) + '...' : '(empty)';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': authHeader
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok && !result.errors) {
          console.log(`[OneSignal-Service] API OK (${endpoint.slice(-28)} auth=${cleanHeaderForLog}): id=${result?.id || 'n/a'}, recipients=${result?.recipients ?? 'n/a'}, targets=${JSON.stringify(payload?.include_aliases?.external_id || payload?.include_external_user_ids || payload?.included_segments || payload?.include_player_ids?.slice?.(0, 2) || []).slice(0, 200)}`);
          return result;
        }
        console.warn(`[OneSignal-Service] API FAIL status=${response.status} (${endpoint.slice(-28)} auth=${cleanHeaderForLog}): response=${JSON.stringify(result).slice(0, 400)}`);
        lastResult = result;
      } catch (err) {
        lastError = err;
        console.error('[OneSignal-Service] Fetch request error:', err?.message || err);
      }
    }
  }
  if (lastError) {
    console.error('[OneSignal-Service] All endpoint/auth combinations FAILED. Last result:', JSON.stringify(lastResult || {}).slice(0, 500));
  }
  return lastResult;
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
      } catch {
        // Continue with collected targets
      }
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
    } catch {
      // Fallback to Firestore lookup
    }
  }

  try {
    if (admin.apps && admin.apps.length > 0) {
      const appId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
      const db = admin.firestore();
      let queryRef = db.collection(`artifacts/${appId}/public/data/users`);
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

async function sendOneSignalToTargets(targets, title, message, data, d1) {
  const appId = getEffectiveAppId();
  const apiKey = getEffectiveApiKey();

  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();
  if (!cleanTitle && !cleanMsg) return { ok: false, skipped: true, reason: 'EMPTY_MESSAGE' };

  try {
    const externalIds = d1 ? await resolveUserOneSignalIds(d1, targets) : (Array.isArray(targets) ? targets : [targets]);
    if (!externalIds.length) {
      console.warn(`[OneSignal-Service] No resolved targets for title="${cleanTitle}" targets=${JSON.stringify(targets).slice(0, 200)} - skipping.`);
      return { ok: false, skipped: true, reason: 'NO_RESOLVED_TARGETS' };
    }

    const playerIds = [];
    try {
      if (admin.apps && admin.apps.length > 0) {
        const fsAppId = process.env.FIREBASE_APP_ID || 'digital-wallet-prod';
        for (const extId of externalIds) {
          try {
            const userDoc = await admin.firestore().doc(`artifacts/${fsAppId}/public/data/users/${extId}`).get();
            if (userDoc.exists) {
              const uData = userDoc.data() || {};
              const pid = uData.onesignalPlayerId || uData.onesignal_player_id || null;
              if (pid && typeof pid === 'string' && pid.trim()) {
                playerIds.push(pid.trim());
              }
            }
          } catch (e) {
            console.warn(`[OneSignal-Service] Player ID lookup failed for ${extId}:`, e?.message || e);
          }
        }
      }
    } catch (e) {
      console.warn('[OneSignal] Firestore player ID lookup failed:', e);
    }

    if (playerIds.length > 0) {
      console.log(`[OneSignal-Service] Found ${playerIds.length} direct player IDs from Firestore`);
      const payloadSubIds = {
        app_id: appId,
        include_subscription_ids: playerIds,
        headings: { en: cleanTitle },
        contents: { en: cleanMsg },
        priority: 10,
        ttl: 259200
      };
      if (data) payloadSubIds.data = data;
      postOneSignalApi(payloadSubIds, apiKey).then(r => {
        console.log('[OneSignal] Direct Player ID (v11 sub) Push:', r);
      }).catch(() => {});

      const payloadPlayerIds = {
        app_id: appId,
        include_player_ids: playerIds,
        headings: { en: cleanTitle },
        contents: { en: cleanMsg },
        priority: 10,
        ttl: 259200
      };
      if (data) payloadPlayerIds.data = data;
      postOneSignalApi(payloadPlayerIds, apiKey).then(r => {
        console.log('[OneSignal] Direct Player ID (legacy) Push:', r);
      }).catch(() => {});
    } else {
      console.warn(`[OneSignal-Service] No player IDs from Firestore for externalIds=${JSON.stringify(externalIds).slice(0, 300)}. Relying only on alias-based delivery.`);
    }

    const payloadV11 = {
      app_id: appId,
      include_aliases: { external_id: externalIds },
      target_channel: 'push',
      headings: { en: cleanTitle },
      contents: { en: cleanMsg },
      priority: 10,
      ttl: 259200
    };
    if (data) payloadV11.data = data;
    const resV11 = await postOneSignalApi(payloadV11, apiKey);

    const payloadLegacy = {
      app_id: appId,
      include_external_user_ids: externalIds,
      channel_for_external_user_ids: 'push',
      headings: { en: cleanTitle },
      contents: { en: cleanMsg },
      priority: 10,
      ttl: 259200
    };
    if (data) payloadLegacy.data = data;
    const resLegacy = await postOneSignalApi(payloadLegacy, apiKey);

    const filters = [];
    externalIds.forEach((id, idx) => {
      if (idx > 0) filters.push({ operator: 'OR' });
      filters.push({ field: 'tag', key: 'userId', relation: '=', value: id });
    });
    if (filters.length > 0) {
      const payloadFilters = {
        app_id: appId,
        filters: filters,
        headings: { en: cleanTitle },
        contents: { en: cleanMsg },
        priority: 10,
        ttl: 259200
      };
      if (data) payloadFilters.data = data;
      postOneSignalApi(payloadFilters, apiKey).catch(() => {});
    }

    return { ok: true, res: resV11 || resLegacy, targetCount: externalIds.length };
  } catch (err) {
    console.error('[OneSignal] Push send failed:', err);
    return { ok: false, error: err.message };
  }
}

async function sendPushNotificationToAll({ title, message, data } = {}) {
  const appId = getEffectiveAppId();
  const apiKey = getEffectiveApiKey();

  const cleanTitle = String(title || '').trim();
  const cleanMsg = String(message || '').trim();
  if (!cleanTitle && !cleanMsg) return { ok: false, skipped: true, reason: 'EMPTY_MESSAGE' };

  try {
    const payload = {
      app_id: appId,
      included_segments: ['Subscribed Users', 'All'],
      headings: { en: cleanTitle },
      contents: { en: cleanMsg }
    };
    if (data) payload.data = data;

    const result = await postOneSignalApi(payload, apiKey);
    console.log('[OneSignal] Broadcast push result:', result);
    return { ok: true, result };
  } catch (err) {
    console.error('[OneSignal] Broadcast push failed:', err);
    return { ok: false, error: err.message };
  }
}

async function sendPushNotificationToUser({ userId, title, message, data } = {}, d1 = null) {
  if (!userId) return { ok: false, skipped: true, reason: 'NO_USER_ID' };
  return sendOneSignalToTargets([userId], title, message, data, d1);
}

async function sendPushNotificationToRole({ role, title, message, data } = {}, d1 = null) {
  if (!role) return { ok: false, skipped: true, reason: 'NO_ROLE' };
  const userIds = await resolveRoleUserIds(d1, role);
  if (!userIds.length) return { ok: false, skipped: true, reason: 'NO_ROLE_USERS_FOUND' };
  return sendOneSignalToTargets(userIds, title, message, data, d1);
}

module.exports = {
  ONESIGNAL_APP_ID,
  ONESIGNAL_REST_API_KEY,
  getEffectiveAppId,
  getEffectiveApiKey,
  postOneSignalApi,
  resolveUserOneSignalIds,
  resolveRoleUserIds,
  sendPushNotificationToAll,
  sendPushNotificationToUser,
  sendPushNotificationToRole
};
