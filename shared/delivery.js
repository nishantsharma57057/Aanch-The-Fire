export const DELIVERY_RADIUS_KM=5;
export function validPoint(p){return !!p&&typeof p.lat==='number'&&typeof p.lng==='number'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;}
export function distanceKm(a,b){const rad=n=>n*Math.PI/180;const dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;return 6371.0088*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function eligiblePoint(origin,pin){return validPoint(origin)&&validPoint(pin)&&distanceKm(origin,pin)<=DELIVERY_RADIUS_KM;}
