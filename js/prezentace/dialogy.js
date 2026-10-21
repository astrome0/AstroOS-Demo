// AstroPrezentace — dialogová okna

import { el, cz } from '../util.js';
import * as FS from '../fs.js';
import { icon as ikonaOS, hasIcon as maIkonuOS } from '../icons.js';
import { ik } from '../pismo/ikony.js';
import { dialog, pole } from '../pismo/ui.js';
import { PISMA, zasobnikPisma } from '../pismo/dokument.js';
import { TYPY_GRAFU, svgGrafu } from '../tabulky/grafy.js';
import { VELIKOSTI_SNIMKU } from './motivy.js';
import { ODRAZKY, CISLOVANI } from './render.js';
import { ANIMACE, MOZNOSTI_ANIMACE, VYCHOZI_TRVANI, nazevAnimace } from './efekty.js';

const vyber = (hodnoty, vybrana, o = {}) => el('select.ps-vyber' + (o.cls ? '.' + o.cls : ''), { onchange: o.onchange }, hodnoty.map((h) => { const [v, t] = Array.isArray(h) ? h : [h, h]; return el('option', { value: v, text: t, selected: String(v) === String(vybrana) }); }));
const cisloVstup = (v, o = {}) => { const i = el('input.ps-vstup', { type: 'number', value: v, min: o.min ?? 0, max: o.max ?? 9999, step: o.krok ?? 1, style: o.sirka ? { width: o.sirka + 'px' } : null }); i.addEventListener('keydown', (e) => e.stopPropagation()); return i; };
const zaskrt = (text, checked) => { const c = el('input', { type: 'checkbox', checked }); return [el('label.ps-zaskrt', {}, c, el('span', { text })), c]; };

// ---------------------------------------------------------------- Písmo
export function dialogPismo(P) {
  const st = P.stav;
  const pismo = vyber(PISMA, (st.pismo || '').replace(/ \(.*\)$/, ''));
  const styl = vyber([['n', 'Normální'], ['i', 'Kurzíva'], ['b', 'Tučné'], ['bi', 'Tučná kurzíva']], `${st.tucne ? 'b' : ''}${st.kurziva ? 'i' : ''}` || 'n');
  const vel = cisloVstup(st.velikost || 18, { min: 1, max: 400 });
  const [podtrzeni, cPod] = zaskrt('Podtržení', !!st.podtrzeni);
  const [preskrt, cPre] = zaskrt('Přeškrtnutí', !!st.preskrtnuti);
  const [stin, cStin] = zaskrt('Stín', !!st.stin);
  const [kap, cKap] = zaskrt('Všechna písmena velká', false);
  const rozestup = cisloVstup(st.rozestup || 0, { min: -20, max: 50, krok: 0.1 });
  const nahled = el('div.ps-nahled-pisma', { text: 'Příliš žluťoučký kůň' });
  const obnovNahled = () => Object.assign(nahled.style, { fontFamily: zasobnikPisma(pismo.value), fontWeight: styl.value.includes('b') ? 700 : 400, fontStyle: styl.value.includes('i') ? 'italic' : 'normal', fontSize: Math.min(40, +vel.value || 18) + 'px', textDecoration: `${cPod.checked ? 'underline' : ''} ${cPre.checked ? 'line-through' : ''}`, letterSpacing: (+rozestup.value || 0) + 'px', textTransform: cKap.checked ? 'uppercase' : 'none' });
  for (const x of [pismo, styl, vel, rozestup, cPod, cPre, cKap]) x.addEventListener('input', obnovNahled);
  obnovNahled();
  let zal = 'pismo';
  const zalozky = el('div.ps-dlg-zalozky.klik', {}, el('span.aktivni', { text: 'Písmo', onclick: () => prepni('pismo') }), el('span', { text: 'Mezery mezi znaky', onclick: () => prepni('mezery') }));
  const telo1 = el('div', {}, el('div.ps-dlg-mrizka3', {}, pole('Písmo latinky:', pismo), pole('Řez písma:', styl), pole('Velikost:', vel)),
    el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Efekty' }), el('div.ps-dlg-mrizka2', {}, podtrzeni, preskrt, stin, kap)));
  const telo2 = el('div', { hidden: true }, pole('Mezery (b.):', rozestup));
  const prepni = (z) => { zal = z; zalozky.children[0].classList.toggle('aktivni', z === 'pismo'); zalozky.children[1].classList.toggle('aktivni', z !== 'pismo'); telo1.hidden = z !== 'pismo'; telo2.hidden = z === 'pismo'; };
  void zal;
  dialog(P.koren, {
    titulek: 'Písmo', sirka: 500, obsah: el('div', {}, zalozky, telo1, telo2, nahled),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      P.pismo(pismo.value);
      P.velikost(vel.value);
      if (styl.value.includes('b') !== !!P.stav.tucne) P.formatuj('tucne');
      if (styl.value.includes('i') !== !!P.stav.kurziva) P.formatuj('kurziva');
      if (cPod.checked !== !!P.stav.podtrzeni) P.formatuj('podtrzeni');
      if (cPre.checked !== !!P.stav.preskrtnuti) P.formatuj('preskrtnuti');
      if (cStin.checked !== !!P.stav.stin) P.formatuj('stin');
      if (+rozestup.value !== (P.stav.rozestup || 0)) P.formatuj('rozestup', +rozestup.value);
      if (cKap.checked) P.formatuj('pismena', 'velka');
    } }, { text: 'Zrušit' }],
  });
}

