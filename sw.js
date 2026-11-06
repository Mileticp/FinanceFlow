/* Generated manifest below; run npm run build:shell after changing shell files. */
// BEGIN GENERATED SHELL
const RELEASE = {
  "version": "v2.1.1-138c98020d8113fc",
  "assets": [
    {
      "url": "./index.html",
      "sha256": "5a3237e00a10667f3c3cc03069de2f35380a5886a74b8f4e913324eba2198fa3"
    },
    {
      "url": "./shell/supabase.min.bee24fc29228ed5a.js",
      "sha256": "bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af"
    },
    {
      "url": "./shell/shift-time.43bb250123b08678.js",
      "sha256": "43bb250123b08678a8a097e2bb1e3c0b0d8e2c8f9a96fe0a50b5ad2714012816"
    },
    {
      "url": "./shell/v2.b5e8789862ba63e9.css",
      "sha256": "b5e8789862ba63e9a24b00117522fcbb66149a51e987005cb3bd1b312afd3224"
    },
    {
      "url": "./shell/core.25af5f502ed11d50.js",
      "sha256": "25af5f502ed11d500d0e94d431ee21140d8922f8cd04be86ac48c71acf9ceee6"
    },
    {
      "url": "./shell/importer.9901f89a8a676387.js",
      "sha256": "9901f89a8a67638791adb25676c5432b4c230fb796dbf9e90e000af2854341b3"
    },
    {
      "url": "./shell/app.155aca25d45f90ef.js",
      "sha256": "155aca25d45f90ef6f0e5595be5bfcea6a06feb47d505925d3ea09c5edc63e1d"
    },
    {
      "url": "./shell/sw-client.2da3544ffdb2a55a.js",
      "sha256": "2da3544ffdb2a55a2cc6b4116637e407896fcdc9ecb1dfc862e549d722546875"
    },
    {
      "url": "./food.html",
      "sha256": "9887277b42305195ffa2c4a589d359b6a10fe27ca294c9676bfee1d8e9a58255"
    },
    {
      "url": "./manifest.webmanifest",
      "sha256": "ecb3528a2b81365a412b2a914e08f4ffacb852557a8dcb97058dabfe6ebb4ed3"
    },
    {
      "url": "./icon-192.png",
      "sha256": "e96161e7836a456b3f5c5b2ee85e3e01f628af541e368166a3a29cbe25db6175"
    },
    {
      "url": "./icon-512.png",
      "sha256": "9e414798f042b089cd097f852516b31fba0438d9d6171b2949bf88e2ea9150bd"
    }
  ]
};
// END GENERATED SHELL
const CACHE = 'financeflow-shell-' + RELEASE.version;
const assets = new Map(RELEASE.assets.map(asset => [new URL(asset.url, self.registration.scope).href, asset]));
const indexURL = new URL('./index.html', self.registration.scope).href;
const rootURL = new URL('./', self.registration.scope).href;

async function verifiedResponse(asset) {
 const response = await fetch(new Request(new URL(asset.url, self.registration.scope), {cache:'no-store', credentials:'same-origin', redirect:'error'}));
 if (!response.ok) throw Error('Shell asset unavailable: ' + asset.url);
 const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
 const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
 if (hash !== asset.sha256) throw Error('Shell asset version mismatch: ' + asset.url);
 return response;
}
self.addEventListener('install', event => event.waitUntil((async () => {
 const existed = await caches.has(CACHE);
 try {
  // Validate the entire deployment before publishing this worker or touching old caches.
  const responses = await Promise.all(RELEASE.assets.map(verifiedResponse));
  const cache = await caches.open(CACHE);
  await Promise.all(RELEASE.assets.map((asset, i) => cache.put(new URL(asset.url, self.registration.scope), responses[i])));
  await self.skipWaiting();
 } catch (error) {
  if (!existed) await caches.delete(CACHE);
  throw error;
 }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
 // This worker can activate only after its complete, verified shell is installed.
 await Promise.all((await caches.keys()).filter(key => key.startsWith('financeflow-shell-') && key !== CACHE).map(key => caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener('message', event => {
 if (event.data?.type === 'GET_SHELL_VERSION') event.ports[0]?.postMessage({version:RELEASE.version});
});
self.addEventListener('fetch', event => {
 const request = event.request, url = new URL(request.url);
 if (request.method !== 'GET' || url.origin !== self.location.origin) return;
 const isIndex = request.mode === 'navigate' && [rootURL, indexURL].includes(url.origin + url.pathname);
 const key = isIndex ? indexURL : url.href, asset = assets.get(key);
 // Exact public-shell allowlist. No API/auth/import/private-file requests enter this cache.
 if (!asset) return;
 event.respondWith((async () => {
  const cache = await caches.open(CACHE), response = await cache.match(key);
  if (response) return response;
  try {
   // Repair an evicted asset only if it still matches this release; never mix a live newer file.
   const repaired = await verifiedResponse(asset);
   await cache.put(key, repaired.clone()); return repaired;
  } catch {
   if (!isIndex) return Response.error();
   return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>FinanceFlow update</title><p>Reconnect and reload FinanceFlow to finish updating this version.</p>', {status:503, headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
 })());
});
