// AstroOS — tapety (CSS gradient + rozmazané skvrny + volitelná silueta krajiny)

import { $, el } from './util.js';
import { State } from './state.js';
import { klic } from './profil.js';
import { toast } from './ui.js';

const hory = (barvy) => `
  <svg class="scenery" viewBox="0 0 1600 900" preserveAspectRatio="none">
    <path d="M0 640 L240 430 L400 540 L620 360 L860 590 L1040 470 L1290 660 L1600 500 L1600 900 L0 900Z"
          fill="${barvy[0]}" opacity="0.55"/>
    <path d="M0 720 L300 560 L520 680 L760 520 L980 700 L1240 580 L1600 740 L1600 900 L0 900Z"
          fill="${barvy[1]}" opacity="0.75"/>
    <path d="M0 810 L360 700 L700 800 L1020 690 L1340 790 L1600 720 L1600 900 L0 900Z"
          fill="${barvy[2]}"/>
  </svg>`;

const hvezdy = (() => {
  let s = '';
  // deterministický „náhodný“ rozptyl, ať tapeta vypadá při každém spuštění stejně
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 90; i++) {
    const x = (rnd() * 1600).toFixed(0), y = (rnd() * 520).toFixed(0);
    const r = (rnd() * 1.5 + 0.5).toFixed(2), o = (rnd() * 0.65 + 0.2).toFixed(2);
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
  }
  return `<svg class="scenery" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMin slice">${s}</svg>`;
})();

// Obrázkové tapety jsou autorské (kolekce AstroMeo Abstract) — podpis je i přímo v obrázku.
const AUTOR = 'AstroMeo';
export const KOLEKCE = 'AstroMeo Abstract';

export const WALLPAPERS = {
  vlny: {
    name: 'Vlny',
    image: 'img/vlny.webp',
    autor: AUTOR,
    base: 'linear-gradient(160deg, #0a1636 0%, #16307a 50%, #060b1c 100%)',
    blobs: [],
    scenery: '',
  },
  oblouky: {
    name: 'Oblouky',
    image: 'img/oblouky.webp',
    autor: AUTOR,
    base: 'linear-gradient(160deg, #4a6a8c 0%, #a9c0d0 55%, #7896b4 100%)',
    blobs: [],
    scenery: '',
  },
  hedvabi: {
    name: 'Temné hedvábí',
    image: 'img/hedvabi.webp',
    autor: AUTOR,
    base: 'linear-gradient(160deg, #05070a 0%, #10151c 55%, #05070a 100%)',
    blobs: [],
    scenery: '',
  },
  mesic: {
    name: 'Měsíc nad vodou',
    image: 'img/mesic.webp',
    autor: AUTOR,
    base: 'linear-gradient(180deg, #05080f 0%, #0d1622 60%, #050910 100%)',
    blobs: [],
    scenery: '',
  },
  krivky: {
    name: 'Světelné křivky',
    image: 'img/krivky.webp',
    autor: AUTOR,
    base: 'linear-gradient(160deg, #06080b 0%, #12161b 55%, #06080b 100%)',
    blobs: [],
    scenery: '',
  },
  aurora: {
    name: 'Polární záře',
    base: 'linear-gradient(175deg, #06121a 0%, #0a1f22 42%, #0c2a24 72%, #061014 100%)',
    blobs: [
      { c: '#2fbf7a', x: '8%', y: '12%', w: '46vw', h: '36vh', o: 0.5 },
      { c: '#1f7fb5', x: '52%', y: '-6%', w: '52vw', h: '40vh', o: 0.42 },
      { c: '#6be0a8', x: '26%', y: '30%', w: '38vw', h: '26vh', o: 0.26 },
    ],
    scenery: hvezdy + hory(['#0a2a2b', '#08201f', '#051314']),
  },
  soumrak: {
    name: 'Soumrak',
    base: 'linear-gradient(180deg, #1b1033 0%, #46215a 38%, #a3456a 66%, #e08a55 88%, #f0b877 100%)',
    blobs: [
      { c: '#ff9b5c', x: '58%', y: '48%', w: '40vw', h: '30vh', o: 0.5 },
      { c: '#7b3f9e', x: '4%', y: '6%', w: '46vw', h: '34vh', o: 0.4 },
    ],
    scenery: hory(['#5a2c55', '#3a1c3e', '#20102a']),
  },
  mint: {
    name: 'Máta',
    base: 'linear-gradient(160deg, #0d2318 0%, #16402a 45%, #1f5c3a 75%, #0b1a12 100%)',
    blobs: [
      { c: '#54d98a', x: '62%', y: '8%', w: '44vw', h: '36vh', o: 0.4 },
      { c: '#2a8f5c', x: '-4%', y: '40%', w: '48vw', h: '38vh', o: 0.46 },
    ],
    scenery: hory(['#1b4d33', '#123423', '#0a1d14']),
  },
  hlubina: {
    name: 'Hlubina',
    base: 'linear-gradient(200deg, #050b14 0%, #0b1b2e 45%, #123048 78%, #04080e 100%)',
    blobs: [
      { c: '#2b6fc4', x: '18%', y: '-4%', w: '52vw', h: '40vh', o: 0.45 },
      { c: '#18c4c4', x: '58%', y: '44%', w: '40vw', h: '32vh', o: 0.3 },
    ],
    scenery: hvezdy,
  },
  uhel: {
    name: 'Uhel',
    base: 'linear-gradient(150deg, #0e1113 0%, #191e22 50%, #0a0d0f 100%)',
    blobs: [
      { c: '#3a4550', x: '30%', y: '18%', w: '52vw', h: '40vh', o: 0.5 },
      { c: '#46c36f', x: '70%', y: '62%', w: '30vw', h: '24vh', o: 0.12 },
    ],
    scenery: '',
  },
};

