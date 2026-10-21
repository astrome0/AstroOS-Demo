// AstroPrezentace — plátno snímku v normálním zobrazení: výběr objektů, tažení s inteligentními vodítky,
// změna velikosti a otočení, kreslení nových tvarů, úprava textu (contenteditable) a formátování textu.

import { el } from '../util.js';
import { kresliSnimek, kresliObjekt, kontextSnimku, poVlozeni, prizpusobText, oznacOdstavce, potrebnaVyska, jeCara, jeTelo, vychoziOdrazka } from './render.js';
import { noveId, kopie, jePrazdnyText } from './model.js';
import { VELIKOSTI_PISMA } from '../pismo/dokument.js';

const MARGIN = 26;       // okraj šedé plochy kolem snímku (px)
const ROH = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const SMERY = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
const KURZORY = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

/** Uklidí HTML po contenteditable: <font> → <span style>, <div> → <p>, prázdné spany pryč. */
export function vycistiHtml(root) {
  root.querySelectorAll('font').forEach((f) => {
    const s = document.createElement('span');
    if (f.size === '7' && root.dataset.vel) s.style.fontSize = root.dataset.vel + 'px';
    if (f.face) s.style.fontFamily = f.face;
    if (f.color) s.style.color = f.color;
    s.append(...f.childNodes);
    f.replaceWith(s);
  });
  // přímé textové uzly a <div> → odstavce
  for (const n of [...root.childNodes]) {
    if (n.nodeType === 3 && n.textContent.trim()) { const p = document.createElement('p'); n.replaceWith(p); p.append(n); }
    else if (n.nodeType === 3) n.remove();
    else if (n.tagName === 'DIV') { const p = document.createElement('p'); for (const a of n.attributes) p.setAttribute(a.name, a.value); p.append(...n.childNodes); n.replaceWith(p); }
    else if (n.tagName === 'BR') n.remove();
    else if (n.tagName !== 'P') { const p = document.createElement('p'); n.replaceWith(p); p.append(n); }
  }
  root.querySelectorAll('span').forEach((s) => { if (!s.getAttribute('style') && !s.className) s.replaceWith(...s.childNodes); });
  root.querySelectorAll('p').forEach((p) => { p.classList.remove('prazdny', 'cislo'); if (!p.className) p.removeAttribute('class'); delete p.dataset.b; if (!p.childNodes.length) p.innerHTML = '<br>'; });
  if (!root.querySelector('p')) root.innerHTML = '<p><br></p>';
  return root.innerHTML;
}

