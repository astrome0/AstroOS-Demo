// AstroTabulky — plovoucí objekty na listu: grafy, obrázky, tvary a textová pole
//
// Objekty mají polohu v pixelech listu (lupa 100 %) a kreslí se jako DOM nad plátnem.
// Tažení mění polohu „naživo“; do historie se zapíše až po puštění (jako šířka sloupce).

import { el } from '../util.js';
import { ik } from '../pismo/ikony.js';
import { rozbal, zavriRozbal, nabidka, dialog, zprava } from '../pismo/ui.js';
import { svgGrafu, dataGrafu, TYPY_GRAFU, STYLY_GRAFU, PALETY, NAZVY_PALET, doporuceneGrafy } from './grafy.js';
import { textOblasti, jmenoListuVeVzorci, MAX_R, MAX_C } from './adresy.js';
import * as D from './dialogy.js';

const noveId = (p) => p + Math.random().toString(36).slice(2, 9);

export const TVARY = [
  ['obdelnik', 'Obdélník', '<rect x="3" y="6" width="26" height="20" />'],
  ['zaoblen', 'Obdélník se zakulacenými rohy', '<rect x="3" y="6" width="26" height="20" rx="5" />'],
  ['elipsa', 'Ovál', '<ellipse cx="16" cy="16" rx="13" ry="10" />'],
  ['trojuhelnik', 'Rovnoramenný trojúhelník', '<path d="M16 4 29 28H3z" />'],
  ['sipka', 'Šipka doprava', '<path d="M3 11h16V5l10 11-10 11v-6H3z" />'],
  ['hvezda', 'Hvězda s pěti cípy', '<path d="m16 3 3.9 8.3 9.1 1.1-6.7 6.2 1.8 9L16 23.2l-8.1 4.4 1.8-9L3 12.4l9.1-1.1z" />'],
  ['kosoctverec', 'Kosočtverec', '<path d="M16 3 29 16 16 29 3 16z" />'],
  ['bublina', 'Popisek: obdélník', '<path d="M3 5h26v16H14l-6 6v-6H3z" />'],
  ['srdce', 'Srdce', '<path d="M16 28S3 20 3 11a6.5 6.5 0 0 1 13-2 6.5 6.5 0 0 1 13 2c0 9-13 17-13 17z" />'],
  ['cara', 'Čára', '<path d="M3 27 29 5" fill="none"/>'],
];

