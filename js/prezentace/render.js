// AstroPrezentace — vykreslení snímku do DOM. Stejná funkce slouží editoru, miniaturám, prezentaci i tisku,
// takže snímek vypadá všude stejně (1 jednotka = 1 bod, měřítko řeší transform na obalu).

import { el, cz } from '../util.js';
import { icon } from '../icons.js';
import { zasobnikPisma } from '../pismo/dokument.js';
import { svgGrafu } from '../tabulky/grafy.js';
import { motivPodleId, barvyMotivu, barva, rozvrzeniPodleId, PROMPTY_SNIMKU, UROVNE, odstin } from './motivy.js';
import { jePrazdnyText, defPh } from './model.js';
import { tt } from '../i18n.js';

// ---------------------------------------------------------------- tvary
export const TVARY = [
  { skupina: 'Čáry', tvary: [['cara', 'Čára'], ['caraSipka', 'Čára se šipkou'], ['caraDvojSipka', 'Čára se šipkami na obou stranách']] },
  { skupina: 'Obdélníky', tvary: [['obdelnik', 'Obdélník'], ['zaobleny', 'Obdélník: zakulacené rohy'], ['zkoseny', 'Obdélník: seříznutý roh'], ['zkoseny2', 'Obdélník: seříznuté protilehlé rohy']] },
  {
    skupina: 'Základní obrazce', tvary: [['textove', 'Textové pole'], ['oval', 'Ovál'], ['trojuhelnik', 'Rovnoramenný trojúhelník'], ['pravouhly', 'Pravoúhlý trojúhelník'],
      ['rovnobeznik', 'Rovnoběžník'], ['lichobeznik', 'Lichoběžník'], ['kosoctverec', 'Kosočtverec'], ['petiuhelnik', 'Pravidelný pětiúhelník'],
      ['sestiuhelnik', 'Šestiúhelník'], ['osmiuhelnik', 'Osmiúhelník'], ['kriz', 'Kříž'], ['prstenec', 'Prstenec'], ['valec', 'Válec'], ['krychle', 'Krychle'],
      ['srdce', 'Srdce'], ['blesk', 'Blesk'], ['mesic', 'Měsíc'], ['usmev', 'Smajlík'], ['oblak', 'Obláček'], ['slunce', 'Slunce'], ['ramecek', 'Rámeček'], ['zakaz', 'Symbol „Zakázáno“']],
  },
  {
    skupina: 'Plné šipky', tvary: [['sipkaVpravo', 'Šipka: doprava'], ['sipkaVlevo', 'Šipka: doleva'], ['sipkaNahoru', 'Šipka: nahoru'], ['sipkaDolu', 'Šipka: dolů'],
      ['sipkaObou', 'Šipka: doleva a doprava'], ['sipkaSvisla', 'Šipka: nahoru a dolů'], ['sipkaCtyr', 'Šipka: čtyřsměrná'], ['petiuhelnikSipka', 'Šipka: pětiúhelník'], ['krokev', 'Šipka: dvojitá šipka'], ['sipkaZahnuta', 'Šipka: do U']],
  },
  { skupina: 'Vývojové diagramy', tvary: [['obdelnik', 'Vývojový diagram: proces'], ['kosoctverec', 'Vývojový diagram: rozhodnutí'], ['rovnobeznik', 'Vývojový diagram: data'], ['terminator', 'Vývojový diagram: ukončení'], ['dokument', 'Vývojový diagram: dokument'], ['oval', 'Vývojový diagram: spojnice']] },
  { skupina: 'Hvězdy a pruhy', tvary: [['hvezda4', 'Hvězda: 4 cípy'], ['hvezda5', 'Hvězda: 5 cípů'], ['hvezda6', 'Hvězda: 6 cípů'], ['hvezda8', 'Hvězda: 8 cípů'], ['hvezda12', 'Hvězda: 12 cípů'], ['vybuch', 'Výbuch: 8 cípů'], ['stuha', 'Stuha: zahnutá nahoru']] },
  { skupina: 'Popisky', tvary: [['bublina', 'Řečová bublina: obdélník'], ['bublinaZaobl', 'Řečová bublina: obdélník se zakulacenými rohy'], ['bublinaOval', 'Řečová bublina: ovál'], ['myslenka', 'Myšlenková bublina: obláček']] },
];
export const JMENA_TVARU = Object.fromEntries(TVARY.flatMap((s) => s.tvary));
export const jeCara = (t) => t === 'cara' || t === 'caraSipka' || t === 'caraDvojSipka';

const pol = (body) => 'M' + body.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L') + 'Z';
function hvezda(n, w, h, vnitrni = 0.38) {
  const b = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? vnitrni : 0.5;
    b.push([w / 2 + Math.cos(a) * r * w, h / 2 + Math.sin(a) * r * h]);
  }
  return pol(b);
}
function mnohouhelnik(n, w, h, rot = -Math.PI / 2) {
  const b = [];
  for (let i = 0; i < n; i++) { const a = rot + (i * 2 * Math.PI) / n; b.push([w / 2 + Math.cos(a) * w / 2, h / 2 + Math.sin(a) * h / 2]); }
  return pol(b);
}

