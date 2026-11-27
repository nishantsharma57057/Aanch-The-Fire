// Unique food-photo search URL for each menu item.
function hashKey(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) + 1;
}

function imageKeywords(item) {
  const name = String(item?.name || '')
    .replace(/\(.*?\)/g, '')
    .replace(/\//g, ' ')
    .replace(/[—–]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 2 && !['any', 'with', 'one', 'pcs', 'extra', 'single'].includes(word));

  const category = String(item?.category || '').toLowerCase();
  const foodContext = /chinese/.test(category) ? 'chinese-food'
    : /beverage|shake/.test(category) ? 'indian-drink'
    : /dessert/.test(category) ? 'indian-dessert'
    : /pizza|continental/.test(category) ? 'restaurant-food'
    : 'indian-food';

  return [foodContext, ...name].join(',');
}

export function foodPhoto(item) {
  const uniqueKey = String(item?.category || '') + '::' + String(item?.name || '');
  const lock = hashKey(uniqueKey);
  const tags = imageKeywords(item);
  return 'https://loremflickr.com/640/450/' + encodeURIComponent(tags).replace(/%2C/g, ',') + '?lock=' + lock;
}
