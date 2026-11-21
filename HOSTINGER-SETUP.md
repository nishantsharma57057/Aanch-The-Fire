# Aanch The Fire — Hostinger Business deployment

This package runs React and its API together on Express/Node.js, with persistent MySQL/MariaDB storage. Upload the full source ZIP as **Web App / Node.js**.

## 1. Generate the two admin accounts on your Mac

Install Node.js 24 LTS if necessary. Extract this ZIP and open Terminal in the folder containing package.json. Run:

```bash
node scripts/create-admin-accounts.mjs
```

Copy the JSON output into Hostinger as the `ADMIN_ACCOUNTS` environment variable. The script creates random initial passwords and prints only their PBKDF2 hashes; it does not display the passwords. After deployment, each admin uses Forgot Password to set a personal password by email. Generate a 64-character hex MFA encryption key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and store it as `ADMIN_MFA_KEY`. Keep that MFA key unchanged on future deployments. Never put credentials or hashes in GitHub.

## 2. Create a Node.js website

Hostinger hPanel → Websites → Create site / Add website → Web App / Node.js → Upload your website files. Choose Business hosting and your domain (or a temporary domain). Labels may vary.

Upload the complete project ZIP, with package.json at the ZIP root. Do not upload only dist/client or extract the source into public_html.

## 3. Create the MySQL database

Website Dashboard → Databases → Management. Create a database and user with a strong password. Copy the FULL prefixed database name and username, for example u123456789_aanch.

If database management appears only after the first deployment, finish website creation first, create the database, add variables and redeploy. Startup fails until required settings are supplied.

Use DB_HOST=127.0.0.1 and DB_PORT=3306 for MySQL in the same Hostinger account. The application creates its seven tables automatically at startup, including admin credentials, reset tokens, MFA and sessions. No import is required. If the user lacks CREATE permission, use phpMyAdmin → select database → Import → server/schema.sql.

## 4. Configure deployment

| Setting | Value |
|---|---|
| Framework | Express.js; or Other with entry file |
| Node version | 24.x |
| Package manager | npm |
| Install command, if shown | npm ci --include=dev |
| Build command | npm run build |
| Output directory | dist/client |
| Entry file | server.js |
| Start command, if shown | npm start |
| Root directory, if shown | ./ |

This is a BACKEND application. Keep server.js as the entry file at the source root. The output directory is for frontend assets. Do not deploy as a static Vite-only site. If no server entry field appears, switch to Express.js or Other.

Add these in Environment Variables, one name and value per row WITHOUT surrounding quotes:

| Name | Value |
|---|---|
| NODE_ENV | production |
| PORT | 3000 |
| APP_URL | https://YOUR-EXACT-DOMAIN |
| DB_HOST | 127.0.0.1 |
| DB_PORT | 3306 |
| DB_NAME | full prefixed database name |
| DB_USER | full prefixed database username |
| DB_PASSWORD | database password |
| ADMIN_ACCOUNTS | JSON output from `node scripts/create-admin-accounts.mjs` |
| ADMIN_MFA_KEY | 64-character hex key generated in step 1 |
| RESEND_API_KEY | Resend API key with email-sending permission |
| MAIL_FROM | `Aanch The Fire <no-reply@aanchthefire.com>` |

APP_URL must match the exact HTTPS origin used in the browser, without a subfolder, query, hash or credentials. Example: https://aanch.example.com. Redirect the www variant to the chosen canonical hostname. Use the temporary domain here during preview, and change APP_URL when switching domains. It controls secure cookies and same-origin checks.

Never prefix secrets with VITE_. Keep the same database and admin MFA key on future deployments. Files can be replaced on deploy; orders remain in MySQL.

## 5. Deploy and check

Click Deploy. Check build and runtime logs if deployment fails. Open:

- https://YOUR-DOMAIN/ — restaurant website
- https://YOUR-DOMAIN/api/health — should show {"ok":true}
- https://YOUR-DOMAIN/#/admin/login — admin login

Visitors do not add :3000 to the URL. Restart/redeploy after changing environment variables.

## 6. Set up OTP and restaurant location

After deployment, open `/#/admin/login` and use Forgot Password for each admin email. Follow the time-limited reset email to set a separate password for each account. On first sign-in for each account, click Set up OTP verification, scan its QR using Google Authenticator or Microsoft Authenticator, and enter the current six-digit code. Each admin has an independent authenticator secret and session.

Open admin Delivery settings. Set the exact restaurant entrance pin, confirm and save. Delivery stays disabled until the restaurant location is configured. Pickup can work before this step. The server checks the 5 km delivery radius.

## 7. Verify before accepting orders

1. In a normal browser, create a future table booking and food pre-order.
2. Create a pickup order and note its reference in My orders.
3. In a separate admin browser session, confirm the booking and accept the food order.
4. Refresh the customer records and check the updated status.
5. Test a delivery address within 5 km, and verify an outside address is rejected.
6. Restart/redeploy using the SAME database and secrets; verify orders remain.
7. Confirm guests cannot access admin records and sign out of admin.

Customer history belongs to the same browser cookie. Clearing cookies, using incognito, or changing devices creates a new customer session. Customer email/password accounts and cross-device lookup are not included. Save the order reference. Existing Sites/SQLite records are not automatically imported into the new MySQL database.

## Troubleshooting

- package.json not found: upload the ZIP with package.json at its root.
- Missing vite during build: install development dependencies for the build; do not omit them before building.
- Startup or health fails: check runtime logs, full DB username/name, password, DB_HOST=127.0.0.1 and port 3306.
- Forms reject with 403: match APP_URL to the exact browser HTTPS origin and redirect alternate hostnames.
- Login unavailable: verify `ADMIN_ACCOUNTS` is valid JSON containing both email addresses and `salt:hash` values, and verify `ADMIN_MFA_KEY` is 64 hex characters. Restart after changing environment variables.
- Password reset email not received: verify `RESEND_API_KEY`, `MAIL_FROM`, and the verified sending domain in Resend. Check spam and Resend email logs.
- Too many attempts: wait 15 minutes instead of repeatedly submitting.
- OTP fails: use automatic phone time and a fresh code. Do not change ADMIN_MFA_KEY.
- GPS unavailable: grant browser location access on HTTPS or select the pin manually.

## Local development

```bash
npm ci
npm run build
npm test
```

For local production testing, copy .env.example to .env, supply local MySQL and generated admin settings, use APP_URL=http://localhost:3000 and NODE_ENV=development, then npm start.

npm run dev retains the original SQLite Vite mode; admin variables must be exported into the shell. npm run preview serves static files only and is not a production server.

## Scope

Retains the supplied design, menu, booking/pre-order, pickup/delivery request flows, admin OTP and order status management. Does not add online payments, WhatsApp/email sending, a driver app or automatic migration of previous hosting data.

## Official references

https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/
