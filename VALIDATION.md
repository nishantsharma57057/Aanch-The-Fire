# Verification of the Hostinger migration

- Clean npm ci with development dependencies: passed.
- Production frontend build: passed. Vite reports large map chunks; this is a warning, not a build failure.
- 18 regression checks: passed. Includes existing booking/pre-order, pickup/delivery, ownership, idempotency, validation, radius, OTP and cookie handling tests.
- New Express HTTP test: passed for serving the built frontend, blocking source/config paths, rejecting caller-supplied platform identity, issuing Secure cookies behind the canonical HTTPS origin, guest booking and pickup, owner login and OTP, admin status changes, customer visibility, cross-origin rejection, payload limits and logout.
- MariaDB 10.11.14 bootstrap SQL smoke test: six-table schema accepted; restaurant-setting upsert, login-attempt JSON updates, booking/pre-order inserts and transactional status updates accepted. Result: booking confirmed, order accepted, login attempts 1.
- Reopened the MariaDB data directory in a second process and verified the confirmed booking remained.

Limits: this environment disallows MariaDB's Unix socket, so full mysql2 TCP integration tests could not run here (database startup stopped at socket creation). The optional npm run test:mysql suite is included for a dedicated DB_NAME=aanch_test database with DB_* variables. The production Hostinger account, SSL/domain, environment variables and MySQL network connection have not been accessed or verified. Complete the live flow checklist in HOSTINGER-SETUP.md before accepting orders. No online payment or external messaging integration was added.

## Admin live alerts update

- `npm test`: 22 tests pass, including the authenticated notification feed, all four request kinds, privacy fields, malformed cursors, 24-hour initial history, expiry/revocation and 230 simultaneous records across multiple pages.
- `npm run build`: production build succeeds. The existing lazy-loaded MapLibre bundle still produces Vite's size advisory.
- Notifications are read from the existing bookings/orders/food_orders tables. No checkout writes, database migration or external notification provider was added.
- Live Hostinger deployment and real MySQL credentials are not available in this workspace; the automated API checks use the existing local SQLite adapter.
- Chromium browser verification passed against the built frontend and a real local HTTP server: password + OTP login, navigation to Home, table and pickup popups, two-note AudioContext chime triggering, explicit sound activation after reload, reference-filtered links, unread/read state, cross-tab deduplication, guest isolation, offline/reconnect and session-expiry messaging. Panel bounds and page overflow checked at 390, 768 and 1440px. A physical device/speaker and live Hostinger deployment were not tested.
