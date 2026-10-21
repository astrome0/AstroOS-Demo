// AstroPrezentace — podokna vpravo: Formát obrazce/obrázku, Formát pozadí, Podokno animací, Designer,
// Výběr, Komentáře, AstroAI, Přístupnost, Schránka a Nápověda.

import { el, pred } from '../util.js';
import { ik } from '../pismo/ikony.js';
import { rozbal, zavriRozbal, nabidka, dialog, pole } from '../pismo/ui.js';
import { send, aktivniRezim } from '../ai.js';
import { barva } from './motivy.js';
import { JMENA_TVARU, jeCara, miniatura, NAZVY_STINU } from './render.js';
import { textZHtml, odstavce, noveId, jePrazdnyText, kopie } from './model.js';
import { ANIMACE, nazevAnimace, VYCHOZI_TRVANI, MOZNOSTI_ANIMACE } from './efekty.js';
import { ikonaAnimace } from './ikony.js';
import { paletaMotivu } from './pas.js';
import { smartArt, tvar, textovePole } from './sablony.js';

const NAZVY = {
  format: 'Formát obrazce', formatObr: 'Formát obrázku', pozadi: 'Formát pozadí', animace: 'Podokno animací', designer: 'Designer', vyber: 'Výběr',
  komentare: 'Komentáře', ai: 'AstroAI', pristupnost: 'Přístupnost', schranka: 'Schránka', napoveda: 'Nápověda', najit: 'Najít',
};

/** Popisek objektu jako v podokně Výběr („Nadpis 1“, „Obdélník 3“…). */
export function nazevObjektu(o, s) {
  if (o.nazev) return o.nazev;
  const i = s.objekty.indexOf(o) + 2;
  if (o.ph) return { nadpis: 'Nadpis', podtitul: 'Podnadpis', obsah: 'Zástupný symbol obsahu', obsah2: 'Zástupný symbol obsahu', text: 'Zástupný symbol textu', text2: 'Zástupný symbol textu' }[o.ph] + ' ' + (i - 1);
  if (o.typ === 'tvar') return (JMENA_TVARU[o.tvar] || 'Obrazec').replace(/^.*: /, '').replace(/^./, (c) => c.toUpperCase()) + ' ' + i;
  return { text: 'Textové pole', obrazek: 'Obrázek', tabulka: 'Tabulka', graf: 'Graf', ikona: 'Grafika', zvuk: 'Zvuk', kresba: 'Rukopis' }[o.typ] + ' ' + i;
}

export function pridejPodokna(P) {
  const uzel = P.podoknoUzel;
  let zruseni = null;

  P.podokno = (typ, o = {}) => {
    zruseni?.();
    zruseni = null;
    if (typ === 'format' && P.stav.objekt?.typ === 'obrazek') typ = 'formatObr';
    P.st.podokno = typ;
    P.podoknoPoVyberu = null;
    if (!typ) { uzel.hidden = true; uzel.replaceChildren(); P.obnov(); P.ed.prizpusob(); return; }
    const telo = el('div.pr-pod-telo');
    uzel.replaceChildren(
      el('div.ps-pod-hlava', {}, el('h2', { text: NAZVY[typ] || typ }), el('button.ps-pod-x', { type: 'button', title: 'Zavřít', onclick: () => P.podokno(null) }, ik('zavrit'))),
      telo);
    uzel.hidden = false;
    uzel.dataset.typ = typ;
    zruseni = PODOKNA[typ]?.(P, telo, o) || null;
    P.obnov();
    requestAnimationFrame(() => { if (P.ed.prizpusobit) P.ed.prizpusob(); });
  };
  P.zavriPodokna = () => { zruseni?.(); zruseni = null; };
}

// ---------------------------------------------------------------- pomocné prvky
const sekce = (nazev, obsah, otevrena = true) => {
  const hlava = el('button.pr-sekce-hlava', { type: 'button' }, el('span.pr-sekce-sipka', { text: otevrena ? '⌄' : '›' }), el('b', { text: nazev }));
  const telo = el('div.pr-sekce-telo', { hidden: !otevrena }, obsah);
  hlava.onclick = () => { telo.hidden = !telo.hidden; hlava.firstChild.textContent = telo.hidden ? '›' : '⌄'; };
  return el('div.pr-sekce', {}, hlava, telo);
};
const radio = (jmeno, moznosti, hodnota, zmena) => el('div.pr-radio', {}, moznosti.map(([v, t]) => el('label', {}, el('input', { type: 'radio', name: jmeno, checked: v === hodnota, onchange: () => zmena(v) }), el('span', { text: t }))));
const radekPole = (popis, prvek) => el('div.pr-pod-radek', {}, el('span', { text: popis }), prvek);
function tlBarvy(P, ref, onVyber, o = {}) {
  const vzor = el('span.pr-tl-barva-vzor', { style: { background: ref && ref !== 'none' ? barva(P.barvy(), ref) : 'transparent' } });
  const b = el('button.pr-tl-barva', { type: 'button', title: 'Barva' }, ik('barvaVyplne'), vzor, ik('sipkaDolu'));
  b.onclick = () => rozbal(b, paletaMotivu(P, { auto: o.auto || null, bezBarvy: !!o.auto, onVyber }), { app: 'prezentace' });
  return b;
}
function cislo(hodnota, { min = 0, max = 9999, krok = 1, jednotka = '', zmena, sirka = 70 }) {
  const i = el('input.ps-vstup.pr-cislo', { type: 'number', min, max, step: krok, value: hodnota ?? '', style: { width: sirka + 'px' } });
  i.addEventListener('keydown', (e) => e.stopPropagation());
  i.onchange = () => { const v = parseFloat(i.value); if (Number.isFinite(v)) zmena(Math.max(min, Math.min(max, v))); };
  return el('span.pr-cislo-ram', {}, i, jednotka ? el('small', { text: jednotka }) : null);
}
function posuvnik(hodnota, { min = 0, max = 100, zmena, jednotka = '%' }) {
  const v = el('span.pr-posuvnik-hodnota', { text: `${hodnota || 0} ${jednotka}` });
  const r = el('input.pr-posuvnik', { type: 'range', min, max, value: hodnota || 0 });
  r.oninput = () => { v.textContent = `${r.value} ${jednotka}`; };
  r.onchange = () => zmena(+r.value);
  return el('span.pr-posuvnik-ram', {}, r, v);
}
const CM = 28.3465;

