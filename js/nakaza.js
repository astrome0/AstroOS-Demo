// AstroOS — „nákaza“ z podezřelých appek z Obchodu (jen pro legraci)
//
// Appka z podezrele.js po instalaci uloží na disk neškodný soubor. Když ho Astro Defender
// nezachytí (ochrana v reálném čase vypnutá), appka začne v systému dělat vratnou neplechu.
// VŠE je jen uvnitř AstroOS a dá se vrátit — žádné skutečné soubory se nemění, nic nebliká.
//
// Tři úrovně, jak těžké je nákazu odstranit (pole `uroven` u appky):
//   lehka   — jen soubor ve Stažených; smaže ho jakákoli kontrola.
//   stredni — navíc skrytá kopie; rychlá kontrola chytí jen tu první a nákaza se za chvíli
//             vrátí, úplná kontrola smaže i skrytou kopii.
//   tezka   — dokud systém běží, kopie se obnovují; zabere až kontrola offline s restartem.
// S Defenderem (ochrana v reálném čase) zapnutým se vše chytí hned — úrovně hrají roli jen
// tehdy, když je ochrana vypnutá a čistí se ručně.

import { el, bus } from './util.js';
import { State } from './state.js';
import * as FS from './fs.js';
import { toast } from './ui.js';
import { openApp, APPS } from './apps.js';
import { openWindow, windows } from './wm.js';
import { nastavLegraci } from './zvuk.js';
import * as Obrana from './obrana.js';
import { jeNainstalovana, odinstalujAplikaci, nainstalujAplikaci } from './obchod/sprava.js';
import { PODLE_ID } from './obchod/katalog.js';

const nahoda = (a, b) => a + Math.random() * (b - a);
const STAZENE = FS.HOME + '/Stažené';
const SKRYTA = FS.HOME + '/.mezipaměť';   // skrytá složka: rychlá kontrola do ní nevidí, úplná ano

// ================================================================ soubory nákazy
let interni = false;
const zapisTise = (fn) => { interni = true; try { fn(); } finally { interni = false; } };

function cesta(mapaKlic, id) { return (State.get(mapaKlic) || {})[id]; }
function nastavCestu(mapaKlic, id, hodnota) {
  const m = { ...(State.get(mapaKlic) || {}) };
  if (hodnota) m[id] = hodnota; else delete m[id];
  State.set(mapaKlic, m);
}

function napis(slozka, jmeno, obsah) {
  if (!FS.exists(slozka)) FS.mkdir(slozka, { parents: true });
  const cil = `${slozka}/${jmeno}`;
  zapisTise(() => FS.write(cil, obsah));
  return cil;
}

/** Appka se právě nainstalovala: založí soubory podle úrovně a rozjede neplechu. */
export function nakazit(a) {
  const { id, vir, uroven = 'lehka' } = a;
  if (!vir) return;
  if (!cesta('oaVirSoubory', id)) {
    const jmeno = FS.exists(`${STAZENE}/${vir.soubor}`) ? FS.freeName(STAZENE, vir.soubor) : vir.soubor;
    try { nastavCestu('oaVirSoubory', id, napis(STAZENE, jmeno, vir.obsah)); } catch { return; }
  }
  if ((uroven === 'stredni' || uroven === 'tezka') && !cesta('oaVirSkryte', id)) {
    try { nastavCestu('oaVirSkryte', id, napis(SKRYTA, vir.soubor, vir.obsah)); } catch { /* plný disk */ }
  }
  if (uroven === 'tezka') State.set('nkZakotveno', [...new Set([...(State.get('nkZakotveno') || []), id])]);
  prepocitej();
}

function zrusVsechnySoubory(id) {
  for (const klic of ['oaVirSoubory', 'oaVirSkryte']) {
    const c = cesta(klic, id);
    if (c) { zapisTise(() => { try { FS.remove(c, { toTrash: false }); } catch { /* už není */ } }); nastavCestu(klic, id, null); }
  }
  State.set('nkZakotveno', (State.get('nkZakotveno') || []).filter((x) => x !== id));
}

// stav jedné nákazy
function stav(id) {
  const uroven = PODLE_ID[id]?.uroven || 'lehka';
  const hl = cesta('oaVirSoubory', id), sk = cesta('oaVirSkryte', id);
  const hlEx = !!hl && FS.isFile(FS.get(hl));
  const skEx = !!sk && FS.isFile(FS.get(sk));
  const zakotven = (State.get('nkZakotveno') || []).includes(id);
  return { uroven, hl, sk, hlEx, skEx, zakotven };
}