/** SVG cesta tvaru v souřadnicích 0…w × 0…h. */
export function cestaTvaru(t, w, h) {
  const m = Math.min(w, h);
  switch (t) {
    case 'obdelnik': case 'textove': return `M0 0H${w}V${h}H0Z`;
    case 'zaobleny': { const r = m * 0.1667; return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`; }
    case 'zkoseny': { const r = m * 0.1667; return pol([[0, 0], [w - r, 0], [w, r], [w, h], [0, h]]); }
    case 'zkoseny2': { const r = m * 0.1667; return pol([[0, 0], [w - r, 0], [w, r], [w, h], [r, h], [0, h - r]]); }
    case 'oval': return `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 1 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 1 0 ${h / 2}Z`;
    case 'trojuhelnik': return pol([[w / 2, 0], [w, h], [0, h]]);
    case 'pravouhly': return pol([[0, 0], [w, h], [0, h]]);
    case 'rovnobeznik': { const k = m * 0.25; return pol([[k, 0], [w, 0], [w - k, h], [0, h]]); }
    case 'lichobeznik': { const k = m * 0.25; return pol([[k, 0], [w - k, 0], [w, h], [0, h]]); }
    case 'kosoctverec': return pol([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'petiuhelnik': return mnohouhelnik(5, w, h);
    case 'sestiuhelnik': { const k = m * 0.25; return pol([[k, 0], [w - k, 0], [w, h / 2], [w - k, h], [k, h], [0, h / 2]]); }
    case 'osmiuhelnik': { const k = m * 0.2929; return pol([[k, 0], [w - k, 0], [w, k], [w, h - k], [w - k, h], [k, h], [0, h - k], [0, k]]); }
    case 'kriz': { const k = m * 0.25; return pol([[k, 0], [w - k, 0], [w - k, k], [w, k], [w, h - k], [w - k, h - k], [w - k, h], [k, h], [k, h - k], [0, h - k], [0, k], [k, k]]); }
    case 'prstenec': { const r = m * 0.25; return `${cestaTvaru('oval', w, h)}M${r} ${h / 2}A${w / 2 - r} ${h / 2 - r} 0 1 0 ${w - r} ${h / 2}A${w / 2 - r} ${h / 2 - r} 0 1 0 ${r} ${h / 2}Z`; }
    case 'valec': { const e = Math.min(h * 0.25, m * 0.25) / 2; return `M0 ${e}A${w / 2} ${e} 0 0 1 ${w} ${e}V${h - e}A${w / 2} ${e} 0 0 1 0 ${h - e}ZM0 ${e}A${w / 2} ${e} 0 0 0 ${w} ${e}`; }
    case 'krychle': { const k = m * 0.25; return `${pol([[0, k], [w - k, k], [w - k, h], [0, h]])}${pol([[0, k], [k, 0], [w, 0], [w - k, k]])}${pol([[w - k, k], [w, 0], [w, h - k], [w - k, h]])}`; }
    case 'srdce': return `M${w / 2} ${h * 0.25}C${w / 2} ${h * -0.05} 0 ${h * -0.05} 0 ${h * 0.3}C0 ${h * 0.6} ${w * 0.35} ${h * 0.75} ${w / 2} ${h}C${w * 0.65} ${h * 0.75} ${w} ${h * 0.6} ${w} ${h * 0.3}C${w} ${h * -0.05} ${w / 2} ${h * -0.05} ${w / 2} ${h * 0.25}Z`;
    case 'blesk': return pol([[0.39, 0], [0.62, 0.34], [0.53, 0.38], [0.8, 0.64], [0.72, 0.68], [1, 1], [0.44, 0.73], [0.53, 0.69], [0.2, 0.47], [0.32, 0.42], [0, 0.18]].map(([x, y]) => [x * w, y * h]));
    case 'mesic': return `M${w} 0A${w} ${h / 2} 0 0 0 ${w} ${h}A${w * 0.5} ${h / 2} 0 0 1 ${w} 0Z`;
    case 'usmev': return `${cestaTvaru('oval', w, h)}M${w * 0.3} ${h * 0.37}a${w * 0.05} ${h * 0.05} 0 1 0 0.01 0ZM${w * 0.7} ${h * 0.37}a${w * 0.05} ${h * 0.05} 0 1 0 0.01 0ZM${w * 0.25} ${h * 0.62}Q${w / 2} ${h * 0.85} ${w * 0.75} ${h * 0.62}`;
    case 'oblak': case 'myslenka': {
      const c = `M${w * 0.17} ${h * 0.73}C${w * 0.02} ${h * 0.75} ${-w * 0.02} ${h * 0.47} ${w * 0.14} ${h * 0.42}C${w * 0.08} ${h * 0.18} ${w * 0.32} ${h * 0.05} ${w * 0.43} ${h * 0.18}C${w * 0.52} ${-h * 0.02} ${w * 0.78} ${h * 0.02} ${w * 0.78} ${h * 0.2}C${w * 0.98} ${h * 0.2} ${w * 1.02} ${h * 0.45} ${w * 0.9} ${h * 0.55}C${w * 1.02} ${h * 0.72} ${w * 0.86} ${h * 0.92} ${w * 0.7} ${h * 0.84}C${w * 0.6} ${h * 1.02} ${w * 0.34} ${h * 0.98} ${w * 0.3} ${h * 0.84}C${w * 0.24} ${h * 0.9} ${w * 0.17} ${h * 0.84} ${w * 0.17} ${h * 0.73}Z`;
      return t === 'myslenka' ? c + `M${w * 0.1} ${h * 0.92}a${w * 0.04} ${h * 0.04} 0 1 0 0.01 0ZM${w * 0.02} ${h * 1.02}a${w * 0.025} ${h * 0.025} 0 1 0 0.01 0Z` : c;
    }
    case 'slunce': return hvezda(8, w, h, 0.3);
    case 'ramecek': { const k = m * 0.125; return `M0 0H${w}V${h}H0ZM${k} ${k}V${h - k}H${w - k}V${k}Z`; }
    case 'zakaz': { const k = m * 0.18; return `${cestaTvaru('oval', w, h)}M${w * 0.28} ${h * 0.19}L${w * 0.81} ${h * 0.72}A${w / 2 - k} ${h / 2 - k} 0 0 0 ${w * 0.28} ${h * 0.19}ZM${w * 0.72} ${h * 0.81}L${w * 0.19} ${h * 0.28}A${w / 2 - k} ${h / 2 - k} 0 0 0 ${w * 0.72} ${h * 0.81}Z`; }
    case 'sipkaVpravo': { const hl = Math.min(w * 0.5, h * 0.5); return pol([[0, h * 0.25], [w - hl, h * 0.25], [w - hl, 0], [w, h / 2], [w - hl, h], [w - hl, h * 0.75], [0, h * 0.75]]); }
    case 'sipkaVlevo': { const hl = Math.min(w * 0.5, h * 0.5); return pol([[w, h * 0.25], [hl, h * 0.25], [hl, 0], [0, h / 2], [hl, h], [hl, h * 0.75], [w, h * 0.75]]); }
    case 'sipkaNahoru': { const hl = Math.min(h * 0.5, w * 0.5); return pol([[w * 0.25, h], [w * 0.25, hl], [0, hl], [w / 2, 0], [w, hl], [w * 0.75, hl], [w * 0.75, h]]); }
    case 'sipkaDolu': { const hl = Math.min(h * 0.5, w * 0.5); return pol([[w * 0.25, 0], [w * 0.75, 0], [w * 0.75, h - hl], [w, h - hl], [w / 2, h], [0, h - hl], [w * 0.25, h - hl]]); }
    case 'sipkaObou': { const hl = Math.min(w * 0.25, h * 0.5); return pol([[0, h / 2], [hl, 0], [hl, h * 0.25], [w - hl, h * 0.25], [w - hl, 0], [w, h / 2], [w - hl, h], [w - hl, h * 0.75], [hl, h * 0.75], [hl, h]]); }
    case 'sipkaSvisla': { const hl = Math.min(h * 0.25, w * 0.5); return pol([[w / 2, 0], [w, hl], [w * 0.75, hl], [w * 0.75, h - hl], [w, h - hl], [w / 2, h], [0, h - hl], [w * 0.25, h - hl], [w * 0.25, hl], [0, hl]]); }
    case 'sipkaCtyr': {
      const a = 0.22, b = 0.38, c = 0.62;
      return pol([[0.5, 0], [0.72, a], [c, a], [c, b], [1 - a, b], [1 - a, 0.28], [1, 0.5], [1 - a, 0.72], [1 - a, c], [c, c], [c, 1 - a], [0.72, 1 - a], [0.5, 1], [0.28, 1 - a], [b, 1 - a], [b, c], [a, c], [a, 0.72], [0, 0.5], [a, 0.28], [a, b], [b, b], [b, a], [0.28, a]].map(([x, y]) => [x * w, y * h]));
    }
    case 'petiuhelnikSipka': { const hl = Math.min(w * 0.5, h * 0.5); return pol([[0, 0], [w - hl, 0], [w, h / 2], [w - hl, h], [0, h]]); }
    case 'krokev': { const hl = Math.min(w * 0.5, h * 0.5); return pol([[0, 0], [w - hl, 0], [w, h / 2], [w - hl, h], [0, h], [hl, h / 2]]); }
    case 'sipkaZahnuta': { const s = w * 0.25; return `M0 ${h}V${h * 0.45}A${w * 0.4} ${h * 0.45} 0 0 1 ${w * 0.8} ${h * 0.45}V${h * 0.6}H${w}L${w * 0.675} ${h}L${w * 0.35} ${h * 0.6}H${w * 0.55}V${h * 0.45}A${w * 0.15} ${h * 0.2} 0 0 0 ${s} ${h * 0.45}V${h}Z`; }
    case 'terminator': { const r = Math.min(h / 2, w / 2); return `M${r} 0H${w - r}A${r} ${h / 2} 0 0 1 ${w - r} ${h}H${r}A${r} ${h / 2} 0 0 1 ${r} 0Z`; }
    case 'dokument': return `M0 0H${w}V${h * 0.83}C${w * 0.75} ${h * 0.7} ${w * 0.5} ${h * 1.1} 0 ${h * 0.9}Z`;
    case 'hvezda4': return hvezda(4, w, h, 0.19);
    case 'hvezda5': return hvezda(5, w, h, 0.19);
    case 'hvezda6': return hvezda(6, w, h, 0.29);
    case 'hvezda8': return hvezda(8, w, h, 0.38);
    case 'hvezda12': return hvezda(12, w, h, 0.37);
    case 'vybuch': return pol([[0.43, 0.14], [0.57, 0], [0.62, 0.2], [0.85, 0.07], [0.76, 0.33], [1, 0.36], [0.82, 0.5], [0.97, 0.7], [0.72, 0.68], [0.73, 0.95], [0.55, 0.78], [0.44, 1], [0.37, 0.77], [0.15, 0.9], [0.2, 0.66], [0, 0.6], [0.16, 0.45], [0.02, 0.24], [0.27, 0.28], [0.25, 0.04]].map(([x, y]) => [x * w, y * h]));
    case 'stuha': return pol([[0, 0.25], [0.2, 0.25], [0.2, 0], [0.8, 0], [0.8, 0.25], [1, 0.25], [0.9, 0.5], [1, 0.75], [0.8, 0.75], [0.8, 1], [0.2, 1], [0.2, 0.75], [0, 0.75], [0.1, 0.5]].map(([x, y]) => [x * w, y * h]));
    case 'bublina': return pol([[0, 0], [w, 0], [w, h * 0.75], [w * 0.42, h * 0.75], [w * 0.2, h * 1.12], [w * 0.25, h * 0.75], [0, h * 0.75]]);
    case 'bublinaZaobl': { const r = Math.min(w, h * 0.75) * 0.14, H = h * 0.75; return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${H - r}A${r} ${r} 0 0 1 ${w - r} ${H}H${w * 0.42}L${w * 0.2} ${h * 1.12}L${w * 0.25} ${H}H${r}A${r} ${r} 0 0 1 0 ${H - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`; }
    case 'bublinaOval': return `M${w * 0.3} ${h * 0.84}A${w / 2} ${h * 0.42} 0 1 1 ${w * 0.45} ${h * 0.84}L${w * 0.18} ${h * 1.1}Z`;
    default: return `M0 0H${w}V${h}H0Z`;
  }
}

