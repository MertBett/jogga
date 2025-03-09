const CACHE_NAME = 'jogga-cache-v1';

const FILES_TO_CACHE = [
  '/jogga/',
  '/jogga/index.html',
  '/jogga/index.css',
  '/jogga/index.js',
  '/jogga/manifest.json',
  '/jogga/icons/jogga_icon_bigger_brighter_180.png',
  '/jogga/icons/jogga_icon_bigger_brighter_192.png',
  '/jogga/icons/jogga_icon_bigger_brighter_512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css',
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js',
  'https://unpkg.com/leaflet/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet/dist/images/marker-shadow.png',
  'https://unpkg.com/leaflet/dist/images/marker-icon-2x.png'
];


// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
const enableNavigationPreload = async () => {
  if (self.registration.navigationPreload) {
    await self.registration.navigationPreload.enable();
  }
};

self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  
  self.skipWaiting();
  
  // download all the files into the cache
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app files');
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch(error => {
        console.error('Caching failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  // activate the pre load
  event.waitUntil(enableNavigationPreload());
  // should really have a bit deleting old caches 
  // but I don't think I need to when its not commercial
});

self.addEventListener('fetch', (event) => {
   // dont cache map tiles, too many 
  if (event.request.url.includes('tile.openstreetmap.org')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    (async () => {
      // if thing is in cache then return it
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // get it from the web and cache it after (quicker because pre load)
      const preloadResponse = await event.preloadResponse;
      if (preloadResponse) {
        console.info('Using navigation preload response');
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, preloadResponse.clone());
        return preloadResponse;
      }
      
      // get it from the web and cache it after (slower because no pre load)
      try {
        const networkResponse = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch (error) {
         // couldnt get it so errors
         // think I'll make this a js popup or something later since the map wont show
         // but tracking should work (?)
        if (event.request.mode === 'navigate') {
          return new Response('You are offline. Some features may not work.', {
            headers: { 'Content-Type': 'text/plain' }
          });
        }
        
        return new Response('Offline resource not available', {
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});