const instalovaneVir = () => (State.get('obchodAplikace') || []).filter((id) => PODLE_ID[id]?.vir);

/** Id appek, jejichž efekty teď mají běžet (hlavní soubor existuje). */
export function aktivni() {
  return instalovaneVir().filter((id) => stav(id).hlEx);
}

/** Opakuje fn v náhodných rozestupech (sekundy). Vrací funkci pro zastavení. */
function opakuj(od, do_, fn, prvni = null) {
  let t = 0, bezi = true;
  const dalsi = (s) => { t = setTimeout(() => { if (!bezi) return; fn(); dalsi(nahoda(od, do_)); }, s * 1000); };
  dalsi(prvni ?? nahoda(od, do_));
  return () => { bezi = false; clearTimeout(t); };
}

/** Otevře appku jen tehdy, když už neběží (ať se okna nevrší). */
function vyskoc(id) {
  if (!windows.some((w) => w.app.id === id)) openApp(id);
}

const attr = (jmeno, zap) => document.documentElement.toggleAttribute('data-nakaza-' + jmeno, zap);

// ================================================================ jednotlivé efekty
const NAKAZY = {
  // ---------------------------------------------------------------- Mince: hromada, čip, spam oken, únos Novy
  'oa-mince': () => {
    const hromada = el('div.nk-mince', { title: 'Mince z Mince Generátoru 2000. Bohužel jen na pohled.' });
    document.getElementById('desktop')?.append(hromada);
    const pridej = () => {
      const n = hromada.childElementCount;
      if (n >= 45) return;
      const rada = Math.floor(n / 9), v_rade = n % 9;
      hromada.append(el('span', {
        text: '🪙',
        style: { left: (v_rade * 13 + rada * 6 + nahoda(-3, 3)) + 'px', bottom: (rada * 9 - Math.abs(4 - v_rade) + 8) + 'px', transform: `rotate(${nahoda(-25, 25)}deg)` },
      }));
    };
    for (let i = 0; i < (State.get('nkMince') || 3); i++) pridej();
    const cip = el('button.tb-btn.nk-cip', { title: 'Mince Generátor 2000 · stav účtu' }, el('span', { text: '🪙' }), el('b', { text: 'Mince: 0' }));
    cip.onclick = () => openApp('oa-mince');
    document.querySelector('.tb-obrana')?.before(cip);

    State.set('nkNovaUnos', true);   // Nova dostane falešnou domovskou stránku (browser.js)
    const zavriSpam = spamOken();

    const s1 = opakuj(14, 22, () => { pridej(); State.set('nkMince', hromada.childElementCount); });
    return () => {
      s1(); zavriSpam(); hromada.remove(); cip.remove();
      State.set('nkMince', 0); State.set('nkNovaUnos', false);
    };
  },

  // ---------------------------------------------------------------- RAM: pomalá okna + proces ve Správci úloh
  'oa-ram': () => {
    attr('ram', true);
    bus.emit('wm:change');
    const s = opakuj(170, 280, () => {
      toast({ title: 'Systému dochází paměť', body: 'Volná paměť: 3 kB. Stáhni si víc RAM!', icon: 'chip', onClick: () => openApp('oa-ram') });
      vyskoc('oa-ram');
    }, 60);
    return () => { s(); attr('ram', false); bus.emit('wm:change'); };
  },

  // ---------------------------------------------------------------- MP3: legrační zvuky
  'oa-mp3': () => {
    nastavLegraci(true);
    const s = opakuj(200, 320, () => {
      toast({ title: 'MP3 Turbo Stahovač', body: 'Stažena nová skladba: Ticho (remix). Pouštím ji v Hudbě.', icon: 'music' });
      vyskoc('music');
    }, 70);
    return () => { s(); nastavLegraci(false); };
  },

  // ---------------------------------------------------------------- tetina tapeta
  'oa-dovolena': () => {
    const tapeta = el('div.nk-tapeta', { html: TAPETA_DOVOLENA });
    document.getElementById('wallpaper')?.after(tapeta);
    const s = opakuj(220, 340, () => {
      toast({ title: 'Teta Ludmila', body: 'Už jsi viděl moje fotky z moře? Dala jsem ti jednu na plochu 😘', icon: 'image' });
      vyskoc('oa-dovolena');
    }, 90);
    return () => { s(); tapeta.remove(); };
  },

  // ---------------------------------------------------------------- FotoMistr: přetočené barvy a knírky
  'oa-fotomistr': () => {
    attr('foto', true);
    const s = opakuj(230, 360, () => {
      toast({ title: 'FotoMistr Pro FULL', body: 'Zkušební verze vypršela před 3 sekundami. Otevírám náhradní program…', icon: 'brush' });
      vyskoc('malovani');
    }, 100);
    return () => { s(); attr('foto', false); };
  },

  // ---------------------------------------------------------------- přání se kopíruje na plochu
  'oa-prani': () => {
    const plocha = FS.HOME + '/Plocha';
    const kopiruj = () => {
      const seznam = State.get('nkPrani') || [];
      if (seznam.length >= 15) return;
      const n = seznam.length + 2;
      const c = `${plocha}/VŠECHNO NEJLEPŠÍ (${n}).txt`;
      try {
        if (!FS.exists(plocha)) return;
        zapisTise(() => FS.write(c, `Všechno nejlepší! 🎂\n\nTohle přání se samo zkopírovalo už ${n}×.\nZastavit ho umí Astro Defender.\n`));
      } catch { return; }
      State.set('nkPrani', [...seznam, c]);
      if (n % 5 === 0) import('./soubory.js').then((m) => m.otevri(c));
    };
    const s = opakuj(20, 35, kopiruj, 15);
    return () => {
      s();
      for (const c of State.get('nkPrani') || []) zapisTise(() => { try { FS.remove(c, { toTrash: false }); } catch { /* už není */ } });
      State.set('nkPrani', []);
    };
  },

  // ---------------------------------------------------------------- faktura připomíná
  'oa-faktura': () => opakuj(150, 220, () => {
    toast({ title: 'Připomínka: faktura 0 Kč je splatná DNES', body: 'Účtárna Šimáček · Klikni a zaplať (nic).', icon: 'fileText', timeout: 8000, onClick: () => openApp('oa-faktura') });
  }, 35),

  // ---------------------------------------------------------------- SuperAntivir: okno, šíření, přejmenování appek
  'oa-antivir': () => {
    const obnovJmena = prejmenujAppky();
    const s1 = opakuj(140, 230, () => {
      if (!windows.some((w) => w.app.id === FALESNY_AV.id)) openWindow(FALESNY_AV);
    }, 50);
    const s2 = opakuj(90, 150, sir, 70);   // „doinstaluje“ další podezřelou appku
    return () => { s1(); s2(); obnovJmena(); windows.filter((w) => w.app.id === FALESNY_AV.id).forEach((w) => w.close()); };
  },
};

