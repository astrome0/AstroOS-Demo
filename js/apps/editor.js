// AstroOS — Editor kódu s živým náhledem
//
// Píše se do textového pole, pod ním leží obarvená kopie kódu (proto má pole
// průhledný text) a vedle běží náhled v iframu. Náhled se skládá z disku:
// odkazované `<link>` a `<script src>` se nahradí obsahem souborů, takže
// stačí psát obyčejné HTML, CSS a JS vedle sebe do jedné složky.

import { el, clamp, bus } from '../util.js';
import { icon } from '../icons.js';
import * as FS from '../fs.js';
import { toast, contextMenu } from '../ui.js';
import { State } from '../state.js';
import { zvyrazni, jazykSouboru } from '../zvyrazneni.js';
import { jeAplikaceSlozka, zaznamPro } from '../aplikace.js';
import { motivProStranku } from '../hostitel.js';
import { vytvorAiPanel } from './editorAi.js';

// Můstek window.astro a styl aplikací (sdk/) — do náhledu se vkládají přímo, protože
// sandboxovaný náhled si nic stáhnout nemůže. Načtou se jednou při prvním otevření Editoru.
let SDK = null;
const nactiSdk = () => (SDK ? Promise.resolve(SDK) : Promise.all([
  fetch('sdk/most.js').then((r) => r.text()),
  fetch('sdk/styl.css').then((r) => r.text()),
]).then(([most, styl]) => (SDK = { most, styl })).catch(() => null));

/** Nová aplikace pro AstroOS — ukázka, jak mluvit se systémem přes window.astro. */
const SABLONA_APLIKACE = {
  'index.html': `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Moje aplikace</title>
  <!-- vzhled AstroOS: písmo, barvy a tlačítka se mění s motivem systému -->
  <link rel="stylesheet" href="/__astro/styl.css">
  <link rel="stylesheet" href="styl.css">
</head>
<body>
  <h1>Moje aplikace</h1>
  <p class="tlumene">Ahoj, <b id="jmeno">…</b>! Tohle je tvoje první aplikace pro AstroOS.</p>

  <div class="karta sloupec">
    <textarea id="text" rows="6" placeholder="Napiš něco a ulož to na disk…"></textarea>
    <div class="radek">
      <button class="hlavni" id="uloz">Uložit na disk</button>
      <button id="ahoj">Poslat oznámení</button>
    </div>
  </div>

  <p id="rezim" class="tlumene"></p>

  <script src="app.js"></script>
</body>
</html>
`,
  'styl.css': `/* Barvy ber z proměnných --astro-…, ať aplikace sedí ke světlému i tmavému motivu. */
h1 {
  color: var(--astro-akcent);
}

textarea {
  width: 100%;
  resize: vertical;
}
`,
  'app.js': `// window.astro je most do systému. Všechno vrací Promise, proto await.
// Relativní cesta = soubor ve složce aplikace, „~/…“ = tvoje domovská složka.
const SOUBOR = 'poznamka.txt';

const text = document.getElementById('text');
const tlacitkoUloz = document.getElementById('uloz');

async function start() {
  const info = await astro.info();
  document.getElementById('jmeno').textContent = info.uzivatel;
  document.getElementById('rezim').textContent = 'Běžím v režimu: ' + info.rezim;

  // Na disk smí jen nainstalovaná aplikace (ne náhled v Editoru, ne stránka v Nově).
  if (info.rezim !== 'aplikace') {
    tlacitkoUloz.disabled = true;
    return;
  }
  if (await astro.fs.existuje(SOUBOR)) {
    text.value = await astro.fs.cti(SOUBOR);
  }
}

tlacitkoUloz.addEventListener('click', async () => {
  await astro.fs.zapis(SOUBOR, text.value);
  astro.oznameni('Uloženo', SOUBOR);
});

document.getElementById('ahoj').addEventListener('click', () => {
  astro.oznameni('Ahoj z aplikace!', 'Tohle oznámení poslala tvoje aplikace.');
});

start();
`,
  'app.json': JSON.stringify({ nazev: 'Moje aplikace', ikona: 'star', barva: '#46c36f', kategorie: 'tools', sirka: 520, vyska: 460 }, null, 2) + '\n',
};

const PROJEKTY = FS.HOME + '/projekty';
const ZAKLAD = PROJEKTY + '/web';

const SABLONY = {
  html: `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Moje stránka</title>
  <link rel="stylesheet" href="styl.css">
</head>
<body>
  <h1>Ahoj!</h1>
  <p>Tohle je moje první stránka.</p>
  <button id="tlacitko">Klikni na mě</button>

  <script src="skript.js"><\/script>
</body>
</html>
`,
  css: `body {
  font-family: system-ui, sans-serif;
  background: #101820;
  color: #eef3f5;
  padding: 24px;
}

h1 {
  color: #46c36f;
}

button {
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  background: #46c36f;
  color: #0b1410;
  font-size: 15px;
  cursor: pointer;
}
`,
  js: `const tlacitko = document.getElementById('tlacitko');
let pocet = 0;

tlacitko.addEventListener('click', () => {
  pocet = pocet + 1;
  tlacitko.textContent = 'Klikls ' + pocet + 'krát';
  console.log('klik číslo', pocet);
});
`,
};