// ---------------------------------------------------------------- Odstavec
export function dialogOdstavec(P) {
  const o = P.stav.objekt || {};
  const zar = vyber([['l', 'Vlevo'], ['c', 'Na střed'], ['r', 'Vpravo'], ['j', 'Do bloku']], P.stav.zar || 'l');
  const pred = cisloVstup(o.mezeraPred ?? (o.ph && /^obsah/.test(o.ph) ? 10 : 0), { min: 0, max: 200 });
  const radk = vyber([[0.9, 'Jednoduché (90 %)'], [1, 'Jednoduché'], [1.5, '1,5 řádku'], [2, 'Dvojité'], [2.5, 'Násobky 2,5'], [3, 'Násobky 3']], o.radkovani || 0.9);
  dialog(P.koren, {
    titulek: 'Odstavec', sirka: 460,
    obsah: el('div', {}, el('div.ps-dlg-zalozky', {}, el('span.aktivni', { text: 'Odsazení a mezery' })),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Obecné' }), pole('Zarovnání:', zar)),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Mezery' }), el('div.ps-dlg-mrizka2', {}, pole('Před (b.):', pred), pole('Řádkování:', radk)))),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      P.formatuj('zar' + zar.value.toUpperCase());
      P.upravObjekt({ mezeraPred: +pred.value, radkovani: +radk.value }, 'Odstavec');
    } }, { text: 'Zrušit' }],
  });
}

// ---------------------------------------------------------------- Odrážky a číslování
export function dialogOdrazky(P, cislovani = false) {
  let vybrano = null;
  const polozky = cislovani ? [['ne', 'Žádné'], ...Object.keys(CISLOVANI).map((k) => [k, `${CISLOVANI[k](1)} ${CISLOVANI[k](2)} ${CISLOVANI[k](3)}`])] : [['ne', 'Žádné'], ...ODRAZKY];
  const mr = el('div.pr-dlg-odrazky', {}, polozky.map(([z, t]) => el('button', { type: 'button', title: t, onclick: (e) => { mr.querySelectorAll('.vybrano').forEach((x) => x.classList.remove('vybrano')); e.currentTarget.classList.add('vybrano'); vybrano = z; } }, el('span', { text: z === 'ne' ? 'Žádné' : cislovani ? t : `${z} ———\n${z} ———\n${z} ———` }))));
  const od = cisloVstup(1, { min: 1, max: 999 });
  dialog(P.koren, {
    titulek: 'Odrážky a číslování', sirka: 520,
    obsah: el('div', {}, el('div.ps-dlg-zalozky', {}, el('span.aktivni', { text: cislovani ? 'Číslování' : 'Odrážky' })), mr, cislovani ? pole('Začít od:', od) : null),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => { if (vybrano) (cislovani ? P.cislovani(vybrano) : P.odrazky(vybrano)); if (cislovani && +od.value !== 1) P.upravObjekt({ cisloOd: +od.value }, 'Začít od'); } }, { text: 'Zrušit' }],
  });
}

// ---------------------------------------------------------------- Tabulka, graf
export function dialogTabulka(P) {
  const s = cisloVstup(5, { min: 1, max: 30 });
  const r = cisloVstup(2, { min: 1, max: 60 });
  dialog(P.koren, { titulek: 'Vložit tabulku', sirka: 300, obsah: el('div', {}, pole('Počet sloupců:', s), pole('Počet řádků:', r)), tlacitka: [{ text: 'OK', primarni: true, akce: () => P.vlozTabulku(Math.max(1, +r.value), Math.max(1, +s.value)) }, { text: 'Zrušit' }] });
}