// ---------------------------------------------------------------- Formát obrazce / obrázku
function podoknoFormat(P, telo, o = {}) {
  let zalozka = o.zalozka || P.st.zalozkaFormatu || 'vypln';
  const kresli = () => {
    const vyb = P.ed.vybrane();
    const x = vyb[0];
    if (!x) { telo.replaceChildren(el('div.ps-pod-prazdno', {}, ik('tvary'), el('b', { text: 'Vyberte obrazec nebo obrázek' }), el('p', { text: 'Tady pak nastavíte výplň, čáru, efekty, velikost a umístění.' }))); return; }
    const obr = x.typ === 'obrazek';
    const zal = el('div.pr-pod-zalozky', {}, [['vypln', 'barvaVyplne', 'Výplň a čára'], ['efekty', 'efektyTvaru', 'Efekty'], ['velikost', 'velikost', 'Velikost a vlastnosti'], ...(obr ? [['obrazek', 'obrazky', 'Obrázek']] : [])].map(([id, i, t]) =>
      el('button' + (zalozka === id ? '.aktivni' : ''), { type: 'button', title: t, onclick: () => { zalozka = id; P.st.zalozkaFormatu = id; kresli(); } }, ik(i))));
    const uprav = (z, popis) => P.upravObjekt(z, popis);
    let obsah;
    if (zalozka === 'vypln') {
      const typV = x.vyplnObrazek ? 'obrazek' : x.prechod ? 'prechod' : !x.vypln || x.vypln === 'none' ? (x.typ === 'tvar' && x.vypln === undefined ? 'plna' : 'zadna') : 'plna';
      const aktVypln = x.vypln === undefined && x.typ === 'tvar' ? 'a1' : x.vypln;
      const aktObrys = x.obrys === undefined && x.typ === 'tvar' ? 'a1-50' : x.obrys;
      obsah = [
        obr ? null : sekce('Výplň', [
          radio('vypln', [['zadna', 'Bez výplně'], ['plna', 'Plná výplň'], ['prechod', 'Přechodová výplň'], ['obrazek', 'Obrázková výplň']], typV, (v) => {
            if (v === 'zadna') uprav({ vypln: 'none', prechod: null, vyplnObrazek: null }, 'Bez výplně');
            if (v === 'plna') uprav({ vypln: aktVypln && aktVypln !== 'none' ? aktVypln : 'a1', prechod: null, vyplnObrazek: null }, 'Plná výplň');
            if (v === 'prechod') uprav({ vypln: aktVypln && aktVypln !== 'none' ? aktVypln : 'a1', prechod: [`${(aktVypln && aktVypln !== 'none' ? aktVypln : 'a1').replace(/[+-]\d+$/, '')}+40`, `${(aktVypln && aktVypln !== 'none' ? aktVypln : 'a1').replace(/[+-]\d+$/, '')}-25`], vyplnObrazek: null }, 'Přechodová výplň');
            if (v === 'obrazek') P.vyplnObrazkem();
          }),
          typV === 'plna' ? radekPole('Barva', tlBarvy(P, aktVypln, (r) => uprav({ vypln: r }, 'Výplň'))) : null,
          typV === 'prechod' ? radekPole('Barva 1', tlBarvy(P, x.prechod[0], (r) => uprav({ prechod: [r, x.prechod[1]] }, 'Přechod'))) : null,
          typV === 'prechod' ? radekPole('Barva 2', tlBarvy(P, x.prechod[1], (r) => uprav({ prechod: [x.prechod[0], r] }, 'Přechod'))) : null,
          typV === 'plna' ? radekPole('Průhlednost', posuvnik(x.vyplnPruhlednost, { zmena: (v) => uprav({ vyplnPruhlednost: v || null }, 'Průhlednost') })) : null,
        ]),
        sekce(obr ? 'Čára' : 'Čára', [
          radio('cara', [['zadna', 'Bez čáry'], ['plna', 'Plná čára']], !aktObrys || aktObrys === 'none' ? 'zadna' : 'plna', (v) => uprav(v === 'zadna' ? { obrys: 'none' } : { obrys: aktObrys && aktObrys !== 'none' ? aktObrys : 'tx' }, 'Čára')),
          aktObrys && aktObrys !== 'none' ? radekPole('Barva', tlBarvy(P, aktObrys, (r) => uprav({ obrys: r }, 'Barva čáry'))) : null,
          aktObrys && aktObrys !== 'none' ? radekPole('Šířka', cislo(x.obrysW ?? (jeCara(x.tvar) ? 1.5 : 1), { min: 0.25, max: 40, krok: 0.25, jednotka: 'b.', zmena: (v) => uprav({ obrysW: v }, 'Šířka čáry') })) : null,
          aktObrys && aktObrys !== 'none' ? radekPole('Typ čárky', el('select.ps-vyber.kratky', { onchange: (e) => uprav({ obrysStyl: e.target.value }, 'Typ čárky') }, [['plna', 'Plná'], ['carky', 'Čárkovaná'], ['tecky', 'Tečkovaná']].map(([v, t]) => el('option', { value: v, text: t, selected: (x.obrysStyl || 'plna') === v })))) : null,
        ]),
      ];
    } else if (zalozka === 'efekty') {
      const e = x.efekty || {};
      obsah = [
        sekce('Stín', [radekPole('Předvolby', el('select.ps-vyber', { onchange: (ev) => uprav({ efekty: { ...e, stin: ev.target.value || null } }, 'Stín') }, [['', 'Bez stínu'], ...Object.entries(NAZVY_STINU)].map(([v, t]) => el('option', { value: v, text: t, selected: (e.stin || '') === v }))))]),
        sekce('Záře', [
          radekPole('Barva', tlBarvy(P, e.zar, (r) => uprav({ efekty: { ...e, zar: r === 'none' ? null : r } }, 'Záře'), { auto: 'Bez záře' })),
          radekPole('Velikost', cislo(e.zarVel || 8, { min: 1, max: 40, jednotka: 'b.', zmena: (v) => uprav({ efekty: { ...e, zarVel: v } }, 'Velikost záře') })),
        ]),
        sekce('Měkké okraje', [radekPole('Velikost', cislo(e.mekke || 0, { min: 0, max: 50, krok: 0.5, jednotka: 'b.', zmena: (v) => uprav({ efekty: { ...e, mekke: v || null } }, 'Měkké okraje') }))]),
        sekce('Průhlednost objektu', [radekPole('Průhlednost', posuvnik(x.pruhlednost, { zmena: (v) => uprav({ pruhlednost: v || null }, 'Průhlednost') }))]),
      ];
    } else if (zalozka === 'velikost') {
      const maText = x.typ === 'text' || (x.typ === 'tvar' && !jeCara(x.tvar));
      const ok = x.okraje || { l: 7.2, r: 7.2, t: 3.6, b: 3.6 };
      obsah = [
        sekce('Velikost', [
          radekPole('Výška', cislo(+(x.h / CM).toFixed(2), { min: 0.01, max: 200, krok: 0.1, jednotka: 'cm', zmena: (v) => P.velikostObjektu('h', v * CM) })),
          radekPole('Šířka', cislo(+(x.w / CM).toFixed(2), { min: 0.01, max: 200, krok: 0.1, jednotka: 'cm', zmena: (v) => P.velikostObjektu('w', v * CM) })),
          radekPole('Otočení', cislo(x.rot || 0, { min: -360, max: 360, jednotka: '°', zmena: (v) => uprav({ rot: ((v % 360) + 360) % 360 }, 'Otočení') })),
          el('label.ps-zaskrt', {}, el('input', { type: 'checkbox', checked: !!x.zamekPomeru || x.typ === 'obrazek', onchange: (e) => uprav({ zamekPomeru: e.target.checked }, 'Zamknout poměr stran') }), el('span', { text: 'Zamknout poměr stran' })),
        ]),
        sekce('Umístění', [
          radekPole('Vodorovná poloha', cislo(+(x.x / CM).toFixed(2), { min: -200, max: 200, krok: 0.1, jednotka: 'cm', zmena: (v) => uprav({ x: v * CM }, 'Umístění') })),
          radekPole('Svislá poloha', cislo(+(x.y / CM).toFixed(2), { min: -200, max: 200, krok: 0.1, jednotka: 'cm', zmena: (v) => uprav({ y: v * CM }, 'Umístění') })),
        ]),
        maText ? sekce('Textové pole', [
          radekPole('Svislé zarovnání', el('select.ps-vyber.kratky', { onchange: (e) => uprav({ svisle: e.target.value }, 'Svislé zarovnání') }, [['t', 'Nahoře'], ['m', 'Uprostřed'], ['b', 'Dole']].map(([v, t]) => el('option', { value: v, text: t, selected: P.stav.svisle === v })))),
          radekPole('Směr textu', el('select.ps-vyber.kratky', { onchange: (e) => uprav({ svislyText: e.target.value === '1' }, 'Směr textu') }, [['0', 'Vodorovně'], ['1', 'Svisle']].map(([v, t]) => el('option', { value: v, text: t, selected: (x.svislyText ? '1' : '0') === v })))),
          radio('autofit', [['ne', 'Bez automatického přizpůsobení'], ['zmensit', 'Zmenšit text při přetečení'], ['rust', 'Změnit velikost obrazce podle textu']], x.rust ? 'rust' : x.autofit || (x.ph ? 'zmensit' : 'ne'), (v) => uprav(v === 'rust' ? { rust: true, autofit: 'ne' } : { rust: false, autofit: v }, 'Automatické přizpůsobení')),
          radekPole('Levý okraj', cislo(+(ok.l / CM).toFixed(2), { krok: 0.05, jednotka: 'cm', zmena: (v) => uprav({ okraje: { ...ok, l: v * CM } }, 'Okraje') })),
          radekPole('Pravý okraj', cislo(+(ok.r / CM).toFixed(2), { krok: 0.05, jednotka: 'cm', zmena: (v) => uprav({ okraje: { ...ok, r: v * CM } }, 'Okraje') })),
          radekPole('Horní okraj', cislo(+(ok.t / CM).toFixed(2), { krok: 0.05, jednotka: 'cm', zmena: (v) => uprav({ okraje: { ...ok, t: v * CM } }, 'Okraje') })),
          radekPole('Dolní okraj', cislo(+(ok.b / CM).toFixed(2), { krok: 0.05, jednotka: 'cm', zmena: (v) => uprav({ okraje: { ...ok, b: v * CM } }, 'Okraje') })),
        ]) : null,
        sekce('Alternativní text', [el('textarea.ps-vstup', { rows: 3, placeholder: 'Popište tento objekt pro lidi, kteří ho nevidí', onchange: (e) => uprav({ alt: e.target.value }, 'Alternativní text') }, x.alt || '')], !!x.alt || x.typ === 'obrazek'),
      ];
    } else {
      const f = x.upravy || {};
      obsah = [
        sekce('Opravy obrázku', [
          radekPole('Jas', cislo(f.jas || 0, { min: -100, max: 100, jednotka: '%', zmena: (v) => P.upravObrazek({ jas: v }) })),
          radekPole('Kontrast', cislo(f.kontrast || 0, { min: -100, max: 100, jednotka: '%', zmena: (v) => P.upravObrazek({ kontrast: v }) })),
        ]),
        sekce('Barva obrázku', [radekPole('Sytost', cislo(f.sytost ?? 100, { min: 0, max: 400, jednotka: '%', zmena: (v) => P.upravObrazek({ sytost: v }) }))]),
        sekce('Průhlednost obrázku', [radekPole('Průhlednost', posuvnik(x.pruhlednost, { zmena: (v) => P.upravObjekt({ pruhlednost: v || null }, 'Průhlednost') }))]),
        sekce('Oříznutí', [el('button.ps-tlac', { type: 'button', text: 'Oříznout…', onclick: () => P.dialogOrez() })]),
      ];
    }
    telo.replaceChildren(zal, el('div.pr-pod-obsah', {}, obsah));
  };
  kresli();
  P.podoknoPoVyberu = kresli;
  return () => { P.podoknoPoVyberu = null; };
}

