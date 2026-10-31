// Additional OTP verification after the hosting platform has authenticated the owner.
// No OTP or session token is written to logs or returned by the session status endpoint.
const encoder=new TextEncoder();
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const unhex=value=>Uint8Array.from(value.match(/../g)||[],h=>parseInt(h,16));
const sha=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
const now=()=>Math.floor(Date.now()/1000);
// A restaurant shift; absolute expiry still requires password + OTP again.
const sessionSeconds=env=>Math.round(Math.min(24,Math.max(0.5,Number(env.ADMIN_SESSION_HOURS)||12))*3600);
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=UTF-8','Cache-Control':'private, no-store',...headers}});
class AuthError extends Error{constructor(message,status=400){super(message);this.status=status}}
function requireThat(test,message,status=400){if(!test)throw new AuthError(message,status)}
async function signLogin(env,value){const key=await crypto.subtle.importKey('raw',encoder.encode(env.ADMIN_MFA_KEY+env.ADMIN_PASSWORD_HASH),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))))}
export async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256)))}
export async function isAdminOwner(request,env){if(!env.ADMIN_USERNAME||!env.ADMIN_PASSWORD_HASH||!encryptionReady(env))return false;const token=request.headers.get('x-aanch-login')||(request.headers.get('cookie')||'').match(/(?:^|;\s*)aanch_login=([a-f0-9.]+)(?:;|$)/)?.[1];if(!token)return false;const[expires,nonce,signature]=token.split('.');if(!/^\d+$/.test(expires)||Number(expires)<=now()||!nonce||!signature)return false;return signature===await signLogin(env,expires+'.'+nonce)}
const ownerKey=(request,env)=>sha(env.ADMIN_USERNAME.toLowerCase());
const encryptionReady=env=>/^[a-f0-9]{64}$/i.test(env.ADMIN_MFA_KEY||'');
const cookieToken=request=>request.headers.get('x-aanch-admin')||(request.headers.get('cookie')||'').match(/(?:^|;\s*)aanch_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
function cookie(request,value,maxAge){return `aanch_admin=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
export function encodeBase32(bytes){let bits=0,value=0,result='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=alphabet[(value>>>(bits-5))&31];bits-=5}}if(bits)result+=alphabet[(value<<(5-bits))&31];return result}
function decodeBase32(secret){let bits=0,value=0;const bytes=[];for(const letter of secret){const index=alphabet.indexOf(letter);if(index<0)throw new Error('Invalid authenticator key');value=(value<<5)|index;bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8}}return new Uint8Array(bytes)}
export async function totpCode(secret,counter){const bytes=new Uint8Array(8);new DataView(bytes.buffer).setBigUint64(0,BigInt(counter));const key=await crypto.subtle.importKey('raw',decodeBase32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,bytes));const offset=mac[mac.length-1]&15;const value=((mac[offset]&127)<<24)|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3];return String(value%1000000).padStart(6,'0')}
async function crypt(env,owner,value,decrypt=false){const key=await crypto.subtle.importKey('raw',unhex(env.ADMIN_MFA_KEY),{name:'AES-GCM'},false,[decrypt?'decrypt':'encrypt']);if(decrypt){const[iv,data]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(iv),additionalData:encoder.encode(owner)},key,unhex(data)))}const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(owner)},key,encoder.encode(value));return hex(iv)+'.'+hex(new Uint8Array(encrypted))}
export async function hasAdminSession(request,env){if(!await isAdminOwner(request,env)||!encryptionReady(env)||!env.DB)return false;const token=cookieToken(request);if(!token)return false;const row=await env.DB.prepare('SELECT s.token_hash FROM admin_sessions s JOIN admin_mfa m ON m.owner_key = s.owner_key WHERE s.token_hash = ? AND s.owner_key = ? AND s.expires_at > ? AND m.enabled = 1').bind(await sha(token),await ownerKey(request,env),now()).first();return Boolean(row)}
export async function adminSessionState(request,env){const ownerAuthorized=await isAdminOwner(request,env);return {ownerAuthorized,admin:ownerAuthorized?await hasAdminSession(request,env):false,signedIn:Boolean(request.headers.get('oai-authenticated-user-id')),adminEmail:ownerAuthorized?env.ADMIN_USERNAME:null}}
export async function adminAuthRoute(request,env){const path=new URL(request.url).pathname;if(!path.startsWith('/api/admin-auth/'))return null;try{
 if(path==='/api/admin-auth/login'&&request.method==='POST'){
 requireThat(env.DB&&env.ADMIN_USERNAME&&env.ADMIN_PASSWORD_HASH&&encryptionReady(env),'Admin login is not configured.',503);
 requireThat((request.headers.get('content-type')||'').includes('application/json'),'JSON required.',415);const raw=await request.text();requireThat(raw.length<2000,'Invalid login request.');let body;try{body=JSON.parse(raw)}catch{throw new AuthError('Invalid login request.')}
 const time=now();await env.DB.prepare("INSERT OR IGNORE INTO settings (`key`,value) VALUES ('admin_login_attempts','{\"attempts\":0,\"started\":0}')").run();
 await env.DB.prepare("UPDATE settings SET value = json_object('attempts',0,'started',?) WHERE `key` = 'admin_login_attempts' AND json_extract(value,'$.started') <= ?").bind(time,time-900).run();
 const attempt=await env.DB.prepare("UPDATE settings SET value = json_set(value,'$.attempts',json_extract(value,'$.attempts')+1) WHERE `key` = 'admin_login_attempts' AND json_extract(value,'$.attempts') < 5").run();requireThat(attempt.meta.changes===1,'Too many login attempts. Try again after 15 minutes.',429);
 const[salt,expected]=env.ADMIN_PASSWORD_HASH.split(':');requireThat(typeof body.password==='string'&&body.password.length<=200,'Invalid email or password.',401);const actual=await passwordHash(body.password,salt);let diff=actual.length^expected.length;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);requireThat(typeof body.username==='string'&&body.username.trim().toLowerCase()===env.ADMIN_USERNAME.toLowerCase()&&diff===0,'Invalid email or password.',401);
 await env.DB.prepare("UPDATE settings SET value = json_object('attempts',0,'started',?) WHERE `key` = 'admin_login_attempts'").bind(time).run();const value=String(time+sessionSeconds(env))+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));const token=value+'.'+await signLogin(env,value);return response({loggedIn:true,loginToken:token},200,{'Set-Cookie':`aanch_login=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionSeconds(env)}${new URL(request.url).protocol==='https:'?'; Secure':''}`})
 }
 // Sign-out must also recover expired, invalid and missing login cookies.
 if(path==='/api/admin-auth/logout'&&request.method==='POST'){
  const token=cookieToken(request);
  if(token&&env.DB)await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha(token)).run();
  const result=response({verified:false});
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
  result.headers.append('Set-Cookie',`aanch_login=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
  result.headers.append('Set-Cookie',cookie(request,'',0));
  return result;
 }
 requireThat(await isAdminOwner(request,env),'Sign in with the authorised owner account first.',403);
 requireThat(env.DB&&encryptionReady(env),'Admin OTP verification is not configured. Please contact the site owner.',503);
 const owner=await ownerKey(request,env),time=now();const method=request.method;
 if(path==='/api/admin-auth/status'&&method==='GET'){const row=await env.DB.prepare('SELECT enabled FROM admin_mfa WHERE owner_key = ?').bind(owner).first();return response({enabled:row?.enabled===1,verified:await hasAdminSession(request,env),method:'authenticator',sessionMinutes:sessionSeconds(env)/60})}
 requireThat(method==='POST','Method not allowed.',405);

 if(path==='/api/admin-auth/setup'){
  let row=await env.DB.prepare('SELECT * FROM admin_mfa WHERE owner_key = ?').bind(owner).first();requireThat(!row?.enabled,'Authenticator is already configured. Enter its current code.',409);
  await env.DB.prepare('INSERT OR IGNORE INTO admin_mfa (owner_key) VALUES (?)').bind(owner).run();
  if(!row?.pending_secret||row.pending_expires<=time){const secret=encodeBase32(crypto.getRandomValues(new Uint8Array(20)));const encrypted=await crypt(env,owner,secret);await env.DB.prepare('UPDATE admin_mfa SET pending_secret = ?, pending_expires = ? WHERE owner_key = ? AND enabled = 0 AND (pending_secret IS NULL OR pending_expires <= ?)').bind(encrypted,time+600,owner,time).run()}
  row=await env.DB.prepare('SELECT * FROM admin_mfa WHERE owner_key = ?').bind(owner).first();requireThat(!row.enabled,'Authenticator is already configured.',409);const secret=await crypt(env,owner,row.pending_secret,true);const email=env.ADMIN_USERNAME;const uri=`otpauth://totp/${encodeURIComponent('Aanch The Fire:'+email)}?secret=${secret}&issuer=Aanch%20The%20Fire&algorithm=SHA1&digits=6&period=30`;
  return response({secret,uri,expiresAt:row.pending_expires},200,{'Set-Cookie':cookie(request,'',0)})
 }
 if(path==='/api/admin-auth/verify'){
  requireThat((request.headers.get('content-type')||'').includes('application/json'),'JSON required.',415);const raw=await request.text();requireThat(raw.length<=1000,'Invalid verification request.');let body;try{body=JSON.parse(raw)}catch{throw new AuthError('Invalid verification request.')}
  requireThat(typeof body?.code==='string'&&/^\d{6}$/.test(body.code),'Enter the 6-digit code from your authenticator.');
  let row=await env.DB.prepare('SELECT * FROM admin_mfa WHERE owner_key = ?').bind(owner).first();requireThat(row&&(row.enabled||(row.pending_secret&&row.pending_expires>time)),'Set up your authenticator first. The setup may have expired.',409);
  if(row.window_started<=time-900){await env.DB.prepare('UPDATE admin_mfa SET attempts = 0, window_started = ? WHERE owner_key = ? AND window_started <= ?').bind(time,owner,time-900).run()}
  const reserve=await env.DB.prepare('UPDATE admin_mfa SET attempts = attempts + 1 WHERE owner_key = ? AND attempts < 5').bind(owner).run();requireThat(reserve.meta.changes===1,'Too many verification attempts. Try again after 15 minutes.',429);
  row=await env.DB.prepare('SELECT * FROM admin_mfa WHERE owner_key = ?').bind(owner).first();const sealed=row.enabled?row.secret:row.pending_secret;const secret=await crypt(env,owner,sealed,true);const counter=Math.floor(time/30);let matched=-1;
  for(const delta of[-1,0,1]){const candidate=await totpCode(secret,counter+delta);let difference=0;for(let i=0;i<6;i++)difference|=candidate.charCodeAt(i)^body.code.charCodeAt(i);if(difference===0)matched=counter+delta}
  requireThat(matched>row.last_counter,'Code is invalid, expired or already used. Wait for a new code and try again.',401);
  const sql=row.enabled?'UPDATE admin_mfa SET last_counter = ?, attempts = 0, window_started = ? WHERE owner_key = ? AND last_counter < ? AND secret = ?':'UPDATE admin_mfa SET secret = pending_secret, pending_secret = NULL, pending_expires = 0, enabled = 1, last_counter = ?, attempts = 0, window_started = ? WHERE owner_key = ? AND last_counter < ? AND pending_secret = ? AND enabled = 0 AND pending_expires > '+time;
  const update=await env.DB.prepare(sql).bind(matched,time,owner,matched,sealed).run();requireThat(update.meta.changes===1,'This code was already used or setup changed. Wait for a new code.',401);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(time).run();const token=hex(crypto.getRandomValues(new Uint8Array(32)));await env.DB.prepare('INSERT INTO admin_sessions (token_hash,owner_key,expires_at) VALUES (?,?,?)').bind(await sha(token),owner,time+sessionSeconds(env)).run();return response({verified:true,verificationToken:token,expiresAt:time+sessionSeconds(env)},200,{'Set-Cookie':cookie(request,token,sessionSeconds(env))})
 }
 return response({error:'Not found.'},404);
 }catch(error){if(error instanceof AuthError)return response({error:error.message},error.status);console.error('Admin verification failed',error.name);return response({error:'Verification is temporarily unavailable. Please try again.'},503)}}
