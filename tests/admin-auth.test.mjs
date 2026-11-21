import test from'node:test';import assert from'node:assert/strict';import{api}from'../worker/api.js';import{connectDB}from'../scripts/local-db.mjs';import{totpCode,passwordHash,encodeBase32}from'../worker/admin-auth.js';
test('TOTP matches RFC 6238',async()=>{const secret=encodeBase32(new TextEncoder().encode('12345678901234567890'));assert.equal(await totpCode(secret,1),'287082')});
test('separate admin password login requires OTP, blocks replay, expires and revokes access',async()=>{const DB=connectDB();try{const salt='ab'.repeat(16),env={DB,ADMIN_USERNAME:'owner@example.test',ADMIN_MFA_KEY:'22'.repeat(32),ADMIN_PASSWORD_HASH:salt+':'+await passwordHash('Test-only-password!',salt)};let cookies='aanch_session='+'a'.repeat(64);const send=async(path,body)=>{const r=await api(new Request('https://aanch.test/api'+path,{method:body===undefined?'GET':'POST',headers:{cookie:cookies,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);return{status:r.status,data:await r.json(),headers:r.headers}};
assert.equal((await send('/admin/bookings')).status,403);assert.equal((await send('/admin-auth/login',{username:env.ADMIN_USERNAME,password:'wrong'})).status,401);const login=await send('/admin-auth/login',{username:env.ADMIN_USERNAME,password:'Test-only-password!'});assert.equal(login.status,200);cookies+='; '+login.headers.get('set-cookie').split(';')[0];assert.equal((await send('/session')).data.ownerAuthorized,true);assert.equal((await send('/admin/bookings')).status,403);const setup=await send('/admin-auth/setup',{});assert.equal(setup.status,200);const code=await totpCode(setup.data.secret,Math.floor(Date.now()/30000));const verified=await send('/admin-auth/verify',{code});assert.equal(verified.status,200);cookies+='; '+verified.headers.get('set-cookie').split(';')[0];assert.equal((await send('/admin/bookings')).status,200);assert.equal((await send('/admin-auth/verify',{code})).status,401);await send('/admin-auth/logout',{});assert.equal((await send('/admin/bookings')).status,403);await DB.prepare('UPDATE admin_mfa SET attempts = 5, window_started = ?').bind(Math.floor(Date.now()/1000)).run();assert.equal((await send('/admin-auth/verify',{code})).status,429);env.ADMIN_PASSWORD_HASH+='x';assert.equal((await send('/admin/bookings')).status,200);
}finally{DB.close()}});
test('cookie-blocked browser can progress from password to OTP and dashboard using in-memory tokens',async()=>{const DB=connectDB();try{const salt='ab'.repeat(16),env={DB,ADMIN_USERNAME:'owner@example.test',ADMIN_MFA_KEY:'22'.repeat(32),ADMIN_PASSWORD_HASH:salt+':'+await passwordHash('Test-only-password!',salt)};let headers={};const send=async(path,body)=>{const r=await api(new Request('https://aanch.test/api'+path,{method:body===undefined?'GET':'POST',headers:{...headers,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);return{status:r.status,data:await r.json()}};const login=await send('/admin-auth/login',{username:env.ADMIN_USERNAME,password:'Test-only-password!'});assert.equal(login.status,200);headers['x-aanch-login']=login.data.loginToken;assert.equal((await send('/session')).data.ownerAuthorized,true);assert.equal((await send('/admin/bookings')).status,401);const setup=await send('/admin-auth/setup',{});assert.equal(setup.status,200);const verified=await send('/admin-auth/verify',{code:await totpCode(setup.data.secret,Math.floor(Date.now()/30000))});assert.equal(verified.status,200);headers['x-aanch-admin']=verified.data.verificationToken;assert.equal((await send('/session')).data.admin,true);assert.equal((await send('/admin/bookings')).status,200);await send('/admin-auth/logout',{});assert.equal((await send('/admin/bookings')).status,401)}finally{DB.close()}});

test('logout clears both cookies even when owner login is expired or invalid',async()=>{
 const DB=connectDB();try{
  const env={DB,ADMIN_USERNAME:'owner@example.test',ADMIN_MFA_KEY:'22'.repeat(32),ADMIN_PASSWORD_HASH:'ab'.repeat(16)+':'+'cd'.repeat(32)};
  const token='a'.repeat(64),tokenHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
  await DB.prepare('INSERT INTO admin_mfa (owner_key) VALUES (?)').bind('owner-key').run();
  await DB.prepare('INSERT INTO admin_sessions (token_hash,owner_key,expires_at) VALUES (?,?,?)').bind(tokenHash,'owner-key',Math.floor(Date.now()/1000)+3600).run();
  const expired='1.'+'a'.repeat(32)+'.'+'b'.repeat(64);
  const request=path=>new Request('https://aanch.test/api'+path,{method:'POST',headers:{'content-type':'application/json',cookie:`aanch_login=${expired}; aanch_admin=${token}`},body:'{}'});
  const status=await api(new Request('https://aanch.test/api/admin-auth/status',{headers:{cookie:`aanch_login=${expired}`}}),env);
  assert.equal(status.status,403);
  for(let retry=0;retry<2;retry++){
   const response=await api(request('/admin-auth/logout'),env);assert.equal(response.status,200);
   const cookies=response.headers.getSetCookie();assert.equal(cookies.length,2);
   for(const name of ['aanch_login','aanch_admin'])assert.ok(cookies.some(c=>c.startsWith(name+'=;')&&c.includes('Max-Age=0')&&c.includes('HttpOnly')&&c.includes('Secure')));
  }
  assert.equal(await DB.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).first(),null);
  assert.equal((await api(new Request('https://aanch.test/api/admin-auth/logout',{method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json'},body:'{}'}),env)).status,403);
 }finally{DB.close();}
});


test('two configured admin accounts have separate MFA and can reset passwords through Resend',async()=>{
 const DB=connectDB();const originalFetch=globalThis.fetch;
 try{
  const firstSalt='11'.repeat(16),secondSalt='22'.repeat(16);
  const firstPassword='First-temporary-password-123!',secondPassword='Second-temporary-password-456!';
  const env={DB,ADMIN_MFA_KEY:'33'.repeat(32),APP_URL:'https://aanch.test',RESEND_API_KEY:'re_test_only',MAIL_FROM:'Aanch The Fire <no-reply@aanchthefire.com>',ADMIN_ACCOUNTS:JSON.stringify([
   {email:'nishantsharma59059@gmail.com',passwordHash:firstSalt+':'+await passwordHash(firstPassword,firstSalt)},
   {email:'aanchthefire@gmail.com',passwordHash:secondSalt+':'+await passwordHash(secondPassword,secondSalt)}
  ])};
  let emailPayload=null;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');emailPayload=JSON.parse(options.body);return new Response(JSON.stringify({id:'test-email'}),{status:200,headers:{'content-type':'application/json'}})};
  let headers={cookie:'aanch_session='+'a'.repeat(64)};
  const send=async(path,body)=>{const r=await api(new Request('https://aanch.test/api'+path,{method:body===undefined?'GET':'POST',headers:{...headers,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);return{status:r.status,data:await r.json()}};
  const first=await send('/admin-auth/login',{username:'nishantsharma59059@gmail.com',password:firstPassword});assert.equal(first.status,200);headers['x-aanch-login']=first.data.loginToken;
  assert.equal((await send('/session')).data.adminEmail,'nishantsharma59059@gmail.com');
  const firstSetup=await send('/admin-auth/setup',{});assert.equal(firstSetup.status,200);
  const second=await send('/admin-auth/login',{username:'aanchthefire@gmail.com',password:secondPassword});assert.equal(second.status,200);headers['x-aanch-login']=second.data.loginToken;
  assert.equal((await send('/session')).data.adminEmail,'aanchthefire@gmail.com');
  const secondSetup=await send('/admin-auth/setup',{});assert.equal(secondSetup.status,200);assert.notEqual(firstSetup.data.secret,secondSetup.data.secret);
  const forgot=await send('/admin-auth/forgot-password',{email:'nishantsharma59059@gmail.com'});assert.equal(forgot.status,200);assert.match(emailPayload.to[0],/nishantsharma59059@gmail.com/);
  const href=emailPayload.html.match(/href="([^"]+)"/)[1];const resetUrl=new URL(href);const params=new URLSearchParams(resetUrl.hash.split('?')[1]);const token=params.get('resetToken');assert.match(token,/^[a-f0-9]{64}$/);
  const reset=await send('/admin-auth/reset-password',{email:'nishantsharma59059@gmail.com',token,password:'New-secure-password-789!'});assert.equal(reset.status,200);
  const oldLogin=await send('/admin-auth/login',{username:'nishantsharma59059@gmail.com',password:firstPassword});assert.equal(oldLogin.status,401);
  const newLogin=await send('/admin-auth/login',{username:'nishantsharma59059@gmail.com',password:'New-secure-password-789!'});assert.equal(newLogin.status,200);
 }finally{globalThis.fetch=originalFetch;DB.close()}
});
