// Dish-specific illustrative photos. Wikimedia Commons files are credited in FOOD-IMAGE-CREDITS.md.
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

const localFallback = {
  indian: '/images/paneer.webp',
  snacks: '/images/snacks.webp',
  meal: '/images/feast.webp'
};

export function foodPhoto(item) {
  const name = String(item?.name || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();

  if (/dosa/.test(name)) return photos.dosa;
  if (/uttapam/.test(name)) return photos.uttapam;
  if (/idli|vada/.test(name)) return photos.idli;
  if (/dhokla/.test(name)) return photos.dhokla;
  if (/poha|upma|sprouts/.test(name)) return photos.poha;

  if (/noodle|fried rice/.test(name)) return photos.noodles;
  if (/manchurian|chilli paneer|chilli potato|spring roll|chinese bhel|crispy corn/.test(name)) return photos.manchurian;
  if (/pizza/.test(name)) return photos.pizza;
  if (/fries/.test(name)) return photos.fries;
  if (/soup/.test(name)) return photos.soup;
  if (/sandwich|bread butter/.test(name)) return photos.sandwich;

  if (/paneer tikka|chaap/.test(name) || /tandoori|sizzler/.test(category)) return photos.paneerTikka;
  if (/gulab jamun/.test(name)) return photos.gulabJamun;
  if (/ice cream|sundae/.test(name)) return photos.iceCream;

  if (/tea/.test(name)) return photos.chai;
  if (/lassi|chhaach|lime soda/.test(name)) return photos.lassi;
  if (/coffee|shake/.test(name)) return photos.shake;

  if (/paneer|kaju|dal|chana|mushroom|dum aloo|mix veg|matar|navratan|soya|sev bhaji/.test(name)
    || /north indian|handi/.test(category)) return localFallback.indian;

  if (/thali|combo|pav bhaji|chhole bhature|roti|naan|paratha|rice|pulao|raita|salad|papad|curd/.test(name)
    || /breads|thalis|meals/.test(category)) return photos.thali;

  if (/beverages|shakes/.test(category)) return photos.lassi;
  if (/pizza|continental|chinese|sandwich|soup/.test(category)) return localFallback.snacks;
  return localFallback.meal;
}

export function foodPhotoFallback(item) {
  const category = String(item?.category || '').toLowerCase();
  if (/north indian|handi|tandoori/.test(category)) return localFallback.indian;
  if (/chinese|continental|sandwich|soup/.test(category)) return localFallback.snacks;
  return localFallback.meal;
}

export function pinterestSearchUrl(item) {
  const dishName = String(item?.name || 'Indian food').trim() || 'Indian food';
  return 'https://in.pinterest.com/search/pins/?q=' + encodeURIComponent(dishName) + '&rs=typed';
}
