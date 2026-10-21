// AstroPrezentace — prezentační režim: celá obrazovka, přechody, animace po kliknutí, pero a laserové ukazovátko,
// černá/bílá obrazovka, přehled snímků, zobrazení prezentujícího a zkouška časování.

import { el } from '../util.js';
import { kresliSnimek, poVlozeni } from './render.js';
import { prehrajPrechod, krokyAnimaci, prehrajKrok, pripravAnimace } from './efekty.js';
import { rozbal, zavriRozbal, nabidka } from '../pismo/ui.js';
import { noveId } from './model.js';

const cas = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const casKratky = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/**
 * Spustí prezentaci. o: { od: index, prezentujici: bool, zkouska: bool, okno: bool (zobrazení pro čtení) }.
 * Vrací Promise, která se splní po ukončení.
 */
export function prezentuj(P, o = {}) {
  return new Promise((konecPrezentace) => new Prezentovani(P, o, konecPrezentace));
}

class Prezentovani {
  constructor(P, o, konec) {
    this.P = P;
    this.pres = P.pres;
    this.o = o;
    this.konecCb = konec;
    this.i = Math.max(0, Math.min(o.od ?? 0, this.pres.snimky.length - 1));
    this.krok = 0;
    this.kroky = [];
    this.bezi = false;
    this.nastroj = null;   // 'pero' | 'zvyraznovac' | 'laser' | 'guma'
    this.inkoust = {};     // id snímku → tahy
    this.start = Date.now();
    this.casSnimku = Date.now();
    this.pauza = 0;
    this.casovani = {};    // zkouška časování: id → sekundy
    this.cisloVstup = '';
    this.historie = [];

    const W = this.pres.velikost.w, H = this.pres.velikost.h;
    this.W = W; this.H = H;
    this.koren = el('div.pr-show' + (o.okno ? '.okno' : ''), { tabindex: '-1' });
    this.scena = el('div.pr-show-scena');
    this.platno = el('canvas.pr-show-inkoust');
    this.laser = el('div.pr-show-laser', { hidden: true });
    this.cerna = el('div.pr-show-clona', { hidden: true });
    this.lista = this.kresliListu();
    this.koren.append(this.scena, this.platno, this.laser, this.cerna, this.lista);
    if (o.prezentujici) this.postavPrezentujiciho();
    if (o.zkouska) this.postavZkousku();
    if (o.okno) this.postavCteni();

    const cil = o.okno ? P.koren : document.body;
    cil.append(this.koren);
    // celá stránka (ne jen prvek) — nabídky pera a pravého tlačítka se vkládají do body a musí být vidět
    if (!o.okno && !o.bezCeleObrazovky && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    this.koren.focus();
    this.ro = new ResizeObserver(() => this.rozmer());
    this.ro.observe(this.koren);

    this.klav = (e) => this.klavesa(e);
    this.koren.addEventListener('keydown', this.klav);
    this.koren.addEventListener('pointerdown', (e) => this.mysDolu(e));
    this.koren.addEventListener('pointermove', (e) => this.mysPohyb(e));
    this.koren.addEventListener('contextmenu', (e) => { e.preventDefault(); this.nabidka(e); });
    this.koren.addEventListener('wheel', (e) => { if (this.prehled) return; if (e.deltaY > 0) this.dalsi(); else this.predchozi(); }, { passive: true });
    this.fsKonec = () => { if (!document.fullscreenElement && !this.konci && !o.okno && !o.bezCeleObrazovky) this.ukonci(); };
    document.addEventListener('fullscreenchange', this.fsKonec);
    this.tik = setInterval(() => this.obnovCasy(), 500);

    // přeskočit skryté snímky na začátku
    if (this.pres.snimky[this.i]?.skryty && !o.vcetneSkrytych) this.i = this.dalsiViditelny(this.i, 1) ?? this.i;
    this.ukaz(this.i, { bezPrechodu: true });
  }

  get s() { return this.pres.snimky[this.i]; }

  dalsiViditelny(od, smer) {
    for (let j = od + smer; j >= 0 && j < this.pres.snimky.length; j += smer) if (!this.pres.snimky[j].skryty) return j;
    return null;
  }

  rozmer() {
    const obal = this.o.prezentujici ? this.prez.aktualni : this.koren;
    const w = obal.clientWidth, h = obal.clientHeight;
    const k = Math.min(w / this.W, h / this.H);
    this.k = k;
    const sw = this.W * k, sh = this.H * k;
    Object.assign(this.scena.style, { width: sw + 'px', height: sh + 'px', left: (w - sw) / 2 + 'px', top: (h - sh) / 2 + 'px' });
    for (const v of this.scena.children) v.style.setProperty('--k', k);
    for (const sn of this.scena.querySelectorAll(':scope > .pr-show-vrstva > .pr-sn')) sn.style.transform = `scale(${k})`;
    const dpr = devicePixelRatio || 1;
    this.platno.width = sw * dpr; this.platno.height = sh * dpr;
    Object.assign(this.platno.style, { width: sw + 'px', height: sh + 'px', left: this.scena.style.left, top: this.scena.style.top });
    if (this.o.prezentujici && this.platno.parentNode !== this.prez.aktualni) this.prez.aktualni.append(this.platno);
    this.kresliInkoust();
  }

  vrstva(s) {
    const v = el('div.pr-show-vrstva');
    const sn = kresliSnimek(this.pres, s, { cislo: this.pres.index(s.id) + 1 });
    sn.style.transformOrigin = '0 0';
    sn.style.transform = `scale(${this.k || 1})`;
    v.append(sn);
    // zvuky a odkazy fungují kliknutím
    for (const u of sn.querySelectorAll('.pr-o[data-typ="zvuk"]')) u.classList.add('klikaci');
    return v;
  }

  async ukaz(i, { bezPrechodu = false, odKonce = false } = {}) {
    if (this.bezi) { this.preskocitAnimace?.(); }
    const s = this.pres.snimky[i];
    if (!s) return;
    this.zastavZvuky();
    clearTimeout(this.autoCas);
    if (this.o.zkouska && this.s && i !== this.i) this.casovani[this.s.id] = (this.casovani[this.s.id] || 0) + (Date.now() - this.casSnimku - this.pauza) / 1000;
    const predchozi = this.scena.querySelector(':scope > .pr-show-vrstva:last-child');
    const zmena = i !== this.i || !predchozi;
    if (zmena && this.i !== i) this.historie.push(this.i);
    this.i = i;
    this.casSnimku = Date.now();
    this.pauza = 0;
    this.konecObr = false;
    const v = this.vrstva(s);
    this.scena.append(v);
    this.rozmer();
    poVlozeni(v.firstElementChild, this.pres, s);
    this.kroky = this.pres.nastaveni.bezAnimaci ? [] : krokyAnimaci(s);
    this.krok = 0;
    if (odKonce) { this.krok = this.kroky.length; }
    else pripravAnimace(s, v);
    this.bezi = true;
    if (!bezPrechodu && predchozi && s.prechod?.typ && s.prechod.typ !== 'zadny') {
      const k = this.k;
      await prehrajPrechod(s.prechod, { stary: predchozi, novy: v, kontejner: this.scena, W: this.W * k, H: this.H * k });
    }
    for (const x of [...this.scena.children]) if (x !== v) x.remove();
    this.bezi = false;
    this.kresliInkoust();
    this.obnovPrezentujiciho();
    // automatický první krok animací
    if (this.kroky[0]?.automaticky && !odKonce) await this.dalsiKrok();
    this.naplanujAuto();
    // zvuky s automatickým přehráním
    for (const o of s.objekty) if (o.typ === 'zvuk' && o.auto) this.prehrajZvuk(o);
  }

  naplanujAuto() {
    clearTimeout(this.autoCas);
    const s = this.s;
    const t = s?.prechod?.auto;
    if (t === undefined || t === null || this.pres.nastaveni.bezCasovani || this.o.zkouska) return;
    // automatický posun počká na všechny zbývající animace (každý krok se spustí sám)
    this.autoCas = setTimeout(() => this.dalsi(), Math.max(0, t * 1000));
  }

  async dalsiKrok() {
    const k = this.kroky[this.krok];
    if (!k) return false;
    this.krok++;
    const v = this.scena.lastElementChild;
    this.bezi = true;
    const geo = (id) => ({ o: this.s.objekty.find((x) => x.id === id) || { x: 0, y: 0, w: 0, h: 0 }, W: this.W, H: this.H });
    await prehrajKrok(k, v, geo);
    this.bezi = false;
    // další krok „po předchozí“ bez kliknutí už patří do tohoto kroku; nic dalšího
    return true;
  }

  async dalsi() {
    if (this.konecObr) { this.ukonci(); return; }
    if (this.cerna.hidden === false) { this.cerna.hidden = true; return; }
    if (this.bezi) return;
    if (this.krok < this.kroky.length) { await this.dalsiKrok(); return; }
    const j = this.dalsiViditelny(this.i, 1);
    if (j === null) {
      if (this.pres.nastaveni.smycka) { const prvni = this.pres.snimky.findIndex((s) => !s.skryty); this.ukaz(prvni >= 0 ? prvni : 0); return; }
      if (this.o.okno) { this.ukonci(); return; }
      this.ukazKonec();
      return;
    }
    this.ukaz(j);
  }
  predchozi() {
    if (this.konecObr) { this.konecObr = false; this.ukaz(this.i, { bezPrechodu: true, odKonce: true }); return; }
    if (this.bezi) return;
    if (this.krok > 0 && !(this.krok === 1 && this.kroky[0]?.automaticky)) {
      // vrátit krok: snímek se vykreslí znovu a přehrají se kroky bez animace
      const cil = this.krok - 1;
      this.ukazStav(cil);
      return;
    }
    const j = this.dalsiViditelny(this.i, -1);
    if (j !== null) this.ukaz(j, { bezPrechodu: true, odKonce: true });
  }
  /** Snímek ve stavu po n krocích (bez přehrávání). */
  ukazStav(n) {
    const v = this.vrstva(this.s);
    this.scena.replaceChildren(v);
    this.rozmer();
    poVlozeni(v.firstElementChild, this.pres, this.s);
    pripravAnimace(this.s, v);
    for (let k = 0; k < n; k++) {
      for (const { a } of this.kroky[k].polozky) {
        const u = v.querySelector(`.pr-o[data-id="${a.obj}"]`);
        if (!u) continue;
        if (a.druh === 'vstup') u.style.visibility = '';
        if (a.druh === 'vystup') u.style.visibility = 'hidden';
      }
    }
    this.krok = n;
    this.kresliInkoust();
    this.obnovPrezentujiciho();
  }

  ukazKonec() {
    this.konecObr = true;
    const v = el('div.pr-show-vrstva.konec', {}, el('div.pr-show-konec', { text: 'Konec prezentace, kliknutím ji ukončíte.' }));
    this.scena.replaceChildren(v);
    this.obnovPrezentujiciho();
  }

  jdiNa(i) {
    if (i < 0 || i >= this.pres.snimky.length) return;
    this.zavriPrehled();
    this.ukaz(i, { bezPrechodu: false });
  }

  // ------------------------------------------------------------ vstup
  klavesa(e) {
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    e.stopPropagation();
    if (this.prehled) { if (k === 'Escape' || k === '-') { e.preventDefault(); this.zavriPrehled(); } return; }
    if (k === 'Escape') { e.preventDefault(); if (this.nastroj) { this.nastavNastroj(null); return; } this.ukonci(); return; }
    if (/^\d$/.test(k)) { this.cisloVstup += k; clearTimeout(this.cisloCas); this.cisloCas = setTimeout(() => { this.cisloVstup = ''; }, 1500); return; }
    if (k === 'Enter' && this.cisloVstup) { e.preventDefault(); const n = +this.cisloVstup - 1; this.cisloVstup = ''; this.jdiNa(n); return; }
    if (ctrl) {
      const kk = k.toLowerCase();
      if (kk === 'p') { e.preventDefault(); this.nastavNastroj('pero'); return; }
      if (kk === 'l') { e.preventDefault(); this.nastavNastroj('laser'); return; }
      if (kk === 'e') { e.preventDefault(); this.nastavNastroj('guma'); return; }
      if (kk === 'i') { e.preventDefault(); this.nastavNastroj('zvyraznovac'); return; }
      if (kk === 'a' || kk === 'h') { e.preventDefault(); this.nastavNastroj(null); return; }
      if (kk === 's') { e.preventDefault(); this.otevriPrehled(); return; }
      return;
    }
    if (e.altKey && k === 'F5') { e.preventDefault(); return; }
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': case 'n': case 'N':
        e.preventDefault(); this.dalsi(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': case 'p': case 'P':
        e.preventDefault(); this.predchozi(); break;
      case 'Home': e.preventDefault(); this.jdiNa(this.pres.snimky.findIndex((s) => !s.skryty)); break;
      case 'End': e.preventDefault(); this.jdiNa(this.pres.snimky.length - 1); break;
      case 'b': case 'B': case '.': this.clona('#000'); break;
      case 'w': case 'W': case ',': this.clona('#fff'); break;
      case 'e': case 'E': this.smazInkoust(); break;
      case 'g': case 'G': case '-': this.otevriPrehled(); break;
      case '+': case '=': this.lupa(true); break;
      case 'F1': e.preventDefault(); this.napoveda(); break;
      default:
    }
  }
  clona(barva) {
    if (!this.cerna.hidden && this.cerna.style.background === barva) { this.cerna.hidden = true; return; }
    this.cerna.style.background = barva;
    this.cerna.hidden = false;
  }
  lupa(zapnout) {
    this.lupaZap = zapnout ?? !this.lupaZap;
    this.scena.classList.toggle('lupa', this.lupaZap);
    if (!this.lupaZap) this.scena.style.transform = '';
  }

  mysDolu(e) {
    if (e.target.closest('.pr-show-lista, .pr-prez-panel, .pr-zk-lista, .pr-show-prehled, .pr-cteni-lista')) return;
    if (e.button !== 0) return;
    if (this.lupaZap) { this.lupa(false); return; }
    if (this.nastroj === 'pero' || this.nastroj === 'zvyraznovac') { this.kresli(e); return; }
    if (this.nastroj === 'guma') { this.gumuj(e); return; }
    if (this.nastroj === 'laser') return;
    // klik na zvuk přehraje zvuk
    const zv = e.target.closest('.pr-o[data-typ="zvuk"]');
    if (zv) { const o = this.s.objekty.find((x) => x.id === zv.dataset.id); if (o) { this.prehrajZvuk(o); return; } }
    const odkaz = e.target.closest('a[href]');
    if (odkaz) { e.preventDefault(); this.P.otevriOdkaz?.(odkaz.getAttribute('href')); return; }
    this.dalsi();
  }
  mysPohyb(e) {
    this.koren.classList.add('pohyb');
    clearTimeout(this.skrytKurzor);
    this.skrytKurzor = setTimeout(() => this.koren.classList.remove('pohyb'), 2500);
    if (this.nastroj === 'laser') {
      Object.assign(this.laser.style, { left: e.clientX - this.koren.getBoundingClientRect().left + 'px', top: e.clientY - this.koren.getBoundingClientRect().top + 'px' });
      this.laser.hidden = false;
    }
    if (this.lupaZap) {
      const r = this.scena.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      this.scena.style.transformOrigin = `${x * 100}% ${y * 100}%`;
      this.scena.style.transform = 'scale(2)';
    }
  }

  // ------------------------------------------------------------ pero, laser
  nastavNastroj(n) {
    this.nastroj = n;
    this.laser.hidden = n !== 'laser';
    this.koren.dataset.nastroj = n || '';
    this.platno.style.pointerEvents = n === 'pero' || n === 'zvyraznovac' || n === 'guma' ? 'auto' : 'none';
  }
  bodInkoustu(e) {
    const r = this.platno.getBoundingClientRect();
    return [+((e.clientX - r.left) / this.k).toFixed(1), +((e.clientY - r.top) / this.k).toFixed(1)];
  }
  kresli(e) {
    const zvyr = this.nastroj === 'zvyraznovac';
    const t = { barva: zvyr ? '#FFFF00' : this.pres.nastaveni.pero || '#E71224', sirka: zvyr ? 14 : 2.5, zvyr, body: [this.bodInkoustu(e)] };
    (this.inkoust[this.s.id] ||= []).push(t);
    const mv = (ev) => { t.body.push(this.bodInkoustu(ev)); this.kresliInkoust(); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  gumuj(e) {
    const [x, y] = this.bodInkoustu(e);
    const tahy = this.inkoust[this.s.id] || [];
    const i = tahy.findIndex((t) => t.body.some(([a, b]) => Math.hypot(a - x, b - y) < 10));
    if (i >= 0) { tahy.splice(i, 1); this.kresliInkoust(); }
  }
  smazInkoust() { delete this.inkoust[this.s?.id]; this.kresliInkoust(); }
  kresliInkoust() {
    const c = this.platno.getContext('2d');
    const dpr = devicePixelRatio || 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.platno.width, this.platno.height);
    const tahy = (this.s && this.inkoust[this.s.id]) || [];
    c.setTransform(dpr * this.k, 0, 0, dpr * this.k, 0, 0);
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const t of tahy) {
      c.globalAlpha = t.zvyr ? 0.45 : 1;
      c.strokeStyle = t.barva; c.lineWidth = t.sirka;
      c.beginPath();
      t.body.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------ zvuk
  prehrajZvuk(o) {
    this.zastavZvuky();
    const a = new Audio(this.pres.src(o.src));
    a.loop = !!o.smycka;
    a.play().catch(() => {});
    this.zvuky = [a];
  }
  zastavZvuky() { for (const a of this.zvuky || []) { try { a.pause(); } catch { /* nic */ } } this.zvuky = []; }

  // ------------------------------------------------------------ lišta vlevo dole
  kresliListu() {
    const svg = (d) => `<svg viewBox="0 0 20 20"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const tl = (t, d, akce) => el('button.pr-show-tl', { type: 'button', title: t, html: svg(d), onclick: (e) => { e.stopPropagation(); akce(e); } });
    return el('div.pr-show-lista', {},
      tl('Předchozí', 'M12.5 4.5 7 10l5.5 5.5', () => this.predchozi()),
      tl('Další', 'M7.5 4.5 13 10l-5.5 5.5', () => this.dalsi()),
      tl('Pera a laserová ukazovátka', 'M4 16l1-4 8-8 3 3-8 8zM11 6l3 3', (e) => this.nabidkaPera(e.currentTarget)),
      tl('Zobrazit všechny snímky', 'M3 4h6v5H3zM11 4h6v5h-6zM3 11h6v5H3zM11 11h6v5h-6z', () => this.otevriPrehled()),
      tl('Přiblížit snímek', 'M8.5 3.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM12.2 12.2 17 17M6.5 8.5h4M8.5 6.5v4', () => this.lupa(true)),
      tl('Další možnosti prezentace', 'M5 10h.01M10 10h.01M15 10h.01', (e) => this.nabidka(e, e.currentTarget)));
  }
  nabidkaPera(kotva) {
    const n = this.nastroj;
    rozbal(kotva, nabidka([
      { text: 'Laserové ukazovátko', klavesa: 'Ctrl+L', zaskrtnuto: n === 'laser', akce: () => this.nastavNastroj('laser') },
      { text: 'Pero', klavesa: 'Ctrl+P', zaskrtnuto: n === 'pero', akce: () => this.nastavNastroj('pero') },
      { text: 'Zvýrazňovač', klavesa: 'Ctrl+I', zaskrtnuto: n === 'zvyraznovac', akce: () => this.nastavNastroj('zvyraznovac') },
      { text: 'Guma', klavesa: 'Ctrl+E', zaskrtnuto: n === 'guma', akce: () => this.nastavNastroj('guma') },
      { text: 'Vymazat veškerý rukopis na snímku', klavesa: 'E', akce: () => this.smazInkoust() },
      'sep',
      ...[['#E71224', 'Červená'], ['#0F6CBD', 'Modrá'], ['#107C41', 'Zelená'], ['#000000', 'Černá'], ['#FFFFFF', 'Bílá'], ['#FFC000', 'Žlutá']].map(([b, t]) => ({ text: `Barva inkoustu: ${t}`, zaskrtnuto: (this.pres.nastaveni.pero || '#E71224') === b, akce: () => { this.pres.nastaveni.pero = b; if (!this.nastroj || this.nastroj === 'laser') this.nastavNastroj('pero'); } })),
      'sep',
      { text: 'Šipka (bez nástroje)', klavesa: 'Ctrl+A', akce: () => this.nastavNastroj(null) },
    ], { sirka: 290 }), { nad: true, tema: 'cerny' });
  }
  nabidka(e, kotva) {
    let k = kotva;
    if (!k) { k = el('div', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } }); document.body.append(k); }
    const u = rozbal(k, nabidka([
      { text: 'Další', akce: () => this.dalsi() },
      { text: 'Předchozí', akce: () => this.predchozi() },
      { text: 'Poslední zobrazený', zakazano: !this.historie.length, akce: () => this.jdiNa(this.historie.pop()) },
      { text: 'Zobrazit všechny snímky', akce: () => this.otevriPrehled() },
      { text: 'Přiblížit', akce: () => this.lupa(true) },
      'sep',
      { text: this.o.prezentujici ? 'Skrýt zobrazení prezentujícího' : 'Zobrazit zobrazení prezentujícího', akce: () => this.prepniPrezentujiciho() },
      { text: 'Obrazovka: černá', klavesa: 'B', akce: () => this.clona('#000') },
      { text: 'Obrazovka: bílá', klavesa: 'W', akce: () => this.clona('#fff') },
      { text: 'Pero', akce: () => this.nastavNastroj('pero') },
      { text: 'Laserové ukazovátko', akce: () => this.nastavNastroj('laser') },
      { text: 'Nápověda', klavesa: 'F1', akce: () => this.napoveda() },
      'sep',
      { text: 'Ukončit prezentaci', klavesa: 'Esc', akce: () => this.ukonci() },
    ], { sirka: 270 }), { nad: !!kotva, tema: 'cerny', poZavreni: () => { if (!kotva) k.remove(); } });
    u?.classList.add('pr-show-nabidka');
  }
  napoveda() {
    const radky = [['N, Enter, mezerník, šipka vpravo', 'Další animace nebo snímek'], ['P, Backspace, šipka vlevo', 'Předchozí animace nebo snímek'], ['číslo + Enter', 'Přejít na snímek'], ['B / W', 'Černá / bílá obrazovka'], ['G, −', 'Zobrazit všechny snímky'], ['Ctrl+P / Ctrl+L', 'Pero / laserové ukazovátko'], ['E', 'Vymazat rukopis'], ['Esc', 'Ukončit prezentaci']];
    const d = el('div.pr-show-napoveda', {}, el('h2', { text: 'Nápověda k prezentaci' }), el('table', {}, radky.map(([a, b]) => el('tr', {}, el('td', { text: a }), el('td', { text: b })))), el('button.ps-tlac.primarni', { type: 'button', text: 'OK', onclick: () => d.remove() }));
    this.koren.append(d);
  }

  // ------------------------------------------------------------ přehled snímků
  otevriPrehled() {
    if (this.prehled) return;
    const p = el('div.pr-show-prehled');
    const mrizka = el('div.pr-show-prehled-mrizka');
    const w = 220;
    this.pres.snimky.forEach((s, i) => {
      const k = w / this.W;
      const sn = kresliSnimek(this.pres, s, { cislo: i + 1 });
      sn.style.transform = `scale(${k})`; sn.style.transformOrigin = '0 0';
      const mini = el('div.pr-mini', { style: { width: w + 'px', height: this.H * k + 'px' } }, sn);
      mrizka.append(el('button.pr-show-prehled-pol' + (i === this.i ? '.aktivni' : '') + (s.skryty ? '.skryty' : ''), { type: 'button', onclick: () => this.jdiNa(i) }, mini, el('span', { text: String(i + 1) })));
      requestAnimationFrame(() => poVlozeni(sn, this.pres, s));
    });
    p.append(el('button.pr-show-prehled-zpet', { type: 'button', title: 'Zpět', text: '←', onclick: () => this.zavriPrehled() }), el('h2', { text: 'Všechny snímky' }), mrizka);
    this.koren.append(p);
    this.prehled = p;
  }
  zavriPrehled() { this.prehled?.remove(); this.prehled = null; this.koren.focus(); }

  // ------------------------------------------------------------ zobrazení prezentujícího
  postavPrezentujiciho() {
    this.koren.classList.add('prezentujici');
    const casovac = el('span.pr-prez-cas', { text: '0:00:00' });
    const hodiny = el('span.pr-prez-hodiny');
    const pauza = el('button.pr-prez-b', { type: 'button', title: 'Pozastavit časovač', text: '❚❚', onclick: () => { this.pauzaOd = this.pauzaOd ? null : Date.now(); pauza.textContent = this.pauzaOd ? '▶' : '❚❚'; } });
    const reset = el('button.pr-prez-b', { type: 'button', title: 'Restartovat časovač', text: '↻', onclick: () => { this.start = Date.now(); } });
    const aktualni = el('div.pr-prez-aktualni');
    const dalsi = el('div.pr-prez-dalsi');
    const poznamky = el('div.pr-prez-poznamky');
    const cislo = el('span.pr-prez-cislo');
    const vel = { v: 18 };
    const nav = el('div.pr-prez-nav', {},
      el('button.pr-prez-b', { type: 'button', title: 'Předchozí', text: '◀', onclick: () => this.predchozi() }),
      cislo,
      el('button.pr-prez-b', { type: 'button', title: 'Další', text: '▶', onclick: () => this.dalsi() }));
    const nastroje = el('div.pr-prez-nastroje', {},
      el('button.pr-prez-b', { type: 'button', title: 'Pera a laserová ukazovátka', text: '✎', onclick: (e) => this.nabidkaPera(e.currentTarget) }),
      el('button.pr-prez-b', { type: 'button', title: 'Zobrazit všechny snímky', text: '▦', onclick: () => this.otevriPrehled() }),
      el('button.pr-prez-b', { type: 'button', title: 'Přiblížit snímek', text: '⌕', onclick: () => this.lupa(true) }),
      el('button.pr-prez-b', { type: 'button', title: 'Zčernat nebo zrušit zčernání prezentace', text: '◼', onclick: () => this.clona('#000') }),
      el('button.pr-prez-b', { type: 'button', title: 'Další možnosti prezentace', text: '···', onclick: (e) => this.nabidka(e, e.currentTarget) }));
    const panel = el('div.pr-prez-panel', {},
      el('div.pr-prez-horni', {},
        el('div.pr-prez-odkazy', {}, el('button', { type: 'button', text: 'Zobrazit hlavní panel', onclick: () => { this.koren.classList.toggle('bez-fs'); document.exitFullscreen?.().catch(() => {}); } }),
          el('button', { type: 'button', text: 'Nastavení zobrazení ▾', onclick: (e) => rozbal(e.currentTarget, nabidka([{ text: 'Skrýt zobrazení prezentujícího', akce: () => this.prepniPrezentujiciho() }]), { tema: 'cerny' }) }),
          el('button', { type: 'button', text: 'Ukončit prezentaci', onclick: () => this.ukonci() }))),
      el('div.pr-prez-telo', {},
        el('div.pr-prez-levo', {}, el('div.pr-prez-casy', {}, casovac, pauza, reset, hodiny), aktualni, el('div.pr-prez-dole', {}, nastroje, nav)),
        el('div.pr-prez-pravo', {}, el('div.pr-prez-nadpis', { text: 'Další snímek' }), dalsi, poznamky,
          el('div.pr-prez-pismo', {},
            el('button.pr-prez-b', { type: 'button', title: 'Zvětšit text', text: 'A+', onclick: () => { vel.v = Math.min(48, vel.v + 2); poznamky.style.fontSize = vel.v + 'px'; } }),
            el('button.pr-prez-b', { type: 'button', title: 'Zmenšit text', text: 'A−', onclick: () => { vel.v = Math.max(10, vel.v - 2); poznamky.style.fontSize = vel.v + 'px'; } })))));
    this.koren.append(panel);
    aktualni.append(this.scena);
    this.prez = { panel, casovac, hodiny, aktualni, dalsi, poznamky, cislo };
    poznamky.style.fontSize = vel.v + 'px';
  }
  prepniPrezentujiciho() {
    const od = this.i;
    this.o.zachovatFs = true;   // celá obrazovka zůstane, nová instance si ji nežádá znovu
    this.ukonci({ tise: true });
    prezentuj(this.P, { ...this.o, zachovatFs: false, od, prezentujici: !this.o.prezentujici }).then(() => this.konecCb());
  }
  obnovPrezentujiciho() {
    if (!this.prez) return;
    const { dalsi, poznamky, cislo } = this.prez;
    const n = this.pres.snimky.length;
    cislo.textContent = `Snímek ${this.i + 1} z ${n}`;
    dalsi.replaceChildren();
    let nahled = null;
    if (this.krok < this.kroky.length && !this.konecObr) nahled = el('div.pr-prez-info', { text: 'Další animace na tomto snímku' });
    else {
      const j = this.dalsiViditelny(this.i, 1);
      if (j === null) nahled = el('div.pr-prez-info', { text: 'Konec prezentace' });
      else {
        const w = dalsi.clientWidth || 360;
        const k = w / this.W;
        const sn = kresliSnimek(this.pres, this.pres.snimky[j], { cislo: j + 1 });
        sn.style.transform = `scale(${k})`; sn.style.transformOrigin = '0 0';
        nahled = el('div.pr-mini', { style: { width: w + 'px', height: this.H * k + 'px' } }, sn);
        requestAnimationFrame(() => poVlozeni(sn, this.pres, this.pres.snimky[j]));
      }
    }
    dalsi.append(nahled);
    poznamky.textContent = this.konecObr ? '' : this.s?.poznamky || 'Žádné poznámky.';
    poznamky.classList.toggle('prazdne', !this.s?.poznamky);
  }
  obnovCasy() {
    if (this.pauzaOd) return;
    if (this.prez) {
      this.prez.casovac.textContent = cas(Date.now() - this.start);
      this.prez.hodiny.textContent = new Date().toLocaleTimeString('cs-CZ', { hour: 'numeric', minute: '2-digit' });
    }
    if (this.zk) {
      this.zk.snimek.textContent = casKratky(Date.now() - this.casSnimku - this.pauza);
      this.zk.celkem.textContent = cas(Date.now() - this.start);
    }
    if (this.cteni) this.cteni.cislo.textContent = `Snímek ${this.i + 1} z ${this.pres.snimky.length}`;
  }

  // ------------------------------------------------------------ zkouška časování
  postavZkousku() {
    const snimek = el('span.pr-zk-cas', { text: '00:00' });
    const celkem = el('span.pr-zk-celkem', { text: '0:00:00' });
    let pauzaOd = null;
    const lista = el('div.pr-zk-lista', {},
      el('span.pr-zk-titulek', { text: 'Záznam' }),
      el('button', { type: 'button', title: 'Další', text: '➜', onclick: () => this.dalsi() }),
      el('button', { type: 'button', title: 'Pozastavit záznam', text: '❚❚', onclick: (e) => { if (pauzaOd) { this.pauza += Date.now() - pauzaOd; pauzaOd = null; e.currentTarget.textContent = '❚❚'; } else { pauzaOd = Date.now(); e.currentTarget.textContent = '▶'; } } }),
      snimek,
      el('button', { type: 'button', title: 'Opakovat', text: '↺', onclick: () => { this.casSnimku = Date.now(); this.pauza = 0; } }),
      celkem);
    this.koren.append(lista);
    this.zk = { snimek, celkem };
  }

  // ------------------------------------------------------------ zobrazení pro čtení (v okně)
  postavCteni() {
    const cislo = el('span');
    const lista = el('div.pr-cteni-lista', {},
      el('span.pr-cteni-nazev', { text: this.P.st.nazev.replace(/\.pptx$/i, '') }),
      el('div.ps-karty-mezera'),
      cislo,
      el('button', { type: 'button', title: 'Předchozí', text: '◀', onclick: () => this.predchozi() }),
      el('button', { type: 'button', title: 'Nabídka', text: '▤', onclick: (e) => this.nabidka(e, e.currentTarget) }),
      el('button', { type: 'button', title: 'Další', text: '▶', onclick: () => this.dalsi() }),
      el('button', { type: 'button', title: 'Normální', text: 'Normální', onclick: () => this.ukonci() }));
    this.koren.append(lista);
    this.cteni = { cislo };
  }

  // ------------------------------------------------------------ konec
  ukonci({ tise = false } = {}) {
    if (this.konci) return;
    this.konci = true;
    clearInterval(this.tik);
    clearTimeout(this.autoCas);
    this.zastavZvuky();
    this.ro.disconnect();
    document.removeEventListener('fullscreenchange', this.fsKonec);
    zavriRozbal();
    if (document.fullscreenElement && !this.o.okno && !this.o.zachovatFs) document.exitFullscreen?.().catch(() => {});
    this.koren.remove();
    if (tise) return;
    const P = this.P;
    const pokracuj = () => this.konecCb();
    // zkouška časování → uložit časy
    if (this.o.zkouska && this.s) {
      this.casovani[this.s.id] = (this.casovani[this.s.id] || 0) + (Date.now() - this.casSnimku - this.pauza) / 1000;
      const celkem = Object.values(this.casovani).reduce((a, b) => a + b, 0);
      P.dotaz(`Celková doba prezentace byla ${cas(celkem * 1000)}. Chcete zachovat nová časování snímků?`, [
        { text: 'Ano', primarni: true, akce: () => P.prikaz('Vyzkoušet časování', () => { for (const [id, t] of Object.entries(this.casovani)) { const s = this.pres.snimek(id); if (s) s.prechod = { ...(s.prechod || { typ: 'zadny' }), auto: Math.round(t * 10) / 10 }; } }) },
        { text: 'Ne' },
      ], pokracuj);
      return;
    }
    const inkoust = Object.entries(this.inkoust).filter(([, t]) => t.length);
    if (inkoust.length) {
      P.dotaz('Chcete zachovat rukou psané poznámky?', [
        { text: 'Zachovat', primarni: true, akce: () => P.prikaz('Rukopis z prezentace', () => {
          for (const [id, tahy] of inkoust) {
            const s = this.pres.snimek(id);
            if (!s) continue;
            s.objekty.push({ id: noveId(), typ: 'kresba', x: 0, y: 0, w: this.W, h: this.H, rot: 0, tahy });
          }
        }) },
        { text: 'Zahodit' },
      ], pokracuj);
      return;
    }
    pokracuj();
  }
}
