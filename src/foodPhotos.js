// Pinterest-inspired food photography mood: warm light, close crops and rich natural colour.
// Use licensed Unsplash photo URLs for the live menu rather than reposting copyrighted Pinterest pins.
const photos = {
  dosa: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=900&q=82',
  idli: 'https://images.unsplash.com/photo-1589301760014-d929f3979efe?auto=format&fit=crop&w=900&q=82',
  paneer: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=82',
  curry: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=82',
  tikka: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=900&q=82',
  chinese: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=82',
  pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=82',
  pasta: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=82',
  thali: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=82',
  rice: 'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=900&q=82',
  bread: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=82',
  beverage: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=82',
  dessert: 'https://images.unsplash.com/photo-1551024506-0f1f1b7e9f5b?auto=format&fit=crop&w=900&q=82',
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=82',
  salad: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=82',
};

export function foodPhoto(item) {
  const name = item.name.toLowerCase();
  const category = item.category.toLowerCase();
  if (/dosa|uttapam/.test(name) || category.includes('south indian')) return photos.dosa;
  if (/idli|vada|sambhar|sambar/.test(name)) return photos.idli;
  if (/paneer|kofta|chaap|tikka|malai/.test(name)) return /tikka|chaap/.test(name) ? photos.tikka : photos.paneer;
  if (/noodle|fried rice|manchurian|chilli|spring roll|corn|bhel/.test(name) || category.includes('chinese')) return photos.chinese;
  if (/pizza/.test(name)) return photos.pizza;
  if (/pasta/.test(name)) return photos.pasta;
  if (/thali|combo|meal|pav bhaji|chhole bhature/.test(name) || category.includes('thalis')) return photos.thali;
  if (/biryani|rice|pulao/.test(name)) return photos.rice;
  if (/roti|naan|paratha|bhature|pav/.test(name)) return photos.bread;
  if (/tea|coffee|shake|lassi|soda|drink|water|chhaach/.test(name) || category.includes('beverages')) return photos.beverage;
  if (/ice cream|sundae|gulab jamun|dessert/.test(name) || category.includes('dessert')) return photos.dessert;
  if (/salad|raita|curd|papad/.test(name)) return photos.salad;
  if (category.includes('breakfast')) return photos.breakfast;
  return photos.curry;
}
