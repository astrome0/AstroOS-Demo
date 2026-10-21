// AstroTabulky — vykreslení listu na canvas (buňky, mřížka, text, ohraničení, výběr, záhlaví)
//
// Kreslí se jen viditelná část. Souřadnice listu jsou v „listových“ pixelech při lupě 100 %,
// na obrazovku je převádí V (pohled) — sloupecX/řádekY + posun + lupa. Ukotvené příčky
// rozdělí plochu až na čtyři části, každá se kreslí zvlášť s vlastním ořezem.

import { klic, zKlice, MAX_R, MAX_C, pismena, obsahuje } from './adresy.js';
import { formatuj, jeChyba, obecne } from './format.js';
import { VYCHOZI_PISMO, VYCHOZI_VELIKOST, oblastDatTabulky } from './sesit.js';
import { STYLY_TABULEK, stylTabulky } from './styly.js';
import { kresliMinigraf } from './grafy.js';

export const BARVY = {
  svetle: {
    mrizka: '#E1E1E1', zahlaviPozadi: '#F5F5F5', zahlaviText: '#424242', zahlaviCara: '#D4D4D4',
    zahlaviVybrano: '#E0E0E0', zahlaviVybranoText: '#0E6A38', zahlaviPlne: '#C3E3D1', zahlaviPlneText: '#0B5A2F',
    vyberPozadi: 'rgba(0, 0, 0, 0.09)', vyber: '#107C41', ukotveni: '#A6A6A6', rohTroj: '#B7B7B7', pozadiListu: '#FFFFFF',
  },
  tmave: {
    mrizka: '#E1E1E1', zahlaviPozadi: '#2B2B2B', zahlaviText: '#D6D6D6', zahlaviCara: '#474747',
    zahlaviVybrano: '#3F3F3F', zahlaviVybranoText: '#7BD6A2', zahlaviPlne: '#2F5A43', zahlaviPlneText: '#D9F5E5',
    vyberPozadi: 'rgba(0, 0, 0, 0.09)', vyber: '#107C41', ukotveni: '#6B6B6B', rohTroj: '#6B6B6B', pozadiListu: '#FFFFFF',
  },
};

const PISMA_ZALOHA = '"Aptos Narrow", Aptos, "Segoe UI", Calibri, Arial, sans-serif';
export const zasobnik = (p) => (!p || p === VYCHOZI_PISMO ? PISMA_ZALOHA : `"${p}", ${/Courier|Consolas|Lucida Console/.test(p) ? 'monospace' : /Times|Georgia|Cambria|Palatino|Constantia/.test(p) ? 'serif' : 'sans-serif'}`);
export const pismoCanvas = (s, z = 1) => `${s?.i ? 'italic ' : ''}${s?.b ? '700 ' : ''}${((s?.vel || VYCHOZI_VELIKOST) * 4 / 3 * z).toFixed(2)}px ${zasobnik(s?.font)}`;

const siraCar = { tenka: 1, vlasova: 1, stredni: 2, tlusta: 3, dvojita: 3, tecky: 1, carky: 1, stredniCarky: 2, carkaTecka: 1 };
const dashCar = { tecky: [1, 1], carky: [3, 1], stredniCarky: [6, 2], carkaTecka: [6, 2, 1, 2], vlasova: [1, 1] };

/** Hlavní vykreslení. V = pohled (mřížka), st = stav kreslení (výběr, editace, kopie…). */
export function kresli(V) {
  const { ctx, sirka, vyska, dpr, list, S, z, barvy } = V;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.setLineDash([]);
  ctx.fillStyle = barvy.pozadiListu;
  ctx.fillRect(0, 0, sirka, vyska);

  const hw = V.zahlaviSirka, hh = V.zahlaviVyska;
  const casti = V.casti();   // [{ x, y, w, h, c1, c2, r1, r2, ox, oy }] — ox/oy = obrazovková poloha sloupce/řádku 0
  for (const p of casti) kresliCast(V, p);

  // čára ukotvení
  if (V.ukotveni) {
    ctx.fillStyle = barvy.ukotveni;
    if (V.ukotveni.r) ctx.fillRect(0, V.ukotveniY - 0.5, sirka, 1);
    if (V.ukotveni.c) ctx.fillRect(V.ukotveniX - 0.5, 0, 1, vyska);
  }
  if (list.zahlavi !== false) kresliZahlavi(V, casti);
  kresliVyber(V, casti);
}

