import {randomBytes, pbkdf2Sync} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
const rl = createInterface({input: process.stdin, output: process.stdout});
try {
  const username = (await rl.question('Admin email [nishantsharma59059@gmail.com]: ')).trim() || 'nishantsharma59059@gmail.com';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) throw new Error('Enter a valid email.');
  const password = randomBytes(18).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex');
  console.log('\nSave this generated admin password privately:\n' + password);
  console.log('\nPaste these 3 values in Hostinger Environment Variables:\n');
  console.log('ADMIN_USERNAME=' + username);
  console.log('ADMIN_PASSWORD_HASH=' + salt + ':' + hash);
  console.log('ADMIN_MFA_KEY=' + randomBytes(32).toString('hex'));
  console.log('\nKeep ADMIN_MFA_KEY unchanged on future deployments. No file was written.');
} finally { rl.close(); }
