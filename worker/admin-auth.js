// Multi-admin authentication with per-account authenticator MFA and Resend password recovery.
const encoder=new TextEncoder();
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const unhex=value=>Uint8Array.from(value.match(/../g)||[],h=>parseInt(h,16));
const sha=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
const now=()=>Math.floor(Date.now()/1000);
const sessionSeconds=env=>Math.round(Math.min(24,Math.max(0.5,Number(env.ADMIN_SESSION_HOURS)||12))*3600);
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=UTF-8','Cache-Control':'private, no-store',...headers}});
class AuthError extends Error{constructor(message,status=400){super(message);this.status=status}}
function requireThat(test,message,status=400){if(!test)throw new AuthError(message,status)}
const encryptionReady=env=>/^[a-f0-9]{64}$/i.test(env.ADMIN_MFA_KEY||'');
const cookieToken=request=>request.headers.get('x-aanch-admin')||(request.headers.get('cookie')||'').match(/(?:^|;\s*)aanch_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
function cookie(request,value,maxAge){return `aanch_admin=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
function loginCookie(request,value,maxAge){return `aanch_login=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
function parseAccounts(env){
 let entries=[];
 if(env.ADMIN_ACCOUNTS){try{const parsed=JSON.parse(env.ADMIN_ACCOUNTS);entries=Array.isArray(parsed)?parsed:Object.entries(parsed).map(([email,passwordHash])=>({email,passwordHash}))}catch{throw new AuthError('ADMIN_ACCOUNTS must be valid JSON.',503)}}
 else if(env.ADMIN_USERNAME&&env.ADMIN_PASSWORD_HASH)entries=[{email:env.ADMIN_USERNAME,passwordHash:env.ADMIN_PASSWORD_HASH}];
 const unique=new Map();
 for(const item of entries){const email=String(item?.email||'').trim().toLowerCase(),passwordHash=String(item?.passwordHash||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[a-f0-9]{32}:[a-f0-9]{64}$/i.test(passwordHash))throw new AuthError('Invalid admin account configuration.',503);unique.set(email,passwordHash)}
 return [...unique].map(([email,passwordHash])=>({email,passwordHash}));
}
async function seedAccounts(env){
 const accounts=parseAccounts(env);requireThat(accounts.length>0,'Admin accounts are not configured.',503);
 for(const account of accounts){const exists=await env.DB.prepare('SELECT email FROM admin_credentials WHERE email = ?').bind(account.email).first();if(!exists)await env.DB.prepare('INSERT INTO admin_credentials (email,password_hash,reset_token_hash,reset_expires,attempts,window_started) VALUES (?,?,NULL,0,0,0)').bind(account.email,account.passwordHash).run()}
 return accounts;
}
async function accountFor(request,env){
 const token=request.headers.get('x-aanch-login')||(request.headers.get('cookie')||'').match(/(?:^|;\s*)aanch_login=([A-Za-z0-9_-]+\.\d+\.[a-f0-9]+\.[a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 const [encoded,expires,nonce,signature]=token.split('.');
 if(!encoded||!/^\d+$/.test(expires)||Number(expires)<=now()||!nonce||!/^[a-f0-9]{64}$/i.test(signature||''))return null;
 let email;try{email=atob(encoded.replace(/-/g,'+').replace(/_/g,'/'))}catch{return null}
 email=email.toLowerCase();const row=await env.DB.prepare('SELECT email FROM admin_credentials WHERE email = ?').bind(email).first();if(!row)return null;
 const key=await crypto.subtle.importKey('raw',unhex(env.ADMIN_MFA_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(email+'|'+expires+'.'+nonce))));
 let diff=expected.length^signature.length;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
 return diff===0?email:null;
}
const ownerKey=email=>sha(email.toLowerCase());
export async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256)))}
export async function isAdminOwner(request,env){return Boolean(await accountFor(request,env))}
export async function hasAdminSession(request,env){
 const email=await accountFor(request,env);if(!email||!encryptionReady(env)||!env.DB)return false;
 const token=cookieToken(request);if(!token)return false;
 const owner=await ownerKey(email);
 const row=await env.DB.prepare('SELECT s.token_hash FROM admin_sessions s JOIN admin_mfa m ON m.owner_key = s.owner_key WHERE s.token_hash = ? AND s.owner_key = ? AND s.expires_at > ? AND m.enabled = 1').bind(await sha(token),owner,now()).first();
 return Boolean(row);
}
export async function adminSessionState(request,env){const email=await accountFor(request,env);return {ownerAuthorized:Boolean(email),admin:email?await hasAdminSession(request,env):false,signedIn:false,adminEmail:email||null}}
export function encodeBase32(bytes){let bits=0,value=0,result='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=alphabet[(value>>>(bits-5))&31];bits-=5}}if(bits)result+=alphabet[(value<<(5-bits))&31];return result}
function decodeBase32(secret){let bits=0,value=0;const bytes=[];for(const letter of secret){const index=alphabet.indexOf(letter);if(index<0)throw new Error('Invalid authenticator key');value=(value<<5)|index;bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8}}return new Uint8Array(bytes)}
export async function totpCode(secret,counter){const bytes=new Uint8Array(8);new DataView(bytes.buffer).setBigUint64(0,BigInt(counter));const key=await crypto.subtle.importKey('raw',decodeBase32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,bytes));const offset=mac[mac.length-1]&15;const value=((mac[offset]&127)<<24)|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3];return String(value%1000000).padStart(6,'0')}
async function crypt(env,owner,value,decrypt=false){const key=await crypto.subtle.importKey('raw',unhex(env.ADMIN_MFA_KEY),{name:'AES-GCM'},false,[decrypt?'decrypt':'encrypt']);if(decrypt){const[iv,data]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(iv),additionalData:encoder.encode(owner)},key,unhex(data)))}const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(owner)},key,encoder.encode(value));return hex(iv)+'.'+hex(new Uint8Array(encrypted))}
async function sendResetEmail(env,email,token){
 requireThat(env.RESEND_API_KEY&&env.MAIL_FROM,'Password recovery email is not configured.',503);
 const link=new URL('/',env.APP_URL);link.hash='/admin/login?resetToken='+encodeURIComponent(token)+'&email='+encodeURIComponent(email);
 const html=`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#252920"><h2>Aanch The Fire admin password reset</h2><p>A password reset was requested for this admin account.</p><p><a href="${link.href}" style="display:inline-block;background:#bd8b3c;color:white;padding:12px 18px;text-decoration:none;border-radius:6px">Reset password</a></p><p>This link expires in 15 minutes and can be used once. If you did not request it, ignore this email.</p></div>`;
 const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:'Reset your Aanch The Fire admin password',html})});
 if(!sent.ok){const detail=await sent.text();console.error('Resend password email failed:',sent.status,detail.slice(0,300));throw new AuthError('Could not send the reset email. Please try again later.',503)}
}
export async function adminAuthRoute(request,env){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/admin-auth/'))return null;
 try{
 requireThat(env.DB,'Admin database is unavailable.',503);
 requireThat(encryptionReady(env),'Admin MFA encryption is not configured.',503);
 await seedAccounts(env);
 if(path==='/api/admin-auth/login'&&request.method==='POST'){
  requireThat((request.headers.get('content-type')||'').includes('application/json'),'JSON required.',415);
  const raw=await request.text();requireThat(raw.length<2000,'Invalid login request.');let body;try{body=JSON.parse(raw)}catch{throw new AuthError('Invalid login request.')}
  const email=String(body.username||'').trim().toLowerCase();const row=await env.DB.prepare('SELECT * FROM admin_credentials WHERE email = ?').bind(email).first();
  const time=now();if(row&&row.window_started<=time-900)await env.DB.prepare('UPDATE admin_credentials SET attempts = 0, window_started = ? WHERE email = ?').bind(time,email).run();
  if(row){const reserve=await env.DB.prepare('UPDATE admin_credentials SET attempts = attempts + 1 WHERE email = ? AND attempts < 5').bind(email).run();requireThat(reserve.meta.changes===1,'Too many login attempts. Try again after 15 minutes.',429)}
  const [salt,expected]=(row?.password_hash||'00'.repeat(16)+':'+'00'.repeat(32)).split(':');
  const password=typeof body.password==='string'?body.password:'';const actual=await passwordHash(password.slice(0,200),salt);
  let diff=actual.length^expected.length;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);
  requireThat(row&&password.length>0&&password.length<=200&&diff===0,'Invalid email or password.',401);
  await env.DB.prepare('UPDATE admin_credentials SET attempts = 0, window_started = ? WHERE email = ?').bind(time,email).run();
  const expiry=String(time+sessionSeconds(env)),nonce=hex(crypto.getRandomValues(new Uint8Array(16))),encoded=btoa(email).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const value=encoded+'.'+expiry+'.'+nonce;const key=await crypto.subtle.importKey('raw',unhex(env.ADMIN_MFA_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(email+'|'+expiry+'.'+nonce))));
  const token=value+'.'+signature;
  return response({loggedIn:true,loginToken:token},200,{'Set-Cookie':loginCookie(request,token,sessionSeconds(env))});
 }
 if(path==='/api/admin-auth/forgot-password'&&request.method==='POST'){
  const body=await request.json().catch(()=>({}));const email=String(body.email||'').trim().toLowerCase();
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
   const row=await env.DB.prepare('SELECT email,reset_token_hash,reset_expires FROM admin_credentials WHERE email = ?').bind(email).first();
   if(row&&(!row.reset_token_hash||row.reset_expires<=now())){const token=hex(crypto.getRandomValues(new Uint8Array(32)));await env.DB.prepare('UPDATE admin_credentials SET reset_token_hash = ?, reset_expires = ? WHERE email = ?').bind(await sha(token),now()+900,email).run();try{await sendResetEmail(env,email,token)}catch(error){await env.DB.prepare('UPDATE admin_credentials SET reset_token_hash = NULL, reset_expires = 0 WHERE email = ?').bind(email).run();throw error}}
  }
  return response({message:'If this email belongs to an admin account, a password reset link has been sent.'});
 }
 if(path==='/api/admin-auth/reset-password'&&request.method==='POST'){
  const body=await request.json().catch(()=>({}));const email=String(body.email||'').trim().toLowerCase(),token=String(body.token||''),password=String(body.password||'');
  requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&/^[a-f0-9]{64}$/i.test(token),'Invalid or expired reset link.',400);
  requireThat(password.length>=12&&password.length<=200,'Choose a password with at least 12 characters.',400);
  const row=await env.DB.prepare('SELECT reset_token_hash,reset_expires FROM admin_credentials WHERE email = ?').bind(email).first();
  requireThat(row&&row.reset_expires>now()&&row.reset_token_hash&&await sha(token)===row.reset_token_hash,'Invalid or expired reset link.',400);
  const salt=hex(crypto.getRandomValues(new Uint8Array(16))),digest=await passwordHash(password,salt);
  await env.DB.prepare('UPDATE admin_credentials SET password_hash = ?, reset_token_hash = NULL, reset_expires = 0, attempts = 0, window_started = ? WHERE email = ?').bind(salt+':'+digest,now(),email).run();
  const owner=await ownerKey(email);await env.DB.prepare('DELETE FROM admin_sessions WHERE owner_key = ?').bind(owner).run();
  const result=response({reset:true,message:'Password updated. Please sign in with your new password.'});result.headers.append('Set-Cookie',loginCookie(request,'',0));result.headers.append('Set-Cookie',cookie(request,'',0));return result;
 }
 if(path==='/api/admin-auth/logout'&&request.method==='POST'){
  const token=cookieToken(request);if(token)await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha(token)).run();
  const result=response({verified:false});result.headers.append('Set-Cookie',loginCookie(request,'',0));result.headers.append('Set-Cookie',cookie(request,'',0));return result;
 }
 const email=await accountFor(request,env);requireThat(email,'Sign in with an admin email and password first.',403);
 const owner=await ownerKey(email),time=now(),method=request.method;
 if(path==='/api/admin-auth/status'&&method==='GET'){const row=await env.DB.prepare('SELECT enabled FROM admin_mfa WHERE owner_key = ?').bind(owner).first();return response({enabled:row?.enabled===1,verified:await hasAdminSession(request,env),method:'authenticator',sessionMinutes:sessionSeconds(env)/60,email})}
 requireThat(method==='POST','Method not allowed.',405);
 if(path==='/api/admin-auth/setup'){
  let row=await env.DB.prepare('SELECT * FROM admin_mfa WHERE owner_key = ?').bind(owner).first();requireThat(!row?.enabled,'Authenticator is already configured. Enter its current code.',409);
  await env.DB.prepare('INSERT OR IGNORE INTO admin_mfa (owner_key) VALUES (?)').bind(owner).run();
  if(!row?.pending_secret||row.pending_expires<=time){const secret=encodeBase32(crypto.getRandomValues(new Uint8Array(20)));const encrypted=await crypt(env,owner,secret);await env.DB.prepare('UPDATE admin_mfa SET pending_secret = ?, pending_expires = ? WHERE owner_key = ? AND enabled = 0 AND (pending_secret IS NULL OR pending_expires <= ?)').bind(encrypted,time+600,owner,time).run()}
  row=await env.DB.prepare('SELECT * FROM admin_mfa WHERE owner_key = ?').bind(owner).first();requireThat(!row.enabled,'Authenticator is already configured.',409);const secret=await crypt(env,owner,row.pending_secret,true);const uri=`otpauth://totp/${encodeURIComponent('Aanch The Fire:'+email)}?secret=${secret}&issuer=Aanch%20The%20Fire&algorithm=SHA1&digits=6&period=30`;
  return response({secret,uri,expiresAt:row.pending_expires},200,{'Set-Cookie':cookie(request,'',0)});
 }
 if(path==='/api/admin-auth/verify'){
  const body=await request.json().catch(()=>({}));requireThat(typeof body?.code==='string'&&/^\d{6}$/.test(body.code),'Enter the 6-digit code from your authenticator.');
  let row=await env.DB.prepare('SELECT * FROM admin_mfa WHERE owner_key = ?').bind(owner).first();requireThat(row&&(row.enabled||(row.pending_secret&&row.pending_expires>time)),'Set up your authenticator first. The setup may have expired.',409);
  if(row.window_started<=time-900)await env.DB.prepare('UPDATE admin_mfa SET attempts = 0, window_started = ? WHERE owner_key = ? AND window_started <= ?').bind(time,owner,time-900).run();
  const reserve=await env.DB.prepare('UPDATE admin_mfa SET attempts = attempts + 1 WHERE owner_key = ? AND attempts < 5').bind(owner).run();requireThat(reserve.meta.changes===1,'Too many verification attempts. Try again after 15 minutes.',429);
  row=await env.DB.prepare('SELECT * FROM admin_mfa WHERE owner_key = ?').bind(owner).first();const sealed=row.enabled?row.secret:row.pending_secret;const secret=await crypt(env,owner,sealed,true);const counter=Math.floor(time/30);let matched=-1;
  for(const delta of[-1,0,1]){const candidate=await totpCode(secret,counter+delta);let difference=0;for(let i=0;i<6;i++)difference|=candidate.charCodeAt(i)^body.code.charCodeAt(i);if(difference===0)matched=counter+delta}
  requireThat(matched>row.last_counter,'Code is invalid, expired or already used. Wait for a new code and try again.',401);
  const sql=row.enabled?'UPDATE admin_mfa SET last_counter = ?, attempts = 0, window_started = ? WHERE owner_key = ? AND last_counter < ? AND secret = ?':'UPDATE admin_mfa SET secret = pending_secret, pending_secret = NULL, pending_expires = 0, enabled = 1, last_counter = ?, attempts = 0, window_started = ? WHERE owner_key = ? AND last_counter < ? AND pending_secret = ? AND enabled = 0 AND pending_expires > '+time;
  const update=await env.DB.prepare(sql).bind(matched,time,owner,matched,sealed).run();requireThat(update.meta.changes===1,'This code was already used or setup changed. Wait for a new code.',401);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(time).run();const sessionToken=hex(crypto.getRandomValues(new Uint8Array(32)));await env.DB.prepare('INSERT INTO admin_sessions (token_hash,owner_key,expires_at) VALUES (?,?,?)').bind(await sha(sessionToken),owner,time+sessionSeconds(env)).run();
  return response({verified:true,verificationToken:sessionToken,expiresAt:time+sessionSeconds(env)},200,{'Set-Cookie':cookie(request,sessionToken,sessionSeconds(env))});
 }
 return response({error:'Not found.'},404);
 }catch(error){if(error instanceof AuthError)return response({error:error.message},error.status);console.error('Admin authentication failed:',error.name);return response({error:'Authentication is temporarily unavailable. Please try again.'},503)}
}
