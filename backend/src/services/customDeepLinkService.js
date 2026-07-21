/**
 * Custom Deferred Deep Linking System (Cloudflare D1 / Cloudflare KV & In-Memory Store)
 * NO MongoDB required! Uses Cloudflare D1 REST API with 1-hour expiration.
 */

const path = require('path');

// In-memory cache fallback (guarantees fast zero-config operation)
const memoryStore = new Map();

// Helper to cleanup expired records (1 hour = 3600000 ms)
function cleanupMemoryStore() {
  const now = Date.now();
  for (const [ip, data] of memoryStore.entries()) {
    if (now > data.expiresAt) {
      memoryStore.delete(ip);
    }
  }
}
setInterval(cleanupMemoryStore, 10 * 60 * 1000); // Run cleanup every 10 mins

/**
 * Cloudflare D1 Client Helper
 */
class CloudflareD1DeepLinkStore {
  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.endpoint = this.accountId && this.databaseId && this.apiToken
      ? `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`
      : null;
    this.initialized = false;
  }

  async query(sql, params = []) {
    if (!this.endpoint) return null;
    try {
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
        console.warn('Cloudflare D1 query warning:', payload?.errors?.[0]?.message || response.statusText);
        return null;
      }
      return payload.result?.[0] || {};
    } catch (err) {
      console.warn('Cloudflare D1 connection error:', err.message);
      return null;
    }
  }

  async initTable() {
    if (this.initialized || !this.endpoint) return;
    await this.query(`
      CREATE TABLE IF NOT EXISTS referral_fingerprints (
        ip_address TEXT PRIMARY KEY,
        referral_code TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    this.initialized = true;
  }

  async saveReferral(ip, refCode) {
    const now = Date.now();
    const expiresAt = now + 3600 * 1000; // 1 hour expiration

    // 1. Save in Memory Store
    memoryStore.set(ip, { referralCode: refCode, expiresAt });

    // 2. Save in Cloudflare D1 if configured
    if (this.endpoint) {
      await this.initTable();
      // Purge expired records
      await this.query(`DELETE FROM referral_fingerprints WHERE created_at < ?`, [now - 3600 * 1000]);
      // Insert or replace IP referral mapping
      await this.query(`
        INSERT INTO referral_fingerprints (ip_address, referral_code, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(ip_address) DO UPDATE SET
          referral_code = excluded.referral_code,
          created_at = excluded.created_at;
      `, [ip, refCode, now]);
    }
  }

  async getAndDeleteReferral(ip) {
    const now = Date.now();

    // 1. Check Cloudflare D1
    if (this.endpoint) {
      await this.initTable();
      const res = await this.query(`SELECT referral_code, created_at FROM referral_fingerprints WHERE ip_address = ?`, [ip]);
      const row = res.results?.[0];

      if (row) {
        // Delete record atomically from Cloudflare D1
        await this.query(`DELETE FROM referral_fingerprints WHERE ip_address = ?`, [ip]);

        // Verify TTL (1 hour = 3600000 ms)
        if (now - row.created_at <= 3600 * 1000) {
          memoryStore.delete(ip);
          return row.referral_code;
        }
      }
    }

    // 2. Check Memory Store Fallback
    const cached = memoryStore.get(ip);
    if (cached) {
      memoryStore.delete(ip);
      if (now <= cached.expiresAt) {
        return cached.referralCode;
      }
    }

    return null;
  }
}

const cfStore = new CloudflareD1DeepLinkStore();

/**
 * Helper to extract true client IP from Render / Cloudflare headers
 */
function getClientIp(req) {
  const trueClientIp = req.headers['true-client-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  const xForwardedFor = req.headers['x-forwarded-for'];

  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  if (trueClientIp) {
    return trueClientIp.trim();
  }
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Register Express Endpoints
 */
function registerDeepLinkRoutes(app) {
  // GET /download?ref=RW12345
  app.get('/download', async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      const refCode = req.query.ref;

      console.log(`[GET /download] Request from IP: ${clientIp}, Ref: ${refCode || 'None'}`);

      if (refCode) {
        await cfStore.saveReferral(clientIp, refCode.trim());
        console.log(`[Cloudflare DeepLink] Saved IP ${clientIp} -> Ref ${refCode}`);
      }

      // Serve /public/files/app.apk
      const apkPath = path.join(__dirname, '..', '..', '..', 'public', 'files', 'app.apk');
      res.download(apkPath, 'app.apk', (err) => {
        if (err && !res.headersSent) {
          console.error('[GET /download] Download error:', err.message);
          res.status(404).send('APK file not found on server.');
        }
      });
    } catch (error) {
      console.error('Error in /download:', error);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Internal Server Error' });
      }
    }
  });

  // POST /verify-referral
  app.post('/verify-referral', async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      console.log(`[POST /verify-referral] Verifying IP: ${clientIp}`);

      const refCode = await cfStore.getAndDeleteReferral(clientIp);

      if (refCode) {
        console.log(`[Cloudflare DeepLink] Matched referral code for IP ${clientIp}: ${refCode}`);
        return res.json({
          success: true,
          referralCode: refCode
        });
      }

      console.log(`[Cloudflare DeepLink] No active referral code found for IP: ${clientIp}`);
      return res.json({
        success: false,
        referralCode: null
      });
    } catch (error) {
      console.error('Error in /verify-referral:', error);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });
}

module.exports = {
  getClientIp,
  registerDeepLinkRoutes
};
