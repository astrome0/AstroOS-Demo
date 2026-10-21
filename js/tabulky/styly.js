// AstroTabulky — barvy motivu Office, styly tabulek, styly buněk, předvolby podmíněného formátu

import { MAX_R } from './adresy.js';

// motiv Office (2023+)
export const MOTIV = {
  tmava1: '#000000', svetla1: '#FFFFFF', tmava2: '#0E2841', svetla2: '#E8E8E8',
  akcenty: ['#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E'],
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const naHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
export const odstin = (h, k) => (k >= 0 ? naHex(hex(h).map((v) => v + (255 - v) * k)) : naHex(hex(h).map((v) => v * (1 + k))));

// ---------------------------------------------------------------- styly tabulek
const BARVY_TAB = [['#000000', 'Černá'], ...MOTIV.akcenty.map((a, i) => [a, `Zvýraznění ${i + 1}`])];

function vytvorStyly() {
  const out = {};
  BARVY_TAB.forEach(([b, jm], i) => {
    const seda = i === 0;
    // Světlé 1–7: pruhy, čáry nahoře a dole
    out['svetly' + (i + 1)] = { nazev: `Světlý styl tabulky ${i + 1}`, skupina: 'svetly', hlavicka: { barva: seda ? '#000' : odstin(b, -0.25), b: true, ohrDole: b }, pruh: seda ? '#D9D9D9' : odstin(b, 0.8), ohrObal: b, text: seda ? '#000' : odstin(b, -0.25) };
    // Světlé 8–14: barevné záhlaví, orámování
    out['svetly' + (i + 8)] = { nazev: `Světlý styl tabulky ${i + 8}`, skupina: 'svetly', hlavicka: { pozadi: b, barva: '#FFFFFF', b: true }, ohrObal: b, ohrRadky: b };
    // Světlé 15–21: mřížka
    out['svetly' + (i + 15)] = { nazev: `Světlý styl tabulky ${i + 15}`, skupina: 'svetly', hlavicka: { barva: '#000', b: true, ohrDole: b }, pruh: seda ? '#D9D9D9' : odstin(b, 0.8), mrizka: seda ? '#7F7F7F' : odstin(b, 0.4) };
    // Střední 1–7: barevné záhlaví, pruhy, tenké čáry
    out['stredni' + (i + 1)] = { nazev: `Střední styl tabulky ${i + 1}`, skupina: 'stredni', hlavicka: { pozadi: b, barva: '#FFFFFF', b: true }, pruh: seda ? '#D9D9D9' : odstin(b, 0.8), ohrRadky: seda ? '#7F7F7F' : odstin(b, 0.4), ohrObal: seda ? '#7F7F7F' : odstin(b, 0.4) };
    // Střední 8–14: výraznější pruhy bez čar
    out['stredni' + (i + 8)] = { nazev: `Střední styl tabulky ${i + 8}`, skupina: 'stredni', hlavicka: { pozadi: b, barva: '#FFFFFF', b: true }, pruh: seda ? '#BFBFBF' : odstin(b, 0.6), radek: seda ? '#D9D9D9' : odstin(b, 0.8), mrizka: '#FFFFFF' };
    // Střední 15–21: tmavé záhlaví, pruhy
    out['stredni' + (i + 15)] = { nazev: `Střední styl tabulky ${i + 15}`, skupina: 'stredni', hlavicka: { pozadi: '#000000', barva: '#FFFFFF', b: true }, pruh: seda ? '#D9D9D9' : odstin(b, 0.8), ohrObal: '#000', ohrRadky: seda ? '#A6A6A6' : odstin(b, 0.4) };
    // Tmavé 1–7
    out['tmavy' + (i + 1)] = { nazev: `Tmavý styl tabulky ${i + 1}`, skupina: 'tmavy', hlavicka: { pozadi: '#000000', barva: '#FFFFFF', b: true, ohrDole: '#FFF' }, pruh: seda ? '#404040' : odstin(b, -0.25), radek: seda ? '#737373' : b, text: '#FFFFFF' };
  });
  return out;
}
export const STYLY_TABULEK = vytvorStyly();

/** Barvy a písmo buňky podle stylu tabulky. */
export function stylTabulky(t, r, c, S, list) {
  const st = STYLY_TABULEK[t.styl] || STYLY_TABULEK.stredni2;
  const o = t.oblast;
  const zahlavi = t.zahlavi !== false && r === o.r1;
  const souhrn = t.souhrn && r === o.r2;
  const out = { pismo: {}, ohr: {} };
  if (zahlavi) {
    if (st.hlavicka.pozadi) out.pozadi = st.hlavicka.pozadi;
    out.pismo = { barva: st.hlavicka.barva, b: st.hlavicka.b };
    if (st.hlavicka.ohrDole) out.ohr.b = { s: 'tenka', b: st.hlavicka.ohrDole };
  } else if (souhrn) {
    out.pismo = { b: true, barva: st.text && st.skupina === 'tmavy' ? st.text : undefined };
    out.ohr.t = { s: 'dvojita', b: st.hlavicka.pozadi && st.hlavicka.pozadi !== '#000000' ? st.hlavicka.pozadi : '#000' };
    if (st.skupina === 'tmavy') out.pozadi = st.radek;
  } else {
    // pořadí datového řádku mezi viditelnými (filtr pruhy nerozbije)
    let i = 0;
    for (let rr = o.r1 + (t.zahlavi === false ? 0 : 1); rr < r; rr++) if (!list.skryteR.has(rr) && !list.skryteFiltrem.has(rr)) i++;
    const lichy = i % 2 === 0;
    if (st.radek) out.pozadi = st.radek;
    if (t.pruhyR !== false && lichy && st.pruh) out.pozadi = st.pruh;
    if (t.pruhyS && (c - o.c1) % 2 === 0 && st.pruh) out.pozadi = st.pruh;
    if (st.text) out.pismo.barva = st.text;
    if (st.ohrRadky) out.ohr.b = { s: 'tenka', b: st.ohrRadky };
  }
  if ((t.prvniS && c === o.c1) || (t.posledniS && c === o.c2)) out.pismo.b = true;
  if (st.mrizka) { const cara = { s: 'tenka', b: st.mrizka }; out.ohr = { t: cara, b: cara, l: cara, r: cara, ...out.ohr }; }
  if (st.ohrObal) {
    const cara = { s: 'tenka', b: st.ohrObal };
    if (r === o.r1) out.ohr.t = cara;
    if (r === o.r2) out.ohr.b = cara;
    if (st.skupina === 'svetly' && st.hlavicka.pozadi) { if (c === o.c1) out.ohr.l = cara; if (c === o.c2) out.ohr.r = cara; }
  }
  if (!Object.keys(out.ohr).length) delete out.ohr;
  return out;
}

// ---------------------------------------------------------------- styly buněk
const a = MOTIV.akcenty;
export const STYLY_BUNEK = [
  { skupina: 'Dobrá, špatná a neutrální', styly: [
    { id: 'normalni', nazev: 'Normální', s: {} },
    { id: 'chybna', nazev: 'Chybná', s: { pozadi: '#FFC7CE', barva: '#9C0006' } },
    { id: 'dobra', nazev: 'Dobrá', s: { pozadi: '#C6EFCE', barva: '#006100' } },
    { id: 'neutralni', nazev: 'Neutrální', s: { pozadi: '#FFEB9C', barva: '#9C5700' } },
  ] },
  { skupina: 'Data a model', styly: [
    { id: 'vypocet', nazev: 'Výpočet', s: { pozadi: '#F2F2F2', barva: '#FA7D00', b: true, ohr: vse('#7F7F7F') } },
    { id: 'kontrolni', nazev: 'Kontrolní buňka', s: { pozadi: '#A5A5A5', barva: '#FFFFFF', b: true, ohr: vse('#3F3F3F', 'dvojita') } },
    { id: 'vysvetlujici', nazev: 'Vysvětlující…', s: { i: true, barva: '#7F7F7F' } },
    { id: 'vstup', nazev: 'Vstup', s: { pozadi: '#FFCC99', barva: '#3F3F76', ohr: vse('#7F7F7F') } },
    { id: 'propojena', nazev: 'Propojená b…', s: { barva: '#FA7D00', ohr: { b: { s: 'dvojita', b: '#FF8001' } } } },
    { id: 'poznamka', nazev: 'Poznámka', s: { pozadi: '#FFFFCC', ohr: vse('#B2B2B2') } },
    { id: 'vystup', nazev: 'Výstup', s: { pozadi: '#F2F2F2', barva: '#3F3F3F', b: true, ohr: vse('#3F3F3F') } },
    { id: 'upozorneni', nazev: 'Text upozor…', s: { barva: '#FF0000' } },
  ] },
  { skupina: 'Nadpisy a názvy', styly: [
    { id: 'nadpis1', nazev: 'Nadpis 1', s: { vel: 15, b: true, barva: MOTIV.tmava2, ohr: { b: { s: 'tlusta', b: a[0] } } } },
    { id: 'nadpis2', nazev: 'Nadpis 2', s: { vel: 13, b: true, barva: MOTIV.tmava2, ohr: { b: { s: 'tlusta', b: odstin(a[0], 0.5) } } } },
    { id: 'nadpis3', nazev: 'Nadpis 3', s: { vel: 11, b: true, barva: MOTIV.tmava2, ohr: { b: { s: 'stredni', b: odstin(a[0], 0.6) } } } },
    { id: 'nadpis4', nazev: 'Nadpis 4', s: { b: true, barva: MOTIV.tmava2 } },
    { id: 'nazev', nazev: 'Název', s: { vel: 18, font: 'Aptos Display', barva: MOTIV.tmava2 } },
    { id: 'celkem', nazev: 'Celkem', s: { b: true, ohr: { t: { s: 'tenka', b: a[0] }, b: { s: 'dvojita', b: a[0] } } } },
  ] },
  { skupina: 'Styly buněk s motivem', styly: [
    ...a.map((b, i) => ({ id: 'z20_' + i, nazev: `20 % – Zvýra…`, titulek: `20 % – Zvýraznění${i + 1}`, s: { pozadi: odstin(b, 0.8) } })),
    ...a.map((b, i) => ({ id: 'z40_' + i, nazev: `40 % – Zvýra…`, titulek: `40 % – Zvýraznění${i + 1}`, s: { pozadi: odstin(b, 0.6) } })),
    ...a.map((b, i) => ({ id: 'z60_' + i, nazev: `60 % – Zvýra…`, titulek: `60 % – Zvýraznění${i + 1}`, s: { pozadi: odstin(b, 0.4), barva: '#FFFFFF' } })),
    ...a.map((b, i) => ({ id: 'z_' + i, nazev: `Zvýraznění${i + 1}`, s: { pozadi: b, barva: '#FFFFFF' } })),
  ] },
  { skupina: 'Formát čísla', styly: [
    { id: 'carka', nazev: 'Čárka', s: { nf: '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-' } },
    { id: 'carka0', nazev: 'Čárka [0]', s: { nf: '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-' } },
    { id: 'mena', nazev: 'Měna', s: { nf: '_-* #,##0.00 "Kč"_-;-* #,##0.00 "Kč"_-;_-* "-"?? "Kč"_-;_-@_-' } },
    { id: 'mena0', nazev: 'Měna [0]', s: { nf: '_-* #,##0 "Kč"_-;-* #,##0 "Kč"_-;_-* "-" "Kč"_-;_-@_-' } },
    { id: 'procenta', nazev: 'Procenta', s: { nf: '0%' } },
  ] },
];
function vse(b, s = 'tenka') { const c = { s, b }; return { t: c, b: c, l: c, r: c }; }

// ---------------------------------------------------------------- podmíněné formátování
export const PREDVOLBY_CF = [
  { id: 'cervena', nazev: 'Světle červená výplň s tmavě červeným textem', styl: { pozadi: '#FFC7CE', barva: '#9C0006' } },
  { id: 'zluta', nazev: 'Žlutá výplň s tmavě žlutým textem', styl: { pozadi: '#FFEB9C', barva: '#9C5700' } },
  { id: 'zelena', nazev: 'Zelená výplň s tmavě zeleným textem', styl: { pozadi: '#C6EFCE', barva: '#006100' } },
  { id: 'cervenaVypln', nazev: 'Světle červená výplň', styl: { pozadi: '#FFC7CE' } },
  { id: 'cervenyText', nazev: 'Červený text', styl: { barva: '#9C0006' } },
  { id: 'cerveneOhr', nazev: 'Červené ohraničení', styl: { ohr: vse('#C00000') } },
];

export const DATOVE_PRUHY = [
  ['#638EC6', 'Modrý datový pruh'], ['#63C384', 'Zelený datový pruh'], ['#FF555A', 'Červený datový pruh'],
  ['#FFB628', 'Oranžový datový pruh'], ['#008AEF', 'Světle modrý datový pruh'], ['#D6007B', 'Fialový datový pruh'],
];

export const BAREVNE_SKALY = [
  [['#F8696B', '#FFEB84', '#63BE7B'], 'Barevná škála červená – žlutá – zelená'], [['#63BE7B', '#FFEB84', '#F8696B'], 'Barevná škála zelená – žlutá – červená'],
  [['#F8696B', '#FCFCFF', '#63BE7B'], 'Barevná škála červená – bílá – zelená'], [['#63BE7B', '#FCFCFF', '#F8696B'], 'Barevná škála zelená – bílá – červená'],
  [['#F8696B', '#FCFCFF', '#5A8AC6'], 'Barevná škála červená – bílá – modrá'], [['#5A8AC6', '#FCFCFF', '#F8696B'], 'Barevná škála modrá – bílá – červená'],
  [['#FCFCFF', '#63BE7B'], 'Barevná škála bílá – zelená'], [['#63BE7B', '#FCFCFF'], 'Barevná škála zelená – bílá'],
  [['#FCFCFF', '#F8696B'], 'Barevná škála bílá – červená'], [['#F8696B', '#FCFCFF'], 'Barevná škála červená – bílá'],
  [['#FFEF9C', '#63BE7B'], 'Barevná škála žlutá – zelená'], [['#63BE7B', '#FFEF9C'], 'Barevná škála zelená – žlutá'],
];

export const SADY_IKON = [
  ['sipky3', 'Tři šipky (barevné)'], ['sipky4', 'Čtyři šipky (barevné)'], ['sipky5', 'Pět šipek (barevné)'],
  ['semafor3', 'Tři semafory'], ['semafor4', 'Čtyři semafory'], ['vlajky3', 'Tři praporky'], ['hvezdy3', 'Tři hvězdičky'],
  ['stupne4', 'Čtyři pruhy'], ['stupne5', 'Pět pruhů'],
];

export { MAX_R };