function kresliCast(V, p) {
  const { ctx, list, S, z } = V;
  ctx.save();
  ctx.beginPath();
  ctx.rect(p.x, p.y, p.w, p.h);
  ctx.clip();

  const X = (c) => p.ox + V.sx(c) * z;
  const Y = (r) => p.oy + V.sy(r) * z;
  const W = (c) => V.sw(c) * z;
  const H = (r) => V.sh(r) * z;

  const sloupce = [];
  for (let c = p.c1; c <= p.c2; c++) if (W(c) > 0) sloupce.push(c);
  const radky = [];
  for (let r = p.r1; r <= p.r2; r++) if (H(r) > 0) radky.push(r);

  // ---------- sloučené buňky, které do části zasahují
  const sloucene = list.sloucene.filter((m) => m.r2 >= p.r1 && m.r1 <= p.r2 && m.c2 >= p.c1 && m.c1 <= p.c2);
  const vSloucene = (r, c) => sloucene.find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2);

  // ---------- 1) výplně
  const info = new Map();   // klic → { s, v, text, cf, tab }
  const zjisti = (r, c) => {
    const k = klic(r, c);
    if (info.has(k)) return info.get(k);
    const x = V.bunkaKVykresleni(r, c);
    info.set(k, x);
    return x;
  };
  for (const r of radky) {
    for (const c of sloupce) {
      const m = vSloucene(r, c);
      if (m && (r !== m.r1 || c !== m.c1)) continue;
      const x = zjisti(r, c);
      const pozadi = x.cf?.styl?.pozadi || x.s?.pozadi || x.tab?.pozadi;
      if (!pozadi) continue;
      ctx.fillStyle = pozadi;
      if (m) ctx.fillRect(X(m.c1), Y(m.r1), V.sirkaOblasti(m.c1, m.c2) * z, V.vyskaOblasti(m.r1, m.r2) * z);
      else ctx.fillRect(X(c), Y(r), W(c), H(r));
    }
  }
  // pruhy podmíněného formátu
  for (const r of radky) for (const c of sloupce) {
    const x = info.get(klic(r, c));
    if (!x?.cf?.pruh) continue;
    kresliPruh(ctx, X(c), Y(r), W(c), H(r), x.cf.pruh, z);
  }

  // ---------- 2) text: nejdřív spočítat, kam přetéká (kvůli mřížce)
  const prekryto = new Set();   // „r:c“ svislá čára za sloupcem c se nekreslí
  const texty = [];
  const sloupecPred = p.c1 > 0 ? Math.max(0, p.c1 - 30) : 0;
  for (const r of radky) {
    // buňky vlevo mimo část mohou přetékat dovnitř
    const kandidati = [];
    for (let c = sloupecPred; c < p.c1; c++) if (W(c) > 0 && (V.maObsah(r, c))) kandidati.push(c);
    for (const c of [...kandidati, ...sloupce]) {
      const m = vSloucene(r, c);
      if (m && (r !== m.r1 || c !== m.c1)) continue;
      if (!V.maObsah(r, c) && !m) continue;
      const x = zjisti(r, c);
      if (x.text === '' && !x.cf?.ikona) continue;
      texty.push(rozlozText(V, r, c, x, m, prekryto, X, Y, W, H));
    }
    // přetékání zprava doleva (text zarovnaný vpravo v buňkách za částí)
    for (let c = p.c2 + 1; c <= Math.min(MAX_C - 1, p.c2 + 12); c++) {
      if (!V.maObsah(r, c)) continue;
      const x = zjisti(r, c);
      if (x.zarovnani === 'r' && typeof x.v === 'string') texty.push(rozlozText(V, r, c, x, null, prekryto, X, Y, W, H));
      break;
    }
  }

  // ---------- 3) mřížka
  if (list.mrizka !== false) {
    ctx.fillStyle = list.barvaMrizky || V.barvy.mrizka;
    const top = Y(radky[0] ?? p.r1), bottom = radky.length ? Y(radky[radky.length - 1]) + H(radky[radky.length - 1]) : p.y + p.h;
    const left = X(sloupce[0] ?? p.c1), right = sloupce.length ? X(sloupce[sloupce.length - 1]) + W(sloupce[sloupce.length - 1]) : p.x + p.w;
    // vodorovné čáry
    for (const r of radky) {
      const y = Math.round(Y(r) + H(r)) - 0.5;
      // přerušit uvnitř sloučených buněk
      let x0 = left;
      for (const m of sloucene) {
        if (r >= m.r1 && r < m.r2) {
          const mx1 = X(m.c1), mx2 = X(m.c2) + W(m.c2);
          if (mx1 > x0) ctx.fillRect(x0, y, mx1 - x0, 1);
          x0 = Math.max(x0, mx2);
        }
      }
      if (right > x0) ctx.fillRect(x0, y, right - x0, 1);
    }
    // svislé čáry (kromě míst, kde přetéká text)
    for (const c of sloupce) {
      const x = Math.round(X(c) + W(c)) - 0.5;
      let y0 = top;
      for (const r of radky) {
        const skryt = prekryto.has(r + ':' + c) || sloucene.some((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c < m.c2);
        if (skryt) {
          if (Y(r) > y0) ctx.fillRect(x, y0, 1, Y(r) - y0);
          y0 = Y(r) + H(r);
        }
      }
      if (bottom > y0) ctx.fillRect(x, y0, 1, bottom - y0);
    }
  }

  // ---------- 4) text
  for (const t of texty) if (t) kresliText(ctx, t, z);

  // ---------- 5) ohraničení (buňky, styl tabulky, podmíněné)
  for (const r of radky) for (const c of sloupce) {
    const x = info.get(klic(r, c)) || (V.maStyl(r, c) ? zjisti(r, c) : null);
    const ohr = x?.s?.ohr || x?.tab?.ohr;
    if (!ohr) continue;
    const m = vSloucene(r, c);
    let x1 = X(c), y1 = Y(r), x2 = x1 + W(c), y2 = y1 + H(r);
    if (m) {
      if (r !== m.r1 || c !== m.c1) continue;
      x2 = X(m.c2) + W(m.c2); y2 = Y(m.r2) + H(m.r2);
    }
    kresliOhraniceni(ctx, ohr, x1, y1, x2, y2, z, x?.tab?.ohr && x?.s?.ohr ? x.tab.ohr : null);
  }

  // ---------- 6) značky: komentáře, poznámky, filtry, minigrafy, šipka ověření
  for (const r of radky) for (const c of sloupce) {
    const b = list.b.get(klic(r, c));
    if (b?.pozn || b?.kom) {
      const x2 = X(c) + W(c), y1 = Y(r);
      ctx.fillStyle = b.kom ? '#7B61FF' : '#E0301E';
      ctx.beginPath();
      if (b.kom) { ctx.moveTo(x2 - 7 * z, y1 + 1); ctx.lineTo(x2 - 1, y1 + 1); ctx.lineTo(x2 - 1, y1 + 7 * z); }
      else { ctx.moveTo(x2 - 6 * z, y1 + 1); ctx.lineTo(x2 - 1, y1 + 1); ctx.lineTo(x2 - 1, y1 + 6 * z); }
      ctx.closePath();
      ctx.fill();
    }
  }
  for (const m of list.minigrafy) {
    if (m.r < p.r1 || m.r > p.r2 || m.c < p.c1 || m.c > p.c2) continue;
    kresliMinigraf(ctx, V, m, X(m.c), Y(m.r), W(m.c), H(m.r), z);
  }
  kresliTlacitkaFiltru(V, p, X, Y, W, H);
  // chybové trojúhelníčky (číslo uložené jako text) — zelený roh vlevo nahoře
  if (V.kontrolaChyb) for (const r of radky) for (const c of sloupce) {
    const b = list.b.get(klic(r, c));
    if (b && typeof b.v === 'string' && !b.t && /^-?\d+([.,]\d+)?$/.test(b.v.trim()) && V.S.stylBunky(list, r, c)?.nf === '@') {
      ctx.fillStyle = '#107C41';
      ctx.beginPath(); ctx.moveTo(X(c) + 1, Y(r) + 1); ctx.lineTo(X(c) + 6 * z, Y(r) + 1); ctx.lineTo(X(c) + 1, Y(r) + 6 * z); ctx.fill();
    }
  }
  // konce stránek (Zobrazení konců stránek)
  if (V.konceStranek) kresliKonceStranek(V, p, X, Y);

  ctx.restore();
}

