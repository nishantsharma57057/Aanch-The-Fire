import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {connectMysql} from './server/mysql.js';
import {createApp} from './server/app.js';
if (existsSync('.env')) process.loadEnvFile('.env');
const env = {...process.env};
for (const key of ['APP_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'ADMIN_MFA_KEY']) {
  if (!env[key]) throw new Error(`${key} is required; see HOSTINGER-SETUP.md`);
}
if (!/^[a-f0-9]{64}$/i.test(env.ADMIN_MFA_KEY)) throw new Error('Invalid ADMIN_MFA_KEY');
if (!/^[a-f0-9]{32}:[a-f0-9]{64}$/i.test(env.ADMIN_PASSWORD_HASH)) throw new Error('Invalid ADMIN_PASSWORD_HASH');
if (env.NODE_ENV === 'production' && !env.APP_URL.startsWith('https://')) throw new Error('Production APP_URL must use HTTPS');
try {
  env.DB = await connectMysql(env);
  const app = createApp(env, {staticDir: fileURLToPath(new URL('./dist/client/', import.meta.url))});
  const server = app.listen(Number(env.PORT || 3000), '0.0.0.0', () => console.log('Aanch server listening'));
  const stop = () => server.close(async () => {await env.DB.close(); process.exit(0);});
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
} catch (error) {
  // Log the error code only; never expose credentials or SQL parameters.
  console.error('Startup failed:', error.code || error.name, 'Check database settings and HOSTINGER-SETUP.md.');
  process.exitCode = 1;
}