/** Kde uvnitř tvaru leží text (vnitřní obdélník), jako „text rect“ tvarů v Office. */
function textovyObdelnik(t, w, h) {
  const r = (x1, y1, x2, y2) => ({ x: x1 * w, y: y1 * h, w: (x2 - x1) * w, h: (y2 - y1) * h });
  switch (t) {
    case 'oval': case 'bublinaOval': return r(0.146, 0.146, 0.854, t === 'bublinaOval' ? 0.7 : 0.854);
    case 'trojuhelnik': return r(0.25, 0.5, 0.75, 1);
    case 'pravouhly': return r(0.08, 0.5, 0.5, 0.92);
    case 'kosoctverec': return r(0.25, 0.25, 0.75, 0.75);
    case 'petiuhelnik': case 'sestiuhelnik': case 'osmiuhelnik': return r(0.15, 0.15, 0.85, 0.85);
    case 'hvezda4': case 'hvezda5': case 'hvezda6': case 'hvezda8': case 'hvezda12': case 'vybuch': case 'slunce': return r(0.28, 0.3, 0.72, 0.72);
    case 'bublina': case 'bublinaZaobl': return r(0, 0, 1, 0.75);
    case 'sipkaVpravo': case 'sipkaVlevo': case 'sipkaObou': return r(0.1, 0.25, 0.9, 0.75);
    case 'valec': return r(0, 0.2, 1, 0.9);
    case 'krychle': return r(0, 0.25, 0.75, 1);
    case 'srdce': return r(0.2, 0.2, 0.8, 0.7);
    case 'oblak': case 'myslenka': return r(0.15, 0.2, 0.85, 0.8);
    case 'rovnobeznik': case 'lichobeznik': return r(0.15, 0, 0.85, 1);
    default: return r(0, 0, 1, 1);
  }
}

// ---------------------------------------------------------------- barvy a písma
/** Barvy prezentace (motiv + varianta, případně barvy převzaté z jiného motivu). */
export const barvyPrezentace = (pres) => (pres.barvyZ ? barvyMotivu(pres.barvyZ, 0) : barvyMotivu(pres.motiv, pres.varianta));

export function kontextSnimku(pres, s) {
  const b = barvyPrezentace(pres);
  const motiv = motivPodleId(pres.motiv);
  const r = rozvrzeniPodleId(s?.rozvrzeni);
  let tx = b.tx;
  if (r.uvodni && motiv.titulni && !s?.pozadi) tx = motiv.titulni.tx;
  if (s?.pozadi?.barvaTextu) tx = barva(b, s.pozadi.barvaTextu);
  return { b, motiv, r, tx, pismoNadpis: pres.pisma?.nadpis || motiv.pismo.nadpis, pismoTelo: pres.pisma?.telo || motiv.pismo.telo, pres, s };
}

/** CSS hodnota barvy pro text uvnitř snímku — přes proměnné, takže sleduje změnu motivu. */
export function barvaCss(ref) {
  if (!ref || ref === 'auto') return '';
  if (ref[0] === '#' || /^(rgb|hsl)/.test(ref)) return ref;
  const m = /^(a[1-6]|tx2|bg2|tx|bg|lt|dk|odkaz)([+-]\d+)?$/.exec(ref);
  if (!m) return ref;
  const v = m[1] === 'lt' ? '#FFFFFF' : m[1] === 'dk' ? '#000000' : `var(--pr-${m[1]})`;
  if (!m[2]) return v;
  const k = +m[2];
  return `color-mix(in srgb, ${v} ${100 - Math.abs(k)}%, ${k > 0 ? '#FFFFFF' : '#000000'})`;
}
function promenneBarev(sn, b) {
  const s = sn.style;
  s.setProperty('--pr-tx', b.tx); s.setProperty('--pr-bg', b.bg); s.setProperty('--pr-tx2', b.tx2); s.setProperty('--pr-bg2', b.bg2); s.setProperty('--pr-odkaz', b.odkaz || b.a[0]);
  b.a.forEach((x, i) => s.setProperty(`--pr-a${i + 1}`, x));
}