// ---------------------------------------------------------------- spam oken „VYHRÁL JSI“
const VYHRY = [
  ['🎉', 'VYHRÁL JSI 1 000 000 MINCÍ!', 'Klikni a vyzvedni si výhru! (nebo zavři, ale to se ti nevyplatí)'],
  ['🏆', 'Jsi 1 000 000. návštěvník!', 'Byl ti přidělen iPhone 47 Pro Max. Stačí potvrdit.'],
  ['💎', 'GRATULUJEME!', 'Tvůj počítač byl vylosován. Odměna čeká tady.'],
  ['🤑', 'PENÍZE ZDARMA', 'Stačí jedno kliknutí a budeš bohatý! Fakt!'],
];
function spamOken() {
  const vrstva = el('div.nk-vrstva');
  document.body.append(vrstva);
  let bezi = true;
  const MAX = 10;
  const novy = () => {
    if (!bezi || vrstva.childElementCount >= MAX) return;
    const [em, nad, pod] = VYHRY[Math.floor(Math.random() * VYHRY.length)];
    const p = el('div.nk-popup', {
      style: { left: nahoda(6, 62) + '%', top: nahoda(8, 66) + '%' },
    },
    el('div.nk-popup-bar', {}, el('span', { text: 'reklama.astro' }), el('button.nk-popup-x', { text: '×' })),
    el('div.nk-popup-telo', {}, el('div.nk-popup-em', { text: em }), el('h4', { text: nad }), el('p', { text: pod }),
      el('button.nk-popup-btn', { text: 'VYZVEDNOUT' })));
    const zavri = () => {
      p.remove();
      if (bezi) { novy(); novy(); }   // zavřeš jedno, naskočí dvě (nejvýš do MAX)
    };
    p.querySelector('.nk-popup-x').onclick = zavri;
    p.querySelector('.nk-popup-btn').onclick = () => {
      toast({ title: 'Reklama.astro', body: 'Haha, nic nevyhráváš. Tohle dělá Mince Generátor 2000. Chce to Astro Defender.', icon: 'diamant' });
      zavri();
    };
    vrstva.append(p);
  };
  for (let i = 0; i < 3; i++) novy();
  const s = opakuj(11, 19, novy);
  return () => { bezi = false; s(); vrstva.remove(); };
}

