// File: backend/src/services/customDeepLinkService.js
const memoryStore = new Map();

function cleanupMemoryStore() {
  const now = Date.now();
  for (const [ip, data] of memoryStore.entries()) {
    if (now > data.expiresAt) {
      memoryStore.delete(ip);
    }
  }
}
setInterval(cleanupMemoryStore, 10 * 60 * 1000);

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
    const expiresAt = now + 3600 * 1000;

    memoryStore.set(ip, { referralCode: refCode, expiresAt });

    if (this.endpoint) {
      await this.initTable();
      await this.query(`DELETE FROM referral_fingerprints WHERE created_at < ?`, [now - 3600 * 1000]);
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

    if (this.endpoint) {
      await this.initTable();
      const res = await this.query(`SELECT referral_code, created_at FROM referral_fingerprints WHERE ip_address = ?`, [ip]);
      const row = res.results?.[0];

      if (row) {
        await this.query(`DELETE FROM referral_fingerprints WHERE ip_address = ?`, [ip]);
        if (now - row.created_at <= 3600 * 1000) {
          memoryStore.delete(ip);
          return row.referral_code;
        }
      }
    }

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
const { createLinkController } = require('../controllers/linkController');
const linkController = createLinkController(cfStore);

function registerDeepLinkRoutes(app) {
  app.get('/download', (req, res) => linkController.handleDownloadPage(req, res));
  app.get('/download-apk', (req, res) => linkController.handleApkDownload(req, res));
  app.post('/verify-referral', (req, res) => linkController.handleVerifyReferral(req, res));
}

module.exports = {
  cfStore,
  getClientIp: linkController.getClientIp,
  registerDeepLinkRoutes
};