export function pismoObjektu(o, ctx) {
  const p = o.pismo || (o.ph && o.ph.startsWith('nadpis') ? '+nadpis' : '+telo');
  if (p === '+nadpis') return ctx.pismoNadpis;
  if (p === '+telo') return ctx.pismoTelo;
  return p;
}
export const stackPisma = (p) => zasobnikPisma(p);

export function prechodCss(p, b) {
  if (!p) return null;
  if (p.typ === 'barva') return barva(b, p.b);
  if (p.typ === 'prechod') return `${p.radialni ? 'radial-gradient(circle,' : `linear-gradient(${p.uhel ?? 90}deg,`} ${barva(b, p.b1)}, ${barva(b, p.b2)})`;
  return null;
}

// ---------------------------------------------------------------- odrážky a číslování
const RIMSKE = [['m', 1000], ['cm', 900], ['d', 500], ['cd', 400], ['c', 100], ['xc', 90], ['l', 50], ['xl', 40], ['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]];
const rimske = (n) => { let s = ''; for (const [z, v] of RIMSKE) while (n >= v) { s += z; n -= v; } return s; };
export const CISLOVANI = {
  '1.': (n) => `${n}.`, '1)': (n) => `${n})`, 'I.': (n) => `${rimske(n).toUpperCase()}.`, 'A.': (n) => `${String.fromCharCode(64 + ((n - 1) % 26) + 1)}.`,
  'a)': (n) => `${String.fromCharCode(96 + ((n - 1) % 26) + 1)})`, 'a.': (n) => `${String.fromCharCode(96 + ((n - 1) % 26) + 1)}.`, 'i.': (n) => `${rimske(n)}.`,
};
export const ODRAZKY = [['•', 'Plné kulaté odrážky'], ['○', 'Duté kulaté odrážky'], ['■', 'Plné čtvercové odrážky'], ['□', 'Duté čtvercové odrážky'], ['❖', 'Odrážky hvězdičky'], ['➢', 'Šipky jako odrážky'], ['✓', 'Odrážky zaškrtnutí']];

export const jeTelo = (o) => o.ph && /^(obsah|text)/.test(o.ph) && !o.phObrazek;
/** Výchozí odrážka objektu: tělo zástupného symbolu má „•“, ostatní nic. */
export const vychoziOdrazka = (o) => (o.odrazky !== undefined ? o.odrazky : o.ph && o.ph.startsWith('obsah') ? '•' : null);

/** Spočítá odrážky/čísla odstavců (data-b) a úroveň písma. Volá se po vykreslení i při psaní. */
export function oznacOdstavce(t, o) {
  const vychozi = vychoziOdrazka(o);
  const citace = [0, 0, 0, 0, 0];
  for (const p of t.children) {
    if (p.tagName !== 'P' && p.tagName !== 'DIV') continue;
    const u = +(p.dataset.u || 0);
    const druh = p.dataset.o === 'ne' ? null : p.dataset.o || vychozi;
    if (druh && CISLOVANI[druh]) {
      citace[u]++;
      for (let k = u + 1; k < 5; k++) citace[k] = 0;
      p.dataset.b = CISLOVANI[druh](citace[u] + (+o.cisloOd || 1) - 1);
      p.classList.add('cislo');
    } else {
      if (!druh) for (let k = u; k < 5; k++) citace[k] = 0;
      if (druh) p.dataset.b = druh; else delete p.dataset.b;
      p.classList.remove('cislo');
    }
    // prázdný odstavec odrážku neukazuje (jako PowerPoint)
    p.classList.toggle('prazdny', !p.textContent.length && !p.querySelector('img'));
  }
}

// ---------------------------------------------------------------- automatické přizpůsobení
/** Zmenší text zástupného symbolu, když přetéká (Zmenšit text při přetečení). */
export function prizpusobText(obj, o) {
  const tr = obj.querySelector(':scope > .pr-tr');
  const t = tr?.firstElementChild;
  if (!t) return;
  t.style.zoom = '';
  t.style.width = '';
  obj.dataset.fit = '';
  const zapnuto = o.autofit ? o.autofit === 'zmensit' : !!o.ph && !o.rust;
  if (!zapnuto || !obj.isConnected || !t.textContent.trim()) return;
  // měří se se zarovnáním nahoru — přetečení nad horní hranu by scrollHeight nezapočítal
  const svisle = tr.dataset.svisle;
  tr.dataset.svisle = 't';
  const vejde = () => tr.scrollHeight <= tr.clientHeight + 1;
  if (!vejde()) {
    const cs = getComputedStyle(tr);
    const sirka = tr.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const nastav = (f) => { t.style.zoom = f; t.style.width = sirka / f + 'px'; };
    let lo = 0.25, hi = 1;
    for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; nastav(mid); if (vejde()) lo = mid; else hi = mid; }
    nastav(lo);
    obj.dataset.fit = String(Math.round(lo * 100));
  }
  tr.dataset.svisle = svisle;
}

/** Textové pole s „Změnit velikost obrazce podle textu“: vrátí potřebnou výšku (v jednotkách snímku). */
export function potrebnaVyska(obj) {
  const tr = obj.querySelector(':scope > .pr-tr');
  if (!tr) return null;
  const t = tr.firstElementChild;
  const cs = getComputedStyle(tr);
  return t.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
}

// ---------------------------------------------------------------- tabulky
export function stylTabulkyBunky(tab, r, c, b) {
  const st = tab.styl || 'stredni2-a1';
  const [druh, ref] = st.split('-');
  const a = ref === 'tx' ? b.tx : barva(b, ref);
  const zahl = tab.zahlavi !== false && r === 0;
  const posl = tab.celkem && r === tab.radky.length - 1;
  const prvni = tab.prvniSloupec && c === 0;
  const pruh = tab.pruhyR !== false && !zahl && ((r - (tab.zahlavi !== false ? 1 : 0)) % 2 === 0);
  const out = { bg: 'transparent', tx: null, b: false, ohr: null };
  if (druh === 'stredni2') {
    out.bg = zahl || posl ? a : pruh ? odstin(a, 0.6) : odstin(a, 0.8);
    out.tx = zahl || posl ? '#FFFFFF' : '#000000';
    out.ohr = '#FFFFFF';
    out.b = zahl || posl || prvni;
  } else if (druh === 'svetly1') {
    out.bg = pruh ? odstin(a, 0.8) : 'transparent';
    out.ohr = null; out.hranaH = a;
    out.b = zahl || posl || prvni;
    out.tx = null;
  } else if (druh === 'svetly2') {
    out.bg = zahl ? a : 'transparent';
    out.tx = zahl ? '#FFFFFF' : null;
    out.ramecek = a; out.b = zahl || prvni;
  } else if (druh === 'tmavy1') {
    out.bg = zahl ? odstin(a, -0.5) : pruh ? odstin(a, -0.25) : a;
    out.tx = '#FFFFFF'; out.ohr = null; out.b = zahl || prvni;
  } else if (druh === 'bez') {
    out.bg = 'transparent'; out.ohr = null; out.b = zahl;
  } else if (druh === 'mrizka') {
    out.bg = zahl ? odstin(a, 0.6) : 'transparent'; out.ohr = a; out.b = zahl;
  }
  return out;
}

function kresliTabulku(o, ctx) {
  const tab = o.tab;
  const t = el('table.pr-tab');
  const celkemW = tab.sloupce.reduce((x, y) => x + y, 0);
  const cg = el('colgroup', {}, tab.sloupce.map((w) => el('col', { style: { width: (w / celkemW) * 100 + '%' } })));
  t.append(cg);
  tab.radky.forEach((radek, r) => {
    const tr = el('tr', { style: { height: (tab.vysky?.[r] || 0) + 'px' } });
    radek.forEach((bunka, c) => {
      if (bunka.skryta) return;
      const s = stylTabulkyBunky(tab, r, c, ctx.b);
      const td = el('td', { dataset: { r, c } });
      if (bunka.colspan > 1) td.colSpan = bunka.colspan;
      if (bunka.rowspan > 1) td.rowSpan = bunka.rowspan;
      td.style.background = bunka.bg ? barva(ctx.b, bunka.bg) : s.bg;
      td.style.color = s.tx || ctx.tx;
      if (s.b) td.style.fontWeight = '700';
      if (s.ohr) td.style.border = `1px solid ${s.ohr}`;
      if (s.hranaH) { if (r === 0) td.style.borderTop = `1px solid ${s.hranaH}`; if (r === 0 && tab.zahlavi !== false) td.style.borderBottom = `1px solid ${s.hranaH}`; if (r === tab.radky.length - 1) td.style.borderBottom = `1px solid ${s.hranaH}`; }
      if (s.ramecek) td.style.border = `1px solid ${s.ramecek}`;
      if (bunka.zar) td.style.textAlign = { l: 'left', c: 'center', r: 'right', j: 'justify' }[bunka.zar];
      if (bunka.svisle) td.style.verticalAlign = { t: 'top', m: 'middle', b: 'bottom' }[bunka.svisle];
      td.innerHTML = bunka.html || '';
      tr.append(td);
    });
    t.append(tr);
  });
  t.style.fontFamily = stackPisma(pismoObjektu(o, ctx));
  t.style.fontSize = (o.vel || 18) + 'px';
  return t;
}

// ---------------------------------------------------------------- objekty
const STINY = {
  vnejsi: 'drop-shadow(3px 3px 4px rgba(0,0,0,.4))', vnejsiMekky: 'drop-shadow(0 6px 10px rgba(0,0,0,.35))',
  perspektiva: 'drop-shadow(8px 10px 6px rgba(0,0,0,.28))', vnitrni: 'drop-shadow(0 0 1px rgba(0,0,0,.6))',
};
export const NAZVY_STINU = { vnejsi: 'Vnější: posun doprava dolů', vnejsiMekky: 'Vnější: měkký dole', perspektiva: 'Perspektiva: vpravo dole', vnitrni: 'Vnitřní: středový' };

function filtrEfektu(e, b) {
  if (!e) return '';
  const f = [];
  if (e.stin) f.push(STINY[e.stin] || STINY.vnejsi);
  if (e.zar) f.push(`drop-shadow(0 0 ${e.zarVel || 8}px ${barva(b, e.zar)})`, `drop-shadow(0 0 ${(e.zarVel || 8) / 2}px ${barva(b, e.zar)})`);
  if (e.mekke) f.push(`blur(${e.mekke}px)`);
  return f.join(' ');
}

export const WORDART = [
  { id: 'w1', nazev: 'Výplň: černá, barva textu 1; stín', styl: (b) => ({ color: b.tx, textShadow: '2px 2px 3px rgba(0,0,0,.35)' }) },
  { id: 'w2', nazev: 'Výplň: modrá, barva zvýraznění 1; stín', styl: (b) => ({ color: b.a[0], textShadow: '2px 2px 3px rgba(0,0,0,.3)' }) },
  { id: 'w3', nazev: 'Výplň: oranžová, barva zvýraznění 2; obrys: oranžová', styl: (b) => ({ color: b.a[1], WebkitTextStroke: `1px ${odstin(b.a[1], -0.3)}` }) },
  { id: 'w4', nazev: 'Výplň: bílá; obrys: modrá, barva zvýraznění 1; záře', styl: (b) => ({ color: '#fff', WebkitTextStroke: `1.5px ${b.a[0]}`, textShadow: `0 0 8px ${odstin(b.a[0], 0.5)}` }) },
  { id: 'w5', nazev: 'Přechodová výplň: modrá, barva zvýraznění 1; odraz', styl: (b) => ({ backgroundImage: `linear-gradient(180deg, ${odstin(b.a[0], 0.35)}, ${odstin(b.a[0], -0.35)})`, WebkitBackgroundClip: 'text', color: 'transparent' }) },
  { id: 'w6', nazev: 'Přechodová výplň: zlatá, barva zvýraznění 4; obrys', styl: () => ({ backgroundImage: 'linear-gradient(180deg,#fff2b3,#e8b100 50%,#a86b00)', WebkitBackgroundClip: 'text', color: 'transparent', WebkitTextStroke: '0.6px #7a4d00' }) },
  { id: 'w7', nazev: 'Vzorek: bílá; stín', styl: () => ({ color: '#fff', WebkitTextStroke: '1.4px #000', textShadow: '3px 3px 0 rgba(0,0,0,.4)' }) },
  { id: 'w8', nazev: 'Výplň: bílá; obrys: oranžová, barva zvýraznění 2; tvrdý stín', styl: (b) => ({ color: '#fff', WebkitTextStroke: `1.4px ${b.a[1]}`, textShadow: `4px 4px 0 ${b.a[1]}` }) },
  { id: 'w9', nazev: 'Duhová výplň', styl: () => ({ backgroundImage: 'linear-gradient(90deg,#e81123,#ff8c00,#fff100,#00b294,#0078d7,#8e2fbd)', WebkitBackgroundClip: 'text', color: 'transparent' }) },
  { id: 'w10', nazev: 'Výplň: šedá; vnitřní stín', styl: () => ({ color: '#7f7f7f', textShadow: '-1px -1px 0 #fff, 1px 1px 1px rgba(0,0,0,.5)' }) },
  { id: 'w11', nazev: 'Neonová záře', styl: (b) => ({ color: '#fff', textShadow: `0 0 4px #fff, 0 0 10px ${b.a[3]}, 0 0 20px ${b.a[3]}, 0 0 34px ${b.a[3]}` }) },
  { id: 'w12', nazev: 'Výplň: tmavá; 3D hloubka', styl: (b) => ({ color: b.a[0], textShadow: `1px 1px 0 ${odstin(b.a[0], -0.3)}, 2px 2px 0 ${odstin(b.a[0], -0.4)}, 3px 3px 0 ${odstin(b.a[0], -0.5)}, 4px 4px 4px rgba(0,0,0,.35)` }) },
];

/**
 * Vykreslí jeden objekt. ctx = kontextSnimku(); opts.editor = zobrazit výzvy prázdných zástupných symbolů.
 */
export function kresliObjekt(o, ctx, opts = {}) {
  const b = ctx.b;
  const obj = el('div.pr-o', { dataset: { id: o.id, typ: o.typ } });
  if (o.morf) obj.dataset.morf = o.morf;
  Object.assign(obj.style, { left: o.x + 'px', top: o.y + 'px', width: Math.max(0, o.w) + 'px', height: Math.max(0, o.h) + 'px' });
  const tr = [];
  if (o.rot) tr.push(`rotate(${o.rot}deg)`);
  if (o.flipH) tr.push('scaleX(-1)');
  if (o.flipV) tr.push('scaleY(-1)');
  if (tr.length) obj.style.transform = tr.join(' ');
  if (o.pruhlednost) obj.style.opacity = String(1 - o.pruhlednost / 100);
  const filtr = filtrEfektu(o.efekty, b);

  // ---------- tvar (a čára)
  const maTvar = o.typ === 'tvar' || (o.typ === 'text' && (o.vypln || o.obrys) && !jePrazdnyVzhled(o));
  if (o.typ === 'tvar' && jeCara(o.tvar)) {
    const sw = o.obrysW ?? 1.5;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'pr-tvar cara');
    svg.setAttribute('overflow', 'visible');
    svg.setAttribute('width', Math.max(1, o.w)); svg.setAttribute('height', Math.max(1, o.h));
    const bar = barva(b, o.obrys || 'a1');
    const id = 'sp' + o.id;
    const dash = o.obrysStyl === 'carky' ? `stroke-dasharray="${sw * 4} ${sw * 3}"` : o.obrysStyl === 'tecky' ? `stroke-dasharray="${sw} ${sw * 2}" stroke-linecap="round"` : '';
    const konec = o.tvar !== 'cara' ? `marker-end="url(#${id}k)"` : '';
    const zacatek = o.tvar === 'caraDvojSipka' ? `marker-start="url(#${id}z)"` : '';
    svg.innerHTML = `<defs><marker id="${id}k" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${bar}"/></marker><marker id="${id}z" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${bar}"/></marker></defs><line x1="0" y1="0" x2="${o.w}" y2="${o.h}" stroke="${bar}" stroke-width="${sw}" ${dash} ${konec} ${zacatek}/>`;
    if (filtr) svg.style.filter = filtr;
    obj.append(svg);
    obj.classList.add('je-cara');
    return obj;
  }
  if (maTvar) {
    const t = o.typ === 'tvar' ? o.tvar : 'obdelnik';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'pr-tvar');
    svg.setAttribute('overflow', 'visible');
    svg.setAttribute('width', Math.max(1, o.w)); svg.setAttribute('height', Math.max(1, o.h));
    const vypln = o.vypln === undefined && o.typ === 'tvar' ? 'a1' : o.vypln;
    const obrys = o.obrys === undefined && o.typ === 'tvar' ? 'a1-50' : o.obrys;
    const sw = o.obrysW ?? 1;
    let fill = !vypln || vypln === 'none' ? 'none' : barva(b, vypln);
    let defs = '';
    if (o.prechod) {
      defs = `<defs><linearGradient id="g${o.id}" x1="0" y1="0" x2="${o.prechod.uhel === 0 ? 1 : 0}" y2="${o.prechod.uhel === 0 ? 0 : 1}"><stop offset="0" stop-color="${barva(b, o.prechod[0])}"/><stop offset="1" stop-color="${barva(b, o.prechod[1])}"/></linearGradient></defs>`;
      fill = `url(#g${o.id})`;
    }
    if (o.vyplnObrazek) {
      defs += `<defs><pattern id="p${o.id}" patternUnits="objectBoundingBox" width="1" height="1"><image href="${ctx.pres.src(o.vyplnObrazek)}" width="${o.w}" height="${o.h}" preserveAspectRatio="xMidYMid slice"/></pattern></defs>`;
      fill = `url(#p${o.id})`;
    }
    const stroke = !obrys || obrys === 'none' ? 'none' : barva(b, obrys);
    const dash = o.obrysStyl === 'carky' ? ` stroke-dasharray="${sw * 4} ${sw * 3}"` : o.obrysStyl === 'tecky' ? ` stroke-dasharray="${sw} ${sw * 2}"` : '';
    svg.innerHTML = `${defs}<path d="${cestaTvaru(t, o.w, o.h)}" fill="${fill}" fill-rule="evenodd" stroke="${stroke}" stroke-width="${sw}"${dash} stroke-linejoin="round" ${o.vyplnPruhlednost ? `fill-opacity="${1 - o.vyplnPruhlednost / 100}"` : ''}/>`;
    if (filtr) svg.style.filter = filtr;
    obj.append(svg);
  }

  // ---------- obrázek
  if (o.typ === 'obrazek') {
    const img = el('img.pr-img', { src: ctx.pres.src(o.src), draggable: 'false', alt: o.alt || '' });
    const orez = o.orez;
    if (orez) Object.assign(img.style, { width: `${100 / (1 - orez.l - orez.r)}%`, height: `${100 / (1 - orez.t - orez.b)}%`, left: `${(-orez.l / (1 - orez.l - orez.r)) * 100}%`, top: `${(-orez.t / (1 - orez.t - orez.b)) * 100}%` });
    const ram = el('div.pr-img-ram', {}, img);
    if (o.obrStyl) ram.classList.add('obr-' + o.obrStyl);
    if (o.obrys && o.obrys !== 'none') ram.style.boxShadow = `inset 0 0 0 ${o.obrysW || 2}px ${barva(b, o.obrys)}`;
    if (o.zaobleni) ram.style.borderRadius = o.zaobleni + 'px';
    if (o.obrFiltr) img.style.filter = o.obrFiltr;
    if (filtr) obj.style.filter = filtr;
    obj.append(ram);
  }

  // ---------- ikona
  if (o.typ === 'ikona') {
    const s = icon(o.ikona || 'star');
    s.classList.add('pr-ikona');
    s.style.color = barva(b, o.barva || 'a1');
    if (o.plna) { s.setAttribute('fill', 'currentColor'); s.setAttribute('fill-opacity', '0.18'); }
    if (filtr) s.style.filter = filtr;
    obj.append(s);
  }

  // ---------- graf
  if (o.typ === 'graf') {
    const g = { id: o.id, ...o.graf, barvyRad: o.graf.barvyRad || b.a, pozadi: o.graf.pozadi || 'transparent', bezOkraje: true };
    const tmavy = jeTmava(b.bg) && !ctx.s?.pozadi;
    if (tmavy && !o.graf.styl) g.styl = 6;
    const d = { kategorie: o.graf.kategorie || [], rady: (o.graf.rady || []).map((r) => ({ ...r })), xHodnoty: (o.graf.kategorie || []).map((k, i) => (Number.isFinite(+k) ? +k : i + 1)) };
    const ram = el('div.pr-graf', { html: svgGrafu(g, d, Math.max(40, o.w), Math.max(30, o.h)) });
    if (tmavy) ram.querySelectorAll('svg > rect:first-of-type').forEach((r) => r.setAttribute('fill', 'transparent'));
    obj.append(ram);
  }

  // ---------- tabulka
  if (o.typ === 'tabulka') {
    obj.append(el('div.pr-tab-ram', {}, kresliTabulku(o, ctx)));
  }

  // ---------- zvuk
  if (o.typ === 'zvuk') {
    obj.append(el('div.pr-zvuk', {}, icon('music')));
  }

  // ---------- kresba perem
  if (o.typ === 'kresba') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'pr-kresba');
    svg.setAttribute('overflow', 'visible');
    svg.setAttribute('width', o.w); svg.setAttribute('height', o.h);
    svg.innerHTML = (o.tahy || []).map((t) => `<path d="M${t.body.map((p) => p.join(' ')).join('L')}" fill="none" stroke="${barva(b, t.barva)}" stroke-width="${t.sirka}" stroke-linecap="round" stroke-linejoin="round"${t.zvyr ? ' opacity=".45"' : ''}/>`).join('');
    obj.append(svg);
  }

  // ---------- text (textové pole, zástupný symbol, text ve tvaru)
  if (o.typ === 'text' || (o.typ === 'tvar' && !jeCara(o.tvar))) {
    const def = o.ph ? defPh(ctx.s, o) : null;
    const prazdny = jePrazdnyText(o.html);
    const trObd = o.typ === 'tvar' ? textovyObdelnik(o.tvar, o.w, o.h) : { x: 0, y: 0, w: o.w, h: o.h };
    const vnitrni = el('div.pr-tr');
    const ins = o.okraje || { l: 7.2, r: 7.2, t: 3.6, b: 3.6 };
    Object.assign(vnitrni.style, { left: trObd.x + 'px', top: trObd.y + 'px', width: trObd.w + 'px', height: trObd.h + 'px', padding: `${ins.t}px ${ins.r}px ${ins.b}px ${ins.l}px` });
    const svisle = o.svisle || def?.svisle || (o.typ === 'tvar' ? 'm' : o.ph === 'nadpis' ? 'm' : 't');
    vnitrni.dataset.svisle = svisle;
    if (o.svislyText || def?.svisly) vnitrni.classList.add('svisly');
    if (o.sloupce > 1) vnitrni.style.setProperty('--sloupce', o.sloupce);

    const t = el('div.pr-t');
    const nadpis = o.ph?.startsWith('nadpis');
    const zakladVel = o.vel || def?.vel || (nadpis ? 44 : o.ph === 'podtitul' ? 24 : jeTelo(o) ? 28 : 18);
    t.style.fontSize = zakladVel + 'px';
    t.style.fontFamily = stackPisma(pismoObjektu(o, ctx));
    t.style.color = o.barva ? barva(b, o.barva) : o.typ === 'tvar' ? '#FFFFFF' : def?.sedy ? mixSede(ctx.tx) : ctx.tx;
    if (o.typ === 'tvar' && !o.barva && (!o.vypln || o.vypln === 'none' || o.vypln === 'bg')) t.style.color = ctx.tx;
    const zar = o.zar || def?.zar || (o.typ === 'tvar' ? 'c' : 'l');
    t.style.textAlign = { l: 'left', c: 'center', r: 'right', j: 'justify' }[zar];
    t.style.lineHeight = String((o.radkovani || (o.ph ? 0.9 : 1)) * 1.2);
    if (def?.tucne) t.style.fontWeight = '700';
    if (o.tucne !== undefined) t.style.fontWeight = o.tucne ? '700' : '400';
    if (o.kurziva) t.style.fontStyle = 'italic';
    const dekorace = [o.podtrzeni && 'underline', o.preskrtnuti && 'line-through'].filter(Boolean).join(' ');
    if (dekorace) t.style.textDecoration = dekorace;
    const stiny = [];
    if (o.textStin || o.efektyTextu?.stin) stiny.push('1.5px 1.5px 2px rgba(0,0,0,.4)');
    if (o.efektyTextu?.zar) { const c = barva(b, o.efektyTextu.zar); const v = o.efektyTextu.zarVel || 8; stiny.push(`0 0 ${v}px ${c}`, `0 0 ${v / 2}px ${c}`); }
    if (stiny.length) t.style.textShadow = stiny.join(', ');
    if (o.textObrys) t.style.webkitTextStroke = `1px ${barva(b, o.textObrys)}`;
    if (o.rozestup) t.style.letterSpacing = o.rozestup + 'px';
    if (o.velkaPismena) t.style.textTransform = 'uppercase';
    if (jeTelo(o)) t.classList.add('telo');
    if (o.ph === 'podtitul') t.classList.add('podtitul');
    if (o.mezeraPred !== undefined) t.style.setProperty('--mezera', o.mezeraPred + 'px');
    else if (jeTelo(o)) t.style.setProperty('--mezera', '10px');
    if (o.wordart) {
      const w = WORDART.find((x) => x.id === o.wordart);
      if (w) Object.assign(t.style, w.styl(b));
      t.classList.add('wordart');
    }
    if (prazdny && opts.editor && o.ph && !opts.upravuje) {
      t.classList.add('pr-vyzva');
      t.innerHTML = `<p>${tt(o.vyzva || PROMPTY_SNIMKU[o.ph] || 'Kliknutím přidáte text')}</p>`;
      obj.classList.add('prazdny-ph');
      if (/^obsah/.test(o.ph) || o.phObrazek) obj.append(ikonyVlozeni(o.phObrazek));
    } else {
      t.innerHTML = o.html || '<p><br></p>';
    }
    oznacOdstavce(t, o);
    vnitrni.append(t);
    obj.append(vnitrni);
    if (o.ph) obj.classList.add('ph');
    if (o.rust) obj.classList.add('rust');
  }
  return obj;
}