const VZOROVA_DATA = { kategorie: ['Kategorie 1', 'Kategorie 2', 'Kategorie 3', 'Kategorie 4'], rady: [{ nazev: 'Řada 1', hodnoty: [4.3, 2.5, 3.5, 4.5] }, { nazev: 'Řada 2', hodnoty: [2.4, 4.4, 1.8, 2.8] }, { nazev: 'Řada 3', hodnoty: [2, 2, 3, 5] }] };
export function dialogGraf(P, id = null) {
  let typ = 'sloupcovy';
  const skupiny = [...new Set(TYPY_GRAFU.map((t) => t.skupina))];
  const b = P.barvy();
  const nahled = el('div.pr-dlg-graf-nahled');
  const typy = el('div.pr-dlg-graf-typy');
  const kresliNahled = () => { nahled.innerHTML = svgGrafu({ id: 'nahled', typ, barvyRad: b.a, nazev: 'Název grafu', legenda: /vysec|prstenc/.test(typ) ? 'vpravo' : 'dole' }, /vysec|prstenc/.test(typ) ? { ...VZOROVA_DATA, rady: [VZOROVA_DATA.rady[0]] } : { ...VZOROVA_DATA, xHodnoty: [1, 2, 3, 4] }, 420, 250); };
  const kresliTypy = (sk) => typy.replaceChildren(...TYPY_GRAFU.filter((t) => t.skupina === sk).map((t) => el('button' + (t.id === typ ? '.vybrano' : ''), { type: 'button', title: t.nazev, onclick: () => { typ = t.id; kresliTypy(sk); kresliNahled(); } }, ik(t.ikona), el('span', { text: t.nazev }))));
  const bok = el('div.pr-dlg-graf-bok', {}, skupiny.map((sk, i) => el('button' + (i === 0 ? '.aktivni' : ''), { type: 'button', text: sk, onclick: (e) => { bok.querySelectorAll('button').forEach((x) => x.classList.remove('aktivni')); e.currentTarget.classList.add('aktivni'); typ = TYPY_GRAFU.find((t) => t.skupina === sk).id; kresliTypy(sk); kresliNahled(); } })));
  kresliTypy(skupiny[0]); kresliNahled();
  dialog(P.koren, { titulek: id ? 'Změnit typ grafu' : 'Vložit graf', sirka: 720, obsah: el('div.pr-dlg-graf', {}, bok, el('div', {}, typy, nahled)), tlacitka: [{ text: 'OK', primarni: true, akce: () => (id ? P.upravGraf({ typ }) : P.vlozGraf(typ, JSON.parse(JSON.stringify(/vysec|prstenc/.test(typ) ? { ...VZOROVA_DATA, rady: [VZOROVA_DATA.rady[0]] } : VZOROVA_DATA)))) }, { text: 'Zrušit' }] });
}

/** Úprava dat grafu: malá tabulka jako „Upravit data v aplikaci AstroTabulky“. */
export function dialogDataGrafu(P, o) {
  const g = JSON.parse(JSON.stringify(o.graf));
  const tab = el('table.pr-dlg-data');
  const kresli = () => {
    const radky = [];
    radky.push(el('tr', {}, el('th'), g.rady.map((r, j) => el('th', {}, vstup(r.nazev, (v) => { g.rady[j].nazev = v; })))));
    g.kategorie.forEach((k, i) => radky.push(el('tr', {}, el('th', {}, vstup(k, (v) => { g.kategorie[i] = v; })), g.rady.map((r, j) => el('td', {}, vstup(r.hodnoty[i] ?? '', (v) => { g.rady[j].hodnoty[i] = v === '' ? null : parseFloat(String(v).replace(',', '.')); }, true))))));
    tab.replaceChildren(...radky);
  };
  const vstup = (v, zmena, cislo) => { const i = el('input', { value: cislo && typeof v === 'number' ? String(v).replace('.', ',') : v }); i.addEventListener('keydown', (e) => e.stopPropagation()); i.oninput = () => zmena(i.value); return i; };
  kresli();
  const tl = (t, fn) => el('button.ps-tlac.maly', { type: 'button', text: t, onclick: () => { fn(); kresli(); } });
  dialog(P.koren, {
    titulek: 'Data grafu', sirka: 620,
    obsah: el('div', {}, el('div.pr-pod-tlacitka', {},
      tl('+ Kategorie', () => { g.kategorie.push(`Kategorie ${g.kategorie.length + 1}`); for (const r of g.rady) r.hodnoty.push(0); }),
      tl('− Kategorie', () => { if (g.kategorie.length > 1) { g.kategorie.pop(); for (const r of g.rady) r.hodnoty.pop(); } }),
      tl('+ Řada', () => g.rady.push({ nazev: `Řada ${g.rady.length + 1}`, hodnoty: g.kategorie.map(() => 0) })),
      tl('− Řada', () => { if (g.rady.length > 1) g.rady.pop(); })),
    el('div.pr-dlg-data-ram', {}, tab)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.upravGraf({ kategorie: g.kategorie, rady: g.rady }, 'Upravit data') }, { text: 'Zrušit' }],
  });
}

