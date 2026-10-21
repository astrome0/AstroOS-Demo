// AstroOS — widgety na ploše
//
// Každý widget je jedna věc: hodiny nebo počasí. Chytnout a táhnout = přesun, pravý dolní
// roh = změna velikosti, pravé tlačítko = velikost / přidat / odebrat, dvojklik = otevřít
// příslušnou aplikaci.
// Rozložení drží nastavení `widgety`. Widget u pravého okraje se k němu drží i po změně
// velikosti okna prohlížeče (kotva 'r').

import { $, el, clamp, pad, cz, drag } from './util.js';
import { icon } from './icons.js';
import { State } from './state.js';
import { contextMenu } from './ui.js';

const MRIZKA = 8;
const VYCHOZI = [
  { typ: 'hodiny', kotva: 'r', x: 20, y: 20, w: 240, h: 120 },
  { typ: 'pocasi', kotva: 'r', x: 20, y: 156, w: 240, h: 120 },
];

const otevri = (id, opts) => import('./apps.js').then(({ openApp }) => openApp(id, opts));

const TYPY = {
  hodiny: {
    nazev: 'Hodiny', ikona: 'clock', min: [160, 100],
    vytvor(telo, hlavaHodnota) {
      const cas = el('div.wg-cas');
      const datum = el('div.wg-datum');
      telo.append(cas, datum);
      const tik = () => {
        const d = new Date();
        const sekundy = telo.clientWidth > 250;
        cas.textContent = `${d.getHours()}:${pad(d.getMinutes())}${sekundy ? ':' + pad(d.getSeconds()) : ''}`;
        datum.textContent = cz.datumDlouhy(d);
        hlavaHodnota.textContent = '';
      };
      tik();
      const t = setInterval(tik, 1000);
      return { prekresli: tik, uklid: () => clearInterval(t) };
    },
  },
  pocasi: {
    nazev: 'Počasí', ikona: 'weather', min: [170, 100], dvojklik: () => otevri('weather'),
    vytvor(telo, hlavaHodnota) {
      const ikona = el('div.wg-pocasi-ic');
      const teplota = el('div.wg-pocasi-t');
      const popis = el('div.wg-datum');
      telo.append(el('div.wg-pocasi', {}, ikona, teplota), popis);
      const vykresli = (z) => {
        if (!z) { popis.textContent = 'Načítám…'; return; }
        ikona.textContent = z.ikona || '';
        teplota.textContent = z.teplota != null ? `${z.teplota}°` : '';
        popis.textContent = z.popis ? `${z.popis}` : z.text;
        hlavaHodnota.textContent = z.misto || '';
      };
      vykresli(State.get('pocasiPosledni'));
      const nacti = () => import('./apps/pocasi.js')
        .then(({ aktualniPocasi }) => aktualniPocasi()).then(vykresli).catch(() => {});
      nacti();
      const t = setInterval(nacti, 15 * 60 * 1000);
      return { uklid: () => clearInterval(t) };
    },
  },
};

// ---------------------------------------------------------------- rozložení
const vrstva = () => $('#widgety');
const zaznamy = () => {
  const z = State.get('widgety');
  const vychozi = () => VYCHOZI.map((w, i) => ({ id: 'w' + i, ...w }));
  if (!Array.isArray(z)) return vychozi();
  const znama = z.filter((r) => TYPY[r.typ]);      // starší uložené typy (už neexistují) se zahodí
  return znama.length || !z.length ? znama : vychozi();
};
const zasnap = (v) => Math.round(v / MRIZKA) * MRIZKA;

let zive = [];      // { zaznam, node, instance, ro }
let navrchu = 1;

function ulozVse() {
  State.set('widgety', zive.map((z) => ({ ...z.zaznam })));
}

/** Poloha widgetu v pixelech vrstvy (kotva vpravo = x od pravého okraje). */
function umisti(z) {
  const W = vrstva().clientWidth, H = vrstva().clientHeight;
  const { zaznam: r, node } = z;
  const w = clamp(r.w, TYPY[r.typ].min[0], Math.max(TYPY[r.typ].min[0], W - 8));
  const h = clamp(r.h, TYPY[r.typ].min[1], Math.max(TYPY[r.typ].min[1], H - 8));
  const left = r.kotva === 'r' ? W - r.x - w : r.x;
  Object.assign(node.style, {
    left: clamp(left, 0, Math.max(0, W - w)) + 'px',
    top: clamp(r.y, 0, Math.max(0, H - h)) + 'px',
    width: w + 'px', height: h + 'px',
  });
}