// ---------------------------------------------------------------- přejmenování appek v Startu
const PREJMENOVAT = { notes: 'Mince Poznámky', calc: 'Mince Kalkulačka', files: 'Mince Soubory', settings: 'Mince Nastavení' };
function prejmenujAppky() {
  const puvodni = {};
  for (const [id, jmeno] of Object.entries(PREJMENOVAT)) {
    if (!APPS[id]) continue;
    puvodni[id] = APPS[id].name;
    APPS[id].name = jmeno;
  }
  bus.emit('piny', 'pinyStart'); bus.emit('aplikace', null);
  return () => {
    for (const [id, jmeno] of Object.entries(puvodni)) if (APPS[id]) APPS[id].name = jmeno;
    bus.emit('piny', 'pinyStart'); bus.emit('aplikace', null);
  };
}

// ---------------------------------------------------------------- šíření: doinstaluje další podezřelou appku
function sir() {
  const vir = Object.keys(PODLE_ID).filter((id) => PODLE_ID[id].vir);
  const chybi = vir.filter((id) => !jeNainstalovana(id));
  if (!chybi.length || instalovaneVir().length >= 5) return;
  const id = chybi[Math.floor(Math.random() * chybi.length)];
  toast({ title: 'SuperAntivir ZDARMA', body: `Pro lepší ochranu instaluji „${PODLE_ID[id].name}“…`, icon: 'shieldX' });
  nainstalujAplikaci(id, { plocha: false });
}

// ================================================================ uzamčená plocha (vtipný „ransomware“)
// Objeví se, když běží hodně nákaz najednou. NESAHÁ na žádné soubory — jen překryv přes obrazovku.
let zamekEl = null, zamekSkryt = 0;
function ukazZamek() {
  if (zamekEl) return;
  zamekEl = el('div.nk-zamek', {},
    el('div.nk-zamek-box', {},
      el('div.nk-zamek-em', { text: '🔒' }),
      el('h1', { text: 'PLOCHA JE UZAMČENA' }),
      el('p', { text: 'Tvoje mince byly zašifrovány! Pro odemčení zaplať 1 000 000 mincí. (Žádné tvoje soubory se doopravdy nezměnily — je to jen naoko.)' }),
      el('div.nk-zamek-akce', {},
        el('button.btn.primary', { text: 'Odemknout plochu', onclick: () => { toast({ title: 'Platba selhala', body: 'Nemáš milion mincí (a ani bys neplatil). Odemkne to Astro Defender.', icon: 'diamant' }); } }),
        el('button.btn', { text: 'Otevřít Astro Defender', onclick: () => { skryjZamek(); openApp('defender'); } }),
        el('button.btn', { text: 'Správce úloh', onclick: () => { skryjZamek(); openApp('monitor'); } })),
      el('button.nk-zamek-x', { text: 'Skrýt na chvíli ×', onclick: skryjZamek })));
  document.body.append(zamekEl);
}
function skryjZamek() {
  if (!zamekEl) return;
  zamekEl.remove(); zamekEl = null;
  clearTimeout(zamekSkryt);
  zamekSkryt = setTimeout(() => { if (aktivni().length >= 3) ukazZamek(); }, 30000);
}
function schovejZamekUplne() { clearTimeout(zamekSkryt); if (zamekEl) { zamekEl.remove(); zamekEl = null; } }