// ---------------------------------------------------------------- text buňky
function rozlozText(V, r, c, x, m, prekryto, X, Y, W, H) {
  const { ctx, z, list } = V;
  const s = { ...(x.tab?.pismo || {}), ...(x.s || {}), ...(x.cf?.styl || {}) };
  if (x.cf?.styl?.barva) s.barva = x.cf.styl.barva;
  let x1 = X(c), y1 = Y(r);
  let w = W(c), h = H(r);
  if (m) { w = V.sirkaOblasti(m.c1, m.c2) * z; h = V.vyskaOblasti(m.r1, m.r2) * z; }
  ctx.font = pismoCanvas(s, z);
  let text = x.text;
  const pad = 3 * z;
  const odsaz = (s.odsaz || 0) * 9 * z;
  let zar = x.zarovnani;
  const zalam = s.zalam && !m ? true : s.zalam;
  const ikona = x.cf?.ikona;
  const ikW = ikona ? 16 * z : 0;
  let clipX1 = x1, clipX2 = x1 + w;
  let tw = ctx.measureText(text).width;
  const cislo = typeof x.v === 'number' && !x.jeText;
  if (cislo && !zalam && tw + pad * 2 + ikW > w && !x.s?.zmensit) {
    // číslo se nevejde: obecný formát ubere desetinná místa, jinak ####
    if (!x.s?.nf || /^general$/i.test(x.s.nf)) {
      for (let n = 10; n >= 1 && tw + pad * 2 > w; n--) { text = obecne(x.v, n); tw = ctx.measureText(text).width; }
    }
    if (tw + pad * 2 + ikW > w) {
      const hw = ctx.measureText('#').width || 1;
      text = '#'.repeat(Math.max(1, Math.floor((w - pad) / hw)));
      tw = ctx.measureText(text).width;
    }
  }
  let meritko = 1;
  if (x.s?.zmensit && tw + pad * 2 > w) meritko = Math.max(0.3, (w - pad * 2) / tw);
  // přetékání textu do prázdných sousedů
  if (!cislo && !zalam && !m && typeof x.v === 'string' && tw + pad * 2 + odsaz > w && !s.otoc) {
    const volna = (cc) => cc >= 0 && cc < MAX_C && !V.maObsah(r, cc) && !V.sloucenaV(r, cc);
    if (zar === 'l' || zar === 'fill' || !zar) {
      let cc = c + 1, konec = x1 + w;
      while (konec < x1 + tw + pad * 2 + odsaz && volna(cc)) { prekryto.add(r + ':' + (cc - 1)); konec += W(cc); cc++; if (cc - c > 60) break; }
      clipX2 = konec;
    } else if (zar === 'r') {
      let cc = c - 1, zacatek = x1;
      while (zacatek > x1 + w - tw - pad * 2 && volna(cc)) { prekryto.add(r + ':' + cc); zacatek -= W(cc); cc--; if (c - cc > 60) break; }
      clipX1 = zacatek;
    } else if (zar === 'c') {
      const potreba = (tw + pad * 2 - w) / 2;
      let cc = c + 1, konec = x1 + w;
      while (konec < x1 + w + potreba && volna(cc)) { prekryto.add(r + ':' + (cc - 1)); konec += W(cc); cc++; if (cc - c > 30) break; }
      cc = c - 1; let zacatek = x1;
      while (zacatek > x1 - potreba && volna(cc)) { prekryto.add(r + ':' + cc); zacatek -= W(cc); cc--; if (c - cc > 30) break; }
      clipX1 = zacatek; clipX2 = konec;
    }
  }
  // zalamování
  let radky = [text];
  const vyskaRadku = (s.vel || VYCHOZI_VELIKOST) * 4 / 3 * 1.22 * z;
  if (zalam) radky = zalomit(ctx, text, w - pad * 2 - odsaz);
  else if (text.includes('\n')) radky = text.split('\n');
  return {
    text, radky, s, x1, y1, w, h, clipX1, clipX2, zar, vAlign: s.v || 'b', pad, odsaz, vyskaRadku, meritko, tw,
    font: ctx.font, barva: x.barvaFormatu || s.barva || x.tab?.pismo?.barva || '#000000', ikona, ikW,
    podtrzeni: s.u || x.odkaz, preskrtnuti: s.st, odkaz: x.odkaz, otoc: s.otoc, vyplnit: zar === 'fill',
  };
}

