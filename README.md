# Aanch The Fire — Hostinger Node.js + MySQL

Read HOSTINGER-SETUP.md for deployment steps. Node.js 24 recommended.

- npm ci — install dependencies
- npm run build — frontend build into dist/client
- npm start — server.js using backend environment variables
- node scripts/create-admin.mjs — generate private admin configuration
- npm test — auth, API, location and HTTP adapter tests

MySQL schema: server/schema.sql (automatically initialized on startup).
Database adapter: server/mysql.js. HTTP adapter: server/app.js. Entry: server.js.
Never serve the project root publicly. Only dist/client and API routes are exposed.
