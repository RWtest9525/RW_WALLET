# RW Wallet Project Structure

This project is split so each feature has a clear place and future updates do not require editing one giant file.

## Frontend

- `index.html` keeps the page markup and links the app files.
- `index.html` is now only the small document entry shell.
- `src/shell.js` mounts the static app HTML that used to live inside `index.html`.
- `src/config/tailwind.config.js` contains Tailwind CDN configuration.
- `src/styles/app.css` contains the extracted site styles.
- `src/app.js` contains the early cached-user hydration script.
- `src/main.js` contains the existing Firebase wallet application logic.
- `src/components/` is reserved for reusable UI pieces like modals, toasts, headers, tabs, nav, cards, and form fields.
- `src/pages/` is reserved for user pages such as auth, home, withdraw, transactions, settings, and support.
- `src/admin/` is reserved for admin pages such as users, withdrawals, tasks, chats, and gift codes.
- `src/services/` is reserved for browser-side Firebase/API feature services.
- `src/state/` is reserved for shared browser state.
- `src/utils/` is reserved for formatting, validation, storage, DOM, IDs, and date helpers.
- `src/data/` is reserved for static options and defaults.

## Backend

- `backend/server.example.js` starts the backend.
- `backend/src/server.js` creates the HTTP server and Socket.IO server.
- `backend/src/app.js` creates the Express app, health endpoints, static file serving, and wallet service registration.
- `backend/src/services/cloudflareWalletService.js` preserves the existing Cloudflare, Firebase Admin, D1, R2, route, and socket behavior.
- `backend/src/config/`, `backend/src/db/`, `backend/src/middleware/`, `backend/src/routes/`, `backend/src/sockets/`, and `backend/src/utils/` are ready for the next safe backend split.

## Localhost

- Run frontend: `npm run dev`
- Run backend: `npm run backend`
- Check required project links/files: `npm run check`