/** Z aktuální polohy uzlu zpět do záznamu (kotva podle toho, ke kterému okraji má blíž). */
function zapamatujPolohu(z) {
  const W = vrstva().clientWidth;
  const left = parseFloat(z.node.style.left), w = parseFloat(z.node.style.width);
  const vpravo = left + w / 2 > W / 2;
  Object.assign(z.zaznam, {
    kotva: vpravo ? 'r' : 'l',
    x: zasnap(vpravo ? W - left - w : left),
    y: zasnap(parseFloat(z.node.style.top)),
    w: zasnap(w),
    h: zasnap(parseFloat(z.node.style.height)),
  });
}

function vytvorWidget(zaznam) {
  const typ = TYPY[zaznam.typ];
  if (!typ) return null;
  const hodnota = el('span.wg-hodnota');
  const telo = el('div.wg-telo');
  const stavEl = el('div.wg-stav');
  const uchyt = el('div.wg-uchyt', { title: 'Změnit velikost' });
  const node = el('div.wg', { dataset: { typ: zaznam.typ } },
    el('div.wg-hlava', {}, icon(typ.ikona), el('span.wg-nazev', { text: typ.nazev }), hodnota),
    telo, stavEl, uchyt);

  const z = { zaznam, node };
  vrstva().append(node);
  umisti(z);
  z.instance = typ.vytvor(telo, hodnota) || {};

  stavEl.hidden = true;
  z.ro = new ResizeObserver(() => z.instance.prekresli?.());
  z.ro.observe(telo);

  // widget, na který se sáhne, jde navrch (když se po zvětšení překrývají)
  node.addEventListener('pointerdown', () => { node.style.zIndex = String(++navrchu); }, true);

  // ---- přesun ----
  node.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target === uchyt) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const l0 = parseFloat(node.style.left), t0 = parseFloat(node.style.top);
    const W = vrstva().clientWidth, H = vrstva().clientHeight;
    let pohnuto = false;
    drag((ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!pohnuto && Math.hypot(dx, dy) < 4) return;
      pohnuto = true;
      node.classList.add('tazeni');
      node.style.left = clamp(l0 + dx, 0, W - node.offsetWidth) + 'px';
      node.style.top = clamp(t0 + dy, 0, H - node.offsetHeight) + 'px';
    }, () => {
      node.classList.remove('tazeni');
      if (!pohnuto) return;
      node.style.left = clamp(zasnap(parseFloat(node.style.left)), 0, W - node.offsetWidth) + 'px';
      node.style.top = clamp(zasnap(parseFloat(node.style.top)), 0, H - node.offsetHeight) + 'px';
      zapamatujPolohu(z);
      ulozVse();
    });
  });

  // ---- změna velikosti ----
  uchyt.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const w0 = node.offsetWidth, h0 = node.offsetHeight;
    const l = parseFloat(node.style.left), t = parseFloat(node.style.top);
    const W = vrstva().clientWidth, H = vrstva().clientHeight;
    const [minW, minH] = typ.min;
    node.classList.add('tazeni');
    drag((ev) => {
      node.style.width = clamp(w0 + ev.clientX - sx, minW, W - l) + 'px';
      node.style.height = clamp(h0 + ev.clientY - sy, minH, H - t) + 'px';
    }, () => {
      node.classList.remove('tazeni');
      node.style.width = clamp(zasnap(node.offsetWidth), minW, W - l) + 'px';
      node.style.height = clamp(zasnap(node.offsetHeight), minH, H - t) + 'px';
      zapamatujPolohu(z);
      ulozVse();
    });
  });

  node.addEventListener('dblclick', () => typ.dvojklik?.());
  node.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const velikost = (k) => {
      const [minW, minH] = typ.min;
      z.zaznam.w = zasnap(minW * k);
      z.zaznam.h = zasnap(minH * k);
      umisti(z);
      zapamatujPolohu(z);
      ulozVse();
    };
    contextMenu([
      { icon: 'minus', label: 'Malý', onClick: () => velikost(1) },
      { icon: 'square', label: 'Střední', onClick: () => velikost(1.5) },
      { icon: 'restore', label: 'Velký', onClick: () => velikost(2.2) },
      'sep',
      { icon: 'plus', label: 'Přidat widget…', onClick: () => nabidkaWidgetu({ x: e.clientX, y: e.clientY }) },
      'sep',
      { icon: 'x', label: 'Odebrat widget', danger: true, onClick: () => odeber(z) },
    ], { x: e.clientX, y: e.clientY });
  });

  zive.push(z);
  return z;
}