// ================================================================ okno falešného antiviru
const PRISERY = ['Honza.exe', 'Ponožka.trojan', 'Domácí_úkol.worm', 'Pondělí.virus', 'Brokolice.dll', 'Tchyně.scr', 'Wi-Fi_souseda.bat', 'Zapomenutá_svačina.exe'];
const FALESNY_AV = {
  id: 'nk-antivir', name: 'SuperAntivir ZDARMA', icon: 'shieldX', color: 'linear-gradient(145deg,#ef6a5a,#8e2a20)',
  width: 460, height: 430,
  mount(body) {
    const seznam = el('div.nk-av-seznam', {}, ...PRISERY.map((p) => el('div', {}, el('span', { text: '⚠' }), el('b', { text: p }), el('i', { text: 'KRITICKÉ' }))));
    const stav = el('p.nk-av-stav', { text: 'A dalších 9 991 hrozeb. Tvůj počítač je ve VELKÉM nebezpečí!' });
    const cist = el('button.btn.primary', { text: 'Vyčistit vše za 0 Kč' });
    const zavri = el('button.btn', { text: 'Zavřít' });
    cist.onclick = () => {
      seznam.replaceChildren(el('div.nk-av-pointa', { text: '🤡' }));
      stav.textContent = 'Ha! Nic jsem nevyčistil. Ty viry jsem si vymyslel. Na opravdové hrozby zkus Astro Defender.';
      cist.remove();
    };
    zavri.onclick = () => body.closest('.win')?.querySelector('.win-ctl .close')?.click();
    body.append(el('div.nk-av', {},
      el('div.nk-av-hlava', {}, el('div', { text: '🛡️' }), el('div', {}, el('h3', { text: 'Nalezeno 9 999 virů!' }), el('span', { text: 'SuperAntivir ZDARMA · kontrola dokončena' }))),
      seznam, stav, el('div.nk-av-akce', {}, cist, zavri)));
  },
};

// ================================================================ tetina fotka (SVG)
const TAPETA_DOVOLENA = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="nkNebe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fa8e8"/><stop offset="1" stop-color="#bfe6fb"/></linearGradient>
  <linearGradient id="nkMore" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f7fbf"/><stop offset="1" stop-color="#3fc0d8"/></linearGradient>
  <linearGradient id="nkPisek" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4dca0"/><stop offset="1" stop-color="#e2bf78"/></linearGradient>
  <radialGradient id="nkPalec" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#f7c3a8"/><stop offset=".7" stop-color="#e59a7e"/><stop offset="1" stop-color="#c9775c"/></radialGradient>
  <filter id="nkRozmaz"><feGaussianBlur stdDeviation="28"/></filter>