// ---------------------------------------------------------------- Ikony, obrázky z disku, zvuk
const IKONY_OS = ['star', 'globe', 'music', 'image', 'mail', 'game', 'calc', 'folder', 'computer', 'wifi', 'battery', 'bell', 'lock', 'ai', 'settings', 'search', 'trash', 'send', 'download', 'key', 'chip', 'gpu', 'power', 'restart', 'user', 'home', 'heart', 'cloud', 'sun', 'moon', 'camera', 'code'];
export function dialogIkony(P) {
  let vybrane = new Set();
  const dostupne = IKONY_OS.filter((n) => maIkonuOS(n));
  const mr = el('div.ps-ikony-mrizka', {}, dostupne.map((n) => el('button', { type: 'button', title: n, onclick: (e) => { const b = e.currentTarget; if (vybrane.has(n)) { vybrane.delete(n); b.classList.remove('vybrano'); } else { vybrane.add(n); b.classList.add('vybrano'); } tl.textContent = vybrane.size ? `Vložit (${vybrane.size})` : 'Vložit'; } }, ikonaOS(n))));
  const tl = el('span', { text: 'Vložit' });
  const d = dialog(P.koren, {
    titulek: 'Vložit ikony', sirka: 540, obsah: el('div', {}, el('div.ps-dlg-zalozky', {}, el('span.aktivni', { text: 'Ikony' })), mr),
    tlacitka: [{ text: 'Vložit', primarni: true, akce: () => { if (vybrane.size) P.vlozIkony([...vybrane]); } }, { text: 'Zrušit' }],
  });
  d.okno.querySelector('.ps-tlac.primarni').replaceChildren(tl);
}

export function dialogObrazkyZDisku(P, onVyber, { vice = false, titulek = 'Vložit obrázek — AstroOS' } = {}) {
  const obrazky = FS.findImages(FS.HOME).slice(0, 80);
  const vybrane = new Set();
  const mr = el('div.ps-obr-mrizka', {}, obrazky.length ? obrazky.map((c) => {
    const src = FS.imageSrc(c);
    return el('button.ps-obr-dlazdice', { type: 'button', title: c, onclick: (e) => {
      if (!vice) { d.zavri(); onVyber([{ src, nazev: FS.basename(c) }]); return; }
      if (vybrane.has(c)) { vybrane.delete(c); e.currentTarget.classList.remove('vybrano'); } else { vybrane.add(c); e.currentTarget.classList.add('vybrano'); }
    } }, el('img', { src, alt: '', loading: 'lazy' }), el('span', { text: FS.basename(c) }));
  }) : el('p', { text: 'Na disku nejsou žádné obrázky. Uložte nějaký z Malování nebo z Novy.' }));
  const d = dialog(P.koren, { titulek, sirka: 640, obsah: mr, tlacitka: vice ? [{ text: 'Vytvořit', primarni: true, akce: () => { if (vybrane.size) onVyber([...vybrane].map((c) => ({ src: FS.imageSrc(c), nazev: FS.basename(c) }))); } }, { text: 'Zrušit' }] : [{ text: 'Zrušit' }] });
}

export function dialogZvuky(P, onVyber) {
  let zvuky = [];
  try { zvuky = FS.list(FS.HOME + '/Nahrávky').filter((x) => !FS.isDir(x.node) && FS.isAudio(x.name)).map((x) => FS.join(FS.HOME + '/Nahrávky', x.name)); } catch { /* složka není */ }
  const seznam = el('div.pr-dlg-zvuky', {}, zvuky.length ? zvuky.map((c) => el('button.ps-zk-radek', { type: 'button', onclick: () => { d.zavri(); onVyber(FS.audioSrc(c), FS.basename(c)); } }, ik('zvuk'), el('span', { text: FS.basename(c) }))) : el('p', { text: 'Ve složce Nahrávky nejsou žádné zvuky. Nahrajte si nějaký v aplikaci Diktafon nebo tady přes Nahrát zvuk.' }));
  const d = dialog(P.koren, { titulek: 'Vložit zvuk', sirka: 440, obsah: seznam, tlacitka: [{ text: 'Zrušit' }] });
}

export function dialogNahratZvuk(P, onHotovo) {
  let rec = null, data = [], start = 0, tik = 0, url = null;
  const cas = el('b.pr-rec-cas', { text: '0:00' });
  const stav = el('span', { text: 'Klikněte na Nahrát.' });
  const jmeno = el('input.ps-vstup', { value: 'Nahraný zvuk' });
  const prehrat = el('audio', { controls: true, hidden: true });
  const tlRec = el('button.ps-tlac', { type: 'button' }, el('span', { text: '● Nahrát' }));
  tlRec.onclick = async () => {
    if (rec) { rec.stop(); return; }
    try {
      const proud = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec = new MediaRecorder(proud, { mimeType: 'audio/webm', audioBitsPerSecond: 24000 });
      data = [];
      rec.ondataavailable = (e) => data.push(e.data);
      rec.onstop = () => {
        proud.getTracks().forEach((t) => t.stop());
        clearInterval(tik);
        const blob = new Blob(data, { type: 'audio/webm' });
        const r = new FileReader();
        r.onload = () => { url = r.result; prehrat.src = url; prehrat.hidden = false; stav.textContent = 'Nahráno.'; };
        r.readAsDataURL(blob);
        rec = null; tlRec.firstChild.textContent = '● Nahrát znovu';
      };
      rec.start();
      start = Date.now();
      tik = setInterval(() => { const s = Math.floor((Date.now() - start) / 1000); cas.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 250);
      stav.textContent = 'Nahrává se…'; tlRec.firstChild.textContent = '■ Zastavit';
    } catch { stav.textContent = 'Mikrofon není dostupný.'; }
  };
  dialog(P.koren, {
    titulek: 'Nahrát zvuk', sirka: 380,
    obsah: el('div', {}, pole('Název:', jmeno), el('div.pr-rec', {}, tlRec, cas), stav, prehrat),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => { if (rec) rec.stop(); if (url) onHotovo(url, jmeno.value.trim() || 'Nahraný zvuk'); } }, { text: 'Zrušit', akce: () => { if (rec) rec.stop(); } }],
    pri_zavreni: () => clearInterval(tik),
  });
}