export function zalomit(ctx, text, sirka) {
  const out = [];
  for (const odst of String(text).split('\n')) {
    const slova = odst.split(/(\s+)/);
    let akt = '';
    for (const sl of slova) {
      const zkus = akt + sl;
      if (ctx.measureText(zkus.trimEnd()).width <= sirka || !akt.trim()) {
        if (ctx.measureText(zkus).width > sirka && !akt.trim() && sl.trim()) {
          // dlouhé slovo rozdělit po znacích
          let kus = '';
          for (const ch of sl) { if (ctx.measureText(kus + ch).width > sirka && kus) { out.push(kus); kus = ''; } kus += ch; }
          akt = kus;
        } else akt = zkus;
      } else { out.push(akt.trimEnd()); akt = sl.trimStart(); }
    }
    out.push(akt.trimEnd());
  }
  return out;
}

function kresliText(ctx, t, z) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(t.clipX1, t.y1, t.clipX2 - t.clipX1, t.h);
  ctx.clip();
  ctx.font = t.font;
  ctx.fillStyle = t.barva;
  ctx.textAlign = 'left';
  const n = t.radky.length;
  const celkem = n * t.vyskaRadku;
  let y0;
  if (t.vAlign === 't') y0 = t.y1 + 2 * z;
  else if (t.vAlign === 'm' || t.vAlign === 'j') y0 = t.y1 + (t.h - celkem) / 2;
  else y0 = t.y1 + t.h - celkem - 1.5 * z;
  ctx.textBaseline = 'middle';
  if (t.ikona) kresliIkonuCF(ctx, t.ikona, t.x1 + 2 * z, t.y1 + t.h / 2, z);
  if (t.otoc) {
    ctx.translate(t.x1 + t.w / 2, t.y1 + t.h / 2);
    if (t.otoc === 'svisle') {
      const znaky = [...t.text];
      const vr = t.vyskaRadku * 0.85;
      znaky.forEach((ch, i) => { ctx.textAlign = 'center'; ctx.fillText(ch, 0, -((znaky.length - 1) * vr) / 2 + i * vr); });
    } else {
      ctx.rotate(-t.otoc * Math.PI / 180);
      ctx.textAlign = 'center';
      ctx.fillText(t.text, 0, 0);
    }
    ctx.restore();
    return;
  }
  t.radky.forEach((radek, i) => {
    const y = y0 + (i + 0.5) * t.vyskaRadku;
    let w = ctx.measureText(radek).width * t.meritko;
    let x;
    const vnitrniX1 = t.x1 + t.pad + t.ikW, vnitrniX2 = t.x1 + t.w - t.pad;
    if (t.zar === 'r') x = vnitrniX2 - w - t.odsaz;
    else if (t.zar === 'c' || t.zar === 'cs') x = t.x1 + (t.w - w) / 2;
    else x = vnitrniX1 + t.odsaz;
    if (t.vyplnit && w > 0) {
      // „Vyplnit“: text se opakuje přes celou šířku
      let xx = vnitrniX1;
      while (xx + w <= vnitrniX2 + 0.5) { ctx.fillText(radek, xx, y); xx += w; }
      return;
    }
    if (t.zar === 'j' && i < t.radky.length - 1 && t.radky.length > 1) {
      const slova = radek.split(' ');
      const bez = slova.reduce((s, sl) => s + ctx.measureText(sl).width, 0);
      const mezera = slova.length > 1 ? (t.w - t.pad * 2 - bez) / (slova.length - 1) : 0;
      let xx = vnitrniX1;
      for (const sl of slova) { ctx.fillText(sl, xx, y); xx += ctx.measureText(sl).width + mezera; }
      return;
    }
    if (t.meritko !== 1) {
      ctx.save(); ctx.translate(x, y); ctx.scale(t.meritko, t.meritko); ctx.fillText(radek, 0, 0); ctx.restore();
    } else ctx.fillText(radek, x, y);
    if (t.podtrzeni || t.preskrtnuti) {
      ctx.fillStyle = t.barva;
      const tl = Math.max(1, z);
      if (t.podtrzeni) {
        const uy = y + t.vyskaRadku * 0.34;
        ctx.fillRect(x, Math.round(uy), w, tl);
        if (t.podtrzeni === 'd') ctx.fillRect(x, Math.round(uy + 2 * z), w, tl);
      }
      if (t.preskrtnuti) ctx.fillRect(x, Math.round(y), w, tl);
    }
  });
  ctx.restore();
}