// ---------------------------------------------------------------- Formát pozadí
function podoknoPozadi(P, telo) {
  const kresli = () => {
    const s = P.snimek();
    if (!s) return;
    const p = s.pozadi || {};
    const typ = p.typ || 'plna';
    const nastav = (z, popis = 'Formát pozadí') => P.nastavPozadi({ ...(s.pozadi || {}), ...z }, false, popis);
    telo.replaceChildren(
      el('div.pr-pod-zalozky', {}, el('button.aktivni', { type: 'button', title: 'Výplň' }, ik('barvaVyplne'))),
      el('div.pr-pod-obsah', {},
        sekce('Výplň', [
          radio('pozadi', [['plna', 'Plná výplň'], ['prechod', 'Přechodová výplň'], ['obrazek', 'Výplň obrázkem nebo texturou']], typ === 'barva' ? 'plna' : typ, (v) => {
            if (v === 'plna') nastav({ typ: 'barva', b: p.b || 'bg' });
            if (v === 'prechod') nastav({ typ: 'prechod', b1: p.b1 || 'bg', b2: p.b2 || 'a1+60', uhel: p.uhel ?? 90 });
            if (v === 'obrazek') P.pozadiObrazkem();
          }),
          el('label.ps-zaskrt', {}, el('input', { type: 'checkbox', checked: !!p.skrytGrafiku, onchange: (e) => nastav({ skrytGrafiku: e.target.checked }) }), el('span', { text: 'Skrýt grafiku pozadí' })),
          typ === 'barva' || typ === 'plna' ? radekPole('Barva', tlBarvy(P, p.b || 'bg', (r) => nastav({ typ: 'barva', b: r }))) : null,
          typ === 'prechod' ? [
            radekPole('Barva 1', tlBarvy(P, p.b1, (r) => nastav({ b1: r }))),
            radekPole('Barva 2', tlBarvy(P, p.b2, (r) => nastav({ b2: r }))),
            radekPole('Typ', el('select.ps-vyber.kratky', { onchange: (e) => nastav({ radialni: e.target.value === 'r' }) }, [['l', 'Lineární'], ['r', 'Paprskový']].map(([v, t]) => el('option', { value: v, text: t, selected: (p.radialni ? 'r' : 'l') === v })))),
            radekPole('Úhel', cislo(p.uhel ?? 90, { min: 0, max: 359, jednotka: '°', zmena: (v) => nastav({ uhel: v }) })),
          ] : null,
          typ === 'obrazek' ? [
            el('div.pr-pod-tlacitka', {}, el('button.ps-tlac', { type: 'button', text: 'Vložit…', onclick: () => P.pozadiObrazkem() })),
            el('label.ps-zaskrt', {}, el('input', { type: 'checkbox', checked: !!p.dlazdice, onchange: (e) => nastav({ dlazdice: e.target.checked }) }), el('span', { text: 'Uspořádat obrázek jako textury' })),
          ] : null,
          typ !== 'obrazek' || true ? radekPole('Průhlednost', posuvnik(p.pruhlednost, { zmena: (v) => nastav({ pruhlednost: v || null }) })) : null,
          radekPole('Barva textu', tlBarvy(P, p.barvaTextu || 'tx', (r) => nastav({ barvaTextu: r === 'none' || r === 'auto' ? null : r }))),
        ]),
        el('div.pr-pod-dole', {},
          el('button.ps-tlac', { type: 'button', text: 'Použít u všech', onclick: () => P.nastavPozadi(P.snimek().pozadi, true) }),
          el('button.ps-tlac', { type: 'button', text: 'Obnovit pozadí', onclick: () => P.nastavPozadi(null, false, 'Obnovit pozadí') }))));
  };
  kresli();
  P.podoknoPoVyberu = kresli;
  return () => { P.podoknoPoVyberu = null; };
}