// ---------------------------------------------------------------- tapeta z počítače
// Fotka z disku počítače bývá několik MB, a localStorage má jen ~5 MB na celý systém. Proto je
// obrázek v IndexedDB a nastavení si pamatuje jen značku TAPETA_PC. Při startu se načte na pozadí.
export const TAPETA_PC = 'idb:pc';
const MAX_STRANA = 3840;           // větší fotky se zmenší (4K stačí na každý monitor)
let pcUrl = null;

function idb(rezim, fn) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('astroos-tapety', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('obrazky');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('obrazky', rezim);
      const q = fn(tx.objectStore('obrazky'));
      tx.oncomplete = () => { r.result.close(); res(q.result); };
      tx.onerror = () => { r.result.close(); rej(tx.error); };
    };
  });
}

/** Velkou fotku zmenší na MAX_STRANA; menší (i animovaný GIF) nechá, jak je. */
async function priprav(soubor) {
  let bmp;
  try { bmp = await createImageBitmap(soubor); } catch { throw new Error('Tenhle formát obrázku prohlížeč neumí otevřít. Zkus JPG, PNG nebo WebP.'); }
  const k = MAX_STRANA / Math.max(bmp.width, bmp.height);
  if (k >= 1) { bmp.close(); return soubor; }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
}

/** Nastaví obrázek z počítače jako tapetu (plocha i zamykací obrazovka). */
export async function tapetaZPocitace(soubor) {
  if (!soubor.type.startsWith('image/')) throw new Error('Tohle není obrázek.');
  const blob = await priprav(soubor);
  await idb('readwrite', (s) => s.put(blob, klic('pc')));
  if (pcUrl) URL.revokeObjectURL(pcUrl);
  pcUrl = URL.createObjectURL(blob);
  State.patch({ customWallpaper: TAPETA_PC, customWallpaperName: soubor.name, wallpaper: 'vlastni' });
  applyWallpaper('vlastni');
}

/** Otevře výběr souboru počítače a vybraný obrázek nastaví jako tapetu. */
export function vyberTapetuZPocitace(hotovo) {
  const vstup = el('input', { type: 'file', accept: 'image/*' });
  vstup.onchange = async () => {
    const f = vstup.files[0];
    if (!f) return;
    try {
      await tapetaZPocitace(f);
      toast({ title: 'Tapeta nastavena', body: f.name, icon: 'image' });
      hotovo?.();
    } catch (e) {
      toast({ title: 'Tapetu nejde nastavit', body: e.message, icon: 'info' });
    }
  };
  vstup.click();
}

// po startu dotáhnout uloženou fotku z IndexedDB
if (State.get('customWallpaper') === TAPETA_PC) {
  idb('readonly', (s) => s.get(klic('pc'))).then((blob) => {
    if (!blob) return;
    pcUrl = URL.createObjectURL(blob);
    if (State.get('wallpaper') === 'vlastni') applyWallpaper('vlastni');
  }).catch(() => { /* bez IndexedDB zůstane tmavé pozadí */ });
}

/** Tapeta podle id; „vlastní“ je obrázek z Fotek, Malování nebo z počítače. */
export function wallpaperEntry(id) {
  if (id !== 'vlastni') return WALLPAPERS[id] || WALLPAPERS.aurora;
  let img = State.get('customWallpaper');
  if (!img) return WALLPAPERS.vlny;
  if (img === TAPETA_PC) img = pcUrl;   // dokud se nenačte, je vidět jen tmavý přechod
  return {
    name: State.get('customWallpaperName') || 'Vlastní',
    image: img, base: 'linear-gradient(160deg,#10171b,#05070a)', blobs: [], scenery: '',
  };
}

/** Všechny tapety pro galerii — včetně vlastní, pokud je nastavená. */
export function wallpaperList() {
  const out = { ...WALLPAPERS };
  if (State.get('customWallpaper')) out.vlastni = wallpaperEntry('vlastni');
  return out;
}

export function applyWallpaper(id = State.get('wallpaper')) {
  const w = wallpaperEntry(id);
  const root = $('#wallpaper');
  root.innerHTML = '';
  root.style.background = w.base;
  if (w.image) {
    root.append(el('div', {
      style: {
        position: 'absolute', inset: '0',
        background: `url("${w.image}") center / cover no-repeat`,
      },
    }));
  }
  for (const b of w.blobs) {
    root.append(el('div.blob', {
      style: {
        background: b.c, left: b.x, top: b.y, width: b.w, height: b.h,
        opacity: String(b.o), animationDelay: `-${Math.random() * 12}s`,
      },
    }));
  }
  if (w.scenery) root.insertAdjacentHTML('beforeend', w.scenery);
  // jemná vinětace navrch
  root.append(el('div', {
    style: {
      position: 'absolute', inset: '0',
      background: 'radial-gradient(120% 100% at 50% 40%, transparent 40%, rgba(0,0,0,0.42) 100%)',
    },
  }));
}