function kresliOhraniceni(ctx, ohr, x1, y1, x2, y2, z) {
  const strana = (k, ax, ay, bx, by) => {
    const car = ohr[k];
    if (!car) return;
    const sirka = siraCar[car.s] || 1;
    ctx.strokeStyle = car.b || '#000000';
    ctx.lineWidth = sirka === 3 && car.s === 'dvojita' ? 1 : sirka;
    ctx.setLineDash((dashCar[car.s] || []).map((d) => d * z));
    const off = (sirka % 2 ? 0.5 : 0);
    const svisla = ax === bx;
    const posun = svisla ? Math.round(ax) - off : Math.round(ay) - off;
    if (car.s === 'dvojita') {
      for (const d of [-1, 1]) {
        ctx.beginPath();
        if (svisla) { ctx.moveTo(posun + d, ay - 1); ctx.lineTo(posun + d, by + 1); }
        else { ctx.moveTo(ax - 1, posun + d); ctx.lineTo(bx + 1, posun + d); }
        ctx.stroke();
      }
      return;
    }
    ctx.beginPath();
    if (svisla) { ctx.moveTo(posun, ay - (sirka > 1 ? 1 : 0)); ctx.lineTo(posun, by + (sirka > 1 ? 1 : 0)); }
    else { ctx.moveTo(ax - (sirka > 1 ? 1 : 0), posun); ctx.lineTo(bx + (sirka > 1 ? 1 : 0), posun); }
    ctx.stroke();
  };
  ctx.save();
  strana('t', x1, y1, x2, y1);
  strana('b', x1, y2, x2, y2);
  strana('l', x1, y1, x1, y2);
  strana('r', x2, y1, x2, y2);
  if (ohr.dd) { const c = ohr.dd; ctx.strokeStyle = c.b || '#000'; ctx.lineWidth = siraCar[c.s] || 1; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  if (ohr.du) { const c = ohr.du; ctx.strokeStyle = c.b || '#000'; ctx.lineWidth = siraCar[c.s] || 1; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x1, y2); ctx.lineTo(x2, y1); ctx.stroke(); }
  ctx.restore();
}