// ---------------------------------------------------------------- Podokno animací
function podoknoAnimace(P, telo) {
  const kresli = () => {
    const s = P.snimek();
    if (!s) return;
    const vybrane = new Set(P.animaceVyberu().map((a) => a.id));
    const seznam = el('div.pr-anim-seznam');
    let krok = 0;
    (s.animace || []).forEach((a, i) => {
      if (!a.start || a.start === 'klik') krok++;
      const o = s.objekty.find((x) => x.id === a.obj);
      const text = o ? `${nazevObjektu(o, s)}${o.html ? ': ' + textZHtml(o.html).slice(0, 30) : ''}` : '(objekt chybí)';
      const trv = a.trvani ?? VYCHOZI_TRVANI[a.efekt] ?? 0.5;
      const polozka = el('div.pr-anim-pol' + (vybrane.has(a.id) ? '.vybrano' : ''), { tabindex: '0', title: `${ANIMACE[a.druh]?.nazev}: ${nazevAnimace(a)}` },
        el('span.pr-anim-cislo', { text: !a.start || a.start === 'klik' ? String(krok) : '' }),
        el('span.pr-anim-start', { html: !a.start || a.start === 'klik' ? '<svg viewBox="0 0 12 16"><rect x="1" y="1" width="10" height="14" rx="5" fill="none" stroke="currentColor"/><path d="M6 1v5" stroke="currentColor"/></svg>' : a.start === 'po' ? '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor"/><path d="M8 4v4h3" fill="none" stroke="currentColor"/></svg>' : '' }),
        ikonaAnimace(a.druh, a.efekt),
        el('span.pr-anim-text', { text }),
        el('span.pr-anim-cas', {}, el('i', { style: { marginLeft: Math.min(60, (a.zpozdeni || 0) * 12) + 'px', width: Math.max(4, Math.min(80, trv * 16)) + 'px', background: ANIMACE[a.druh]?.barva } })),
        el('button.pr-anim-menu', { type: 'button', title: 'Možnosti', text: '⌄' }));
      polozka.onclick = (e) => {
        if (e.target.closest('.pr-anim-menu')) { nabidkaAnimace(P, a, e.target.closest('.pr-anim-menu')); return; }
        P.vyberAnimaci(a.id, e.ctrlKey || e.shiftKey);
      };
      polozka.ondblclick = () => P.dialogAnimace(a.id);
      polozka.oncontextmenu = (e) => { e.preventDefault(); P.vyberAnimaci(a.id); nabidkaAnimace(P, a, polozka); };
      polozka.draggable = true;
      polozka.ondragstart = (e) => { e.dataTransfer.setData('text/x-pr-anim', a.id); };
      polozka.ondragover = (e) => { e.preventDefault(); polozka.classList.add('cil'); };
      polozka.ondragleave = () => polozka.classList.remove('cil');
      polozka.ondrop = (e) => { e.preventDefault(); polozka.classList.remove('cil'); const id = e.dataTransfer.getData('text/x-pr-anim'); if (id && id !== a.id) P.presunAnimaciNa(id, i); };
      seznam.append(polozka);
    });
    const prazdne = !(s.animace || []).length;
    telo.replaceChildren(
      el('div.pr-anim-hlava', {},
        el('button.ps-tlac.maly', { type: 'button', onclick: () => P.nahledAnimaci(!vybrane.size) }, el('span', { text: '▶' }), el('span', { text: vybrane.size ? 'Přehrát od' : 'Přehrát vše' })),
        el('div.ps-karty-mezera'),
        el('button.pr-anim-sipka', { type: 'button', title: 'Přesunout dříve', text: '▲', onclick: () => P.presunAnimaci(-1) }),
        el('button.pr-anim-sipka', { type: 'button', title: 'Přesunout později', text: '▼', onclick: () => P.presunAnimaci(1) })),
      prazdne ? el('div.ps-pod-prazdno', {}, ik('podoknoAnimaci'), el('b', { text: 'Na tomto snímku nejsou žádné animace' }), el('p', { text: 'Vyberte objekt na snímku a na kartě Animace zvolte efekt.' })) : seznam,
      el('div.pr-anim-osa', {}, el('span', { text: 'Sekundy ▾' }), el('span', { text: '0' }), el('span', { text: '2' }), el('span', { text: '4' })));
  };
  kresli();
  P.podoknoPoVyberu = kresli;
  return () => { P.podoknoPoVyberu = null; };
}
function nabidkaAnimace(P, a, kotva) {
  rozbal(kotva, nabidka([
    { text: 'Začátek po kliknutí', zaskrtnuto: !a.start || a.start === 'klik', akce: () => P.upravAnimace({ start: 'klik' }, [a.id]) },
    { text: 'Začátek s předchozím', zaskrtnuto: a.start === 'spolu', akce: () => P.upravAnimace({ start: 'spolu' }, [a.id]) },
    { text: 'Začátek po předchozím', zaskrtnuto: a.start === 'po', akce: () => P.upravAnimace({ start: 'po' }, [a.id]) },
    'sep',
    { text: 'Možnosti efektu…', akce: () => P.dialogAnimace(a.id) },
    { text: 'Časování…', akce: () => P.dialogAnimace(a.id, 'casovani') },
    'sep',
    { text: 'Odebrat', ikona: 'odstranit', akce: () => P.odebratAnimace([a.id]) },
  ], { sirka: 230 }), { app: 'prezentace' });
}

