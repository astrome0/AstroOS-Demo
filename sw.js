// AstroOS — service worker: vydává složky z virtuálního disku jako web (náhrada serveru)
//
// AstroOS (js/hostitel.js) uloží soubory složky do Cache API pod adresou
//   <AstroOS>/disk/<web>/<cesta>
// a tenhle worker je odtud vydává rámům v Nově a nainstalovaným aplikacím. Díky tomu fungují
// relativní odkazy, obrázky, fetch() i podstránky — bez serveru, třeba na GitHub Pages.

const CACHE = 'astro-disk';
const DISK = new URL('disk/', self.registration.scope).href;
const SDK = new URL('sdk/', self.registration.scope).href;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const html = (kod, telo) => new Response(`<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${kod}</title>
<link rel="stylesheet" href="${SDK}styl.css"></head><body class="astro-stred">${telo}</body></html>`,
{ status: kod, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

async function vydej(url) {
  const zbytek = url.href.slice(DISK.length).split(/[?#]/)[0];
  const lomitko = zbytek.indexOf('/');
  const web = lomitko < 0 ? zbytek : zbytek.slice(0, lomitko);
  let cesta = lomitko < 0 ? '' : zbytek.slice(lomitko + 1);
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(web)) return html(404, '<h1>404</h1><p>Takový web na disku není.</p>');
  // /disk/<web> bez lomítka → s lomítkem, ať fungují relativní cesty
  if (lomitko < 0) return Response.redirect(DISK + web + '/', 302);

  const cache = await caches.open(CACHE);
  const zaklad = DISK + web + '/';
  let r = await cache.match(zaklad + cesta);
  if (!r) {
    // složka → její index.html (a u /slozka bez lomítka přesměrování)
    const index = (cesta ? cesta.replace(/\/$/, '') + '/' : '') + 'index.html';
    if (await cache.match(zaklad + index)) {
      if (cesta && !cesta.endsWith('/')) return Response.redirect(zaklad + cesta + '/', 302);
      r = await cache.match(zaklad + index);
    }
  }
  if (r) return r;
  let jmeno = cesta;
  try { jmeno = decodeURIComponent(cesta); } catch { /* nechat */ }
  const nahrano = (await cache.keys()).some((k) => k.url.startsWith(zaklad));
  return html(404, `<h1>404</h1><p>Soubor <code>${(jmeno || '/').replace(/[<>&"]/g, '')}</code> v téhle složce není.</p>`
    + (nahrano ? '' : '<p class="astro-tlumene">Složka se ještě nenačetla — zkus stránku obnovit v AstroOS.</p>'));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !url.href.startsWith(DISK)) return;
  e.respondWith(vydej(url));
});
