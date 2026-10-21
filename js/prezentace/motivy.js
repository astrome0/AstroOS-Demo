// AstroPrezentace — motivy (barvy, písma, dekorace předlohy) a rozvržení snímků
//
// Snímek má pevný rozměr 960 × 540 jednotek (1 jednotka = 1 bod, tj. 13,333 × 7,5 palce jako širokoúhlý
// snímek PowerPointu). Všechny souřadnice a velikosti písma jsou v těchto jednotkách.

export const SIRKA = 960;
export const VYSKA = 540;

export const VELIKOSTI_SNIMKU = [
  { id: 'wide', nazev: 'Širokoúhlá (16 : 9)', w: 960, h: 540, popis: '33,867 cm × 19,05 cm' },
  { id: 'std', nazev: 'Standardní (4 : 3)', w: 720, h: 540, popis: '25,4 cm × 19,05 cm' },
  { id: 'a4', nazev: 'Papír A4 (21 × 29,7 cm)', w: 756, h: 540, popis: '27,517 cm × 19,05 cm' },
  { id: 'kvadrat', nazev: 'Čtverec (1 : 1)', w: 540, h: 540, popis: '19,05 cm × 19,05 cm' },
  { id: 'banner', nazev: 'Banner', w: 960, h: 120, popis: '33,867 cm × 4,233 cm' },
];

