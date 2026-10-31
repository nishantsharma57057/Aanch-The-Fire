import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.js';
import {connectDB} from '../scripts/local-db.mjs';
import {passwordHash, totpCode} from '../worker/admin-auth.js';
import {menu, itemId} from '../src/menu.js';

test('HTTP server serves frontend and complete guest -> owner -> order status flow', async () => {
 const DB = connectDB();
 const salt = 'ab'.repeat(16);
 const env = {DB, APP_URL: 'https://aanch.test', ADMIN_USERNAME: 'owner@example.test',
 ADMIN_MFA_KEY: '22'.repeat(32), ADMIN_PASSWORD_HASH: salt + ':' + await passwordHash('Test-password!', salt)};
 const app = createApp(env);
 const server = app.listen(0, '127.0.0.1');
 await new Promise(resolve => server.once('listening', resolve));
 const base = 'http://127.0.0.1:' + server.address().port;
 let cookie = '';
 async function send(path, body, extra = {}) {
   const response = await fetch(base + path, {method: body === undefined ? 'GET' : 'POST', headers: {cookie,
   ...(body === undefined ? {} : {'content-type':'application/json'}), ...extra}, body: body === undefined ? undefined : JSON.stringify(body)});
   const data = await response.json();
   for (const value of response.headers.getSetCookie()) {
     const pair = value.split(';')[0], name = pair.split('=')[0];
     cookie = cookie.split('; ').filter(x => x && !x.startsWith(name + '=')).concat(pair).join('; ');
   }
   return {status: response.status, data, headers: response.headers};
 }
 try {
   assert.equal((await fetch(base)).status,200);
   assert.match(await (await fetch(base)).text(),/Aanch/i);
   for (const path of ['/server.js','/.env','/server/schema.sql','/ADMIN-CREDENTIALS.md','/package.json']) assert.equal((await fetch(base+path)).status,404);
   assert.equal((await send('/api/health')).data.ok,true);
   const guest = await send('/api/session', undefined, {'oai-authenticated-user-id':'forged','oai-authenticated-user-email':env.ADMIN_USERNAME});
   assert.equal(guest.data.signedIn,false);
   assert.match(guest.headers.get('set-cookie'),/Secure/);
   const future = new Date(Date.now() + 86400000*2).toISOString().slice(0,10);
   const booking = await send('/api/bookings',{name:'HTTP Guest',phone:'9999999999',date:future,time:'19:30',guests:2,requestKey:'http_booking_test_12345'});
   assert.equal(booking.status,201);
   const order = await send('/api/food-orders',{name:'HTTP Guest',phone:'9999999999',mode:'pickup',agreed:true,requestKey:'http_food_test_123456',items:[{id:itemId(menu.find(i=>i.name==='Paneer Tikka')),quantity:2}]});
   assert.equal(order.status,201);
   assert.equal((await send('/api/admin/bookings')).status,403);
   assert.equal((await send('/api/admin-auth/login',{username:env.ADMIN_USERNAME,password:'Test-password!'})).status,200);
   const setup = await send('/api/admin-auth/setup',{});
   assert.equal(setup.status,200);
   assert.equal((await send('/api/admin-auth/verify',{code:await totpCode(setup.data.secret,Math.floor(Date.now()/30000))})).status,200);
   assert.equal((await send('/api/admin/bookings')).data.bookings[0].id,booking.data.booking.id);
   assert.equal((await send('/api/admin/food-orders/'+order.data.order.id,{status:'accepted'})).status,200);
   assert.equal((await send('/api/food-orders')).data.orders[0].status,'accepted');
   assert.equal((await send('/api/bookings',{}, {origin:'https://attacker.test'})).status,403);
   const tooBig = await fetch(base+'/api/bookings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({notes:'x'.repeat(30000)})});
   assert.equal(tooBig.status,413);
   assert.equal((await send('/api/admin-auth/logout',{})).status,200);
   assert.equal((await send('/api/admin/bookings')).status,403);
 } finally { await new Promise(resolve => server.close(resolve)); DB.close(); }
});