export class Editor {
  constructor(P) {
    this.P = P;
    this.z = 1;
    this.prizpusobit = true;
    this.vyber = [];            // id vybraných objektů
    this.upravuje = null;       // id objektu, jehož text se upravuje
    this.vkladani = null;       // { typ: 'tvar', tvar } | { typ: 'text' }
    this.schranka = null;

    this.plocha = el('div.pr-plocha', { tabindex: '-1' });
    this.obal = el('div.pr-platno-obal');
    this.snObal = el('div.pr-sn-obal');
    this.vrstva = el('div.pr-vrstva');
    this.vodVrstva = el('div.pr-vodítka');
    this.mrizkaVrstva = el('div.pr-mrizka-vrstva');
    this.obal.append(this.snObal, this.mrizkaVrstva, this.vodVrstva, this.vrstva);
    this.plocha.append(this.obal);
    this.skryteSchranka = el('div.pr-skryty-editor', { contenteditable: 'true' });
    document.body.append(this.skryteSchranka);

    this.plocha.addEventListener('pointerdown', (e) => this.mysDolu(e));
    this.plocha.addEventListener('dblclick', (e) => this.dvojklik(e));
    this.plocha.addEventListener('contextmenu', (e) => this.kontext(e));
    this.plocha.addEventListener('keydown', (e) => this.klavesa(e));
    this.plocha.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      P.lupa(Math.round(this.z * 100) + (e.deltaY < 0 ? 10 : -10));
    }, { passive: false });
    this.plocha.addEventListener('pointermove', (e) => this.kurzor(e));
    // přizpůsobení až v dalším snímku — jinak změna velikosti v callbacku spustí „ResizeObserver loop“
    this.ro = new ResizeObserver(() => {
      cancelAnimationFrame(this.roCeka);
      this.roCeka = requestAnimationFrame(() => { if (this.prizpusobit) this.prizpusob(); else this.umisti(); });
    });
    this.ro.observe(this.plocha);
  }

  get pres() { return this.P.pres; }
  get s() { return this.P.snimek(); }
  get W() { return this.pres.velikost.w; }
  get H() { return this.pres.velikost.h; }
  objekt(id) { return this.s?.objekty.find((o) => o.id === id); }
  vybrane() { return this.vyber.map((id) => this.objekt(id)).filter(Boolean); }
  uzel(id) { return this.snObal.querySelector(`.pr-o[data-id="${id}"]`); }

  znic() { this.ro.disconnect(); this.skryteSchranka.remove(); }

  // ------------------------------------------------------------ měřítko
  prizpusob() {
    const pw = this.plocha.clientWidth, ph = this.plocha.clientHeight;
    if (!pw || !ph) return;
    const z = Math.max(0.1, Math.min((pw - MARGIN * 2) / this.W, (ph - MARGIN * 2) / this.H));
    this.nastavZoom(z, true);
  }
  nastavZoom(z, prizpusobit = false) {
    this.prizpusobit = prizpusobit;
    this.z = Math.max(0.1, Math.min(4, z));
    this.umisti();
    this.P.poZmeneZoomu?.();
  }
  umisti() {
    const z = this.z, w = this.W * z, h = this.H * z;
    const pw = this.plocha.clientWidth, ph = this.plocha.clientHeight;
    const ow = Math.max(pw, w + MARGIN * 2), oh = Math.max(ph, h + MARGIN * 2);
    Object.assign(this.obal.style, { width: ow + 'px', height: oh + 'px' });
    this.obal.style.setProperty('--z', z);
    const x = Math.round((ow - w) / 2), y = Math.round((oh - h) / 2);
    for (const v of [this.snObal, this.vrstva, this.vodVrstva, this.mrizkaVrstva]) Object.assign(v.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const sn = this.snObal.firstElementChild;
    if (sn) sn.style.transform = `scale(${z})`;
    this.kresliMrizku();
    this.kresliVyber();
  }

  // ------------------------------------------------------------ vykreslení
  kresli() {
    const s = this.s;
    if (!s) { this.snObal.replaceChildren(); this.vrstva.replaceChildren(); return; }
    const sn = kresliSnimek(this.pres, s, { editor: true, upravuje: this.upravuje });
    sn.style.transform = `scale(${this.z})`;
    sn.style.transformOrigin = '0 0';
    this.snObal.replaceChildren(sn);
    poVlozeni(sn, this.pres, s);
    this.vyber = this.vyber.filter((id) => this.objekt(id));
    if (this.upravuje) {
      if (!this.objekt(this.upravuje)) this.upravuje = null;
      else this.aktivujUpravy(this.upravuje, null, true);
    }
    this.umisti();
  }

  /** Překreslí jen jeden objekt (po změně formátu, bez ztráty ostatních stavů). */
  kresliObjekt(id) {
    const o = this.objekt(id);
    const stary = this.uzel(id);
    if (!o || !stary) { this.kresli(); return; }
    const novy = kresliObjekt(o, kontextSnimku(this.pres, this.s), { editor: true, upravuje: this.upravuje === id });
    stary.replaceWith(novy);
    prizpusobText(novy, o);
    return novy;
  }

  bod(e) {
    const r = this.snObal.getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.z, y: (e.clientY - r.top) / this.z };
  }

  /** Objekt pod bodem (odshora), s ohledem na otočení. */
  zasah(x, y) {
    const obj = this.s?.objekty || [];
    for (let i = obj.length - 1; i >= 0; i--) {
      const o = obj[i];
      if (o.skryty || o.zamceny) continue;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const a = -(o.rot || 0) * Math.PI / 180;
      const lx = Math.cos(a) * (x - cx) - Math.sin(a) * (y - cy);
      const ly = Math.sin(a) * (x - cx) + Math.cos(a) * (y - cy);
      if (o.typ === 'tvar' && jeCara(o.tvar)) {
        // vzdálenost od úsečky
        const [x1, y1, x2, y2] = this.koncoveBody(o);
        const d = vzdalenostOdUsecky(x, y, x1, y1, x2, y2);
        if (d < 6 / this.z + (o.obrysW || 1.5) / 2) return o;
        continue;
      }
      const tol = 3 / this.z;
      if (Math.abs(lx) <= o.w / 2 + tol && Math.abs(ly) <= o.h / 2 + tol) {
        // prázdné textové pole bez výplně je „průhledné“ jen mimo okraj — PowerPoint ho vybere i tak
        return o;
      }
    }
    return null;
  }
  koncoveBody(o) {
    const x1 = o.flipH ? o.x + o.w : o.x, y1 = o.flipV ? o.y + o.h : o.y;
    const x2 = o.flipH ? o.x : o.x + o.w, y2 = o.flipV ? o.y : o.y + o.h;
    return [x1, y1, x2, y2];
  }

  // ------------------------------------------------------------ výběr
  vyberObjekty(ids, { pridat = false } = {}) {
    if (this.upravuje && !ids.includes(this.upravuje)) this.ukonciUpravy();
    this.vyber = pridat ? [...new Set([...this.vyber, ...ids])] : ids;
    this.kresliVyber();
    this.P.poZmeneVyberu?.();
  }
  zrusVyber() { this.vyberObjekty([]); }

  kresliVyber() {
    const z = this.z;
    const v = this.vrstva;
    v.replaceChildren();
    for (const o of this.vybrane()) {
      if (o.typ === 'tvar' && jeCara(o.tvar)) {
        const [x1, y1, x2, y2] = this.koncoveBody(o);
        for (const [x, y, k] of [[x1, y1, 'a'], [x2, y2, 'b']]) {
          const u = el('div.pr-uchyt.bod', { dataset: { id: o.id, konec: k }, style: { left: x * z + 'px', top: y * z + 'px' } });
          v.append(u);
        }
        continue;
      }
      const ram = el('div.pr-vyb' + (this.upravuje === o.id ? '.upravuje' : '') + (this.vyber.length > 1 ? '.vice' : ''), { dataset: { id: o.id } });
      Object.assign(ram.style, { left: o.x * z + 'px', top: o.y * z + 'px', width: o.w * z + 'px', height: o.h * z + 'px', transform: o.rot ? `rotate(${o.rot}deg)` : '' });
      if (!o.zamceny) {
        for (const h of ROH) {
          if ((h === 'n' || h === 's') && o.h * z < 22) continue;
          if ((h === 'e' || h === 'w') && o.w * z < 22) continue;
          ram.append(el('div.pr-uchyt', { dataset: { h, id: o.id }, style: { cursor: kurzorOtoceny(h, o.rot || 0) } }));
        }
        if (o.typ !== 'tabulka') ram.append(el('div.pr-otoc', { dataset: { id: o.id }, title: 'Otočit', html: '<svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.6-3.7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12.8 1.6v3.2H9.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' }));
      }
      v.append(ram);
    }
    // prázdné zástupné symboly a textová pole bez obrysu mají v editoru tenký rámeček
    this.P.poKresleniVyberu?.();
  }

  kresliMrizku() {
    const P = this.P;
    const m = this.mrizkaVrstva;
    m.replaceChildren();
    const z = this.z;
    if (P.st.mrizka) {
      const krok = (P.st.krokMrizky || 18) * z;
      m.style.backgroundImage = `radial-gradient(circle, rgba(0,0,0,.45) 0.8px, transparent 1.2px)`;
      m.style.backgroundSize = `${krok}px ${krok}px`;
      m.style.backgroundPosition = `${-krok / 2}px ${-krok / 2}px`;
    } else m.style.backgroundImage = '';
    if (P.st.voditka) {
      m.append(el('div.pr-voditko.svisle', { style: { left: (this.W / 2) * z + 'px' } }), el('div.pr-voditko.vodorovne', { style: { top: (this.H / 2) * z + 'px' } }));
    }
  }

  kurzor(e) {
    if (this.tazeni) return;
    if (this.vkladani) { this.plocha.style.cursor = 'crosshair'; return; }
    const t = e.target;
    if (t.closest('.pr-uchyt, .pr-otoc')) { this.plocha.style.cursor = ''; return; }
    if (!t.closest('.pr-sn-obal, .pr-vrstva')) { this.plocha.style.cursor = ''; return; }
    const { x, y } = this.bod(e);
    const o = this.zasah(x, y);
    if (!o) { this.plocha.style.cursor = ''; return; }
    if (this.upravuje === o.id) { this.plocha.style.cursor = 'text'; return; }
    // nad textem = textový kurzor, nad okrajem = přesun
    const maText = (o.typ === 'text' || (o.typ === 'tvar' && !jeCara(o.tvar)));
    const naOkraji = this.naOkraji(o, x, y);
    this.plocha.style.cursor = maText && !naOkraji && (o.typ === 'text' || this.vyber.includes(o.id)) ? 'text' : 'move';
  }
  naOkraji(o, x, y) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const a = -(o.rot || 0) * Math.PI / 180;
    const lx = Math.cos(a) * (x - cx) - Math.sin(a) * (y - cy);
    const ly = Math.sin(a) * (x - cx) + Math.cos(a) * (y - cy);
    const t = 6 / this.z;
    return Math.abs(lx) > o.w / 2 - t || Math.abs(ly) > o.h / 2 - t;
  }

  // ------------------------------------------------------------ myš
  mysDolu(e) {
    const P = this.P;
    if (e.button === 1) return;
    P.zavriPlovouci?.();
    const t = e.target;
    // zástupný symbol: ikony „vložit tabulku / graf / obrázek…“
    const ikona = t.closest('.pr-ph-ik');
    if (ikona && e.button === 0) {
      e.preventDefault();
      const id = ikona.closest('.pr-o')?.dataset.id;
      this.vyberObjekty([id]);
      P.vlozDoZastupneho?.(ikona.dataset.vloz, id);
      return;
    }
    if (e.button === 2) {
      const { x, y } = this.bod(e);
      const o = this.zasah(x, y);
      if (this.upravuje && o?.id === this.upravuje) return;   // pravé tlačítko v textu = nabídka textu
      if (o && !this.vyber.includes(o.id)) this.vyberObjekty([o.id]);
      if (!o) { if (this.upravuje) this.ukonciUpravy(); this.zrusVyber(); }
      return;
    }
    const uchyt = t.closest('.pr-uchyt');
    if (uchyt) { e.preventDefault(); e.stopPropagation(); if (uchyt.dataset.konec) this.tahniKonec(e, uchyt.dataset.id, uchyt.dataset.konec); else this.tahniVelikost(e, uchyt.dataset.id, uchyt.dataset.h); return; }
    const otoc = t.closest('.pr-otoc');
    if (otoc) { e.preventDefault(); e.stopPropagation(); this.tahniOtoceni(e, otoc.dataset.id); return; }

    if (!t.closest('.pr-sn-obal, .pr-vrstva, .pr-platno-obal')) return;
    const { x, y } = this.bod(e);
    if (this.vkladani) { e.preventDefault(); this.kresliNovy(e, x, y); return; }

    // klik do upravovaného textu nechá prohlížeč umístit kurzor
    if (this.upravuje) {
      const u = this.uzel(this.upravuje);
      const o = this.objekt(this.upravuje);
      if (u && o && t.closest('.pr-o') === u && !this.naOkraji(o, x, y)) return;
      this.ukonciUpravy();
    }
    const o = this.zasah(x, y);
    this.plocha.focus({ preventScroll: true });
    if (!o) {
      e.preventDefault();
      if (!e.shiftKey && !e.ctrlKey) this.zrusVyber();
      this.tahniVyber(e, x, y);
      return;
    }
    e.preventDefault();
    if (e.shiftKey || e.ctrlKey) {
      if (this.vyber.includes(o.id) && !e.ctrlKey) { this.vyberObjekty(this.vyber.filter((i) => i !== o.id)); return; }
      this.vyberObjekty([o.id], { pridat: true });
    } else if (!this.vyber.includes(o.id)) this.vyberObjekty([o.id]);
    this.tahniPresun(e, o, x, y);
  }

  dvojklik(e) {
    if (this.vkladani || this.upravuje) return;
    const { x, y } = this.bod(e);
    const o = this.zasah(x, y);
    if (!o) return;
    if (o.typ === 'obrazek') { this.P.prepniKartu?.('obrFormat'); return; }
    if (o.typ === 'graf') { this.P.upravDataGrafu?.(o.id); return; }
    if (o.typ === 'tvar' && jeCara(o.tvar)) { this.P.podokno?.('format'); return; }
    if (o.typ === 'text' || o.typ === 'tvar' || o.typ === 'tabulka') this.zacniUpravy(o.id, { x: e.clientX, y: e.clientY, vybratSlovo: true });
  }

  sledujTazeni(e, pohyb, konec) {
    this.tazeni = true;
    const mv = (ev) => pohyb(ev);
    const up = (ev) => {
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
      removeEventListener('keydown', esc, true);
      this.tazeni = false;
      this.vodVrstva.replaceChildren();
      konec?.(ev);
    };
    const esc = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); this.zrusenoTazeni = true; up(ev); } };
    this.zrusenoTazeni = false;
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
    addEventListener('keydown', esc, true);
  }

  /** Přesun vybraných objektů (Ctrl = kopie, Shift = jen svisle/vodorovně, Alt = bez přichytávání). */
  tahniPresun(e, o, x0, y0) {
    const P = this.P;
    const start = this.vybrane().map((x) => ({ o: x, x: x.x, y: x.y }));
    let pohnuto = false, kopie = false;
    const cx0 = e.clientX, cy0 = e.clientY;
    this.sledujTazeni(e, (ev) => {
      if (!pohnuto && Math.hypot(ev.clientX - cx0, ev.clientY - cy0) < 4) return;
      pohnuto = true;
      kopie = ev.ctrlKey;
      this.plocha.style.cursor = kopie ? 'copy' : 'move';
      const { x, y } = this.bod(ev);
      let dx = x - x0, dy = y - y0;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      // přichytávání k vodítkům podle obálky výběru
      const ob = obalka(start.map((s) => ({ ...s.o, x: s.x + dx, y: s.y + dy })));
      if (!ev.altKey) { const [sx, sy] = this.prichyt(ob, new Set(this.vyber)); dx += sx; dy += sy; }
      for (const s of start) {
        const u = this.uzel(s.o.id);
        if (u) { u.style.left = s.x + dx + 'px'; u.style.top = s.y + dy + 'px'; }
      }
      this.posunVyber(dx, dy);
      this.posledni = { dx, dy };
    }, () => {
      if (!pohnuto) {
        // klik bez tažení na text = začít psát (jako v PowerPointu)
        if ((o.typ === 'text' || (o.typ === 'tvar' && !jeCara(o.tvar))) && this.vyber.length === 1 && !this.naOkraji(o, x0, y0) && (o.typ === 'text' || this.vybranoPredtim === o.id)) {
          this.zacniUpravy(o.id, { x: cx0, y: cy0 });
        }
        this.vybranoPredtim = o.id;
        return;
      }
      if (this.zrusenoTazeni) { this.kresli(); return; }
      const { dx, dy } = this.posledni;
      if (kopie) {
        P.prikaz('Duplikovat', () => {
          const nove = start.map((st) => ({ ...kopieObjektu(st.o), x: st.x + dx, y: st.y + dy }));
          this.s.objekty.push(...nove);
          this.vyber = nove.map((n) => n.id);
        });
      } else {
        P.prikaz('Přesunout', () => { for (const st of start) { st.o.x = st.x + dx; st.o.y = st.y + dy; } });
      }
    });
  }
  posunVyber(dx, dy) {
    for (const ram of this.vrstva.children) {
      const o = this.objekt(ram.dataset.id);
      if (!o) continue;
      if (ram.classList.contains('bod')) continue;
      ram.style.left = (o.x + dx) * this.z + 'px';
      ram.style.top = (o.y + dy) * this.z + 'px';
    }
  }

  /** Inteligentní vodítka: přichycení obálky k okrajům/středům snímku a ostatních objektů. Vrací posun [sx, sy]. */
  prichyt(ob, bez) {
    const P = this.P;
    const tol = 6 / this.z;
    const cilX = [0, this.W / 2, this.W], cilY = [0, this.H / 2, this.H];
    const zdrojeX = [], zdrojeY = [];
    for (const o of this.s.objekty) {
      if (bez.has(o.id) || o.skryty) continue;
      zdrojeX.push([o.x, o], [o.x + o.w / 2, o], [o.x + o.w, o]);
      zdrojeY.push([o.y, o], [o.y + o.h / 2, o], [o.y + o.h, o]);
    }
    const hrany = (a, d) => [a, a + d / 2, a + d];
    let nejX = null, nejY = null;
    for (const v of hrany(ob.x, ob.w)) {
      for (const c of cilX) if (Math.abs(c - v) < tol && (!nejX || Math.abs(c - v) < Math.abs(nejX.d))) nejX = { d: c - v, c, slide: true };
      for (const [c, o] of zdrojeX) if (Math.abs(c - v) < tol && (!nejX || Math.abs(c - v) < Math.abs(nejX.d))) nejX = { d: c - v, c, o };
    }
    for (const v of hrany(ob.y, ob.h)) {
      for (const c of cilY) if (Math.abs(c - v) < tol && (!nejY || Math.abs(c - v) < Math.abs(nejY.d))) nejY = { d: c - v, c, slide: true };
      for (const [c, o] of zdrojeY) if (Math.abs(c - v) < tol && (!nejY || Math.abs(c - v) < Math.abs(nejY.d))) nejY = { d: c - v, c, o };
    }
    // mřížka (Přichytit objekty k mřížce)
    if (P.st.prichytMrizka && !nejX) { const k = P.st.krokMrizky || 18; const d = Math.round(ob.x / k) * k - ob.x; if (Math.abs(d) < tol) nejX = { d, c: ob.x + d, mrizka: true }; }
    if (P.st.prichytMrizka && !nejY) { const k = P.st.krokMrizky || 18; const d = Math.round(ob.y / k) * k - ob.y; if (Math.abs(d) < tol) nejY = { d, c: ob.y + d, mrizka: true }; }
    this.vodVrstva.replaceChildren();
    const z = this.z;
    if (nejX && !nejX.mrizka) {
      const y1 = Math.min(ob.y, nejX.o ? nejX.o.y : 0), y2 = Math.max(ob.y + ob.h, nejX.o ? nejX.o.y + nejX.o.h : this.H);
      this.vodVrstva.append(el('div.pr-voditko-chytre.svisle', { style: { left: nejX.c * z + 'px', top: (nejX.slide ? 0 : y1) * z + 'px', height: ((nejX.slide ? this.H : y2 - y1)) * z + 'px' } }));
    }
    if (nejY && !nejY.mrizka) {
      const x1 = Math.min(ob.x, nejY.o ? nejY.o.x : 0), x2 = Math.max(ob.x + ob.w, nejY.o ? nejY.o.x + nejY.o.w : this.W);
      this.vodVrstva.append(el('div.pr-voditko-chytre.vodorovne', { style: { top: nejY.c * z + 'px', left: (nejY.slide ? 0 : x1) * z + 'px', width: ((nejY.slide ? this.W : x2 - x1)) * z + 'px' } }));
    }
    return [nejX?.d || 0, nejY?.d || 0];
  }

  tahniVelikost(e, id, h) {
    const P = this.P;
    const o = this.objekt(id);
    if (!o) return;
    const [dx, dy] = SMERY[h];
    const s0 = { x: o.x, y: o.y, w: o.w, h: o.h };
    const rad = (o.rot || 0) * Math.PI / 180;
    const ex = [Math.cos(rad), Math.sin(rad)], ey = [-Math.sin(rad), Math.cos(rad)];
    const C = [o.x + o.w / 2, o.y + o.h / 2];
    const zamekPomeru = o.typ === 'obrazek' || o.typ === 'ikona' || o.zamekPomeru;
    let vysledek = null;
    this.sledujTazeni(e, (ev) => {
      const p = this.bod(ev);
      const zeStredu = ev.ctrlKey;
      const ax = zeStredu ? 0 : -dx * s0.w / 2, ay = zeStredu ? 0 : -dy * s0.h / 2;
      const A = [C[0] + ex[0] * ax + ey[0] * ay, C[1] + ex[1] * ax + ey[1] * ay];
      const v = [p.x - A[0], p.y - A[1]];
      const lx = v[0] * ex[0] + v[1] * ex[1], ly = v[0] * ey[0] + v[1] * ey[1];
      const k = zeStredu ? 2 : 1;
      let w = dx ? Math.max(4, lx * dx * k) : s0.w;
      let hh = dy ? Math.max(4, ly * dy * k) : s0.h;
      const pomer = (dx && dy) && (zamekPomeru ? !ev.shiftKey : ev.shiftKey);
      if (pomer) { const sc = Math.max(w / s0.w, hh / s0.h); w = s0.w * sc; hh = s0.h * sc; }
      const cx = zeStredu ? C[0] : A[0] + ex[0] * (dx * w / 2) + ey[0] * (dy * hh / 2) + (dx ? 0 : ex[0] * 0);
      const cy = zeStredu ? C[1] : A[1] + ex[1] * (dx * w / 2) + ey[1] * (dy * hh / 2);
      // strana, která se nemění, drží svou polohu podél své osy
      let ncx = cx, ncy = cy;
      if (!zeStredu && !dx) { ncx = A[0] + ey[0] * (dy * hh / 2); ncy = A[1] + ey[1] * (dy * hh / 2); }
      if (!zeStredu && !dy) { ncx = A[0] + ex[0] * (dx * w / 2); ncy = A[1] + ex[1] * (dx * w / 2); }
      let r = { x: ncx - w / 2, y: ncy - hh / 2, w, h: hh };
      // přichytávání hrany při neotočeném objektu
      if (!o.rot && !ev.altKey) {
        const [sx, sy] = this.prichytHranu(r, dx, dy, id);
        if (dx < 0) { r.x += sx; r.w -= sx; } else if (dx > 0) r.w += sx;
        if (dy < 0) { r.y += sy; r.h -= sy; } else if (dy > 0) r.h += sy;
      }
      vysledek = r;
      const u = this.uzel(id);
      if (u) {
        Object.assign(u.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        this.nahledTvaru(u, o, r);
      }
      const ram = this.vrstva.querySelector(`.pr-vyb[data-id="${id}"]`);
      if (ram) Object.assign(ram.style, { left: r.x * this.z + 'px', top: r.y * this.z + 'px', width: r.w * this.z + 'px', height: r.h * this.z + 'px' });
    }, () => {
      if (!vysledek || this.zrusenoTazeni) { this.kresli(); return; }
      const r = vysledek;
      P.prikaz('Změnit velikost', () => {
        const k = r.h / s0.h;
        Object.assign(o, { x: r.x, y: r.y, w: r.w, h: r.h });
        if (o.rust && dy) o.rust = false;   // ruční výška vypne automatický růst
        if (o.typ === 'tabulka' && o.tab.vysky && dy) o.tab.vysky = o.tab.vysky.map((v) => v * k);
      });
    });
  }
  /** Během tažení překreslí tvar v nové velikosti (jinak by se SVG deformovalo). */
  nahledTvaru(u, o, r) {
    const novy = kresliObjekt({ ...o, ...r }, kontextSnimku(this.pres, this.s), { editor: true });
    u.replaceChildren(...novy.childNodes);
  }
  prichytHranu(r, dx, dy, id) {
    const tol = 6 / this.z;
    const xs = [0, this.W / 2, this.W], ys = [0, this.H / 2, this.H];
    for (const o of this.s.objekty) if (o.id !== id && !o.skryty) { xs.push(o.x, o.x + o.w, o.x + o.w / 2); ys.push(o.y, o.y + o.h, o.y + o.h / 2); }
    const hx = dx < 0 ? r.x : dx > 0 ? r.x + r.w : null;
    const hy = dy < 0 ? r.y : dy > 0 ? r.y + r.h : null;
    let sx = 0, sy = 0;
    this.vodVrstva.replaceChildren();
    if (hx !== null) { const c = xs.reduce((a, b) => (Math.abs(b - hx) < Math.abs(a - hx) ? b : a), Infinity); if (Math.abs(c - hx) < tol) { sx = c - hx; this.vodVrstva.append(el('div.pr-voditko-chytre.svisle', { style: { left: c * this.z + 'px', top: 0, height: this.H * this.z + 'px' } })); } }
    if (hy !== null) { const c = ys.reduce((a, b) => (Math.abs(b - hy) < Math.abs(a - hy) ? b : a), Infinity); if (Math.abs(c - hy) < tol) { sy = c - hy; this.vodVrstva.append(el('div.pr-voditko-chytre.vodorovne', { style: { top: c * this.z + 'px', left: 0, width: this.W * this.z + 'px' } })); } }
    return [sx, sy];
  }

  tahniKonec(e, id, konec) {
    const o = this.objekt(id);
    const [x1, y1, x2, y2] = this.koncoveBody(o);
    let vysledek = null;
    this.sledujTazeni(e, (ev) => {
      let { x, y } = this.bod(ev);
      const [fx, fy] = konec === 'a' ? [x2, y2] : [x1, y1];
      if (ev.shiftKey) {
        const a = Math.round(Math.atan2(y - fy, x - fx) / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(x - fx, y - fy);
        x = fx + Math.cos(a) * d; y = fy + Math.sin(a) * d;
      }
      const [ax, ay, bx, by] = konec === 'a' ? [x, y, fx, fy] : [fx, fy, x, y];
      vysledek = { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay), flipH: bx < ax, flipV: by < ay };
      const u = this.uzel(id);
      if (u) {
        const n = kresliObjekt({ ...o, ...vysledek }, kontextSnimku(this.pres, this.s), { editor: true });
        u.replaceWith(n);
      }
      const body = this.vrstva.querySelectorAll(`.pr-uchyt.bod[data-id="${id}"]`);
      body.forEach((b) => { const jeA = b.dataset.konec === 'a'; b.style.left = (jeA ? ax : bx) * this.z + 'px'; b.style.top = (jeA ? ay : by) * this.z + 'px'; });
    }, () => {
      if (!vysledek || this.zrusenoTazeni) { this.kresli(); return; }
      this.P.prikaz('Upravit čáru', () => Object.assign(o, vysledek));
    });
  }

  tahniOtoceni(e, id) {
    const o = this.objekt(id);
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    let uhel = o.rot || 0;
    this.sledujTazeni(e, (ev) => {
      const { x, y } = this.bod(ev);
      uhel = Math.atan2(y - cy, x - cx) * 180 / Math.PI + 90;
      if (ev.shiftKey) uhel = Math.round(uhel / 15) * 15;
      uhel = ((uhel % 360) + 360) % 360;
      if (uhel > 359.5 || uhel < 0.5) uhel = 0;
      const u = this.uzel(id);
      if (u) u.style.transform = `rotate(${uhel}deg)` + (o.flipH ? ' scaleX(-1)' : '') + (o.flipV ? ' scaleY(-1)' : '');
      const ram = this.vrstva.querySelector(`.pr-vyb[data-id="${id}"]`);
      if (ram) ram.style.transform = `rotate(${uhel}deg)`;
      this.plocha.style.cursor = 'grabbing';
    }, () => {
      this.plocha.style.cursor = '';
      if (this.zrusenoTazeni) { this.kresli(); return; }
      this.P.prikaz('Otočit', () => { o.rot = Math.round(uhel * 10) / 10; });
    });
  }

  tahniVyber(e, x0, y0) {
    const box = el('div.pr-laso');
    this.vrstva.append(box);
    const puvodni = e.shiftKey || e.ctrlKey ? [...this.vyber] : [];
    this.sledujTazeni(e, (ev) => {
      const { x, y } = this.bod(ev);
      const r = { x: Math.min(x, x0), y: Math.min(y, y0), w: Math.abs(x - x0), h: Math.abs(y - y0) };
      Object.assign(box.style, { left: r.x * this.z + 'px', top: r.y * this.z + 'px', width: r.w * this.z + 'px', height: r.h * this.z + 'px' });
      this.lasoObd = r;
    }, () => {
      box.remove();
      const r = this.lasoObd;
      this.lasoObd = null;
      if (!r || r.w < 2 || r.h < 2) return;
      const uvnitr = this.s.objekty.filter((o) => !o.skryty && !o.zamceny && o.x >= r.x && o.y >= r.y && o.x + o.w <= r.x + r.w && o.y + o.h <= r.y + r.h).map((o) => o.id);
      this.vyberObjekty([...new Set([...puvodni, ...uvnitr])]);
    });
  }

  // ------------------------------------------------------------ nové objekty
  zacniVkladani(v) {
    if (this.upravuje) this.ukonciUpravy();
    this.vkladani = v;
    this.plocha.style.cursor = 'crosshair';
    this.plocha.classList.add('vkladani');
    this.P.toastStav?.(v.typ === 'text' ? 'Klikněte nebo táhněte na snímku a vytvořte textové pole.' : 'Klikněte nebo táhněte na snímku a nakreslete obrazec.');
  }
  zrusVkladani() {
    this.vkladani = null;
    this.plocha.style.cursor = '';
    this.plocha.classList.remove('vkladani');
    this.P.toastStav?.(null);
  }
  kresliNovy(e, x0, y0) {
    const v = this.vkladani;
    const cara = v.typ === 'tvar' && jeCara(v.tvar);
    const box = el('div.pr-laso.novy' + (cara ? '.cara' : ''));
    this.vrstva.append(box);
    let r = null;
    this.sledujTazeni(e, (ev) => {
      let { x, y } = this.bod(ev);
      if (ev.shiftKey && !cara) { const d = Math.max(Math.abs(x - x0), Math.abs(y - y0)); x = x0 + Math.sign(x - x0 || 1) * d; y = y0 + Math.sign(y - y0 || 1) * d; }
      if (ev.shiftKey && cara) { const a = Math.round(Math.atan2(y - y0, x - x0) / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(x - x0, y - y0); x = x0 + Math.cos(a) * d; y = y0 + Math.sin(a) * d; }
      r = { x: Math.min(x, x0), y: Math.min(y, y0), w: Math.abs(x - x0), h: Math.abs(y - y0), flipH: x < x0, flipV: y < y0 };
      if (cara) {
        const d = Math.hypot(x - x0, y - y0), a = Math.atan2(y - y0, x - x0);
        Object.assign(box.style, { left: x0 * this.z + 'px', top: y0 * this.z + 'px', width: d * this.z + 'px', height: '0', transform: `rotate(${a}rad)` });
      } else Object.assign(box.style, { left: r.x * this.z + 'px', top: r.y * this.z + 'px', width: r.w * this.z + 'px', height: r.h * this.z + 'px' });
    }, () => {
      box.remove();
      const drzet = this.vkladani?.opakovat;
      if (!drzet) this.zrusVkladani();
      if (this.zrusenoTazeni) return;
      const kliknuto = !r || (r.w < 3 && r.h < 3);
      if (kliknuto) r = v.typ === 'text' ? { x: x0, y: y0, w: 200, h: 40 } : cara ? { x: x0, y: y0, w: 96, h: 0 } : { x: x0 - 0, y: y0, w: 96, h: 96 };
      let novy;
      if (v.typ === 'text') {
        novy = { id: noveId(), typ: 'text', x: r.x, y: r.y, w: Math.max(r.w, 60), h: 40, rot: 0, html: '<p><br></p>', rust: true, vel: 18, zalomit: !kliknuto };
      } else {
        novy = { id: noveId(), typ: 'tvar', tvar: v.tvar, x: r.x, y: r.y, w: r.w, h: r.h, rot: 0, html: '' };
        if (cara) { novy.flipH = !!r.flipH; novy.flipV = !!r.flipV; novy.obrys = 'a1'; novy.obrysW = 1.5; }
        if (v.tvar === 'textove') { novy.typ = 'text'; novy.rust = false; novy.vel = 18; novy.html = '<p><br></p>'; delete novy.tvar; }
      }
      this.P.prikaz(v.typ === 'text' ? 'Textové pole' : 'Vložit obrazec', () => { this.s.objekty.push(novy); this.vyber = [novy.id]; });
      if (novy.typ === 'text') this.zacniUpravy(novy.id);
    });
  }

  // ------------------------------------------------------------ úpravy textu
  zacniUpravy(id, { x, y, vybratVse, vybratSlovo } = {}) {
    const o = this.objekt(id);
    if (!o) return;
    if (this.upravuje && this.upravuje !== id) this.ukonciUpravy();
    this.vyber = [id];
    this.upravuje = id;
    if (o.typ === 'tvar' && !o.html) o.html = '';
    const u = this.kresliObjekt(id);
    this.aktivujUpravy(id, { x, y, vybratVse, vybratSlovo });
    this.kresliVyber();
    this.P.poZmeneVyberu?.();
    return u;
  }
  editovatelne(id) {
    const u = this.uzel(id);
    if (!u) return null;
    return u.querySelector('.pr-t') || u.querySelector('.pr-tab');
  }
  aktivujUpravy(id, kde, obnova = false) {
    const t = this.editovatelne(id);
    const o = this.objekt(id);
    if (!t || !o) return;
    const tabulka = t.classList.contains('pr-tab');
    const cile = tabulka ? [...t.querySelectorAll('td')] : [t];
    for (const c of cile) {
      c.contentEditable = 'true';
      c.spellcheck = true;
      c.dataset.vel = '';
    }
    this.uzel(id).classList.add('upravuje');
    if (!tabulka && !o.html) t.innerHTML = '<p><br></p>';
    const u = this.uzel(id);
    const vstup = (ev) => this.poVstupu(id, ev);
    for (const c of cile) {
      c.addEventListener('input', vstup);
      c.addEventListener('keydown', (ev) => this.klavesaTextu(ev, id, c));
      c.addEventListener('paste', (ev) => this.vlozeniTextu(ev, id));
    }
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* starší prohlížeč */ }
    if (obnova) {
      if (this.ulozenyVyber) { const cil = tabulka ? t.querySelector(`td[data-r="${this.ulozenyVyber.r}"][data-c="${this.ulozenyVyber.c}"]`) || cile[0] : t; cil.focus({ preventScroll: true }); obnovRozsah(cil, this.ulozenyVyber); }
      return;
    }
    let cil = cile[0];
    if (kde?.x !== undefined) {
      const bod = document.elementFromPoint(kde.x, kde.y);
      if (tabulka) cil = bod?.closest('td') && t.contains(bod.closest('td')) ? bod.closest('td') : cile[0];
      cil.focus({ preventScroll: true });
      const r = document.caretRangeFromPoint?.(kde.x, kde.y);
      if (r && cil.contains(r.startContainer)) {
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        if (kde.vybratSlovo) { sel.modify?.('move', 'backward', 'word'); sel.modify?.('extend', 'forward', 'word'); }
      } else kurzorNaKonec(cil);
    } else {
      cil.focus({ preventScroll: true });
      if (kde?.vybratVse) { const r = document.createRange(); r.selectNodeContents(cil); getSelection().removeAllRanges(); getSelection().addRange(r); } else kurzorNaKonec(cil);
    }
    void u;
  }
  poVstupu(id) {
    const o = this.objekt(id);
    const u = this.uzel(id);
    const t = this.editovatelne(id);
    if (!o || !u || !t) return;
    if (!t.classList.contains('pr-tab')) {
      if (!t.querySelector('p')) { const html = t.innerHTML; t.innerHTML = `<p>${html || '<br>'}</p>`; kurzorNaKonec(t); }
      oznacOdstavce(t, o);
      if (o.rust) {
        const h = potrebnaVyska(u);
        if (h && Math.abs(h - o.h) > 0.5) { o.h = h; u.style.height = h + 'px'; this.kresliVyber(); }
      } else prizpusobText(u, o);
    } else {
      // tabulka roste s textem
      const tab = t;
      const vyska = tab.offsetHeight;
      if (vyska > o.h + 0.5 || vyska < o.h - 0.5) { o.h = vyska; u.style.height = vyska + 'px'; this.kresliVyber(); }
    }
    clearTimeout(this.ukladaniTextu);
    this.ukladaniTextu = setTimeout(() => this.ulozText(id, 'Psaní'), 800);
    this.P.poPsani?.();
  }
  /** Přenese HTML z editovaného prvku do modelu (bez překreslení). */
  ulozText(id, popis = 'Psaní') {
    clearTimeout(this.ukladaniTextu);
    const o = this.objekt(id);
    const t = this.editovatelne(id);
    if (!o || !t) return;
    const sel = getSelection();
    if (sel.rangeCount && t.contains(sel.anchorNode)) this.ulozenyVyber = ulozRozsah(sel.getRangeAt(0).startContainer.parentElement?.closest('td') || t, sel.getRangeAt(0));
    if (t.classList.contains('pr-tab')) {
      for (const td of t.querySelectorAll('td')) {
        const b = o.tab.radky[+td.dataset.r]?.[+td.dataset.c];
        if (b) b.html = td.innerHTML === '<br>' ? '' : td.innerHTML;
      }
      o.h = t.offsetHeight || o.h;
      if (this.ulozenyVyber) { const td = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('td'); if (td) Object.assign(this.ulozenyVyber, { r: td.dataset.r, c: td.dataset.c }); }
    } else {
      const kopieT = t.cloneNode(true);
      const html = vycistiHtml(kopieT);
      o.html = jePrazdnyText(html) && !html.includes('<img') ? '' : html;
    }
    this.P.ulozKrokTextu?.(popis);
  }
  ukonciUpravy() {
    const id = this.upravuje;
    if (!id) return;
    this.ulozText(id, 'Psaní');
    this.upravuje = null;
    this.ulozenyVyber = null;
    const o = this.objekt(id);
    // prázdné textové pole (ne zástupný symbol) po odchodu zmizí
    if (o && o.typ === 'text' && !o.ph && jePrazdnyText(o.html)) {
      this.P.prikaz('Odstranit prázdné textové pole', () => { this.pres.smazObjekty(this.s, [id]); });
      this.vyber = this.vyber.filter((x) => x !== id);
    }
    getSelection().removeAllRanges();
    this.kresli();
    this.P.poZmeneVyberu?.();
  }

  klavesaTextu(e, id, t) {
    const o = this.objekt(id);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.ukonciUpravy(); this.vyberObjekty([id]); this.plocha.focus(); return; }
    if (e.key === 'Tab' && !t.closest('.pr-tab')) {
      e.preventDefault();
      e.stopPropagation();
      this.zmenUroven(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === 'Tab' && t.tagName === 'TD') {
      e.preventDefault(); e.stopPropagation();
      const bunky = [...t.closest('table').querySelectorAll('td')];
      let i = bunky.indexOf(t) + (e.shiftKey ? -1 : 1);
      if (i >= bunky.length) { this.ulozText(id); this.P.upravTabulku?.('radekPod'); return; }
      i = Math.max(0, i);
      bunky[i].focus(); const r = document.createRange(); r.selectNodeContents(bunky[i]); getSelection().removeAllRanges(); getSelection().addRange(r);
      return;
    }
    if (e.key === 'Enter' && e.shiftKey && !t.closest('.pr-tab')) {
      // Shift+Enter = zalomení řádku v odstavci
      e.preventDefault(); document.execCommand('insertLineBreak');
      return;
    }
    if (e.key === 'Enter' && o?.ph?.startsWith('nadpis') && !e.shiftKey) {
      // v nadpisu Enter vytvoří nový řádek jako v PowerPointu (ne odstavec)
    }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !e.altKey) {
      const k = e.key.toLowerCase();
      const m = { b: 'tucne', i: 'kurziva', u: 'podtrzeni', e: 'zarC', l: 'zarL', r: 'zarR', j: 'zarJ' }[k];
      if (m) { e.preventDefault(); e.stopPropagation(); this.P.formatuj(m); return; }
      if (e.key === ']' || (e.shiftKey && (e.key === '>' || e.key === '.'))) { e.preventDefault(); e.stopPropagation(); this.P.formatuj('vetsi'); return; }
      if (e.key === '[' || (e.shiftKey && (e.key === '<' || e.key === ','))) { e.preventDefault(); e.stopPropagation(); this.P.formatuj('mensi'); return; }
      if (k === 'a') { e.stopPropagation(); return; }   // vybere text v poli
      if (k === 'z' || k === 'y') { e.preventDefault(); e.stopPropagation(); this.ulozText(id); if (k === 'z') this.P.zpet(); else this.P.znovu(); return; }
    }
    e.stopPropagation();
    if (!ctrl && (e.key === 'F2')) { e.preventDefault(); this.ukonciUpravy(); this.vyberObjekty([id]); }
    this.P.globalniKlavesa?.(e);
  }
  vlozeniTextu(e, id) {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (html && /<(b|strong|i|em|u|span|p)\b/i.test(html)) {
      const d = document.createElement('div');
      d.innerHTML = html;
      d.querySelectorAll('script, style, meta, link, head, title').forEach((x) => x.remove());
      // zachovat tučné/kurzívu/podtržení, ostatní styly zahodit
      d.querySelectorAll('*').forEach((x) => { const b = x.style?.fontWeight >= 600 || /^(B|STRONG)$/.test(x.tagName); const i = x.style?.fontStyle === 'italic' || /^(I|EM)$/.test(x.tagName); x.removeAttribute('style'); x.removeAttribute('class'); if (b) x.style.fontWeight = '700'; if (i) x.style.fontStyle = 'italic'; });
      const radky = d.innerText.split('\n');
      if (radky.length <= 1) document.execCommand('insertHTML', false, d.innerHTML.replace(/<\/?(p|div|h\d|li|ul|ol|br)[^>]*>/gi, ' '));
      else document.execCommand('insertText', false, text);
    } else document.execCommand('insertText', false, text);
    this.poVstupu(id);
  }

  /** Vybrané odstavce při úpravách textu (nebo všechny odstavce vybraných objektů). */
  odstavceVyberu() {
    if (this.upravuje) {
      const t = this.editovatelne(this.upravuje);
      const sel = getSelection();
      if (!sel.rangeCount || !t) return [];
      const r = sel.getRangeAt(0);
      const vsechny = [...t.querySelectorAll('p')];
      const vybrane = vsechny.filter((p) => r.intersectsNode(p));
      return vybrane.length ? vybrane : vsechny.slice(0, 1);
    }
    return [];
  }
  zmenUroven(smer) {
    if (!this.upravuje) {
      // vybraný objekt: posune všechny odstavce
      this.P.prikaz('Úroveň odrážky', () => {
        for (const o of this.vybrane()) {
          if (!o.html) continue;
          const d = document.createElement('div'); d.innerHTML = o.html;
          d.querySelectorAll('p').forEach((p) => nastavUroven(p, smer));
          o.html = d.innerHTML;
        }
      });
      return;
    }
    for (const p of this.odstavceVyberu()) nastavUroven(p, smer);
    this.poVstupu(this.upravuje);
  }

  // ------------------------------------------------------------ formátování
  /**
   * Provede úpravu textu: při úpravách na výběru, jinak na celém textu vybraných objektů.
   * fn(koren) dostane editovatelný prvek s vybraným obsahem (execCommand funguje).
   */
  naTextu(popis, fn) {
    if (this.upravuje) {
      const t = this.editovatelne(this.upravuje);
      const sel = getSelection();
      if (!t) return;
      const aktivni = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement).closest('[contenteditable="true"]');
      (aktivni || t).focus({ preventScroll: true });
      if (this.ulozenyVyber && !sel.rangeCount) obnovRozsah(aktivni || t, this.ulozenyVyber);
      fn(aktivni || t, true);
      this.poVstupu(this.upravuje);
      this.ulozText(this.upravuje, popis);
      return;
    }
    const cile = this.vybrane().filter((o) => o.typ === 'text' || (o.typ === 'tvar' && !jeCara(o.tvar)) || o.typ === 'tabulka');
    if (!cile.length) return;
    const pom = this.skryteSchranka;
    this.P.prikaz(popis, () => {
      for (const o of cile) {
        const polozky = o.typ === 'tabulka' ? o.tab.radky.flat().filter((b) => !b.skryta) : [o];
        for (const b of polozky) {
          const puvodni = b.html || '';
          pom.innerHTML = puvodni || (o.ph && o.typ !== 'tabulka' ? '<p>​</p>' : '<p>​</p>');
          pom.dataset.vel = '';
          pom.focus({ preventScroll: true });
          const r = document.createRange(); r.selectNodeContents(pom);
          const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
          const vysledek = fn(pom, false, o);
          if (vysledek === 'objekt') continue;
          const html = vycistiHtml(pom).replace(/​/g, '');
          b.html = jePrazdnyText(html) && !puvodni ? '' : html;
          if (!puvodni && jePrazdnyText(html)) {
            // prázdný zástupný symbol: formát se uloží jako vlastnost objektu (projeví se po napsání)
          }
        }
      }
      getSelection().removeAllRanges();
    });
    this.plocha.focus({ preventScroll: true });
  }

  /** Obalí vybraný text do spanu se stylem (velikost, písmo, barva, rozestup…) a odstraní stejný styl z potomků. */
  static obalStylem(koren, styl) {
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    if (r.collapsed) {
      // bez výběru: styl pro další psaní (vložený prázdný span s kurzorem)
      const s = document.createElement('span');
      Object.assign(s.style, styl);
      s.textContent = '​';
      r.insertNode(s);
      const nr = document.createRange(); nr.setStart(s.firstChild, 1); nr.collapse(true);
      sel.removeAllRanges(); sel.addRange(nr);
      return;
    }
    // execCommand vyrobí <font size=7> jen kolem vybraného textu — ty pak nahradíme spany s vlastním stylem
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    const klice = Object.keys(styl).map((k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    koren.querySelectorAll('font[size="7"]').forEach((f) => {
      const s = document.createElement('span');
      Object.assign(s.style, styl);
      s.append(...f.childNodes);
      f.replaceWith(s);
      s.querySelectorAll('[style]').forEach((x) => { for (const k of klice) x.style.removeProperty(k); if (!x.getAttribute('style')) x.removeAttribute('style'); });
    });
    // výběr zpět na nově obalený text
  }

  // ------------------------------------------------------------ klávesnice (objekty)
  klavesa(e) {
    const P = this.P;
    if (this.upravuje) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    const vyb = this.vybrane();
    if (k === 'Escape') {
      if (this.vkladani) { this.zrusVkladani(); e.preventDefault(); return; }
      if (vyb.length) { this.zrusVyber(); e.preventDefault(); return; }
    }
    if (k === 'Tab' && this.s?.objekty.length) {
      e.preventDefault();
      const obj = this.s.objekty.filter((o) => !o.skryty);
      const i = obj.findIndex((o) => o.id === this.vyber[this.vyber.length - 1]);
      const n = obj[(i + (e.shiftKey ? -1 : 1) + obj.length) % obj.length];
      this.vyberObjekty([n.id]);
      return;
    }
    if (!vyb.length) {
      if (ctrl && k.toLowerCase() === 'a') { e.preventDefault(); this.vyberObjekty(this.s.objekty.filter((o) => !o.skryty && !o.zamceny).map((o) => o.id)); return; }
      P.klavesaSnimku?.(e);
      return;
    }
    if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      P.odstranitVybrane();
      return;
    }
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      const krok = ctrl ? 1 : (P.st.prichytMrizka ? (P.st.krokMrizky || 18) : 6);
      if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { P.prikaz('Otočit', () => { for (const o of vyb) o.rot = (((o.rot || 0) + (k === 'ArrowRight' ? 15 : -15)) % 360 + 360) % 360; }); return; }
      const [dx, dy] = { ArrowLeft: [-krok, 0], ArrowRight: [krok, 0], ArrowUp: [0, -krok], ArrowDown: [0, krok] }[k];
      if (e.shiftKey) { P.prikaz('Změnit velikost', () => { for (const o of vyb) { o.w = Math.max(4, o.w + dx); o.h = Math.max(4, o.h + dy); } }); return; }
      P.prikaz('Přesunout', () => { for (const o of vyb) { o.x += dx; o.y += dy; } });
      return;
    }
    if ((k === 'Enter' || k === 'F2') && vyb.length === 1 && vyb[0].typ !== 'obrazek') { e.preventDefault(); this.zacniUpravy(vyb[0].id, { vybratVse: k === 'F2' }); return; }
    if (ctrl) {
      const kk = k.toLowerCase();
      if (kk === 'a') { e.preventDefault(); this.vyberObjekty(this.s.objekty.filter((o) => !o.skryty && !o.zamceny).map((o) => o.id)); return; }
      if (kk === 'd') { e.preventDefault(); P.duplikovatObjekty(); return; }
      const m = { b: 'tucne', i: 'kurziva', u: 'podtrzeni', e: 'zarC', l: 'zarL', r: 'zarR', j: 'zarJ' }[kk];
      if (m && !e.shiftKey) { e.preventDefault(); P.formatuj(m); return; }
      if (e.shiftKey && (k === '>' || k === '.')) { e.preventDefault(); P.formatuj('vetsi'); return; }
      if (e.shiftKey && (k === '<' || k === ',')) { e.preventDefault(); P.formatuj('mensi'); return; }
      if (kk === ']') { e.preventDefault(); P.formatuj('vetsi'); return; }
      if (kk === '[') { e.preventDefault(); P.formatuj('mensi'); return; }
    }
    // psaní do vybraného textového objektu začne úpravu (a nahradí prázdný zástupný symbol)
    if (!ctrl && !e.altKey && k.length === 1 && vyb.length === 1 && (vyb[0].typ === 'text' || (vyb[0].typ === 'tvar' && !jeCara(vyb[0].tvar)))) {
      e.preventDefault();
      this.zacniUpravy(vyb[0].id, { vybratVse: true });
      document.execCommand('insertText', false, k);
      return;
    }
    P.klavesaSnimku?.(e);
  }

  kontext(e) {
    e.preventDefault();
    if (this.vkladani) { this.zrusVkladani(); return; }
    this.P.kontextovaNabidka?.(e, this.upravuje ? 'text' : this.vyber.length ? 'objekt' : 'snimek');
  }
}