// ---------------------------------------------------------------- motivy
const svgPoly = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="none">${body}</svg>`;

/** Každý motiv: barvy (bg = pozadí, tx = text, a = 6 barev zvýraznění), písma, dekor(barvy, uvodni) → SVG vložené pod obsah. */
export const MOTIVY = [
  {
    id: 'office', nazev: 'Motiv Office', pismo: { nadpis: 'Aptos Display', telo: 'Aptos' },
    barvy: { bg: '#FFFFFF', tx: '#000000', bg2: '#E8E8E8', tx2: '#0E2841', a: ['#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E'], odkaz: '#467886' },
    varianty: [
      {},
      { bg: '#0E2841', tx: '#FFFFFF', bg2: '#163E64', tx2: '#E8E8E8' },
      { a: ['#0F9ED5', '#E97132', '#196B24', '#156082', '#A02B93', '#4EA72E'] },
      { bg: '#000000', tx: '#FFFFFF', bg2: '#262626', tx2: '#E8E8E8' },
    ],
    dekor: () => '',
  },
  {
    id: 'facet', nazev: 'Fazeta', pismo: { nadpis: 'Trebuchet MS', telo: 'Trebuchet MS' },
    barvy: { bg: '#FFFFFF', tx: '#262626', bg2: '#E7EDE0', tx2: '#2F3E1F', a: ['#90C226', '#54A021', '#E6B91E', '#E76618', '#C42F1A', '#918655'], odkaz: '#54A021' },
    varianty: [{}, { a: ['#1CADE4', '#2683C6', '#27CED7', '#42BA97', '#3E8853', '#62A39F'] }, { a: ['#EF8C3A', '#D1421E', '#E7B04B', '#9B6C2F', '#A9C23F', '#6FB23A'] }, { bg: '#1F2A14', tx: '#FFFFFF', bg2: '#2E3F1D', tx2: '#E7EDE0' }],
    dekor: (b, uv) => svgPoly(`<path d="M0 0h${uv ? 190 : 120}L0 ${uv ? 330 : 200}z" fill="${b.a[0]}" opacity=".9"/><path d="M0 0h${uv ? 110 : 60}L0 ${uv ? 190 : 110}z" fill="${b.a[1]}"/><path d="M0 540h${uv ? 160 : 80}L0 ${uv ? 330 : 400}z" fill="${b.a[0]}" opacity=".55"/><path d="M0 540h${uv ? 70 : 34}L0 ${uv ? 420 : 470}z" fill="${b.a[1]}" opacity=".9"/>`),
  },
  {
    id: 'integral', nazev: 'Integrál', pismo: { nadpis: 'Tw Cen MT', telo: 'Tw Cen MT' },
    barvy: { bg: '#FFFFFF', tx: '#2B2B2B', bg2: '#E3E9EE', tx2: '#1C4B6C', a: ['#1CADE4', '#2683C6', '#27CED7', '#42BA97', '#3E8853', '#62A39F'], odkaz: '#2683C6' },
    varianty: [{}, { a: ['#B01513', '#EA6312', '#E6B729', '#6AAC90', '#5F9C9D', '#9E5E9B'] }, { a: ['#7FAD3B', '#4D9B47', '#2E8B7C', '#2F6EA1', '#5C57B8', '#9D4F9A'] }, { bg: '#10222E', tx: '#FFFFFF', bg2: '#1B3A50', tx2: '#E3E9EE' }],
    dekor: (b, uv) => svgPoly(uv
      ? `<rect x="0" y="0" width="960" height="540" fill="${b.a[1]}" opacity=".08"/><rect x="0" y="392" width="960" height="12" fill="${b.a[0]}"/><rect x="0" y="404" width="960" height="136" fill="${b.a[1]}"/>`
      : `<rect x="0" y="0" width="960" height="14" fill="${b.a[0]}"/><rect x="0" y="14" width="960" height="5" fill="${b.a[1]}"/>`),
  },
  {
    id: 'ion', nazev: 'Ion', pismo: { nadpis: 'Century Gothic', telo: 'Century Gothic' },
    barvy: { bg: '#1E5155', tx: '#FFFFFF', bg2: '#2A6E73', tx2: '#E8F3F3', a: ['#B01513', '#EA6312', '#E6B729', '#6AAC90', '#54849A', '#9E5E9B'], odkaz: '#E6B729' },
    varianty: [{}, { bg: '#4A2D6E', bg2: '#5C3A85', tx2: '#F0E8F8' }, { bg: '#7A2B1A', bg2: '#93392A', tx2: '#F8E8E4' }, { bg: '#101820', bg2: '#1C2A36', tx2: '#DCE6EE' }],
    dekor: (b, uv) => svgPoly(`<rect x="0" y="0" width="960" height="540" fill="${b.bg}"/><path d="M960 0v${uv ? 540 : 200}L${uv ? 420 : 640} 0z" fill="#fff" opacity=".07"/><rect x="0" y="${uv ? 380 : 0}" width="${uv ? 12 : 12}" height="${uv ? 100 : 540}" fill="${b.a[1]}" opacity="${uv ? 1 : 0}"/><rect x="0" y="0" width="960" height="${uv ? 0 : 8}" fill="${b.a[1]}"/>`),
  },
  // ukázková verze: další motivy (Retrospektiva, Řez, Závoj, Nebeský, Obvod…) jsou v plné verzi
];

export const motivPodleId = (id) => MOTIVY.find((m) => m.id === id) || MOTIVY[0];

/** Skutečné barvy motivu po aplikaci varianty. */
export function barvyMotivu(motivId, varianta = 0) {
  const m = motivPodleId(motivId);
  const v = m.varianty[varianta] || {};
  return { ...m.barvy, ...v, a: v.a || m.barvy.a };
}

const hexNaRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbNaHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
/** Odstín: k > 0 zesvětlí (tint), k < 0 ztmaví (shade); k v rozsahu -1…1. */
export function odstin(hex, k) {
  if (!/^#[0-9a-f]{6}$/i.test(hex) || !k) return hex;
  return rgbNaHex(hexNaRgb(hex).map((v) => (k > 0 ? v + (255 - v) * k : v * (1 + k))));
}

/** Barva ze schématu ('a1'…'a6', 'tx', 'bg', 'tx2', 'bg2', 'lt', 'dk', s odstínem 'a1+40' / 'a1-25') nebo přímo #hex. */
export function barva(b, ref) {
  if (!ref || typeof ref !== 'string') return ref;
  if (ref[0] === '#' || /^(rgb|hsl|transparent|none|url)/i.test(ref)) return ref;
  const m = /^(a[1-6]|tx2|bg2|tx|bg|lt|dk|odkaz)([+-]\d+)?$/.exec(ref);
  if (!m) return ref;
  const zaklad = m[1][0] === 'a' && m[1].length === 2 ? b.a[+m[1][1] - 1]
    : m[1] === 'lt' ? '#FFFFFF' : m[1] === 'dk' ? '#000000' : b[m[1]];
  return m[2] ? odstin(zaklad, +m[2] / 100) : zaklad;
}

// ---------------------------------------------------------------- rozvržení
// Výchozí písma: nadpis 44 pt (řádkování 90 %), text 28 pt s úrovněmi 28/24/20/18/18.
const NADPIS = { x: 66, y: 28.75, w: 828, h: 104.4 };
const OBSAH = { x: 66, y: 143.75, w: 828, h: 342.6 };

export const ROZVRZENI = [
  {
    id: 'uvodni', nazev: 'Úvodní snímek', uvodni: true, ph: [
      { ph: 'nadpis', x: 120, y: 88.4, w: 720, h: 188, zar: 'c', svisle: 'b', vel: 60, prompt: 'Kliknutím lze upravit styl' },
      { ph: 'podtitul', x: 120, y: 283.6, w: 720, h: 130, zar: 'c', svisle: 't', vel: 24, prompt: 'Kliknutím lze upravit styl předlohy podnadpisů' },
    ],
  },
  { id: 'obsah', nazev: 'Název a obsah', ph: [{ ph: 'nadpis', ...NADPIS }, { ph: 'obsah', ...OBSAH }] },
  {
    id: 'oddil', nazev: 'Záhlaví oddílu', uvodni: true, ph: [
      { ph: 'nadpis', x: 65.6, y: 134.6, w: 829, h: 224.7, svisle: 'b', vel: 60 },
      { ph: 'text', x: 65.6, y: 361.5, w: 829, h: 118.2, vel: 24, svisle: 't', sedy: true },
    ],
  },
  { id: 'dva', nazev: 'Dva obsahy', ph: [{ ph: 'nadpis', ...NADPIS }, { ph: 'obsah', x: 66, y: 143.75, w: 408, h: 342.6 }, { ph: 'obsah2', x: 486, y: 143.75, w: 408, h: 342.6 }] },
  {
    id: 'porovnani', nazev: 'Porovnání', ph: [
      { ph: 'nadpis', x: 66, y: 28.75, w: 828, h: 104.4 },
      { ph: 'text', x: 66, y: 132.5, w: 408, h: 66, vel: 24, svisle: 'b', tucne: true },
      { ph: 'obsah', x: 66, y: 198.5, w: 408, h: 288 },
      { ph: 'text2', x: 486, y: 132.5, w: 408, h: 66, vel: 24, svisle: 'b', tucne: true },
      { ph: 'obsah2', x: 486, y: 198.5, w: 408, h: 288 },
    ],
  },
  { id: 'nadpis', nazev: 'Pouze název', ph: [{ ph: 'nadpis', ...NADPIS }] },
  { id: 'prazdny', nazev: 'Prázdný', ph: [] },
  {
    id: 'obsahTitulek', nazev: 'Obsah s titulkem', ph: [
      { ph: 'nadpis', x: 66, y: 36, w: 314, h: 126, vel: 32, svisle: 'b' },
      { ph: 'obsah', x: 401.6, y: 77.8, w: 493.6, h: 408.6 },
      { ph: 'text', x: 66, y: 162, w: 314, h: 302, vel: 16, svisle: 't' },
    ],
  },
  {
    id: 'obrazekTitulek', nazev: 'Obrázek s titulkem', ph: [
      { ph: 'nadpis', x: 66, y: 36, w: 314, h: 126, vel: 32, svisle: 'b' },
      { ph: 'obrazek', x: 401.6, y: 77.8, w: 493.6, h: 408.6 },
      { ph: 'text', x: 66, y: 162, w: 314, h: 302, vel: 16, svisle: 't' },
    ],
  },
  {
    id: 'svisly', nazev: 'Název a svislý text', ph: [{ ph: 'nadpis', ...NADPIS }, { ph: 'obsah', ...OBSAH, svisly: true }],
  },
];

export const rozvrzeniPodleId = (id) => ROZVRZENI.find((r) => r.id === id) || ROZVRZENI[1];

export const VYCHOZI_PROMPTY = {
  nadpis: 'Kliknutím lze upravit styl', podtitul: 'Kliknutím lze upravit styl předlohy podnadpisů',
  obsah: 'Kliknutím lze upravit styly předlohy textu', obsah2: 'Kliknutím lze upravit styly předlohy textu',
  text: 'Kliknutím lze upravit styly předlohy textu', text2: 'Kliknutím lze upravit styly předlohy textu', obrazek: 'Klikněte na ikonu a přidejte obrázek',
};
// v běžném snímku PowerPoint místo „předlohy“ píše výzvu k zadání
export const PROMPTY_SNIMKU = {
  nadpis: 'Kliknutím přidáte nadpis', podtitul: 'Kliknutím přidáte podnadpis', obsah: 'Kliknutím přidáte text', obsah2: 'Kliknutím přidáte text',
  text: 'Kliknutím přidáte text', text2: 'Kliknutím přidáte text', obrazek: 'Kliknutím na ikonu přidáte obrázek',
};

/** Velikosti písma úrovní odrážek v obsahu (pt). */
export const UROVNE = [28, 24, 20, 18, 18];

/** Rychlé styly tvarů (výplň, obrys, text) jako v galerii PowerPointu: 7 barev × 3 varianty. */
export function rychleStyly() {
  const sloupce = ['tx', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
  const radky = [
    (f) => ({ nazev: 'Barevný obrys', vypln: 'bg', obrys: f, text: f }),
    (f) => ({ nazev: 'Barevná výplň', vypln: f, obrys: f + '-50', text: 'lt' }),
    (f) => ({ nazev: 'Jemný efekt', vypln: f + '+80', obrys: f, text: f + '-25' }),
    (f) => ({ nazev: 'Střední efekt', vypln: f + '+40', obrys: 'lt', text: f + '-50' }),
    (f) => ({ nazev: 'Intenzivní efekt', vypln: f, obrys: 'lt', text: 'lt', efekty: { stin: 'vnejsi' } }),
    (f) => ({ nazev: 'Přechod', vypln: f, prechod: [f + '+30', f + '-25'], obrys: 'none', text: 'lt', efekty: { stin: 'vnejsi' } }),
  ];
  const out = [];
  radky.forEach((fn, r) => sloupce.forEach((f) => out.push({ id: `${r}-${f}`, ...fn(f), nazev: `${fn(f).nazev} – ${f === 'tx' ? 'tmavá 1' : 'zvýraznění ' + f[1]}` })));
  return out;
}
