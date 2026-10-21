// AstroPísmo — rozbalovací nabídky, dialogy a paleta barev ve stylu Office

import { el } from '../util.js';
import { ik } from './ikony.js';

// ---------------------------------------------------------------- rozbalovací panel
let otevreny = null;

export function zavriRozbal() {
  if (!otevreny) return;
  const o = otevreny;
  otevreny = null;
  o.uzel.remove();
  o.kotva?.classList.remove('ps-otevreno');
  o.pryc();
  o.poZavreni?.();
}

export const jeRozbaleno = (kotva) => otevreny?.kotva === kotva;

/** Ukáže panel pod kotvou (position: fixed v body — okna mají backdrop-filter, uvnitř by fixed nefungovalo). */
export function rozbal(kotva, obsah, { zarovnat = 'vlevo', tema = null, poZavreni = null, nad = false, app = null } = {}) {
  if (jeRozbaleno(kotva)) { zavriRozbal(); return null; }
  zavriRozbal();
  const koren = kotva.closest('.ps');
  const motiv = tema || koren?.dataset.motiv || kotva.closest('.win')?.dataset.psMotiv || 'barevny';
  const uzel = el('div.ps-rozbal', { 'data-motiv': motiv, 'data-app': app || koren?.dataset.app || kotva.closest('.win')?.dataset.psApp || null }, obsah);
  document.body.append(uzel);
  const r = kotva.getBoundingClientRect();
  const u = uzel.getBoundingClientRect();
  let x = zarovnat === 'vpravo' ? r.right - u.width : r.left;
  let y = nad ? r.top - u.height - 2 : r.bottom + 2;
  x = Math.max(6, Math.min(x, innerWidth - u.width - 6));
  if (y + u.height > innerHeight - 6) y = Math.max(6, r.top - u.height - 2);
  uzel.style.left = x + 'px';
  uzel.style.top = y + 'px';
  kotva.classList.add('ps-otevreno');

  const venku = (e) => { if (!uzel.contains(e.target) && !kotva.contains(e.target)) zavriRozbal(); };
  const klavesa = (e) => { if (e.key === 'Escape') { e.stopPropagation(); zavriRozbal(); } };
  setTimeout(() => {
    addEventListener('pointerdown', venku, true);
    addEventListener('keydown', klavesa, true);
  });
  otevreny = {
    uzel, kotva, poZavreni,
    pryc: () => { removeEventListener('pointerdown', venku, true); removeEventListener('keydown', klavesa, true); },
  };
  // klik do nabídky nesmí vzít fokus editoru (jinak zmizí výběr textu)
  uzel.addEventListener('mousedown', (e) => { if (!e.target.closest('input, select, textarea')) e.preventDefault(); });
  return uzel;
}

/** Seznam položek jako v nabídkách Office. polozky: [{ text, ikona, klavesa, akce, zaskrtnuto, zakazano, styl }] | 'sep' | { nadpis } */
export function nabidka(polozky, { sirka } = {}) {
  return el('div.ps-nabidka', { style: sirka ? { width: sirka + 'px' } : null },
    polozky.map((p) => {
      if (p === 'sep') return el('div.ps-nab-sep');
      if (p.nadpis) return el('div.ps-nab-nadpis', { text: p.nadpis });
      if (p.uzel) return p.uzel;
      return el('button.ps-nab-polozka' + (p.zaskrtnuto ? '.zaskrtnuto' : '') + (p.zakazano ? '.zakazano' : ''), {
        type: 'button',
        onclick: () => { if (p.zakazano) return; zavriRozbal(); p.akce?.(); },
      },
      el('span.ps-nab-ik', {}, p.ikona ? ik(p.ikona) : (p.zaskrtnuto ? '✓' : '')),
      el('span.ps-nab-text', { text: p.text, style: p.styl || null }),
      p.klavesa ? el('span.ps-nab-klavesa', { text: p.klavesa }) : null);
    }));
}

