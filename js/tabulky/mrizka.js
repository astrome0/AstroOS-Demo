// AstroTabulky — interaktivní mřížka: geometrie, posun, výběr, editace buněk, úchyt vyplnění, schránka
//
// Plátno kreslí kresleni.js; tady je všechno kolem: převody souřadnic, myš a klávesnice,
// editor v buňce (contenteditable s obarvenými odkazy) sdílený s řádkem vzorců.

import { el } from '../util.js';
import { klic, zKlice, MAX_R, MAX_C, pismena, adresa, textOblasti, rozeberOblast, serad, obsahuje, prekryva, jmenoListuVeVzorci } from './adresy.js';
import { formatuj, jeChyba, obecne, jeDatovyFormat, jeProcentniFormat, zeSerialu } from './format.js';
import { kresli, pripravBunku, BARVY, pismoCanvas } from './kresleni.js';
import { VYCHOZI_SIRKA, VYCHOZI_VYSKA, VYCHOZI_VELIKOST, slozStyl, ChybaUpravy, michej } from './sesit.js';
import { FUNKCE, ANGLICKY, funkcePodKurzorem, rozepsaneJmeno, odkazyVeVzorci, prepniAbsolutni, syntaxe, lex, posunVzorec, upravPoPresunu } from './vzorce.js';

export const BARVY_ODKAZU = ['#2E75B6', '#C00000', '#7030A0', '#00A04B', '#C55A11', '#1B8CA6', '#BF1B85', '#7F6000'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- osa (součty šířek / výšek)
function vytvorOsu(vychozi, velikost, specialni, max) {
  const idx = [...new Set(specialni)].filter((i) => i >= 0 && i < max).sort((a, b) => a - b);
  const delty = idx.map((i) => velikost(i) - vychozi);
  const prefix = [];
  let s = 0;
  for (const d of delty) { s += d; prefix.push(s); }
  const pos = (i) => {
    let lo = 0, hi = idx.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (idx[m] < i) lo = m + 1; else hi = m; }
    return i * vychozi + (lo ? prefix[lo - 1] : 0);
  };
  return {
    pos, size: velikost,
    index(px) {
      if (px <= 0) return 0;
      let lo = 0, hi = max - 1;
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        if (pos(m) <= px) lo = m; else hi = m - 1;
      }
      // skryté (nulové) přeskočit dopředu
      while (lo < max - 1 && velikost(lo) === 0) lo++;
      return lo;
    },
  };
}