/** Skript, který z náhledu posílá výpisy a chyby zpátky do editoru. */
const MUSTEK = `<script>
(function () {
  // Sandbox náhledu nemá vlastní původ, takže localStorage vyhodí chybu. Dostane
  // náhradu v paměti — kód se chová stejně, jen se po obnovení náhledu nic nepamatuje.
  ['localStorage', 'sessionStorage'].forEach(function (jmeno) {
    try { window[jmeno].length; return; } catch (e) {}
    var d = {};
    var s = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[k] = String(v); },
      removeItem: function (k) { delete d[k]; },
      clear: function () { d = {}; },
      key: function (i) { var k = Object.keys(d)[i]; return k === undefined ? null : k; },
      get length() { return Object.keys(d).length; }
    };
    try { Object.defineProperty(window, jmeno, { value: s, configurable: true }); } catch (e) {}
  });
  var posli = function (druh, veci) {
    var text = [];
    for (var i = 0; i < veci.length; i++) {
      var v = veci[i];
      try { text.push(typeof v === 'string' ? v : JSON.stringify(v)); }
      catch (e) { text.push(String(v)); }
    }
    try { parent.postMessage({ astroKonzole: true, druh: druh, text: text.join(' ') }, '*'); } catch (e) {}
  };
  ['log', 'info', 'warn', 'error'].forEach(function (k) {
    var p = console[k] ? console[k].bind(console) : function () {};
    console[k] = function () { posli(k, arguments); p.apply(console, arguments); };
  });
  window.onerror = function (zprava, zdroj, radek) {
    try { parent.postMessage({ astroKonzole: true, druh: 'error', text: String(zprava), radek: radek }, '*'); } catch (e) {}
    return false;
  };
})();
<\/script>
`;