function kresliPruh(ctx, x, y, w, h, p, z) {
  const px = x + 2 * z, pw = w - 4 * z, py = y + 2 * z, ph = h - 4 * z;
  const a = px + pw * p.od, b = px + pw * p.do;
  if (b - a < 0.5) return;
  const barva = p.zaporny ? '#FF0000' : p.barva;
  if (p.plny) ctx.fillStyle = barva + 'CC';
  else {
    const g = ctx.createLinearGradient(p.zaporny ? b : a, 0, p.zaporny ? a : b, 0);
    g.addColorStop(0, barva);
    g.addColorStop(1, barva + '18');
    ctx.fillStyle = g;
  }
  ctx.fillRect(a, py, b - a, ph);
  ctx.strokeStyle = barva;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(a) + 0.5, Math.round(py) + 0.5, Math.max(0, Math.round(b - a) - 1), Math.round(ph) - 1);
  if (p.nula > 0 && p.nula < 1) {
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.moveTo(Math.round(px + pw * p.nula) + 0.5, py); ctx.lineTo(Math.round(px + pw * p.nula) + 0.5, py + ph); ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function kresliIkonuCF(ctx, ik, x, cy, z) {
  const s = 12 * z;
  const y = cy - s / 2;
  const sada = ik.sada;
  ctx.save();
  if (/^sipky/.test(sada)) {
    const barvy = ik.n === 3 ? ['#63BE7B', '#FFB628', '#F8696B'] : ik.n === 4 ? ['#63BE7B', '#FFB628', '#FFB628', '#F8696B'] : ['#63BE7B', '#9BCB5E', '#FFB628', '#F6964C', '#F8696B'];
    const uhly = ik.n === 3 ? [-90, 0, 90] : ik.n === 4 ? [-90, -45, 45, 90] : [-90, -45, 0, 45, 90];
    ctx.fillStyle = barvy[ik.i];
    ctx.translate(x + s / 2, cy);
    ctx.rotate(uhly[ik.i] * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(s / 2, 0); ctx.lineTo(0, -s / 2); ctx.lineTo(0, -s / 5); ctx.lineTo(-s / 2, -s / 5); ctx.lineTo(-s / 2, s / 5); ctx.lineTo(0, s / 5); ctx.lineTo(0, s / 2);
    ctx.closePath(); ctx.fill();
  } else if (/^semafor/.test(sada)) {
    ctx.fillStyle = ['#63BE7B', '#FFD84D', '#F8696B', '#3F3F3F'][ik.i] || '#999';
    ctx.beginPath(); ctx.arc(x + s / 2, cy, s / 2, 0, Math.PI * 2); ctx.fill();
  } else if (/^vlajky/.test(sada)) {
    ctx.fillStyle = ['#63BE7B', '#FFD84D', '#F8696B'][ik.i];
    ctx.fillRect(x + 2 * z, y, 1.2 * z, s);
    ctx.beginPath(); ctx.moveTo(x + 3 * z, y); ctx.lineTo(x + s, y + s / 4); ctx.lineTo(x + 3 * z, y + s / 2); ctx.fill();
  } else if (/^hvezdy/.test(sada)) {
    const plna = [1, 0.5, 0][ik.i];
    ctx.translate(x + s / 2, cy);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? s / 4.5 : s / 2; const a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.strokeStyle = '#E8A200'; ctx.lineWidth = 1; ctx.stroke();
    if (plna) { ctx.save(); ctx.clip(); ctx.fillStyle = '#FFC000'; ctx.fillRect(-s / 2, -s / 2, s * plna, s); ctx.restore(); }
  } else {
    // stupně (sloupečky)
    const pocet = ik.n - ik.i;
    for (let i = 0; i < ik.n - 1; i++) {
      ctx.fillStyle = i < pocet - 1 ? '#3A7BD5' : '#C9D7EA';
      const hh = (s / (ik.n - 1)) * (i + 1);
      ctx.fillRect(x + i * (s / (ik.n - 1)), y + s - hh, s / (ik.n - 1) - 1, hh);
    }
  }
  ctx.restore();
}

function kresliTlacitkaFiltru(V, p, X, Y, W, H) {
  const { ctx, list, z } = V;
  const tlacitka = [];
  if (list.filtr && list.filtr.tlacitka !== false) {
    const o = list.filtr.oblast;
    for (let c = o.c1; c <= o.c2; c++) tlacitka.push({ r: o.r1, c, aktivni: !!list.filtr.podminky?.[c], razeni: list.filtr.razeni?.c === c ? list.filtr.razeni.vzestupne : null });
  }
  for (const t of list.tabulky) {
    if (!t.filtrTl || !t.zahlavi) continue;
    for (let c = t.oblast.c1; c <= t.oblast.c2; c++) tlacitka.push({ r: t.oblast.r1, c, aktivni: !!t.filtr?.podminky?.[c], razeni: t.filtr?.razeni?.c === c ? t.filtr.razeni.vzestupne : null });
  }
  for (const b of tlacitka) {
    if (b.r < p.r1 || b.r > p.r2 || b.c < p.c1 || b.c > p.c2 || W(b.c) <= 0 || H(b.r) <= 0) continue;
    const s = Math.min(17 * z, H(b.r) - 2);
    const x = X(b.c) + W(b.c) - s - 2 * z, y = Y(b.r) + H(b.r) - s - 2 * z;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#ABABAB';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
    ctx.fillStyle = '#444';
    const cx = x + s / 2, cy = y + s / 2;
    if (b.aktivni) {
      // trychtýř
      ctx.beginPath(); ctx.moveTo(cx - 5 * z, cy - 4 * z); ctx.lineTo(cx + 3 * z, cy - 4 * z); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + 4 * z); ctx.lineTo(cx - 2 * z, cy + 3 * z); ctx.lineTo(cx - 2 * z, cy); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 2 * z, cy + 1 * z); ctx.lineTo(cx + 6 * z, cy + 1 * z); ctx.lineTo(cx + 4 * z, cy + 3.5 * z); ctx.fill();
    } else if (b.razeni !== null) {
      ctx.beginPath(); ctx.moveTo(cx - 5 * z, cy - 1 * z); ctx.lineTo(cx - 1 * z, cy - 1 * z); ctx.lineTo(cx - 3 * z, cy + 2 * z); ctx.fill();
      ctx.fillRect(cx + 2 * z, cy - 4 * z, 1 * z, 8 * z);
      ctx.beginPath();
      if (b.razeni) { ctx.moveTo(cx + 0.5 * z, cy + 2 * z); ctx.lineTo(cx + 4.5 * z, cy + 2 * z); ctx.lineTo(cx + 2.5 * z, cy + 5 * z); }
      else { ctx.moveTo(cx + 0.5 * z, cy - 2 * z); ctx.lineTo(cx + 4.5 * z, cy - 2 * z); ctx.lineTo(cx + 2.5 * z, cy - 5 * z); }
      ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(cx - 3.5 * z, cy - 1.5 * z); ctx.lineTo(cx + 3.5 * z, cy - 1.5 * z); ctx.lineTo(cx, cy + 2 * z); ctx.closePath(); ctx.fill();
    }
  }
}

function kresliKonceStranek(V, p, X, Y) {
  const { ctx, z } = V;
  const stranky = V.stranky?.() || [];
  ctx.save();
  stranky.forEach((st, i) => {
    const x1 = X(st.c1), y1 = Y(st.r1), x2 = X(st.c2) + V.sw(st.c2) * z, y2 = Y(st.r2) + V.sh(st.r2) * z;
    ctx.font = `${Math.round(44 * z)}px "Segoe UI", sans-serif`;
    ctx.fillStyle = 'rgba(128, 128, 128, 0.28)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`Stránka ${i + 1}`, (x1 + x2) / 2, (y1 + y2) / 2);
    ctx.strokeStyle = '#2E75D6';
    ctx.lineWidth = 2;
    ctx.setLineDash(st.auto ? [6, 4] : []);
    ctx.strokeRect(x1 + 1, y1 + 1, x2 - x1 - 2, y2 - y1 - 2);
  });
  ctx.restore();
}

