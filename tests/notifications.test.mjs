import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationFeed} from '../worker/notifications.js';
import {api} from '../worker/api.js';
import {connectDB} from '../scripts/local-db.mjs';
import {passwordHash, totpCode} from '../worker/admin-auth.js';

async function table(DB, id, date = new Date().toISOString()) {
  await DB.prepare("INSERT INTO bookings (id,reference,owner,request_key,details,status,created_at) VALUES (?,?,?,?,?,'requested',?)").bind(id,'AAN-'+id,'guest','key-'+id,JSON.stringify({name:'Guest',phone:'9999999999',guests:4,date:'2027-01-01',time:'19:30',notes:'private notes'}),date).run();
}
test('feed includes new tables, pickup, delivery and linked pre-orders without exposing phone or notes', async () => {
  const DB = connectDB();
  try {
    await table(DB, 'a'.repeat(32));
    const now = new Date().toISOString();
    for (const [mode, id] of [['delivery','b'.repeat(32)], ['pickup','c'.repeat(32)]]) {
      await DB.prepare("INSERT INTO food_orders (id,reference,owner,request_key,details,items,subtotal,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'requested',?,?)").bind(id,'FOOD-'+id,'guest',id,JSON.stringify({name:'Guest',mode,phone:'9999999999',address:'private address'}),'[]',450,now,now).run();
    }
    await DB.prepare("INSERT INTO orders (id,booking_id,owner,request_key,items,subtotal,notes,status,created_at) VALUES (?,?,?,?,?,?,?,'requested',?)").bind('d'.repeat(32),'a'.repeat(32),'guest','preorder-key','[]',300,'private notes',now).run();
    const result = await notificationFeed(DB);
    assert.equal(result.events.length,4);
    assert.deepEqual(new Set(result.events.map(e => e.title)),new Set(['New table booking','New delivery order','New pickup order','New table food pre-order']));
    assert.doesNotMatch(JSON.stringify(result),/9999999999|private notes|private address/);
    // Overlap is intentional; event keys remain stable for client deduplication.
    assert.deepEqual((await notificationFeed(DB, JSON.stringify(result.cursor))).events.map(e=>e.key), result.events.map(e=>e.key));
  } finally {DB.close();}
});
test('feed paginates more than 100 simultaneous records without skipping or looping', async () => {
  const DB = connectDB();
  try {
    const at = new Date(Date.now()-10000).toISOString();
    for(let i=0;i<230;i++) await table(DB, i.toString(16).padStart(32,'0'),at);
    let cursor, pages=0; const keys=[];
    do {
      const response=await notificationFeed(DB,cursor && JSON.stringify(cursor));
      keys.push(...response.events.map(e=>e.key)); pages++; cursor=response.cursor;
      if(!response.hasMore)break;
      assert.ok(pages<5);
    }while(true);
    assert.equal(pages,3); assert.equal(keys.length,230); assert.equal(new Set(keys).size,230);
    await table(DB,'f'.repeat(32),new Date().toISOString());
    // A completed cursor begins a new overlapping window, which also drains finitely.
    const fresh=[]; let again=0;
    do { const response=await notificationFeed(DB,JSON.stringify(cursor)); fresh.push(...response.events); cursor=response.cursor; again++; if(!response.hasMore)break; assert.ok(again<5); } while(true);
    assert.ok(fresh.some(e=>e.key==='table:'+'f'.repeat(32)));
  }finally{DB.close();}
});
test('invalid cursors are rejected and initial feed is bounded to the past day', async()=>{
  const DB=connectDB();try{
    await table(DB,'a'.repeat(32),new Date(Date.now()-2*86400000).toISOString());
    assert.equal((await notificationFeed(DB)).events.length,0);
    for(const cursor of ['not-json','null','{}',JSON.stringify({at:'wrong',key:''})])assert.equal((await notificationFeed(DB,cursor)).invalid,true);
  }finally{DB.close();}
});
test('notification endpoint requires password AND OTP, sessions last one shift and are revocable',async()=>{
  const DB=connectDB();try{
    const salt='ab'.repeat(16),env={DB,ADMIN_USERNAME:'owner@example.test',ADMIN_MFA_KEY:'22'.repeat(32),ADMIN_PASSWORD_HASH:salt+':'+await passwordHash('Test-only-password!',salt)};
    let headers={'content-type':'application/json',cookie:'aanch_session='+'a'.repeat(64)};
    async function send(path,body){const r=await api(new Request('https://aanch.test/api'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json(),headers:r.headers};}
    assert.equal((await send('/admin/notifications')).status,403);
    const login=await send('/admin-auth/login',{username:env.ADMIN_USERNAME,password:'Test-only-password!'});
    headers['x-aanch-login']=login.data.loginToken;
    assert.match(login.headers.get('set-cookie'),/Max-Age=43200/);
    assert.equal((await send('/admin/notifications')).status,403);
    const setup=await send('/admin-auth/setup',{});
    const verified=await send('/admin-auth/verify',{code:await totpCode(setup.data.secret,Math.floor(Date.now()/30000))});
    headers['x-aanch-admin']=verified.data.verificationToken;
    assert.ok(verified.data.expiresAt>=Math.floor(Date.now()/1000)+43195);
    assert.equal((await send('/admin/notifications')).status,200);
    assert.equal((await send('/admin/notifications?cursor=bad')).status,400);
    await DB.prepare('UPDATE admin_sessions SET expires_at = 0').run();
    assert.equal((await send('/admin/notifications')).status,403);
    await send('/admin-auth/logout',{});
    assert.equal((await send('/admin/notifications')).status,403);
  }finally{DB.close();}
});
