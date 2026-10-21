// AstroPrezentace — model prezentace: snímky, objekty, oddíly, historie Zpět/Znovu a formát souboru
//
// Soubor .pptx je JSON { format: 'astroprezentace', verze, motiv, varianta, velikost, snimky, oddily, zapati, media, meta }.
// Obrázky a zvuky leží zvlášť v `media` (id → dataURL) a objekty na ně odkazují přes `src: 'media:<id>'`,
// takže snímky historie jsou malé (media se nesnímkují, jen přibývají).

import { ROZVRZENI, rozvrzeniPodleId, SIRKA, VYSKA } from './motivy.js';

let citac = 0;
export const noveId = (p = 'o') => p + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 5);

const kopie = (o) => JSON.parse(JSON.stringify(o));

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Z pole řádků (string nebo [text, úroveň]) udělá HTML odstavců textového pole. */
export function odstavce(radky) {
  return radky.map((r) => {
    const [t, u] = Array.isArray(r) ? r : [r, 0];
    return `<p${u ? ` data-u="${u}"` : ''}>${t === '' ? '<br>' : esc(t)}</p>`;
  }).join('');
}

/** Holý text z HTML textového pole (odstavce oddělené \n). */
export function textZHtml(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  const p = d.querySelectorAll('p, div, li');
  if (!p.length) return d.textContent.trim();
  return [...p].map((x) => x.textContent).join('\n').trim();
}

export const jePrazdnyText = (html) => !html || !textZHtml(html).trim();

/** Objekt zástupného symbolu podle rozvržení. */
export function objektZPh(def) {
  const o = {
    id: noveId(), typ: 'text', ph: def.ph, x: def.x, y: def.y, w: def.w, h: def.h, rot: 0, html: '',
  };
  if (def.ph === 'obrazek') { o.typ = 'text'; o.phObrazek = true; }
  return o;
}

export function novySnimek(rozvrzeni = 'obsah') {
  const r = rozvrzeniPodleId(rozvrzeni);
  return {
    id: noveId('s'), rozvrzeni: r.id, objekty: r.ph.map(objektZPh), poznamky: '', skryty: false,
    pozadi: null, prechod: null, animace: [], komentare: [],
  };
}

/** Definice zástupného symbolu (rozměry, zarovnání, velikost písma) pro objekt snímku. */
export function defPh(snimek, o) {
  if (!o.ph) return null;
  const r = rozvrzeniPodleId(snimek.rozvrzeni);
  return r.ph.find((p) => p.ph === o.ph) || ROZVRZENI[1].ph.find((p) => p.ph === (o.ph.startsWith('nadpis') ? 'nadpis' : 'obsah')) || null;
}

export class Prezentace {
  constructor(data = null) {
    this.motiv = 'office';
    this.varianta = 0;
    this.velikost = { w: SIRKA, h: VYSKA, id: 'wide' };
    this.snimky = [];
    this.oddily = [];           // [{ id, nazev, od: idSnimku }]
    this.zapati = { datum: false, datumText: '', cislo: false, text: '', zapati: false, naUvodnim: false };
    this.nastaveni = { smycka: false, bezAnimaci: false, bezCasovani: false, pero: '#E71224', laser: '#FF0000' };
    this.media = {};
    this.meta = {};
    this.historie = { list: [], i: -1 };
    this.onZmena = null;
    if (data) this.nacti(data);
  }

  // ------------------------------------------------------------ data
  stav() {
    return {
      motiv: this.motiv, varianta: this.varianta, barvyZ: this.barvyZ, pisma: this.pisma, velikost: this.velikost, snimky: this.snimky,
      oddily: this.oddily, zapati: this.zapati, nastaveni: this.nastaveni,
    };
  }
  nacti(d) {
    this.motiv = d.motiv || 'office';
    this.varianta = d.varianta || 0;
    this.barvyZ = d.barvyZ || null;    // barvy převzaté z jiného motivu (Návrh › Varianty › Barvy)
    this.pisma = d.pisma || null;      // { nadpis, telo } převzatá písma
    this.velikost = d.velikost || { w: SIRKA, h: VYSKA, id: 'wide' };
    this.snimky = (d.snimky || []).map((s) => ({ pozadi: null, prechod: null, animace: [], komentare: [], poznamky: '', skryty: false, ...s }));
    this.oddily = d.oddily || [];
    this.zapati = { ...this.zapati, ...(d.zapati || {}) };
    this.nastaveni = { ...this.nastaveni, ...(d.nastaveni || {}) };
    if (d.media) Object.assign(this.media, d.media);
    if (d.meta) this.meta = d.meta;
  }

