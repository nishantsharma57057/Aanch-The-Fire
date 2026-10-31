import {notificationFeed} from './notifications.js';
import {adminAuthRoute,adminSessionState,hasAdminSession} from './admin-auth.js';
import {validPoint,distanceKm,eligiblePoint,DELIVERY_RADIUS_KM} from '../shared/delivery.js';
import {menu,itemId,variantsFor} from '../src/menu.js';
const catalog=new Map(menu.map(i=>[itemId(i),i]));
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json;charset=UTF-8','Cache-Control':'private, no-store',...headers}});
class InputError extends Error {constructor(message,status=400){super(message);this.status=status}}
const assert=(test,message,status=400)=>{if(!test)throw new InputError(message,status)};
const clean=(v,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
const hash=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>crypto.randomUUID().replaceAll('-','');
const dateIST=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function validateDetails(raw){
 const d={name:clean(raw.name,80),phone:clean(raw.phone,18).replace(/[\s()+-]/g,''),date:clean(raw.date,10),time:clean(raw.time,5),guests:Number(raw.guests),occasion:clean(raw.occasion,50)||'Casual dining',notes:clean(raw.notes,500)};
 assert(d.name.length>=2,'Please enter your full name.');assert(/^\d{10,13}$/.test(d.phone),'Enter a valid phone number.');
 const parsedDate=new Date(d.date+'T00:00:00Z');assert(/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&!Number.isNaN(parsedDate.getTime())&&parsedDate.toISOString().slice(0,10)===d.date,'Choose a valid date.');
 assert(d.date>=dateIST(),'Please choose today or a future date.');
 const max=new Date();max.setUTCDate(max.getUTCDate()+90);assert(d.date<=max.toISOString().slice(0,10),'Reservations open up to 90 days ahead.');
 assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time),'Choose a valid preferred time.');
 if(d.date===dateIST())assert(new Date(`${d.date}T${d.time}:00+05:30`).getTime()>Date.now(),'Choose a time later than now.');
 assert(Number.isInteger(d.guests)&&d.guests>=1&&d.guests<=500,'Choose between 1 and 500 guests.');
 return d;
}
export function validateItems(raw){
 assert(Array.isArray(raw)&&raw.length>0&&raw.length<=40,'Your cart needs between 1 and 40 items.');const seen=new Set();let count=0;
 const items=raw.map(line=>{assert(line&&typeof line==='object','Invalid cart item.');const item=catalog.get(line.id);assert(item&&typeof item.price==='number','An item is unavailable for pre-order. Please update your cart.');const quantity=Number(line.quantity);assert(Number.isInteger(quantity)&&quantity>=1&&quantity<=20,'Item quantities must be between 1 and 20.');const options=variantsFor(item);const variant=clean(line.variant,160);assert(options.length?options.includes(variant):!variant,'Please select a valid item option.');const key=line.id+'|'+variant;assert(!seen.has(key),'Duplicate cart items. Please refresh your cart.');seen.add(key);count+=quantity;return {id:line.id,name:item.name,category:item.category,price:item.price,quantity,variant}});
 assert(count<=200,'For larger food orders, please call the restaurant.');return {items,subtotal:items.reduce((sum,i)=>sum+i.price*i.quantity,0)};
}
const keyValid=k=>typeof k==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(k);
async function readBody(request){assert((request.headers.get('content-type')||'').includes('application/json'),'JSON request required.',415);const text=await request.text();assert(text.length<=24000,'Request is too large.',413);try{const parsed=JSON.parse(text);assert(parsed&&typeof parsed==='object'&&!Array.isArray(parsed),'Invalid request body.');return parsed}catch{throw new InputError('Invalid request body.')}}
async function ownerFor(request){const platformId=request.headers.get('oai-authenticated-user-id');if(platformId)return 'user:'+await hash(platformId);const match=(request.headers.get('cookie')||'').match(/(?:^|;\s*)aanch_session=([a-f0-9]{64})(?:;|$)/);return match?'guest:'+await hash(match[1]):null;}
function publicBooking(row,order){return {id:row.id,reference:row.reference,...JSON.parse(row.details),status:row.status,createdAt:row.created_at,order:order?{id:order.id,items:JSON.parse(order.items),subtotal:order.subtotal,notes:order.notes,status:order.status,createdAt:order.created_at}:null}}
export async function api(request,env){
 try{
 const url=new URL(request.url);const path=url.pathname;const method=request.method;const origin=request.headers.get('origin');
 if(method!=='GET'){assert(request.headers.get('sec-fetch-site')!=='cross-site'&&(!origin||origin===url.origin),'Please submit from the Aanch website.',403)}
 if(path==='/api/session'&&method==='GET'){
  const existing=await ownerFor(request);const state=await adminSessionState(request,env);if(existing){return json({ready:true,...state})}const token=random()+random();return json({ready:true,...state},200,{'Set-Cookie':`aanch_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7776000${url.protocol==='https:'?'; Secure':''}`});
 }
 assert(env.DB,'Booking service is temporarily unavailable. Please call +91 86794 91115.',503);
 const authResponse=await adminAuthRoute(request,env);if(authResponse)return authResponse;
 const owner=await ownerFor(request);assert(owner||(path.startsWith('/api/admin/')&&await hasAdminSession(request,env)),'Please reload the page to start your booking session.',401);


 if(path==='/api/delivery-settings'&&method==='GET'){
  const row=await env.DB.prepare("SELECT value FROM settings WHERE `key` = 'restaurant_location'").first();return json({restaurant:row?JSON.parse(row.value):null,radiusKm:DELIVERY_RADIUS_KM});
 }
 if(path==='/api/admin/delivery-settings'&&method==='POST'){
  assert(await hasAdminSession(request,env),'Restaurant management access is required.',403);const body=await readBody(request);assert(validPoint(body.restaurant),'Choose a valid restaurant map pin.');assert(body.confirmed===true,'Confirm the exact restaurant entrance before saving.');
  const point={lat:body.restaurant.lat,lng:body.restaurant.lng};await env.DB.prepare("INSERT INTO settings (`key`,value) VALUES ('restaurant_location',?) ON CONFLICT(`key`) DO UPDATE SET value = excluded.value").bind(JSON.stringify(point)).run();return json({restaurant:point,radiusKm:DELIVERY_RADIUS_KM});
 }
 const foodPublic=row=>({id:row.id,reference:row.reference,...JSON.parse(row.details),items:JSON.parse(row.items),subtotal:row.subtotal,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at});
 if(path==='/api/food-orders'&&method==='GET'){
  const rows=await env.DB.prepare('SELECT * FROM food_orders WHERE owner = ? ORDER BY created_at DESC LIMIT 50').bind(owner).all();return json({orders:rows.results.map(foodPublic)});
 }
 if(path==='/api/food-orders'&&method==='POST'){
  const body=await readBody(request);assert(keyValid(body.requestKey),'Invalid request reference.');
  const old=await env.DB.prepare('SELECT * FROM food_orders WHERE owner = ? AND request_key = ?').bind(owner,body.requestKey).first();if(old)return json({order:foodPublic(old)});
  const d={name:clean(body.name,80),phone:clean(body.phone,18).replace(/[\s()+-]/g,''),mode:body.mode,address:clean(body.address,350),pincode:clean(body.pincode,6),landmark:clean(body.landmark,100),notes:clean(body.notes,500),payment:'pay_on_fulfilment'};
  assert(d.name.length>=2,'Enter your full name.');assert(/^\d{10,13}$/.test(d.phone),'Enter a valid phone number.');assert(['delivery','pickup'].includes(d.mode),'Choose delivery or pickup.');
  if(d.mode==='delivery'){assert(d.address.length>=10,'Enter your complete delivery address.');assert(/^[1-9]\d{5}$/.test(d.pincode),'Enter a valid six-digit PIN code.');
   const location=await env.DB.prepare("SELECT value FROM settings WHERE `key` = 'restaurant_location'").first();assert(location,'Delivery is not configured yet. Please choose pickup or call the restaurant.',409);const restaurant=JSON.parse(location.value);
   assert(validPoint(body.deliveryPin),'Pin your delivery location on the map.');assert(eligiblePoint(restaurant,body.deliveryPin),'Your pin is outside our 5 km delivery radius. Please choose pickup.',400);
   d.deliveryPin={lat:body.deliveryPin.lat,lng:body.deliveryPin.lng};d.restaurantPin=restaurant;d.distanceKm=Math.round(distanceKm(restaurant,d.deliveryPin)*1000)/1000;
}else{d.address='';d.pincode='';d.landmark='';}
  assert(body.agreed===true,'Please accept restaurant confirmation of availability and final charges.');
  const checked=validateItems(body.items);const recent=await env.DB.prepare('SELECT COUNT(*) AS count FROM food_orders WHERE owner = ? AND created_at > ?').bind(owner,new Date(Date.now()-3600000).toISOString()).first();assert(recent.count<15,'Too many requests. Please contact the restaurant.',429);
  const id=random(),now=new Date().toISOString();await env.DB.prepare("INSERT OR IGNORE INTO food_orders (id,reference,owner,request_key,details,items,subtotal,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'requested',?,?)").bind(id,'FOOD-'+id.slice(0,12).toUpperCase(),owner,body.requestKey,JSON.stringify(d),JSON.stringify(checked.items),checked.subtotal,now,now).run();
  const row=await env.DB.prepare('SELECT * FROM food_orders WHERE owner = ? AND request_key = ?').bind(owner,body.requestKey).first();return json({order:foodPublic(row)},201);
 }
 const foodCancel=path.match(/^\/api\/food-orders\/([a-f0-9]{32})\/cancel$/);
 if(foodCancel&&method==='POST'){
  const row=await env.DB.prepare('SELECT * FROM food_orders WHERE id = ? AND owner = ?').bind(foodCancel[1],owner).first();assert(row,'Order not found.',404);assert(['requested','cancelled'].includes(row.status),'Please call the restaurant to cancel an accepted order.',409);
  await env.DB.prepare("UPDATE food_orders SET status = 'cancelled',updated_at = ? WHERE id = ? AND owner = ? AND status = 'requested'").bind(new Date().toISOString(),row.id,owner).run();const updated=await env.DB.prepare('SELECT * FROM food_orders WHERE id = ? AND owner = ?').bind(row.id,owner).first();assert(updated.status==='cancelled','Order was accepted. Please call the restaurant.',409);return json({order:foodPublic(updated)});
 }
 if(path==='/api/admin/food-orders'&&method==='GET'){
  assert(await hasAdminSession(request,env),'Restaurant management access is required.',403);const rows=await env.DB.prepare('SELECT * FROM food_orders ORDER BY created_at DESC LIMIT 150').all();return json({orders:rows.results.map(foodPublic)});
 }
 const foodAdmin=path.match(/^\/api\/admin\/food-orders\/([a-f0-9]{32})$/);
 if(foodAdmin&&method==='POST'){
  assert(await hasAdminSession(request,env),'Restaurant management access is required.',403);const body=await readBody(request);const row=await env.DB.prepare('SELECT * FROM food_orders WHERE id = ?').bind(foodAdmin[1]).first();assert(row,'Order not found.',404);
  const mode=JSON.parse(row.details).mode;const transitions={requested:['accepted','cancelled'],accepted:['preparing','cancelled'],preparing:['ready','cancelled'],ready:mode==='delivery'?['out_for_delivery','cancelled']:['completed','cancelled'],out_for_delivery:['completed','cancelled'],completed:[],cancelled:[]};assert(transitions[row.status]?.includes(body.status),'This status transition is not available. Refresh the order.',409);
  const result=await env.DB.prepare('UPDATE food_orders SET status = ?,updated_at = ? WHERE id = ? AND status = ?').bind(body.status,new Date().toISOString(),row.id,row.status).run();assert(result.meta.changes===1,'Order changed. Please refresh.',409);return json({order:foodPublic(await env.DB.prepare('SELECT * FROM food_orders WHERE id = ?').bind(row.id).first())});
 }
 if(path.startsWith('/api/admin/')){
  assert(await hasAdminSession(request,env),'Restaurant management access is required.',403);
  if(path==='/api/admin/notifications'&&method==='GET'){
   const feed=await notificationFeed(env.DB,url.searchParams.get('cursor'));
   assert(!feed.invalid,'Invalid notification cursor.');return json(feed);
  }
  if(path==='/api/admin/bookings'&&method==='GET'){
   const rows=await env.DB.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 150').all();const bookings=[];
   for(const row of rows.results){const order=await env.DB.prepare('SELECT * FROM orders WHERE booking_id = ?').bind(row.id).first();bookings.push(publicBooking(row,order));}return json({bookings});
  }
  const adminMatch=path.match(/^\/api\/admin\/bookings\/([a-f0-9]{32})$/);
  if(adminMatch&&method==='POST'){
   const body=await readBody(request);assert(['confirmed','cancelled'].includes(body.status),'Choose a valid booking status.');
   const row=await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(adminMatch[1]).first();assert(row,'Booking not found.',404);
   if(body.status==='confirmed')assert(row.status==='requested'||row.status==='confirmed','A cancelled booking cannot be confirmed.',409);
   await env.DB.batch([
    env.DB.prepare("UPDATE bookings SET status = ? WHERE id = ? AND status IN ('requested','confirmed')").bind(body.status,row.id),
    env.DB.prepare("UPDATE orders SET status = ? WHERE booking_id = ? AND EXISTS (SELECT 1 FROM bookings WHERE id = ? AND status = ?)").bind(body.status==='confirmed'?'accepted':'cancelled',row.id,row.id,body.status)
   ]);
   const updated=await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(row.id).first();assert(updated.status===body.status,'The request changed. Refresh and try again.',409);
   const order=await env.DB.prepare('SELECT * FROM orders WHERE booking_id = ?').bind(row.id).first();return json({booking:publicBooking(updated,order)});
  }
  return json({error:'Not found.'},404);
 }
 if(path==='/api/bookings'&&method==='GET'){
  const rows=await env.DB.prepare('SELECT * FROM bookings WHERE owner = ? ORDER BY created_at DESC LIMIT 50').bind(owner).all();
  const result=[];for(const row of rows.results){const order=await env.DB.prepare('SELECT * FROM orders WHERE booking_id = ? AND owner = ?').bind(row.id,owner).first();result.push(publicBooking(row,order));}return json({bookings:result});
 }
 if(path==='/api/bookings'&&method==='POST'){
  const body=await readBody(request);assert(keyValid(body.requestKey),'Invalid request reference. Please refresh.');
  const previous=await env.DB.prepare('SELECT * FROM bookings WHERE owner = ? AND request_key = ?').bind(owner,body.requestKey).first();if(previous)return json({booking:publicBooking(previous,null)});
  const d=validateDetails(body);const recent=await env.DB.prepare("SELECT COUNT(*) AS count FROM bookings WHERE owner = ? AND created_at > ?").bind(owner,new Date(Date.now()-3600000).toISOString()).first();assert(recent.count<15,'You have sent several requests. Please call us for further assistance.',429);
  const id=random();const reference='AAN-'+id.slice(0,12).toUpperCase();const now=new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO bookings (id,reference,owner,request_key,details,status,created_at) VALUES (?,?,?,?,?,'requested',?)").bind(id,reference,owner,body.requestKey,JSON.stringify(d),now).run();
  const row=await env.DB.prepare('SELECT * FROM bookings WHERE owner = ? AND request_key = ?').bind(owner,body.requestKey).first();return json({booking:publicBooking(row,null)},201);
 }
 const match=path.match(/^\/api\/bookings\/([a-f0-9]{32})(?:\/(order|cancel))?$/);if(match){
  const row=await env.DB.prepare('SELECT * FROM bookings WHERE id = ? AND owner = ?').bind(match[1],owner).first();assert(row,'Booking not found.',404);
  if(method==='GET'&&!match[2]){const order=await env.DB.prepare('SELECT * FROM orders WHERE booking_id = ? AND owner = ?').bind(row.id,owner).first();return json({booking:publicBooking(row,order)})}
  if(method==='POST'&&match[2]==='order'){
   const body=await readBody(request);assert(keyValid(body.requestKey),'Invalid request reference.');assert(['requested','confirmed'].includes(row.status),'This booking is no longer accepting pre-orders.',409);
   const old=await env.DB.prepare('SELECT * FROM orders WHERE booking_id = ? AND owner = ?').bind(row.id,owner).first();if(old){assert(old.request_key===body.requestKey,'This booking already has a pre-order. View it in My bookings.',409);return json({booking:publicBooking(row,old)})}
   const checked=validateItems(body.items);const notes=clean(body.notes,500);const id=random();const now=new Date().toISOString();
   await env.DB.prepare("INSERT OR IGNORE INTO orders (id,booking_id,owner,request_key,items,subtotal,notes,status,created_at) SELECT ?,?,?,?,?,?,?,'requested',? WHERE EXISTS (SELECT 1 FROM bookings WHERE id = ? AND owner = ? AND status IN ('requested','confirmed'))").bind(id,row.id,owner,body.requestKey,JSON.stringify(checked.items),checked.subtotal,notes,now,row.id,owner).run();
   const order=await env.DB.prepare('SELECT * FROM orders WHERE booking_id = ? AND owner = ?').bind(row.id,owner).first();assert(order&&order.request_key===body.requestKey,'This booking was updated. Please view My bookings.',409);return json({booking:publicBooking(row,order)},201);
  }
  if(method==='POST'&&match[2]==='cancel'){
   assert(row.status==='requested'||row.status==='cancelled','Please call the restaurant to change this booking.',409);
   await env.DB.batch([env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND owner = ? AND status = 'requested'").bind(row.id,owner),env.DB.prepare("UPDATE orders SET status = 'cancelled' WHERE booking_id = ? AND owner = ? AND EXISTS (SELECT 1 FROM bookings WHERE id = ? AND owner = ? AND status = 'cancelled')").bind(row.id,owner,row.id,owner)]);
   const order=await env.DB.prepare('SELECT * FROM orders WHERE booking_id = ? AND owner = ?').bind(row.id,owner).first();const updated=await env.DB.prepare('SELECT * FROM bookings WHERE id = ? AND owner = ?').bind(row.id,owner).first();assert(updated.status==='cancelled','This booking was confirmed. Please call the restaurant to cancel.',409);return json({booking:publicBooking(updated,order)});
  }
 }
 return json({error:'Not found.'},404);
 }catch(error){if(error instanceof InputError)return json({error:error.message},error.status);console.error('Booking API failure',error.name);return json({error:'We could not save your request. Please try again or call +91 86794 91115.'},503)}
}
