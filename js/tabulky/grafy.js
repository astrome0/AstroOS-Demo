// AstroTabulky — grafy (SVG) a minigrafy v buňkách (canvas)
//
// Graf = objekt v list.grafy: { id, typ, zdroj: 'List1!$A$1:$C$6', radyVeSloupcich, x, y, w, h, nazev, legenda, … }.
// Data se čtou živě ze sešitu při každém překreslení, takže graf sleduje změny v buňkách.

import { rozeberOblast, klic } from './adresy.js';
import { formatuj, jeChyba, obecne } from './format.js';
import { MOTIV, odstin } from './styly.js';
import { parse, vyhodnot, naPole, Ref } from './vzorce.js';

export const TYPY_GRAFU = [
  { id: 'sloupcovy', nazev: 'Skupinový sloupcový', skupina: 'Sloupcový', ikona: 'grafSloupce' },
  { id: 'sloupcovySkladany', nazev: 'Skládaný sloupcový', skupina: 'Sloupcový', ikona: 'grafSloupceSkl' },
  { id: 'sloupcovy100', nazev: '100% skládaný sloupcový', skupina: 'Sloupcový', ikona: 'grafSloupceSkl' },
  { id: 'pruhovy', nazev: 'Skupinový pruhový', skupina: 'Pruhový', ikona: 'grafPruhy' },
  { id: 'pruhovySkladany', nazev: 'Skládaný pruhový', skupina: 'Pruhový', ikona: 'grafPruhy' },
  { id: 'spojnicovy', nazev: 'Spojnicový', skupina: 'Spojnicový', ikona: 'grafSpojnice' },
  { id: 'spojnicovyZnacky', nazev: 'Spojnicový se značkami', skupina: 'Spojnicový', ikona: 'grafSpojnice' },
  { id: 'plosny', nazev: 'Plošný', skupina: 'Plošný', ikona: 'grafPlosny' },
  { id: 'plosnySkladany', nazev: 'Skládaný plošný', skupina: 'Plošný', ikona: 'grafPlosny' },
  { id: 'vysecovy', nazev: 'Výsečový', skupina: 'Výsečový', ikona: 'grafVysec' },
  { id: 'prstencovy', nazev: 'Prstencový', skupina: 'Výsečový', ikona: 'grafPrstenec' },
  { id: 'bodovy', nazev: 'XY bodový', skupina: 'XY bodový', ikona: 'grafBodovy' },
  { id: 'bodovySpojnice', nazev: 'XY bodový s vyhlazenými spojnicemi', skupina: 'XY bodový', ikona: 'grafBodovy' },
  { id: 'kombinovany', nazev: 'Skupinový sloupcový – spojnicový', skupina: 'Kombinovaný', ikona: 'grafKombo' },
];

export const PALETY = {
  barevne: MOTIV.akcenty,
  barevne2: ['#0F9ED5', '#E97132', '#196B24', '#A02B93', '#4EA72E', '#156082'],
  mono1: [0, 0.3, -0.3, 0.55, -0.5, 0.75].map((k) => odstin(MOTIV.akcenty[0], k)),
  mono2: [0, 0.3, -0.3, 0.55, -0.5, 0.75].map((k) => odstin(MOTIV.akcenty[1], k)),
  mono3: [0, 0.3, -0.3, 0.55, -0.5, 0.75].map((k) => odstin(MOTIV.akcenty[2], k)),
  mono4: [0, 0.3, -0.3, 0.55, -0.5, 0.75].map((k) => odstin(MOTIV.akcenty[4], k)),
  sede: ['#404040', '#7F7F7F', '#A6A6A6', '#262626', '#BFBFBF', '#595959'],
};
export const NAZVY_PALET = { barevne: 'Barevná paleta 1', barevne2: 'Barevná paleta 2', mono1: 'Jednobarevná paleta 1', mono2: 'Jednobarevná paleta 2', mono3: 'Jednobarevná paleta 3', mono4: 'Jednobarevná paleta 4', sede: 'Šedá paleta' };

