import {sqliteTable,text,integer,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const bookings=sqliteTable('bookings',{
 id:text('id').primaryKey(),reference:text('reference').notNull().unique(),owner:text('owner').notNull(),requestKey:text('request_key').notNull(),details:text('details').notNull(),status:text('status').notNull().default('requested'),createdAt:text('created_at').notNull()
},t=>[uniqueIndex('booking_owner_request').on(t.owner,t.requestKey)]);
export const orders=sqliteTable('orders',{
 id:text('id').primaryKey(),bookingId:text('booking_id').notNull().references(()=>bookings.id),owner:text('owner').notNull(),requestKey:text('request_key').notNull(),items:text('items').notNull(),subtotal:integer('subtotal').notNull(),notes:text('notes').notNull().default(''),status:text('status').notNull().default('requested'),createdAt:text('created_at').notNull()
},t=>[uniqueIndex('one_order_per_booking').on(t.bookingId)]);
export const foodOrders=sqliteTable('food_orders',{
 id:text('id').primaryKey(),reference:text('reference').notNull().unique(),owner:text('owner').notNull(),requestKey:text('request_key').notNull(),details:text('details').notNull(),items:text('items').notNull(),subtotal:integer('subtotal').notNull(),status:text('status').notNull().default('requested'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[uniqueIndex('food_owner_request').on(t.owner,t.requestKey)]);
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const adminMfa=sqliteTable('admin_mfa',{
 ownerKey:text('owner_key').primaryKey(),secret:text('secret'),pendingSecret:text('pending_secret'),pendingExpires:integer('pending_expires').notNull().default(0),enabled:integer('enabled').notNull().default(0),lastCounter:integer('last_counter').notNull().default(-1),attempts:integer('attempts').notNull().default(0),windowStarted:integer('window_started').notNull().default(0)
});
export const adminSessions=sqliteTable('admin_sessions',{
 tokenHash:text('token_hash').primaryKey(),ownerKey:text('owner_key').notNull().references(()=>adminMfa.ownerKey),expiresAt:integer('expires_at').notNull()
});