// ---------------------------------------------------------------- pomocné
function kurzorOtoceny(h, rot) {
  const poradi = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const i = (poradi.indexOf(h) + Math.round(rot / 45) + 8) % 8;
  return KURZORY[poradi[i]];
}
export function obalka(obj) {
  const x1 = Math.min(...obj.map((o) => o.x)), y1 = Math.min(...obj.map((o) => o.y));
  const x2 = Math.max(...obj.map((o) => o.x + o.w)), y2 = Math.max(...obj.map((o) => o.y + o.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function vzdalenostOdUsecky(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l = dx * dx + dy * dy;
  let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
export function kopieObjektu(o) {
  const n = kopie(o);
  n.id = noveId();
  if (n.ph) { n.ph = null; n.puvodniPh = o.ph; if (!n.vel) n.vel = o.ph.startsWith('nadpis') ? 44 : o.ph === 'podtitul' ? 24 : jeTelo(o) ? 28 : 18; if (vychoziOdrazka(o) && n.odrazky === undefined) n.odrazky = vychoziOdrazka(o); }
  return n;
}
function nastavUroven(p, smer) {
  const u = Math.max(0, Math.min(4, +(p.dataset.u || 0) + smer));
  if (u) p.dataset.u = u; else delete p.dataset.u;
}
function kurzorNaKonec(t) {
  const r = document.createRange();
  r.selectNodeContents(t);
  r.collapse(false);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
}
/** Uloží výběr jako textové pozice (přežije překreslení DOM). */
function ulozRozsah(koren, r) {
  const pozice = (uzel, off) => {
    const w = document.createTreeWalker(koren, NodeFilter.SHOW_TEXT);
    let n, c = 0;
    while ((n = w.nextNode())) { if (n === uzel) return c + off; c += n.length; }
    return c;
  };
  return { a: pozice(r.startContainer, r.startOffset), b: pozice(r.endContainer, r.endOffset) };
}
function obnovRozsah(koren, { a, b }) {
  const najdi = (cil) => {
    const w = document.createTreeWalker(koren, NodeFilter.SHOW_TEXT);
    let n, c = 0, posledni = null;
    while ((n = w.nextNode())) { if (c + n.length >= cil) return [n, cil - c]; c += n.length; posledni = n; }
    return posledni ? [posledni, posledni.length] : [koren, koren.childNodes.length];
  };
  try {
    const r = document.createRange();
    r.setStart(...najdi(a)); r.setEnd(...najdi(b));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  } catch { kurzorNaKonec(koren); }
}

export { VELIKOSTI_PISMA, kurzorNaKonec };