// ---------------------------------------------------------------- Výběr
function podoknoVyber(P, telo) {
  const kresli = () => {
    const s = P.snimek();
    if (!s) return;
    const vyb = new Set(P.ed.vyber);
    const polozky = [...s.objekty].reverse().map((o) => {
      const oko = el('button.pr-vyb-oko', { type: 'button', title: o.skryty ? 'Zobrazit' : 'Skrýt', html: o.skryty ? '<svg viewBox="0 0 20 20"><path d="M3 10s3-5 7-5 7 5 7 5M4 16 16 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' : '<svg viewBox="0 0 20 20"><path d="M2.5 10s3-5.5 7.5-5.5 7.5 5.5 7.5 5.5-3 5.5-7.5 5.5S2.5 10 2.5 10z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' });
      oko.onclick = (e) => { e.stopPropagation(); P.upravObjekt({ skryty: !o.skryty }, o.skryty ? 'Zobrazit' : 'Skrýt', [o.id]); };
      const nazev = el('span.pr-vyb-nazev', { text: nazevObjektu(o, s) });
      const r = el('div.pr-vyb-pol' + (vyb.has(o.id) ? '.vybrano' : '') + (o.skryty ? '.skryty' : ''), {}, nazev, oko);
      r.onclick = (e) => { if (!o.skryty) P.ed.vyberObjekty([o.id], { pridat: e.ctrlKey || e.shiftKey }); };
      r.ondblclick = () => {
        const v = el('input.ps-vstup', { value: nazevObjektu(o, s) });
        nazev.replaceWith(v); v.focus(); v.select();
        v.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') v.blur(); if (e.key === 'Escape') { v.value = nazevObjektu(o, s); v.blur(); } };
        v.onblur = () => P.upravObjekt({ nazev: v.value.trim() || null }, 'Přejmenovat', [o.id]);
      };
      return r;
    });
    telo.replaceChildren(
      el('div.pr-anim-hlava', {},
        el('button.ps-tlac.maly', { type: 'button', text: 'Zobrazit vše', onclick: () => P.prikaz('Zobrazit vše', () => { for (const o of s.objekty) o.skryty = false; }) }),
        el('button.ps-tlac.maly', { type: 'button', text: 'Skrýt vše', onclick: () => P.prikaz('Skrýt vše', () => { for (const o of s.objekty) o.skryty = true; P.ed.vyber = []; }) }),
        el('div.ps-karty-mezera'),
        el('button.pr-anim-sipka', { type: 'button', title: 'Přenést blíž', text: '▲', onclick: () => P.usporadat('dopredu') }),
        el('button.pr-anim-sipka', { type: 'button', title: 'Přenést dál', text: '▼', onclick: () => P.usporadat('dozadu') })),
      polozky.length ? el('div.pr-vyb-seznam', {}, polozky) : el('div.ps-pod-prazdno', {}, el('p', { text: 'Na snímku nejsou žádné objekty.' })));
  };
  kresli();
  P.podoknoPoVyberu = kresli;
  return () => { P.podoknoPoVyberu = null; };
}

// ---------------------------------------------------------------- Komentáře
function podoknoKomentare(P, telo, o = {}) {
  const kresli = (novy = o.novy) => {
    o.novy = false;
    const s = P.snimek();
    if (!s) return;
    const karty = (s.komentare || []).map((k) => {
      const odpoved = el('input.ps-vstup', { placeholder: 'Odpovědět' });
      odpoved.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && odpoved.value.trim()) P.prikaz('Odpověď', () => { k.odpovedi = [...(k.odpovedi || []), { autor: P.autor(), text: odpoved.value.trim(), cas: Date.now() }]; }); };
      return el('div.ps-kom-karta' + (k.vyreseno ? '.vyreseno' : ''), {},
        el('div.ps-kom-hlava', {}, el('span.ps-avatar.maly', { text: k.autor.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase() }), el('b', { text: k.autor }), el('small', { text: pred(k.cas) }),
          el('div.ps-karty-mezera'),
          el('button.pr-anim-menu', { type: 'button', text: '···', onclick: (e) => rozbal(e.currentTarget, nabidka([
            { text: k.vyreseno ? 'Znovu otevřít vlákno' : 'Vyřešit vlákno', akce: () => P.prikaz('Vyřešit', () => { k.vyreseno = !k.vyreseno; }) },
            { text: 'Odstranit vlákno', ikona: 'odstranit', akce: () => P.prikaz('Odstranit komentář', () => { s.komentare = s.komentare.filter((x) => x !== k); }) },
          ], { sirka: 200 }), { app: 'prezentace' }) })),
        k.obj ? el('div.pr-kom-obj', { text: '↳ ' + (s.objekty.find((x) => x.id === k.obj) ? nazevObjektu(s.objekty.find((x) => x.id === k.obj), s) : 'objekt') }) : null,
        el('p', { text: k.text }),
        (k.odpovedi || []).map((r) => el('div.pr-kom-odpoved', {}, el('b', { text: r.autor }), el('span', { text: ' ' + r.text }))),
        k.vyreseno ? el('small.pr-kom-vyreseno', { text: '✓ Vyřešeno' }) : odpoved);
    });
    const vstup = el('textarea.ps-vstup', { rows: 3, placeholder: 'Zadejte komentář. Pomocí @ zmíníte někoho.' });
    vstup.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) odeslat(); };
    const odeslat = () => {
      const t = vstup.value.trim();
      if (!t) return;
      const obj = P.ed.vyber[0] || null;
      P.prikaz('Nový komentář', () => { s.komentare = [...(s.komentare || []), { id: noveId('k'), autor: P.autor(), text: t, cas: Date.now(), obj, odpovedi: [] }]; });
    };
    telo.replaceChildren(
      el('div.pr-anim-hlava', {}, el('button.ps-tlac.maly', { type: 'button', onclick: () => kresli(true) }, ik('komentarNovy'), el('span', { text: 'Nový' })), el('div.ps-karty-mezera'), el('small', { text: `Snímek ${P.pres.index(s.id) + 1}` })),
      el('div.ps-kom-seznam', {},
        novy ? el('div.ps-kom-karta.novy', {}, el('div.ps-kom-hlava', {}, el('span.ps-avatar.maly', { text: P.inicialy() }), el('b', { text: P.autor() })), vstup, el('div.pr-pod-tlacitka', {}, el('button.ps-tlac.primarni.maly', { type: 'button', text: 'Odeslat', onclick: odeslat }), el('button.ps-tlac.maly', { type: 'button', text: 'Zrušit', onclick: () => kresli(false) }))) : null,
        karty.length || novy ? karty : el('div.ps-pod-prazdno', {}, ik('komentar'), el('b', { text: 'Žádné komentáře' }), el('p', { text: 'Komentářem se můžete zeptat nebo navrhnout úpravu. Klikněte na Nový.' }))));
    if (novy) setTimeout(() => vstup.focus(), 30);
  };
  kresli();
  P.podoknoPoVyberu = () => kresli(false);
  return () => { P.podoknoPoVyberu = null; };
}

