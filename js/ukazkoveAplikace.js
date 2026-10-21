// AstroOS — ukázkové aplikace do Obchodu
//
// Jsou napsané stejně, jako je může napsat kdokoli v Editoru: složka s index.html,
// app.js, styl.css a app.json. Obchod je nasype do ~/Aplikace/<název> a nainstaluje,
// takže si je uživatel může otevřít v Editoru, rozebrat a přepsat.

import * as FS from './fs.js';

const A = FS.HOME + '/Aplikace';

// ---------------------------------------------------------------- Počasí
const POCASI = {
  'app.json': { nazev: 'Počasí', popis: 'Skutečná předpověď z open-meteo.com', ikona: 'weather', barva: '#4aa3e8', kategorie: 'net', sirka: 460, vyska: 620 },
  'index.html': `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Počasí</title>
  <link rel="stylesheet" href="/__astro/styl.css">
  <link rel="stylesheet" href="styl.css">
</head>
<body>
  <form id="hledani" class="radek">
    <input id="mesto" placeholder="Město, třeba Brno" autocomplete="off">
    <button class="hlavni">Hledat</button>
  </form>

  <main id="obsah">
    <p class="tlumene">Načítám…</p>
  </main>

  <p class="zdroj tlumene">Data: open-meteo.com</p>
  <script src="app.js"></script>
</body>
</html>
`,
  'styl.css': `body { display: flex; flex-direction: column; gap: 16px; min-height: 100vh; }
#hledani input { flex: 1; }

.ted { text-align: center; padding: 22px 16px; }
.ted .ikona { font-size: 64px; line-height: 1; }
.ted .teplota { font-size: 56px; font-weight: 200; margin: 6px 0 2px; }
.ted .misto { font-size: 17px; font-weight: 600; }

.dny { display: flex; flex-direction: column; gap: 2px; margin-top: 14px; }
.den {
  display: grid;
  grid-template-columns: 90px 36px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
}
.den:nth-child(odd) { background: var(--astro-karta); }
.den .max { font-weight: 600; }
.den .min { color: var(--astro-text-3); margin-left: 8px; }
.pruh { height: 5px; border-radius: 5px; background: linear-gradient(90deg, #4aa3e8, var(--astro-akcent), #f0b95c); opacity: .7; }

.zdroj { margin-top: auto; font-size: 11px; text-align: center; }
`,
  'app.js': `// Počasí — skutečná data z internetu přes astro.web() (jde přes proxy AstroOS, takže nevadí CORS).
// Poslední město si pamatuje v localStorage — každá aplikace má vlastní, oddělené od systému.

const obsah = document.getElementById('obsah');
const pole = document.getElementById('mesto');

// kódy počasí WMO → obrázek a popis
const KODY = {
  0: ['☀️', 'jasno'], 1: ['🌤️', 'skoro jasno'], 2: ['⛅', 'polojasno'], 3: ['☁️', 'zataženo'],
  45: ['🌫️', 'mlha'], 48: ['🌫️', 'námraza'], 51: ['🌦️', 'mrholení'], 53: ['🌦️', 'mrholení'], 55: ['🌧️', 'silné mrholení'],
  61: ['🌧️', 'slabý déšť'], 63: ['🌧️', 'déšť'], 65: ['🌧️', 'silný déšť'], 71: ['🌨️', 'slabé sněžení'],
  73: ['🌨️', 'sněžení'], 75: ['❄️', 'silné sněžení'], 80: ['🌦️', 'přeháňky'], 81: ['🌧️', 'přeháňky'],
  82: ['⛈️', 'prudké přeháňky'], 95: ['⛈️', 'bouřka'], 96: ['⛈️', 'bouřka s kroupami'], 99: ['⛈️', 'bouřka s kroupami'],
};
const kod = (k) => KODY[k] || ['🌡️', 'neznámo'];
const DNY = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];

async function najdiMesto(nazev) {
  const r = await astro.web('https://geocoding-api.open-meteo.com/v1/search?count=1&language=cs&name=' + encodeURIComponent(nazev));
  const data = await r.json();
  if (!data.results || !data.results.length) throw new Error('Město „' + nazev + '“ jsem nenašel.');
  return data.results[0];
}

async function predpoved(misto) {
  const url = 'https://api.open-meteo.com/v1/forecast?timezone=auto'
    + '&latitude=' + misto.latitude + '&longitude=' + misto.longitude
    + '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m'
    + '&daily=temperature_2m_max,temperature_2m_min,weather_code';
  const r = await astro.web(url);
  return r.json();
}

function vykresli(misto, p) {
  const [ikona, popis] = kod(p.current.weather_code);
  let dny = '';
  p.daily.time.forEach((den, i) => {
    const d = new Date(den);
    dny += '<div class="den">'
      + '<span>' + (i === 0 ? 'dnes' : DNY[d.getDay()] + ' ' + d.getDate() + '.') + '</span>'
      + '<span>' + kod(p.daily.weather_code[i])[0] + '</span>'
      + '<div class="pruh"></div>'
      + '<span><span class="max">' + Math.round(p.daily.temperature_2m_max[i]) + '°</span>'
      + '<span class="min">' + Math.round(p.daily.temperature_2m_min[i]) + '°</span></span>'
      + '</div>';
  });

  obsah.innerHTML =
    '<div class="karta ted">'
    + '<div class="misto">' + misto.name + '</div>'
    + '<div class="tlumene">' + (misto.admin1 || '') + (misto.country ? ', ' + misto.country : '') + '</div>'
    + '<div class="ikona">' + ikona + '</div>'
    + '<div class="teplota">' + Math.round(p.current.temperature_2m) + '°</div>'
    + '<div>' + popis + ' · vítr ' + Math.round(p.current.wind_speed_10m) + ' km/h · vlhkost ' + p.current.relative_humidity_2m + ' %</div>'
    + '</div>'
    + '<div class="dny">' + dny + '</div>';

  astro.okno.titulek('Počasí — ' + misto.name);
}

async function ukaz(nazev) {
  obsah.innerHTML = '<p class="tlumene">Hledám ' + nazev + '…</p>';
  try {
    const misto = await najdiMesto(nazev);
    vykresli(misto, await predpoved(misto));
    localStorage.setItem('mesto', nazev);
  } catch (chyba) {
    obsah.innerHTML = '<p>' + chyba.message + '</p>';
  }
}

document.getElementById('hledani').addEventListener('submit', (e) => {
  e.preventDefault();
  if (pole.value.trim()) ukaz(pole.value.trim());
});

ukaz(localStorage.getItem('mesto') || 'Praha');
`,
};

