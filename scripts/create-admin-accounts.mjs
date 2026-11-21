import {randomBytes,pbkdf2Sync} from 'node:crypto';

const emails=['nishantsharma59059@gmail.com','aanchthefire@gmail.com'];
const accounts=emails.map(email=>{
  // Random initial password is intentionally not printed. Use Forgot Password after deployment.
  const password=randomBytes(32).toString('base64url');
  const salt=randomBytes(16).toString('hex');
  const digest=pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex');
  return {email,passwordHash:salt+':'+digest};
});
console.log('Copy this complete value into Hostinger as ADMIN_ACCOUNTS:');
console.log(JSON.stringify(accounts));
console.log('\nInitial passwords are random and are not displayed. After deployment, use Forgot password for each admin email.');