// ---------------------------------------------------------------- Designer
/** Navrhne rozvržení aktuálního snímku (5–6 variant) ze stejného obsahu. */
export function navrhyDesigneru(P) {
  const s = P.snimek();
  if (!s) return [];
  const nadpis = s.objekty.find((o) => o.ph === 'nadpis');
  const telo = s.objekty.filter((o) => /^(obsah|text|podtitul)/.test(o.ph || '') && !jePrazdnyText(o.html));
  const radky = telo.flatMap((o) => textZHtml(o.html).split('\n').filter(Boolean));
  const obrazky = s.objekty.filter((o) => o.typ === 'obrazek');
  const ostatni = s.objekty.filter((o) => !o.ph && o.typ !== 'obrazek');
  const W = P.pres.velikost.w, H = P.pres.velikost.h;
  const nadpisHtml = nadpis?.html || odstavce(['Nadpis']);
  const zaklad = (o) => ({ ...kopie(nadpis || { id: noveId(), typ: 'text', ph: 'nadpis' }), html: nadpisHtml, ...o });
  const navrhy = [];
  // 1) pruh vlevo s nadpisem
  navrhy.push({
    nazev: 'Pruh vlevo', objekty: [
      tvar('obdelnik', 0, 0, W * 0.36, H, { vypln: 'a1', obrys: 'none', designer: true }),
      zaklad({ x: 30, y: 60, w: W * 0.36 - 60, h: H - 120, rot: 0, barva: 'lt', svisle: 'm', vel: 40 }),
      ...(radky.length ? [textovePole(W * 0.36 + 40, 70, W * 0.64 - 90, H - 140, radky, { vel: 22, odrazky: '•', mezeraPred: 12, svisle: 'm', rust: false })] : []),
      ...obrazky.map((o, i) => ({ ...kopie(o), x: W * 0.36 + 40 + i * 30, y: H - 200 + i * 20, w: 220, h: (220 * o.h) / o.w })),
      ...ostatni.map(kopie),
    ],
  });
  // 2) karty (SmartArt blokový seznam)
  if (radky.length >= 2 && radky.length <= 6) navrhy.push({ nazev: 'Karty', objekty: [zaklad({ x: 66, y: 28, w: 828, h: 100, rot: 0 }), ...smartArt('seznam', radky, { x: 66, y: 160, w: 828, h: 320 })] });
  // 3) proces
  if (radky.length >= 2 && radky.length <= 5) navrhy.push({ nazev: 'Proces', objekty: [zaklad({ x: 66, y: 28, w: 828, h: 100, rot: 0 }), ...smartArt('proces', radky, { x: 66, y: 170, w: 828, h: 280 })] });
  // 4) velký nadpis s čarou a dvěma sloupci
  navrhy.push({
    nazev: 'Nadpis s linkou', objekty: [
      zaklad({ x: 66, y: 40, w: 828, h: 110, rot: 0, zar: 'l', svisle: 'b', vel: 48 }),
      tvar('obdelnik', 72, 160, 120, 6, { vypln: 'a2', obrys: 'none', designer: true }),
      ...(radky.length ? [textovePole(66, 190, 828, 300, radky, { vel: 22, odrazky: '•', sloupce: radky.length > 3 ? 2 : 1, mezeraPred: 10, rust: false })] : []),
      ...ostatni.map(kopie),
    ],
  });
  // 5) časová osa (když obsah vypadá jako kroky)
  if (radky.length >= 3 && radky.length <= 6) navrhy.push({ nazev: 'Časová osa', objekty: [zaklad({ x: 66, y: 28, w: 828, h: 100, rot: 0 }), ...smartArt('casovaOsa', radky, { x: 66, y: 150, w: 828, h: 330 })] });
  // 6) obrázek přes polovinu
  if (obrazky.length) {
    const o = obrazky[0];
    navrhy.push({ nazev: 'Obrázek vpravo', objekty: [{ ...kopie(o), x: W / 2, y: 0, w: W / 2, h: H, orez: orezNa(o, W / 2, H) }, zaklad({ x: 50, y: 60, w: W / 2 - 100, h: 150, rot: 0, vel: 40, svisle: 'b' }), ...(radky.length ? [textovePole(50, 230, W / 2 - 100, 260, radky, { vel: 20, odrazky: '•', rust: false })] : [])] });
  } else {
    // 7) tmavý pás přes celý snímek
    navrhy.push({ nazev: 'Pás', objekty: [tvar('obdelnik', 0, H * 0.3, W, H * 0.4, { vypln: 'tx2', obrys: 'none', designer: true }), zaklad({ x: 66, y: H * 0.3 + 10, w: 828, h: H * 0.4 - 20, rot: 0, barva: 'lt', zar: 'c', svisle: 'm', vel: 44 }), ...(radky.length ? [textovePole(66, H * 0.72, 828, H * 0.24, [radky.join(' · ')], { vel: 18, zar: 'c', rust: false })] : [])] });
  }
  return navrhy;
}
function orezNa(o, w, h) {
  const pomerObr = o.w / o.h, pomer = w / h;
  if (pomerObr > pomer) { const k = (1 - pomer / pomerObr) / 2; return { l: k, r: k, t: 0, b: 0 }; }
  const k = (1 - pomerObr / pomer) / 2; return { l: 0, r: 0, t: k, b: k };
}
function podoknoDesigner(P, telo) {
  const kresli = () => {
    const s = P.snimek();
    if (!s) return;
    const navrhy = navrhyDesigneru(P);
    const polozky = navrhy.map((n) => {
      const kopieSnimku = { ...kopie(s), objekty: n.objekty.map((o) => ({ ...o })), animace: [] };
      const m = miniatura(P.pres, kopieSnimku, 250);
      return el('button.pr-designer-pol', { type: 'button', title: n.nazev, onclick: () => P.pouzijNavrh(n) }, m);
    });
    telo.replaceChildren(
      el('p.pr-designer-uvod', { text: 'Návrhy vycházejí z obsahu tohoto snímku. Kliknutím návrh použijete, Ctrl+Z ho vrátí.' }),
      el('div.pr-designer-seznam', {}, polozky),
      el('div.pr-pod-dole', {}, el('small', { text: 'Návrhy pro vás vytvořil Designer' })));
  };
  kresli();
  P.podoknoPoVyberu = null;
  P.podoknoPoZmeneSnimku = kresli;
  return () => { P.podoknoPoZmeneSnimku = null; };
}

