// AstroOS — vlastní kurzor myši a stopa za ním
//
// Kurzor je SVG obrázek v CSS `cursor: url(…)`. Aby platil i na tlačítkách, odkazech a dlaždicích,
// projdou se při použití všechna pravidla stylů s `cursor: pointer` / `default` a pro jejich
// selektory se vygeneruje přebití s vlastní šipkou nebo „rukou“. Textový kurzor, změna velikosti,
// zaměřovač v Malování apod. zůstávají systémové — tam je přesnost důležitější než vzhled.
//
// Stopa (jiskry, kometa) je plátno přes celou obrazovku bez zachytávání myši; kreslí se jen,
// když se myš hýbe nebo ještě dohasíná.

import { State } from './state.js';

export const STYLY = [
  ['system', 'Systémový'],
  ['astro', 'Astro'],
  ['tecka', 'Tečka'],
  ['raketa', 'Raketa'],
  ['retro', 'Retro'],
];
export const VELIKOSTI = [['maly', 'Malý', 24], ['stredni', 'Střední', 32], ['velky', 'Velký', 48]];
export const STOPY = [['zadna', 'Žádná'], ['jiskry', 'Jiskry'], ['kometa', 'Kometa']];

const hod = (k, v) => State.get(k) ?? v;
const barva = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#46c36f';

// ---------------------------------------------------------------- tvary (viewBox 32×32)
/** Vrátí { sipka, ruka } jako SVG a bod, kam kurzor „míří“ (v jednotkách viewBoxu). */
function tvary(styl, a) {
  const stin = '<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.2" flood-opacity=".45"/></filter>';
  const sipkaCesta = 'M5 3.5v21.2l5.6-5.3 3.6 8.1 3.7-1.6-3.6-8h7.8z';
  switch (styl) {
    case 'astro': return {
      bod: [5, 3.5],
      sipka: `<defs>${stin}</defs><path d="${sipkaCesta}" fill="${a}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" filter="url(#s)"/>`,
      ruka: `<defs>${stin}</defs><circle cx="5" cy="3.5" r="3.4" fill="none" stroke="${a}" stroke-width="1.4" opacity=".75"/>`
        + `<path d="${sipkaCesta}" fill="#fff" stroke="${a}" stroke-width="1.8" stroke-linejoin="round" filter="url(#s)"/>`,
    };
    case 'tecka': return {
      bod: [16, 16],
      sipka: `<defs>${stin}</defs><circle cx="16" cy="16" r="5" fill="${a}" stroke="#fff" stroke-width="1.6" filter="url(#s)"/>`,
      ruka: `<defs>${stin}</defs><circle cx="16" cy="16" r="11" fill="${a}" fill-opacity=".22" stroke="${a}" stroke-width="1.6"/>`
        + `<circle cx="16" cy="16" r="3" fill="#fff" filter="url(#s)"/>`,
    };
    case 'raketa': {
      // raketka mířící špičkou doleva nahoru, plamínek vzadu
      const telo = `<g transform="rotate(-45 16 16)" filter="url(#s)">`
        + '<path d="M16 2c4 3.5 5.5 8.5 5.5 13.5v6h-11v-6C10.5 10.5 12 5.5 16 2z" fill="#f2f4f8" stroke="#2a2f3a" stroke-width="1.2"/>'
        + `<circle cx="16" cy="12" r="2.6" fill="${a}" stroke="#2a2f3a" stroke-width="1"/>`
        + `<path d="M10.5 16.5 6.5 22v3l4-2.5zM21.5 16.5l4 5.5v3l-4-2.5z" fill="${a}" stroke="#2a2f3a" stroke-width="1"/>`;
      return {
        bod: [4, 4],
        sipka: `<defs>${stin}</defs>${telo}<path d="M13 22.5h6l-3 5z" fill="#ffb43c"/></g>`,
        ruka: `<defs>${stin}</defs>${telo}<path d="M12.5 22.5h7l-3.5 8z" fill="#ff6a3c"/><path d="M14 22.5h4l-2 4.5z" fill="#ffe08a"/></g>`,
      };
    }
    case 'retro': {
      // černobílá pixelová šipka jako ve starých Windows
      const px = [
        'B', 'BB', 'BWB', 'BWWB', 'BWWWB', 'BWWWWB', 'BWWWWWB', 'BWWWWWWB', 'BWWWWWWWB', 'BWWWWWWWWB',
        'BWWWWWBBBBB', 'BWWBWWB', 'BWB BWWB', 'BB  BWWB', 'B    BWWB', '     BWWB', '      BB',
      ];
      const kresli = (vzor, posun = 0) => vzor.map((radek, y) => [...radek].map((c, x) => (c === ' ' ? ''
        : `<rect x="${x * 1.6 + 3 + posun}" y="${y * 1.6 + 2}" width="1.6" height="1.6" fill="${c === 'B' ? '#000' : '#fff'}"/>`)).join('')).join('');
      return {
        bod: [3, 2],
        sipka: `<g shape-rendering="crispEdges">${kresli(px)}</g>`,
        ruka: `<g shape-rendering="crispEdges">${kresli(px)}<rect x="20" y="22" width="9" height="7" fill="${a}" stroke="#000" stroke-width="1"/></g>`,
      };
    }
    default: return null;
  }
}

