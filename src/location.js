// Keep device permissions and location acquisition separate from map rendering.
export function locationError(error) {
  if (error?.code === 1) return 'Location permission is blocked. Allow Location in your browser site settings and device settings, then try again. If this page is embedded, open the website directly in a new tab. You can also place the pin manually.';
  if (error?.code === 3) return 'Your device took too long to find its location. Move near a window, check Location Services, and try again or place the pin manually.';
  return 'Your device could not determine its location. Turn on Location Services and Wi-Fi, then retry or place the pin manually.';
}
export async function requestLocation(geolocation, {secure = true, signal} = {}) {
  if (!secure) throw new Error('Location requires a secure HTTPS page. Open the website directly in your browser.');
  if (!geolocation) throw new Error('This browser does not support location. Place your pin on the map instead.');
  const read = options => new Promise((resolve, reject) => {
    if(signal?.aborted) return reject(new Error('Location cancelled.'));
    const abort = () => reject(new Error('Location cancelled.'));
    signal?.addEventListener('abort', abort, {once:true});
    const finish = fn => value => {signal?.removeEventListener('abort', abort);if(!signal?.aborted) fn(value)};
    geolocation.getCurrentPosition(finish(resolve), finish(reject), options);
  });
  try {
    let result;
    try { result = await read({enableHighAccuracy:true, timeout:10000, maximumAge:0}); }
    catch(error) {
      if(error.code === 1 || signal?.aborted) throw error;
      result = await read({enableHighAccuracy:false, timeout:10000, maximumAge:30000});
    }
    const {latitude:lat, longitude:lng, accuracy} = result.coords;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) throw new Error('The device returned an invalid location. Please place your pin manually.');
    return {lat,lng,accuracy};
  } catch(error) {throw error?.code?new Error(locationError(error)):error instanceof Error?error:new Error(locationError(error));}
}
