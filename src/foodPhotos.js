// Related dishes are intentionally assigned to shared photo groups.
// This keeps Plain Dosa, Masala Dosa, Paneer Dosa, etc. visually consistent.
// Individual menu items and their prices remain separate in menu.js.

const commonsPhoto = filename =>
  'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(filename) + '?width=720';

const photos = {
  dosa: commonsPhoto('Plain Dosa.jpg'),
  idli: commonsPhoto('Idli plate with sambar and coconut chutney.jpg'),
  uttapam: commonsPhoto('Mixed Uttapam.jpg'),
  dhokla: commonsPhoto('Dhokla Dhokla.jpg'),
  poha: commonsPhoto('Poha and toast.jpg'),
  paneerTikka: commonsPhoto('Paneer Tikka in Food.jpg'),
  thali: commonsPhoto('Punjabi Thali.JPG'),
  noodles: commonsPhoto('Veg Hakka Noodles.jpg'),
  manchurian: commonsPhoto('Veg manchurian recipe.jpg'),
  pizza: commonsPhoto('Vegetarian Pizza.jpg'),
  fries: commonsPhoto('French Fries.jpg'),
  soup: commonsPhoto('TOMATO SOUP.JPG'),
  sandwich: commonsPhoto('Sandwich tasty food.jpg'),
  chai: commonsPhoto('Masala Chai.JPG'),
  lassi: commonsPhoto('Buttermilk and lassi.jpg'),
  shake: commonsPhoto('Chocolate Milk Shake.jpg'),
  iceCream: commonsPhoto('ICECREAM.jpg'),
  gulabJamun: commonsPhoto('Gulab Jamun Indian Dessert.jpg')
};

// Existing Aanch photos are used as reliable fallbacks for groups without
// a dedicated representative image.
const localPhotos = {
  paneer: '/images/paneer.webp',
  snacks: '/images/snacks.webp',
  feast: '/images/feast.webp'
};

// Ordered from specific to broad so a dish is matched to the best group.
const photoGroups = [
  { id: 'dosa', label: 'Dosa varieties', match: /\bdosa\b/, src: photos.dosa },
  { id: 'uttapam', label: 'Uttapam varieties', match: /\buttapam\b/, src: photos.uttapam },
  { id: 'idli-vada', label: 'Idli & Vada', match: /\bidli\b|\bvada\b/, src: photos.idli },
  { id: 'dhokla', label: 'Dhokla', match: /\bdhokla\b/, src: photos.dhokla },
  { id: 'poha-upma', label: 'Poha & Upma', match: /\bpoha\b|\bupma\b|\bsprouts\b/, src: photos.poha },

  { id: 'pizza', label: 'Pizza varieties', match: /\bpizza\b/, src: photos.pizza },
  { id: 'pasta', label: 'Pasta varieties', match: /\bpasta\b/, src: localPhotos.snacks },
  { id: 'paneer-tikka-chaap', label: 'Paneer Tikka & Chaap', match: /paneer tikka|chaap|paneer 65|shashlik/, src: photos.paneerTikka },
  { id: 'sizzlers', label: 'Sizzlers', match: /\bsizzler/, src: localPhotos.feast },

  { id: 'noodles-rice', label: 'Chinese Noodles & Rice', match: /noodle|fried rice/, src: photos.noodles },
  { id: 'indo-chinese-starters', label: 'Indo-Chinese Starters', match: /manchurian|chilli paneer|chilli potato|spring roll|chinese bhel|crispy corn|chilli mushroom|peanut masala/, src: photos.manchurian },
  { id: 'fries', label: 'Fries', match: /\bfries\b/, src: photos.fries },
  { id: 'soups', label: 'Soups', match: /\bsoup\b/, src: photos.soup },
  { id: 'sandwiches', label: 'Sandwich varieties', match: /sandwich|bread butter/, src: photos.sandwich },

  { id: 'raita-curd-sides', label: 'Raita, Curd & Sides', match: /combo raita|raita|curd|papad|salad/, src: localPhotos.feast },
  { id: 'breads-rice-thali', label: 'Breads, Rice & Thalis', match: /thali|combo|pav bhaji|chhole bhature|extra pav|extra bhature|roti|naan|paratha|rice|pulao|biryani/, src: photos.thali },

  { id: 'dal-curries', label: 'Dal Varieties', match: /\bdal\b/, src: localPhotos.paneer },
  { id: 'vegetable-curries', label: 'Vegetable Curries', match: /kaju curry|malai kofta|chana masala|dum aloo|mix veg|matar|navratan|mushroom|soya chaap gravy|sev bhaji|aloo jeera|aloo masala/, src: localPhotos.paneer },
  { id: 'paneer-curries', label: 'Paneer Curries', match: /paneer|handi paneer/, src: localPhotos.paneer },

  { id: 'tea', label: 'Tea', match: /\btea\b|\bchai\b/, src: photos.chai },
  { id: 'coffee', label: 'Coffee', match: /\bcoffee\b/, src: photos.shake },
  { id: 'lassi-coolers', label: 'Lassi & Coolers', match: /lassi|chhaach|lime soda|iced tea/, src: photos.lassi },
  { id: 'shakes', label: 'Shake varieties', match: /shake/, src: photos.shake },
  { id: 'cold-drinks', label: 'Cold Drinks & Water', match: /soft drink|mineral water/, src: photos.lassi },

  { id: 'gulab-jamun', label: 'Gulab Jamun', match: /gulab jamun/, src: photos.gulabJamun },
  { id: 'ice-cream', label: 'Ice Cream & Sundaes', match: /ice cream|sundae/, src: photos.iceCream }
];

export function foodPhotoGroup(item) {
  const name = String(item?.name || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();

  const matched = photoGroups.find(group => group.match.test(name));
  if (matched) return { id: matched.id, label: matched.label, src: matched.src };

  if (/beverages|shakes/.test(category)) {
    return { id: 'beverages', label: 'Beverages', src: photos.lassi };
  }
  if (/chinese/.test(category)) {
    return { id: 'indo-chinese', label: 'Indo-Chinese', src: photos.manchurian };
  }
  if (/tandoori/.test(category)) {
    return { id: 'tandoori', label: 'Tandoori Starters', src: photos.paneerTikka };
  }
  if (/north indian|handi/.test(category)) {
    return { id: 'indian-curries', label: 'Indian Curries', src: localPhotos.paneer };
  }
  return { id: 'aanch-favourites', label: 'Aanch Favourites', src: localPhotos.feast };
}

export function foodPhoto(item) {
  return foodPhotoGroup(item).src;
}

export function foodPhotoFallback(item) {
  const category = String(item?.category || '').toLowerCase();
  if (/north indian|handi|tandoori/.test(category)) return localPhotos.paneer;
  if (/chinese|continental|sandwich|soup/.test(category)) return localPhotos.snacks;
  return localPhotos.feast;
}

// Keep Pinterest searches specific to each item, even when photos are shared
// by a larger visual group.
export function pinterestSearchUrl(item) {
  const dishName = String(item?.name || 'Indian food').trim() || 'Indian food';
  return 'https://in.pinterest.com/search/pins/?q=' + encodeURIComponent(dishName) + '&rs=typed';
}