const jePrazdnyVzhled = (o) => (!o.vypln || o.vypln === 'none') && (!o.obrys || o.obrys === 'none');
function svetlost(hex) { const [r, g, bb] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * bb; }
export const jeTmava = (hex) => /^#[0-9a-f]{6}$/i.test(hex) && svetlost(hex) < 0.4;
function mixSede(tx) { return jeTmava(tx) ? '#595959' : '#BFBFBF'; }

function ikonyVlozeni(jenObrazek) {
  const tl = (id, t, svg) => el('button.pr-ph-ik', { type: 'button', title: t, dataset: { vloz: id }, html: svg });
  const I = {
    tabulka: '<svg viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="20" fill="#fff" stroke="#8a8a8a" stroke-width="1.3"/><rect x="4" y="6" width="24" height="5" fill="#c43e1c"/><path d="M4 16h24M4 21h24M12 11v15M20 11v15" stroke="#8a8a8a"/></svg>',
    graf: '<svg viewBox="0 0 32 32"><path d="M5 27h23" stroke="#8a8a8a" stroke-width="1.3"/><rect x="7" y="15" width="5" height="12" fill="#c43e1c"/><rect x="14" y="8" width="5" height="19" fill="#ed6c47"/><rect x="21" y="18" width="5" height="9" fill="#ff8f6b"/></svg>',
    smartart: '<svg viewBox="0 0 32 32"><rect x="3" y="12" width="8" height="8" rx="1.5" fill="#4ea72e"/><rect x="12" y="12" width="8" height="8" rx="1.5" fill="#4ea72e" opacity=".8"/><rect x="21" y="12" width="8" height="8" rx="1.5" fill="#4ea72e" opacity=".6"/><path d="M11 16h1M20 16h1" stroke="#555"/></svg>',
    obrazky: '<svg viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="20" rx="2" fill="#fff" stroke="#8a8a8a" stroke-width="1.3"/><path d="M5 24l7-8 5 6 3-3 7 6" fill="#8bc3ea" stroke="#1e7ac8" stroke-width="1.1" stroke-linejoin="round"/><circle cx="21" cy="12" r="2.4" fill="#f7b500"/></svg>',
    ikony: '<svg viewBox="0 0 32 32"><path d="M16 5l3.3 6.8 7.4 1.1-5.4 5.2 1.3 7.4L16 22l-6.6 3.5 1.3-7.4-5.4-5.2 7.4-1.1z" fill="#fde7a7" stroke="#c78b00" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    zvuk: '<svg viewBox="0 0 32 32"><path d="M6 13h5l7-6v18l-7-6H6z" fill="#fff" stroke="#8a8a8a" stroke-width="1.3" stroke-linejoin="round"/><path d="M21 12a5 5 0 0 1 0 8M24 9a9 9 0 0 1 0 14" fill="none" stroke="#c43e1c" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };
  const nazvy = { tabulka: 'Vložit tabulku', graf: 'Vložit graf', smartart: 'Vložit obrázek SmartArt', obrazky: 'Obrázky', ikony: 'Vložit ikonu', zvuk: 'Vložit zvuk' };
  const ids = jenObrazek ? ['obrazky'] : ['tabulka', 'graf', 'smartart', 'obrazky', 'ikony', 'zvuk'];
  return el('div.pr-ph-ikony' + (jenObrazek ? '.jen' : ''), {}, ids.map((i) => tl(i, nazvy[i], I[i])));
}