  serializuj(meta = {}) {
    // do souboru jen média, na která něco odkazuje
    const pouzite = new Set();
    const hledej = (x) => {
      if (!x || typeof x !== 'object') { if (typeof x === 'string' && x.startsWith('media:')) pouzite.add(x.slice(6)); return; }
      for (const v of Object.values(x)) hledej(v);
    };
    hledej(this.snimky);
    const media = {};
    for (const id of pouzite) if (this.media[id]) media[id] = this.media[id];
    return JSON.stringify({ format: 'astroprezentace', verze: 1, ...this.stav(), media, meta: { ...this.meta, ...meta } });
  }

  static rozeber(text) {
    const d = JSON.parse(text);
    if (d.format !== 'astroprezentace') throw new Error('Neznámý formát');
    const p = new Prezentace(d);
    return p;
  }

  pridejMedium(dataUrl) {
    for (const [id, v] of Object.entries(this.media)) if (v === dataUrl) return 'media:' + id;
    const id = noveId('m');
    this.media[id] = dataUrl;
    return 'media:' + id;
  }
  src(s) { return s?.startsWith('media:') ? this.media[s.slice(6)] || '' : s; }

  // ------------------------------------------------------------ historie
  zalozHistorii() {
    this.historie = { list: [{ data: JSON.stringify(this.stav()), popis: '' }], i: 0 };
  }
  /** Provede změnu fn a uloží krok historie. Když fn vrátí false, nic se nestane. */
  zmena(popis, fn) {
    const r = fn();
    if (r === false) return false;
    this.ulozKrok(popis);
    return true;
  }
  ulozKrok(popis) {
    const data = JSON.stringify(this.stav());
    const h = this.historie;
    if (h.list[h.i]?.data === data) return;
    h.list = h.list.slice(0, h.i + 1);
    h.list.push({ data, popis });
    if (h.list.length > 120) h.list.shift();
    h.i = h.list.length - 1;
    this.onZmena?.(popis);
  }
  get muzeZpet() { return this.historie.i > 0; }
  get muzeZnovu() { return this.historie.i < this.historie.list.length - 1; }
  get popisZpet() { return this.historie.list[this.historie.i]?.popis; }
  zpet(n = 1) {
    if (!this.muzeZpet) return false;
    this.historie.i = Math.max(0, this.historie.i - n);
    this.nacti(JSON.parse(this.historie.list[this.historie.i].data));
    this.onZmena?.('zpet');
    return true;
  }
  znovu() {
    if (!this.muzeZnovu) return false;
    this.historie.i++;
    this.nacti(JSON.parse(this.historie.list[this.historie.i].data));
    this.onZmena?.('znovu');
    return true;
  }

  // ------------------------------------------------------------ snímky
  index(id) { return this.snimky.findIndex((s) => s.id === id); }
  snimek(id) { return this.snimky.find((s) => s.id === id); }
  vlozSnimek(s, za = this.snimky.length - 1) {
    this.snimky.splice(za + 1, 0, s);
    return s;
  }
  duplikuj(id) {
    const i = this.index(id);
    const s = kopie(this.snimky[i]);
    s.id = noveId('s');
    const mapa = {};
    // morf = společný klíč pro přechod Přeměna (objekt na kopii snímku „je tentýž“)
    for (const o of s.objekty) { const n = noveId(); mapa[o.id] = n; o.morf = o.morf || o.id; o.id = n; }
    s.animace = (s.animace || []).map((a) => ({ ...a, id: noveId('a'), obj: mapa[a.obj] || a.obj }));
    s.komentare = [];
    this.snimky.splice(i + 1, 0, s);
    return s;
  }
  smaz(ids) {
    const set = new Set(ids);
    // oddíl, který začínal smazaným snímkem, přejde na další zachovaný
    for (const od of this.oddily) {
      if (!set.has(od.od)) continue;
      const i = this.index(od.od);
      const dalsi = this.snimky.slice(i).find((s) => !set.has(s.id));
      od.od = dalsi?.id || null;
    }
    this.snimky = this.snimky.filter((s) => !set.has(s.id));
    this.oddily = this.oddily.filter((o) => o.od);
  }
  presun(ids, naIndex) {
    const set = new Set(ids);
    const hybane = this.snimky.filter((s) => set.has(s.id));
    const pred = this.snimky.slice(0, naIndex).filter((s) => !set.has(s.id)).length;
    const zbytek = this.snimky.filter((s) => !set.has(s.id));
    zbytek.splice(pred, 0, ...hybane);
    this.snimky = zbytek;
  }

