# RW Wallet Cloudflare Backend Helper

This helper is isolated from the existing wallet frontend. It adds:

- Cloudflare D1 tables for users, chats, and transaction history.
- Express login route with lazy migration from Firebase Auth.
- Socket.io chat history and live message persistence.
- Cloudflare R2 invoice JSON storage helpers.

Important: Firebase Admin SDK cannot verify an email/password pair. The lazy migration login route uses the official Firebase Auth REST `signInWithPassword` endpoint to verify old Firebase users, then uses Firebase Admin to verify the returned ID token.

## Install

```bash
cd backend
npm install
cp .env.example .env
```

## Required `.env`

```env
PORT=8080
APP_JWT_SECRET=replace_with_a_long_random_secret

CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_D1_DATABASE_ID=your_d1_database_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_with_d1_edit_permission

CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
CLOUDFLARE_R2_BUCKET=your_r2_bucket_name
CLOUDFLARE_R2_PUBLIC_BASE_URL=

FIREBASE_WEB_API_KEY=your_firebase_web_api_key
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

## Cloudflare Setup

1. Create a D1 database in Cloudflare.
2. Copy the D1 database ID into `CLOUDFLARE_D1_DATABASE_ID`.
3. Create a Cloudflare API token with D1 edit/query permission.
4. Create an R2 bucket.
5. Create R2 API credentials and add them to `.env`.

## Run

```bash
npm start
```

Health check:

```bash
GET http://localhost:8080/health
```

