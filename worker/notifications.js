// Read existing records: no separate notification write can fail during checkout.
export async function notificationFeed(DB, rawCursor) {
  const now = Date.now();
  const floor = new Date(now - 86400000).toISOString();
  let cursor = {at: floor, key: ''};
  let until = new Date(now).toISOString();
  if (rawCursor) {
    try {
      const parsed = JSON.parse(rawCursor);
      if (typeof parsed.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(parsed.at) || !Number.isFinite(Date.parse(parsed.at)) || typeof parsed.key !== 'string' || parsed.key.length > 80) throw Error();
      if (parsed.until && (!Number.isFinite(Date.parse(parsed.until)) || Date.parse(parsed.until) < Date.parse(parsed.at))) throw Error();
      until = parsed.until ? new Date(Math.min(now, Date.parse(parsed.until))).toISOString() : until;
      cursor = {at: new Date(Math.min(now, Math.max(Date.parse(floor), Date.parse(parsed.at) - (parsed.until ? 0 : 60000)))).toISOString(), key: parsed.until ? parsed.key : ''};
    } catch { return {invalid: true}; }
  }
  const afterId = type => !cursor.key || type > cursor.key.split(':')[0] ? '' : type < cursor.key.split(':')[0] ? 'z' : cursor.key.split(':')[1] || '';
  const [tables, food, preorders] = await Promise.all([
    DB.prepare('SELECT id,reference,details,status,created_at FROM bookings WHERE created_at >= ? AND created_at <= ? AND (created_at > ? OR id > ?) ORDER BY created_at ASC,id ASC LIMIT 101').bind(cursor.at, until, cursor.at, afterId('table')).all(),
    DB.prepare('SELECT id,reference,details,subtotal,status,created_at FROM food_orders WHERE created_at >= ? AND created_at <= ? AND (created_at > ? OR id > ?) ORDER BY created_at ASC,id ASC LIMIT 101').bind(cursor.at, until, cursor.at, afterId('food')).all(),
    DB.prepare('SELECT o.id,o.created_at,o.subtotal,o.status,b.reference,b.details FROM orders o JOIN bookings b ON b.id = o.booking_id WHERE o.created_at >= ? AND o.created_at <= ? AND (o.created_at > ? OR o.id > ?) ORDER BY o.created_at ASC,o.id ASC LIMIT 101').bind(cursor.at, until, cursor.at, afterId('preorder')).all()
  ]);
  const events = [];
  for (const [type, rows] of [['table', tables.results], ['food', food.results], ['preorder', preorders.results]]) {
    for (const row of rows) {
      const d = JSON.parse(row.details);
      const key = type + ':' + row.id;
      if (row.created_at === cursor.at && key <= cursor.key) continue;
      events.push({key, createdAt: row.created_at, reference: row.reference, status: row.status,
        title: type === 'table' ? 'New table booking' : type === 'preorder' ? 'New table food pre-order' : d.mode === 'delivery' ? 'New delivery order' : 'New pickup order',
        detail: type === 'table' ? `${d.guests} guests · ${d.date} · ${d.time}` : `₹${Number(row.subtotal).toLocaleString('en-IN')} before taxes`,
        name: d.name, href: type === 'food' ? '/admin/orders' : '/admin/bookings'});
    }
  }
  events.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key));
  const page = events.slice(0, 100);
  const hasMore = events.length > 100;
  // Overlap completed pages by 60s to include transactions committing during a poll.
  // The client deduplicates stable event keys (including across tabs).
  const last = page.at(-1);
  return {events: page, hasMore, cursor: hasMore ? {at: last.createdAt, key: last.key, until} : {at: until, key: ''}};
}