// ---------------------------------------------------------------- Úkoly
const UKOLY = {
  'app.json': { nazev: 'Úkoly', popis: 'Seznam úkolů uložený na disku', ikona: 'check', barva: '#46c36f', kategorie: 'office', sirka: 440, vyska: 560 },
  'index.html': `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Úkoly</title>
  <link rel="stylesheet" href="/__astro/styl.css">
  <link rel="stylesheet" href="styl.css">
</head>
<body>
  <h1>Úkoly</h1>
  <p id="souhrn" class="tlumene"></p>

  <form id="novy" class="radek">
    <input id="text" placeholder="Co je potřeba udělat?" autocomplete="off">
    <button class="hlavni">Přidat</button>
  </form>

  <ul id="seznam"></ul>

  <div class="radek paticka">
    <button id="uklid">Smazat hotové</button>
    <span class="tlumene">Ukládá se do <code>~/Dokumenty/úkoly.json</code></span>
  </div>

  <script src="app.js"></script>
</body>
</html>
`,
  'styl.css': `#novy input { flex: 1; }

#seznam { list-style: none; padding: 0; margin: 16px 0; display: flex; flex-direction: column; gap: 6px; }
#seznam li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--astro-okraj);
  border-radius: var(--astro-rohy);
  background: var(--astro-karta);
}
#seznam li span { flex: 1; }
#seznam li.hotovo span { text-decoration: line-through; color: var(--astro-text-3); }
#seznam li button { padding: 2px 8px; border: 0; background: none; color: var(--astro-text-3); }
#seznam li button:hover { color: #ef6a5a; }

.paticka { justify-content: space-between; font-size: 12px; }
`,
  'app.js': `// Úkoly — data žijí v obyčejném souboru na virtuálním disku (astro.fs), takže je
// uvidíš i v Souborech a otevřeš v Poznámkách.

const SOUBOR = '~/Dokumenty/úkoly.json';
let ukoly = [];

const seznam = document.getElementById('seznam');
const text = document.getElementById('text');

async function nacti() {
  if (await astro.fs.existuje(SOUBOR)) {
    try { ukoly = JSON.parse(await astro.fs.cti(SOUBOR)); } catch (e) { ukoly = []; }
  }
  vykresli();
}

function uloz() {
  vykresli();
  return astro.fs.zapis(SOUBOR, JSON.stringify(ukoly, null, 2));
}

function vykresli() {
  seznam.innerHTML = '';
  ukoly.forEach((ukol, i) => {
    const li = document.createElement('li');
    li.className = ukol.hotovo ? 'hotovo' : '';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = ukol.hotovo;
    box.onchange = () => {
      ukol.hotovo = box.checked;
      uloz();
      if (ukoly.every((u) => u.hotovo)) astro.oznameni('Všechno hotovo!', 'Seznam úkolů je prázdný. 🎉');
    };

    const popis = document.createElement('span');
    popis.textContent = ukol.text;

    const smaz = document.createElement('button');
    smaz.textContent = '✕';
    smaz.title = 'Smazat';
    smaz.onclick = () => { ukoly.splice(i, 1); uloz(); };

    li.append(box, popis, smaz);
    seznam.append(li);
  });

  const zbyva = ukoly.filter((u) => !u.hotovo).length;
  document.getElementById('souhrn').textContent = ukoly.length
    ? 'Zbývá ' + zbyva + ' z ' + ukoly.length
    : 'Zatím žádné úkoly.';
}

document.getElementById('novy').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!text.value.trim()) return;
  ukoly.push({ text: text.value.trim(), hotovo: false });
  text.value = '';
  uloz();
});

document.getElementById('uklid').onclick = () => {
  ukoly = ukoly.filter((u) => !u.hotovo);
  uloz();
};

nacti();
`,
};

