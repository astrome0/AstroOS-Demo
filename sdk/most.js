// AstroOS — můstek pro stránky a aplikace z virtuálního disku.
//
// AstroOS (js/hostitel.js) ho vkládá jako první skript každé HTML stránky z disku.
// Všechno jde přes window.astro, které posílá zprávy nadřazenému oknu a čeká na odpověď.
//
//   await astro.oznameni('Hotovo', 'Uloženo na disk');
//   const text = await astro.fs.cti('~/Dokumenty/cti-me.txt');
//   astro.na('motiv', (m) => console.log('motiv je', m.nazev));
(function () {
  'use strict';
  if (window.astro) return;

  var rodic = window.parent;
  var vAstroOS = rodic && rodic !== window;
  var cekajici = {};
  var citac = 0;
  var posluchaci = {};
  var hotovo;
  var pripraveno = new Promise(function (ok) { hotovo = ok; });

  function posli(d) {
    if (!vAstroOS) return;
    d.astroApi = 1;
    try { rodic.postMessage(d, '*'); } catch (e) { /* rodič zmizel */ }
  }

  function volej(metoda, args, prubeh) {
    return new Promise(function (ok, chyba) {
      if (!vAstroOS) return chyba(new Error('Tahle stránka neběží v AstroOS, astro.' + metoda + ' tu nefunguje.'));
      var id = ++citac;
      cekajici[id] = { ok: ok, chyba: chyba, prubeh: prubeh };
      posli({ typ: 'volani', id: id, metoda: metoda, args: args || [] });
    });
  }

  function vyvolej(udalost, data) {
    (posluchaci[udalost] || []).forEach(function (fn) {
      try { fn(data); } catch (e) { console.error(e); }
    });
  }

  // ---------------------------------------------------------------- motiv systému
  var NAZVY = {
    akcent: '--astro-akcent', akcentText: '--astro-akcent-text', pozadi: '--astro-pozadi',
    karta: '--astro-karta', pole: '--astro-pole', okraj: '--astro-okraj', hover: '--astro-hover',
    text: '--astro-text', text2: '--astro-text-2', text3: '--astro-text-3', rohy: '--astro-rohy',
  };
  function pouzijMotiv(m) {
    if (!m) return;
    var s = document.documentElement.style;
    for (var k in NAZVY) if (m.barvy && m.barvy[k]) s.setProperty(NAZVY[k], m.barvy[k]);
    // color-scheme nastavuje až /__astro/styl.css — obyčejná stránka má zůstat bílá jako v prohlížeči
    document.documentElement.setAttribute('data-astro-motiv', m.nazev);
  }

  // ---------------------------------------------------------------- zprávy od AstroOS
  window.addEventListener('message', function (e) {
    if (!vAstroOS || e.source !== rodic) return;
    var d = e.data;
    if (!d || d.astroApi !== 1) return;
    if (d.typ === 'odpoved') {
      var c = cekajici[d.id];
      if (!c) return;
      if ('kus' in d) { if (c.prubeh) c.prubeh(d.kus); return; }
      delete cekajici[d.id];
      if (d.chyba) c.chyba(new Error(d.chyba)); else c.ok(d.vysledek);
    } else if (d.typ === 'info') {
      pouzijMotiv(d.info.motiv);
      astro.rezim = d.info.rezim;
      hotovo(d.info);
    } else if (d.typ === 'motiv') {
      pouzijMotiv(d.motiv);
      vyvolej('motiv', d.motiv);
    }
  });

  // ---------------------------------------------------------------- hlášení stavu
  var posledni = '';
  function hlasStav() {
    var klic = location.href + '\n' + document.title;
    if (klic === posledni) return;
    posledni = klic;
    posli({ typ: 'stav', url: location.href, titulek: document.title });
  }
  posli({ typ: 'ahoj', url: location.href });
  document.addEventListener('DOMContentLoaded', hlasStav);
  window.addEventListener('load', hlasStav);
  window.addEventListener('hashchange', hlasStav);
  window.addEventListener('popstate', hlasStav);
  setInterval(hlasStav, 1000);

  // Chyby JavaScriptu hlásíme AstroOS — Astro Studio z nich dělá bug reporty od hráčů.
  var nahlaseno = 0;
  function hlasChybu(zprava, soubor, radek) {
    if (++nahlaseno > 20) return;
    var rel = '';
    try { rel = soubor ? new URL(soubor, location.href).pathname.replace(/^.*?\/disk\/[a-z0-9-]+\//, '').replace(/^\//, '') : ''; } catch (e) { /* nevadí */ }
    posli({ typ: 'chyba', zprava: String(zprava || 'Neznámá chyba').slice(0, 300), soubor: rel, radek: radek || 0 });
  }
  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) {
      var cil = e.target.getAttribute('src') || e.target.getAttribute('href');
      hlasChybu('Soubor se nepodařilo načíst: ' + cil, '', 0);
      return;
    }
    hlasChybu(e.message, e.filename, e.lineno);
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    hlasChybu('Nezachycená chyba v Promise: ' + (r && r.message ? r.message : String(r)), '', 0);
  });

  // F5 v rámu by načetl starou kopii ze serveru — obnovu musí udělat AstroOS (nahraje složku znovu)
  window.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && k === 'r')) {
      e.preventDefault();
      posli({ typ: 'obnov' });
    }
  }, true);

  // Odkaz ven (na internet) se otevře v Nově přes proxy, ne holý v rámu.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || e.defaultPrevented) return;
    var url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (er) { return; }
    if (!/^https?:$/.test(url.protocol) || url.origin === location.origin) return;
    e.preventDefault();
    posli({ typ: 'odkaz', url: url.href });
  });

  // ---------------------------------------------------------------- internet
  // Ukázková verze nemá proxy — jde napřímo, takže platí CORS jako na běžném webu.
  function pres(url) {
    return new URL(url, location.href).href;
  }

  // ---------------------------------------------------------------- veřejné API
  var astro = {
    verze: 1,
    rezim: null,                     // 'aplikace' | 'web' (stránka otevřená v Nově)
    pripraveno: pripraveno,          // Promise s informacemi o systému
    info: function () { return pripraveno; },

    oznameni: function (titulek, text) { return volej('oznameni', [String(titulek), text == null ? '' : String(text)]); },

    okno: {
      titulek: function (t) { return volej('okno.titulek', [String(t)]); },
      velikost: function (sirka, vyska) { return volej('okno.velikost', [sirka, vyska]); },
      maximalizuj: function () { return volej('okno.maximalizuj'); },
      zavri: function () { return volej('okno.zavri'); },
    },

    fs: {
      cti: function (cesta) { return volej('fs.cti', [cesta]); },
      zapis: function (cesta, obsah) { return volej('fs.zapis', [cesta, String(obsah)]); },
      seznam: function (cesta) { return volej('fs.seznam', [cesta || '~']); },
      existuje: function (cesta) { return volej('fs.existuje', [cesta]); },
      slozka: function (cesta) { return volej('fs.slozka', [cesta]); },
      smaz: function (cesta) { return volej('fs.smaz', [cesta]); },
    },

    ai: {
      /** Zeptá se AstroAI; prubeh(kus) dostává odpověď po kouscích, vrátí celý text. */
      zeptej: function (otazka, prubeh) { return volej('ai.zeptej', [String(otazka)], prubeh); },
    },

    /** Otevře aplikaci ('notes', 'browser'…) nebo adresu v Nově. */
    otevri: function (co, moznosti) { return volej('otevri', [co, moznosti || null]); },

    /** fetch() na internet (v ukázkové verzi napřímo, bez proxy). */
    web: function (url, moznosti) { return fetch(pres(url), moznosti); },

    na: function (udalost, fn) { (posluchaci[udalost] = posluchaci[udalost] || []).push(fn); },
  };

  window.astro = astro;
})();