export function pridejObjekty(P) {
  const g = P.grid;
  const L = () => P.S.list;
  const vrstva = g.objekty;
  let uzly = new Map();   // id → element

  // obrazovkové souřadnice z pixelů listu
  const sx = (x) => {
    const fcX = g.osaS.pos(g.fc);
    if (x < fcX && g.fc > g.c0) return g.zahlaviSirka + (x - g.osaS.pos(g.c0)) * g.z;
    return g.x0 + (x - fcX) * g.z - g.scroll.scrollLeft;
  };
  const sy = (y) => {
    const frY = g.osaR.pos(g.fr);
    if (y < frY && g.fr > g.r0) return g.zahlaviVyska + (y - g.osaR.pos(g.r0)) * g.z;
    return g.y0 + (y - frY) * g.z - g.scroll.scrollTop;
  };
  P.najdiObjekt = (id) => L().grafy.find((x) => x.id === id) || L().obrazky.find((x) => x.id === id) || null;

  P.svgGrafu = (gr) => svgGrafu(gr, dataGrafu(P.S, L(), gr), gr.w, gr.h);

  P.obnovObjekty = () => {
    const l = L();
    g.geometrie();
    const sbV = g.scroll.offsetWidth - g.scroll.clientWidth, sbH = g.scroll.offsetHeight - g.scroll.clientHeight;
    vrstva.style.clipPath = `inset(${g.zahlaviVyska}px ${sbV}px ${sbH}px ${g.zahlaviSirka}px)`;
    const vse = [...l.obrazky.map((o) => ({ ...o, _druh: 'obr' })), ...l.grafy.map((o) => ({ ...o, _druh: 'graf' }))];
    const ids = new Set(vse.map((x) => x.id));
    for (const [id, u] of uzly) if (!ids.has(id)) { u.remove(); uzly.delete(id); }
    for (const o of vse) {
      let u = uzly.get(o.id);
      if (!u) { u = vytvorUzel(o); uzly.set(o.id, u); vrstva.append(u); }
      u.dataset.podpis !== podpis(o) && kresliObsah(u, o);
      umisti(u, o);
      u.classList.toggle('vybrany', P.st.objekt?.id === o.id);
    }
    if (P.st.objekt && !P.najdiObjekt(P.st.objekt.id)) P.vyberObjekt(null);
  };
  const podpis = (o) => JSON.stringify({ ...o, _druh: undefined }) + (o._druh === 'graf' ? P.S.gen + ':' + P.S.list.id : '');

  P.poPosunu = () => {
    for (const o of [...L().grafy, ...L().obrazky]) { const u = uzly.get(o.id); if (u) umisti(u, o); }
    P.umistiSipkuOvereni?.();
    g.chytry.hidden = true;
  };

  function umisti(u, o) {
    const z = g.z;
    u.style.left = sx(o.x) + 'px';
    u.style.top = sy(o.y) + 'px';
    u.style.width = o.w * z + 'px';
    u.style.height = o.h * z + 'px';
    const svg = u.querySelector('.tb-obj-obsah > svg');
    if (svg) { svg.style.width = o.w * z + 'px'; svg.style.height = o.h * z + 'px'; }
    const txt = u.querySelector('.tb-tvar-text');
    if (txt) txt.style.fontSize = (o.vel || 11) * 4 / 3 * z + 'px';
  }

  function kresliObsah(u, o) {
    u.dataset.podpis = podpis(o);
    const obsah = u.querySelector('.tb-obj-obsah');
    if (o._druh === 'graf') {
      obsah.innerHTML = P.svgGrafu(P.najdiObjekt(o.id) || o);
      obsah.title = o.alt || '';
    } else if (o.typ === 'obrazek') {
      obsah.replaceChildren(el('img', { src: o.src, alt: o.alt || '', draggable: 'false' }));
    } else {
      const t = TVARY.find((x) => x[0] === o.tvar);
      const vypln = o.tvar === 'text' ? o.vypln || 'transparent' : o.vypln || '#156082';
      const obrys = o.tvar === 'text' ? o.obrys || 'transparent' : o.obrys || '#0E3B55';
      const tvar = t ? `<svg viewBox="0 0 32 32" preserveAspectRatio="none" class="tb-tvar-svg"><g fill="${vypln}" stroke="${obrys}" stroke-width="${o.tvar === 'cara' ? 2 : 1.2}" vector-effect="non-scaling-stroke">${t[2]}</g></svg>` : o.tvar === 'text' ? `<div class="tb-textove-pole" style="background:${vypln};border:1px solid ${obrys}"></div>` : '';
      obsah.innerHTML = tvar;
      const text = el('div.tb-tvar-text', { style: { color: o.barvaTextu || (o.tvar === 'text' ? '#000' : '#fff'), textAlign: o.zarovnani || (o.tvar === 'text' ? 'left' : 'center'), fontWeight: o.b ? '700' : '', fontStyle: o.i ? 'italic' : '' } });
      text.textContent = o.text || '';
      obsah.append(text);
    }
  }

  function vytvorUzel(o) {
    const u = el('div.tb-objekt.' + (o._druh === 'graf' ? 'graf' : o.typ), { dataset: { id: o.id }, tabindex: '-1' },
      el('div.tb-obj-obsah'),
      ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((r) => el('div.tb-obj-uchyt.' + r, { dataset: { r } })));
    if (o._druh === 'graf') {
      u.append(el('div.tb-graf-tlacitka', {},
        el('button', { type: 'button', title: 'Prvky grafu', dataset: { akce: 'prvky' } }, ik('plus')),
        el('button', { type: 'button', title: 'Styly grafu', dataset: { akce: 'styly' } }, ik('stetecGraf')),
        el('button', { type: 'button', title: 'Filtry grafu', dataset: { akce: 'filtry' } }, ik('filtrMaly'))));
    }
    u.addEventListener('pointerdown', (e) => mysDolu(e, u));
    u.addEventListener('dblclick', (e) => {
      const obj = P.najdiObjekt(u.dataset.id);
      if (!obj) return;
      if (obj.grafTyp || u.classList.contains('graf')) { P.podokno('formatGrafu'); return; }
      if (obj.typ === 'tvar') upravText(u, obj);
    });
    u.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); P.vyberObjekt({ id: u.dataset.id, typ: u.classList.contains('graf') ? 'graf' : 'obr' }); nabidkaObjektu(e, u); });
    u.addEventListener('keydown', (e) => klavesaObjektu(e));
    u.addEventListener('wheel', (e) => { if (!e.ctrlKey) { g.scroll.scrollTop += e.deltaY; g.scroll.scrollLeft += e.deltaX; } }, { passive: true });
    return u;
  }

  function mysDolu(e, u) {
    if (e.button === 2) return;
    const tl = e.target.closest('.tb-graf-tlacitka button');
    if (tl) { e.stopPropagation(); tlacitkoGrafu(tl); return; }
    if (e.target.closest('[contenteditable="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    if (g.edit && !g.potvrdEditaci()) return;
    const id = u.dataset.id;
    P.vyberObjekt({ id, typ: u.classList.contains('graf') ? 'graf' : 'obr' });
    const o = P.najdiObjekt(id);
    if (!o) return;
    if (L().zamek && !L().zamek.povolit?.objekty) { P.hlaskaZamek(); return; }
    const uchyt = e.target.closest('.tb-obj-uchyt')?.dataset.r;
    const x0 = e.clientX, y0 = e.clientY;
    const puvodni = { x: o.x, y: o.y, w: o.w, h: o.h };
    const pomer = o.w / o.h;
    let pohnuto = false;
    const mv = (ev) => {
      const dx = (ev.clientX - x0) / g.z, dy = (ev.clientY - y0) / g.z;
      if (!pohnuto && Math.abs(dx) + Math.abs(dy) < 3) return;
      pohnuto = true;
      if (!uchyt) { o.x = Math.max(0, puvodni.x + dx); o.y = Math.max(0, puvodni.y + dy); }
      else {
        let { x, y, w, h } = puvodni;
        if (uchyt.includes('e')) w = Math.max(20, puvodni.w + dx);
        if (uchyt.includes('s')) h = Math.max(20, puvodni.h + dy);
        if (uchyt.includes('w')) { w = Math.max(20, puvodni.w - dx); x = puvodni.x + puvodni.w - w; }
        if (uchyt.includes('n')) { h = Math.max(20, puvodni.h - dy); y = puvodni.y + puvodni.h - h; }
        if (ev.shiftKey && uchyt.length === 2) { if (w / h > pomer) w = h * pomer; else h = w / pomer; }
        Object.assign(o, { x: Math.max(0, x), y: Math.max(0, y), w, h });
      }
      umisti(u, o);
      if (uchyt && u.classList.contains('graf')) { u.dataset.podpis = ''; kresliObsah(u, { ...o, _druh: 'graf' }); umisti(u, o); }
    };
    const up = () => {
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
      if (!pohnuto) { u.focus({ preventScroll: true }); return; }
      const nove = { x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.w), h: Math.round(o.h) };
      Object.assign(o, puvodni);
      P.prikaz(uchyt ? 'Změnit velikost objektu' : 'Přesunout objekt', () => Object.assign(P.najdiObjekt(id), nove), { prepocet: false });
      u.focus({ preventScroll: true });
    };
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
  }

  function klavesaObjektu(e) {
    e.stopPropagation();
    const o = P.st.objekt && P.najdiObjekt(P.st.objekt.id);
    if (!o) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); P.smazObjekt(); return; }
    if (e.key === 'Escape') { e.preventDefault(); P.vyberObjekt(null); g.fokus(); return; }
    const krok = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (krok) { e.preventDefault(); const k = ctrl ? 1 : 8; P.prikaz('Přesunout objekt', () => { o.x = Math.max(0, o.x + krok[0] * k); o.y = Math.max(0, o.y + krok[1] * k); }, { prepocet: false }); return; }
    if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); P.kopirujObjekt(false); return; }
    if (ctrl && e.key.toLowerCase() === 'x') { e.preventDefault(); P.kopirujObjekt(true); return; }
    if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); P.vlozObjekt(); return; }
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); P.zpet(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); P.znovu(); return; }
    P.globalniKlavesa(e);
  }

  P.vyberObjekt = (x) => {
    P.st.objekt = x;
    for (const [id, u] of uzly) u.classList.toggle('vybrany', x?.id === id);
    if (x) {
      uzly.get(x.id)?.focus({ preventScroll: true });
      if (x.typ === 'graf' && P.st.karta !== 'grafNavrh' && P.st.karta !== 'grafFormat') P.dalsiKarta = P.st.karta;
    }
    P.obnov();
    if (x?.typ === 'graf' && P.st.podokno === 'formatGrafu') P.podokno('formatGrafu');
  };

  P.smazObjekt = () => {
    const x = P.st.objekt;
    if (!x) return;
    P.vyberObjekt(null);
    P.prikaz('Odstranit objekt', () => {
      const l = L();
      l.grafy = l.grafy.filter((o) => o.id !== x.id);
      l.obrazky = l.obrazky.filter((o) => o.id !== x.id);
    }, { prepocet: false });
    g.fokus();
  };

  P.kopirujObjekt = (vyjmout) => {
    const o = P.st.objekt && P.najdiObjekt(P.st.objekt.id);
    if (!o) return;
    P.schrankaObjekt = { ...structuredClone(o), _druh: P.st.objekt.typ };
    if (vyjmout) P.smazObjekt();
  };
  P.vlozObjekt = () => {
    const s = P.schrankaObjekt;
    if (!s) return false;
    const o = { ...structuredClone(s), id: noveId(s._druh === 'graf' ? 'g' : 'o'), x: s.x + 16, y: s.y + 16 };
    delete o._druh;
    P.prikaz('Vložit', () => (s._druh === 'graf' ? L().grafy : L().obrazky).push(o), { prepocet: false });
    P.schrankaObjekt = { ...o, _druh: s._druh };
    P.vyberObjekt({ id: o.id, typ: s._druh === 'graf' ? 'graf' : 'obr' });
    return true;
  };

  P.upravGraf = (zmena, popis = 'Upravit graf') => {
    const o = P.st.objekt?.typ === 'graf' ? P.najdiObjekt(P.st.objekt.id) : null;
    if (!o) return;
    P.prikaz(popis, () => Object.assign(P.najdiObjekt(o.id), typeof zmena === 'function' ? zmena(o) : zmena), { prepocet: false });
  };
  P.vybranyGraf = () => (P.st.objekt?.typ === 'graf' ? P.najdiObjekt(P.st.objekt.id) : null);

  P.stylObjektu = (zmena) => {
    const o = P.st.objekt ? P.najdiObjekt(P.st.objekt.id) : null;
    if (!o || o.grafTyp) return;
    const z = {};
    if ('b' in zmena) z.b = zmena.b;
    if ('i' in zmena) z.i = zmena.i;
    if ('barva' in zmena) z.barvaTextu = zmena.barva;
    if ('pozadi' in zmena) z.vypln = zmena.pozadi;
    if ('vel' in zmena) z.vel = zmena.vel;
    if ('h' in zmena) z.zarovnani = { l: 'left', c: 'center', r: 'right' }[zmena.h];
    P.prikaz('Formát tvaru', () => Object.assign(P.najdiObjekt(o.id), z), { prepocet: false });
  };

  function upravText(u, o) {
    const t = u.querySelector('.tb-tvar-text');
    t.contentEditable = 'true';
    t.focus();
    const r = document.createRange(); r.selectNodeContents(t); getSelection().removeAllRanges(); getSelection().addRange(r);
    const konec = () => {
      t.contentEditable = 'false';
      t.removeEventListener('blur', konec);
      const text = t.innerText.replace(/\n$/, '');
      if (text !== (o.text || '')) P.prikaz('Text tvaru', () => { P.najdiObjekt(o.id).text = text; }, { prepocet: false });
    };
    t.addEventListener('blur', konec);
    t.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') t.blur(); });
  }

  // ------------------------------------------------------------ vložení grafu
  P.vlozGraf = (typ = null, { zdroj = null, naNovyList = false } = {}) => {
    const l = L();
    let oblast;
    if (zdroj) oblast = zdroj;
    else {
      const d = P.oblastDat();
      oblast = d.oblast;
      if (oblast.r1 === oblast.r2 && oblast.c1 === oblast.c2 && P.S.hodnota(l, oblast.r1, oblast.c1) === null) oblast = null;
    }
    const text = oblast ? jmenoListuVeVzorci(l.nazev) + '!' + textOblasti(oblast, true) : '';
    const gr = { id: noveId('g'), typ: typ || 'sloupcovy', zdroj: text, radyVeSloupcich: true, w: 480, h: 288, styl: 1, paleta: 'barevne' };
    if (!typ && oblast) {
      const d = dataGrafu(P.S, l, gr);
      gr.typ = doporuceneGrafy(d)[0];
      if (d.rady.length > d.kategorie.length && d.kategorie.length > 1 && d.rady.length > 4) gr.radyVeSloupcich = false;
    }
    // pravidla Excelu: víc řad než kategorií → řady v řádcích
    if (oblast) {
      const d = dataGrafu(P.S, l, gr);
      if (d.rady.length > d.kategorie.length && gr.radyVeSloupcich && d.kategorie.length > 0 && !/vysec|prsten/.test(gr.typ)) gr.radyVeSloupcich = false;
    }
    g.geometrie();
    const vid = g.viditelne || { r1: 0, c1: 0 };
    if (oblast) {
      gr.x = Math.max(g.osaS.pos(vid.c1), Math.min(g.osaS.pos(oblast.c2 + 1) + 24, g.osaS.pos(vid.c1) + (g.sirka - g.x0) / g.z - gr.w - 20));
      gr.y = Math.max(g.osaR.pos(vid.r1) + 10, g.osaR.pos(oblast.r1));
    } else {
      gr.x = g.osaS.pos(vid.c1) + 60; gr.y = g.osaR.pos(vid.r1) + 40;
    }
    if (naNovyList) {
      P.prikaz('Vložit graf', () => {
        const nl = P.S.pridejList(P.S.aktivni, P.S.volneJmenoListu('Graf'));
        gr.x = 10; gr.y = 10; gr.w = 900; gr.h = 560;
        nl.grafy.push(gr);
        nl.mrizka = false;
      }, { prepocet: false });
      P.kresliListy();
      g.obnovPosun();
    } else P.prikaz('Vložit graf', () => l.grafy.push(gr), { prepocet: false });
    P.obnovObjekty();
    P.vyberObjekt({ id: gr.id, typ: 'graf' });
    P.prepniKartu('grafNavrh');
  };

  P.vlozObrazekSoubor = (soubor) => {
    if (!soubor) return;
    const r = new FileReader();
    r.onload = () => P.vlozObrazekSrc(r.result, soubor.name);
    r.readAsDataURL(soubor);
  };
  P.vlozObrazekSrc = (src, nazev = '') => {
    const img = new Image();
    img.onload = () => {
      // zmenšit na rozumnou velikost (localStorage má ~5 MB)
      let w = img.naturalWidth, h = img.naturalHeight;
      const max = 1200;
      let data = src;
      if (w > max || h > max || src.length > 400000) {
        const k = Math.min(1, max / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        data = c.toDataURL('image/jpeg', 0.85);
        w = c.width; h = c.height;
      }
      const vw = Math.min(w, 420), vh = Math.round(h * (vw / w));
      g.geometrie();
      const v = L().vyber;
      const o = { id: noveId('o'), typ: 'obrazek', src: data, x: g.osaS.pos(v.c), y: g.osaR.pos(v.r), w: vw, h: vh, alt: nazev.replace(/\.[^.]+$/, '') };
      P.prikaz('Vložit obrázek', () => L().obrazky.push(o), { prepocet: false });
      P.vyberObjekt({ id: o.id, typ: 'obr' });
    };
    img.src = src;
  };
  P.vlozTvar = (tvar) => {
    g.geometrie();
    const v = L().vyber;
    const o = { id: noveId('o'), typ: 'tvar', tvar, x: g.osaS.pos(v.c) + 20, y: g.osaR.pos(v.r) + 10, w: tvar === 'text' ? 200 : 140, h: tvar === 'text' ? 60 : 100, text: tvar === 'text' ? 'Text' : '' };
    P.prikaz('Vložit tvar', () => L().obrazky.push(o), { prepocet: false });
    P.vyberObjekt({ id: o.id, typ: 'obr' });
    if (tvar === 'text') setTimeout(() => { const u = uzly.get(o.id); if (u) upravText(u, o); }, 50);
  };

  // ------------------------------------------------------------ boční tlačítka grafu
  function tlacitkoGrafu(tl) {
    const gr = P.vybranyGraf();
    if (!gr) return;
    const akce = tl.dataset.akce;
    if (akce === 'prvky') {
      const zaskrt = (text, klic, vychozi, hodnota = true, jinak = false) => {
        const zap = gr[klic] === undefined ? vychozi : gr[klic] !== jinak && gr[klic] !== null && gr[klic] !== false;
        return el('label.tb-prvek', {}, el('input', { type: 'checkbox', checked: zap || null, onchange: (e) => P.upravGraf({ [klic]: e.target.checked ? hodnota : jinak }, text) }), el('span', { text }));
      };
      const kolac = /vysec|prsten/.test(gr.typ);
      rozbal(tl, el('div.tb-prvky-grafu', {},
        el('div.ps-nab-nadpis', { text: 'PRVKY GRAFU' }),
        !kolac ? zaskrt('Osy', 'osy', true, true, false) : null,
        !kolac ? el('label.tb-prvek', {}, el('input', { type: 'checkbox', checked: gr.nazevOsyX || gr.nazevOsyY ? true : null, onchange: (e) => P.upravGraf(e.target.checked ? { nazevOsyX: 'Název osy', nazevOsyY: 'Název osy' } : { nazevOsyX: null, nazevOsyY: null }, 'Názvy os') }), el('span', { text: 'Názvy os' })) : null,
        el('label.tb-prvek', {}, el('input', { type: 'checkbox', checked: gr.zobrazitNazev !== false ? true : null, onchange: (e) => P.upravGraf({ zobrazitNazev: e.target.checked }, 'Název grafu') }), el('span', { text: 'Název grafu' })),
        zaskrt('Popisky dat', 'popisky', STYLY_GRAFU.find((s) => s.id === (gr.styl || 1))?.popisky || false),
        !kolac ? zaskrt('Mřížka', 'mrizka', true, true, false) : null,
        el('label.tb-prvek', {}, el('input', { type: 'checkbox', checked: (gr.legenda === undefined ? (kolac || dataGrafu(P.S, L(), gr).rady.length > 1) : !!gr.legenda) || null, onchange: (e) => P.upravGraf({ legenda: e.target.checked ? 'dole' : null }, 'Legenda') }), el('span', { text: 'Legenda' })),
        !kolac ? zaskrt('Spojnice trendu', 'trend', false) : null), { app: 'tabulky' });
      return;
    }
    if (akce === 'styly') {
      const telo = el('div.tb-styly-grafu');
      const zalozky = el('div.tb-sg-zalozky', {}, el('button.aktivni', { type: 'button', text: 'Styl' }), el('button', { type: 'button', text: 'Barva' }));
      const kresli = (co) => {
        zalozky.querySelectorAll('button').forEach((b, i) => b.classList.toggle('aktivni', (i === 0) === (co === 'styl')));
        if (co === 'styl') telo.replaceChildren(...STYLY_GRAFU.map((s) => el('button.tb-sg-nahled' + ((gr.styl || 1) === s.id ? '.zapnuto' : ''), { type: 'button', title: s.nazev, onclick: () => { P.upravGraf({ styl: s.id }, 'Styl grafu'); zavriRozbal(); }, html: svgGrafu({ ...gr, styl: s.id, id: gr.id + 's' + s.id, nazev: gr.nazev }, dataGrafu(P.S, L(), gr), 240, 150) })));
        else telo.replaceChildren(...Object.entries(PALETY).map(([id, barvy]) => el('button.tb-sg-paleta' + ((gr.paleta || 'barevne') === id ? '.zapnuto' : ''), { type: 'button', title: NAZVY_PALET[id], onclick: () => { P.upravGraf({ paleta: id, barvyRad: null }, 'Změnit barvy'); zavriRozbal(); } }, el('span', { text: NAZVY_PALET[id] }), el('div', {}, barvy.map((b) => el('i', { style: { background: b } }))))));
      };
      zalozky.children[0].onclick = () => kresli('styl');
      zalozky.children[1].onclick = () => kresli('barva');
      kresli('styl');
      rozbal(tl, el('div.tb-sg', {}, zalozky, telo), { app: 'tabulky' });
      return;
    }
    if (akce === 'filtry') {
      const d = dataGrafu(P.S, L(), gr);
      rozbal(tl, el('div.tb-prvky-grafu', {},
        el('div.ps-nab-nadpis', { text: 'ŘADY' }),
        ...d.rady.map((r, i) => el('div.tb-prvek', {}, el('i.tb-leg', { style: { background: (PALETY[gr.paleta || 'barevne'])[i % 6] } }), el('span', { text: r.nazev }))),
        el('div.ps-nab-nadpis', { text: 'KATEGORIE' }),
        ...d.kategorie.slice(0, 12).map((k) => el('div.tb-prvek', {}, el('span', { text: k }))),
        el('button.ps-zk-odkaz', { type: 'button', text: 'Vybrat data…', onclick: () => { zavriRozbal(); D.dialogVybratData(P); } })), { app: 'tabulky' });
    }
  }

  function nabidkaObjektu(e, u) {
    const kotva = el('div', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } });
    document.body.append(kotva);
    const graf = u.classList.contains('graf');
    const o = P.najdiObjekt(u.dataset.id);
    const polozky = [
      { text: 'Vyjmout', ikona: 'vyjmout', akce: () => P.kopirujObjekt(true) },
      { text: 'Kopírovat', ikona: 'kopirovat', akce: () => P.kopirujObjekt(false) },
      { text: 'Vložit', ikona: 'vlozit', zakazano: !P.schrankaObjekt, akce: () => P.vlozObjekt() },
      'sep',
      ...(graf ? [
        { text: 'Obnovit, aby odpovídalo stylu', akce: () => P.upravGraf({ styl: 1, paleta: 'barevne', barvyRad: null, pozadi: null }, 'Obnovit styl') },
        { text: 'Změnit typ grafu…', ikona: 'zmenitTypGrafu', akce: () => D.dialogVlozitGraf(P, { zmena: true }) },
        { text: 'Vybrat data…', ikona: 'vybratData', akce: () => D.dialogVybratData(P) },
        { text: 'Přesunout graf…', ikona: 'presunoutGraf', akce: () => D.dialogPresunGraf(P) },
        'sep',
        { text: 'Formátovat oblast grafu…', akce: () => P.podokno('formatGrafu') },
        { text: 'Upravit alternativní text…', akce: () => upravAlt(o) },
      ] : [
        ...(o?.typ === 'tvar' ? [{ text: 'Upravit text', akce: () => upravText(u, o) }] : []),
        { text: 'Přenést do popředí', akce: () => P.prikaz('Pořadí', () => { const l = L(); const x = l.obrazky.find((y) => y.id === o.id); l.obrazky = [...l.obrazky.filter((y) => y !== x), x]; }, { prepocet: false }) },
        { text: 'Přenést do pozadí', akce: () => P.prikaz('Pořadí', () => { const l = L(); const x = l.obrazky.find((y) => y.id === o.id); l.obrazky = [x, ...l.obrazky.filter((y) => y !== x)]; }, { prepocet: false }) },
        { text: 'Upravit alternativní text…', akce: () => upravAlt(o) },
        ...(o?.typ === 'obrazek' ? [{ text: 'Obnovit původní velikost', akce: () => { const img = new Image(); img.onload = () => P.prikaz('Velikost', () => Object.assign(P.najdiObjekt(o.id), { w: img.naturalWidth, h: img.naturalHeight }), { prepocet: false }); img.src = o.src; } }] : []),
      ]),
      'sep',
      { text: 'Odstranit', ikona: 'odstranit', akce: () => P.smazObjekt() },
    ];
    rozbal(kotva, nabidka(polozky, { sirka: 250 }), { poZavreni: () => kotva.remove(), tema: P.koren.dataset.motiv, app: 'tabulky' });
  }

  function upravAlt(o) {
    const t = el('textarea.ps-vstup', { rows: 4 }, o.alt || '');
    dialog(P.koren, {
      titulek: 'Alternativní text', sirka: 380,
      obsah: el('div', {}, el('p.ps-pozn', { text: 'Popište lidem se zrakovým postižením, co je na obrázku nebo v grafu.' }), t),
      tlacitka: [{ text: 'OK', primarni: true, akce: () => P.prikaz('Alternativní text', () => { P.najdiObjekt(o.id).alt = t.value.trim(); }, { prepocet: false }) }, { text: 'Zrušit' }],
    });
  }

  // klik mimo objekty ruší jejich výběr
  g.scroll.addEventListener('pointerdown', () => { if (P.st.objekt) P.vyberObjekt(null); }, true);
}

export { TYPY_GRAFU };