// ---------------------------------------------------------------- Odkaz, alternativní text, oříznutí
export function dialogOdkaz(P) {
  const text = el('input.ps-vstup', { value: getSelection().toString() });
  const adr = el('input.ps-vstup', { placeholder: 'https://' });
  const snimky = vyber([['', '— Místo v této prezentaci —'], ['#dalsi', 'Další snímek'], ['#predchozi', 'Předchozí snímek'], ...P.pres.snimky.map((s, i) => [`#snimek-${i + 1}`, `${i + 1}. ${P.nadpisSnimku(s) || 'Snímek'}`])], '');
  snimky.onchange = () => { if (snimky.value) adr.value = snimky.value; };
  dialog(P.koren, { titulek: 'Vložit hypertextový odkaz', sirka: 460, obsah: el('div', {}, pole('Zobrazený text:', text), pole('Adresa:', adr), pole('Nebo místo v dokumentu:', snimky)), tlacitka: [{ text: 'OK', primarni: true, akce: () => { if (adr.value.trim()) P.vlozOdkaz(adr.value.trim(), text.value.trim()); } }, { text: 'Zrušit' }] });
}
export function dialogAlt(P) {
  const o = P.stav.objekt;
  if (!o) return;
  const t = el('textarea.ps-vstup', { rows: 4 }, o.alt || '');
  const [dek, cDek] = zaskrt('Označit jako dekorativní', !!o.dekorativni);
  dialog(P.koren, { titulek: 'Alternativní text', sirka: 400, obsah: el('div', {}, el('p.ps-dlg-pozn', { text: 'Jak byste tento objekt popsali někomu, kdo ho nevidí? (doporučeno 1–2 věty)' }), t, dek), tlacitka: [{ text: 'OK', primarni: true, akce: () => P.upravObjekt({ alt: t.value.trim(), dekorativni: cDek.checked }, 'Alternativní text') }, { text: 'Zrušit' }] });
}
export function dialogOrez(P) {
  const o = P.stav.objekt;
  if (o?.typ !== 'obrazek') return;
  const r = o.orez || { l: 0, r: 0, t: 0, b: 0 };
  const v = (k) => cisloVstup(Math.round(r[k] * 100), { min: 0, max: 90 });
  const l = v('l'), p = v('r'), h = v('t'), d = v('b');
  dialog(P.koren, { titulek: 'Oříznout obrázek', sirka: 340, obsah: el('div', {}, el('p.ps-dlg-pozn', { text: 'Kolik procent obrázku odříznout z každé strany:' }), el('div.ps-dlg-mrizka2', {}, pole('Vlevo (%):', l), pole('Vpravo (%):', p), pole('Nahoře (%):', h), pole('Dole (%):', d))),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.orez({ l: +l.value / 100, r: +p.value / 100, t: +h.value / 100, b: +d.value / 100 }) }, { text: 'Zrušit' }] });
}

// ---------------------------------------------------------------- Záhlaví a zápatí
export function dialogZapati(P, zameren) {
  const z = { ...P.pres.zapati };
  const [datum, cDatum] = zaskrt('Datum a čas', !!z.datum || zameren === 'datum');
  const aut = el('input', { type: 'radio', name: 'pr-datum', checked: !z.datumPevne });
  const pev = el('input', { type: 'radio', name: 'pr-datum', checked: !!z.datumPevne });
  const pevText = el('input.ps-vstup', { value: z.datumText || cz.datumKratky(new Date()) });
  const [cislo, cCislo] = zaskrt('Číslo snímku', !!z.cislo || zameren === 'cislo');
  const [zap, cZap] = zaskrt('Zápatí', !!z.zapati);
  const zapText = el('input.ps-vstup', { value: z.text || '' });
  const [uvod, cUvod] = zaskrt('Nezobrazovat na úvodním snímku', !z.naUvodnim);
  zapText.addEventListener('keydown', (e) => e.stopPropagation()); pevText.addEventListener('keydown', (e) => e.stopPropagation());
  const vysledek = () => ({ datum: cDatum.checked, datumPevne: pev.checked, datumText: pevText.value, cislo: cCislo.checked, zapati: cZap.checked, text: zapText.value, naUvodnim: !cUvod.checked });
  dialog(P.koren, {
    titulek: 'Záhlaví a zápatí', sirka: 480,
    obsah: el('div', {}, el('div.ps-dlg-zalozky', {}, el('span.aktivni', { text: 'Snímek' })),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Zahrnout na snímek' }),
        datum, el('div.pr-odsaz', {}, el('label.ps-dlg-radio', {}, aut, el('span', { text: `Aktualizovat automaticky (${cz.datumKratky(new Date())})` })), el('label.ps-dlg-radio', {}, pev, el('span', { text: 'Pevné' })), pevText),
        cislo, zap, el('div.pr-odsaz', {}, zapText)),
      uvod),
    tlacitka: [{ text: 'Použít u všech', primarni: true, akce: () => P.nastavZapati(vysledek()) }, { text: 'Zrušit' }],
  });
}