// ---------------------------------------------------------------- stříška a text v contenteditable
function caretOffset(elm) {
  const s = getSelection();
  if (!s.rangeCount || !elm.contains(s.anchorNode)) return elm.textContent.length;
  const r = s.getRangeAt(0).cloneRange();
  r.selectNodeContents(elm);
  r.setEnd(s.focusNode, s.focusOffset);
  return r.toString().length;
}
function selectionOffsets(elm) {
  const s = getSelection();
  if (!s.rangeCount || !elm.contains(s.anchorNode)) { const n = elm.textContent.length; return [n, n]; }
  const rng = s.getRangeAt(0);
  const a = document.createRange(); a.selectNodeContents(elm); a.setEnd(rng.startContainer, rng.startOffset);
  const b = document.createRange(); b.selectNodeContents(elm); b.setEnd(rng.endContainer, rng.endOffset);
  return [a.toString().length, b.toString().length];
}
function setCaret(elm, od, do_ = od) {
  const najdi = (off) => {
    const w = document.createTreeWalker(elm, NodeFilter.SHOW_TEXT);
    let n, zbyva = off;
    while ((n = w.nextNode())) {
      if (zbyva <= n.data.length) return [n, zbyva];
      zbyva -= n.data.length;
    }
    return [elm, elm.childNodes.length];
  };
  const [a, ao] = najdi(od);
  const [b, bo] = najdi(do_);
  const r = document.createRange();
  r.setStart(a, ao);
  r.setEnd(b, bo);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

/** HTML s obarvenými odkazy (jako Excel při psaní vzorce). */
function obarvi(text) {
  if (text[0] !== '=') return esc(text);
  const refs = odkazyVeVzorci(text);
  const barvy = new Map();
  let out = '', pos = 0;
  for (const x of refs) {
    const k = x.text.toUpperCase() + '|' + (x.list || '');
    if (!barvy.has(k)) barvy.set(k, BARVY_ODKAZU[barvy.size % BARVY_ODKAZU.length]);
    out += esc(text.slice(pos, x.a)) + `<span style="color:${barvy.get(k)}">${esc(text.slice(x.a, x.b))}</span>`;
    pos = x.b;
  }
  return out + esc(text.slice(pos));
}

// ---------------------------------------------------------------- mřížka
export class Mrizka {
  constructor(P) {
    this.P = P;
    this.edit = null;
    this.kopie = null;
    this.mravenci = 0;
    this.nahled = null;
    this.sipky = [];
    this.odkazyEditace = [];
    this.kontrolaChyb = true;

    this.platno = el('canvas.tb-platno');
    this.ctx = this.platno.getContext('2d');
    this.rozmer = el('div.tb-rozmer');
    this.scroll = el('div.tb-scroll', { tabindex: '-1' }, this.rozmer);
    this.objekty = el('div.tb-objekty');
    this.editor = el('div.tb-editor', { contenteditable: 'plaintext-only', spellcheck: 'false', hidden: true });
    this.klav = el('textarea.tb-klav', { 'aria-label': 'Tabulka', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false' });
    this.naseptavac = el('div.tb-naseptavac', { hidden: true });
    this.napovedaArg = el('div.tb-napoveda-arg', { hidden: true });
    this.bublina = el('div.tb-bublina', { hidden: true });
    this.poznamka = el('div.tb-poznamka-nahled', { hidden: true });
    this.chytry = el('button.tb-chytry', { type: 'button', hidden: true, title: 'Možnosti' });
    this.uzel = el('div.tb-mrizka', {}, this.platno, this.scroll, this.objekty, this.editor, this.klav, this.naseptavac, this.napovedaArg, this.bublina, this.poznamka, this.chytry);

    this.scroll.addEventListener('scroll', () => this.poPosunu());
    this.scroll.addEventListener('pointerdown', (e) => this.mysDolu(e));
    this.scroll.addEventListener('pointermove', (e) => this.mysPohyb(e));
    this.scroll.addEventListener('pointerleave', () => { this.poznamka.hidden = true; this.bublina.hidden = true; });
    this.scroll.addEventListener('dblclick', (e) => this.dvojklik(e));
    this.scroll.addEventListener('contextmenu', (e) => this.kontext(e));
    this.scroll.addEventListener('wheel', (e) => {
      if (e.ctrlKey) { e.preventDefault(); this.P.lupa(Math.max(0.1, Math.min(4, +(this.list.zoom + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2)))); }
    }, { passive: false });
    this.klav.addEventListener('keydown', (e) => this.klavesa(e));
    this.klav.addEventListener('input', () => { if (!this.edit && this.klav.value && !this.skladani) { const t = this.klav.value; this.klav.value = ''; this.zacniEditaci('zadat', t); } });
    this.klav.addEventListener('compositionstart', () => { this.skladani = true; });
    this.klav.addEventListener('compositionend', () => { this.skladani = false; const t = this.klav.value; this.klav.value = ''; if (t && !this.edit) this.zacniEditaci('zadat', t); });
    this.klav.addEventListener('copy', (e) => this.kopiruj(e, false));
    this.klav.addEventListener('cut', (e) => this.kopiruj(e, true));
    this.klav.addEventListener('paste', (e) => this.vlozUdalost(e));
    this.editor.addEventListener('input', () => this.poVstupu(this.editor));
    this.editor.addEventListener('keydown', (e) => this.klavesaEditoru(e, this.editor));
    this.editor.addEventListener('keyup', (e) => { if (/^Arrow|Home|End/.test(e.key)) this.poPohybuStrisky(this.editor, e); });
    this.editor.addEventListener('pointerup', () => this.poPohybuStrisky(this.editor));
    this.editor.addEventListener('paste', (e) => { e.preventDefault(); const t = e.clipboardData.getData('text/plain').replace(/\r?\n$/, ''); document.execCommand('insertText', false, t); });
    this.naseptavac.addEventListener('pointerdown', (e) => e.preventDefault());

    this.ro = new ResizeObserver(() => this.prekresli());
    this.ro.observe(this.uzel);
    this.mravenciTimer = setInterval(() => { if (this.kopie && document.visibilityState === 'visible') { this.mravenci = (this.mravenci + 1) % 8; this.prekresli(); } }, 90);
  }

  get S() { return this.P.S; }
  get list() { return this.S.list; }
  get vyber() { return this.list.vyber; }
  get z() { return this.list.zoom || 1; }

  znic() { this.ro.disconnect(); clearInterval(this.mravenciTimer); clearInterval(this.autoPosun); }

  // ------------------------------------------------------------ geometrie
  geometrie() {
    const list = this.list, S = this.S;
    const vysky = [...list.vysky.keys(), ...(list.vyskyAuto?.keys() || []), ...list.skryteR, ...list.skryteFiltrem];
    this.osaS = vytvorOsu(list.vychoziSirka || VYCHOZI_SIRKA, (c) => S.sirka(list, c), [...list.sirky.keys(), ...list.skryteC], MAX_C);
    this.osaR = vytvorOsu(VYCHOZI_VYSKA, (r) => this.vyskaRadku(r), vysky, MAX_R);
    const z = this.z;
    const zh = Math.min(1.6, Math.max(0.6, z));
    const w = this.scroll.clientWidth, h = this.scroll.clientHeight;
    this.sirka = w; this.vyska = h;
    const zahlavi = list.zahlavi !== false;
    this.zahlaviVyska = zahlavi ? Math.round(20 * zh) : 0;
    const uk = list.ukotveni;
    this.fr = uk?.r || 0; this.fc = uk?.c || 0;
    this.r0 = uk?.r0 || 0; this.c0 = uk?.c0 || 0;
    const odhadRadek = this.osaR.index((this.scroll.scrollTop) / z + this.osaR.pos(this.fr) + h / z) + 1;
    this.zahlaviSirka = zahlavi ? Math.round((Math.max(2, String(odhadRadek).length) * 7.2 + 14) * zh) : 0;
    this.FW = (this.osaS.pos(this.fc) - this.osaS.pos(this.c0)) * z;
    this.FH = (this.osaR.pos(this.fr) - this.osaR.pos(this.r0)) * z;
    this.x0 = this.zahlaviSirka + this.FW;
    this.y0 = this.zahlaviVyska + this.FH;
  }

  vyskaRadku(r) {
    const l = this.list;
    if (l.skryteR.has(r) || l.skryteFiltrem.has(r)) return 0;
    return l.vysky.get(r) ?? l.vyskyAuto?.get(r) ?? VYCHOZI_VYSKA;
  }

  /** Obrazovkové X levého okraje sloupce c. */
  X(c) {
    if (c < this.fc) return this.zahlaviSirka + (this.osaS.pos(c) - this.osaS.pos(this.c0)) * this.z;
    return this.x0 + (this.osaS.pos(c) - this.osaS.pos(this.fc)) * this.z - this.scroll.scrollLeft;
  }
  Y(r) {
    if (r < this.fr) return this.zahlaviVyska + (this.osaR.pos(r) - this.osaR.pos(this.r0)) * this.z;
    return this.y0 + (this.osaR.pos(r) - this.osaR.pos(this.fr)) * this.z - this.scroll.scrollTop;
  }

  sloupecNa(x) {
    if (x < this.zahlaviSirka) return -1;
    if (x < this.x0) return this.osaS.index((x - this.zahlaviSirka) / this.z + this.osaS.pos(this.c0));
    return this.osaS.index((x - this.x0 + this.scroll.scrollLeft) / this.z + this.osaS.pos(this.fc));
  }
  radekNa(y) {
    if (y < this.zahlaviVyska) return -1;
    if (y < this.y0) return this.osaR.index((y - this.zahlaviVyska) / this.z + this.osaR.pos(this.r0));
    return this.osaR.index((y - this.y0 + this.scroll.scrollTop) / this.z + this.osaR.pos(this.fr));
  }

  /** Části plochy (až čtyři kvůli ukotvení). */
  casti() {
    const out = [];
    const hw = this.zahlaviSirka, hh = this.zahlaviVyska, z = this.z;
    const sl = this.scroll.scrollLeft, st = this.scroll.scrollTop;
    const mainC1 = this.osaS.index(sl / z + this.osaS.pos(this.fc));
    const mainC2 = Math.min(MAX_C - 1, this.osaS.index((sl + this.sirka - this.x0) / z + this.osaS.pos(this.fc)) + 1);
    const mainR1 = this.osaR.index(st / z + this.osaR.pos(this.fr));
    const mainR2 = Math.min(MAX_R - 1, this.osaR.index((st + this.vyska - this.y0) / z + this.osaR.pos(this.fr)) + 1);
    const oxMain = this.x0 - this.osaS.pos(this.fc) * z - sl;
    const oyMain = this.y0 - this.osaR.pos(this.fr) * z - st;
    const oxFr = hw - this.osaS.pos(this.c0) * z;
    const oyFr = hh - this.osaR.pos(this.r0) * z;
    this.viditelne = { r1: mainR1, r2: mainR2, c1: mainC1, c2: mainC2 };
    const sloupce = [{ x: this.x0, w: this.sirka - this.x0, c1: Math.max(mainC1, this.fc), c2: mainC2, ox: oxMain, hlavni: true }];
    if (this.fc > this.c0) sloupce.unshift({ x: hw, w: this.FW, c1: this.c0, c2: this.fc - 1, ox: oxFr });
    const radky = [{ y: this.y0, h: this.vyska - this.y0, r1: Math.max(mainR1, this.fr), r2: mainR2, oy: oyMain, hlavni: true }];
    if (this.fr > this.r0) radky.unshift({ y: hh, h: this.FH, r1: this.r0, r2: this.fr - 1, oy: oyFr });
    for (const rr of radky) for (const ss of sloupce) {
      out.push({ x: ss.x, y: rr.y, w: ss.w, h: rr.h, c1: ss.c1, c2: ss.c2, r1: rr.r1, r2: rr.r2, ox: ss.ox, oy: rr.oy, hlavniX: ss.hlavni, hlavniY: rr.hlavni });
    }
    return out;
  }

  /** Obrazovkový obdélník oblasti (null když je mimo). */
  obdelnik(o) {
    if (!o) return null;
    const c2 = Math.min(o.c2, MAX_C - 1), r2 = Math.min(o.r2, MAX_R - 1);
    const vc2 = this.viditelne ? Math.min(c2, this.viditelne.c2 + 1) : c2;
    const vr2 = this.viditelne ? Math.min(r2, this.viditelne.r2 + 1) : r2;
    const x1 = this.X(o.c1), y1 = this.Y(o.r1);
    let x2 = vc2 < c2 ? this.sirka + 10 : this.X(c2) + this.osaS.size(c2) * this.z;
    let y2 = vr2 < r2 ? this.vyska + 10 : this.Y(r2) + this.osaR.size(r2) * this.z;
    // oblast začínající hluboko nad viditelnou částí
    const xx1 = Math.max(x1, o.c1 < this.fc ? this.zahlaviSirka : Math.min(x1, this.x0) === x1 && x1 < this.x0 - 2 ? this.x0 - 2 : x1);
    const yy1 = Math.max(y1, o.r1 < this.fr ? this.zahlaviVyska : y1 < this.y0 - 2 ? this.y0 - 2 : y1);
    if (x2 < this.zahlaviSirka || y2 < this.zahlaviVyska || xx1 > this.sirka || yy1 > this.vyska) return null;
    return { x: xx1, y: yy1, w: x2 - xx1, h: y2 - yy1 };
  }

  rozsirNaSloucenou(o) {
    let v = { ...o };
    for (let krok = 0; krok < 5; krok++) {
      let zmena = false;
      for (const m of this.list.sloucene) {
        if (prekryva(m, v) && (m.r1 < v.r1 || m.r2 > v.r2 || m.c1 < v.c1 || m.c2 > v.c2)) {
          v = { r1: Math.min(v.r1, m.r1), r2: Math.max(v.r2, m.r2), c1: Math.min(v.c1, m.c1), c2: Math.max(v.c2, m.c2) };
          zmena = true;
        }
      }
      if (!zmena) break;
    }
    return v;
  }

  // ------------------------------------------------------------ vykreslení
  prekresli() {
    if (this.cekaKresleni) return;
    this.cekaKresleni = requestAnimationFrame(() => { this.cekaKresleni = 0; this.kresliTed(); });
  }

  kresliTed() {
    if (!this.uzel.isConnected) return;
    this.geometrie();
    const dpr = devicePixelRatio || 1;
    const w = this.sirka, h = this.vyska;
    if (!w || !h) return;
    if (this.platno.width !== Math.round(w * dpr) || this.platno.height !== Math.round(h * dpr)) {
      this.platno.width = Math.round(w * dpr);
      this.platno.height = Math.round(h * dpr);
      this.platno.style.width = w + 'px';
      this.platno.style.height = h + 'px';
    }
    this.aktualizujRozmer();
    const S = this.S, list = this.list;
    const cache = new Map();
    const zobrazitVzorce = list.zobrazitVzorce;
    const V = {
      ctx: this.ctx, sirka: w, vyska: h, dpr, list, S, z: this.z,
      barvy: this.P.tmaveZahlavi?.() ? BARVY.tmave : BARVY.svetle,
      zahlaviSirka: this.zahlaviSirka, zahlaviVyska: this.zahlaviVyska,
      ukotveni: list.ukotveni ? { r: this.fr > this.r0, c: this.fc > this.c0 } : null,
      ukotveniX: this.x0, ukotveniY: this.y0,
      casti: () => this.casti(),
      sx: (c) => this.osaS.pos(c), sy: (r) => this.osaR.pos(r), sw: (c) => this.osaS.size(c), sh: (r) => this.osaR.size(r),
      sirkaOblasti: (c1, c2) => this.osaS.pos(c2 + 1) - this.osaS.pos(c1),
      vyskaOblasti: (r1, r2) => this.osaR.pos(r2 + 1) - this.osaR.pos(r1),
      bunkaKVykresleni: (r, c) => { const k = klic(r, c); let x = cache.get(k); if (!x) { x = pripravBunku(S, list, r, c, { zobrazitVzorce }); cache.set(k, x); } return x; },
      maObsah: (r, c) => { const b = list.b.get(klic(r, c)); return !!(b && (b.f || (b.v !== null && b.v !== undefined))) || list.presah.has(klic(r, c)); },
      maStyl: (r, c) => !!S.stylBunky(list, r, c) || list.tabulky.some((t) => obsahuje(t.oblast, r, c)),
      sloucenaV: (r, c) => S.sloucenaV(list, r, c),
      vyber: this.vyber,
      obdelnik: (o) => this.obdelnik(o),
      rozsirNaSloucenou: (o) => this.rozsirNaSloucenou(o),
      odkazyEditace: this.edit && this.edit.list === list ? this.odkazyEditace : this.edit ? this.odkazyEditace.filter((x) => x.jinyList) : [],
      editace: !!this.edit,
      nahled: this.nahled,
      kopie: this.kopie, mravenci: this.mravenci,
      sipky: this.sipky.filter((s) => s.list === list),
      kontrolaChyb: this.kontrolaChyb,
      konceStranek: this.P.st?.zobrazeni === 'konce',
      stranky: () => this.P.stranky?.() || [],
      skrytVyber: false,
    };
    kresli(V);
    this.poziceEditoru();
    this.P.poKresleni?.();
  }

  aktualizujRozmer() {
    const z = this.z;
    const u = this.S.rozsah(this.list);
    const sl = this.scroll.scrollLeft, st = this.scroll.scrollTop;
    const posledniS = Math.min(MAX_C - 1, Math.max(u.c + 2, this.vyber.c + 2, this.osaS.index(sl / z + this.osaS.pos(this.fc) + (this.sirka * 2) / z)));
    const posledniR = Math.min(MAX_R - 1, Math.max(u.r + 2, this.vyber.r + 2, this.osaR.index(st / z + this.osaR.pos(this.fr) + (this.vyska * 2) / z)));
    const w = this.x0 + (this.osaS.pos(posledniS + 1) - this.osaS.pos(this.fc)) * z;
    const h = this.y0 + (this.osaR.pos(posledniR + 1) - this.osaR.pos(this.fr)) * z;
    const ws = Math.round(w) + 'px', hs = Math.round(h) + 'px';
    if (this.rozmer.style.width !== ws) this.rozmer.style.width = ws;
    if (this.rozmer.style.height !== hs) this.rozmer.style.height = hs;
  }

  poPosunu() {
    this.list.posun = { x: this.scroll.scrollLeft, y: this.scroll.scrollTop };
    this.kresliTed();
    this.P.poPosunu?.();
  }

  /** Obnoví posun listu (přepnutí listu). */
  obnovPosun() {
    const p = this.list.posun || { x: 0, y: 0 };
    this.geometrie();
    this.aktualizujRozmer();
    this.rozmer.style.width = Math.max(parseFloat(this.rozmer.style.width) || 0, p.x + this.sirka * 2) + 'px';
    this.rozmer.style.height = Math.max(parseFloat(this.rozmer.style.height) || 0, p.y + this.vyska * 2) + 'px';
    this.scroll.scrollLeft = p.x;
    this.scroll.scrollTop = p.y;
    this.kresliTed();
  }

  /** Posune tak, aby byla buňka vidět. */
  ukazBunku(r, c) {
    this.geometrie();
    const z = this.z;
    let sl = this.scroll.scrollLeft, st = this.scroll.scrollTop;
    if (c >= this.fc) {
      const x = (this.osaS.pos(c) - this.osaS.pos(this.fc)) * z;
      const w = this.osaS.size(c) * z;
      const dostupne = this.sirka - this.x0;
      if (x < sl) sl = x;
      else if (x + w > sl + dostupne) sl = Math.max(0, x + w - dostupne);
    }
    if (r >= this.fr) {
      const y = (this.osaR.pos(r) - this.osaR.pos(this.fr)) * z;
      const h = this.osaR.size(r) * z;
      const dostupne = this.vyska - this.y0;
      if (y < st) st = y;
      else if (y + h > st + dostupne) st = Math.max(0, y + h - dostupne);
    }
    if (sl !== this.scroll.scrollLeft || st !== this.scroll.scrollTop) {
      this.rozmer.style.width = Math.max(parseFloat(this.rozmer.style.width) || 0, sl + this.sirka * 2) + 'px';
      this.rozmer.style.height = Math.max(parseFloat(this.rozmer.style.height) || 0, st + this.vyska * 2) + 'px';
      this.scroll.scrollLeft = sl;
      this.scroll.scrollTop = st;
    }
    this.prekresli();
  }

  // ------------------------------------------------------------ výběr
  nastavVyber(r, c, oblasti = null, { ukazat = true, roh = null } = {}) {
    r = Math.max(0, Math.min(MAX_R - 1, r));
    c = Math.max(0, Math.min(MAX_C - 1, c));
    const o = oblasti || [this.rozsirNaSloucenou({ r1: r, c1: c, r2: r, c2: c })];
    this.list.vyber = { r, c, oblasti: o, roh: roh || { r: o[o.length - 1].r2 === r ? o[o.length - 1].r1 : o[o.length - 1].r2, c: o[o.length - 1].c2 === c ? o[o.length - 1].c1 : o[o.length - 1].c2 } };
    if (!roh) this.list.vyber.roh = { r: o[o.length - 1].r1 === r ? o[o.length - 1].r2 : o[o.length - 1].r1, c: o[o.length - 1].c1 === c ? o[o.length - 1].c2 : o[o.length - 1].c1 };
    else this.list.vyber.roh = roh;
    this.chytry.hidden = true;
    if (ukazat) this.ukazBunku(roh ? roh.r : r, roh ? roh.c : c);
    this.prekresli();
    this.P.poZmeneVyberu?.();
  }

  /** Vybere oblast s aktivní buňkou v rohu. */
  vyberOblast(o, aktivni = null) {
    o = serad(o);
    const a = aktivni || { r: o.r1, c: o.c1 };
    this.list.vyber = { r: a.r, c: a.c, oblasti: [o], roh: { r: o.r2, c: o.c2 } };
    this.ukazBunku(a.r, a.c);
    this.prekresli();
    this.P.poZmeneVyberu?.();
  }

  /** Rozšíří poslední oblast výběru k (r, c) — aktivní buňka zůstává. */
  rozsirVyber(r, c) {
    const v = this.vyber;
    r = Math.max(0, Math.min(MAX_R - 1, r));
    c = Math.max(0, Math.min(MAX_C - 1, c));
    const o = this.rozsirNaSloucenou(serad({ r1: v.r, c1: v.c, r2: r, c2: c }));
    const oblasti = [...v.oblasti.slice(0, -1), o];
    this.list.vyber = { ...v, oblasti, roh: { r, c } };
    this.ukazBunku(r, c);
    this.prekresli();
    this.P.poZmeneVyberu?.();
  }

  get oblast() { const o = this.vyber.oblasti; return o[o.length - 1]; }

  // ------------------------------------------------------------ pohyb klávesnicí
  maHodnotu(r, c) { return r >= 0 && c >= 0 && r < MAX_R && c < MAX_C && this.S.hodnota(this.list, r, c) !== null; }

  skok(r, c, dr, dc) {
    const u = this.S.rozsah(this.list);
    const mimo = (rr, cc) => rr < 0 || cc < 0 || rr >= MAX_R || cc >= MAX_C;
    const dal = (rr, cc) => [rr + dr, cc + dc];
    let [nr, nc] = dal(r, c);
    if (mimo(nr, nc)) return [r, c];
    const skryta = (rr, cc) => (dr && this.vyskaRadku(rr) === 0) || (dc && this.S.sirka(this.list, cc) === 0);
    if (this.maHodnotu(r, c) && this.maHodnotu(nr, nc)) {
      while (!mimo(nr + dr, nc + dc) && (this.maHodnotu(nr + dr, nc + dc) || skryta(nr + dr, nc + dc))) [nr, nc] = dal(nr, nc);
      return [nr, nc];
    }
    while (!mimo(nr, nc) && !this.maHodnotu(nr, nc)) {
      if ((dr > 0 && nr > u.r) || (dc > 0 && nc > u.c)) return [dr ? MAX_R - 1 : nr, dc ? MAX_C - 1 : nc];
      [nr, nc] = dal(nr, nc);
    }
    if (mimo(nr, nc)) return [dr < 0 ? 0 : dr > 0 ? MAX_R - 1 : r, dc < 0 ? 0 : dc > 0 ? MAX_C - 1 : c];
    return [nr, nc];
  }

  dalsiViditelny(r, c, dr, dc) {
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < MAX_R && dr && this.vyskaRadku(nr) === 0) nr += dr;
    while (nc >= 0 && nc < MAX_C && dc && this.S.sirka(this.list, nc) === 0) nc += dc;
    return [Math.max(0, Math.min(MAX_R - 1, nr)), Math.max(0, Math.min(MAX_C - 1, nc))];
  }

  posunAktivni(dr, dc, { rozsirit = false, skok = false } = {}) {
    const v = this.vyber;
    if (rozsirit) {
      const roh = v.roh || { r: v.r, c: v.c };
      let [r, c] = skok ? this.skok(roh.r, roh.c, dr, dc) : this.dalsiViditelny(roh.r, roh.c, dr, dc);
      this.rozsirVyber(r, c);
      return;
    }
    // ze sloučené buňky se vyskakuje za její okraj
    const m = this.S.sloucenaV(this.list, v.r, v.c);
    let sr = v.r, sc = v.c;
    if (m) { if (dr > 0) sr = m.r2; if (dc > 0) sc = m.c2; if (dr < 0) sr = m.r1; if (dc < 0) sc = m.c1; }
    const [r, c] = skok ? this.skok(sr, sc, dr, dc) : this.dalsiViditelny(sr, sc, dr, dc);
    const m2 = this.S.sloucenaV(this.list, r, c);
    this.nastavVyber(m2 ? m2.r1 : r, m2 ? m2.c1 : c);
  }

  /** Enter/Tab uvnitř výběru — pohyb v rámci vybrané oblasti. */
  pohybVeVyberu(dr, dc) {
    const v = this.vyber;
    const o = this.oblast;
    const jedna = v.oblasti.length === 1 && o.r1 === o.r2 && o.c1 === o.c2;
    const sl = this.S.sloucenaV(this.list, v.r, v.c);
    if (jedna || (sl && o.r1 === sl.r1 && o.r2 === sl.r2 && o.c1 === sl.c1 && o.c2 === sl.c2)) {
      if (dc > 0 && this.tabStart === undefined) this.tabStart = v.c;
      if (dr && this.tabStart !== undefined) {
        // Enter po sérii Tabů se vrátí na začátek řádku (jako Excel)
        const c = this.tabStart;
        this.tabStart = undefined;
        this.nastavVyber(v.r + dr, c);
        return;
      }
      this.posunAktivni(dr, dc);
      return;
    }
    let r = v.r, c = v.c;
    for (let krok = 0; krok < 4; krok++) {
      if (dr) {
        r += dr;
        if (r > o.r2) { r = o.r1; c++; if (c > o.c2) c = o.c1; }
        if (r < o.r1) { r = o.r2; c--; if (c < o.c1) c = o.c2; }
      } else {
        c += dc;
        if (c > o.c2) { c = o.c1; r++; if (r > o.r2) r = o.r1; }
        if (c < o.c1) { c = o.c2; r--; if (r < o.r1) r = o.r2; }
      }
      if (this.vyskaRadku(r) > 0 && this.S.sirka(this.list, c) > 0) break;
    }
    this.list.vyber = { ...v, r, c };
    this.ukazBunku(r, c);
    this.prekresli();
    this.P.poZmeneVyberu?.();
  }

  // ------------------------------------------------------------ myš
  bod(e) {
    const r = this.scroll.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Co je pod myší. */
  zasah(x, y) {
    this.geometrie();
    const hw = this.zahlaviSirka, hh = this.zahlaviVyska;
    if (x > this.sirka || y > this.vyska) return { typ: 'nic' };
    if (x < hw && y < hh) return { typ: 'roh' };
    if (y < hh) {
      const c = this.sloupecNa(x);
      const xl = this.X(c), xr = xl + this.osaS.size(c) * this.z;
      if (Math.abs(x - xr) <= 4) return { typ: 'hranaS', c };
      if (Math.abs(x - xl) <= 3 && c > 0) {
        let p = c - 1;
        while (p > 0 && this.S.sirka(this.list, p) === 0 && x > xl) p--;
        return { typ: 'hranaS', c: x > xl + 1 && this.S.sirka(this.list, c - 1) === 0 ? c - 1 : c - 1 };
      }
      return { typ: 'sloupec', c };
    }
    if (x < hw) {
      const r = this.radekNa(y);
      const yt = this.Y(r), yb = yt + this.osaR.size(r) * this.z;
      if (Math.abs(y - yb) <= 3) return { typ: 'hranaR', r };
      if (Math.abs(y - yt) <= 2 && r > 0) return { typ: 'hranaR', r: r - 1 };
      return { typ: 'radek', r };
    }
    const r = this.radekNa(y), c = this.sloupecNa(x);
    // úchyt vyplnění a okraj výběru
    if (this.vyber.oblasti.length === 1 && !this.edit) {
      const o = this.obdelnik(this.rozsirNaSloucenou(this.oblast));
      if (o) {
        const fx = o.x + o.w, fy = o.y + o.h;
        if (Math.abs(x - fx) <= 5 && Math.abs(y - fy) <= 5) return { typ: 'uchyt', r, c };
        const naOkraji = (Math.abs(x - o.x) <= 3 || Math.abs(x - fx) <= 3) && y >= o.y - 3 && y <= fy + 3
          || (Math.abs(y - o.y) <= 3 || Math.abs(y - fy) <= 3) && x >= o.x - 3 && x <= fx + 3;
        if (naOkraji) return { typ: 'okraj', r, c };
      }
    }
    // tlačítko filtru
    const f = this.tlacitkoFiltru(r, c, x, y);
    if (f) return { typ: 'filtr', r, c, ...f };
    // šipka ověření dat
    if (this.sipkaOvereni && r === this.vyber.r && c === this.sipkaOvereni.c + 1 && x - this.X(c) < 18 * this.z) return { typ: 'overeni', r: this.vyber.r, c: this.vyber.c };
    return { typ: 'bunka', r, c };
  }

  tlacitkoFiltru(r, c, x, y) {
    const l = this.list;
    const hlavicky = [];
    if (l.filtr) hlavicky.push({ o: l.filtr.oblast, zdroj: 'filtr' });
    for (const t of l.tabulky) if (t.filtrTl && t.zahlavi) hlavicky.push({ o: t.oblast, zdroj: t });
    for (const h of hlavicky) {
      if (r !== h.o.r1 || c < h.o.c1 || c > h.o.c2) continue;
      const s = Math.min(17 * this.z, this.osaR.size(r) * this.z - 2);
      const bx = this.X(c) + this.osaS.size(c) * this.z - s - 2 * this.z;
      const by = this.Y(r) + this.osaR.size(r) * this.z - s - 2 * this.z;
      if (x >= bx && x <= bx + s && y >= by && y <= by + s) return { zdroj: h.zdroj, oblast: h.o, kotva: { x: bx, y: by + s } };
    }
    return null;
  }

  mysPohyb(e) {
    if (this.tazeni) return;
    const { x, y } = this.bod(e);
    const z = this.zasah(x, y);
    const kurzory = { hranaS: 'col-resize', hranaR: 'row-resize', uchyt: 'crosshair', okraj: 'move', filtr: 'default', overeni: 'default', roh: 'default', nic: 'default' };
    let kurzor = kurzory[z.typ];
    if (z.typ === 'sloupec') kurzor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'16\'%3E%3Cpath d=\'M4 1h4v8h3l-5 6-5-6h3z\' fill=\'%23000\' stroke=\'%23fff\'/%3E%3C/svg%3E") 6 15, s-resize';
    if (z.typ === 'radek') kurzor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'12\'%3E%3Cpath d=\'M15 4v4H7v3L1 6l6-5v3z\' fill=\'%23000\' stroke=\'%23fff\'/%3E%3C/svg%3E") 1 6, w-resize';
    if (z.typ === 'bunka') {
      kurzor = 'cell';
      const b = this.S.bunka(this.list, z.r, z.c);
      const odkaz = b?.odkaz || this.list.odkazyVzorcu?.get(klic(z.r, z.c));
      if (odkaz && x - this.X(z.c) < 200) kurzor = 'pointer';
      // náhled poznámky / komentáře
      if ((b?.pozn || b?.kom) && !this.edit) this.ukazPoznamku(z.r, z.c, b);
      else if (!this.poznamkaPripnuta) this.poznamka.hidden = true;
      if (odkaz && !this.edit) this.ukazBublinu(x, y, `${odkaz}\nKliknutím a podržením Ctrl otevřete odkaz.`);
      else this.bublina.hidden = true;
    } else if (!this.poznamkaPripnuta) { this.poznamka.hidden = true; this.bublina.hidden = true; }
    if (this.edit && this.muzeUkazovat() && z.typ === 'bunka') kurzor = 'cell';
    this.scroll.style.cursor = kurzor;
  }

  ukazPoznamku(r, c, b) {
    const x = this.X(c) + this.osaS.size(c) * this.z + 6, y = this.Y(r);
    const p = this.poznamka;
    if (b.kom) {
      const v = b.kom.vlakno || [];
      p.replaceChildren(...v.slice(0, 3).map((k) => el('div.tb-kom-polozka', {}, el('b', { text: k.autor }), el('span', { text: k.text }))), v.length > 3 ? el('small', { text: `a další (${v.length - 3})` }) : null);
      p.classList.add('komentar');
    } else {
      p.replaceChildren(el('b', { text: (b.pozn.autor || '') + ':' }), el('div', { text: b.pozn.text || b.pozn }));
      p.classList.remove('komentar');
    }
    p.style.left = Math.min(x, this.sirka - 230) + 'px';
    p.style.top = Math.max(0, y) + 'px';
    p.hidden = false;
  }
  ukazBublinu(x, y, text) {
    this.bublina.textContent = text;
    this.bublina.style.left = Math.min(x + 14, this.sirka - 280) + 'px';
    this.bublina.style.top = (y + 18) + 'px';
    this.bublina.hidden = false;
  }

  mysDolu(e) {
    if (e.button === 1) return;
    const { x, y } = this.bod(e);
    if (x > this.scroll.clientWidth || y > this.scroll.clientHeight) return;   // posuvníky
    const z = this.zasah(x, y);
    this.poznamka.hidden = true;
    this.bublina.hidden = true;
    this.P.zavriPlovouci?.();
    if (e.button === 2) {
      // pravé tlačítko: výběr se změní jen když klik není uvnitř výběru
      if (z.typ === 'bunka' && !this.vyber.oblasti.some((o) => obsahuje(o, z.r, z.c))) { if (this.edit) this.potvrdEditaci(); this.nastavVyber(z.r, z.c, null, { ukazat: false }); }
      if (z.typ === 'sloupec' && !this.vyber.oblasti.some((o) => o.r1 === 0 && o.r2 === MAX_R - 1 && z.c >= o.c1 && z.c <= o.c2)) this.nastavVyber(this.prvniViditelnyRadek(), z.c, [{ r1: 0, r2: MAX_R - 1, c1: z.c, c2: z.c }], { ukazat: false });
      if (z.typ === 'radek' && !this.vyber.oblasti.some((o) => o.c1 === 0 && o.c2 === MAX_C - 1 && z.r >= o.r1 && z.r <= o.r2)) this.nastavVyber(z.r, this.prvniViditelnySloupec(), [{ r1: z.r, r2: z.r, c1: 0, c2: MAX_C - 1 }], { ukazat: false });
      return;
    }
    e.preventDefault();
    // editace vzorce: klik do buňky vloží odkaz
    if (this.edit) {
      if (z.typ === 'bunka' && this.muzeUkazovat()) { this.zacniUkazovani(z.r, z.c, e); return; }
      if (z.typ === 'bunka' && this.edit.list === this.list && this.edit.r === z.r && this.edit.c === z.c) return;
      if (!this.potvrdEditaci()) return;
    }
    this.fokus();
    if (z.typ === 'filtr') { this.P.nabidkaFiltru(z, e); return; }
    if (z.typ === 'overeni') { this.P.seznamOvereni(); return; }
    if (z.typ === 'hranaS' || z.typ === 'hranaR') { this.tahniRozmer(z, e); return; }
    if (z.typ === 'uchyt') { this.tahniUchyt(e); return; }
    if (z.typ === 'okraj') { this.tahniPresun(e); return; }
    if (z.typ === 'roh') { this.vyberVse(); return; }
    if (z.typ === 'sloupec' || z.typ === 'radek') { this.tahniZahlavi(z, e); return; }
    if (z.typ === 'bunka') {
      const b = this.S.bunka(this.list, z.r, z.c);
      const odkaz = b?.odkaz || this.list.odkazyVzorcu?.get(klic(z.r, z.c));
      if (odkaz && (e.ctrlKey || e.metaKey)) { this.P.otevriOdkaz(odkaz); return; }
      this.tahniVyber(z, e);
    }
  }

  prvniViditelnyRadek() { let r = this.fr > this.r0 ? this.r0 : this.viditelne?.r1 || 0; return r; }
  prvniViditelnySloupec() { return this.fc > this.c0 ? this.c0 : this.viditelne?.c1 || 0; }

  sledujTazeni(e, pohyb, konec) {
    this.tazeni = true;
    try { this.scroll.setPointerCapture(e.pointerId); } catch { /* syntetická událost */ }
    let posledni = e;
    const tik = () => {
      // automatický posun u okraje
      const { x, y } = this.bod(posledni);
      let dx = 0, dy = 0;
      if (x > this.sirka - 4) dx = Math.min(60, (x - this.sirka + 4) * 0.6 + 8);
      else if (x < this.x0 && this.tazeniPosunX !== false) dx = x < this.zahlaviSirka ? -Math.min(60, (this.x0 - x) * 0.6 + 8) : 0;
      if (y > this.vyska - 4) dy = Math.min(80, (y - this.vyska + 4) * 0.8 + 8);
      else if (y < this.y0 && this.tazeniPosunY !== false) dy = y < this.zahlaviVyska ? -Math.min(80, (this.y0 - y) * 0.8 + 8) : 0;
      if (dx || dy) {
        this.rozmer.style.width = Math.max(parseFloat(this.rozmer.style.width), this.scroll.scrollLeft + this.sirka * 2) + 'px';
        this.rozmer.style.height = Math.max(parseFloat(this.rozmer.style.height), this.scroll.scrollTop + this.vyska * 2) + 'px';
        this.scroll.scrollLeft += dx;
        this.scroll.scrollTop += dy;
        pohyb(posledni, true);
      }
    };
    clearInterval(this.autoPosun);
    this.autoPosun = setInterval(tik, 50);
    const mv = (ev) => { posledni = ev; pohyb(ev); };
    const up = (ev) => {
      this.scroll.removeEventListener('pointermove', mv);
      this.scroll.removeEventListener('pointerup', up);
      this.scroll.removeEventListener('pointercancel', up);
      clearInterval(this.autoPosun);
      this.tazeni = false;
      konec?.(ev);
    };
    this.scroll.addEventListener('pointermove', mv);
    this.scroll.addEventListener('pointerup', up);
    this.scroll.addEventListener('pointercancel', up);
  }

  bunkaPodMysi(ev) {
    const { x, y } = this.bod(ev);
    this.geometrie();
    const r = this.radekNa(Math.max(this.zahlaviVyska + 1, Math.min(this.vyska - 1, y)));
    const c = this.sloupecNa(Math.max(this.zahlaviSirka + 1, Math.min(this.sirka - 1, x)));
    return { r: Math.max(0, r), c: Math.max(0, c) };
  }

  tahniVyber(z, e) {
    const v = this.vyber;
    if (e.shiftKey) this.rozsirVyber(z.r, z.c);
    else if (e.ctrlKey || e.metaKey) {
      const o = this.rozsirNaSloucenou({ r1: z.r, c1: z.c, r2: z.r, c2: z.c });
      this.list.vyber = { r: z.r, c: z.c, oblasti: [...v.oblasti, o], roh: { r: z.r, c: z.c } };
      this.prekresli();
      this.P.poZmeneVyberu?.();
    } else this.nastavVyber(z.r, z.c, null, { ukazat: false });
    const start = { r: this.vyber.r, c: this.vyber.c };
    this.sledujTazeni(e, (ev) => {
      const b = this.bunkaPodMysi(ev);
      const vv = this.vyber;
      const o = this.rozsirNaSloucenou(serad({ r1: start.r, c1: start.c, r2: b.r, c2: b.c }));
      this.list.vyber = { ...vv, oblasti: [...vv.oblasti.slice(0, -1), o], roh: b };
      this.prekresli();
      this.P.poZmeneVyberu?.(true);
    }, () => this.P.poZmeneVyberu?.());
  }

  tahniZahlavi(z, e) {
    const sloupec = z.typ === 'sloupec';
    const v = this.vyber;
    const oblast = (a, b) => (sloupec ? { r1: 0, r2: MAX_R - 1, c1: Math.min(a, b), c2: Math.max(a, b) } : { r1: Math.min(a, b), r2: Math.max(a, b), c1: 0, c2: MAX_C - 1 });
    const idx = sloupec ? z.c : z.r;
    let start = idx;
    if (e.shiftKey) start = sloupec ? v.c : v.r;
    const aktivni = () => (sloupec ? { r: this.prvniViditelnyRadek(), c: start } : { r: start, c: this.prvniViditelnySloupec() });
    const nastav = (konec) => {
      const o = oblast(start, konec);
      const a = aktivni();
      const pred = (e.ctrlKey || e.metaKey) ? this.vyber.oblasti.slice(0, this.puvodniPocet) : [];
      this.list.vyber = { r: a.r, c: a.c, oblasti: [...pred, o], roh: sloupec ? { r: MAX_R - 1, c: konec } : { r: konec, c: MAX_C - 1 } };
      this.prekresli();
      this.P.poZmeneVyberu?.(true);
    };
    this.puvodniPocet = (e.ctrlKey || e.metaKey) ? this.vyber.oblasti.length : 0;
    nastav(idx);
    this.sledujTazeni(e, (ev) => {
      const b = this.bunkaPodMysi(ev);
      nastav(sloupec ? b.c : b.r);
    }, () => this.P.poZmeneVyberu?.());
  }

  vyberVse() {
    const v = this.vyber;
    this.list.vyber = { r: v.r, c: v.c, oblasti: [{ r1: 0, c1: 0, r2: MAX_R - 1, c2: MAX_C - 1 }], roh: { r: MAX_R - 1, c: MAX_C - 1 } };
    this.prekresli();
    this.P.poZmeneVyberu?.();
  }

  tahniRozmer(z, e) {
    const sloupec = z.typ === 'hranaS';
    const idx = sloupec ? z.c : z.r;
    const puvodni = sloupec ? this.S.sirka(this.list, idx) : this.vyskaRadku(idx);
    const { x: sx, y: sy } = this.bod(e);
    // všechny vybrané celé sloupce/řádky se mění spolu
    const vybrane = this.vyber.oblasti.filter((o) => (sloupec ? o.r1 === 0 && o.r2 === MAX_R - 1 && idx >= o.c1 && idx <= o.c2 : o.c1 === 0 && o.c2 === MAX_C - 1 && idx >= o.r1 && idx <= o.r2));
    const indexy = vybrane.length ? vybrane.flatMap((o) => { const a = []; for (let i = sloupec ? o.c1 : o.r1; i <= (sloupec ? o.c2 : o.r2) && a.length < 2000; i++) a.push(i); return a; }) : [idx];
    let nova = puvodni;
    this.tazeniPosunX = false; this.tazeniPosunY = false;
    const ukaz = () => {
      const t = sloupec ? `Šířka: ${((Math.max(0, nova - 5)) / 7).toFixed(2).replace('.', ',')} (${Math.round(nova)} pixelů)` : `Výška: ${(nova * 0.75).toFixed(2).replace('.', ',')} (${Math.round(nova)} pixelů)`;
      const { x, y } = this.posledniBod || { x: sx, y: sy };
      this.ukazBublinu(x, y, t);
    };
    const zvyrazni = () => {
      this.nahled = sloupec
        ? { oblast: { r1: this.viditelne?.r1 || 0, r2: (this.viditelne?.r2 || 50), c1: idx, c2: idx }, tecky: true, barva: '#7a7a7a', sirka: 1 }
        : null;
    };
    this.sledujTazeni(e, (ev) => {
      const { x, y } = this.bod(ev);
      this.posledniBod = { x, y };
      nova = Math.max(0, puvodni + ((sloupec ? x - sx : y - sy) / this.z));
      const mapa = sloupec ? this.list.sirky : this.list.vysky;
      for (const i of indexy) mapa.set(i, Math.round(nova));
      if (sloupec) indexy.forEach((i) => this.list.skryteC.delete(i)); else indexy.forEach((i) => this.list.skryteR.delete(i));
      zvyrazni();
      this.kresliTed();
      ukaz();
    }, () => {
      this.tazeniPosunX = undefined; this.tazeniPosunY = undefined;
      this.bublina.hidden = true;
      this.nahled = null;
      const hodnota = Math.round(nova);
      // vrátit a provést jako krok historie
      const mapa = sloupec ? this.list.sirky : this.list.vysky;
      for (const i of indexy) { if (puvodni === (sloupec ? this.list.vychoziSirka || VYCHOZI_SIRKA : VYCHOZI_VYSKA)) mapa.delete(i); else mapa.set(i, puvodni); }
      if (hodnota === Math.round(puvodni)) { this.prekresli(); return; }
      this.P.prikaz(sloupec ? 'Šířka sloupce' : 'Výška řádku', () => {
        for (const i of indexy) {
          if (hodnota === 0) (sloupec ? this.list.skryteC : this.list.skryteR).add(i);
          else mapa.set(i, hodnota);
        }
      }, { prepocet: false });
    });
    ukaz();
  }

  tahniUchyt(e) {
    const zdroj = this.rozsirNaSloucenou(this.oblast);
    let cil = zdroj;
    const ctrl = () => e.ctrlKey;
    this.sledujTazeni(e, (ev) => {
      const b = this.bunkaPodMysi(ev);
      const dolu = b.r - zdroj.r2, nahoru = zdroj.r1 - b.r, doprava = b.c - zdroj.c2, doleva = zdroj.c1 - b.c;
      const svisle = Math.max(dolu, nahoru), vodorovne = Math.max(doprava, doleva);
      if (svisle <= 0 && vodorovne <= 0) {
        // dovnitř výběru = mazání
        if (b.r >= zdroj.r1 && b.r < zdroj.r2 && (zdroj.r2 - b.r) >= (zdroj.c2 - b.c)) cil = { ...zdroj, r2: b.r };
        else if (b.c >= zdroj.c1 && b.c < zdroj.c2) cil = { ...zdroj, c2: b.c };
        else cil = zdroj;
        this.nahled = { oblast: cil, barva: '#8a8a8a' };
        this.ukazBublinu(this.bod(ev).x, this.bod(ev).y, '');
        this.bublina.hidden = true;
      } else if (svisle >= vodorovne) {
        cil = dolu > 0 ? { ...zdroj, r2: b.r } : { ...zdroj, r1: b.r };
        this.nahled = { oblast: cil, barva: '#7a7a7a' };
      } else {
        cil = doprava > 0 ? { ...zdroj, c2: b.c } : { ...zdroj, c1: b.c };
        this.nahled = { oblast: cil, barva: '#7a7a7a' };
      }
      if (cil !== zdroj && (cil.r2 > zdroj.r2 || cil.c2 > zdroj.c2 || cil.r1 < zdroj.r1 || cil.c1 < zdroj.c1)) {
        const t = this.P.nahledVyplneni?.(zdroj, cil, ev.ctrlKey);
        const { x, y } = this.bod(ev);
        if (t !== undefined && t !== null) this.ukazBublinu(x, y, t);
      }
      this.prekresli();
    }, (ev) => {
      this.nahled = null;
      this.bublina.hidden = true;
      if (cil === zdroj || (cil.r1 === zdroj.r1 && cil.r2 === zdroj.r2 && cil.c1 === zdroj.c1 && cil.c2 === zdroj.c2)) { this.prekresli(); return; }
      const zmenseni = cil.r2 < zdroj.r2 || cil.c2 < zdroj.c2;
      if (zmenseni) {
        const smaz = cil.r2 < zdroj.r2 ? { ...zdroj, r1: cil.r2 + 1 } : { ...zdroj, c1: cil.c2 + 1 };
        this.P.prikaz('Vymazat', () => this.S.vymaz(this.list, [smaz], 'obsah'));
        this.vyberOblast(cil, { r: this.vyber.r, c: this.vyber.c });
        return;
      }
      this.P.vypln(zdroj, cil, { kopie: ev.ctrlKey || ctrl() });
    });
  }

  tahniPresun(e) {
    const zdroj = this.rozsirNaSloucenou(this.oblast);
    const start = this.bunkaPodMysi(e);
    let cil = zdroj;
    this.sledujTazeni(e, (ev) => {
      const b = this.bunkaPodMysi(ev);
      const dr = b.r - start.r, dc = b.c - start.c;
      const r1 = Math.max(0, Math.min(MAX_R - 1 - (zdroj.r2 - zdroj.r1), zdroj.r1 + dr));
      const c1 = Math.max(0, Math.min(MAX_C - 1 - (zdroj.c2 - zdroj.c1), zdroj.c1 + dc));
      cil = { r1, c1, r2: r1 + zdroj.r2 - zdroj.r1, c2: c1 + zdroj.c2 - zdroj.c1 };
      this.nahled = { oblast: cil, barva: '#6E6E6E', sirka: 2, tecky: false };
      const { x, y } = this.bod(ev);
      this.ukazBublinu(x, y, textOblasti(cil));
      this.prekresli();
    }, async (ev) => {
      this.nahled = null;
      this.bublina.hidden = true;
      this.prekresli();
      if (cil.r1 === zdroj.r1 && cil.c1 === zdroj.c1) return;
      this.P.presunOblast(zdroj, cil, { kopie: ev.ctrlKey || ev.metaKey });
    });
  }

  dvojklik(e) {
    const { x, y } = this.bod(e);
    const z = this.zasah(x, y);
    if (z.typ === 'hranaS') { this.P.prizpusobSirku(z.c); return; }
    if (z.typ === 'hranaR') { this.P.prizpusobVysku(z.r); return; }
    if (z.typ === 'uchyt') { this.P.vyplnDvojklikem(); return; }
    if (z.typ === 'okraj') {
      // dvojklik na okraj = skok na konec dat (jako Ctrl+šipka)
      const o = this.obdelnik(this.oblast);
      const dr = Math.abs(y - (o.y + o.h)) <= 4 ? 1 : Math.abs(y - o.y) <= 4 ? -1 : 0;
      const dc = !dr ? (Math.abs(x - (o.x + o.w)) <= 4 ? 1 : -1) : 0;
      this.posunAktivni(dr, dc, { skok: true });
      return;
    }
    if (z.typ === 'bunka' && !this.edit) {
      if (this.P.pred2klik?.(z.r, z.c)) return;
      this.zacniEditaci('upravit', null, { kurzorX: e.clientX });
    }
  }

  kontext(e) {
    e.preventDefault();
    const { x, y } = this.bod(e);
    const z = this.zasah(x, y);
    if (this.edit) return;
    this.P.kontextovaNabidka(e, z);
  }

  fokus() {
    if (this.edit) return;
    const v = this.vyber;
    // skrytý vstup u aktivní buňky (IME okno se pak objeví na správném místě)
    this.geometrie();
    this.klav.style.left = Math.max(0, Math.min(this.sirka - 20, this.X(v.c))) + 'px';
    this.klav.style.top = Math.max(0, Math.min(this.vyska - 20, this.Y(v.r))) + 'px';
    if (document.activeElement !== this.klav) this.klav.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ klávesnice
  klavesa(e) {
    if (this.P.predKlavesou?.(e)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    const hotovo = () => { e.preventDefault(); e.stopPropagation(); };
    const pohyb = {
      ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1],
    }[k];
    if (pohyb && !e.altKey) {
      hotovo();
      this.tabStart = undefined;
      if (this.P.scrollLock) {
        this.scroll.scrollTop += pohyb[0] * 20 * this.z;
        this.scroll.scrollLeft += pohyb[1] * 64 * this.z;
        return;
      }
      this.posunAktivni(pohyb[0], pohyb[1], { rozsirit: e.shiftKey, skok: ctrl });
      return;
    }
    if (k === 'Enter' && !e.altKey) {
      hotovo();
      if (ctrl) return;
      const smer = this.P.smerEnter?.() || 'dolu';
      const [dr, dc] = { dolu: [1, 0], nahoru: [-1, 0], vpravo: [0, 1], vlevo: [0, -1] }[smer];
      this.pohybVeVyberu(e.shiftKey ? -dr : dr, e.shiftKey ? -dc : dc);
      return;
    }
    if (k === 'Tab' && !ctrl && !e.altKey) { hotovo(); this.pohybVeVyberu(0, e.shiftKey ? -1 : 1); return; }
    if (k === 'Home' && !e.altKey) {
      hotovo();
      if (ctrl) { if (e.shiftKey) this.rozsirVyber(this.fr, this.fc); else this.nastavVyber(this.fr, this.fc); }
      else if (e.shiftKey) this.rozsirVyber((this.vyber.roh || this.vyber).r, 0);
      else this.nastavVyber(this.vyber.r, this.fc > this.c0 ? this.c0 : 0);
      return;
    }
    if (k === 'End' && ctrl) {
      hotovo();
      const u = this.S.rozsahDat(this.list);
      const r = Math.max(0, u.r), c = Math.max(0, u.c);
      if (e.shiftKey) this.rozsirVyber(r, c); else this.nastavVyber(r, c);
      return;
    }
    if (k === 'PageDown' || k === 'PageUp') {
      hotovo();
      if (ctrl) { this.P.prepniList(k === 'PageDown' ? 1 : -1); return; }
      this.geometrie();
      const smer = k === 'PageDown' ? 1 : -1;
      if (e.altKey) {
        const radek = Math.max(1, (this.viditelne.c2 - this.viditelne.c1) - 1);
        const c = Math.max(0, this.vyber.c + smer * radek);
        this.scroll.scrollLeft += smer * (this.sirka - this.x0);
        if (e.shiftKey) this.rozsirVyber(this.vyber.r, c); else this.nastavVyber(this.vyber.r, c);
        return;
      }
      const radku = Math.max(1, (this.viditelne.r2 - this.viditelne.r1) - 1);
      const r = Math.max(0, Math.min(MAX_R - 1, (e.shiftKey ? (this.vyber.roh || this.vyber).r : this.vyber.r) + smer * radku));
      this.rozmer.style.height = Math.max(parseFloat(this.rozmer.style.height), this.scroll.scrollTop + this.vyska * 3) + 'px';
      this.scroll.scrollTop += smer * (this.vyska - this.y0);
      if (e.shiftKey) this.rozsirVyber(r, this.vyber.roh?.c ?? this.vyber.c); else this.nastavVyber(r, this.vyber.c);
      return;
    }
    if (k === 'F2' && !ctrl && !e.shiftKey) { hotovo(); this.zacniEditaci('upravit'); return; }
    if ((k === 'Delete') && !ctrl) { hotovo(); this.P.vymazObsah(); return; }
    if (k === 'Backspace' && !ctrl) { hotovo(); this.P.vymazObsah(true); this.zacniEditaci('zadat', ''); return; }
    if (k === 'Escape') {
      if (this.kopie) { hotovo(); this.kopie = null; this.prekresli(); this.P.poZmeneSchranky?.(); return; }
      if (this.sipky.length) { this.sipky = []; this.prekresli(); }
      return;
    }
    if (ctrl && !e.altKey) {
      const kk = k.toLowerCase();
      if (kk === 'a') {
        hotovo();
        const v = this.vyber;
        const o = this.S.aktualniOblast(this.list, v.r, v.c);
        const uzCela = this.oblast.r1 === o.r1 && this.oblast.r2 === o.r2 && this.oblast.c1 === o.c1 && this.oblast.c2 === o.c2;
        if (!this.maHodnotu(v.r, v.c) && o.r1 === o.r2 && o.c1 === o.c2 || uzCela) this.vyberVse();
        else this.vyberOblast(o, { r: v.r, c: v.c });
        return;
      }
      if (e.code === 'Space' && !e.shiftKey) { hotovo(); const o = this.oblast; this.list.vyber = { ...this.vyber, oblasti: [{ r1: 0, r2: MAX_R - 1, c1: o.c1, c2: o.c2 }] }; this.prekresli(); this.P.poZmeneVyberu?.(); return; }
      if (e.code === 'Space' && e.shiftKey) { hotovo(); this.vyberVse(); return; }
      // obslouží události copy/cut/paste — prohlížeč je ale spustí jen nad označeným textem,
      // proto se do skrytého pole vloží neviditelný znak a označí
      // vlastní schránka se naplní hned (některé prohlížeče událost copy nepustí), systémová navíc přes událost
      if (['c', 'x'].includes(kk) && !e.shiftKey) { this.P.kopiruj(kk === 'x', null); this.klav.value = '​'; this.klav.select(); return; }
      if (kk === 'v' && !e.shiftKey) {
        // dokud běží „mravenci“, vkládá se z vlastní schránky (vzorce, formáty); jinak ze systémové
        if (this.kopie && !this.kopie.stetec && this.P.schranka) { e.preventDefault(); e.stopPropagation(); this.P.vlozVnitrni(this.P.schranka, 'vse'); return; }
        this.klav.value = '';
        return;
      }
    }
    if (e.shiftKey && e.code === 'Space' && !ctrl) { hotovo(); const o = this.oblast; this.list.vyber = { ...this.vyber, oblasti: [{ r1: o.r1, r2: o.r2, c1: 0, c2: MAX_C - 1 }] }; this.prekresli(); this.P.poZmeneVyberu?.(); return; }
    if (e.altKey && k === 'ArrowDown') { hotovo(); if (this.S.validaceV(this.list, this.vyber.r, this.vyber.c)?.typ === 'seznam') this.P.seznamOvereni(); else this.P.seznamHodnot?.(); return; }
    // tisknutelný znak = začátek psaní (vstup přijde přes událost input)
    if (k.length === 1 && !ctrl && !e.altKey) {
      if (this.P.zamcenaAktivni?.()) { hotovo(); this.P.hlaskaZamek(); return; }
      return;
    }
  }

  // ------------------------------------------------------------ editace
  textProEditaci(r, c) {
    const b = this.S.bunka(this.list, r, c);
    if (!b) return '';
    if (b.f) return b.f;
    const v = b.v;
    if (v === null || v === undefined) return '';
    const nf = this.S.stylBunky(this.list, r, c)?.nf;
    if (typeof v === 'number') {
      if (nf && jeDatovyFormat(nf)) {
        const d = zeSerialu(v);
        const datum = v >= 1 ? `${d.d}.${d.m}.${d.y}` : '';
        const cas = v % 1 ? `${d.h}:${String(d.mi).padStart(2, '0')}:${String(d.s).padStart(2, '0')}` : '';
        return [datum, cas].filter(Boolean).join(' ') || '0:00:00';
      }
      if (nf && jeProcentniFormat(nf)) return String(+(v * 100).toPrecision(15)).replace('.', ',') + '%';
      return String(+v.toPrecision(15)).replace('.', ',').replace(/e\+?/, 'E');
    }
    if (typeof v === 'boolean') return v ? 'PRAVDA' : 'NEPRAVDA';
    if (b.t) return "'" + v;
    return String(v);
  }

  zacniEditaci(rezim, text = null, { kurzorX = null } = {}) {
    if (this.edit) return;
    const v = this.vyber;
    if (this.P.zamcenaAktivni?.()) { this.P.hlaskaZamek(); return; }
    const m = this.S.sloucenaV(this.list, v.r, v.c);
    const r = m ? m.r1 : v.r, c = m ? m.c1 : v.c;
    const puvodni = this.textProEditaci(r, c);
    this.edit = { r, c, list: this.list, rezim, puvodni, text: text === null ? puvodni : text, kotva: null, ukaz: null, zdroj: this.editor };
    this.ukazBunku(r, c);
    this.editor.hidden = false;
    const s = this.S.stylBunky(this.list, r, c) || {};
    this.editor.style.font = pismoCanvas(s, this.z);
    this.editor.style.color = s.barva || '#000';
    this.editor.style.background = s.pozadi || '#FFFFFF';
    this.editor.style.textAlign = rezim === 'upravit' ? ({ r: 'right', c: 'center' }[s.h] || 'left') : 'left';
    this.editor.classList.toggle('zalam', !!s.zalam);
    this.kresliEditor(this.editor, this.edit.text, this.edit.text.length);
    this.poziceEditoru();
    this.editor.focus({ preventScroll: true });
    setCaret(this.editor, this.edit.text.length);
    if (kurzorX !== null && rezim === 'upravit') {
      // stříška tam, kam uživatel poklepal
      const pos = document.caretPositionFromPoint?.(kurzorX, this.editor.getBoundingClientRect().top + 6) || null;
      if (pos && this.editor.contains(pos.offsetNode)) {
        const rr = document.createRange(); rr.setStart(pos.offsetNode, pos.offset); rr.collapse(true);
        getSelection().removeAllRanges(); getSelection().addRange(rr);
      }
    }
    this.poVstupu(this.editor, { bezDoplneni: true });
    this.prekresli();
  }

  poziceEditoru() {
    if (!this.edit || this.editor.hidden) return;
    if (this.edit.list !== this.list) { this.editor.style.visibility = 'hidden'; return; }
    this.editor.style.visibility = '';
    const m = this.S.sloucenaV(this.list, this.edit.r, this.edit.c);
    const o = this.obdelnik(m || { r1: this.edit.r, c1: this.edit.c, r2: this.edit.r, c2: this.edit.c });
    if (!o) { this.editor.style.visibility = 'hidden'; return; }
    const top = this.scroll.offsetTop;
    this.editor.style.left = (o.x + this.scroll.offsetLeft) + 'px';
    this.editor.style.top = (o.y + top) + 'px';
    this.editor.style.minWidth = Math.max(o.w, 20) + 'px';
    this.editor.style.minHeight = o.h + 'px';
    this.editor.style.maxWidth = Math.max(o.w, this.sirka - o.x - 4) + 'px';
    if (this.editor.classList.contains('zalam')) this.editor.style.width = o.w + 'px';
    else this.editor.style.width = '';
    this.naseptavac.style.left = this.editor.style.left;
    this.naseptavac.style.top = (o.y + top + Math.max(o.h, this.editor.offsetHeight) + 2) + 'px';
    this.napovedaArg.style.left = this.editor.style.left;
    this.napovedaArg.style.top = (o.y + top + Math.max(o.h, this.editor.offsetHeight) + 2) + 'px';
  }

  kresliEditor(elm, text, kurzor, konec = kurzor) {
    const html = obarvi(text) + (text.endsWith('\n') ? '<br>' : '');
    if (elm.innerHTML !== html) elm.innerHTML = html;
    if (document.activeElement === elm) setCaret(elm, kurzor, konec);
  }

  /** Změna textu v editoru (v buňce nebo v řádku vzorců). */
  poVstupu(elm, { bezDoplneni = false } = {}) {
    if (!this.edit) return;
    const text = elm.textContent.replace(/ /g, ' ');
    const [a, b] = selectionOffsets(elm);
    const pridano = text.length > (this.edit.text || '').length;
    this.edit.text = text;
    this.edit.zdroj = elm;
    this.edit.ukaz = null;
    // barvy odkazů v obou editorech
    if (text[0] === '=') this.kresliEditor(elm, text, a, b);
    const druhy = elm === this.editor ? this.P.radekVzorcu : this.editor;
    if (druhy) this.kresliEditor(druhy, text, a);
    // automatické dokončování textu ze sloupce
    if (!bezDoplneni && pridano && text[0] !== '=' && elm === this.editor && a === b && a === text.length && text.length && this.P.automatickeDokoncovani?.() !== false) {
      const navrh = this.navrhZeSloupce(text);
      if (navrh && navrh.length > text.length) {
        this.edit.text = navrh;
        this.kresliEditor(elm, navrh, text.length, navrh.length);
        if (druhy) this.kresliEditor(druhy, navrh, navrh.length);
      }
    }
    this.aktualizujOdkazy();
    this.naseptej(elm);
    this.poziceEditoru();
    this.P.poEditaci?.();
    this.prekresli();
  }

  poPohybuStrisky(elm, e = null) {
    if (!this.edit) return;
    // šipky a Tab v otevřeném našeptávači listují seznamem — nepřekreslovat ho po puštění klávesy
    if (e && !this.naseptavac.hidden && /^(ArrowUp|ArrowDown|Tab|Enter|Escape)$/.test(e.key)) return;
    this.naseptej(elm);
    this.P.poEditaci?.();
  }

  navrhZeSloupce(text) {
    const { r, c, list } = this.edit;
    const low = text.toLocaleLowerCase('cs');
    const shody = new Set();
    const projdi = (smer) => {
      for (let rr = r + smer, n = 0; rr >= 0 && n < 2000; rr += smer, n++) {
        const v = this.S.hodnota(list, rr, c);
        if (v === null) break;
        if (typeof v === 'string' && v.toLocaleLowerCase('cs').startsWith(low)) shody.add(v);
      }
    };
    projdi(-1); projdi(1);
    const pole = [...shody];
    const unikatni = new Set(pole.map((x) => x.toLocaleLowerCase('cs')));
    if (unikatni.size !== 1) return null;
    return text + pole[0].slice(text.length);
  }

  aktualizujOdkazy() {
    const t = this.edit?.text || '';
    if (t[0] !== '=') { this.odkazyEditace = []; return; }
    const barvy = new Map();
    this.odkazyEditace = odkazyVeVzorci(t).map((x) => {
      const k = x.text.toUpperCase() + '|' + (x.list || '');
      if (!barvy.has(k)) barvy.set(k, BARVY_ODKAZU[barvy.size % BARVY_ODKAZU.length]);
      const list = x.list ? this.S.listPodleJmena(x.list) : this.edit.list;
      if (list !== this.list) return null;
      const o = x.oblast;
      return { oblast: { r1: o.r1, c1: o.c1, r2: Math.min(o.r2, MAX_R - 1), c2: Math.min(o.c2, MAX_C - 1) }, barva: barvy.get(k), a: x.a, b: x.b };
    }).filter(Boolean);
  }

  /** Může se kliknutím / šipkou vložit odkaz? (Excel: režim Ukázat) */
  muzeUkazovat() {
    const e = this.edit;
    if (!e || e.text[0] !== '=') return false;
    const elm = e.zdroj || this.editor;
    const [a, b] = document.activeElement === elm ? selectionOffsets(elm) : [e.text.length, e.text.length];
    if (e.ukaz && a === e.ukaz.b) return true;
    if (e.rezim === 'upravit' && e.ukaz === null && e.klikUkazovat === false) return false;
    const pred = e.text.slice(0, a).replace(/\s+$/, '');
    return /[=(;,+\-*/^&<>:%]$/.test(pred) && a === b;
  }

  vlozOdkaz(o, list = this.list) {
    const e = this.edit;
    const elm = e.zdroj && document.contains(e.zdroj) ? e.zdroj : this.editor;
    let [a] = document.activeElement === elm ? selectionOffsets(elm) : [e.text.length];
    let od = a;
    if (e.ukaz && a === e.ukaz.b) od = e.ukaz.a;
    const pref = list !== e.list ? jmenoListuVeVzorci(list.nazev) + '!' : '';
    const ref = pref + textOblasti(o);
    const text = e.text.slice(0, od) + ref + e.text.slice(a);
    e.text = text;
    e.ukaz = { a: od, b: od + ref.length };
    this.kresliEditor(elm, text, od + ref.length);
    const druhy = elm === this.editor ? this.P.radekVzorcu : this.editor;
    if (druhy) this.kresliEditor(druhy, text, od + ref.length);
    elm.focus({ preventScroll: true });
    setCaret(elm, od + ref.length);
    this.aktualizujOdkazy();
    // tečkovaný rámeček ukazované oblasti
    this.odkazyEditace.forEach((x) => { if (x.a === od + 1 || x.a === od) x.tecky = true; });
    this.poziceEditoru();
    this.P.poEditaci?.();
    this.prekresli();
  }

  zacniUkazovani(r, c, e) {
    const start = { r, c };
    const aktualizuj = (b) => this.vlozOdkaz(this.rozsirNaSloucenou(serad({ r1: start.r, c1: start.c, r2: b.r, c2: b.c })));
    if (e.shiftKey && this.edit.ukaz) {
      const o = rozeberOblast(this.edit.text.slice(this.edit.ukaz.a, this.edit.ukaz.b).replace(/^.*!/, ''));
      if (o) { start.r = o.r1; start.c = o.c1; }
    }
    aktualizuj({ r, c });
    this.sledujTazeni(e, (ev) => aktualizuj(this.bunkaPodMysi(ev)), () => {
      const elm = this.edit?.zdroj || this.editor;
      elm.focus({ preventScroll: true });
      if (this.edit?.ukaz) setCaret(elm, this.edit.ukaz.b);
    });
  }

  klavesaEditoru(e, elm) {
    if (!this.edit) return;
    if ((e.altKey && (e.key === 'F4' || e.key === 'Tab')) || e.key === 'Meta') return;
    e.stopPropagation();
    const ctrl = e.ctrlKey || e.metaKey;
    const hotovo = () => e.preventDefault();
    // našeptávač funkcí
    if (!this.naseptavac.hidden) {
      const polozky = [...this.naseptavac.querySelectorAll('.tb-nas-pol')];
      let i = polozky.findIndex((p) => p.classList.contains('vybrano'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        hotovo();
        i = Math.max(0, Math.min(polozky.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
        polozky.forEach((p, j) => p.classList.toggle('vybrano', j === i));
        polozky[i]?.scrollIntoView({ block: 'nearest' });
        this.popisNaseptavace(polozky[i]);
        return;
      }
      if (e.key === 'Tab' && i >= 0) { hotovo(); polozky[i].click(); return; }
      if (e.key === 'Escape') { hotovo(); this.naseptavac.hidden = true; return; }
    }
    if (e.key === 'Escape') { hotovo(); this.zrusEditaci(); return; }
    if (e.key === 'Enter' && e.altKey) { hotovo(); document.execCommand('insertText', false, '\n'); return; }
    if (e.key === 'Enter') {
      hotovo();
      const smer = this.P.smerEnter?.() || 'dolu';
      if (ctrl && e.shiftKey) { this.potvrdEditaci({ pole: true }); return; }
      if (ctrl) { this.potvrdEditaci({ celyVyber: true }); return; }
      this.potvrdEditaci({ smer: e.shiftKey ? { dolu: 'nahoru', nahoru: 'dolu', vpravo: 'vlevo', vlevo: 'vpravo' }[smer] : smer });
      return;
    }
    if (e.key === 'Tab') { hotovo(); this.potvrdEditaci({ smer: e.shiftKey ? 'vlevo' : 'vpravo', tab: true }); return; }
    if (e.key === 'F2') { hotovo(); this.edit.rezim = this.edit.rezim === 'zadat' ? 'upravit' : 'zadat'; this.P.poEditaci?.(); return; }
    if (e.key === 'F4' && !ctrl) {
      hotovo();
      const kurzor = caretOffset(elm);
      const x = prepniAbsolutni(this.edit.text, kurzor);
      if (x) {
        this.edit.text = x.text;
        this.kresliEditor(elm, x.text, x.kurzor);
        const druhy = elm === this.editor ? this.P.radekVzorcu : this.editor;
        if (druhy) this.kresliEditor(druhy, x.text, x.kurzor);
        this.aktualizujOdkazy();
        this.prekresli();
      }
      return;
    }
    if (e.key === 'F9' && this.edit.text[0] === '=') {
      // vyhodnocení části vzorce jako v Excelu
      hotovo();
      const [a, b] = selectionOffsets(elm);
      if (a !== b) this.P.vyhodnotCast(this.edit.text.slice(a, b), (vysledek) => {
        const t = this.edit.text.slice(0, a) + vysledek + this.edit.text.slice(b);
        this.edit.text = t;
        this.kresliEditor(elm, t, a + vysledek.length);
      });
      return;
    }
    if (ctrl && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z') { hotovo(); document.execCommand('undo'); return; }
      if (k === 'a') { hotovo(); setCaret(elm, 0, this.edit.text.length); return; }
      if (k === ';') { hotovo(); document.execCommand('insertText', false, new Date().toLocaleDateString('cs-CZ').replace(/\s/g, '')); return; }
      if (e.code === 'Semicolon' && e.shiftKey) { hotovo(); const t = new Date(); document.execCommand('insertText', false, `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`); return; }
      if (['b', 'i', 'u'].includes(k)) { hotovo(); return; }
    }
    if (e.shiftKey && e.key === 'F3') { hotovo(); this.P.vlozitFunkci?.(); return; }
    // šipky v režimu Zadat
    const sipka = { ArrowDown: 'dolu', ArrowUp: 'nahoru', ArrowRight: 'vpravo', ArrowLeft: 'vlevo' }[e.key];
    if (sipka && this.edit.rezim === 'zadat' && elm === this.editor && this.naseptavac.hidden) {
      if (this.muzeUkazovat()) {
        hotovo();
        // ukazování šipkami
        let akt = this.edit.ukaz ? rozeberOblast(this.edit.text.slice(this.edit.ukaz.a, this.edit.ukaz.b).replace(/^.*!/, '')) : null;
        const zakl = akt ? { r: e.shiftKey ? akt.r2 : akt.r1, c: e.shiftKey ? akt.c2 : akt.c1 } : { r: this.edit.r, c: this.edit.c };
        const [dr, dc] = { dolu: [1, 0], nahoru: [-1, 0], vpravo: [0, 1], vlevo: [0, -1] }[sipka];
        const [nr, nc] = ctrl ? this.skok(zakl.r, zakl.c, dr, dc) : this.dalsiViditelny(zakl.r, zakl.c, dr, dc);
        if (e.shiftKey && akt) this.vlozOdkaz(serad({ r1: akt.r1, c1: akt.c1, r2: nr, c2: nc }));
        else this.vlozOdkaz({ r1: nr, c1: nc, r2: nr, c2: nc });
        this.ukazBunku(nr, nc);
        return;
      }
      hotovo();
      this.potvrdEditaci({ smer: sipka, sipkou: true });
      return;
    }
  }

  // ------------------------------------------------------------ našeptávač funkcí a nápověda argumentů
  naseptej(elm) {
    const e = this.edit;
    if (!e) return;
    const kurzor = document.activeElement === elm ? caretOffset(elm) : e.text.length;
    const jm = e.text[0] === '=' ? rozepsaneJmeno(e.text, kurzor) : null;
    if (jm && jm.jmeno.length >= 1 && !/[(]$/.test(e.text.slice(0, kurzor))) {
      const q = jm.jmeno.toLocaleUpperCase('cs');
      const funkce = Object.values(FUNKCE).filter((f) => f.n.startsWith(q)).sort((a, b) => a.n.localeCompare(b.n, 'cs'));
      const anglicke = Object.values(FUNKCE).filter((f) => f.en.startsWith(q) && !f.n.startsWith(q));
      const nazvy = [...this.S.nazvy.values()].filter((d) => d.nazev.toLocaleUpperCase('cs').startsWith(q));
      const tabulky = this.list.tabulky.filter((t) => t.nazev.toLocaleUpperCase('cs').startsWith(q));
      const vse = [...nazvy.map((d) => ({ n: d.nazev, p: d.komentar || d.vzorec, nazev: true })), ...tabulky.map((t) => ({ n: t.nazev, p: 'Tabulka', nazev: true })), ...funkce, ...anglicke.map((f) => ({ ...f, alias: f.en }))].slice(0, 12);
      if (vse.length && !(vse.length === 1 && vse[0].n === q)) {
        this.naseptavac.replaceChildren(...vse.map((f, i) => {
          const p = el('div.tb-nas-pol' + (i === 0 ? '.vybrano' : ''), { dataset: { p: f.p || '' } },
            el('span.tb-nas-ik' + (f.nazev ? '.nazev' : ''), { text: f.nazev ? '▦' : 'fx' }), el('span', { text: f.n }), f.alias ? el('small', { text: f.alias }) : null);
          p.onclick = () => {
            const vlozit = f.nazev ? f.n : f.n + '(';
            const t = e.text.slice(0, jm.od) + vlozit + e.text.slice(kurzor);
            e.text = t;
            this.kresliEditor(elm, t, jm.od + vlozit.length);
            const druhy = elm === this.editor ? this.P.radekVzorcu : this.editor;
            if (druhy) this.kresliEditor(druhy, t, jm.od + vlozit.length);
            elm.focus();
            setCaret(elm, jm.od + vlozit.length);
            this.naseptavac.hidden = true;
            this.naseptej(elm);
            this.P.poEditaci?.();
          };
          p.onmouseenter = () => this.popisNaseptavace(p);
          return p;
        }), el('div.tb-nas-popis'));
        this.naseptavac.hidden = false;
        this.popisNaseptavace(this.naseptavac.querySelector('.vybrano'));
        this.napovedaArg.hidden = true;
        this.umistiPlovouci(elm);
        return;
      }
    }
    this.naseptavac.hidden = true;
    // nápověda k argumentům
    const f = e.text[0] === '=' ? funkcePodKurzorem(e.text, kurzor) : null;
    if (f) {
      const casti = f.f.a.map((a, i) => {
        const aktivni = i === f.arg || (a === '…' && f.arg >= i) || (i === f.f.a.length - 2 && f.f.a[f.f.a.length - 1] === '…' && f.arg > i);
        return aktivni ? `<b>${esc(a)}</b>` : esc(a);
      });
      this.napovedaArg.innerHTML = `<span class="tb-arg-fn">${esc(f.f.n)}</span>(${casti.join('; ')})`;
      this.napovedaArg.title = f.f.p;
      this.napovedaArg.hidden = false;
      this.umistiPlovouci(elm);
    } else this.napovedaArg.hidden = true;
  }

  popisNaseptavace(p) {
    const d = this.naseptavac.querySelector('.tb-nas-popis');
    if (d) d.textContent = p?.dataset.p || '';
  }

  umistiPlovouci(elm) {
    if (elm === this.editor) { this.poziceEditoru(); return; }
    // řádek vzorců: pod ním
    const r = elm.getBoundingClientRect();
    const u = this.uzel.getBoundingClientRect();
    this.naseptavac.style.left = Math.max(0, r.left - u.left) + 'px';
    this.naseptavac.style.top = '2px';
    this.napovedaArg.style.left = Math.max(0, r.left - u.left) + 'px';
    this.napovedaArg.style.top = '2px';
  }

  /** Uloží editaci do buňky. Vrací false, když se nepodařilo (chyba vzorce, ověření dat). */
  potvrdEditaci({ smer = null, celyVyber = false, pole = false, tab = false } = {}) {
    const e = this.edit;
    if (!e) return true;
    let text = e.text.replace(/ /g, ' ');
    if (text[0] === '=' && text.length > 1) {
      // doplnit chybějící závorky
      const otevrene = (text.match(/\(/g) || []).length - (text.match(/\)/g) || []).length;
      if (otevrene > 0 && !/"[^"]*$/.test(text)) text += ')'.repeat(otevrene);
    }
    if (text === '+' || text === '-') { /* zůstane text */ }
    else if (/^[+-]\S/.test(text) && !/^[+-][\d,. ]+%?$/.test(text)) text = '=' + text;   // „+A1“ = vzorec jako v Excelu
    const list = e.list;
    // ověření dat
    const cile = celyVyber ? this.vyber.oblasti : [{ r1: e.r, c1: e.c, r2: e.r, c2: e.c }];
    if (text !== e.puvodni || celyVyber) {
      const chyba = this.S.overVstup(list, e.r, e.c, text);
      if (chyba) {
        this.P.chybaOvereni(chyba, (volba) => {
          if (volba === 'znovu') { this.editor.focus(); setCaret(this.editor, 0, this.edit?.text.length || 0); }
          else if (volba === 'zrusit') this.zrusEditaci();
          else if (volba === 'ano') this.ulozEditaci(text, cile, list, { smer, tab, vynutit: true });
        });
        return false;
      }
    }
    return this.ulozEditaci(text, cile, list, { smer, tab });
  }

  ulozEditaci(text, cile, list, { smer, tab }) {
    const e = this.edit;
    const zmena = text !== e.puvodni || cile.length > 1 || cile[0].r1 !== cile[0].r2 || cile[0].c1 !== cile[0].c2;
    if (zmena) {
      this.ukladam = true;
      const ok = this.P.prikaz(text === '' ? 'Vymazat' : 'Psaní', () => {
        for (const o of cile) {
          for (let r = o.r1; r <= Math.min(o.r2, o.r1 + 5000); r++) for (let c = o.c1; c <= Math.min(o.c2, o.c1 + 500); c++) {
            const t = text[0] === '=' && (r !== e.r || c !== e.c) ? posunVzorec(text, r - e.r, c - e.c) : text;
            this.S.zadej(list, r, c, t);
          }
        }
        this.P.poZadani?.(list, cile);
      }, { chyba: (err) => { this.P.zprava(err.message.includes('vzorci') ? 'Při zpracování tohoto vzorce došlo k potížím.\n\nNechcete zadat vzorec? Pokud zadáte do buňky text, který začíná znakem „=“ nebo „-“, AstroTabulky ho považují za vzorec. Nápravu provedete tak, že na začátek napíšete apostrof (\').' : err.message); } });
      this.ukladam = false;
      if (ok === false) { (this.edit?.zdroj || this.editor).focus(); return false; }
      if (this.kopie && !this.kopie.stetec) this.kopie = null;   // zápis do buňky ukončí režim kopírování (jako Excel)
    }
    this.ukonciEditaci();
    if (list !== this.list) this.P.prepniNaList(list);
    if (smer) {
      const [dr, dc] = { dolu: [1, 0], nahoru: [-1, 0], vpravo: [0, 1], vlevo: [0, -1] }[smer];
      if (tab) this.pohybVeVyberu(0, dc);
      else this.pohybVeVyberu(dr, dc);
    } else this.prekresli();
    return true;
  }

  zrusEditaci() {
    this.ukonciEditaci();
    this.prekresli();
    this.P.poEditaci?.();
  }

  ukonciEditaci() {
    this.edit = null;
    this.editor.hidden = true;
    this.editor.textContent = '';
    this.naseptavac.hidden = true;
    this.napovedaArg.hidden = true;
    this.odkazyEditace = [];
    this.fokus();
    this.P.poEditaci?.();
    this.P.poZmeneVyberu?.();
  }

  /** Editace začatá v řádku vzorců. */
  zacniVRadkuVzorcu(elm) {
    if (!this.edit) {
      if (this.P.zamcenaAktivni?.()) { this.P.hlaskaZamek(); elm.blur(); return false; }
      const v = this.vyber;
      const m = this.S.sloucenaV(this.list, v.r, v.c);
      const r = m ? m.r1 : v.r, c = m ? m.c1 : v.c;
      const puvodni = this.textProEditaci(r, c);
      this.edit = { r, c, list: this.list, rezim: 'upravit', puvodni, text: puvodni, zdroj: elm };
      this.editor.hidden = false;
      const s = this.S.stylBunky(this.list, r, c) || {};
      this.editor.style.font = pismoCanvas(s, this.z);
      this.editor.style.background = s.pozadi || '#FFFFFF';
      this.editor.style.color = s.barva || '#000';
      this.kresliEditor(this.editor, puvodni, puvodni.length);
      this.poziceEditoru();
      this.aktualizujOdkazy();
      this.prekresli();
    }
    this.edit.zdroj = elm;
    this.edit.rezim = 'upravit';
    this.P.poEditaci?.();
    return true;
  }

  // ------------------------------------------------------------ schránka
  kopiruj(e, vyjmout) {
    if (this.edit) return;
    e.preventDefault();
    this.klav.value = '';
    this.P.kopiruj(vyjmout, e.clipboardData);
  }
  vlozUdalost(e) {
    if (this.edit) return;
    e.preventDefault();
    this.P.vlozZeSchranky(e.clipboardData);
  }
}

export { setCaret, caretOffset, selectionOffsets, obarvi };