// ---------------------------------------------------------------- Stopky
const STOPKY = {
  'app.json': { nazev: 'Stopky', popis: 'Stopky s mezičasy a minutka s oznámením', ikona: 'clock', barva: '#f0b95c', kategorie: 'tools', sirka: 400, vyska: 520 },
  'index.html': `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Stopky</title>
  <link rel="stylesheet" href="/__astro/styl.css">
  <link rel="stylesheet" href="styl.css">
</head>
<body>
  <nav class="radek">
    <button id="z-stopky" class="hlavni">Stopky</button>
    <button id="z-minutka">Minutka</button>
  </nav>

  <section id="stopky">
    <div id="cas" class="velky">0:00.00</div>
    <div class="radek stred">
      <button id="start" class="hlavni">Start</button>
      <button id="mezicas">Mezičas</button>
      <button id="reset">Vynulovat</button>
    </div>
    <ol id="mezicasy"></ol>
  </section>

  <section id="minutka" hidden>
    <div id="zbyva" class="velky">5:00</div>
    <div class="radek stred">
      <input id="minuty" type="number" min="1" max="180" value="5"> min
      <button id="spust" class="hlavni">Spustit</button>
    </div>
  </section>

  <script src="app.js"></script>
</body>
</html>
`,
  'styl.css': `nav { justify-content: center; margin-bottom: 10px; }
.velky {
  font-size: 58px;
  font-weight: 200;
  text-align: center;
  font-variant-numeric: tabular-nums;
  margin: 24px 0;
}
.stred { justify-content: center; }
#minuty { width: 70px; }
#mezicasy { max-height: 180px; overflow: auto; font-variant-numeric: tabular-nums; color: var(--astro-text-2); }
`,
  'app.js': `// Stopky a minutka. Až minutka doběhne, pošle oznámení do systému (astro.oznameni).

const dva = (n) => String(n).padStart(2, '0');
function formatuj(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + dva(s % 60) + '.' + dva(Math.floor((ms % 1000) / 10));
}

// ---------- přepínání ----------
function prepni(co) {
  document.getElementById('stopky').hidden = co !== 'stopky';
  document.getElementById('minutka').hidden = co !== 'minutka';
  document.getElementById('z-stopky').className = co === 'stopky' ? 'hlavni' : '';
  document.getElementById('z-minutka').className = co === 'minutka' ? 'hlavni' : '';
}
document.getElementById('z-stopky').onclick = () => prepni('stopky');
document.getElementById('z-minutka').onclick = () => prepni('minutka');

// ---------- stopky ----------
let zacatek = 0, nabehano = 0, bezi = false;
const cas = document.getElementById('cas');
const tlStart = document.getElementById('start');

function tik() {
  if (!bezi) return;
  cas.textContent = formatuj(nabehano + Date.now() - zacatek);
  requestAnimationFrame(tik);
}

tlStart.onclick = () => {
  if (bezi) { nabehano += Date.now() - zacatek; bezi = false; tlStart.textContent = 'Pokračovat'; return; }
  zacatek = Date.now(); bezi = true; tlStart.textContent = 'Pauza'; tik();
};
document.getElementById('mezicas').onclick = () => {
  const li = document.createElement('li');
  li.textContent = cas.textContent;
  document.getElementById('mezicasy').prepend(li);
};
document.getElementById('reset').onclick = () => {
  bezi = false; nabehano = 0; cas.textContent = formatuj(0); tlStart.textContent = 'Start';
  document.getElementById('mezicasy').innerHTML = '';
};

// ---------- minutka ----------
let konec = 0, casovac = null;
const zbyva = document.getElementById('zbyva');

document.getElementById('spust').onclick = () => {
  const minuty = Number(document.getElementById('minuty').value) || 5;
  konec = Date.now() + minuty * 60000;
  clearInterval(casovac);
  casovac = setInterval(() => {
    const ms = Math.max(0, konec - Date.now());
    const s = Math.ceil(ms / 1000);
    zbyva.textContent = Math.floor(s / 60) + ':' + dva(s % 60);
    astro.okno.titulek('Stopky — ' + zbyva.textContent);
    if (ms === 0) {
      clearInterval(casovac);
      astro.okno.titulek('Stopky');
      astro.oznameni('Minutka doběhla', minuty + ' min je pryč ⏰');
    }
  }, 250);
};
`,
};

export const UKAZKOVE = [
  // Počasí je od 2026-09-21 součást systému (js/apps/pocasi.js); POCASI tu zůstává jako
  // příklad aplikace s astro.web(), kdyby se hodil do příručky.
  { id: 'ukoly', slozka: A + '/Úkoly', soubory: UKOLY },
  { id: 'stopky', slozka: A + '/Stopky', soubory: STOPKY },
];

/** Nasype soubory ukázky na disk (app.json jako JSON text). */
export function zapisUkazku(u) {
  if (!FS.exists(u.slozka)) FS.mkdir(u.slozka, { parents: true });
  for (const [jmeno, obsah] of Object.entries(u.soubory)) {
    FS.write(u.slozka + '/' + jmeno, typeof obsah === 'string' ? obsah : JSON.stringify(obsah, null, 2) + '\n');
  }
}