// ---------------------------------------------------------------- barvy
export const MOTIV_BARVY = ['#FFFFFF', '#000000', '#E8E8E8', '#0E2841', '#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E'];
export const STANDARDNI = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];
export const ZVYRAZNENI = [
  ['#FFFF00', 'Žlutá'], ['#00FF00', 'Jasně zelená'], ['#00FFFF', 'Tyrkysová'], ['#FF00FF', 'Růžová'], ['#0000FF', 'Modrá'],
  ['#FF0000', 'Červená'], ['#000080', 'Tmavě modrá'], ['#008080', 'Šedozelená'], ['#008000', 'Zelená'], ['#800080', 'Fialová'],
  ['#800000', 'Tmavě červená'], ['#808000', 'Tmavě žlutá'], ['#808080', 'Šedá 50 %'], ['#C0C0C0', 'Šedá 25 %'], ['#000000', 'Černá'],
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const naHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const svetlejsi = (h, k) => naHex(hex(h).map((v) => v + (255 - v) * k));
const tmavsi = (h, k) => naHex(hex(h).map((v) => v * (1 - k)));

function odstiny(zaklad, i) {
  if (i === 0) return [zaklad, tmavsi(zaklad, 0.05), tmavsi(zaklad, 0.15), tmavsi(zaklad, 0.25), tmavsi(zaklad, 0.35), tmavsi(zaklad, 0.5)];
  if (i === 1) return [zaklad, svetlejsi(zaklad, 0.5), svetlejsi(zaklad, 0.35), svetlejsi(zaklad, 0.25), svetlejsi(zaklad, 0.15), svetlejsi(zaklad, 0.05)];
  return [zaklad, svetlejsi(zaklad, 0.8), svetlejsi(zaklad, 0.6), svetlejsi(zaklad, 0.4), tmavsi(zaklad, 0.25), tmavsi(zaklad, 0.5)];
}

/** Paleta jako „Barva písma“ ve Wordu. */
export function paleta({ auto = 'Automaticky', autoBarva = '#000000', onVyber, bezBarvy = false }) {
  const vyber = (b) => { zavriRozbal(); onVyber(b); };
  const bunka = (b) => el('button.ps-barva', { type: 'button', title: b, style: { background: b }, onclick: () => vyber(b) });
  const sloupce = MOTIV_BARVY.map((b, i) => odstiny(b, i));
  const vlastni = el('input', { type: 'color', value: '#1F4E79', onchange: (e) => vyber(e.target.value.toUpperCase()) });
  return el('div.ps-paleta', {},
    auto ? el('button.ps-nab-polozka', { type: 'button', onclick: () => vyber(bezBarvy ? null : 'auto') },
      el('span.ps-barva-vzor', { style: { background: bezBarvy ? 'transparent' : autoBarva } }), el('span', { text: auto })) : null,
    el('div.ps-nab-nadpis', { text: 'Barvy motivu' }),
    el('div.ps-paleta-motiv', {},
      el('div.ps-paleta-radek', {}, sloupce.map((s) => bunka(s[0]))),
      el('div.ps-paleta-odstiny', {}, [1, 2, 3, 4, 5].map((r) => el('div.ps-paleta-radek', {}, sloupce.map((s) => bunka(s[r])))))),
    el('div.ps-nab-nadpis', { text: 'Standardní barvy' }),
    el('div.ps-paleta-radek', {}, STANDARDNI.map(bunka)),
    el('div.ps-nab-sep'),
    el('label.ps-nab-polozka.ps-vlastni-barva', {}, el('span.ps-nab-ik', {}, '🎨'), el('span', { text: 'Další barvy…' }), vlastni),
  );
}

export function paletaZvyrazneni(onVyber) {
  const vyber = (b) => { zavriRozbal(); onVyber(b); };
  return el('div.ps-paleta.ps-paleta-zvyr', {},
    el('div.ps-paleta-mrizka5', {}, ZVYRAZNENI.map(([b, n]) =>
      el('button.ps-barva.velka', { type: 'button', title: n, style: { background: b }, onclick: () => vyber(b) }))),
    el('button.ps-nab-polozka', { type: 'button', onclick: () => vyber(null) }, el('span.ps-nab-ik'), el('span', { text: 'Bez barvy' })),
  );
}

// ---------------------------------------------------------------- dialogy
/** Modální dialog uvnitř okna. tlacitka: [{ text, primarni, akce }] — akce vrátí false = nezavírat. */
export function dialog(koren, { titulek, obsah, tlacitka = [{ text: 'OK', primarni: true }], sirka = 420, pri_zavreni, cls = '' }) {
  const kryt = el('div.ps-kryt');
  const zavri = () => { kryt.remove(); pri_zavreni?.(); };
  const tl = tlacitka.map((t) => el('button.ps-tlac' + (t.primarni ? '.primarni' : ''), {
    type: 'button', text: t.text,
    onclick: () => { if (t.akce?.() === false) return; zavri(); },
  }));
  const okno = el('div.ps-dialog' + (cls ? '.' + cls : ''), { style: { width: sirka + 'px' }, role: 'dialog' },
    el('div.ps-dialog-hlava', {},
      el('span', { text: titulek }),
      el('button.ps-dialog-x', { type: 'button', title: 'Zavřít', onclick: zavri }, ik('zavrit'))),
    el('div.ps-dialog-telo', {}, obsah),
    tlacitka.length ? el('div.ps-dialog-pata', {}, tl) : null);
  kryt.append(okno);
  kryt.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') zavri();
    if (e.key === 'Enter' && !e.target.closest('textarea, button')) {
      const p = tlacitka.findIndex((t) => t.primarni);
      if (p >= 0) { e.preventDefault(); tl[p].click(); }
    }
  });
  koren.append(kryt);
  setTimeout(() => (okno.querySelector('input:not([type=checkbox]):not([type=radio]), select, textarea') || tl.find((b) => b.matches('.primarni')) || okno).focus?.(), 30);
  return { zavri, okno };
}

/** Hláška jako MessageBox ve Wordu. */
export function zprava(koren, text, titulek = 'AstroPísmo') {
  return dialog(koren, { titulek, obsah: el('p.ps-zprava', { text }), sirka: 380 });
}

export function pole(popisek, vstup) {
  return el('label.ps-pole', {}, el('span', { text: popisek }), vstup);
}