// ---------------------------------------------------------------- snímek
export function kresliPozadi(pres, s, ctx) {
  const vrstva = el('div.pr-pozadi');
  const p = s.pozadi;
  const b = ctx.b;
  vrstva.style.background = b.bg;
  if (!p?.skrytGrafiku) {
    const dekor = ctx.motiv.dekor(b, !!ctx.r.uvodni);
    if (dekor) vrstva.innerHTML = dekor;
  }
  if (p) {
    const podklad = el('div.pr-pozadi-vypln');
    if (p.typ === 'obrazek') {
      Object.assign(podklad.style, { backgroundImage: `url("${pres.src(p.src)}")`, backgroundSize: p.dlazdice ? '160px' : 'cover', backgroundPosition: 'center', backgroundRepeat: p.dlazdice ? 'repeat' : 'no-repeat', opacity: String(1 - (p.pruhlednost || 0) / 100) });
      vrstva.style.background = b.bg;
    } else {
      podklad.style.background = prechodCss(p, b);
      if (p.pruhlednost) podklad.style.opacity = String(1 - p.pruhlednost / 100);
    }
    if (p.typ) vrstva.prepend(podklad);
    if (p.typ && p.typ !== 'obrazek') { vrstva.style.background = 'transparent'; }
    // grafika motivu leží nad výplní
    if (!p.skrytGrafiku) vrstva.append(...[...vrstva.querySelectorAll(':scope > svg')]);
  }
  return vrstva;
}

