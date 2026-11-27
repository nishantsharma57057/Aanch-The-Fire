// Every menu item gets its own food-specific search URL and deterministic unique lock.
// The previous category-level mapping reused the same image across many dishes.
// LoremFlickr searches tagged photos; results are illustrative and may not be an exact plating match.

function hashKey(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) + 1;
}

function imageKeywords(item) {
  const name = item.name
    .replace(/\\(.*?\\)/g, '')
    .replace(/\\//g, ' ')
    .replace(/[—–]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
    .split(/\\s+/)
    .filter(word => word.length > 2 && !['any', 'with', 'one', 'pcs', 'extra', 'single'].includes(word));

  const category = item.category.toLowerCase();
  const foodContext = /chinese/.test(category) ? 'chinese-food'
    : /beverage|shake/.test(category) ? 'indian-drink'
    : /dessert/.test(category) ? 'indian-dessert'
    : /pizza|continental/.test(category) ? 'restaurant-food'
    : 'indian-food';

  return [foodContext, ...name].join(',');
}

export function foodPhoto(item) {
  const uniqueKey = `${item.category}::${item.name}`;
  const lock = hashKey(uniqueKey);
  const tags = imageKeywords(item);
  return `https://loremflickr.com/640/450/${tags}?lock=${lock}`;
}