// ---------------------------------------------------------------- AstroAI
/** Rozebere osnovu „# Nadpis / - odrážka“ na snímky. */
export function rozeberOsnovu(text) {
  const snimky = [];
  let akt = null;
  for (const r of text.split('\n')) {
    const t = r.trim();
    if (!t) continue;
    const nadpis = /^(#{1,3}\s*|\d+[.)]\s+|Snímek\s*\d+\s*[:.-]\s*)(.+)/i.exec(t);
    const odr = /^([-*•–]\s+|\s{2,}[-*•]\s+)(.+)/.exec(r);
    if (nadpis && !odr) { akt = { nadpis: nadpis[2].replace(/\*\*/g, '').trim(), body: [] }; snimky.push(akt); continue; }
    if (!akt) { akt = { nadpis: t.replace(/\*\*/g, ''), body: [] }; snimky.push(akt); continue; }
    akt.body.push([t.replace(/^[-*•–]\s+/, '').replace(/\*\*/g, ''), /^\s{2,}/.test(r) ? 1 : 0]);
  }
  return snimky;
}
function mistniOsnova(tema) {
  const t = tema.trim().replace(/[.?!]$/, '');
  const T = t.charAt(0).toUpperCase() + t.slice(1);
  return `# ${T}\n- Prezentace na téma ${t}\n# Úvod\n- Co je ${t}\n- Proč je téma důležité\n# Historie a souvislosti\n- Jak to začalo\n- Důležité milníky\n# Hlavní body\n- První klíčová myšlenka\n- Druhá klíčová myšlenka\n- Třetí klíčová myšlenka\n# Zajímavosti\n- Věc, kterou málokdo ví\n- Příklad z praxe\n# Shrnutí\n- Co si zapamatovat\n- Děkuji za pozornost`;
}
function podoknoAI(P, telo) {
  let rizeni = null;
  const log = el('div.pr-ai-log');
  const vstup = el('textarea.ps-vstup', { rows: 3, placeholder: 'Např. „Prezentace o sopkách pro 7. třídu“' });
  vstup.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); vytvor(); } };
  const zprava = (t, cls = '') => { const z = el('div.pr-ai-zprava' + (cls ? '.' + cls : ''), { text: t }); log.append(z); log.scrollTop = log.scrollHeight; return z; };
  async function zeptej(prompt, onHotovo, popis) {
    rizeni?.abort();
    rizeni = new AbortController();
    const z = zprava('Přemýšlím…', 'ai');
    let text = '';
    try {
      const r = await send([{ role: 'user', content: prompt }], { zdroj: 'office', signal: rizeni.signal, onToken: (k) => { text += k; z.textContent = text; log.scrollTop = log.scrollHeight; } });
      text = r.text || text;
      if (r.rezim === 'mistni') { z.textContent = `${popis} (AstroAI běží v místním režimu — použil jsem vestavěnou osnovu).`; onHotovo(null); return; }
      z.textContent = text;
      onHotovo(text);
    } catch (e) {
      if (e.name === 'AbortError') return;
      z.textContent = 'Lokální model teď neodpovídá — použil jsem vestavěnou osnovu.';
      onHotovo(null);
    }
  }
  function vytvor() {
    const tema = vstup.value.trim();
    if (!tema) { vstup.focus(); return; }
    zprava(tema, 'ja');
    vstup.value = '';
    zeptej(`Napiš osnovu prezentace na téma: ${tema}. Piš ve stejném jazyce, v jakém je zadané téma. Použij 6 snímků. Každý snímek začni řádkem "# Nadpis" a pod něj napiš 2 až 4 krátké odrážky začínající "- ". Nic dalšího nepiš.`,
      (text) => {
        const osnova = rozeberOsnovu(text || mistniOsnova(tema));
        if (!osnova.length) { zprava('Z odpovědi se nepodařilo sestavit snímky.', 'ai'); return; }
        P.snimkyZOsnovyDat(osnova);
        zprava(`Hotovo — přidal jsem ${osnova.length} snímků. Zkuste ještě Designer na kartě Domů.`, 'ai ok');
      }, 'Vytvořil jsem osnovu');
  }
  const akce = [
    ['Napsat poznámky řečníka', () => {
      const s = P.snimek();
      const obsah = s.objekty.map((o) => textZHtml(o.html)).filter(Boolean).join('\n');
      zeptej(`Napiš krátké poznámky řečníka (3–4 věty, ve stejném jazyce jako snímek) k tomuto snímku prezentace:\n${obsah}`, (t) => {
        const text = t || `Na tomto snímku představím: ${obsah.split('\n').slice(0, 3).join(', ')}. Zdůrazním hlavní myšlenku a zeptám se publika na jejich zkušenost.`;
        P.prikaz('Poznámky od AstroAI', () => { s.poznamky = (s.poznamky ? s.poznamky + '\n' : '') + text.trim(); });
        if (!P.st.poznamky) P.prepniPoznamky();
      }, 'Napsal jsem poznámky');
    }],
    ['Vylepšit text snímku', () => {
      const s = P.snimek();
      const telo = s.objekty.find((o) => /^obsah/.test(o.ph || '') && !jePrazdnyText(o.html));
      if (!telo) { zprava('Na snímku není text k vylepšení.', 'ai'); return; }
      zeptej(`Přepiš tyto odrážky prezentace stručněji a úderněji a zachovej jejich jazyk. Každou odrážku na nový řádek začínající "- ":\n${textZHtml(telo.html)}`, (t) => {
        if (!t) return;
        const r = t.split('\n').map((x) => x.trim()).filter((x) => /^[-*•]/.test(x)).map((x) => x.replace(/^[-*•]\s*/, ''));
        if (r.length) P.prikaz('Vylepšit text', () => { telo.html = odstavce(r); });
      }, 'Text zůstal beze změny');
    }],
    ['Navrhnout nadpis', () => {
      const s = P.snimek();
      const obsah = s.objekty.filter((o) => o.ph !== 'nadpis').map((o) => textZHtml(o.html)).filter(Boolean).join('\n');
      zeptej(`Navrhni krátký výstižný nadpis snímku (max 6 slov, ve stejném jazyce jako obsah, jen samotný nadpis) pro tento obsah:\n${obsah}`, (t) => {
        const n = s.objekty.find((o) => o.ph === 'nadpis');
        const text = (t || obsah.split('\n')[0] || 'Nový snímek').replace(/^["„“]|["“”]$/g, '').split('\n')[0].trim();
        if (n) P.prikaz('Nadpis od AstroAI', () => { n.html = odstavce([text]); });
      }, 'Navrhl jsem nadpis');
    }],
  ];
  telo.replaceChildren(
    el('div.ps-ai-uvod', {}, ik('astroai'), el('b', { text: 'Vytvořte prezentaci s AstroAI' }), el('p', { text: 'Napište téma a AstroAI připraví snímky s nadpisy a odrážkami. Pak můžete zapnout Designer.' })),
    el('div.pr-ai-pole', {}, vstup, el('button.ps-tlac.primarni', { type: 'button', text: 'Vytvořit', onclick: vytvor })),
    el('div.ps-ai-akce', {}, akce.map(([t, fn]) => el('button.ps-ai-chip', { type: 'button', text: t, onclick: fn }))),
    log,
    el('small.pr-ai-pozn', { text: 'Obsah vytvořený AI může být nepřesný. Model běží lokálně na tvém počítači.' }));
  aktivniRezim().then((r) => { if (r.rezim === 'mistni') zprava('Lokální model neběží — AstroAI použije vestavěné osnovy.', 'ai info'); }).catch(() => {});
  setTimeout(() => vstup.focus(), 40);
  return () => rizeni?.abort();
}