function kresliZapati(pres, s, ctx, cislo) {
  const z = pres.zapati;
  if (!z || ctx.r.id === 'uvodni' && !z.naUvodnim) return null;
  const prvky = [];
  const W = pres.velikost.w, H = pres.velikost.h;
  const k = W / 960;
  const styl = (x, zar) => ({ position: 'absolute', left: x * k + 'px', top: H - 39.5 + 'px', width: (zar === 'c' ? 324 : 216) * k + 'px', height: '28.75px', display: 'flex', alignItems: 'center', justifyContent: { l: 'flex-start', c: 'center', r: 'flex-end' }[zar], padding: '0 7px', fontSize: '12px', color: mixSede(ctx.tx), fontFamily: stackPisma(ctx.pismoTelo) });
  if (z.datum) prvky.push(el('div.pr-zap', { style: styl(66, 'l'), text: z.datumPevne ? z.datumText : cz.datumKratky(new Date()) }));
  if (z.zapati && z.text) prvky.push(el('div.pr-zap', { style: styl(318, 'c'), text: z.text }));
  if (z.cislo) prvky.push(el('div.pr-zap', { style: styl(678, 'r'), text: String(cislo) }));
  return prvky.length ? el('div.pr-zapati', {}, prvky) : null;
}

/**
 * Vykreslí snímek o rozměru velikosti prezentace. opts: { editor, upravuje: idObjektu, cislo, bezAnimaci }.
 */