// ---------------------------------------------------------------- záhlaví
function kresliZahlavi(V, casti) {
  const { ctx, sirka, vyska, z, barvy, vyber } = V;
  const hw = V.zahlaviSirka, hh = V.zahlaviVyska;
  const sloupceVyb = (c) => {
    let cast = false, plne = false;
    for (const o of vyber.oblasti) if (c >= o.c1 && c <= o.c2) { cast = true; if (o.r1 === 0 && o.r2 === MAX_R - 1) plne = true; }
    return plne ? 2 : cast ? 1 : 0;
  };
  const radkyVyb = (r) => {
    let cast = false, plne = false;
    for (const o of vyber.oblasti) if (r >= o.r1 && r <= o.r2) { cast = true; if (o.c1 === 0 && o.c2 === MAX_C - 1) plne = true; }
    return plne ? 2 : cast ? 1 : 0;
  };
  ctx.font = `${Math.max(8, 11 * Math.min(1.6, Math.max(0.6, z)))}px "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  // sloupce
  ctx.fillStyle = barvy.zahlaviPozadi;
  ctx.fillRect(0, 0, sirka, hh);
  ctx.fillRect(0, 0, hw, vyska);
  for (const p of casti.filter((x) => x.y === hh || x.hlavniY)) {
    if (p.radkyJen) continue;
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x, 0, p.w, hh); ctx.clip();
    for (let c = p.c1; c <= p.c2; c++) {
      const w = V.sw(c) * z;
      if (w <= 0) {
        // skrytý sloupec: dvojitá čárka
        const x = p.ox + V.sx(c) * z;
        ctx.fillStyle = barvy.zahlaviCara; ctx.fillRect(x - 2, 2, 1, hh - 4); ctx.fillRect(x + 1, 2, 1, hh - 4);
        continue;
      }
      const x = p.ox + V.sx(c) * z;
      const vyb = sloupceVyb(c);
      if (vyb) {
        ctx.fillStyle = vyb === 2 ? barvy.zahlaviPlne : barvy.zahlaviVybrano;
        ctx.fillRect(x, 0, w, hh);
        ctx.fillStyle = barvy.vyber;
        ctx.fillRect(x, hh - 2, w, 2);
      }
      ctx.fillStyle = barvy.zahlaviCara;
      ctx.fillRect(Math.round(x + w) - 1, 0, 1, hh);
      ctx.fillStyle = vyb ? (vyb === 2 ? barvy.zahlaviPlneText : barvy.zahlaviVybranoText) : barvy.zahlaviText;
      if (vyb) ctx.font = ctx.font.replace(/^(\d)/, '600 $1');
      ctx.fillText(pismena(c), x + w / 2, hh / 2 + 0.5);
      if (vyb) ctx.font = ctx.font.replace(/^600 /, '');
    }
    ctx.restore();
  }
  // řádky
  for (const p of casti.filter((x) => x.x === hw || x.hlavniX)) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, p.y, hw, p.h); ctx.clip();
    for (let r = p.r1; r <= p.r2; r++) {
      const h = V.sh(r) * z;
      const y = p.oy + V.sy(r) * z;
      if (h <= 0) {
        ctx.fillStyle = barvy.zahlaviCara; ctx.fillRect(2, y - 2, hw - 4, 1); ctx.fillRect(2, y + 1, hw - 4, 1);
        continue;
      }
      const vyb = radkyVyb(r);
      if (vyb) {
        ctx.fillStyle = vyb === 2 ? barvy.zahlaviPlne : barvy.zahlaviVybrano;
        ctx.fillRect(0, y, hw, h);
        ctx.fillStyle = barvy.vyber;
        ctx.fillRect(hw - 2, y, 2, h);
      }
      ctx.fillStyle = barvy.zahlaviCara;
      ctx.fillRect(0, Math.round(y + h) - 1, hw, 1);
      ctx.fillStyle = vyb ? (vyb === 2 ? barvy.zahlaviPlneText : barvy.zahlaviVybranoText) : barvy.zahlaviText;
      if (h > 7) ctx.fillText(String(r + 1), hw / 2, y + h / 2 + 0.5);
    }
    ctx.restore();
  }
  // okraje záhlaví a roh
  ctx.fillStyle = barvy.zahlaviCara;
  ctx.fillRect(0, hh - 1, sirka, 1);
  ctx.fillRect(hw - 1, 0, 1, vyska);
  ctx.fillStyle = barvy.zahlaviPozadi;
  ctx.fillRect(0, 0, hw - 1, hh - 1);
  ctx.fillStyle = barvy.rohTroj;
  ctx.beginPath();
  ctx.moveTo(hw - 4, hh - 4); ctx.lineTo(hw - 4, hh - 4 - 9 * Math.min(1, z + 0.2)); ctx.lineTo(hw - 4 - 9 * Math.min(1, z + 0.2), hh - 4);
  ctx.closePath(); ctx.fill();
}

// ---------------------------------------------------------------- výběr a překryvy
function kresliVyber(V, casti) {
  const { ctx, z, barvy, vyber } = V;
  const hw = V.zahlaviSirka, hh = V.zahlaviVyska;
  ctx.save();
  ctx.beginPath();
  ctx.rect(hw, hh, V.sirka - hw, V.vyska - hh);
  ctx.clip();
  const obdelnik = (o) => V.obdelnik(o);   // obrazovkové souřadnice s ohledem na ukotvení
  const jedna = vyber.oblasti.length === 1;
  const aktivni = V.rozsirNaSloucenou({ r1: vyber.r, c1: vyber.c, r2: vyber.r, c2: vyber.c });
  // výplň výběru — aktivní buňka zůstane bez stínu (evenodd vyřízne její obdélník)
  const ra = obdelnik(aktivni);
  for (const o of vyber.oblasti) {
    if (o.r1 === o.r2 && o.c1 === o.c2 && jedna) continue;
    if (V.rozsirNaSloucenou(o) && jedna && V.rozsirNaSloucenou(o).r1 === aktivni.r1 && V.rozsirNaSloucenou(o).r2 === aktivni.r2 && V.rozsirNaSloucenou(o).c1 === aktivni.c1 && V.rozsirNaSloucenou(o).c2 === aktivni.c2) continue;
    const r = obdelnik(o);
    if (!r) continue;
    ctx.fillStyle = barvy.vyberPozadi;
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    if (ra && obsahuje(o, vyber.r, vyber.c)) ctx.rect(ra.x, ra.y, ra.w, ra.h);
    ctx.fill('evenodd');
  }
  // referenční oblasti při psaní vzorce
  for (const ref of V.odkazyEditace || []) {
    const r = obdelnik(ref.oblast);
    if (!r) continue;
    ctx.fillStyle = ref.barva + '22';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = ref.barva;
    ctx.lineWidth = 2;
    ctx.setLineDash(ref.tecky ? [4, 3] : []);
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.setLineDash([]);
    // rohové úchyty
    ctx.fillStyle = ref.barva;
    for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
  }
  // okraj výběru
  const hlavni = jedna ? vyber.oblasti[0] : null;
  if (hlavni && !V.skrytVyber) {
    const r = obdelnik(V.rozsirNaSloucenou(hlavni));
    if (r) {
      ctx.strokeStyle = barvy.vyber;
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w) - 1, Math.round(r.h) - 1);
      // úchyt vyplnění
      if (!V.editace) {
        const fx = Math.round(r.x + r.w) - 3, fy = Math.round(r.y + r.h) - 3;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(fx - 1, fy - 1, 8, 8);
        ctx.fillStyle = barvy.vyber;
        ctx.fillRect(fx, fy, 6, 6);
      }
    }
  } else if (ra) {
    ctx.strokeStyle = barvy.vyber;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(ra.x) + 0.5, Math.round(ra.y) + 0.5, Math.round(ra.w) - 1, Math.round(ra.h) - 1);
  }
  // tažení úchytu / přesun
  if (V.nahled) {
    const r = obdelnik(V.nahled.oblast);
    if (r) {
      ctx.strokeStyle = V.nahled.barva || '#6E6E6E';
      ctx.lineWidth = V.nahled.sirka || 2;
      ctx.setLineDash(V.nahled.tecky === false ? [] : [3, 2]);
      ctx.strokeRect(Math.round(r.x) + 1, Math.round(r.y) + 1, Math.round(r.w) - 2, Math.round(r.h) - 2);
      ctx.setLineDash([]);
    }
  }
  // kopírovaná oblast („pochodující mravenci“)
  if (V.kopie && V.kopie.list === V.list) {
    const r = obdelnik(V.kopie.oblast);
    if (r) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.setLineDash([]);
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      ctx.strokeStyle = barvy.vyber;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -V.mravenci;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      ctx.setLineDash([]);
    }
  }
  // šipky závislostí
  for (const s of V.sipky || []) {
    const a = obdelnik(s.z), b = obdelnik(s.do);
    if (!a || !b) continue;
    const ax = a.x + Math.min(a.w, 60) / 2, ay = a.y + Math.min(a.h, 20) / 2, bx = b.x + Math.min(b.w, 60) / 2, by = b.y + Math.min(b.h, 20) / 2;
    ctx.strokeStyle = s.barva || '#1F5FBF';
    ctx.fillStyle = s.barva || '#1F5FBF';
    ctx.lineWidth = 1.5;
    if (s.oblast) { ctx.strokeRect(a.x + 1, a.y + 1, a.w - 2, a.h - 2); }
    ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    const u = Math.atan2(by - ay, bx - ax);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 9 * Math.cos(u - 0.4), by - 9 * Math.sin(u - 0.4)); ctx.lineTo(bx - 9 * Math.cos(u + 0.4), by - 9 * Math.sin(u + 0.4)); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- data pro vykreslení buňky
/** Připraví vše, co kreslení o buňce potřebuje: text, styl, zarovnání, podmíněný formát, styl tabulky. */
export function pripravBunku(S, list, r, c, { zobrazitVzorce = false } = {}) {
  const b = list.b.get(klic(r, c));
  const s = S.stylBunky(list, r, c);
  const v = S.hodnota(list, r, c);
  let text, barvaFormatu = null, jeText = false;
  if (zobrazitVzorce && b?.f) { text = b.f; jeText = true; }
  else {
    const f = formatuj(v, s?.nf);
    text = f.text;
    barvaFormatu = f.barva || null;
  }
  let zarovnani = s?.h;
  if (!zarovnani || zarovnani === 'g') {
    if (jeText || typeof v === 'string') zarovnani = 'l';
    else if (typeof v === 'number') zarovnani = 'r';
    else if (typeof v === 'boolean' || jeChyba(v)) zarovnani = 'c';
    else zarovnani = 'l';
  }
  if (zarovnani === 'cs') zarovnani = 'c';
  const cf = list.podminene.length ? S.podmineny(list, r, c) : null;
  const t = list.tabulky.length ? list.tabulky.find((x) => r >= x.oblast.r1 && r <= x.oblast.r2 && c >= x.oblast.c1 && c <= x.oblast.c2) : null;
  const tab = t ? stylTabulky(t, r, c, S, list) : null;
  const odkaz = b?.odkaz || list.odkazyVzorcu?.get(klic(r, c)) || null;
  const out = { v, s, text, zarovnani, cf, tab, barvaFormatu, jeText, odkaz };
  if (odkaz && !s?.barva) out.barvaFormatu = '#0563C1';
  return out;
}