  /** Změní rozvržení: zástupné symboly se přeskupí, jejich obsah zůstane. */
  zmenRozvrzeni(s, id) {
    const r = rozvrzeniPodleId(id);
    const stare = s.objekty.filter((o) => o.ph);
    const volne = s.objekty.filter((o) => !o.ph);
    const nove = r.ph.map((def) => {
      const puvodni = stare.find((o) => o.ph === def.ph)
        || (def.ph === 'obsah' ? stare.find((o) => o.ph === 'podtitul' || o.ph === 'text') : null)
        || (def.ph === 'podtitul' || def.ph === 'text' ? stare.find((o) => o.ph === 'obsah') : null);
      if (puvodni) { stare.splice(stare.indexOf(puvodni), 1); return { ...puvodni, ph: def.ph, x: def.x, y: def.y, w: def.w, h: def.h, rot: 0 }; }
      return objektZPh(def);
    });
    // obsah zástupných symbolů, které v novém rozvržení nejsou, zůstane jako textové pole
    const osirele = stare.filter((o) => !jePrazdnyText(o.html)).map((o) => ({ ...o, ph: null, puvodniPh: o.ph }));
    s.rozvrzeni = r.id;
    s.objekty = [...nove, ...volne, ...osirele];
  }
  /** Obnovit: vrátí polohu a velikost zástupných symbolů podle rozvržení. */
  obnovRozvrzeni(s) {
    const r = rozvrzeniPodleId(s.rozvrzeni);
    for (const o of s.objekty) {
      const def = o.ph && r.ph.find((p) => p.ph === o.ph);
      if (def) Object.assign(o, { x: def.x, y: def.y, w: def.w, h: def.h, rot: 0 });
    }
    // chybějící zástupné symboly se vrátí
    for (const def of r.ph) if (!s.objekty.some((o) => o.ph === def.ph)) s.objekty.unshift(objektZPh(def));
  }

  oddilSnimku(id) {
    const i = this.index(id);
    let nalez = null;
    for (const od of this.oddily) { const j = this.index(od.od); if (j >= 0 && j <= i && (!nalez || j >= this.index(nalez.od))) nalez = od; }
    return nalez;
  }
  /** Seznam oddílů v pořadí: [{ oddil|null, snimky: [...] }] */
  skupiny() {
    const serazene = [...this.oddily].filter((o) => this.index(o.od) >= 0).sort((a, b) => this.index(a.od) - this.index(b.od));
    if (!serazene.length) return [{ oddil: null, snimky: this.snimky }];
    const out = [];
    const prvni = this.index(serazene[0].od);
    if (prvni > 0) out.push({ oddil: { id: 'vychozi', nazev: 'Výchozí oddíl', virtualni: true }, snimky: this.snimky.slice(0, prvni) });
    serazene.forEach((o, k) => {
      const od = this.index(o.od), doo = k + 1 < serazene.length ? this.index(serazene[k + 1].od) : this.snimky.length;
      out.push({ oddil: o, snimky: this.snimky.slice(od, doo) });
    });
    return out;
  }

  // ------------------------------------------------------------ objekty
  najdi(s, id) { return s.objekty.find((o) => o.id === id); }
  smazObjekty(s, ids) {
    const set = new Set(ids);
    // prázdný zástupný symbol se po smazání obsahu nemaže úplně — PowerPoint smaže nejdřív text, pak ho vrátí jako prázdný
    s.objekty = s.objekty.filter((o) => !set.has(o.id));
    s.animace = (s.animace || []).filter((a) => !set.has(a.obj));
  }
  poradi(s, ids, kam) {
    const set = new Set(ids);
    const vybrane = s.objekty.filter((o) => set.has(o.id));
    const ostatni = s.objekty.filter((o) => !set.has(o.id));
    if (kam === 'popredi') s.objekty = [...ostatni, ...vybrane];
    else if (kam === 'pozadi') s.objekty = [...vybrane, ...ostatni];
    else {
      const arr = s.objekty.slice();
      const idx = vybrane.map((o) => arr.indexOf(o));
      if (kam === 'dopredu') {
        for (let k = idx.length - 1; k >= 0; k--) { const i = arr.indexOf(vybrane[k]); if (i < arr.length - 1 && !set.has(arr[i + 1].id)) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; } }
      } else {
        for (let k = 0; k < idx.length; k++) { const i = arr.indexOf(vybrane[k]); if (i > 0 && !set.has(arr[i - 1].id)) { [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; } }
      }
      s.objekty = arr;
    }
  }
}

export { kopie };