// ---------------------------------------------------------------- Velikost snímku, nastavení prezentace
export function dialogVelikostSnimku(P) {
  const akt = P.pres.velikost;
  const typ = vyber([...VELIKOSTI_SNIMKU.map((v) => [v.id, v.nazev]), ['vlastni', 'Vlastní']], akt.id || 'vlastni');
  const w = cisloVstup(+(akt.w / 28.3465).toFixed(2), { krok: 0.01, min: 2.54, max: 142 });
  const h = cisloVstup(+(akt.h / 28.3465).toFixed(2), { krok: 0.01, min: 2.54, max: 142 });
  typ.onchange = () => { const v = VELIKOSTI_SNIMKU.find((x) => x.id === typ.value); if (v) { w.value = (v.w / 28.3465).toFixed(2); h.value = (v.h / 28.3465).toFixed(2); } };
  const [prizp, cPrizp] = zaskrt('Přizpůsobit obsah (zmenšit)', true);
  dialog(P.koren, { titulek: 'Velikost snímku', sirka: 360, obsah: el('div', {}, pole('Velikost snímků:', typ), el('div.ps-dlg-mrizka2', {}, pole('Šířka (cm):', w), pole('Výška (cm):', h)), prizp),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.nastavVelikostSnimku({ id: typ.value === 'vlastni' ? null : typ.value, w: +w.value * 28.3465, h: +h.value * 28.3465 }, cPrizp.checked) }, { text: 'Zrušit' }] });
}
export function dialogNastavit(P) {
  const n = { ...P.pres.nastaveni };
  const typ = el('div.ps-dlg-radio', {}, el('label', {}, el('input', { type: 'radio', name: 'pr-typ', checked: !n.kiosek, value: 'r' }), el('span', { text: 'Prezentující řečník (celá obrazovka)' })), el('label', {}, el('input', { type: 'radio', name: 'pr-typ', checked: !!n.kiosek, value: 'k' }), el('span', { text: 'Samoobslužné procházení (kiosek)' })));
  const [smycka, cSm] = zaskrt('Opakovat, dokud nestisknete klávesu Esc', !!n.smycka);
  const [bezAnim, cBa] = zaskrt('Prezentace bez animací', !!n.bezAnimaci);
  const [bezCas, cBc] = zaskrt('Ručně (ignorovat časování)', !!n.bezCasovani);
  const [prez, cPr] = zaskrt('Použít zobrazení prezentujícího', !!n.prezentujici);
  const pero = el('input', { type: 'color', value: n.pero || '#E71224' });
  const laser = el('input', { type: 'color', value: n.laser || '#FF0000' });
  dialog(P.koren, {
    titulek: 'Nastavit prezentaci', sirka: 520,
    obsah: el('div.ps-dlg-mrizka2', {},
      el('div', {}, el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Typ prezentace' }), typ),
        el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Možnosti prezentace' }), smycka, bezAnim, pole('Barva pera:', pero), pole('Barva laserového ukazovátka:', laser))),
      el('div', {}, el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Přechod na další snímek' }), bezCas),
        el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Více monitorů' }), prez))),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.nastavPrezentaci({ kiosek: typ.querySelector('input:checked').value === 'k', smycka: cSm.checked, bezAnimaci: cBa.checked, bezCasovani: cBc.checked, prezentujici: cPr.checked, pero: pero.value.toUpperCase(), laser: laser.value.toUpperCase() }) }, { text: 'Zrušit' }],
  });
}

// ---------------------------------------------------------------- Najít a nahradit
export function dialogNajit(P, nahradit = false) {
  const co = el('input.ps-vstup', { value: getSelection().toString().slice(0, 60) });
  const cim = el('input.ps-vstup');
  const [velka, cVelka] = zaskrt('Rozlišovat velká a malá písmena', false);
  const [cela, cCela] = zaskrt('Pouze celá slova', false);
  const info = el('div.ps-dlg-pozn', { text: ' ' });
  for (const i of [co, cim]) i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); najdi(); } });
  const volby = () => ({ velka: cVelka.checked, cela: cCela.checked });
  const najdi = () => { const r = P.najitDalsi(co.value, volby()); info.textContent = r ? '' : 'Prohledali jsme celou prezentaci. Hledaná položka se nenašla.'; };
  const tl = [{ text: 'Najít další', primarni: !nahradit, akce: () => { najdi(); return false; } }];
  if (nahradit) tl.push({ text: 'Nahradit', akce: () => { P.nahraditVyber(co.value, cim.value, volby()); najdi(); return false; } }, { text: 'Nahradit vše', primarni: true, akce: () => { const n = P.nahraditVse(co.value, cim.value, volby()); info.textContent = n ? `Počet nahrazení v prezentaci: ${n}.` : 'Hledaná položka se nenašla.'; return false; } });
  tl.push({ text: 'Zavřít' });
  dialog(P.koren, { titulek: nahradit ? 'Nahradit' : 'Najít', sirka: 440, obsah: el('div', {}, pole('Najít:', co), nahradit ? pole('Nahradit čím:', cim) : null, velka, cela, info), tlacitka: tl });
}
export function dialogNahraditPisma(P) {
  const pouzita = P.pouzitaPisma();
  const z = vyber(pouzita, pouzita[0]);
  const na = vyber(PISMA, 'Arial');
  dialog(P.koren, { titulek: 'Nahradit písmo', sirka: 340, obsah: el('div', {}, pole('Nahradit:', z), pole('Za:', na)), tlacitka: [{ text: 'Nahradit', primarni: true, akce: () => P.nahraditPismo(z.value, na.value) }, { text: 'Zavřít' }] });
}

