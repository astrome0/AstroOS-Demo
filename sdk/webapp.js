// Vrstva webové aplikace AstroOS. Běží ve skutečné stránce z internetu (přes proxy Novy),
// když ji AstroOS otevřel jako aplikaci — rám se jmenuje „astroapp:<id>“ a můstek proxy
// sem skript zapíše hned na začátek <head>. Úkol: ať stránka nepůsobí jako web.
//  • barvy a motiv systému (proměnné --astro-*, atribut data-astro-motiv na <html>)
//  • kontextová nabídka systému místo nabídky prohlížeče
//  • F5 / Ctrl+R obnoví jen aplikaci, ne celé AstroOS
//  • žádná bublina s adresou odkazu vlevo dole (href se při najetí myší schová)
//  • hlášení „připraveno“, podle kterého AstroOS schová úvodní obrazovku
// Úpravy pro konkrétní aplikaci jsou v app-<id>.css a app-<id>.js vedle tohoto souboru.
(function () {
  var id = (/^astroapp:([a-z0-9-]+)$/.exec(window.name || '') || [])[1];
  if (!id || window.astroApp) return;
  var html = document.documentElement;
  html.classList.add('astro-app');
  html.setAttribute('data-astro-app', id);

  function posli(d) { d.astroWeb = 1; try { parent.postMessage(d, '*'); } catch (e) { /* rám zmizel */ } }

  var app = window.astroApp = window.__astroApp = {
    id: id,
    domeny: null,          // adresy, které patří aplikaci (ostatní odkazy jdou do Novy)
    prikazy: {},           // příkazy z nabídky AstroOS: astroApp.prikazy.hledat = function () {…}
    motiv: null,
    volby: {},
    naMotiv: [],
    posli: posli,
    pripraveno: pripraveno,
    cekejNa: cekejNa,
  };

  // ---------------------------------------------------------------- motiv systému
  var KLIC = 'astroApp:motiv';
  var styl = document.createElement('style');
  styl.id = 'astro-app-motiv';
  (document.head || html).appendChild(styl);
  var obecny = document.createElement('style');
  obecny.textContent =
    'html.astro-app,html.astro-app *{scrollbar-width:thin}' +
    'html.astro-app{scrollbar-color:color-mix(in srgb,var(--astro-text,#888) 28%,transparent) transparent}' +
    'html.astro-app img,html.astro-app a{-webkit-user-drag:none}' +
    'a[data-astro-href]{cursor:pointer}';
  (document.head || html).appendChild(obecny);

  function pouzij(m, volby, ulozit) {
    if (!m || !m.barvy) return;
    app.motiv = m;
    app.volby = volby || {};
    html.setAttribute('data-astro-motiv', m.nazev === 'svetly' ? 'svetly' : 'tmavy');
    var css = ':root{';
    for (var k in m.barvy) {
      // akcentText → --astro-akcent-text, text3 → --astro-text-3 (stejné názvy jako sdk/styl.css)
      if (m.barvy[k]) css += '--astro-' + k.replace(/([A-Z]|\d+)/g, '-$1').toLowerCase() + ':' + m.barvy[k] + ';';
    }
    styl.textContent = css + '}';
    for (var v in app.volby) html.setAttribute('data-astro-' + v, app.volby[v] ? '1' : '0');
    if (ulozit) try { localStorage.setItem(KLIC, JSON.stringify({ motiv: m, volby: app.volby })); } catch (e) { /* bez úložiště */ }
    app.naMotiv.forEach(function (fn) { try { fn(m, app.volby); } catch (e) { /* chyba v aplikaci */ } });
  }
  // poslední známý motiv hned, ať stránka neblikne jinými barvami, než přijde zpráva
  try { var u = JSON.parse(localStorage.getItem(KLIC)); if (u) pouzij(u.motiv, u.volby); } catch (e) { /* nic uloženého */ }
  posli({ typ: 'ahoj' });      // AstroOS odpoví aktuálním motivem

  // ---------------------------------------------------------------- zprávy od AstroOS
  var ZAKLADNI = {
    zpet: function () { history.back(); },
    vpred: function () { history.forward(); },
    obnov: function () { location.reload(); },
    kopirovat: function (text) {
      text = text || String(getSelection());
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () { document.execCommand('copy'); });
      else document.execCommand('copy');
    },
  };
  addEventListener('message', function (e) {
    if (e.source !== parent) return;
    var d = e.data;
    if (!d || d.astroApp !== 1) return;
    if (d.typ === 'motiv') pouzij(d.motiv, d.volby, true);
    else if (d.typ === 'prikaz') {
      var f = app.prikazy[d.nazev] || ZAKLADNI[d.nazev];
      if (f) try { f(d.arg); } catch (x) { /* příkaz selhal */ }
    }
  });

  // ---------------------------------------------------------------- kontextová nabídka
  // Vlastní nabídku stránky (mapa má svou) necháme být; v polích zůstane nabídka prohlížeče,
  // ať jde vkládat. Jinak nabídku ukáže AstroOS.
  addEventListener('contextmenu', function (e) {
    if (e.defaultPrevented) return;
    var t = e.target;
    if (t && t.closest && t.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"]')) return;
    e.preventDefault();
    var a = t && t.closest && t.closest('a[href],a[data-astro-href]');
    posli({
      typ: 'menu', x: e.clientX, y: e.clientY,
      vyber: String(getSelection()).slice(0, 5000),
      odkaz: a ? skutecna(a.getAttribute('href') || a.getAttribute('data-astro-href')) : null,
    });
  });

  /** Adresa v proxy → skutečná (https://…), ať ji Nova otevře správně. */
  function skutecna(h) {
    var x;
    try { x = new URL(h, location.href); } catch (e) { return null; }
    var m = x.hostname.match(/^(.+)\.localhost$/);
    if (m) return 'https://' + m[1] + x.pathname + x.search + x.hash;
    var w = (x.pathname + x.search + x.hash).match(/^\/web\/(https?)\/(.*)$/);
    return w ? w[1] + '://' + w[2] : /^https?:$/.test(x.protocol) ? x.href : null;
  }

  // ---------------------------------------------------------------- klávesy
  addEventListener('keydown', function (e) {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'r' || e.key === 'R'))) {
      e.preventDefault();
      location.reload();
    }
    // Win (i Win+L, Win+D…) uvnitř aplikace dostane AstroOS, stejně jako mimo ni
    if (e.key === 'Meta' || e.metaKey) posli({ typ: 'klavesa', udalost: 'keydown', key: e.key, metaKey: true });
  }, true);
  addEventListener('keyup', function (e) {
    if (e.key === 'Meta') posli({ typ: 'klavesa', udalost: 'keyup', key: 'Meta', metaKey: false });
  }, true);

  // ---------------------------------------------------------------- bez bubliny s adresou
  // Prohlížeč ukazuje adresu odkazu, nad kterým je myš — to web prozradí nejvíc. Odkaz pod
  // myší proto dočasně ztratí href (uloží se do data-astro-href). Před kliknutím ho vrátíme,
  // ať routery stránek i můstek proxy vidí adresu jako obvykle, a po kliknutí zase schováme.
  var skryty = null;
  function schovej(a) {
    if (skryty === a) return;
    vrat();
    if (!a || !a.hasAttribute('href')) return;
    a.setAttribute('data-astro-href', a.getAttribute('href'));
    a.removeAttribute('href');
    skryty = a;
  }
  function vrat() {
    var a = skryty;
    skryty = null;
    if (!a) return;
    if (!a.hasAttribute('href') && a.hasAttribute('data-astro-href')) a.setAttribute('href', a.getAttribute('data-astro-href'));
    a.removeAttribute('data-astro-href');
  }
  var odkazPod = null;
  addEventListener('pointerover', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    odkazPod = e.target && e.target.closest ? e.target.closest('a[href],a[data-astro-href]') : null;
    if (odkazPod) schovej(odkazPod); else vrat();
  }, true);
  addEventListener('pointerout', function (e) {
    if (skryty && !(e.relatedTarget && skryty.contains(e.relatedTarget))) { odkazPod = null; vrat(); }
  }, true);
  addEventListener('pointerdown', function () { vrat(); posli({ typ: 'klik' }); }, true);
  addEventListener('click', function () {
    setTimeout(function () { if (odkazPod && odkazPod.isConnected) schovej(odkazPod); }, 60);
  }, true);
  addEventListener('blur', vrat);

  // ---------------------------------------------------------------- připraveno
  var hotovo = false;
  function pripraveno() {
    if (hotovo) return;
    hotovo = true;
    posli({ typ: 'pripraveno' });
  }
  /** Připraveno až ve chvíli, kdy je na stránce prvek (třeba načtená mapa). */
  function cekejNa(selektor, max) {
    app.cekam = true;
    var zacatek = Date.now();
    (function kontrola() {
      if (hotovo) return;
      if (document.querySelector(selektor)) return setTimeout(pripraveno, 150);
      if (Date.now() - zacatek > (max || 15000)) return pripraveno();
      setTimeout(kontrola, 100);
    })();
  }
  addEventListener('load', function () { setTimeout(function () { if (!app.cekam) pripraveno(); }, 150); });

  // Proxy vrátila chybovou stránku (bez internetu, server nejde najít…) — AstroOS ukáže svou.
  if (window.__astroChyba) {
    hotovo = true;
    posli({ typ: 'chyba', zprava: String(window.__astroChyba) });
  }
})();