export const editorApp = {
  id: 'editor', name: 'Editor kódu', icon: 'code', color: 'linear-gradient(145deg,#54d98a,#2b9b53)',
  cat: 'office', width: 1120, height: 720,

  mount(body, win) {
    const st = {
      soubory: [],        // { path, kod, dirty, jazyk }
      i: -1,
      rozlozeni: State.get('editorRozlozeni') || 'vedle',   // vedle | pod | kod | nahled
      auto: State.get('editorAuto') !== false,
      cekac: null,
      posledniHtml: null, // poslední HTML soubor, podle kterého se skládá náhled
      chyby: [],          // chyby z konzole od posledního obnovení náhledu (pro AI panel)
      ai: !!State.get('editorAi'),
    };
    win.editor = st;
    const akt = () => st.soubory[st.i] || null;

    // ---------------------------------------------------------------- prvky
    const gutter = el('div.ce-radky');
    const hl = el('pre.ce-hl', {}, el('code'));
    const area = el('textarea.ce-area', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off' });
    const kodEl = el('div.ce-kod', {}, gutter, el('div.ce-plocha', {}, hl, area));

    const ramec = el('iframe.ce-ramec', { sandbox: 'allow-scripts allow-modals allow-forms allow-popups' });
    const konzole = el('div.ce-konzole');
    const konzoleObal = el('div.ce-konzole-obal', {},
      el('div.ce-konzole-bar', {},
        el('span', { text: 'Konzole' }),
        el('div.ce-spacer'),
        el('button.ce-mini', { title: 'Vyčistit konzoli', onclick: () => konzole.replaceChildren() }, icon('trash')),
      ),
      konzole,
    );
    const nahledEl = el('div.ce-nahled', {}, ramec, konzoleObal);
    const delic = el('div.ce-delic');
    const hlavni = el('div.ce-hlavni', {}, kodEl, delic, nahledEl);
    const obal = el('div.ce-obal', {}, hlavni);   // hlavní plocha + AI panel vpravo

    const tabyEl = el('div.ce-taby');
    const cestaEl = el('div.ce-cesta');
    const pozice = el('div');
    const jazykEl = el('div');

    // ---------------------------------------------------------------- kreslení kódu
    function prekresli() {
      const s = akt();
      const kod = s ? s.kod : '';
      hl.firstChild.innerHTML = zvyrazni(kod, s?.jazyk) + '\n';
      const radku = kod.split('\n').length;
      if (gutter.childElementCount !== radku) {
        gutter.replaceChildren(...Array.from({ length: radku }, (_, i) => el('span', { text: String(i + 1) })));
      }
      synchronizujScroll();
    }

    // Obarvená kopie se neposouvá přes scrollTop/Left, ale posunem obsahu: pole má posuvníky,
    // takže dojede o kus dál než kopie bez nich — na dlouhých řádcích (a dole) by se kopie
    // „zarazila“ a barevný text by ležel o znak dva vedle skutečného (mazalo se naslepo).
    function synchronizujScroll() {
      hl.firstChild.style.transform = `translate(${-area.scrollLeft}px, ${-area.scrollTop}px)`;
      gutter.scrollTop = area.scrollTop;
    }
    new ResizeObserver(synchronizujScroll).observe(area);

    function poziceKurzoru() {
      const s = akt();
      if (!s) return (pozice.textContent = '');
      const pred = area.value.slice(0, area.selectionStart);
      const radek = pred.split('\n');
      pozice.textContent = `řádek ${radek.length}, sloupec ${radek[radek.length - 1].length + 1}`;
    }

    // ---------------------------------------------------------------- záložky
    function kresliTaby() {
      tabyEl.replaceChildren(...st.soubory.map((s, i) => {
        const t = el('button.ce-tab' + (i === st.i ? '.on' : ''), { title: s.path },
          el('span.ce-tecka', { style: { background: barvaJazyka(s.jazyk) } }),
          el('span', { text: (s.dirty ? '• ' : '') + FS.basename(s.path) }),
        );
        t.onclick = () => prepni(i);
        const x = el('span.ce-zavri', { title: 'Zavřít' }, icon('x'));
        x.onclick = (e) => { e.stopPropagation(); zavriTab(i); };
        t.append(x);
        t.oncontextmenu = (e) => {
          e.preventDefault();
          contextMenu([
            { icon: 'x', label: 'Zavřít', onClick: () => zavriTab(i) },
            { icon: 'folderOpen', label: 'Ukázat ve složce', onClick: () => import('../apps.js').then(({ openApp }) => openApp('files', { path: FS.dirname(s.path) })) },
          ], { x: e.clientX, y: e.clientY });
        };
        return t;
      }));
    }

    const barvaJazyka = (j) => ({ html: '#e08a5c', css: '#5aa9e6', js: '#e0c25c', json: '#c99adf' }[j] || '#7d8b96');

    function prepni(i) {
      if (st.i === i) return;
      if (akt()) akt().kod = area.value;
      st.i = clamp(i, 0, st.soubory.length - 1);
      const s = akt();
      area.value = s ? s.kod : '';
      area.setSelectionRange(0, 0);           // otevřený soubor začíná nahoře vlevo
      area.scrollTop = 0;
      area.scrollLeft = 0;
      if (s?.jazyk === 'html') st.posledniHtml = s.path;
      kresliTaby();
      prekresli();
      nazev();
      poziceKurzoru();
      obnovNahled();
      area.focus();
    }

    function zavriTab(i) {
      const s = st.soubory[i];
      if (!s) return;
      if (s.dirty) toast({ title: 'Neuloženo', body: `${FS.basename(s.path)} se zavřel s neuloženými změnami.`, icon: 'info', timeout: 3200 });
      st.soubory.splice(i, 1);
      if (!st.soubory.length) { st.i = -1; area.value = ''; kresliTaby(); prekresli(); nazev(); return; }
      st.i = clamp(st.i > i ? st.i - 1 : st.i, 0, st.soubory.length - 1);
      area.value = akt().kod;
      kresliTaby();
      prekresli();
      nazev();
      obnovNahled();
    }

    function nazev() {
      const s = akt();
      cestaEl.textContent = s ? s.path : 'Nic otevřeného';
      jazykEl.textContent = s ? ({ html: 'HTML', css: 'CSS', js: 'JavaScript', json: 'JSON' }[s.jazyk] || 'Text') : '';
      win.title = s ? `${s.dirty ? '• ' : ''}${FS.basename(s.path)} — Editor kódu` : 'Editor kódu';
      kresliAplikaci();
    }

    // ---------------------------------------------------------------- soubory
    function otevri(path) {
      const p = FS.normalize(path);
      const uz = st.soubory.findIndex((s) => s.path === p);
      if (uz >= 0) return prepni(uz);
      let kod;
      try { kod = FS.read(p); } catch (err) { return toast({ title: 'Nešlo otevřít', body: err.message, icon: 'info' }); }
      st.soubory.push({ path: p, kod, dirty: false, jazyk: jazykSouboru(FS.basename(p)) });
      st.i = -1;
      prepni(st.soubory.length - 1);
    }

    function uloz() {
      const s = akt();
      if (!s) return;
      s.kod = area.value;
      try {
        FS.write(s.path, s.kod);
      } catch (err) {
        return toast({ title: 'Uložení selhalo', body: err.message, icon: 'info', timeout: 6000 });
      }
      s.dirty = false;
      kresliTaby();
      nazev();
      obnovNahled();
      toast({ title: 'Uloženo', body: s.path, icon: 'check', timeout: 1800 });
    }

    function novy(druh) {
      const slozka = akt() ? FS.dirname(akt().path) : ZAKLAD;
      if (!FS.exists(slozka)) FS.mkdir(slozka, { parents: true });
      const jmeno = FS.freeName(slozka, { html: 'stranka.html', css: 'styl.css', js: 'skript.js' }[druh]);
      const path = FS.normalize(slozka + '/' + jmeno);
      try {
        FS.write(path, SABLONY[druh]);
      } catch (err) {
        return toast({ title: 'Nešlo založit', body: err.message, icon: 'info' });
      }
      otevri(path);
    }

    function nabidkaOtevrit(btn) {
      const r = btn.getBoundingClientRect();
      const soubory = [];
      const projdi = (cesta, hloubka) => {
        let polozky;
        try { polozky = FS.list(cesta); } catch { return; }
        for (const it of polozky) {
          if (it.dir) { if (hloubka < 3) projdi(it.path, hloubka + 1); }
          else if (jazykSouboru(it.name)) soubory.push(it);
        }
      };
      projdi(FS.HOME, 0);
      const polozky = soubory.slice(0, 22).map((it) => ({
        icon: 'code', label: `${it.name}  ·  ${FS.dirname(it.path).replace(FS.HOME, '~')}`, onClick: () => otevri(it.path),
      }));
      if (!polozky.length) polozky.push({ icon: 'info', label: 'Na disku není žádný kód', disabled: true });
      polozky.push('sep', {
        icon: 'folderOpen', label: 'Procházet v Souborech',
        onClick: () => import('../apps.js').then(({ openApp }) => openApp('files', { path: FS.exists(ZAKLAD) ? ZAKLAD : PROJEKTY })),
      });
      contextMenu(polozky, { x: r.left, y: r.bottom + 6 });
    }

    // ---------------------------------------------------------------- náhled
    /** Obsah souboru — z rozepsané záložky, jinak z disku. */
    function obsah(path) {
      const p = FS.normalize(path);
      const otevreny = st.soubory.find((s) => s.path === p);
      if (otevreny) return otevreny === akt() ? area.value : otevreny.kod;
      try { return FS.read(p); } catch { return null; }
    }

    /** Ke kterému HTML souboru náhled patří. */
    function htmlProNahled() {
      const s = akt();
      if (!s) return null;
      if (s.jazyk === 'html') return s.path;
      const slozka = FS.dirname(s.path);
      if (st.posledniHtml && FS.dirname(st.posledniHtml) === slozka && FS.exists(st.posledniHtml)) return st.posledniHtml;
      let seznam = [];
      try { seznam = FS.list(slozka).filter((it) => !it.dir && jazykSouboru(it.name) === 'html'); } catch { /* prázdná složka */ }
      const index = seznam.find((it) => it.name.toLowerCase().startsWith('index'));
      return (index || seznam[0])?.path || null;
    }

    /** Složí stránku: odkazy na soubory z disku nahradí jejich obsahem. */
    function slozStranku() {
      const s = akt();
      if (!s) return '<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;color:#889;background:#0e1316;padding:20px">Otevři soubor a uvidíš tu náhled.</body>';

      const htmlPath = htmlProNahled();
      if (!htmlPath) {
        // Žádné HTML vedle — ukážeme aspoň samotné CSS nebo JS v holé stránce.
        const telo = s.jazyk === 'css'
          ? `<style>${area.value}</style><h1>Ukázka</h1><p>Tahle stránka nemá HTML soubor, tak zkouším styl na kusu textu.</p><button>Tlačítko</button>`
          : `<pre style="font:13px ui-monospace,monospace;color:#9fb1bb"></pre><script>${area.value}<\/script>`;
        return `<!doctype html><html lang="cs"><head><meta charset="utf-8">${MUSTEK}</head><body style="font-family:system-ui;padding:18px">${telo}</body></html>`;
      }

      let html = obsah(htmlPath);
      if (html === null) return '<!doctype html><body>Soubor zmizel.</body>';
      const slozka = FS.dirname(htmlPath);

      html = html.replace(/<link\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi, (cely, href) => {
        if (/^\/__astro\/styl\.css/i.test(href)) return SDK ? `<style>\n${SDK.styl}\n</style>` : cely;
        if (/^(https?:|\/\/|data:)/i.test(href)) return cely;
        const kod = obsah(FS.normalize(slozka + '/' + href));
        return kod === null ? cely : `<style>\n${kod}\n</style>`;
      });

      const vlozene = [];
      html = html.replace(/<script\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi, (cely, src) => {
        if (/^(https?:|\/\/|data:)/i.test(src)) return cely;
        const kod = obsah(FS.normalize(slozka + '/' + src));
        if (kod === null) return cely;
        vlozene.push({ jmeno: FS.basename(src), kod });
        return `<script>\n${kod}\n<\/script>`;
      });

      // můstek pro konzoli (a window.astro) musí běžet dřív než kód stránky
      const mustky = MUSTEK + (SDK ? `<script>\n${SDK.most}\n<\/script>\n` : '');
      const hotovo = html.includes('<head') ? html.replace(/<head[^>]*>/i, (m) => m + '\n' + mustky) : mustky + html;

      // Mapa řádků: chyba z náhledu přijde s číslem řádku ve složené stránce,
      // tohle z něj udělá řádek v tom souboru, kde ji uživatel opravdu napsal.
      st.mapa = vlozene.map(({ jmeno, kod }) => {
        const kde = hotovo.indexOf(kod);
        if (kde < 0) return null;
        return { jmeno, od: hotovo.slice(0, kde).split('\n').length, pocet: kod.split('\n').length };
      }).filter(Boolean);
      return hotovo;
    }

    let posledniDokument = null;
    let cekaNahled = false;

    /**
     * Přepsání srcdoc zahodí navigaci, která se ještě nestihla usadit, takže dvě
     * obnovení v jednom tiku by znamenala, že se ukáže to starší. Proto se volání
     * slévají do jednoho a stejný dokument se nenahrává znovu.
     */
    function obnovNahled(vynutit = false) {
      if (st.rozlozeni === 'kod') return;
      if (cekaNahled) return;
      cekaNahled = true;
      setTimeout(() => {
        cekaNahled = false;
        let dokument = slozStranku();
        if (dokument === posledniDokument) {
          if (!vynutit) return;
          dokument += `
<!-- ${Date.now()} -->`;   // ať se stránka opravdu spustí znovu
        }
        posledniDokument = dokument;
        st.chyby = [];
        ramec.srcdoc = dokument;
        pisDoKonzole('info', '— náhled obnoven —', true);
      }, 0);
    }

    function naplanujObnovu() {
      if (!st.auto) return;
      clearTimeout(st.cekac);
      st.cekac = setTimeout(obnovNahled, 700);
    }

    function pisDoKonzole(druh, text, tichy = false) {
      if (druh === 'error') { st.chyby.push(text); if (st.chyby.length > 10) st.chyby.shift(); aiPanel?.obnovNavrhy(); }
      const radek = el('div.ce-radek.' + druh, {}, el('span', { text }));
      konzole.append(radek);
      while (konzole.childElementCount > 120) konzole.firstChild.remove();
      konzole.scrollTop = konzole.scrollHeight;
      if (!tichy && druh === 'error') radek.scrollIntoView({ block: 'nearest' });
    }

    /** Z řádku ve složené stránce udělá řádek v konkrétním souboru. */
    function kdeJeChyba(radek) {
      if (!radek) return '';
      const blok = (st.mapa || []).find((b) => radek >= b.od && radek < b.od + b.pocet);
      return blok ? `  (${blok.jmeno}, řádek ${radek - blok.od + 1})` : `  (řádek ${radek} ve složené stránce)`;
    }

    /** window.astro v náhledu: odpovídá Editor, jen oznámení a informace, na disk ne. */
    function astroVNahledu(d) {
      const posli = (x) => ramec.contentWindow?.postMessage({ astroApi: 1, ...x }, '*');
      if (d.typ === 'ahoj') {
        posli({ typ: 'info', info: { rezim: 'nahled', aplikace: null, slozka: null, uzivatel: State.get('user').name, motiv: motivProStranku() } });
      } else if (d.typ === 'obnov') {
        obnovNahled(true);
      } else if (d.typ === 'odkaz' && /^https?:\/\//i.test(d.url)) {
        import('../apps.js').then(({ openApp }) => openApp('browser', { url: d.url }));
      } else if (d.typ === 'volani') {
        const [a, b] = d.args || [];
        if (d.metoda === 'oznameni') {
          toast({ title: a || 'Náhled', body: b || '', icon: 'bell' });
          return posli({ typ: 'odpoved', id: d.id, vysledek: true });
        }
        pisDoKonzole('warn', `astro.${d.metoda} v náhledu nefunguje — nainstaluj aplikaci a spusť ji (tlačítko vpravo nahoře).`);
        posli({ typ: 'odpoved', id: d.id, chyba: `astro.${d.metoda} funguje jen v nainstalované aplikaci, ne v náhledu Editoru.` });
      }
    }

    const zprava = (e) => {
      if (e.source === ramec.contentWindow && e.data?.astroApi === 1) return astroVNahledu(e.data);
      if (e.source !== ramec.contentWindow || !e.data?.astroKonzole) return;
      const druh = e.data.druh === 'warn' ? 'warn' : e.data.druh === 'error' ? 'error' : 'log';
      pisDoKonzole(druh, e.data.text + (druh === 'error' ? kdeJeChyba(e.data.radek) : ''));
    };
    window.addEventListener('message', zprava);

    // ---------------------------------------------------------------- rozložení
    function kresliRozlozeni() {
      hlavni.dataset.rozlozeni = st.rozlozeni;
      for (const b of rozlozeniBtn) b.classList.toggle('on', b.dataset.r === st.rozlozeni);
      State.set('editorRozlozeni', st.rozlozeni);
      if (st.rozlozeni !== 'kod') obnovNahled();
    }

    const rozlozeniBtn = [
      ['vedle', 'Kód a náhled vedle sebe', 'grid'],
      ['pod', 'Kód nahoře, náhled dole', 'grid'],
      ['kod', 'Jen kód', 'code'],
      ['nahled', 'Jen náhled', 'monitor'],
    ].map(([r, popis, ik]) => {
      const b = el('button.ce-btn.ic', { title: popis, dataset: { r } }, icon(ik));
      b.onclick = () => { st.rozlozeni = r; kresliRozlozeni(); };
      return b;
    });

    // tažení dělicí příčky
    delic.onpointerdown = (e) => {
      e.preventDefault();
      delic.setPointerCapture(e.pointerId);
      const r = hlavni.getBoundingClientRect();
      const tahni = (ev) => {
        const podil = st.rozlozeni === 'pod'
          ? (ev.clientY - r.top) / r.height
          : (ev.clientX - r.left) / r.width;
        kodEl.style.flexBasis = (clamp(podil, 0.15, 0.85) * 100).toFixed(1) + '%';
      };
      const pust = () => {
        delic.removeEventListener('pointermove', tahni);
        delic.removeEventListener('pointerup', pust);
      };
      delic.addEventListener('pointermove', tahni);
      delic.addEventListener('pointerup', pust);
    };

    // ---------------------------------------------------------------- pruh nástrojů
    const bNovy = el('button.ce-btn', {}, icon('plus'), el('span', { text: 'Nový' }));
    bNovy.onclick = () => {
      const r = bNovy.getBoundingClientRect();
      contextMenu([
        { icon: 'code', label: 'Stránka HTML', onClick: () => novy('html') },
        { icon: 'code', label: 'Styl CSS', onClick: () => novy('css') },
        { icon: 'code', label: 'Skript JavaScript', onClick: () => novy('js') },
        'sep',
        { icon: 'store', label: 'Aplikace pro AstroOS', onClick: novaAplikace },
      ], { x: r.left, y: r.bottom + 6 });
    };

    function novaAplikace() {
      if (!FS.exists(PROJEKTY)) FS.mkdir(PROJEKTY, { parents: true });
      const slozka = FS.normalize(PROJEKTY + '/' + FS.freeName(PROJEKTY, 'moje-aplikace'));
      try {
        FS.mkdir(slozka);
        for (const [jmeno, obsahSouboru] of Object.entries(SABLONA_APLIKACE)) FS.write(slozka + '/' + jmeno, obsahSouboru);
      } catch (err) {
        return toast({ title: 'Nešlo založit', body: err.message, icon: 'info' });
      }
      otevri(slozka + '/app.js');
      otevri(slozka + '/index.html');
      toast({ title: 'Nová aplikace', body: `${slozka.replace(FS.HOME, '~')} — zkus ji tlačítkem Nainstalovat.`, icon: 'store', timeout: 6000 });
    }

    // ---------------------------------------------------------------- spuštění mimo Editor
    /** Uloží rozepsané soubory ze složky — Nova i aplikace čtou disk, ne rozepsané záložky. */
    function ulozSlozku(slozka) {
      let ulozeno = 0;
      for (const s of st.soubory) {
        if (!s.dirty || !s.path.startsWith(slozka + '/')) continue;
        if (s === akt()) s.kod = area.value;
        try { FS.write(s.path, s.kod); s.dirty = false; ulozeno++; }
        catch (err) { toast({ title: 'Uložení selhalo', body: err.message, icon: 'info', timeout: 6000 }); }
      }
      if (ulozeno) { kresliTaby(); nazev(); }
    }

    /** Složka s index.html, ke které patří právě otevřený soubor. */
    function slozkaAplikace() {
      const h = htmlProNahled();
      const s = h ? FS.dirname(h) : akt() ? FS.dirname(akt().path) : null;
      return s && jeAplikaceSlozka(s) ? s : null;
    }

    const bNova = el('button.ce-btn', { title: 'Otevřít stránku v Nově — jako HTML otevřené v prohlížeči' },
      icon('globe'), el('span', { text: 'V Nově' }));
    bNova.onclick = () => {
      const h = htmlProNahled();
      if (!h) return toast({ title: 'Není co otevřít', body: 'Ve složce není žádný HTML soubor.', icon: 'info' });
      ulozSlozku(FS.dirname(h));
      import('../apps.js').then(({ openApp }) => openApp('browser', { url: 'file://' + h }));
    };

    const bAplikace = el('button.ce-btn.ce-aplikace', {}, icon('store'), el('span'));
    function kresliAplikaci() {
      const s = slozkaAplikace();
      const z = s && zaznamPro(s);
      bAplikace.hidden = !s;
      bAplikace.firstChild.replaceWith(icon(z ? 'play' : 'store'));
      bAplikace.lastChild.textContent = z ? 'Spustit' : 'Nainstalovat';
      bAplikace.title = z ? `Spustit aplikaci ${z.nazev} (pravým tlačítkem další možnosti)` : 'Udělat z téhle složky aplikaci v systému';
    }
    bAplikace.onclick = async () => {
      const s = slozkaAplikace();
      if (!s) return;
      ulozSlozku(s);
      const z = zaznamPro(s);
      const { openApp } = await import('../apps.js');
      if (!z) return openApp('instalator', { slozka: s });
      const { windows } = await import('../wm.js');
      const bezi = windows.find((w) => w.app.id === z.id);
      openApp(z.id);
      bezi?.obnovAplikaci?.();          // už běží → načíst znovu s novými soubory
    };
    bAplikace.oncontextmenu = (e) => {
      e.preventDefault();
      const s = slozkaAplikace();
      const z = s && zaznamPro(s);
      if (!z) return;
      contextMenu([
        { icon: 'play', label: 'Spustit', onClick: () => bAplikace.onclick() },
        { icon: 'store', label: 'Upravit instalaci…', onClick: () => import('../apps.js').then(({ openApp }) => openApp('instalator', { slozka: s })) },
        'sep',
        { icon: 'trash', label: 'Odinstalovat', danger: true, onClick: () => import('../aplikace.js').then((a) => a.odinstaluj(z.id)) },
      ], { x: e.clientX, y: e.clientY });
    };
    const odhlasAplikace = bus.on('aplikace', kresliAplikaci);

    const bOtevri = el('button.ce-btn', {}, icon('folderOpen'), el('span', { text: 'Otevřít' }));
    bOtevri.onclick = () => nabidkaOtevrit(bOtevri);

    const bAuto = el('button.ce-btn' + (st.auto ? '.on' : ''), { title: 'Obnovovat náhled při psaní' },
      icon('refresh'), el('span', { text: 'Živě' }));
    bAuto.onclick = () => {
      st.auto = !st.auto;
      bAuto.classList.toggle('on', st.auto);
      State.set('editorAuto', st.auto);
      if (st.auto) obnovNahled();
    };

    // ---------------------------------------------------------------- AI panel (editorAi.js)
    /** Soubory projektu = textové soubory ve složce, ke které patří náhled. */
    function projekt() {
      const h = htmlProNahled();
      const slozka = h ? FS.dirname(h) : akt() ? FS.dirname(akt().path) : ZAKLAD;
      let polozky = [];
      try { polozky = FS.list(slozka).filter((it) => !it.dir && ['html', 'css', 'js', 'json'].includes(jazykSouboru(it.name))); } catch { /* složka zmizela */ }
      const soubory = polozky.map((it) => ({ path: it.path, nazev: it.name, jazyk: jazykSouboru(it.name), kod: obsah(it.path) }))
        .filter((f) => f.kod !== null && f.kod.length < 40000);
      // rozepsané nové soubory ve stejné složce, které ještě nejsou na disku
      for (const t of st.soubory) if (FS.dirname(t.path) === slozka && !soubory.some((f) => f.path === t.path)) soubory.push({ path: t.path, nazev: FS.basename(t.path), jazyk: t.jazyk, kod: t === akt() ? area.value : t.kod });
      return { slozka, soubory };
    }

    /** Nový obsah souboru od AI (null = soubor nebyl → smazat). Jde do záložky jako neuložený. */
    function nastavObsah(path, kod) {
      const p = FS.normalize(path);
      let i = st.soubory.findIndex((s) => s.path === p);
      if (kod === null) {
        if (i >= 0) { st.soubory[i].dirty = false; zavriTab(i); }
        try { if (FS.exists(p)) FS.remove(p); } catch { /* nevadí */ }
        obnovNahled();
        return;
      }
      if (i < 0) {
        if (!FS.exists(p)) {
          try { FS.write(p, kod); } catch (err) { return toast({ title: 'Nešlo založit', body: err.message, icon: 'info' }); }
          otevri(p);
          return;
        }
        const zpet = st.i;
        otevri(p);
        i = st.soubory.findIndex((s) => s.path === p);
        if (zpet >= 0) prepni(zpet);
      }
      const s = st.soubory[i];
      s.kod = kod;
      s.dirty = true;
      if (s === akt()) area.value = kod;
      kresliTaby();
      prekresli();
      nazev();
      obnovNahled();
    }

    let aiPanel = null;
    const bAi = el('button.ce-btn.ce-ai-btn' + (st.ai ? '.on' : ''), { title: 'AstroAI — napiš, co má udělat s kódem' }, icon('ai'), el('span', { text: 'AI' }));
    function kresliAi() {
      bAi.classList.toggle('on', st.ai);
      State.set('editorAi', st.ai);
      if (st.ai && !aiPanel) {
        aiPanel = vytvorAiPanel({
          projekt,
          aktivni: () => akt()?.path || null,
          vyber: () => area.value.slice(area.selectionStart, area.selectionEnd),
          chyby: () => st.chyby,
          nastav: nastavObsah,
          vlozit: (t) => { if (!akt()) return; area.focus(); area.setRangeText(t, area.selectionStart, area.selectionEnd, 'end'); area.dispatchEvent(new Event('input')); },
          zavri: () => { st.ai = false; kresliAi(); },
        });
        obal.append(aiPanel);
      }
      aiPanel?.classList.toggle('skryty', !st.ai);
      if (st.ai) aiPanel.otevreno();
    }
    bAi.onclick = () => { st.ai = !st.ai; kresliAi(); };

    const bar = el('div.ce-bar', {},
      el('div.ce-grp', {}, bNovy, bOtevri,
        el('button.ce-btn', { title: 'Uložit (Ctrl+S)', onclick: uloz }, icon('save'), el('span', { text: 'Uložit' }))),
      el('div.ce-grp', {}, bAuto,
        el('button.ce-btn.ic', { title: 'Obnovit náhled (Ctrl+Enter)', onclick: () => obnovNahled(true) }, icon('restore'))),
      el('div.ce-grp', {}, ...rozlozeniBtn),
      el('div.ce-spacer'),
      el('div.ce-grp', {}, bAi, bNova, bAplikace),
    );

    body.append(el('div.ce', {}, bar, tabyEl, obal,
      el('div.ce-foot', {}, cestaEl, el('div.ce-spacer'), pozice, jazykEl)));

    // ---------------------------------------------------------------- vstup
    area.oninput = () => {
      const s = akt();
      if (!s) return;
      s.kod = area.value;
      if (!s.dirty) { s.dirty = true; kresliTaby(); nazev(); }
      prekresli();
      naplanujObnovu();
    };
    area.onscroll = synchronizujScroll;
    area.onclick = poziceKurzoru;
    area.onkeyup = poziceKurzoru;

    area.onkeydown = (e) => {
      e.stopPropagation();                       // ať zkratky systému nekradou psaní
      const k = e.key.toLowerCase();
      if (e.ctrlKey && k === 's') { e.preventDefault(); uloz(); return; }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); obnovNahled(true); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        area.setRangeText('  ', area.selectionStart, area.selectionEnd, 'end');
        area.dispatchEvent(new Event('input'));
      }
    };

    // ---------------------------------------------------------------- start
    kresliRozlozeni();
    if (st.ai) kresliAi();
    kresliTaby();
    prekresli();
    nazev();

    if (win.opts?.novaAplikace) {
      novaAplikace();
    } else if (win.opts?.path) {
      otevri(win.opts.path);
    } else {
      // První spuštění: založíme malý webový projekt, ať je co upravovat.
      if (!FS.exists(ZAKLAD + '/index.html') && !State.get('editorZaklad')) {
        try {
          FS.mkdir(ZAKLAD, { parents: true });
          FS.write(ZAKLAD + '/index.html', SABLONY.html);
          FS.write(ZAKLAD + '/styl.css', SABLONY.css);
          FS.write(ZAKLAD + '/skript.js', SABLONY.js);
          State.set('editorZaklad', true);
        } catch { /* plný disk — ukážeme aspoň prázdný editor */ }
      }
      if (FS.exists(ZAKLAD + '/index.html')) otevri(ZAKLAD + '/index.html');
    }
    setTimeout(() => area.focus(), 60);

    win.otevriSoubor = (p) => otevri(p);
    win.novaAplikace = novaAplikace;
    win.onClose = () => {
      window.removeEventListener('message', zprava);
      clearTimeout(st.cekac);
      odhlasAplikace();
      aiPanel?.zastav();
    };
    // sdk/ se stahuje jednou — jakmile dorazí, náhled se složí znovu i s window.astro
    if (!SDK) nactiSdk().then((sdk) => { if (sdk) { posledniDokument = null; obnovNahled(); } });
  },

  reopen(win, opts) {
    if (opts?.novaAplikace) win.novaAplikace?.();
    else if (opts?.path) win.otevriSoubor?.(opts.path);
  },
  unmount(win) { win.onClose?.(); },
};