const naUrl = (svg, px) => `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 32 32">${svg}</svg>`)}")`;

// ---------------------------------------------------------------- použití
let stylEl = null;

/** Selektory, které mají v načtených stylech daný kurzor (bez pseudo-elementů). */
function selektoryS(hodnoty) {
  const out = [];
  const projdi = (pravidla) => {
    for (const p of pravidla) {
      if (p.cssRules && !p.selectorText) { try { projdi(p.cssRules); } catch { /* cizí styl */ } continue; }
      const c = p.style?.cursor;
      if (!c || !hodnoty.includes(c) || !p.selectorText) continue;
      for (const s of p.selectorText.split(',')) {
        const t = s.trim();
        if (t && !t.includes('::') && !t.includes(':-')) out.push(t);
      }
    }
  };
  for (const list of document.styleSheets) {
    if (list.ownerNode === stylEl) continue;
    try { projdi(list.cssRules); } catch { /* list z jiného původu */ }
  }
  return [...new Set(out)];
}

export function applyKurzor() {
  const styl = hod('kurzor', 'system');
  const px = (VELIKOSTI.find((v) => v[0] === hod('kurzorVelikost', 'stredni')) || VELIKOSTI[1])[2];
  const t = tvary(styl, barva());
  if (!stylEl) {
    stylEl = document.createElement('style');
    stylEl.id = 'astro-kurzor';
    document.head.append(stylEl);
  }
  document.documentElement.toggleAttribute('data-kurzor', !!t);
  if (!t) { stylEl.textContent = ''; } else {
    const k = px / 32;
    const [x, y] = t.bod.map((v) => Math.round(v * k));
    const sipka = `${naUrl(t.sipka, px)} ${x} ${y}, default`;
    const ruka = `${naUrl(t.ruka, px)} ${x} ${y}, pointer`;
    const obal = (sel) => sel.map((s) => `html[data-kurzor] :is(${s})`).join(',\n');
    const ukazovatka = ['button', 'a[href]', 'summary', 'select', 'label', '[role="button"]', '.switch', 'input[type=checkbox]',
      'input[type=radio]', 'input[type=range]', 'input[type=color]', ...selektoryS(['pointer'])];
    stylEl.textContent = `html[data-kurzor], html[data-kurzor] body { cursor: ${sipka}; }\n`
      + `${obal(selektoryS(['default', 'auto']))} { cursor: ${sipka}; }\n`
      + `${obal(ukazovatka)} { cursor: ${ruka}; }\n`
      + 'html[data-kurzor] :is(button, a)[disabled] { cursor: not-allowed; }\n';
  }
  nastavStopu(hod('kurzorStopa', 'zadna'));
}

