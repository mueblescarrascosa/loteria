/* Service worker de la Lotería del Abuelo.

   Dos reglas, y ninguna más:

   - El HTML se pide SIEMPRE a la red primero. Si hay una versión nueva
     publicada, llega en cuanto se abre. Solo cuando no hay red se tira de la
     copia guardada. Al revés (caché primero) es como se acaba viendo una app
     vieja sin saber por qué, y de eso ya hemos tenido bastante.
   - Los iconos y el manifiesto, de la copia guardada: no cambian nunca.

   Las llamadas a Supabase ni se tocan: son de otro dominio y tienen que ir
   siempre a la red, porque son las cuentas de verdad. */

const CACHE = 'loteria-v1';
const ESTATICOS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ESTATICOS))
      .catch(() => null)            // si algo no se puede guardar, da igual: se seguirá pidiendo a la red
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  let url;
  try{ url = new URL(req.url); } catch(err){ return; }
  if(url.origin !== self.location.origin) return;   // Supabase y la Lotería, directos a la red

  const esDocumento = req.mode === 'navigate'
    || url.pathname.endsWith('/')
    || /\.html?$/.test(url.pathname);

  if(esDocumento){
    e.respondWith(
      fetch(req)
        .then(r => {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => null);
          return r;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copia)).catch(() => null);
      return resp;
    }))
  );
});