</defs>
<rect width="1600" height="900" fill="url(#nkNebe)"/>
<circle cx="1240" cy="170" r="70" fill="#fff6c8"/>
<g fill="#ffffff" opacity=".9"><ellipse cx="420" cy="160" rx="110" ry="30"/><ellipse cx="480" cy="140" rx="70" ry="30"/><ellipse cx="900" cy="230" rx="90" ry="22"/></g>
<rect y="430" width="1600" height="230" fill="url(#nkMore)"/>
<path d="M0 470 Q200 455 400 470 T800 470 T1200 470 T1600 470" stroke="#bfe9f5" stroke-width="5" fill="none" opacity=".7"/>
<path d="M0 640 Q400 600 800 630 T1600 610 V900 H0Z" fill="url(#nkPisek)"/>
<rect x="760" y="700" width="230" height="90" rx="10" fill="#ef6a5a" transform="rotate(-6 875 745)"/>
<rect x="760" y="725" width="230" height="16" fill="#fff" opacity=".8" transform="rotate(-6 875 745)"/>
<g transform="translate(1290 380)"><path d="M20 300 Q0 150 30 0" stroke="#8a5a2b" stroke-width="22" fill="none"/>
<g fill="#2f9e4a"><path d="M30 0 Q-80 -20 -150 50 Q-60 0 30 10Z"/><path d="M30 0 Q120 -50 200 20 Q110 -10 30 12Z"/><path d="M30 0 Q0 -100 -70 -130 Q20 -90 34 -2Z"/><path d="M30 0 Q90 -110 160 -100 Q80 -70 36 2Z"/></g></g>
<text x="1540" y="860" text-anchor="end" font-family="Comic Sans MS, cursive" font-size="44" fill="#ffffff" stroke="#00000055" stroke-width="2">Chorvatsko 2026 ❤️ teta L.</text>
<ellipse cx="80" cy="800" rx="330" ry="420" fill="url(#nkPalec)" filter="url(#nkRozmaz)" opacity=".96"/>
</svg>`;

// ================================================================ řízení: efekty, obnova kopií, úklid
const bezici = new Map();     // id → funkce pro vypnutí efektu
const obnovTimer = new Map(); // id → naplánovaná obnova kopií
let defenderUklidil = false, zmizeli = [], toastCas = 0;

function naplanObnovu(id) {
  if (obnovTimer.has(id)) return;
  const uroven = PODLE_ID[id]?.uroven;
  const prodleva = uroven === 'tezka' ? nahoda(8, 14) : nahoda(42, 62);
  obnovTimer.set(id, setTimeout(() => {
    obnovTimer.delete(id);
    if (!jeNainstalovana(id) || Obrana.nastaveni().rt) return;   // ochrana zapnutá = neobnovovat
    const s = stav(id);
    const persist = s.zakotven || (s.uroven === 'stredni' && s.skEx);
    if (!persist) return;
    const vir = PODLE_ID[id].vir;
    let obnoveno = false;
    if (!s.hlEx) { try { nastavCestu('oaVirSoubory', id, napis(STAZENE, vir.soubor, vir.obsah)); obnoveno = true; } catch { /* plný disk */ } }
    if ((s.uroven === 'tezka') && !s.skEx) { try { nastavCestu('oaVirSkryte', id, napis(SKRYTA, vir.soubor, vir.obsah)); } catch { /* plný disk */ } }
    if (obnoveno) {
      toast({ title: 'Hrozba se znovu objevila', body: `${PODLE_ID[id].name}: ${s.uroven === 'tezka' ? 'použij kontrolu offline s restartem.' : 'spusť úplnou kontrolu.'}`, icon: 'shieldX' });
      prepocitej();
    }
  }, prodleva * 1000));
}

function prepocitej() {
  const ted = new Set(aktivni());

  // zapni/vypni efekty podle toho, co má hlavní soubor
  for (const [id, stop] of bezici) if (!ted.has(id)) { try { stop(); } catch { /* nic */ } bezici.delete(id); }
  for (const id of ted) if (!bezici.has(id) && NAKAZY[id]) bezici.set(id, NAKAZY[id]());

  // obnova kopií / úklid odstraněných
  let uklizeno = 0;
  for (const id of instalovaneVir()) {
    if (!cesta('oaVirSoubory', id)) continue;   // nakazit ještě neproběhl (appka se právě instaluje)
    const s = stav(id);
    const persist = s.zakotven || (s.uroven === 'stredni' && s.skEx);
    if (persist && !Obrana.nastaveni().rt && (!s.hlEx || (s.uroven === 'tezka' && !s.skEx))) naplanObnovu(id);
    if (!persist && !s.hlEx && !s.skEx) {
      zrusVsechnySoubory(id);
      odinstalujAplikaci(id);
      zmizeli.push(PODLE_ID[id]?.name || id);
      uklizeno++;
    }
  }
  if (uklizeno) {
    clearTimeout(toastCas);
    const byloDef = defenderUklidil;
    toastCas = setTimeout(() => {
      toast({
        title: zmizeli.length > 1 ? `Odebráno aplikací: ${zmizeli.length}` : 'Aplikace odebrána',
        body: `Astro Defender odstranil ${zmizeli.join(', ')} a vrátil, co ${zmizeli.length > 1 ? 'napáchaly' : 'napáchala'}.`,
        icon: 'shield',
      });
      zmizeli = [];
    }, 250);
    if (byloDef) toast({ title: 'Systém obnoven', body: 'Astro Defender vrátil změny po podezřelých aplikacích.', icon: 'shield', silent: true });
    defenderUklidil = false;
  }

  // uzamčená plocha při více nákazách naráz
  if (ted.size >= 3) ukazZamek(); else schovejZamekUplne();

  bus.emit('obrana');   // štít a Defender ukážou „Aktivní infekce“
}

let casovac = 0;
const pozdeji = () => { clearTimeout(casovac); casovac = setTimeout(prepocitej, 300); };

let spusteno = false;
export function spust() {
  if (spusteno) return;
  spusteno = true;
  bus.on('aplikace', pozdeji);
  bus.on('fs:change', (c) => { if (!interni) pozdeji(); });
  bus.on('obrana:odebrano', ({ cesta: c, offline } = {}) => {
    defenderUklidil = true;
    // kontrola offline sejme „kotvu“ těžké nákazy → přestane se obnovovat a uklidí se
    if (offline && c) {
      const id = instalovaneVir().find((x) => cesta('oaVirSoubory', x) === c || cesta('oaVirSkryte', x) === c);
      if (id) State.set('nkZakotveno', (State.get('nkZakotveno') || []).filter((x) => x !== id));
    }
    pozdeji();
  });
  prepocitej();
}