// ---------------------------------------------------------------- Přístupnost, Schránka, Nápověda
export function kontrolaPristupnosti(P) {
  const problemy = [];
  P.pres.snimky.forEach((s, i) => {
    const n = s.objekty.find((o) => o.ph === 'nadpis');
    if (!n || jePrazdnyText(n.html)) problemy.push({ druh: 'chyba', text: 'Chybí název snímku', kde: `Snímek ${i + 1}`, s, akce: 'Přidat název' });
    for (const o of s.objekty) if ((o.typ === 'obrazek' || o.typ === 'graf' || o.typ === 'ikona') && !o.alt) problemy.push({ druh: 'chyba', text: 'Chybí alternativní text', kde: `${nazevObjektu(o, s)} (snímek ${i + 1})`, s, o, akce: 'Přidat popis' });
  });
  const tituly = P.pres.snimky.map((s) => textZHtml(s.objekty.find((o) => o.ph === 'nadpis')?.html || '')).filter(Boolean);
  const dvojice = tituly.filter((t, i) => tituly.indexOf(t) !== i);
  for (const t of new Set(dvojice)) problemy.push({ druh: 'varovani', text: 'Duplicitní název snímku', kde: `„${t}“` });
  return problemy;
}
function podoknoPristupnost(P, telo) {
  const kresli = () => {
    const pr = kontrolaPristupnosti(P);
    telo.replaceChildren(pr.length
      ? el('div.pr-pristupnost', {}, el('div.pr-pr-nadpis', { text: `Chyby a varování (${pr.length})` }), pr.map((p) => el('button.pr-pr-pol', { type: 'button', onclick: () => { if (p.s) P.jdiNaSnimek(p.s.id); if (p.o) { P.ed.vyberObjekty([p.o.id]); P.dialogAlt(); } } },
        el('span.pr-pr-ik', { text: p.druh === 'chyba' ? '⨂' : '⚠' }), el('span', {}, el('b', { text: p.text }), el('small', { text: p.kde })))),
        el('p.ps-nav-pozn', { text: 'Proč to opravit: čtečky obrazovky podle názvů snímků procházejí prezentaci a alternativní text přečtou místo obrázku.' }))
      : el('div.ps-pod-prazdno', {}, ik('pristupnost'), el('b', { text: 'Nenašli jsme žádné problémy s přístupností.' }), el('p', { text: 'Lidé se zdravotním postižením by neměli mít potíže s tím, aby si tuto prezentaci přečetli.' })));
  };
  kresli();
  P.podoknoPoZmeneSnimku = kresli;
  return () => { P.podoknoPoZmeneSnimku = null; };
}
function podoknoSchranka(P, telo) {
  const s = P.schranka;
  telo.replaceChildren(s ? el('div.pr-schranka', {}, el('p', { text: s.typ === 'snimky' ? `Snímky: ${s.data.length}` : `Objekty: ${s.data.length}` }), el('button.ps-tlac', { type: 'button', text: 'Vložit', onclick: () => P.vlozit() }), el('button.ps-tlac', { type: 'button', text: 'Vymazat vše', onclick: () => { P.schranka = null; P.podokno('schranka'); } }))
    : el('div.ps-pod-prazdno', {}, ik('vlozit'), el('b', { text: 'Schránka je prázdná.' }), el('p', { text: 'Zkopírujte nebo vyjměte snímky či objekty.' })));
}
const NAPOVEDA = [
  ['Začínáme', 'Nový snímek přidáte na kartě Domů (Ctrl+M). Do zástupného symbolu stačí kliknout a psát. Vzhled všech snímků změníte na kartě Návrh.'],
  ['Obrazce a vodítka', 'Obrazec nakreslíte tažením po výběru na kartě Vložení › Obrazce. Shift drží poměr stran, Ctrl při tažení vytvoří kopii, Alt vypne přichytávání k vodítkům.'],
  ['Přechody', 'Přechod se přehraje při vstupu na snímek. Přeměna plynule přesune stejné objekty mezi dvěma snímky — snímek zduplikujte (Ctrl+D) a objekty posuňte.'],
  ['Animace', 'Vyberte objekt a zvolte efekt na kartě Animace. Pořadí a začátek (po kliknutí, s předchozí, po předchozí) upravíte v Podokně animací.'],
  ['Prezentování', 'F5 spustí prezentaci od začátku, Shift+F5 od aktuálního snímku. B/W zčerná/zbělá obrazovku, Ctrl+P zapne pero, Ctrl+L laser, G ukáže všechny snímky, Esc prezentaci ukončí.'],
  ['Zobrazení prezentujícího', 'Na kartě Prezentace zaškrtněte Použít zobrazení prezentujícího. Uvidíte poznámky, další snímek a časovač.'],
  ['Designer a AstroAI', 'Designer navrhne rozvržení snímku z jeho obsahu. AstroAI napíše celou osnovu z jedné věty (vyžaduje lokální model, jinak použije vestavěnou osnovu).'],
  ['Klávesové zkratky', 'Ctrl+M nový snímek · Ctrl+D duplikovat · Ctrl+Z zpět · Ctrl+S uložit · Ctrl+B/I/U písmo · Tab/Shift+Tab úroveň odrážky · F5 prezentace · Ctrl+F1 skrýt pás karet'],
];
function podoknoNapoveda(P, telo) {
  telo.replaceChildren(el('div.pr-napoveda', {}, NAPOVEDA.map(([n, t], i) => sekce(n, el('p', { text: t }), i === 0))));
}

const PODOKNA = {
  format: podoknoFormat, formatObr: podoknoFormat, pozadi: podoknoPozadi, animace: podoknoAnimace, vyber: podoknoVyber, komentare: podoknoKomentare,
  designer: podoknoDesigner, ai: podoknoAI, pristupnost: podoknoPristupnost, schranka: podoknoSchranka, napoveda: podoknoNapoveda,
};

export { MOZNOSTI_ANIMACE, dialog, pole, zavriRozbal };