// ---------------------------------------------------------------- Lupa, mřížka
export function dialogLupa(P) {
  const akt = Math.round(P.ed.z * 100);
  let hodn = P.ed.prizpusobit ? 'prizpusobit' : akt;
  const proc = el('input.ps-vstup', { type: 'number', value: akt, min: 10, max: 400 });
  const volby = [['prizpusobit', 'Přizpůsobit'], [400, '400 %'], [200, '200 %'], [100, '100 %'], [66, '66 %'], [50, '50 %'], [33, '33 %']];
  const radia = volby.map(([v, t]) => el('label', {}, el('input', { type: 'radio', name: 'pr-lupa', checked: v === hodn, onchange: () => { hodn = v; if (typeof v === 'number') proc.value = v; } }), ' ' + t));
  proc.oninput = () => { hodn = +proc.value; };
  dialog(P.koren, { titulek: 'Lupa', sirka: 320, obsah: el('div', {}, el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Lupa' }), el('div.ps-dlg-mrizka2', {}, radia)), pole('Procenta:', proc)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => (hodn === 'prizpusobit' ? P.lupaPrizpusobit() : P.lupa(Math.max(10, Math.min(400, hodn)))) }, { text: 'Zrušit' }] });
}
export function dialogMrizka(P) {
  const [prichyt, cP] = zaskrt('Přichytit objekty k mřížce', !!P.st.prichytMrizka);
  const krok = vyber([[9, '0,32 cm'], [14.17, '0,5 cm'], [18, '0,64 cm'], [28.35, '1 cm'], [36, '1,27 cm']], P.st.krokMrizky || 18);
  const [ukaz, cU] = zaskrt('Zobrazit mřížku na obrazovce', !!P.st.mrizka);
  const [vod, cV] = zaskrt('Zobrazit vodítka kreslení na obrazovce', !!P.st.voditka);
  const [chytre, cCh] = zaskrt('Zobrazit inteligentní vodítka při zarovnání obrazců', P.st.chytraVoditka !== false);
  dialog(P.koren, { titulek: 'Mřížka a vodítka', sirka: 400, obsah: el('div', {}, el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Přichytit k' }), prichyt), el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Nastavení mřížky' }), pole('Mezery:', krok), ukaz), el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Nastavení vodítek' }), vod, chytre)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.nastavZobrazeni({ prichytMrizka: cP.checked, krokMrizky: +krok.value, mrizka: cU.checked, voditka: cV.checked, chytraVoditka: cCh.checked }) }, { text: 'Zrušit' }] });
}

// ---------------------------------------------------------------- Animace (možnosti efektu, časování)
export function dialogAnimace(P, id, zalozka = 'efekt') {
  const s = P.snimek();
  const a = s.animace.find((x) => x.id === id);
  if (!a) return;
  const m = MOZNOSTI_ANIMACE[a.efekt];
  const smer = m ? vyber(m, a.smer || m[0][0]) : null;
  const start = vyber([['klik', 'Po kliknutí'], ['spolu', 'S předchozí'], ['po', 'Po předchozí']], a.start || 'klik');
  const zp = cisloVstup(a.zpozdeni || 0, { krok: 0.25, min: 0, max: 60 });
  const tr = cisloVstup(a.trvani ?? VYCHOZI_TRVANI[a.efekt] ?? 0.5, { krok: 0.25, min: 0.01, max: 60 });
  const opak = vyber([[1, '(žádné)'], [2, '2'], [3, '3'], [5, '5'], [10, '10']], a.opakovani || 1);
  let akt = zalozka;
  const t1 = el('div', { hidden: akt !== 'efekt' }, smer ? pole('Směr:', smer) : el('p.ps-dlg-pozn', { text: 'Tento efekt nemá další nastavení.' }));
  const t2 = el('div', { hidden: akt === 'efekt' }, pole('Začátek:', start), el('div.ps-dlg-mrizka2', {}, pole('Zpoždění (s):', zp), pole('Doba trvání (s):', tr)), pole('Opakovat:', opak));
  const zal = el('div.ps-dlg-zalozky.klik', {}, el('span' + (akt === 'efekt' ? '.aktivni' : ''), { text: 'Efekt', onclick: () => prepni('efekt') }), el('span' + (akt !== 'efekt' ? '.aktivni' : ''), { text: 'Časování', onclick: () => prepni('casovani') }));
  const prepni = (z) => { akt = z; zal.children[0].classList.toggle('aktivni', z === 'efekt'); zal.children[1].classList.toggle('aktivni', z !== 'efekt'); t1.hidden = z !== 'efekt'; t2.hidden = z === 'efekt'; };
  dialog(P.koren, { titulek: nazevAnimace(a), sirka: 400, obsah: el('div', {}, el('p.ps-dlg-pozn', { text: ANIMACE[a.druh]?.nazev }), zal, t1, t2),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.upravAnimace({ ...(smer ? { smer: smer.value } : {}), start: start.value, zpozdeni: +zp.value, trvani: +tr.value, opakovani: +opak.value > 1 ? +opak.value : undefined }, [a.id]) }, { text: 'Zrušit' }] });
}

// ---------------------------------------------------------------- SmartArt, názory, co je nového
export function dialogSmartArt(P, prevest) {
  const typy = [['seznam', 'Seznam', 'Základní seznam bloků'], ['svisly', 'Seznam', 'Svislý seznam s odrážkami'], ['proces', 'Proces', 'Základní proces'], ['casovaOsa', 'Proces', 'Základní časová osa'], ['cyklus', 'Cyklus', 'Základní cyklus'], ['hierarchie', 'Hierarchie', 'Organizační diagram'], ['vennuv', 'Relace', 'Základní Vennův diagram'], ['pyramida', 'Pyramida', 'Základní pyramida']];
  let vybrany = 'seznam';
  const popis = el('div.ps-dlg-pozn', { text: 'Základní seznam bloků — pro neuspořádané nebo seskupené bloky informací.' });
  const mr = el('div.pr-dlg-smartart', {}, typy.map(([id, sk, n]) => el('button' + (id === vybrany ? '.vybrano' : ''), { type: 'button', title: n, onclick: (e) => { vybrany = id; mr.querySelectorAll('.vybrano').forEach((x) => x.classList.remove('vybrano')); e.currentTarget.classList.add('vybrano'); popis.textContent = `${n} (${sk})`; } }, el('b', { text: sk }), el('span', { text: n }))));
  dialog(P.koren, { titulek: 'Zvolit obrázek SmartArt', sirka: 560, obsah: el('div', {}, mr, popis), tlacitka: [{ text: 'OK', primarni: true, akce: () => P.vlozSmartArt(vybrany, prevest) }, { text: 'Zrušit' }] });
}
export function dialogNazory(P) {
  const t = el('textarea.ps-vstup', { rows: 5, placeholder: 'Co se vám líbí nebo co vám chybí?' });
  dialog(P.koren, { titulek: 'Názory na AstroPrezentace', sirka: 420, obsah: el('div', {}, el('div.ps-nazory', {}, el('button.ps-tlac', { type: 'button', text: '🙂 Líbí se mi' }), el('button.ps-tlac', { type: 'button', text: '🙁 Nelíbí se mi' })), t),
    tlacitka: [{ text: 'Odeslat', primarni: true, akce: () => P.toast('Děkujeme za názor!') }, { text: 'Zrušit' }] });
}
export function dialogCoNoveho(P) {
  const body = [['Přeměna', 'Duplikujte snímek, posuňte objekty a zvolte přechod Přeměna.'], ['Designer', 'Návrhy rozvržení z obsahu snímku jedním kliknutím.'], ['AstroAI', 'Celá osnova prezentace z jedné věty.'], ['Zobrazení prezentujícího', 'Poznámky, další snímek a časovač při prezentování.'], ['Pero a laser', 'Kreslete přímo do prezentace, rukopis se může uložit.']];
  dialog(P.koren, { titulek: 'Co je nového', sirka: 460, obsah: el('div.pr-co-noveho', {}, body.map(([n, t]) => el('div', {}, el('b', { text: n }), el('p', { text: t })))), tlacitka: [{ text: 'OK', primarni: true }] });
}