// ---------------------------------------------------------------- stopa
let platno = null, g = null, castice = [], beh = false, druh = 'zadna', posledni = null;

function nastavStopu(novy) {
  druh = novy;
  if (druh === 'zadna') {
    window.removeEventListener('pointermove', pohyb);
    platno?.remove();
    platno = null;
    castice = [];
    return;
  }
  if (!platno) {
    platno = document.createElement('canvas');
    platno.id = 'astro-stopa';
    Object.assign(platno.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483646' });
    document.body.append(platno);
    g = platno.getContext('2d');
    velikost();
    window.addEventListener('resize', velikost);
    window.addEventListener('pointermove', pohyb, { passive: true });
  }
}

function velikost() {
  if (!platno) return;
  const d = devicePixelRatio || 1;
  platno.width = innerWidth * d;
  platno.height = innerHeight * d;
  g.setTransform(d, 0, 0, d, 0, 0);
}

function pohyb(e) {
  if (e.pointerType === 'touch') return;
  const omezene = document.documentElement.getAttribute('data-animace') === 'min';
  const a = barva();
  if (druh === 'jiskry') {
    const n = omezene ? 1 : 2;
    for (let i = 0; i < n; i++) {
      castice.push({
        x: e.clientX, y: e.clientY,
        vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.6 + 0.4,
        zivot: 1, r: 1.2 + Math.random() * 2.2,
        barva: Math.random() < 0.45 ? '#ffffff' : a,
      });
    }
  } else if (druh === 'kometa') {
    if (posledni) castice.push({ x1: posledni.x, y1: posledni.y, x2: e.clientX, y2: e.clientY, zivot: 1, barva: a });
    posledni = { x: e.clientX, y: e.clientY };
  }
  if (castice.length > 400) castice.splice(0, castice.length - 400);
  if (!beh) { beh = true; requestAnimationFrame(snimek); }
}

function snimek() {
  if (!platno) { beh = false; return; }
  g.clearRect(0, 0, innerWidth, innerHeight);
  const ubytek = druh === 'kometa' ? 0.06 : 0.03;
  for (const c of castice) {
    c.zivot -= ubytek;
    if (c.zivot <= 0) continue;
    g.globalAlpha = Math.max(0, c.zivot);
    if (druh === 'jiskry') {
      c.x += c.vx; c.y += c.vy; c.vy += 0.03;
      g.fillStyle = c.barva;
      g.beginPath();
      // čtyřcípá hvězdička
      const r = c.r * (0.6 + c.zivot * 0.6);
      g.moveTo(c.x, c.y - r * 2); g.lineTo(c.x + r * 0.5, c.y - r * 0.5); g.lineTo(c.x + r * 2, c.y);
      g.lineTo(c.x + r * 0.5, c.y + r * 0.5); g.lineTo(c.x, c.y + r * 2); g.lineTo(c.x - r * 0.5, c.y + r * 0.5);
      g.lineTo(c.x - r * 2, c.y); g.lineTo(c.x - r * 0.5, c.y - r * 0.5);
      g.fill();
    } else {
      g.strokeStyle = c.barva;
      g.lineCap = 'round';
      g.lineWidth = 1 + c.zivot * 5;
      g.beginPath(); g.moveTo(c.x1, c.y1); g.lineTo(c.x2, c.y2); g.stroke();
    }
  }
  g.globalAlpha = 1;
  castice = castice.filter((c) => c.zivot > 0);
  if (castice.length) requestAnimationFrame(snimek);
  else { beh = false; posledni = null; g.clearRect(0, 0, innerWidth, innerHeight); }
}

/** Náhled kurzoru pro Nastavení (obrázek šipky v dané barvě). */
export function nahled(styl, ruka = false) {
  const t = tvary(styl, barva());
  if (!t) return null;
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${ruka ? t.ruka : t.sipka}</svg>`)}`;
}