function znic(z) {
  z.instance?.uklid?.();
  z.ro?.disconnect();
  z.node.remove();
}

function odeber(z) {
  znic(z);
  zive = zive.filter((x) => x !== z);
  ulozVse();
}

/**
 * Najde volné místo: od pravého okraje po sloupcích, v každém shora dolů.
 * Obdélníky ostatních widgetů se berou z jejich skutečné polohy na ploše.
 */
function volneMisto(w, h) {
  const W = vrstva().clientWidth, H = vrstva().clientHeight;
  const MEZERA = 12, OKRAJ = 20;
  const obsazeno = zive.map(({ node }) => ({
    l: node.offsetLeft - MEZERA, t: node.offsetTop - MEZERA,
    r: node.offsetLeft + node.offsetWidth + MEZERA, b: node.offsetTop + node.offsetHeight + MEZERA,
  }));
  const volno = (l, t) => obsazeno.every((o) => l >= o.r || l + w <= o.l || t >= o.b || t + h <= o.t);
  for (let l = W - OKRAJ - w; l >= 0; l -= MRIZKA * 3) {
    for (let t = OKRAJ; t + h <= H - MRIZKA; t += MRIZKA) {
      if (volno(l, t)) return { l, t };
    }
  }
  return { l: Math.max(0, W - OKRAJ - w), t: OKRAJ };          // plocha je plná — navrch doprava nahoru
}

/** Přidá widget do prvního volného místa (od pravého horního rohu). */
export function pridejWidget(typ) {
  const t = TYPY[typ];
  if (!t) return;
  const [w, h] = [zasnap(t.min[0] * 1.5), zasnap(t.min[1] * 1.4)];
  const { l, t: y } = volneMisto(w, h);
  const W = vrstva().clientWidth;
  const vpravo = l + w / 2 > W / 2;
  const zaznam = {
    id: 'w' + Date.now().toString(36), typ, kotva: vpravo ? 'r' : 'l',
    x: vpravo ? W - l - w : l, y, w, h,
  };
  vytvorWidget(zaznam);
  ulozVse();
}

/** Nabídka typů widgetů — z plochy i z widgetu. */
export function nabidkaWidgetu(at) {
  const mam = new Set(zive.map((z) => z.zaznam.typ));
  contextMenu([
    ...['hodiny', 'pocasi'].map((t) => ({
      icon: TYPY[t].ikona, label: TYPY[t].nazev + (mam.has(t) ? '  ✓' : ''), onClick: () => pridejWidget(t),
    })),
    'sep',
    { icon: 'trash', label: 'Odebrat všechny widgety', danger: true, disabled: !zive.length, onClick: odeberVse },
  ], at);
}

function odeberVse() {
  zive.forEach(znic);
  zive = [];
  ulozVse();
}

// ---------------------------------------------------------------- start a konec
/** Postaví widgety podle nastavení (volá se při vstupu na plochu i při přestavbě plochy). */
export function initWidgety() {
  zastavWidgety();
  if (!vrstva()) return;
  for (const r of zaznamy()) vytvorWidget({ ...r });
  if (!Array.isArray(State.get('widgety'))) ulozVse();   // první spuštění: uložit výchozí rozložení
}

/** Zamčení / odhlášení — widgety pryč. */
export function zastavWidgety() {
  zive.forEach(znic);
  zive = [];
}

addEventListener('resize', () => zive.forEach(umisti));