export function kresliSnimek(pres, s, opts = {}) {
  const ctx = kontextSnimku(pres, s);
  const W = pres.velikost.w, H = pres.velikost.h;
  const sn = el('div.pr-sn', { dataset: { id: s.id } });
  sn.style.width = W + 'px';
  sn.style.height = H + 'px';
  sn.style.color = ctx.tx;
  promenneBarev(sn, ctx.b);
  sn.append(kresliPozadi(pres, s, ctx));
  const vrstva = el('div.pr-objekty');
  for (const o of s.objekty) {
    if (o.skryty) continue;   // skryté v podokně Výběr
    vrstva.append(kresliObjekt(o, ctx, { editor: opts.editor, upravuje: opts.upravuje === o.id }));
  }
  sn.append(vrstva);
  const zap = kresliZapati(pres, s, ctx, opts.cislo ?? pres.index(s.id) + 1);
  if (zap) sn.append(zap);
  return sn;
}

/** Po vložení do dokumentu: přizpůsobí přetékající text zástupných symbolů. */
export function poVlozeni(sn, pres, s) {
  for (const obj of sn.querySelectorAll('.pr-o')) {
    const o = s.objekty.find((x) => x.id === obj.dataset.id);
    if (o && (o.typ === 'text' || o.typ === 'tvar')) prizpusobText(obj, o);
  }
}

/** Miniatura: snímek zmenšený na šířku w (px). Vrací obal s pevnou velikostí. */
export function miniatura(pres, s, w, opts = {}) {
  const W = pres.velikost.w, H = pres.velikost.h;
  const k = w / W;
  const sn = kresliSnimek(pres, s, opts);
  sn.style.transform = `scale(${k})`;
  sn.style.transformOrigin = '0 0';
  sn.classList.add('mini');
  const obal = el('div.pr-mini', { style: { width: w + 'px', height: H * k + 'px' } }, sn);
  requestAnimationFrame(() => { if (obal.isConnected) poVlozeni(sn, pres, s); });
  return obal;
}