export const STYLY_GRAFU = [
  { id: 1, nazev: 'Styl 1' }, { id: 2, nazev: 'Styl 2', popisky: true, bezMrizky: true }, { id: 3, nazev: 'Styl 3', stin: true },
  { id: 4, nazev: 'Styl 4', obrys: true }, { id: 5, nazev: 'Styl 5', pozadi: '#F2F2F2' }, { id: 6, nazev: 'Styl 6', tmavy: true },
  { id: 7, nazev: 'Styl 7', prechod: true }, { id: 8, nazev: 'Styl 8', tmavy: true, prechod: true },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- data
/** Přečte oblast grafu a rozdělí ji na kategorie a řady (stejná pravidla jako Excel). */
export function dataGrafu(S, list, g) {
  const o = rozeberOblast(g.zdroj || '');
  if (!o) return { kategorie: [], rady: [] };
  const l = o.list ? S.listPodleJmena(o.list) : list;
  if (!l) return { kategorie: [], rady: [], chyba: true };
  const u = S.rozsah(l);
  const r2 = Math.min(o.r2, u.r), c2 = Math.min(o.c2, u.c);
  const hodnota = (r, c) => S.hodnota(l, r, c);
  const text = (r, c) => S.textBunky(l, r, c);
  let M = [];
  for (let r = o.r1; r <= r2; r++) {
    if (l.skryteR.has(r) || l.skryteFiltrem.has(r)) continue;
    const radek = [];
    for (let c = o.c1; c <= c2; c++) if (!l.skryteC.has(c)) radek.push({ v: hodnota(r, c), t: text(r, c), nf: S.stylBunky(l, r, c)?.nf });
    M.push(radek);
  }
  if (!M.length || !M[0].length) return { kategorie: [], rady: [] };
  if (g.radyVeSloupcich === false) M = M[0].map((_, j) => M.map((r) => r[j]));
  const jeCislo = (x) => typeof x.v === 'number';
  const prazdne = (x) => x.v === null || x.v === undefined || x.v === '';
  const bodovy = /^bodovy/.test(g.typ);
  // záhlaví: první řádek má text (mimo první sloupec) nebo je levý horní prázdný
  const hlavicka = M.length > 1 && M[0].slice(1).some((x) => typeof x.v === 'string') || (M.length > 1 && prazdne(M[0][0]) && M[0].length > 1);
  const telo = hlavicka ? M.slice(1) : M;
  // sloupec kategorií: text v prvním sloupci nebo prázdný roh
  const katSloupec = M[0].length > 1 && (telo.some((r) => typeof r[0].v === 'string') || (hlavicka && prazdne(M[0][0])) || bodovy || (telo.every((r) => jeCislo(r[0])) && (r0nf(telo) || hlavicka && prazdne(M[0][0]))));
  const kategorie = katSloupec ? telo.map((r) => r[0].t) : telo.map((_, i) => String(i + 1));
  const xHodnoty = katSloupec ? telo.map((r) => (jeCislo(r[0]) ? r[0].v : null)) : telo.map((_, i) => i + 1);
  const start = katSloupec ? 1 : 0;
  const rady = [];
  for (let j = start; j < M[0].length; j++) {
    rady.push({
      nazev: hlavicka ? M[0][j].t || `Řada${j - start + 1}` : `Řada${j - start + 1}`,
      hodnoty: telo.map((r) => (jeCislo(r[j]) ? r[j].v : null)),
      nf: telo.find((r) => r[j].nf)?.[j]?.nf,
    });
  }
  return { kategorie, rady, xHodnoty, oblast: o, list: l };
}
function r0nf(telo) { return telo.some((r) => r[0].nf && /[dmy]/.test(r[0].nf)); }

// ---------------------------------------------------------------- měřítko os
function hezkeMeritko(min, max, cil = 6) {
  if (min === max) { if (min === 0) { max = 1; } else if (min > 0) min = 0; else max = 0; }
  const rozsah = max - min;
  const hruby = rozsah / cil;
  const mocnina = 10 ** Math.floor(Math.log10(hruby));
  const n = hruby / mocnina;
  const krok = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mocnina;
  const lo = Math.floor(min / krok) * krok;
  let hi = Math.ceil(max / krok) * krok;
  if (hi === max && max !== 0 && max > 0) hi = max;
  const znacky = [];
  for (let v = lo; v <= hi + krok / 2; v += krok) znacky.push(+v.toFixed(10));
  return { lo, hi: znacky[znacky.length - 1], krok, znacky };
}

const formatOsy = (v, nf) => (nf && !/^general$/i.test(nf) ? formatuj(v, nf.replace(/;.*$/, '')).text : obecne(v, 8).replace(/(\d)(?=(\d{3})+(?!\d))/g, (m) => m));
function tisice(t) { return t.replace(/^(-?\d+)/, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')); }

// ---------------------------------------------------------------- vykreslení
/** Vrátí SVG řetězec grafu. */
export function svgGrafu(g, d, w, h) {
  const styl = STYLY_GRAFU.find((s) => s.id === (g.styl || 1)) || STYLY_GRAFU[0];
  const tmavy = styl.tmavy;
  const paleta = PALETY[g.paleta || 'barevne'] || PALETY.barevne;
  const barva = (i) => g.barvyRad?.[i] || paleta[i % paleta.length];
  const textBarva = tmavy ? '#D9D9D9' : '#595959';
  const cara = tmavy ? '#595959' : '#D9D9D9';
  const pozadi = g.pozadi || (tmavy ? '#262626' : styl.pozadi || '#FFFFFF');
  const pismo = 'font-family="Aptos Narrow, Aptos, Segoe UI, Calibri, sans-serif"';
  const popisky = g.popisky ?? styl.popisky ?? false;
  const mrizka = g.mrizka ?? !styl.bezMrizky;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${pismo}>`);
  out.push(`<defs>${d.rady.map((_, i) => `<linearGradient id="gp${g.id}${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${odstin(barva(i), 0.25)}"/><stop offset="1" stop-color="${odstin(barva(i), -0.15)}"/></linearGradient>`).join('')}
    <filter id="gs${g.id}" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-opacity=".3"/></filter></defs>`);
  out.push(`<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="${pozadi}" stroke="${g.bezOkraje ? 'none' : tmavy ? '#404040' : '#D9D9D9'}" rx="0"/>`);
  const vypln = (i) => (styl.prechod ? `url(#gp${g.id}${i})` : barva(i));
  const stin = styl.stin ? ` filter="url(#gs${g.id})"` : '';
  const obrys = styl.obrys ? ` stroke="${tmavy ? '#fff' : '#fff'}" stroke-width="1"` : '';

  // název
  let top = 10;
  const auto = d.rady.length === 1 ? d.rady[0].nazev : 'Název grafu';
  const nazev = g.nazev === undefined ? auto : g.nazev;
  if (nazev !== null && g.zobrazitNazev !== false) {
    out.push(`<text x="${w / 2}" y="${top + 16}" text-anchor="middle" font-size="18.6" fill="${textBarva}">${esc(nazev)}</text>`);
    top += 34;
  }
  if (!d.rady.length || !d.kategorie.length) {
    out.push(`<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="13" fill="${textBarva}">Graf nemá žádná data</text></svg>`);
    return out.join('');
  }
  // legenda
  const legenda = g.legenda === undefined ? (/vysec|prsten/.test(g.typ) || d.rady.length > 1 ? 'dole' : null) : g.legenda;
  const polozkyLegendy = /vysec|prsten/.test(g.typ) ? d.kategorie.map((k, i) => ({ t: k, b: barva(i) })) : d.rady.map((r, i) => ({ t: r.nazev, b: barva(i), cara: jeCarovy(g.typ, i, d) }));
  let left = 10, right = w - 10, bottom = h - 10;
  if (legenda === 'dole' || legenda === 'nahore') {
    const sirky = polozkyLegendy.map((p) => 18 + String(p.t).length * 6.6 + 12);
    const radky = [];
    let akt = [], sum = 0;
    sirky.forEach((s, i) => { if (sum + s > w - 20 && akt.length) { radky.push(akt); akt = []; sum = 0; } akt.push(i); sum += s; });
    if (akt.length) radky.push(akt);
    const vyskaLeg = radky.length * 18;
    const y0 = legenda === 'dole' ? h - 8 - vyskaLeg : top - 4;
    radky.forEach((radek, ri) => {
      const celkem = radek.reduce((s, i) => s + sirky[i], 0);
      let x = (w - celkem) / 2;
      radek.forEach((i) => {
        const p = polozkyLegendy[i];
        const y = y0 + ri * 18 + 9;
        out.push(p.cara ? `<line x1="${x}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="${p.b}" stroke-width="2.5"/>` : `<rect x="${x + 2}" y="${y - 4.5}" width="9" height="9" fill="${p.b}"/>`);
        out.push(`<text x="${x + 18}" y="${y + 4}" font-size="12" fill="${textBarva}">${esc(p.t)}</text>`);
        x += sirky[i];
      });
    });
    if (legenda === 'dole') bottom -= vyskaLeg + 6; else top += vyskaLeg + 6;
  } else if (legenda === 'vpravo' || legenda === 'vlevo') {
    const sirka = Math.min(w * 0.35, Math.max(...polozkyLegendy.map((p) => 24 + String(p.t).length * 6.6)));
    const y0 = (top + bottom) / 2 - (polozkyLegendy.length * 18) / 2;
    const x = legenda === 'vpravo' ? w - sirka - 6 : 8;
    polozkyLegendy.forEach((p, i) => {
      const y = y0 + i * 18 + 9;
      out.push(p.cara ? `<line x1="${x}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="${p.b}" stroke-width="2.5"/>` : `<rect x="${x + 2}" y="${y - 4.5}" width="9" height="9" fill="${p.b}"/>`);
      out.push(`<text x="${x + 18}" y="${y + 4}" font-size="12" fill="${textBarva}">${esc(String(p.t).slice(0, 28))}</text>`);
    });
    if (legenda === 'vpravo') right -= sirka + 10; else left += sirka + 10;
  }

  // výseč / prstenec
  if (/vysec|prsten/.test(g.typ)) {
    const hodnoty = d.rady[0].hodnoty.map((v) => (v > 0 ? v : 0));
    const suma = hodnoty.reduce((a, b) => a + b, 0) || 1;
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    const r = Math.max(10, Math.min(right - left, bottom - top) / 2 - (popisky ? 18 : 6));
    const vnitrni = g.typ === 'prstencovy' ? r * 0.5 : 0;
    let uhel = -Math.PI / 2 + ((g.otoceni || 0) * Math.PI / 180);
    hodnoty.forEach((v, i) => {
      const u = (v / suma) * Math.PI * 2;
      if (!u) return;
      const a1 = uhel, a2 = uhel + u;
      const vel = u > Math.PI ? 1 : 0;
      const p = (rr, a) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
      const cesta = u >= Math.PI * 2 - 1e-9
        ? (vnitrni ? `M${p(r, 0)}A${r},${r} 0 1 1 ${p(r, Math.PI)}A${r},${r} 0 1 1 ${p(r, 0)}M${p(vnitrni, 0)}A${vnitrni},${vnitrni} 0 1 0 ${p(vnitrni, Math.PI)}A${vnitrni},${vnitrni} 0 1 0 ${p(vnitrni, 0)}Z` : `M${cx - r},${cy}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0`)
        : vnitrni
          ? `M${p(r, a1)}A${r},${r} 0 ${vel} 1 ${p(r, a2)}L${p(vnitrni, a2)}A${vnitrni},${vnitrni} 0 ${vel} 0 ${p(vnitrni, a1)}Z`
          : `M${cx},${cy}L${p(r, a1)}A${r},${r} 0 ${vel} 1 ${p(r, a2)}Z`;
      out.push(`<path d="${cesta}" fill="${vypln(i)}" stroke="${pozadi}" stroke-width="1.5" fill-rule="evenodd"${stin} data-bod="${i}"><title>${esc(d.kategorie[i])}: ${esc(tisice(formatOsy(d.rady[0].hodnoty[i], d.rady[0].nf)))} (${Math.round(v / suma * 100)} %)</title></path>`);
      if (popisky) {
        const s = (a1 + a2) / 2;
        const rr = vnitrni ? (r + vnitrni) / 2 : r * 0.68;
        out.push(`<text x="${cx + rr * Math.cos(s)}" y="${cy + rr * Math.sin(s) + 4}" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="600">${Math.round(v / suma * 100)} %</text>`);
      }
      uhel = a2;
    });
    out.push('</svg>');
    return out.join('');
  }

  // osy
  const pruhovy = /^pruhovy/.test(g.typ);
  const skladany = /Skladany|100/.test(g.typ);
  const procenta = /100/.test(g.typ);
  const bodovy = /^bodovy/.test(g.typ);
  const n = d.kategorie.length;
  let vsechny = d.rady.flatMap((r) => r.hodnoty.filter((v) => v !== null));
  if (skladany) {
    const souc = d.kategorie.map((_, i) => d.rady.reduce((s, r) => s + Math.max(0, r.hodnoty[i] || 0), 0));
    const zap = d.kategorie.map((_, i) => d.rady.reduce((s, r) => s + Math.min(0, r.hodnoty[i] || 0), 0));
    vsechny = [...souc, ...zap];
  }
  if (procenta) vsechny = [0, 1];
  let min = Math.min(0, ...vsechny), max = Math.max(0, ...vsechny);
  if (/^spojnic|^bodov/.test(g.typ) && vsechny.length && Math.min(...vsechny) > 0) {
    const mn = Math.min(...vsechny);
    if (mn > (max - mn) * 2) min = mn - (max - mn) * 0.2;
  }
  if (g.osaMin !== undefined && g.osaMin !== null) min = g.osaMin;
  if (g.osaMax !== undefined && g.osaMax !== null) max = g.osaMax;
  const m = hezkeMeritko(min, max, Math.max(3, Math.round((pruhovy ? right - left : bottom - top) / 50)));
  const nf = procenta ? '0%' : d.rady[0]?.nf;
  const popisyHodnot = m.znacky.map((v) => tisice(formatOsy(v, nf)));
  const sirkaPopisu = Math.max(...popisyHodnot.map((t) => t.length)) * 6.4 + 8;
  const nazevY = g.nazevOsyY ? 18 : 0, nazevX = g.nazevOsyX ? 18 : 0;
  // bodový graf: osa X je číselná
  let mx = null;
  if (bodovy) {
    const xs = (d.xHodnoty || []).filter((v) => v !== null);
    mx = hezkeMeritko(Math.min(...xs, 0), Math.max(...xs, 1), 6);
  }
  const popisKat = bodovy ? mx.znacky.map((v) => tisice(formatOsy(v))) : d.kategorie;
  const nejdelsiKat = Math.max(...popisKat.map((k) => String(k).length));
  let otocit = false;
  let pl, pr, pt, pb;
  if (pruhovy) {
    pl = left + nazevY + Math.min((right - left) * 0.35, nejdelsiKat * 6.4 + 10);
    pr = right - 8; pt = top + 4; pb = bottom - 18 - nazevX;
  } else {
    pl = left + nazevY + sirkaPopisu; pr = right - 10; pt = top + 6;
    const naKategorii = (pr - pl) / Math.max(1, n);
    otocit = !bodovy && nejdelsiKat * 6.2 > naKategorii && n > 3;
    pb = bottom - nazevX - (otocit ? Math.min(70, nejdelsiKat * 4.6 + 10) : 20);
  }
  if (pb - pt < 20 || pr - pl < 20) { out.push('</svg>'); return out.join(''); }
  const hodnotaNaPix = (v) => (pruhovy ? pl + ((v - m.lo) / (m.hi - m.lo)) * (pr - pl) : pb - ((v - m.lo) / (m.hi - m.lo)) * (pb - pt));
  // mřížka a popisky osy hodnot
  m.znacky.forEach((v, i) => {
    const p = hodnotaNaPix(v);
    if (mrizka) out.push(pruhovy ? `<line x1="${p}" y1="${pt}" x2="${p}" y2="${pb}" stroke="${cara}" stroke-width="1"/>` : `<line x1="${pl}" y1="${p}" x2="${pr}" y2="${p}" stroke="${cara}" stroke-width="1"/>`);
    if (g.osy !== false) out.push(pruhovy ? `<text x="${p}" y="${pb + 14}" text-anchor="middle" font-size="11.5" fill="${textBarva}">${esc(popisyHodnot[i])}</text>` : `<text x="${pl - 6}" y="${p + 4}" text-anchor="end" font-size="11.5" fill="${textBarva}">${esc(popisyHodnot[i])}</text>`);
  });
  const nula = hodnotaNaPix(Math.max(m.lo, Math.min(m.hi, 0)));
  // osa kategorií
  if (g.osy !== false) {
    if (pruhovy) out.push(`<line x1="${nula}" y1="${pt}" x2="${nula}" y2="${pb}" stroke="${tmavy ? '#7F7F7F' : '#BFBFBF'}"/>`);
    else out.push(`<line x1="${pl}" y1="${bodovy ? pb : nula}" x2="${pr}" y2="${bodovy ? pb : nula}" stroke="${tmavy ? '#7F7F7F' : '#BFBFBF'}"/>`);
  }
  const krokKat = (pruhovy ? pb - pt : pr - pl) / Math.max(1, n);
  const stredKat = (i) => (pruhovy ? pt + krokKat * (i + 0.5) : pl + krokKat * (i + 0.5));
  if (g.osy !== false) {
    if (bodovy) {
      mx.znacky.forEach((v, i) => {
        const x = pl + ((v - mx.lo) / (mx.hi - mx.lo)) * (pr - pl);
        if (mrizka && g.mrizkaX) out.push(`<line x1="${x}" y1="${pt}" x2="${x}" y2="${pb}" stroke="${cara}"/>`);
        out.push(`<text x="${x}" y="${pb + 15}" text-anchor="middle" font-size="11.5" fill="${textBarva}">${esc(popisKat[i])}</text>`);
      });
    } else {
      const kazdy = pruhovy ? Math.max(1, Math.ceil(n / ((pb - pt) / 16))) : otocit ? Math.max(1, Math.ceil(n / ((pr - pl) / 14))) : 1;
      d.kategorie.forEach((k, i) => {
        if (i % kazdy) return;
        const s = stredKat(i);
        const t = esc(String(k).slice(0, 40));
        if (pruhovy) out.push(`<text x="${pl - 6}" y="${pt + (pb - pt) - krokKat * (i + 0.5) + 4}" text-anchor="end" font-size="11.5" fill="${textBarva}">${t}</text>`);
        else if (otocit) out.push(`<text transform="translate(${s + 4},${pb + 8}) rotate(-45)" text-anchor="end" font-size="11.5" fill="${textBarva}">${t}</text>`);
        else out.push(`<text x="${s}" y="${pb + 15}" text-anchor="middle" font-size="11.5" fill="${textBarva}">${t}</text>`);
      });
    }
  }
  if (g.nazevOsyY) out.push(`<text transform="translate(${left + 11},${(pt + pb) / 2}) rotate(-90)" text-anchor="middle" font-size="13" fill="${textBarva}">${esc(g.nazevOsyY)}</text>`);
  if (g.nazevOsyX) out.push(`<text x="${(pl + pr) / 2}" y="${bottom - 4}" text-anchor="middle" font-size="13" fill="${textBarva}">${esc(g.nazevOsyX)}</text>`);

  const popisek = (x, y, v, nfR, anchor = 'middle') => popisky && v !== null ? `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" fill="${textBarva}">${esc(tisice(formatOsy(v, procenta ? null : nfR)))}</text>` : '';
  const titulek = (ri, i) => `<title>Řada „${esc(d.rady[ri].nazev)}“ Bod „${esc(d.kategorie[i])}“\nHodnota: ${esc(tisice(formatOsy(d.rady[ri].hodnoty[i], d.rady[ri].nf)))}</title>`;

  // sloupce / pruhy
  const sloupcoveRady = d.rady.map((r, i) => i).filter((i) => g.typ === 'kombinovany' ? i < Math.max(1, d.rady.length - 1) : /^sloup|^pruh/.test(g.typ));
  if (sloupcoveRady.length) {
    const mezera = (g.sirkaMezery ?? 219) / 100;
    const pocet = skladany ? 1 : sloupcoveRady.length;
    const sirka = krokKat / (pocet + mezera);
    const kladne = new Array(n).fill(0), zaporne = new Array(n).fill(0);
    const souc = d.kategorie.map((_, i) => d.rady.reduce((s, r) => s + Math.abs(r.hodnoty[i] || 0), 0) || 1);
    sloupcoveRady.forEach((ri, j) => {
      const r = d.rady[ri];
      r.hodnoty.forEach((v, i) => {
        if (v === null) return;
        let a, b;
        let hv = procenta ? v / souc[i] : v;
        if (skladany) {
          if (hv >= 0) { a = kladne[i]; b = kladne[i] + hv; kladne[i] = b; } else { a = zaporne[i]; b = zaporne[i] + hv; zaporne[i] = b; }
        } else { a = 0; b = hv; }
        const pa = hodnotaNaPix(Math.max(m.lo, Math.min(m.hi, a))), pbb = hodnotaNaPix(Math.max(m.lo, Math.min(m.hi, b)));
        const off = skladany ? 0 : j;
        if (pruhovy) {
          const y = pt + (pb - pt) - krokKat * (i + 1) + krokKat * (mezera / 2) / (pocet + mezera) + sirka * off;
          const yy = pt + (pb - pt) - (krokKat * i) - krokKat / 2 - (sirka * pocet) / 2 + sirka * off;
          out.push(`<rect x="${Math.min(pa, pbb)}" y="${yy}" width="${Math.abs(pbb - pa)}" height="${sirka}" fill="${vypln(ri)}"${stin}${obrys} data-rada="${ri}">${titulek(ri, i)}</rect>`);
          out.push(popisek(Math.max(pa, pbb) + 4, yy + sirka / 2 + 4, v, r.nf, 'start'));
        } else {
          const x = stredKat(i) - (sirka * pocet) / 2 + sirka * off;
          out.push(`<rect x="${x}" y="${Math.min(pa, pbb)}" width="${sirka}" height="${Math.abs(pbb - pa)}" fill="${vypln(ri)}"${stin}${obrys} data-rada="${ri}">${titulek(ri, i)}</rect>`);
          out.push(popisek(x + sirka / 2, skladany ? (pa + pbb) / 2 + 4 : Math.min(pa, pbb) - 5, v, r.nf));
        }
      });
    });
  }
  // plochy
  if (/^plosny/.test(g.typ)) {
    const zaklad = new Array(n).fill(0);
    const vrstvy = [];
    d.rady.forEach((r, ri) => {
      const horni = r.hodnoty.map((v, i) => (skladany ? zaklad[i] + (v || 0) : v || 0));
      const dolni = skladany ? [...zaklad] : new Array(n).fill(0);
      vrstvy.push({ ri, horni, dolni });
      if (skladany) horni.forEach((v, i) => { zaklad[i] = v; });
    });
    const x = (i) => (n === 1 ? (pl + pr) / 2 : pl + (i / (n - 1)) * (pr - pl));
    (skladany ? vrstvy : [...vrstvy]).forEach(({ ri, horni, dolni }) => {
      const body = horni.map((v, i) => `${x(i)},${hodnotaNaPix(v)}`).join(' ');
      const zpet = dolni.map((v, i) => `${x(i)},${hodnotaNaPix(v)}`).reverse().join(' ');
      out.push(`<polygon points="${body} ${zpet}" fill="${vypln(ri)}" fill-opacity="${skladany ? 1 : 0.85}"${stin} data-rada="${ri}"><title>${esc(d.rady[ri].nazev)}</title></polygon>`);
    });
  }
  // spojnice
  const carove = d.rady.map((r, i) => i).filter((i) => jeCarovy(g.typ, i, d));
  if (carove.length && !bodovy) {
    const x = (i) => (/^plosny/.test(g.typ) ? (n === 1 ? (pl + pr) / 2 : pl + (i / (n - 1)) * (pr - pl)) : stredKat(i));
    carove.forEach((ri) => {
      const r = d.rady[ri];
      let cesta = '', kresli = false;
      r.hodnoty.forEach((v, i) => {
        if (v === null) { kresli = false; return; }
        cesta += `${kresli ? 'L' : 'M'}${x(i)},${hodnotaNaPix(v)}`;
        kresli = true;
      });
      out.push(`<path d="${cesta}" fill="none" stroke="${barva(ri)}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"${stin} data-rada="${ri}"/>`);
      const znacky = g.typ === 'spojnicovyZnacky' || g.znacky;
      r.hodnoty.forEach((v, i) => {
        if (v === null) return;
        if (znacky) out.push(`<circle cx="${x(i)}" cy="${hodnotaNaPix(v)}" r="3.6" fill="${barva(ri)}" stroke="${pozadi}" stroke-width="1">${titulek(ri, i)}</circle>`);
        else out.push(`<circle cx="${x(i)}" cy="${hodnotaNaPix(v)}" r="6" fill="transparent">${titulek(ri, i)}</circle>`);
        out.push(popisek(x(i), hodnotaNaPix(v) - 8, v, r.nf));
      });
    });
  }
  // bodový
  if (bodovy) {
    const X = (v) => pl + ((v - mx.lo) / (mx.hi - mx.lo)) * (pr - pl);
    d.rady.forEach((r, ri) => {
      const body = r.hodnoty.map((v, i) => [d.xHodnoty[i], v]).filter(([a, b]) => a !== null && b !== null);
      if (g.typ === 'bodovySpojnice' && body.length > 1) {
        const s = [...body].sort((a, b) => a[0] - b[0]);
        let cesta = `M${X(s[0][0])},${hodnotaNaPix(s[0][1])}`;
        for (let i = 1; i < s.length; i++) {
          const [x0, y0] = [X(s[i - 1][0]), hodnotaNaPix(s[i - 1][1])], [x1, y1] = [X(s[i][0]), hodnotaNaPix(s[i][1])];
          const k = (x1 - x0) / 3;
          cesta += `C${x0 + k},${y0} ${x1 - k},${y1} ${x1},${y1}`;
        }
        out.push(`<path d="${cesta}" fill="none" stroke="${barva(ri)}" stroke-width="2.4"/>`);
      }
      for (const [xv, yv] of body) out.push(`<circle cx="${X(xv)}" cy="${hodnotaNaPix(yv)}" r="4" fill="${barva(ri)}"><title>(${esc(obecne(xv))}; ${esc(obecne(yv))})</title></circle>`);
      if (g.trend && body.length > 1) {
        const mxv = body.reduce((s, b) => s + b[0], 0) / body.length, myv = body.reduce((s, b) => s + b[1], 0) / body.length;
        let sxy = 0, sxx = 0;
        for (const [a, b] of body) { sxy += (a - mxv) * (b - myv); sxx += (a - mxv) ** 2; }
        const k = sxx ? sxy / sxx : 0, q = myv - k * mxv;
        out.push(`<line x1="${X(mx.lo)}" y1="${hodnotaNaPix(k * mx.lo + q)}" x2="${X(mx.hi)}" y2="${hodnotaNaPix(k * mx.hi + q)}" stroke="${barva(ri)}" stroke-width="1.5" stroke-dasharray="5 3"/>`);
      }
    });
  } else if (g.trend && d.rady.length) {
    // lineární spojnice trendu pro první řadu
    const hv = d.rady[0].hodnoty;
    const body = hv.map((v, i) => [i, v]).filter(([, v]) => v !== null);
    if (body.length > 1) {
      const mxv = body.reduce((s, b) => s + b[0], 0) / body.length, myv = body.reduce((s, b) => s + b[1], 0) / body.length;
      let sxy = 0, sxx = 0;
      for (const [a, b] of body) { sxy += (a - mxv) * (b - myv); sxx += (a - mxv) ** 2; }
      const k = sxx ? sxy / sxx : 0, q = myv - k * mxv;
      if (!pruhovy) out.push(`<line x1="${stredKat(0)}" y1="${hodnotaNaPix(q)}" x2="${stredKat(n - 1)}" y2="${hodnotaNaPix(k * (n - 1) + q)}" stroke="${odstin(barva(0), -0.3)}" stroke-width="1.8" stroke-dasharray="6 4"/>`);
    }
  }
  out.push('</svg>');
  return out.join('');
}

function jeCarovy(typ, i, d) {
  if (/^spojnic/.test(typ)) return true;
  if (typ === 'kombinovany') return i === d.rady.length - 1 && d.rady.length > 1;
  return false;
}

/** Excel doporučí graf podle tvaru dat. */
export function doporuceneGrafy(d) {
  const out = [];
  const n = d.kategorie.length, rady = d.rady.length;
  const casova = d.kategorie.some((k) => /\d{1,2}\.\s?\d{1,2}\.|leden|únor|březen|Q\d|\b20\d\d\b/i.test(k));
  out.push('sloupcovy');
  if (casova || n > 8) out.unshift('spojnicovy');
  if (rady === 1 && n <= 8) out.push('vysecovy');
  if (rady > 1) out.push('sloupcovySkladany');
  out.push('pruhovy');
  if (rady >= 1 && d.xHodnoty?.every((x) => typeof x === 'number')) out.push('bodovy');
  if (rady > 1) out.push('kombinovany');
  out.push('plosny');
  return [...new Set(out)];
}

// ---------------------------------------------------------------- minigrafy
export function kresliMinigraf(ctx, V, m, x, y, w, h, z) {
  let hodnoty;
  try {
    const s = parse('=' + m.zdroj);
    const v = vyhodnot(s, { S: V.S.S, list: V.list, r: m.r, c: m.c });
    hodnoty = (v instanceof Ref ? naPole(v, { S: V.S.S, list: V.list, r: m.r, c: m.c }) : Array.isArray(v) ? v : [[v]]).flat().map((q) => (typeof q === 'number' ? q : null));
  } catch { return; }
  const cisla = hodnoty.filter((q) => q !== null);
  if (!cisla.length) return;
  const pad = 3 * z;
  const x1 = x + pad, x2 = x + w - pad, y1 = y + pad, y2 = y + h - pad;
  const min = Math.min(...cisla, m.typ === 'sloupec' || m.typ === 'ztrata' ? 0 : Infinity), max = Math.max(...cisla, m.typ === 'sloupec' ? 0 : -Infinity);
  const Y = (v) => (max === min ? (y1 + y2) / 2 : y2 - ((v - min) / (max - min)) * (y2 - y1));
  const barva = m.barva || '#156082';
  ctx.save();
  if (m.typ === 'cara' || !m.typ) {
    ctx.strokeStyle = barva;
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let prvni = true;
    hodnoty.forEach((v, i) => {
      if (v === null) { prvni = true; return; }
      const xx = hodnoty.length === 1 ? (x1 + x2) / 2 : x1 + (i / (hodnoty.length - 1)) * (x2 - x1);
      if (prvni) ctx.moveTo(xx, Y(v)); else ctx.lineTo(xx, Y(v));
      prvni = false;
    });
    ctx.stroke();
    const bod = (i, b) => { const v = hodnoty[i]; const xx = x1 + (i / Math.max(1, hodnoty.length - 1)) * (x2 - x1); ctx.fillStyle = b; ctx.beginPath(); ctx.arc(xx, Y(v), 2.2 * z, 0, Math.PI * 2); ctx.fill(); };
    if (m.body?.max !== false) bod(hodnoty.indexOf(Math.max(...cisla)), '#C00000');
    if (m.body?.min) bod(hodnoty.indexOf(Math.min(...cisla)), '#C00000');
    if (m.body?.posledni) bod(hodnoty.length - 1, barva);
  } else {
    const n = hodnoty.length;
    const sw = (x2 - x1) / n;
    hodnoty.forEach((v, i) => {
      if (v === null) return;
      const xx = x1 + i * sw + sw * 0.1;
      if (m.typ === 'ztrata') {
        const stred = (y1 + y2) / 2;
        ctx.fillStyle = v >= 0 ? barva : '#C00000';
        ctx.fillRect(xx, v >= 0 ? y1 : stred, sw * 0.8, (y2 - y1) / 2);
      } else {
        const a = Y(Math.max(0, min)), b = Y(v);
        ctx.fillStyle = v < 0 ? '#C00000' : v === Math.max(...cisla) ? odstin(barva, -0.2) : barva;
        ctx.fillRect(xx, Math.min(a, b), sw * 0.8, Math.max(1, Math.abs(b - a)));
      }
    });
  }
  ctx.restore();
}

export { klic, jeChyba };
