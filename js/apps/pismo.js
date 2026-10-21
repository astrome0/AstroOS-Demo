// AstroOS — AstroPísmo, textový editor jako Microsoft Word (Microsoft 365, 2025)
//
// Části: js/pismo/dokument.js (editor, stránkování, historie), pas.js (pás karet),
// dialogy.js, zakulisi.js (karta Soubor), ui.js (nabídky, dialogy), ikony.js, sablony.js.
// Tady je lepidlo: titulek okna, podokna, stavový řádek, klávesy, soubory.

import { el, bus } from '../util.js';
import * as FS from '../fs.js';
import { State } from '../state.js';
import { toast } from '../ui.js';
import { ik } from '../pismo/ikony.js';
import { Dokument, serializuj, rozeber, vycisti, htmlNaText, MM, MEZERA, STYLY } from '../pismo/dokument.js';
import { KARTY, postavKarty, prizpusobKartu, SADY, BARVY_MOTIVU, PISMA_MOTIVU, MEZERY, zmenVelikostPismen, styl as aplikujStyl, STYLY_TABULKY } from '../pismo/pas.js';
import { rozbal, zavriRozbal, nabidka, dialog, zprava, pole } from '../pismo/ui.js';
import * as D from '../pismo/dialogy.js';
import { otevriZakulisi } from '../pismo/zakulisi.js';
import { SABLONY } from '../pismo/sablony.js';
import { zasobnikPisma } from '../pismo/dokument.js';
import { anglicky } from '../i18n.js';

const openApp = (id, o) => import('../apps.js').then((m) => m.openApp(id, o));
let citacDokumentu = 0;
let cssObsahu = '';
fetch('css/pismo.css').then((r) => r.text()).then((t) => { cssObsahu = t; }).catch(() => {});

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** CSS proměnné dokumentu podle Návrh → sada stylů, barvy, písma, mezery. */
export function promenneDokumentu(n) {
  const v = { ...(SADY[n.sada]?.vars || {}) };
  if (n.barvy && BARVY_MOTIVU[n.barvy]) v['--ps-nadpis-barva'] = BARVY_MOTIVU[n.barvy][1];
  if (n.pisma && PISMA_MOTIVU[n.pisma]) {
    v['--ps-pismo-nadpisy'] = zasobnikPisma(PISMA_MOTIVU[n.pisma][1]);
    v['--ps-pismo'] = zasobnikPisma(PISMA_MOTIVU[n.pisma][2]);
  }
  if (n.mezery && MEZERY[n.mezery]) { v['--ps-mezera-za'] = MEZERY[n.mezery][1]; v['--ps-radkovani'] = MEZERY[n.mezery][2]; }
  return v;
}

export const pismoApp = {
  id: 'pismo', name: 'AstroPísmo', icon: 'pismo', color: 'linear-gradient(145deg,#3d8ef7,#1446a8)',
  cat: 'office', width: 1200, height: 780,

  mount(body, win) {
    win.P = vytvor(body, win);
  },
  reopen(win, opts) {
    if (opts?.path) win.P?.otevri(opts.path);
    else if (opts?.sablona) win.P?.novy(opts.sablona);
  },
  unmount(win) { win.P?.znic(); },
  muzeZavrit(win) { return win.P ? win.P.muzeZavrit() : true; },
};

function vytvor(body, win) {
  const nast = () => State.get('pismo') || {};
  const st = {
    cesta: null, nazev: 'Dokument1', typ: 'docx', dirty: false, otevreno: false, meta: {}, otevrenoOd: Date.now(),
    rezim: 'tisk', podokno: null, podoknoVlevo: null, pravitko: !!nast().pravitko, znacky: !!nast().znacky, mrizka: false,
    jenCteni: false, stetec: null, kresleni: null, obrazek: null, zahlavi: null, karta: 'domu', pasSkryty: false,
    autoUkladani: !!nast().autoUkladani, ukladani: null, schranka: [], zavrit: false,
  };
  const koren = el('div.ps', { dataset: { motiv: 'barevny' } });
  const P = {
    win, koren, st, prikazy: [], stavy: [], obnovy: [], stav: {},
    get dok() { return dok; },
    get pas() { return pasTelo; },
  };

  // ------------------------------------------------------------ dokument
  const dok = new Dokument({
    onZmena: () => zmena(),
    onVyber: () => planujObnovu(),
    onStrankovani: () => { planujObnovu(); kresliKresbu(); polohaUchytu(); kresliPravitka(); },
    onObnova: () => aplikujNastDok(),
    onHistorie: () => obnovZpet(),
  });

  P.prikaz = (fn, popis) => {
    if (st.jenCteni) { hlaskaJenCteni(); return; }
    dok.dokonciPsani();
    dok.vratVyber();
    try { fn(); } catch (e) { console.error('AstroPísmo:', e); }
    dok.normalizuj();
    dok.zaznam(popis);
    dok.planujStrankovani();
    zmena();
    obnov();
  };

  function hlaskaJenCteni() {
    zprava(koren, 'Tento dokument je označený jako konečný nebo je otevřený jen pro čtení. Úpravy povolíte tlačítkem „Přesto upravit“ nahoře.', 'AstroPísmo');
  }

  // ------------------------------------------------------------ titulek okna
  const lista = win.node.querySelector('.win-bar');
  win.node.classList.add('ps-okno');
  const zastav = (u) => {
    u.addEventListener('pointerdown', (e) => e.stopPropagation());
    u.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
    u.addEventListener('dblclick', (e) => e.stopPropagation());
    return u;
  };

  const prepinac = el('button.ps-auto-prepinac', { type: 'button', role: 'switch', title: 'Automatické ukládání' }, el('span.ps-auto-kulicka'), el('span.ps-auto-text'));
  const bUlozit = el('button.ps-t-b', { type: 'button', title: 'Uložit (Ctrl+S)', onclick: () => P.ulozit() }, ik('ulozit'));
  const bZpet = el('button.ps-t-b', { type: 'button', title: 'Zpět (Ctrl+Z)', onclick: () => { dok.zpet(); obnov(); } }, ik('zpet'));
  const bZpetSipka = el('button.ps-t-b.sipka', { type: 'button', title: 'Zpět' }, ik('sipkaDolu'));
  const bZnovu = el('button.ps-t-b', { type: 'button', title: 'Znovu (Ctrl+Y)', onclick: () => { dok.znovu(); obnov(); } }, ik('znovu'));
  const bPrizpusobit = el('button.ps-t-b.sipka', { type: 'button', title: 'Přizpůsobit panel nástrojů Rychlý přístup' }, ik('sipkaDolu'));
  const nazevDok = el('button.ps-t-nazev', { type: 'button' }, el('span.ps-t-jmeno'), el('span.ps-t-stav'), ik('sipkaDolu'));
  const hledat = el('input.ps-t-hledat-vstup', { type: 'text', placeholder: 'Hledat (Alt+Q)', spellcheck: 'false' });
  const hledatBox = el('div.ps-t-hledat', {}, ik('najitMaly'), hledat);
  const ucet = el('button.ps-t-ucet', { type: 'button', title: 'Účet' }, el('span.ps-t-ucet-jmeno'), el('span.ps-avatar'));

  const levo = el('div.ps-t-levo', {},
    el('div.ps-t-logo', { title: 'AstroPísmo' }, el('span', { text: 'P' })),
    el('span.ps-t-auto-popis', { text: 'Automatické ukládání' }), prepinac,
    bUlozit, el('div.ps-t-skupina', {}, bZpet, bZpetSipka), bZnovu, bPrizpusobit, nazevDok);
  [levo, hledatBox, ucet].forEach(zastav);
  const tah = lista.querySelector('.drag');
  lista.insertBefore(levo, tah);
  tah.after(hledatBox, el('div.drag'));
  lista.insertBefore(ucet, lista.querySelector('.win-ctl'));

  prepinac.onclick = () => {
    if (!st.autoUkladani && !st.cesta) { rychleUlozeni(() => { st.autoUkladani = true; obnovTitulek(); }); return; }
    st.autoUkladani = !st.autoUkladani;
    if (st.autoUkladani && st.dirty) P.ulozit();
    obnovTitulek();
  };
  bZpetSipka.onclick = () => {
    const h = dok.hist;
    const kroky = h.list.slice(1, h.i + 1).reverse();
    if (dok.cekani) kroky.unshift({ popis: 'Psaní' });
    if (!kroky.length) return;
    rozbal(bZpetSipka, nabidka(kroky.slice(0, 20).map((k, i) => ({ text: k.popis || 'Úprava', akce: () => { dok.zpet(i + 1); obnov(); } })), { sirka: 220 }));
  };
  bPrizpusobit.onclick = () => rozbal(bPrizpusobit, nabidka([
    { nadpis: 'Přizpůsobit panel nástrojů Rychlý přístup' },
    { text: 'Nový', ikona: 'novy', akce: () => P.novy('prazdny') },
    { text: 'Otevřít', ikona: 'otevrit', akce: () => otevriZakulisi(P, 'otevrit') },
    { text: 'Uložit', ikona: 'ulozit', zaskrtnuto: true, akce: () => P.ulozit() },
    { text: 'Tisk', ikona: 'tisk', akce: () => otevriZakulisi(P, 'tisk') },
    { text: 'Zpět', ikona: 'zpet', zaskrtnuto: true, akce: () => { dok.zpet(); obnov(); } },
    { text: 'Znovu', ikona: 'znovu', zaskrtnuto: true, akce: () => { dok.znovu(); obnov(); } },
    'sep',
    { text: st.pasSkryty ? 'Zobrazit pás karet' : 'Skrýt pás karet', akce: () => prepniPas() },
  ], { sirka: 260 }));
  nazevDok.onclick = () => {
    const jmeno = el('input.ps-vstup', { value: st.nazev.replace(/\.[^.]+$/, '') });
    const obsah = el('div.ps-t-popover', {},
      el('b', { text: st.cesta ? 'Uloženo do: Tento počítač' : 'Tento dokument ještě není uložený' }),
      pole('Název souboru', jmeno),
      st.cesta ? el('div.ps-t-pop-umisteni', {}, el('span', { text: 'Umístění' }), el('div', {}, ik('slozka'), el('span', { text: FS.dirname(st.cesta).replace(FS.HOME, 'Domů') }))) : null,
      el('div.ps-nab-sep'),
      nabidka([{ text: 'Historie verzí', ikona: 'verze', akce: () => otevriZakulisi(P, 'informace') }]));
    jmeno.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); prejmenuj(jmeno.value.trim()); zavriRozbal(); dok.vratVyber(); }
    });
    rozbal(nazevDok, obsah);
    setTimeout(() => { jmeno.focus(); jmeno.select(); }, 30);
  };
  ucet.onclick = () => rozbal(ucet, el('div.ps-t-ucet-karta', {},
    el('div.ps-t-ucet-hlava', {}, el('span', { text: 'AstroOS' }), el('button.ps-zk-odkaz', { type: 'button', text: 'Odhlásit se', onclick: () => { zavriRozbal(); bus.emit('power', 'logout'); } })),
    el('div.ps-zk-autor.velky', {}, el('span.ps-avatar', { text: P.inicialy() }), el('div', {}, el('b', { text: P.autor() }), el('small', { text: 'Místní účet' }),
      el('button.ps-zk-odkaz', { type: 'button', text: 'Zobrazit účet', onclick: () => { zavriRozbal(); otevriZakulisi(P, 'ucet'); } })))), { zarovnat: 'vpravo' });

  // hledání příkazů (Microsoft Search)
  hledat.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { hledat.value = ''; hledat.blur(); dok.vratVyber(); zavriRozbal(); }
    if (e.key === 'Enter') hledatBox.parentNode && document.querySelector('.ps-hledani-vysledky .ps-nab-polozka')?.click();
  });
  hledat.addEventListener('input', () => ukazHledani());
  hledat.addEventListener('focus', () => ukazHledani());
  function ukazHledani() {
    const q = hledat.value.trim().toLocaleLowerCase('cs');
    const videne = new Set();
    const shody = (q ? P.prikazy.filter((p) => p.text.toLocaleLowerCase('cs').includes(q)) : P.prikazy.filter((p) => ['Tučné', 'Najít', 'Vložit tabulku…', 'Odrážky', 'Barva písma', 'Nový komentář', 'Počet slov'].includes(p.text)))
      .filter((p) => (videne.has(p.text) ? false : videne.add(p.text))).slice(0, 8);
    const polozky = [
      { nadpis: q ? 'Nejlepší výsledek' : 'Navrhované akce' },
      ...shody.map((p) => ({ text: p.text, ikona: p.ikona, klavesa: p.klavesa, akce: () => { hledat.value = ''; hledat.blur(); dok.vratVyber(); p.akce(); } })),
    ];
    if (q) polozky.push('sep', { text: `Najít „${hledat.value.trim()}“ v dokumentu`, ikona: 'najitMaly', akce: () => { const t = hledat.value.trim(); hledat.value = ''; P.podokno('navigace', { hledat: t }); } });
    if (q && !shody.length) polozky.splice(1, 0, { text: 'Žádné akce neodpovídají', zakazano: true });
    zavriRozbal();
    const u = rozbal(hledatBox, nabidka(polozky, { sirka: Math.max(320, hledatBox.offsetWidth) }));
    u?.classList.add('ps-hledani-vysledky');
  }

  // ------------------------------------------------------------ pás karet
  const kartyRadek = el('div.ps-karty');
  const pasTelo = el('div.ps-pas-telo');
  const pas = el('div.ps-pas', {}, kartyRadek, pasTelo);
  const obsahyKaret = postavKarty(P);
  const tlKaret = {};
  const soubor = el('button.ps-karta.soubor', { type: 'button', text: 'Soubor', onclick: () => otevriZakulisi(P, 'domu') });
  kartyRadek.append(soubor);
  for (const k of KARTY) {
    const b = el('button.ps-karta' + (k.kontext ? '.kontext' : ''), { type: 'button', text: k.nazev, dataset: { karta: k.id } });
    b.onclick = () => {
      if (st.pasSkryty) { pas.classList.add('docasne'); }
      prepniKartu(k.id);
    };
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('dblclick', () => prepniPas());
    tlKaret[k.id] = b;
    kartyRadek.append(b);
  }
  const bKomentare = el('button.ps-karta-tl', { type: 'button', title: 'Komentáře' }, ik('komentar'), el('span', { text: 'Komentáře' }));
  const bUpravy = el('button.ps-karta-tl', { type: 'button', title: 'Režim úprav' }, ik('tuzka'), el('span.ps-rezim-popis', { text: 'Úpravy' }), ik('sipkaDolu'));
  const bSdilet = el('button.ps-karta-tl.sdilet', { type: 'button', title: 'Sdílet' }, ik('sdilet'), el('span', { text: 'Sdílet' }), ik('sipkaDolu'));
  kartyRadek.append(el('div.ps-karty-mezera'), bKomentare, bUpravy, bSdilet);
  [bKomentare, bUpravy, bSdilet].forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
  bKomentare.onclick = () => P.podokno(st.podokno === 'komentare' ? null : 'komentare');
  bUpravy.onclick = () => rozbal(bUpravy, nabidka([
    { text: 'Úpravy', ikona: 'tuzka', zaskrtnuto: !st.jenCteni, akce: () => P.jenCteni(false) },
    { text: 'Revize', ikona: 'sledovat', zakazano: true },
    { text: 'Zobrazení', ikona: 'oko', zaskrtnuto: st.jenCteni, akce: () => P.jenCteni(true) },
  ], { sirka: 200 }), { zarovnat: 'vpravo' });
  bSdilet.onclick = () => otevriZakulisi(P, 'sdilet');

  const bPasMoznosti = el('button.ps-pas-moznosti', { type: 'button', title: 'Možnosti zobrazení pásu karet' }, ik('sipkaDolu'));
  bPasMoznosti.addEventListener('mousedown', (e) => e.preventDefault());
  bPasMoznosti.onclick = () => rozbal(bPasMoznosti, nabidka([
    { nadpis: 'Zobrazit pás karet' },
    { text: 'Režim na celou obrazovku', akce: () => P.zamereni(true) },
    { text: 'Zobrazit jen karty', zaskrtnuto: st.pasSkryty, akce: () => { if (!st.pasSkryty) prepniPas(); } },
    { text: 'Vždy zobrazovat pás karet', zaskrtnuto: !st.pasSkryty, akce: () => { if (st.pasSkryty) prepniPas(); } },
  ], { sirka: 240 }), { zarovnat: 'vpravo' });

  function prepniKartu(id) {
    st.karta = id;
    for (const [k, b] of Object.entries(tlKaret)) b.classList.toggle('aktivni', k === id);
    for (const o of Object.values(obsahyKaret)) o.classList.remove('aktivni');
    const o = obsahyKaret[id];
    o.classList.add('aktivni');
    pasTelo.replaceChildren(o, bPasMoznosti);
    obnov();
    prizpusob();
  }
  function prizpusob() {
    const o = obsahyKaret[st.karta];
    if (o && pasTelo.clientWidth) prizpusobKartu(o, pasTelo.clientWidth - 28);
  }
  function prepniPas() {
    st.pasSkryty = !st.pasSkryty;
    pas.classList.toggle('skryty', st.pasSkryty);
    pas.classList.remove('docasne');
  }

  // ------------------------------------------------------------ pracovní plocha
  const pravitkoH = el('canvas.ps-pravitko-h');
  const pravitkoV = el('canvas.ps-pravitko-v');
  const kresba = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  kresba.setAttribute('class', 'ps-kresba');
  dok.list.append(kresba);
  const uchyt = el('div.ps-uchyt-ram', { hidden: true }, ['nw', 'ne', 'sw', 'se'].map((r) => el('div.ps-uchyt.' + r, { dataset: { r } })));
  dok.list.append(uchyt);
  const listaKonecny = el('div.ps-lista-info', { hidden: true },
    el('b', { text: 'OZNAČENO JAKO KONEČNÉ' }),
    el('span', { text: 'Autor označil tento dokument jako konečný, aby se zabránilo úpravám.' }),
    el('button.ps-tlac', { type: 'button', text: 'Přesto upravit', onclick: () => P.jenCteni(false) }));
  const vnitrek = el('div.ps-plocha-vnitrek', {}, dok.obal);
  const plocha = el('div.ps-plocha', {}, vnitrek);
  const podoknoL = el('aside.ps-podokno.vlevo', { hidden: true });
  const podoknoP = el('aside.ps-podokno.vpravo', { hidden: true });
  const stred = el('div.ps-stred', {}, podoknoL, el('div.ps-plocha-ram', {}, pravitkoH, pravitkoV, listaKonecny, plocha), podoknoP);

  // ------------------------------------------------------------ stavový řádek
  const sStrana = el('button.ps-s-pol', { type: 'button', title: 'Číslo stránky v dokumentu. Kliknutím otevřete Přejít na.' });
  const sSlova = el('button.ps-s-pol', { type: 'button', title: 'Počet slov v dokumentu. Kliknutím otevřete Počet slov.' });
  const sKontrola = el('button.ps-s-pol.ikona', { type: 'button', title: 'Kontrola pravopisu a gramatiky' }, ik('kontrola'));
  const sJazyk = el('button.ps-s-pol', { type: 'button', text: 'čeština', title: 'Jazyk' });
  const sPredpovedi = el('button.ps-s-pol', { type: 'button', text: 'Předpovědi textu: Zapnuto' });
  const sPristupnost = el('button.ps-s-pol', { type: 'button', title: 'Kontrola přístupnosti' }, ik('pristupnost'), el('span', { text: 'Přístupnost: Vše je v pořádku' }));
  const sZamereni = el('button.ps-s-pol', { type: 'button', title: 'Zaměření' }, ik('zamereni'), el('span', { text: 'Zaměření' }));
  const sRezimy = ['cteni', 'tisk', 'web'].map((r) => el('button.ps-s-rezim', {
    type: 'button', dataset: { r }, title: { cteni: 'Režim čtení', tisk: 'Rozložení při tisku', web: 'Rozložení pro web' }[r], onclick: () => P.rezim(r),
  }, ik({ cteni: 'rezimCteni', tisk: 'rozlozeniTisk', web: 'rozlozeniWeb' }[r])));
  const zoomPosuvnik = el('input.ps-s-zoom', { type: 'range', min: 0, max: 100, step: 1, value: 50, title: 'Lupa' });
  const zoomText = el('button.ps-s-pol.zoom-proc', { type: 'button', title: 'Úroveň lupy. Kliknutím otevřete dialog Lupa.' });
  const stavovy = el('footer.ps-stav', {},
    el('div.ps-s-levo', {}, sStrana, sSlova, sKontrola, sJazyk, sPredpovedi, sPristupnost),
    el('div.ps-s-pravo', {}, sZamereni, el('div.ps-s-rezimy', {}, sRezimy),
      el('button.ps-s-pm', { type: 'button', text: '−', title: 'Oddálit', onclick: () => P.lupa(Math.max(0.1, +(dok.meritko - 0.1).toFixed(2))) }),
      zoomPosuvnik,
      el('button.ps-s-pm', { type: 'button', text: '+', title: 'Přiblížit', onclick: () => P.lupa(Math.min(5, +(dok.meritko + 0.1).toFixed(2))) }),
      zoomText));
  stavovy.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
  sStrana.onclick = () => D.dialogNahradit(P, 'prejit');
  sSlova.onclick = () => D.dialogPocetSlov(P);
  sKontrola.onclick = () => P.podokno('editor');
  sPristupnost.onclick = () => P.podokno('pristupnost');
  sZamereni.onclick = () => P.zamereni(true);
  sPredpovedi.onclick = () => zprava(koren, 'Předpovědi textu navrhují další slova při psaní. V AstroPísmu je nabízí AstroAI na kartě Domů.');
  sJazyk.onclick = () => rozbal(sJazyk, nabidka(['cs', 'sk', 'en', 'de'].map((l) => ({
    text: { cs: 'čeština', sk: 'slovenština', en: 'angličtina', de: 'němčina' }[l], zaskrtnuto: dok.ed.lang === l,
    akce: () => { dok.ed.lang = l; obnov(); },
  }))), { nad: true });
  const zoomNaHodnotu = (v) => (v <= 50 ? 0.1 + (v / 50) * 0.9 : 1 + ((v - 50) / 50) * 4);
  const hodnotaZoomu = (z) => (z <= 1 ? ((z - 0.1) / 0.9) * 50 : 50 + ((z - 1) / 4) * 50);
  zoomPosuvnik.oninput = () => { const v = +zoomPosuvnik.value; P.lupa(Math.abs(v - 50) < 3 ? 1 : +zoomNaHodnotu(v).toFixed(2)); };
  zoomText.onclick = () => D.dialogLupa(P);

  koren.append(pas, stred, stavovy);
  body.append(koren);

  // ------------------------------------------------------------ obnova UI
  let obnovaCeka = 0;
  function planujObnovu() {
    if (obnovaCeka) return;
    obnovaCeka = requestAnimationFrame(() => { obnovaCeka = 0; obnov(); });
  }

  function spocitejStav() {
    const e = dok.prvekKurzoru();
    if (!e || !dok.ed.contains(e)) return { velikost: 12, pismoPopis: 'Aptos (Základní text)' };
    const cs = getComputedStyle(e);
    const blok = dok.blokKurzoru();
    const rodina = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const explicitni = e.closest('[style*="font-family"]');
    const nadpis = blok?.matches('h1, h2, h3, h4, h5');
    const pismoPopis = explicitni && dok.ed.contains(explicitni) && explicitni !== dok.ed ? rodina : `${rodina} (${nadpis ? 'Nadpisy' : 'Základní text'})`;
    const bcs = blok ? getComputedStyle(blok) : cs;
    const zar = bcs.textAlign === 'start' || bcs.textAlign === '-webkit-left' ? 'left' : bcs.textAlign === 'end' ? 'right' : bcs.textAlign.replace('-webkit-', '');
    const q = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    const lh = (parseFloat(bcs.lineHeight) / parseFloat(bcs.fontSize)) / 1.17;
    const tag = blok?.tagName.toLowerCase();
    return {
      pismoPopis, rodina,
      velikost: Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2,
      tucne: q('bold') || +cs.fontWeight >= 600, kurziva: q('italic'), podtrzeni: q('underline'),
      barva: rgbNaHex(cs.color),
      zarovnani: zar,
      styl: STYLY.some((s) => s.id === tag) ? tag : null,
      seznam: blok?.closest('ul, ol')?.tagName || null,
      radkovani: [1, 1.15, 1.5, 2, 2.5, 3].reduce((a, v) => (Math.abs(v - lh) < Math.abs(a - lh) ? v : a), 1.15),
      tabulka: !!e.closest('table'),
    };
  }

  function obnov() {
    if (!koren.isConnected) return;
    if (document.activeElement === dok.ed || !P.stav.velikost) P.stav = spocitejStav();
    for (const s of P.stavy) {
      let z = false;
      try { z = s.fn(); } catch { /* bez výběru */ }
      if (z !== null) s.uzel.classList.toggle('zapnuto', !!z);
    }
    for (const f of P.obnovy) { try { f(); } catch { /* bez výběru */ } }
    // kontextové karty
    const kontext = { tabulka: !!P.tabulka(), obrazek: !!st.obrazek, zahlavi: !!st.zahlavi };
    for (const k of KARTY) {
      if (!k.kontext) continue;
      const vid = !!kontext[k.kontext];
      tlKaret[k.id].hidden = !vid;
      if (!vid && st.karta === k.id) prepniKartu(k.kontext === 'zahlavi' ? 'vlozeni' : 'domu');
    }
    obnovZpet();
    obnovStav();
  }
  P.obnov = obnov;

  function obnovZpet() {
    bZpet.disabled = !dok.muzeZpet;
    bZpet.title = dok.muzeZpet ? `Zpět: ${dok.popisZpet || 'Úprava'} (Ctrl+Z)` : 'Nelze vrátit zpět';
    bZnovu.disabled = !dok.muzeZnovu;
  }

  let slovaCeka = 0;
  function obnovStav() {
    sStrana.textContent = `Stránka ${dok.stranaKurzoru()} z ${dok.pocetStran}`;
    clearTimeout(slovaCeka);
    slovaCeka = setTimeout(() => {
      const vyb = dok.vybranyText;
      const vse = dok.statistika().slova;
      sSlova.textContent = vyb ? `${dok.statistika(true).slova} z ${vse} slov` : `${vse.toLocaleString('cs-CZ')} ${vse === 1 ? 'slovo' : vse >= 2 && vse <= 4 ? 'slova' : 'slov'}`;
    }, 120);
    sJazyk.textContent = { cs: 'čeština', sk: 'slovenština', en: 'angličtina (Spojené státy)', de: 'němčina' }[dok.ed.lang] || 'čeština';
    sRezimy.forEach((b) => b.classList.toggle('aktivni', b.dataset.r === st.rezim));
    zoomText.textContent = Math.round(dok.meritko * 100) + ' %';
    if (document.activeElement !== zoomPosuvnik) zoomPosuvnik.value = String(hodnotaZoomu(dok.meritko));
    const bezAlt = dok.ed.querySelectorAll('img:not([alt]), img[alt=""]').length;
    sPristupnost.lastChild.textContent = bezAlt ? 'Přístupnost: Prozkoumat' : 'Přístupnost: Vše je v pořádku';
    bKomentare.classList.toggle('aktivni', st.podokno === 'komentare');
    koren.querySelector('.ps-rezim-popis').textContent = st.jenCteni ? 'Zobrazení' : 'Úpravy';
  }

  function obnovTitulek() {
    const jmeno = st.nazev.replace(/\.docx$/i, '');
    nazevDok.querySelector('.ps-t-jmeno').textContent = jmeno;
    nazevDok.querySelector('.ps-t-stav').textContent = st.ukladani ? ' • Ukládání…' : st.cesta && !st.dirty ? ' • Uloženo do tohoto počítače' : st.cesta ? ' • Uloženo' : '';
    if (st.cesta && st.dirty && !st.autoUkladani) nazevDok.querySelector('.ps-t-stav').textContent = '';
    prepinac.classList.toggle('zapnuto', st.autoUkladani);
    prepinac.setAttribute('aria-checked', String(st.autoUkladani));
    prepinac.querySelector('.ps-auto-text').textContent = st.autoUkladani ? 'Zap' : 'Vyp';
    win.title = `${jmeno} – AstroPísmo`;
    ucet.querySelector('.ps-t-ucet-jmeno').textContent = P.autor();
    ucet.querySelector('.ps-avatar').textContent = P.inicialy();
  }

  let autoCeka = 0;
  function zmena() {
    if (!st.otevreno) return;
    if (!st.dirty) { st.dirty = true; obnovTitulek(); }
    clearTimeout(autoCeka);
    if (st.autoUkladani && st.cesta) autoCeka = setTimeout(() => P.ulozit({ tise: true }), 1500);
    planujObnovu();
    if (st.podoknoVlevo !== 'navigace') zrusZvyrazneni();
    if (st.podoknoVlevo === 'navigace') planujNavigaci();
    if (st.podokno === 'komentare') planujKomentare();
  }

  // ------------------------------------------------------------ nastavení a motiv
  P.nastaveni = nast;
  P.ulozNastaveni = (o) => {
    State.set('pismo', { ...nast(), ...o });
    if ('motiv' in o) P.nastavMotiv(o.motiv, false);
    if ('znacky' in o && o.znacky !== st.znacky) P.prepniZnacky();
    if ('pravitko' in o) P.pravitko(o.pravitko);
    obnovTitulek();
  };
  P.autor = () => nast().jmeno || State.get('user')?.name || 'Uživatel';
  P.inicialy = () => nast().inicialy || P.autor().split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  P.nastavMotiv = (m, uloz = true) => {
    if (uloz) State.set('pismo', { ...nast(), motiv: m });
    const sys = document.documentElement.dataset.motiv === 'svetly' ? 'barevny' : 'cerny';
    koren.dataset.motiv = m === 'system' ? sys : m || 'barevny';
    win.node.dataset.psMotiv = koren.dataset.motiv;
  };
  P.nastavMotiv(nast().motiv || 'barevny', false);
  const motivSledovac = new MutationObserver(() => { if ((nast().motiv || 'barevny') === 'system') P.nastavMotiv('system', false); });
  motivSledovac.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motiv'] });

  function aplikujNastDok() {
    const n = dok.nast;
    const ed = dok.ed;
    for (const k of [...ed.style]) if (k.startsWith('--ps-')) ed.style.removeProperty(k);
    for (const [k, v] of Object.entries(promenneDokumentu(n))) ed.style.setProperty(k, v);
    ed.style.hyphens = n.deleni ? 'auto' : '';
    dok.prekresli();
    kresliKresbu();
    obnovObsahyNavrhu();
  }
  function obnovObsahyNavrhu() { planujObnovu(); }

  P.nastavStranku = (zmeny, popis) => {
    if (st.jenCteni) return hlaskaJenCteni();
    dok.dokonciPsani();
    Object.assign(dok.nast, zmeny);
    aplikujNastDok();
    dok.zaznam(popis);
    zmena();
    obnov();
    kresliPravitka();
  };

  // ------------------------------------------------------------ soubory
  P.nedavne = () => (State.get('pismoNedavne') || []).filter((c) => FS.exists(c));
  function pridejNedavne(c) {
    State.set('pismoNedavne', [c, ...(State.get('pismoNedavne') || []).filter((x) => x !== c)].slice(0, 25));
  }

  function nactiDoEditoru(html, nastDok, { cesta = null, nazev, meta = {} } = {}) {
    dok.nacti(html, nastDok);
    st.cesta = cesta;
    st.typ = cesta ? (cesta.match(/\.([^.]+)$/)?.[1] || 'docx').toLowerCase() : 'docx';
    st.nazev = nazev || (cesta ? FS.basename(cesta) : `Dokument${++citacDokumentu}`);
    st.meta = { vytvoreno: Date.now(), autor: P.autor(), ...meta };
    st.dirty = false;
    st.otevreno = true;
    st.otevrenoOd = Date.now();
    st.obrazek = null;
    st.jenCteni = false;
    st.autoUkladani = !!nast().autoUkladani && !!cesta;
    dok.ed.contentEditable = 'true';
    listaKonecny.hidden = true;
    P.zavriZakulisi?.();
    aplikujNastDok();
    dok.zaznam('Otevřít');
    obnovTitulek();
    zobrazUchyt(null);
    setTimeout(() => {
      dok.ed.focus({ preventScroll: true });
      const r = document.createRange();
      r.selectNodeContents(dok.ed.firstElementChild || dok.ed);
      r.collapse(true);
      dok.nastavRozsah(r);
      plocha.scrollTop = 0;
      obnov();
      prizpusob();
    }, 30);
    if (st.podokno) P.podokno(st.podokno);
    if (st.podoknoVlevo === 'navigace') kresliNavigaci();
  }

  P.novy = async (id = 'prazdny') => {
    if (!(await zeptejSeNaUlozeni())) return;
    const s = SABLONY.find((x) => x.id === id) || SABLONY[0];
    nactiDoEditoru(s.html(P.autor()), s.nast || {}, {});
    if (id !== 'prazdny') dok.kurzorNaKonec();
  };

  P.otevri = async (cesta) => {
    if (cesta === st.cesta && st.otevreno) { P.zavriZakulisi?.(); return; }
    if (!(await zeptejSeNaUlozeni())) return;
    let text;
    try { text = FS.read(cesta); } catch (e) { zprava(koren, `Soubor se nepodařilo otevřít.\n${e.message}`); return; }
    const d = rozeber(text);
    if (/\.html?$/i.test(cesta)) {
      const t = document.createElement('template');
      t.innerHTML = text;
      d.html = (t.content.querySelector('body') || t.content).innerHTML || d.html;
    }
    if (/\.md$/i.test(cesta)) d.html = mdNaHtml(text);
    nactiDoEditoru(d.html, d.nast, { cesta, meta: d.meta });
    pridejNedavne(cesta);
  };

  P.otevritZeZarizeni = () => {
    const vstup = el('input', { type: 'file', accept: '.docx,.txt,.md,.html,.htm' });
    vstup.onchange = async () => {
      const f = vstup.files[0];
      if (!f) return;
      if (/\.docx$/i.test(f.name) && !(await f.slice(0, 1).text()).startsWith('{')) {
        zprava(koren, 'Tenhle soubor je skutečný dokument Microsoft Word (ZIP). AstroPísmo umí otevřít jen svoje dokumenty, text, Markdown a HTML.');
        return;
      }
      const text = await f.text();
      const cil = FS.join(FS.HOME + '/Dokumenty', FS.freeName(FS.HOME + '/Dokumenty', f.name));
      try { FS.write(cil, text); } catch (e) { zprava(koren, e.message); return; }
      P.otevri(cil);
    };
    vstup.click();
  };

  function zeptejSeNaUlozeni() {
    return new Promise((hotovo) => {
      if (!st.otevreno || !st.dirty || (!st.cesta && !dok.text.trim() && !dok.ed.querySelector('img, table'))) return hotovo(true);
      dialog(koren, {
        titulek: 'AstroPísmo', sirka: 440,
        obsah: el('div.ps-ulozit-dotaz', {}, el('div.ps-t-logo.velke', {}, el('span', { text: 'P' })),
          el('p', { text: `Chcete uložit změny do souboru „${st.nazev}“?` })),
        tlacitka: [
          { text: 'Uložit', primarni: true, akce: () => { if (st.cesta) { hotovo(P.ulozit()); } else rychleUlozeni(() => hotovo(true), () => hotovo(false)); } },
          { text: 'Neukládat', akce: () => hotovo(true) },
          { text: 'Zrušit', akce: () => hotovo(false) },
        ],
        pri_zavreni: () => {},
      });
    });
  }

  P.muzeZavrit = () => {
    if (st.zavrit) return true;
    zeptejSeNaUlozeni().then((ok) => { if (ok) { st.zavrit = true; win.close(); } });
    return false;
  };

  function obsahSouboru(typ) {
    if (typ === 'txt') return htmlNaText(dok.html);
    if (typ === 'md') return htmlNaMd(dok.html);
    if (typ === 'html' || typ === 'htm') return exportHtml();
    return serializuj(dok.html, dok.nast, { ...st.meta, zmeneno: Date.now() });
  }

  P.ulozitDo = (cesta, typ = 'docx') => {
    // ukázková verze: ukládá jen ve formátu AstroPísma, export (HTML, text…) je v plné verzi
    if (typ !== 'docx') { zprava(koren, `Export do ${typ.toUpperCase()} je jen v plné verzi AstroOS. Dokument můžeš uložit jako .docx.`, 'AstroPísmo'); return false; }
    try {
      FS.write(cesta, obsahSouboru(typ));
    } catch (e) {
      zprava(koren, `Dokument se nepodařilo uložit.\n\n${e.message}`, 'AstroPísmo');
      return false;
    }
    st.cesta = cesta;
    st.typ = typ;
    st.nazev = FS.basename(cesta);
    st.dirty = false;
    pridejNedavne(cesta);
    obnovTitulek();
    return true;
  };

  P.ulozit = ({ tise = false } = {}) => {
    dok.dokonciPsani();
    if (!st.cesta) { rychleUlozeni(); return false; }
    st.ukladani = true;
    obnovTitulek();
    const ok = P.ulozitDo(st.cesta, st.typ);
    setTimeout(() => { st.ukladani = null; obnovTitulek(); }, tise ? 400 : 250);
    return ok;
  };

  /** Malý dialog „Uložit tento soubor“ jako v novém Wordu. */
  function rychleUlozeni(poUlozeni, poZruseni) {
    const vychozi = nast().umisteni || FS.HOME + '/Dokumenty';
    const jmeno = el('input.ps-vstup', { value: prvniRadek() || st.nazev.replace(/\.[^.]+$/, '') });
    const mista = [[vychozi, 'Dokumenty'], [FS.HOME + '/Plocha', 'Plocha'], [FS.HOME, 'Domovská složka']];
    const kam = el('select.ps-vyber', {}, mista.filter((m, i, a) => FS.exists(m[0]) && a.findIndex((x) => x[0] === m[0]) === i).map(([c, t]) => el('option', { value: c, text: `${t}  ·  ${c.replace(FS.HOME, '~')}` })));
    let hotovo = false;
    dialog(koren, {
      titulek: 'Uložit tento soubor', sirka: 460, cls: 'ps-rychle-ulozeni',
      obsah: el('div', {}, pole('Název souboru', jmeno), pole('Zvolit umístění', kam),
        el('button.ps-zk-odkaz', { type: 'button', text: 'Další možnosti uložení…', onclick: (e) => { e.currentTarget.closest('.ps-kryt').remove(); otevriZakulisi(P, 'ulozitJako'); } })),
      tlacitka: [
        {
          text: 'Uložit', primarni: true, akce: () => {
            const n = jmeno.value.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\.docx$/i, '');
            if (!n) return false;
            const c = FS.join(kam.value, FS.exists(FS.join(kam.value, n + '.docx')) ? FS.freeName(kam.value, n + '.docx') : n + '.docx');
            if (P.ulozitDo(c, 'docx')) { hotovo = true; toast({ title: 'Uloženo', body: c.replace(FS.HOME, '~'), icon: 'check', timeout: 2200 }); poUlozeni?.(); }
          },
        },
        { text: 'Zrušit' },
      ],
      pri_zavreni: () => { if (!hotovo) poZruseni?.(); dok.vratVyber(); },
    });
    setTimeout(() => jmeno.select(), 40);
  }

  const prvniRadek = () => (dok.ed.firstElementChild?.textContent || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 40);

  function prejmenuj(nove) {
    nove = nove.replace(/[\\/:*?"<>|]/g, '');
    if (!nove) return;
    if (!st.cesta) { st.nazev = nove; obnovTitulek(); return; }
    const pripona = st.cesta.match(/\.[^.]+$/)?.[0] || '.docx';
    try {
      FS.rename(st.cesta, nove + pripona);
      const nova = FS.join(FS.dirname(st.cesta), nove + pripona);
      State.set('pismoNedavne', (State.get('pismoNedavne') || []).map((c) => (c === st.cesta ? nova : c)));
      st.cesta = nova;
      st.nazev = nove + pripona;
      obnovTitulek();
    } catch (e) { zprava(koren, e.message); }
  }

  P.zavritDokument = async () => {
    if (!(await zeptejSeNaUlozeni())) return;
    st.otevreno = false;
    st.dirty = false;
    st.cesta = null;
    dok.nacti('<p><br></p>', {});
    otevriZakulisi(P, 'domu');
  };

  P.toast = (t) => toast({ title: 'AstroPísmo', body: t, icon: 'check', timeout: 2400 });
  P.otevriAplikaci = (id, o) => openApp(id, o);

  // ------------------------------------------------------------ export a tisk
  function exportHtml() {
    const v = promenneDokumentu(dok.nast);
    const styl = Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';');
    const g = dok.g;
    const telo = dok.html.replace(/<hr class="ps-zlom"[^>]*>/g, '<div style="break-after:page"></div>');
    return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<title>${esc(st.nazev.replace(/\.[^.]+$/, ''))}</title>
<style>
@page { size: ${(g.w / MM).toFixed(1)}mm ${(g.h / MM).toFixed(1)}mm; margin: ${(g.mt / MM).toFixed(1)}mm ${(g.mr / MM).toFixed(1)}mm ${(g.mb / MM).toFixed(1)}mm ${(g.ml / MM).toFixed(1)}mm; }
body { margin: 0; background: ${dok.nast.barvaStranky || '#fff'}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { body { padding: 40px; } .ps-obsah { max-width: ${Math.round(g.sirka)}px; margin: 0 auto; } }
${cssObsahu.split('/* === OBSAH === */')[1]?.split('/* === KONEC OBSAHU === */')[0] || ''}
</style>
</head>
<body>
<div class="ps-obsah" style="${styl}">
${telo}
</div>
</body>
</html>
`;
  }

  P.tiskni = () => {
    const f = el('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0', right: '0', bottom: '0' } });
    document.body.append(f);
    f.contentDocument.open();
    f.contentDocument.write(exportHtml());
    f.contentDocument.close();
    st.meta.tisk = Date.now();
    setTimeout(() => {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { zprava(koren, 'Tisk se nepodařilo spustit: ' + e.message); }
      setTimeout(() => f.remove(), 1500);
    }, 250);
  };

  P.exportWeb = () => {
    const slozka = st.cesta ? FS.dirname(st.cesta) : FS.HOME + '/Dokumenty';
    const zaklad = st.nazev.replace(/\.[^.]+$/, '');
    const c = FS.join(slozka, zaklad + '.html');
    try { FS.write(c, exportHtml()); } catch (e) { zprava(koren, e.message); return; }
    openApp('browser', { url: 'file://' + c });
  };

  // ------------------------------------------------------------ úpravy textu
  P.vlozit = async (jenText) => {
    if (st.jenCteni) return hlaskaJenCteni();
    try {
      if (!jenText && navigator.clipboard.read) {
        const polozky = await navigator.clipboard.read();
        for (const p of polozky) {
          const obr = p.types.find((t) => t.startsWith('image/'));
          if (obr) { const blob = await p.getType(obr); vlozSouborObrazku(blob); return; }
          if (p.types.includes('text/html')) {
            const html = await (await p.getType('text/html')).text();
            P.prikaz(() => document.execCommand('insertHTML', false, vycistiVlozene(html)), 'Vložit');
            return;
          }
        }
      }
      const t = await navigator.clipboard.readText();
      P.prikaz(() => document.execCommand('insertText', false, t), 'Vložit');
    } catch {
      zprava(koren, 'Prohlížeč nedovolil přečíst schránku. Vložte obsah klávesami Ctrl+V.');
    }
  };

  function vycistiVlozene(html) {
    const t = document.createElement('template');
    t.innerHTML = vycisti(html.replace(/<!--[\s\S]*?-->/g, ''));
    t.content.querySelectorAll('[class]').forEach((n) => { if (!/\bps-/.test(n.className)) n.removeAttribute('class'); });
    t.content.querySelectorAll('[style]').forEach((n) => { n.style.removeProperty('background-color'); if (n.style.color === 'rgb(0, 0, 0)') n.style.removeProperty('color'); });
    return t.innerHTML;
  }

  dok.ed.addEventListener('paste', (e) => {
    if (st.jenCteni) { e.preventDefault(); return; }
    const cd = e.clipboardData;
    if (!cd) return;
    const soubor = [...cd.files].find((f) => f.type.startsWith('image/'));
    e.preventDefault();
    if (soubor) return vlozSouborObrazku(soubor);
    const html = cd.getData('text/html');
    if (html) P.prikaz(() => document.execCommand('insertHTML', false, vycistiVlozene(html)), 'Vložit');
    else P.prikaz(() => document.execCommand('insertText', false, cd.getData('text/plain')), 'Vložit');
  });
  const zapamatujSchranku = () => { const t = getSelection().toString(); if (t) st.schranka = [t, ...st.schranka.filter((x) => x !== t)].slice(0, 24); if (st.podokno === 'schranka') P.podokno('schranka'); };
  dok.ed.addEventListener('copy', zapamatujSchranku);
  dok.ed.addEventListener('cut', () => { zapamatujSchranku(); setTimeout(() => { dok.zaznam('Vyjmout'); zmena(); }); });

  // kopírovat formát
  P.stetec = () => {
    if (st.stetec) { st.stetec = null; koren.classList.remove('ps-stetec'); obnov(); return; }
    const e = dok.prvekKurzoru();
    if (!e) return;
    const cs = getComputedStyle(e);
    const bg = e.closest('[style*="background"]');
    st.stetec = {
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
      textDecoration: cs.textDecorationLine === 'none' ? 'none' : `${cs.textDecorationLine} ${cs.textDecorationStyle}`,
      color: cs.color, backgroundColor: bg && dok.ed.contains(bg) && !bg.matches(BLOKY) ? getComputedStyle(bg).backgroundColor : 'transparent',
    };
    koren.classList.add('ps-stetec');
    obnov();
  };
  const BLOKY = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, div';
  dok.ed.addEventListener('mouseup', () => {
    if (!st.stetec) return;
    setTimeout(() => {
      if (!dok.vybranyText) return;
      const f = st.stetec;
      st.stetec = null;
      koren.classList.remove('ps-stetec');
      P.prikaz(() => dok.obalVyber((s) => Object.assign(s.style, f)), 'Kopírovat formát');
    });
  });

  P.prepniZnacky = () => {
    st.znacky = !st.znacky;
    koren.classList.toggle('ps-znacky', st.znacky);
    obnov();
  };
  koren.classList.toggle('ps-znacky', st.znacky);

  // vložení bloků za aktuální blok nejvyšší úrovně
  function blokNejvys(n) {
    while (n && n.parentNode !== dok.ed) n = n.parentNode;
    return n;
  }
  function vlozBlokyZa(html, { nahradPrazdny = true } = {}) {
    const b = blokNejvys(dok.prvekKurzoru()) || dok.ed.lastElementChild;
    const t = document.createElement('template');
    t.innerHTML = html;
    const uzly = [...t.content.childNodes];
    if (b && nahradPrazdny && !b.textContent.trim() && !b.querySelector('img, table, hr') && b.matches('p, div')) b.replaceWith(...uzly);
    else if (b) b.after(...uzly);
    else dok.ed.append(...uzly);
    return uzly;
  }
  function kurzorDo(uzel, naKonec = false) {
    const r = document.createRange();
    r.selectNodeContents(uzel);
    r.collapse(!naKonec);
    dok.nastavRozsah(r);
  }

  P.konecStranky = () => P.prikaz(() => {
    const r = dok.aktualniRozsah();
    if (!r) return;
    r.deleteContents();
    const b = blokNejvys(dok.prvekKurzoru());
    const hr = el('hr.ps-zlom', { contenteditable: 'false' });
    if (b && b.matches('p, h1, h2, h3, h4, h5, h6, div, blockquote')) {
      const r2 = document.createRange();
      r2.setStart(r.startContainer, r.startOffset);
      r2.setEnd(b, b.childNodes.length);
      const zbytek = r2.extractContents();
      const nb = document.createElement(b.tagName === 'H5' || b.tagName === 'H6' ? 'p' : b.tagName);
      nb.append(zbytek);
      if (!nb.textContent && !nb.querySelector('img')) nb.innerHTML = '<br>';
      if (!b.textContent && !b.querySelector('img')) b.innerHTML = '<br>';
      b.after(hr, nb);
      kurzorDo(nb);
    } else {
      const p = el('p', { html: '<br>' });
      (b || dok.ed.lastElementChild).after(hr, p);
      kurzorDo(p);
    }
  }, 'Konec stránky');

  P.prazdnaStrana = () => P.prikaz(() => {
    const [, p] = vlozBlokyZa('<hr class="ps-zlom" contenteditable="false"><p><br></p><hr class="ps-zlom" contenteditable="false">', { nahradPrazdny: false });
    kurzorDo(p);
  }, 'Prázdná stránka');

  P.titulniStrana = (typ) => P.prikaz(() => {
    const vys = Math.floor(dok.g.vyska - 4);
    const datum = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
    const nazev = esc(st.nazev.replace(/\.[^.]+$/, '').replace(/^Dokument\d+$/, 'Název dokumentu'));
    const html = `<div class="ps-titulni ps-titulni-${typ}" style="height:${vys}px"><h5>${nazev}</h5><h6>Podtitul dokumentu</h6><div class="ps-titulni-pata">${esc(P.autor())}<br>${datum}</div></div><hr class="ps-zlom" contenteditable="false">`;
    const t = document.createElement('template');
    t.innerHTML = html;
    dok.ed.querySelector(':scope > .ps-titulni')?.nextElementSibling?.matches('hr.ps-zlom') && dok.ed.querySelector(':scope > .ps-titulni').nextElementSibling.remove();
    dok.ed.querySelector(':scope > .ps-titulni')?.remove();
    dok.ed.prepend(...t.content.childNodes);
    kurzorDo(dok.ed.querySelector('.ps-titulni h5'), true);
    plocha.scrollTop = 0;
  }, 'Titulní stránka');

  // ------------------------------------------------------------ tabulky
  P.tabulka = () => {
    const e = dok.prvekKurzoru();
    const t = e?.closest?.('table');
    return t && dok.ed.contains(t) ? t : null;
  };
  P.vybraneBunky = () => {
    const t = P.tabulka();
    if (!t) return [];
    const r = dok.aktualniRozsah();
    const bunky = [...t.querySelectorAll('td, th')].filter((c) => { try { return r.intersectsNode(c); } catch { return false; } });
    return bunky.length ? bunky : [dok.prvekKurzoru().closest('td, th')].filter(Boolean);
  };
  P.vlozTabulku = (radky, sloupce) => P.prikaz(() => {
    const radek = `<tr>${'<td><br></td>'.repeat(sloupce)}</tr>`;
    const [t] = vlozBlokyZa(`<table class="ps-tab ps-tab-mrizka"><tbody>${radek.repeat(radky)}</tbody></table><p><br></p>`);
    kurzorDo(t.querySelector('td'));
  }, 'Vložit tabulku');
  P.textNaTabulku = () => P.prikaz(() => {
    const bloky = dok.vybraneBloky().filter((b) => b.parentNode === dok.ed);
    if (!bloky.length) return;
    const radky = bloky.map((b) => b.textContent.split(/\t|;|,/).map((x) => x.trim()));
    const s = Math.max(...radky.map((r) => r.length));
    const t = el('table.ps-tab.ps-tab-mrizka', {}, el('tbody', {}, radky.map((r) => el('tr', {}, Array.from({ length: s }, (_, i) => el('td', { text: r[i] || '' }))))));
    bloky[0].before(t);
    bloky.forEach((b) => b.remove());
  }, 'Převést text na tabulku');
  P.stylTabulky = (cls) => P.prikaz(() => {
    const t = P.tabulka();
    if (!t) return;
    Object.keys(STYLY_TABULKY).forEach((c) => t.classList.remove(c));
    t.classList.add(cls);
  }, 'Styl tabulky');
  P.vyberTabulky = (co) => {
    const t = P.tabulka();
    if (!t) return;
    const c = dok.prvekKurzoru().closest('td, th');
    const r = document.createRange();
    if (co === 'tabulka') r.selectNode(t);
    else if (co === 'radek') r.selectNodeContents(c.parentElement);
    else r.selectNodeContents(c);
    dok.nastavRozsah(r);
    obnov();
  };
  P.upravTabulku = (op) => P.prikaz(() => {
    const t = P.tabulka();
    if (!t) return;
    const c = dok.prvekKurzoru().closest('td, th');
    const tr = c.parentElement;
    const i = [...tr.cells].indexOf(c);
    const prazdna = () => el('td', { html: '<br>' });
    if (op === 'radekNad' || op === 'radekPod') {
      const n = el('tr', {}, [...tr.cells].map(() => prazdna()));
      if (op === 'radekNad') tr.before(n); else tr.after(n);
      kurzorDo(n.cells[Math.min(i, n.cells.length - 1)]);
    }
    if (op === 'sloupecVlevo' || op === 'sloupecVpravo') {
      for (const r of t.rows) {
        const ref = r.cells[Math.min(i, r.cells.length - 1)];
        if (op === 'sloupecVlevo') ref.before(prazdna()); else ref.after(prazdna());
      }
    }
    if (op === 'smazRadek') {
      const dalsi = tr.nextElementSibling || tr.previousElementSibling;
      tr.remove();
      if (!t.rows.length) { const p = el('p', { html: '<br>' }); t.replaceWith(p); kurzorDo(p); } else kurzorDo(dalsi.cells[0]);
    }
    if (op === 'smazSloupec') {
      for (const r of t.rows) r.cells[Math.min(i, r.cells.length - 1)]?.remove();
      if (!t.rows[0]?.cells.length) { const p = el('p', { html: '<br>' }); t.replaceWith(p); kurzorDo(p); } else kurzorDo(t.rows[0].cells[Math.max(0, i - 1)]);
    }
    if (op === 'smazTabulku') { const p = el('p', { html: '<br>' }); t.replaceWith(p); kurzorDo(p); }
    if (op === 'sloucit') {
      const bunky = P.vybraneBunky().filter((x) => x.parentElement === tr);
      if (bunky.length < 2) return;
      const prvni = bunky[0];
      let span = prvni.colSpan;
      for (const b of bunky.slice(1)) {
        if (b.textContent.trim()) prvni.append(' ', ...b.childNodes);
        span += b.colSpan;
        b.remove();
      }
      prvni.colSpan = span;
      kurzorDo(prvni, true);
    }
    if (op === 'rozdelit') {
      const idx = [...t.rows].indexOf(tr);
      if (idx <= 0) return;
      const nova = t.cloneNode(false);
      const tb = el('tbody');
      nova.append(tb);
      [...t.rows].slice(idx).forEach((r) => tb.append(r));
      const p = el('p', { html: '<br>' });
      t.after(p, nova);
      kurzorDo(p);
    }
  }, 'Úprava tabulky');

  // ------------------------------------------------------------ obrázky
  function zmensiObrazek(soubor) {
    return new Promise((hotovo, chyba) => {
      const url = URL.createObjectURL(soubor);
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = el('canvas', { width: Math.round(img.width * k), height: Math.round(img.height * k) });
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        hotovo({ src: soubor.type === 'image/png' && soubor.size < 300000 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85), w: c.width });
      };
      img.onerror = () => { URL.revokeObjectURL(url); chyba(new Error('Obrázek nejde načíst.')); };
      img.src = url;
    });
  }
  async function vlozSouborObrazku(soubor) {
    try {
      const { src, w } = await zmensiObrazek(soubor);
      P.vlozObrazek(src, Math.min(w, dok.g.sirka), soubor.name || 'Obrázek');
    } catch (e) { zprava(koren, e.message); }
  }
  P.obrazekZeZarizeni = () => {
    const vstup = el('input', { type: 'file', accept: 'image/*' });
    vstup.onchange = () => { if (vstup.files[0]) vlozSouborObrazku(vstup.files[0]); };
    vstup.click();
  };
  P.vlozObrazek = (src, sirka, alt = '') => P.prikaz(() => {
    const w = Math.round(Math.min(sirka || dok.g.sirka * 0.6, dok.g.sirka));
    document.execCommand('insertHTML', false, `<img src="${src.replace(/"/g, '%22')}" alt="${esc(alt)}" style="width: ${w}px;">`);
  }, 'Vložit obrázek');
  P.velikostObrazku = (wcm, hcm) => {
    const o = st.obrazek;
    if (!o) return;
    P.prikaz(() => {
      const pomer = o.naturalHeight ? o.naturalWidth / o.naturalHeight : 1;
      const w = wcm != null ? wcm * 10 * MM : hcm * 10 * MM * pomer;
      o.style.width = Math.round(Math.max(16, Math.min(w, dok.g.sirka))) + 'px';
      o.style.height = '';
    }, 'Velikost obrázku');
    polohaUchytu();
  };
  P.obtekani = (typ) => {
    const o = st.obrazek;
    if (!o) return;
    P.prikaz(() => {
      o.classList.remove('ps-obr-vlevo', 'ps-obr-vpravo', 'ps-obr-blok');
      if (typ !== 'radek') o.classList.add('ps-obr-' + typ);
    }, 'Obtékání textu');
    polohaUchytu();
  };
  P.obrazekObtekani = () => {
    if (!st.obrazek) return zprava(koren, 'Nejdřív klikněte na obrázek, u kterého chcete obtékání změnit.');
    prepniKartu('obrazek');
  };

  function zobrazUchyt(img) {
    dok.ed.querySelectorAll('img.ps-vybrany').forEach((i) => i.classList.remove('ps-vybrany'));
    st.obrazek = img;
    if (img) img.classList.add('ps-vybrany');
    polohaUchytu();
    obnov();
    if (img && st.karta !== 'obrazek') prepniKartu('obrazek');
  }
  function polohaUchytu() {
    const o = st.obrazek;
    if (!o || !dok.ed.contains(o)) { uchyt.hidden = true; if (o) st.obrazek = null; return; }
    const lr = dok.list.getBoundingClientRect();
    const r = o.getBoundingClientRect();
    const m = dok.meritko;
    uchyt.hidden = false;
    Object.assign(uchyt.style, { left: (r.left - lr.left) / m + 'px', top: (r.top - lr.top) / m + 'px', width: r.width / m + 'px', height: r.height / m + 'px' });
  }
  dok.ed.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (img && dok.ed.contains(img)) {
      const r = document.createRange();
      r.selectNode(img);
      dok.nastavRozsah(r);
      zobrazUchyt(img);
    } else if (st.obrazek) zobrazUchyt(null);
    const a = e.target.closest('a[href]');
    if (a && (e.ctrlKey || st.jenCteni || st.rezim === 'cteni')) {
      e.preventDefault();
      const href = a.getAttribute('href');
      if (/^https?:/i.test(href)) openApp('browser', { url: href });
    }
    const toc = e.target.closest('.ps-toc [data-cil]');
    if (toc && (e.ctrlKey || true)) {
      const h = nadpisy()[+toc.dataset.cil];
      if (h) { h.scrollIntoView({ block: 'start', behavior: 'smooth' }); kurzorDo(h); }
    }
  });
  uchyt.addEventListener('pointerdown', (e) => {
    const r = e.target.dataset.r;
    const o = st.obrazek;
    if (!r || !o) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const w0 = o.getBoundingClientRect().width / dok.meritko;
    const smer = r.includes('w') ? -1 : 1;
    const pohyb = (ev) => {
      const w = Math.max(16, Math.min(dok.g.sirka, w0 + smer * (ev.clientX - sx) / dok.meritko));
      o.style.width = Math.round(w) + 'px';
      o.style.height = '';
      polohaUchytu();
    };
    const konec = () => {
      removeEventListener('pointermove', pohyb);
      removeEventListener('pointerup', konec);
      dok.zaznam('Změna velikosti obrázku');
      dok.planujStrankovani();
      zmena();
      obnov();
    };
    addEventListener('pointermove', pohyb);
    addEventListener('pointerup', konec);
  });

  // ------------------------------------------------------------ záhlaví a zápatí
  P.upravZahlavi = (kde, vychozi) => {
    if (st.rezim !== 'tisk') P.rezim('tisk');
    if (vychozi !== undefined) {
      dok.nast[kde] = vychozi;
      dok.kresliStranky();
    }
    zacniZahlavi(kde, 1);
  };
  function zacniZahlavi(kde, strana) {
    if (st.zahlavi) ukonciZahlavi();
    st.zahlavi = { kde, strana };
    dok.uprava = st.zahlavi;
    koren.classList.add('ps-upravuje-zahlavi');
    const u = dok.stranky.querySelector(`.ps-strana[data-strana="${strana}"] .ps-${kde}`);
    if (!u) return;
    if (!u.innerHTML.trim()) u.innerHTML = '<p><br></p>';
    u.contentEditable = 'true';
    u.focus();
    const r = document.createRange();
    r.selectNodeContents(u.lastElementChild || u);
    r.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    u.scrollIntoView({ block: 'nearest' });
    obnov();
    prepniKartu('zahlavi');
  }
  function ukonciZahlavi() {
    const z = st.zahlavi;
    if (!z) return;
    const u = dok.stranky.querySelector(`.ps-strana[data-strana="${z.strana}"] .ps-${z.kde}`);
    if (u) {
      let html = u.innerHTML;
      if (!u.textContent.trim() && !u.querySelector('img')) html = '';
      dok.nast[z.kde] = html;
    }
    st.zahlavi = null;
    dok.uprava = null;
    koren.classList.remove('ps-upravuje-zahlavi');
    dok.kresliStranky();
    dok.zaznam(z.kde === 'zahlavi' ? 'Záhlaví' : 'Zápatí');
    zmena();
    obnov();
  }
  P.zavriZahlavi = () => { ukonciZahlavi(); prepniKartu('vlozeni'); dok.vratVyber(); };
  P.vlozDoZahlavi = (html) => {
    const z = st.zahlavi;
    if (!z) return;
    const u = dok.stranky.querySelector(`.ps-strana[data-strana="${z.strana}"] .ps-${z.kde}`);
    u?.focus();
    document.execCommand('insertHTML', false, typeof html === 'string' && !html.startsWith('<') ? esc(html) : html);
  };
  P.cisloStranky = (kde, zar) => {
    dok.nast[kde] = `<p style="text-align:${zar}"><span class="ps-pole-cislo">1</span></p>`;
    P.nastavStranku({}, 'Číslo stránky');
  };
  P.odeberCisla = () => {
    for (const k of ['zahlavi', 'zapati']) {
      const d = document.createElement('div');
      d.innerHTML = dok.nast[k] || '';
      d.querySelectorAll('.ps-pole-cislo, .ps-pole-pocet').forEach((s) => s.remove());
      dok.nast[k] = d.textContent.trim() ? d.innerHTML : '';
    }
    P.nastavStranku({}, 'Odebrat čísla stránek');
  };
  dok.list.addEventListener('dblclick', (e) => {
    if (st.rezim !== 'tisk' || st.jenCteni) return;
    const lr = dok.list.getBoundingClientRect();
    const y = (e.clientY - lr.top) / dok.meritko;
    const k = Math.floor(y / dok.g.rozestup);
    const vStrance = y - k * dok.g.rozestup;
    if (vStrance < dok.g.mt - 4) { e.preventDefault(); zacniZahlavi('zahlavi', k + 1); }
    else if (vStrance > dok.g.h - dok.g.mb + 4 && vStrance < dok.g.h) { e.preventDefault(); zacniZahlavi('zapati', k + 1); }
  });
  dok.ed.addEventListener('focus', () => { if (st.zahlavi) ukonciZahlavi(); });

  // ------------------------------------------------------------ komentáře
  P.novyKomentar = () => {
    if (st.jenCteni) return hlaskaJenCteni();
    dok.vratVyber();
    if (!dok.vybranyText) {
      const s = getSelection();
      s.modify('move', 'backward', 'word');
      s.modify('extend', 'forward', 'word');
      if (!s.toString().trim()) return zprava(koren, 'Označte text, ke kterému chcete přidat komentář.');
    }
    const id = 'k' + Date.now().toString(36);
    P.prikaz(() => {
      dok.obalVyber((s) => { s.className = 'ps-kom'; s.dataset.kom = id; });
      dok.nast.komentare.push({ id, text: '', autor: P.autor(), cas: Date.now(), odpovedi: [] });
    }, 'Nový komentář');
    st.upravovanyKomentar = id;
    P.podokno('komentare');
  };
  P.smazKomentar = (id) => {
    id = id || st.aktivniKomentar || dok.prvekKurzoru()?.closest('.ps-kom')?.dataset.kom;
    if (!id) return zprava(koren, 'Klikněte do komentovaného textu nebo vyberte komentář v podokně.');
    P.prikaz(() => {
      dok.ed.querySelectorAll(`.ps-kom[data-kom="${id}"]`).forEach((s) => s.replaceWith(...s.childNodes));
      dok.nast.komentare = dok.nast.komentare.filter((k) => k.id !== id);
    }, 'Odstranit komentář');
    if (st.podokno === 'komentare') P.podokno('komentare');
  };
  P.skokKomentar = (smer) => {
    const kotvy = [...dok.ed.querySelectorAll('.ps-kom')].filter((s, i, a) => a.findIndex((x) => x.dataset.kom === s.dataset.kom) === i);
    if (!kotvy.length) return zprava(koren, 'V dokumentu nejsou žádné komentáře.');
    const akt = kotvy.findIndex((k) => k.dataset.kom === st.aktivniKomentar);
    const dalsi = kotvy[(akt + smer + kotvy.length) % kotvy.length];
    aktivujKomentar(dalsi.dataset.kom);
  };
  function aktivujKomentar(id) {
    st.aktivniKomentar = id;
    dok.ed.querySelectorAll('.ps-kom.aktivni').forEach((s) => s.classList.remove('aktivni'));
    const kotvy = dok.ed.querySelectorAll(`.ps-kom[data-kom="${id}"]`);
    kotvy.forEach((s) => s.classList.add('aktivni'));
    kotvy[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (st.podokno !== 'komentare') P.podokno('komentare');
    podoknoP.querySelectorAll('.ps-kom-karta').forEach((k) => k.classList.toggle('aktivni', k.dataset.kom === id));
  }
  dok.ed.addEventListener('click', (e) => {
    const k = e.target.closest('.ps-kom');
    if (k && st.podokno === 'komentare') aktivujKomentar(k.dataset.kom);
  });

  // ------------------------------------------------------------ obsah a poznámky
  const nadpisy = () => [...dok.ed.querySelectorAll('h1, h2, h3')].filter((h) => !h.closest('.ps-toc'));
  const stranaPrvku = (e) => Math.floor(e.offsetTop / dok.g.rozestup) + 1;
  function htmlObsahu(titulek) {
    const h = nadpisy();
    const radky = h.map((x, i) => `<p class="ps-toc-${x.tagName[1]}" data-cil="${i}"><span class="ps-toc-text">${esc(x.textContent)}</span><span class="ps-toc-tecky"></span><span class="ps-toc-cislo">${stranaPrvku(x)}</span></p>`).join('');
    return `<p class="ps-toc-nadpis">${esc(titulek)}</p>${radky || '<p>V dokumentu nejsou žádné položky obsahu. Použijte styly Nadpis 1–3.</p>'}`;
  }
  P.vlozObsah = (titulek) => P.prikaz(() => {
    const [t] = vlozBlokyZa(`<div class="ps-toc" contenteditable="false" data-titulek="${esc(titulek)}"></div><p><br></p>`);
    t.innerHTML = htmlObsahu(titulek);
    setTimeout(() => P.aktualizujObsah(true), 60);
  }, 'Obsah');
  P.aktualizujObsah = (tise) => {
    const toc = dok.ed.querySelectorAll('.ps-toc');
    if (!toc.length) { if (!tise) zprava(koren, 'V dokumentu není žádný obsah. Vložte ho přes Reference → Obsah.'); return; }
    dok.strankuj();
    toc.forEach((t) => { t.innerHTML = htmlObsahu(t.dataset.titulek || 'Obsah'); });
    dok.zaznam('Aktualizovat obsah');
    zmena();
  };

  function precisluj() {
    const odkazy = [...dok.ed.querySelectorAll('sup.ps-pozn-ref')];
    let seznam = dok.ed.querySelector(':scope > ol.ps-poznamky');
    if (!odkazy.length) { seznam?.remove(); return; }
    if (!seznam) { seznam = el('ol.ps-poznamky'); dok.ed.append(seznam); }
    const polozky = new Map([...seznam.children].map((li) => [li.dataset.id, li]));
    seznam.replaceChildren();
    odkazy.forEach((o, i) => {
      o.textContent = String(i + 1);
      const li = polozky.get(o.dataset.id) || el('li', { dataset: { id: o.dataset.id }, html: '<br>' });
      seznam.append(li);
    });
    if (seznam !== dok.ed.lastElementChild) dok.ed.append(seznam);
  }
  P.vlozPoznamku = () => P.prikaz(() => {
    const id = 'n' + Date.now().toString(36);
    const r = dok.aktualniRozsah();
    r.collapse(false);
    const sup = el('sup.ps-pozn-ref', { dataset: { id }, contenteditable: 'false', text: '1' });
    r.insertNode(sup);
    precisluj();
    const li = dok.ed.querySelector(`ol.ps-poznamky li[data-id="${id}"]`);
    if (li) { kurzorDo(li, true); li.scrollIntoView({ block: 'center' }); }
  }, 'Poznámka pod čarou');
  P.dalsiPoznamka = () => {
    const odkazy = [...dok.ed.querySelectorAll('sup.ps-pozn-ref')];
    const r = dok.aktualniRozsah();
    const dalsi = odkazy.find((o) => r && r.comparePoint(o, 0) > 0) || odkazy[0];
    if (!dalsi) return zprava(koren, 'V dokumentu nejsou žádné poznámky.');
    const r2 = document.createRange();
    r2.setStartAfter(dalsi);
    r2.collapse(true);
    dok.nastavRozsah(r2);
    dalsi.scrollIntoView({ block: 'center' });
  };

  // ------------------------------------------------------------ hledání
  function najdiRozsahy(q, { velka = false, cela = false } = {}) {
    if (!q) return [];
    const vzor = new RegExp((cela ? '(?<![\\p{L}\\p{N}])' : '') + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (cela ? '(?![\\p{L}\\p{N}])' : ''), 'gu' + (velka ? '' : 'i'));
    const vysledky = [];
    const bloky = [...dok.ed.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, div')].filter((b) => !b.querySelector('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, div'));
    for (const b of bloky) {
      const uzly = [];
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let text = '';
      for (let n = w.nextNode(); n; n = w.nextNode()) { uzly.push({ n, od: text.length }); text += n.data; }
      for (const m of text.matchAll(vzor)) {
        const najdi = (pos) => { let u = uzly[0]; for (const x of uzly) { if (x.od <= pos) u = x; else break; } return [u.n, pos - u.od]; };
        const [a, ao] = najdi(m.index);
        const [z, zo] = najdi(m.index + m[0].length - 1);
        const r = document.createRange();
        r.setStart(a, ao);
        r.setEnd(z, zo + 1);
        vysledky.push(r);
      }
    }
    return vysledky;
  }
  function zvyrazniVysledky(rozsahy, akt) {
    if (!window.CSS?.highlights) return;
    CSS.highlights.set('ps-hledani', new Highlight(...rozsahy));
    if (akt) CSS.highlights.set('ps-hledani-akt', new Highlight(akt)); else CSS.highlights.delete('ps-hledani-akt');
  }
  function zrusZvyrazneni() {
    if (!window.CSS?.highlights) return;
    CSS.highlights.delete('ps-hledani');
    CSS.highlights.delete('ps-hledani-akt');
  }
  function ukazRozsah(r) {
    dok.nastavRozsah(r);
    const e = r.startContainer.parentElement;
    e?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  P.najdiDalsi = (q, volby) => {
    const vse = najdiRozsahy(q, volby);
    if (!vse.length) { zrusZvyrazneni(); return false; }
    const akt = dok.aktualniRozsah();
    const dalsi = vse.find((r) => !akt || r.compareBoundaryPoints(Range.START_TO_END, akt) > 0 && r.compareBoundaryPoints(Range.START_TO_START, akt) > 0) || vse[0];
    zvyrazniVysledky(vse, dalsi);
    ukazRozsah(dalsi);
    return true;
  };
  P.nahradVse = (q, za, volby) => {
    const vse = najdiRozsahy(q, volby);
    if (!vse.length) return 0;
    P.prikaz(() => {
      for (const r of vse.reverse()) {
        r.deleteContents();
        r.insertNode(document.createTextNode(za));
      }
      dok.ed.normalize();
    }, 'Nahradit vše');
    zrusZvyrazneni();
    return vse.length;
  };
  P.prejdiNaStranu = (n) => {
    n = Math.max(1, Math.min(dok.pocetStran, n));
    plocha.scrollTo({ top: (n - 1) * dok.g.rozestup * dok.meritko, behavior: 'smooth' });
    const b = dok.bloky().find((x) => x.el.offsetTop >= (n - 1) * dok.g.rozestup - 1);
    if (b) kurzorDo(b.el);
  };

  // ------------------------------------------------------------ podokna
  let navigaceCeka = 0;
  function planujNavigaci() { clearTimeout(navigaceCeka); navigaceCeka = setTimeout(() => { if (st.podoknoVlevo === 'navigace') kresliNavigaci(); }, 400); }
  let komentareCeka = 0;
  function planujKomentare() { clearTimeout(komentareCeka); komentareCeka = setTimeout(() => { if (st.podokno === 'komentare' && !podoknoP.contains(document.activeElement)) P.podokno('komentare'); }, 500); }

  let navStav = { zalozka: 'nadpisy', dotaz: '' };
  function kresliNavigaci() {
    const vstup = el('input.ps-nav-hledat', { placeholder: 'Hledat v dokumentu', value: navStav.dotaz });
    const obsah = el('div.ps-nav-obsah');
    const zal = el('div.ps-nav-zalozky', {}, [['nadpisy', 'Nadpisy'], ['stranky', 'Stránky'], ['vysledky', 'Výsledky']].map(([id, t]) =>
      el('button', { type: 'button', text: t, class: navStav.zalozka === id ? 'aktivni' : '', onclick: () => { navStav.zalozka = id; kresliNavigaci(); } })));
    const kresliObsah = () => {
      if (navStav.zalozka === 'nadpisy') {
        const h = nadpisy();
        const kurzor = dok.blokKurzoru();
        const aktivni = h.filter((x) => kurzor && (x === kurzor || x.compareDocumentPosition(kurzor) & Node.DOCUMENT_POSITION_FOLLOWING)).pop();
        obsah.replaceChildren(h.length ? el('div.ps-nav-nadpisy', {}, h.map((x) => el('button.ps-nav-nadpis.u' + x.tagName[1] + (x === aktivni ? '.aktivni' : ''), {
          type: 'button', text: x.textContent || '(prázdný nadpis)',
          onclick: () => { x.scrollIntoView({ block: 'start', behavior: 'smooth' }); kurzorDo(x); },
        }))) : el('p.ps-nav-pozn', { text: 'Vytvořte interaktivní osnovu dokumentu. Je to skvělý způsob, jak mít přehled, kde jste, nebo jak rychle přesunout obsah. Začněte tak, že na kartě Domů použijete styly Nadpis na nadpisy v dokumentu.' }));
      } else if (navStav.zalozka === 'stranky') {
        const g = dok.g;
        const m = 150 / g.w;
        obsah.replaceChildren(el('div.ps-nav-stranky', {}, Array.from({ length: Math.min(dok.pocetStran, 40) }, (_, k) => {
          const kopie = dok.list.cloneNode(true);
          kopie.querySelector('.ps-ed')?.removeAttribute('contenteditable');
          kopie.querySelectorAll('.ps-uchyt-ram').forEach((x) => x.remove());
          kopie.querySelectorAll('.ps-kom').forEach((k) => k.classList.remove('ps-kom'));
          kopie.style.transform = `translateY(${-k * g.rozestup * m}px) scale(${m})`;
          kopie.style.transformOrigin = '0 0';
          return el('button.ps-nav-strana', { type: 'button', onclick: () => P.prejdiNaStranu(k + 1), class: dok.stranaKurzoru() === k + 1 ? 'aktivni' : '' },
            el('div.ps-nav-mini', { style: { width: g.w * m + 'px', height: g.h * m + 'px' } }, kopie), el('span', { text: String(k + 1) }));
        })));
      } else {
        const vse = najdiRozsahy(navStav.dotaz);
        zvyrazniVysledky(vse);
        obsah.replaceChildren(!navStav.dotaz ? el('p.ps-nav-pozn', { text: 'Hledejte text, komentáře, stránky a další.' })
          : el('div', {}, el('div.ps-nav-pocet', { text: vse.length ? `Počet výsledků: ${vse.length}` : 'Žádné výsledky' }),
            vse.slice(0, 200).map((r) => {
              const blok = r.startContainer.parentElement.closest('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, div') || r.startContainer.parentElement;
              const t = blok.textContent;
              const pred = document.createRange();
              pred.setStart(blok, 0);
              pred.setEnd(r.startContainer, r.startOffset);
              const od = pred.toString().length;
              return el('button.ps-nav-vysledek', { type: 'button', onclick: () => { zvyrazniVysledky(vse, r); ukazRozsah(r); } },
                el('span', { text: (od > 30 ? '…' : '') + t.slice(Math.max(0, od - 30), od) }), el('mark', { text: r.toString() }), el('span', { text: t.slice(od + r.toString().length, od + r.toString().length + 50) }));
            })));
      }
    };
    vstup.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { vstup.value = ''; navStav.dotaz = ''; zrusZvyrazneni(); kresliObsah(); } });
    vstup.addEventListener('input', () => {
      navStav.dotaz = vstup.value;
      if (navStav.dotaz && navStav.zalozka !== 'vysledky') { navStav.zalozka = 'vysledky'; zal.querySelectorAll('button').forEach((b, i) => b.classList.toggle('aktivni', i === 2)); }
      if (!navStav.dotaz) zrusZvyrazneni();
      kresliObsah();
    });
    podoknoL.replaceChildren(
      hlavaPodokna('Navigace', () => P.podokno(null, { vlevo: true })),
      el('div.ps-nav-hledat-ram', {}, vstup, ik('najitMaly')),
      zal, obsah);
    kresliObsah();
    return vstup;
  }

  function hlavaPodokna(titulek, zavri, extra) {
    return el('div.ps-pod-hlava', {}, el('h2', { text: titulek }), extra || null,
      el('button.ps-pod-x', { type: 'button', title: 'Zavřít', onclick: zavri }, ik('zavrit')));
  }

  const cas = (t) => {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'Právě teď';
    if (s < 3600) return `před ${Math.round(s / 60)} min`;
    return new Date(t).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  function kresliKomentare() {
    const kom = dok.nast.komentare;
    const karty = kom.map((k) => {
      const kotva = dok.ed.querySelector(`.ps-kom[data-kom="${k.id}"]`);
      const upravuje = st.upravovanyKomentar === k.id || !k.text;
      const pole = el('textarea.ps-kom-pole', { rows: 2, placeholder: 'Zadejte @zmínku nebo komentář', text: k.text });
      const odeslat = el('button.ps-kom-odeslat', { type: 'button', title: 'Publikovat komentář (Ctrl+Enter)' }, ik('sipkaVlevo'));
      odeslat.onclick = () => {
        if (!pole.value.trim()) return;
        k.text = pole.value.trim();
        k.cas = Date.now();
        st.upravovanyKomentar = null;
        dok.zaznam('Komentář');
        zmena();
        kresliKomentare();
      };
      pole.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.ctrlKey) odeslat.click(); if (e.key === 'Escape') dok.vratVyber(); });
      const odpoved = el('input.ps-kom-odpoved', { placeholder: 'Odpovědět' });
      odpoved.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && odpoved.value.trim()) {
          k.odpovedi = [...(k.odpovedi || []), { autor: P.autor(), text: odpoved.value.trim(), cas: Date.now() }];
          dok.zaznam('Odpověď'); zmena(); kresliKomentare();
        }
      });
      const vice = el('button.ps-kom-vice', { type: 'button', title: 'Další akce vlákna', text: '⋯' });
      vice.onclick = (e) => {
        e.stopPropagation();
        rozbal(vice, nabidka([
          { text: 'Upravit komentář', ikona: 'tuzka', akce: () => { st.upravovanyKomentar = k.id; kresliKomentare(); } },
          { text: 'Odstranit vlákno', ikona: 'zavrit', akce: () => P.smazKomentar(k.id) },
          { text: k.vyreseno ? 'Znovu otevřít vlákno' : 'Vyřešit vlákno', ikona: 'kontrola', akce: () => { k.vyreseno = !k.vyreseno; dok.zaznam('Vyřešit'); zmena(); kresliKomentare(); } },
        ]), { zarovnat: 'vpravo' });
      };
      const karta = el('div.ps-kom-karta' + (st.aktivniKomentar === k.id ? '.aktivni' : '') + (k.vyreseno ? '.vyreseno' : '') + (!kotva ? '.bez-kotvy' : ''), { dataset: { kom: k.id } },
        el('div.ps-kom-hlava', {}, el('span.ps-avatar.maly', { text: k.autor.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase() }),
          el('div', {}, el('b', { text: k.autor }), el('small', { text: cas(k.cas) + (k.vyreseno ? ' · Vyřešeno' : '') })), vice),
        kotva ? el('div.ps-kom-citace', { text: kotva.textContent.slice(0, 80) }) : el('div.ps-kom-citace', { text: 'Komentovaný text byl odstraněn.' }),
        upravuje ? el('div.ps-kom-edit', {}, pole, odeslat) : el('p.ps-kom-text', { text: k.text }),
        (k.odpovedi || []).map((o) => el('div.ps-kom-odp', {}, el('b', { text: o.autor }), el('small', { text: ' ' + cas(o.cas) }), el('p', { text: o.text }))),
        !upravuje ? odpoved : null);
      karta.addEventListener('click', (e) => { if (!e.target.closest('textarea, input, button')) aktivujKomentar(k.id); });
      if (upravuje) setTimeout(() => pole.focus(), 40);
      return karta;
    });
    podoknoP.replaceChildren(
      hlavaPodokna('Komentáře', () => P.podokno(null), el('button.ps-tlac.maly', { type: 'button', onclick: () => P.novyKomentar() }, ik('komentar'), ' Nový')),
      el('div.ps-kom-seznam', {}, karty.length ? karty : el('div.ps-pod-prazdno', {}, ik('komentarNovy'), el('b', { text: 'Zatím žádné komentáře' }),
        el('p', { text: 'Označte text a vyberte Nový komentář. Komentáře se ukládají spolu s dokumentem.' }))));
  }

  // kontrola textu (Editor)
  function kontroly() {
    const nalezy = [];
    const bloky = [...dok.ed.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, div')].filter((b) => !b.querySelector('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, div') && !b.closest('.ps-toc'));
    const pravidla = [
      { typ: 'Gramatika', nazev: 'Opakované slovo', re: /(?<![\p{L}])(\p{L}+)\s+\1(?![\p{L}])/giu, oprava: (m) => m[1] },
      { typ: 'Upřesnění', nazev: 'Mezery: použijte jednu mezeru', re: / {2,}/g, oprava: () => ' ' },
      { typ: 'Gramatika', nazev: 'Interpunkce: mezera před znaménkem', re: / +([,.!?;:])/g, oprava: (m) => m[1] },
      { typ: 'Gramatika', nazev: 'Interpunkce: chybí mezera za čárkou', re: /([\p{L}]),(?=[\p{L}])/gu, oprava: (m) => m[1] + ', ' },
      { typ: 'Gramatika', nazev: 'Velké písmeno na začátku věty', re: /(?:^|[.!?]\s+)(\p{Ll})/gu, oprava: (m) => m[0].slice(0, -1) + m[1].toLocaleUpperCase('cs') },
      { typ: 'Gramatika', nazev: 'Čárka před spojkou', re: /(?<![,;:(\-–]|\b(?:a|i|nebo|ani|jako|než|že|aniž))\s(že|protože|který|která|které|kteří|aby|když|jestli|pokud)\b/giu, oprava: (m) => ',' + m[0] },
    ];
    for (const b of bloky) {
      const text = b.textContent;
      if (!text.trim()) continue;
      for (const p of pravidla) {
        p.re.lastIndex = 0;
        for (const m of text.matchAll(p.re)) {
          if (p.nazev === 'Čárka před spojkou' && /^\s(a|i)\s/i.test(text.slice(m.index - 2, m.index + 1))) continue;
          nalezy.push({ ...p, blok: b, index: m.index, delka: m[0].length, puvodni: m[0], novy: p.oprava(m), kontext: text });
        }
      }
    }
    return nalezy.filter((n) => !(st.ignorovane || []).includes(n.nazev + '|' + n.puvodni + '|' + n.kontext.slice(0, 40)));
  }
  function rozsahVBloku(b, od, delka) {
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let poz = 0, a = null, ao = 0, z = null, zo = 0;
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!a && poz + n.length > od) { a = n; ao = od - poz; }
      if (a && poz + n.length >= od + delka) { z = n; zo = od + delka - poz; break; }
      poz += n.length;
    }
    if (!a || !z) return null;
    const r = document.createRange();
    r.setStart(a, ao);
    r.setEnd(z, zo);
    return r;
  }
  function kresliEditor() {
    const n = kontroly();
    const skore = Math.max(0, 100 - n.length * 4);
    const pravopis = n.filter((x) => x.typ === 'Gramatika').length;
    const upresneni = n.length - pravopis;
    const s = dok.statistika();
    podoknoP.replaceChildren(
      hlavaPodokna('Editor', () => P.podokno(null)),
      el('div.ps-ed-skore', {},
        el('div.ps-ed-kruh', { style: { '--p': skore } }, el('span', { text: skore + ' %' })),
        el('div', {}, el('b', { text: 'Skóre editoru' }), el('small', { text: `${s.slova} slov · čeština` }))),
      el('div.ps-ed-kat', {},
        el('div', {}, el('span', { text: 'Opravy' }), el('b', { text: String(pravopis) })),
        el('div', {}, el('span', { text: 'Upřesnění' }), el('b', { text: String(upresneni) }))),
      el('div.ps-ed-seznam', {}, n.length ? n.slice(0, 50).map((x) => {
        const karta = el('div.ps-ed-nalez', {},
          el('small', { text: x.typ }), el('b', { text: x.nazev }),
          el('div.ps-ed-kontext', {}, x.kontext.slice(Math.max(0, x.index - 25), x.index), el('del', { text: x.puvodni }), el('ins', { text: x.novy }), x.kontext.slice(x.index + x.delka, x.index + x.delka + 25)),
          el('div.ps-ed-tl', {},
            el('button.ps-tlac.primarni.maly', { type: 'button', text: 'Opravit', onclick: () => {
              const r = rozsahVBloku(x.blok, x.index, x.delka);
              if (!r) return;
              dok.nastavRozsah(r);
              P.prikaz(() => document.execCommand('insertText', false, x.novy), 'Oprava editoru');
              kresliEditor();
            } }),
            el('button.ps-tlac.maly', { type: 'button', text: 'Ignorovat', onclick: () => { st.ignorovane = [...(st.ignorovane || []), x.nazev + '|' + x.puvodni + '|' + x.kontext.slice(0, 40)]; kresliEditor(); } })));
        karta.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          const r = rozsahVBloku(x.blok, x.index, x.delka);
          if (r) ukazRozsah(r);
        });
        return karta;
      }) : el('div.ps-pod-prazdno', {}, ik('pravopis'), el('b', { text: 'Skvělá práce!' }), el('p', { text: 'Editor v dokumentu nenašel nic k opravě. Pravopis jednotlivých slov kontroluje prohlížeč (červené vlnovky).' }))));
  }

  function kresliPristupnost() {
    const problemy = [];
    dok.ed.querySelectorAll('img').forEach((i) => { if (!i.alt) problemy.push(['Chybějící alternativní text', 'Obrázek', i]); });
    let posledni = 0;
    nadpisy().forEach((h) => { const u = +h.tagName[1]; if (posledni && u > posledni + 1) problemy.push(['Přeskočená úroveň nadpisu', h.textContent.slice(0, 40), h]); posledni = u; });
    dok.ed.querySelectorAll('table').forEach((t) => { if (t.classList.contains('bez-zahlavi')) problemy.push(['Tabulka nemá řádek záhlaví', 'Tabulka', t]); });
    podoknoP.replaceChildren(
      hlavaPodokna('Přístupnost', () => P.podokno(null)),
      problemy.length ? el('div.ps-ed-seznam', {}, el('b.ps-pristup-nadpis', { text: `Chyby (${problemy.length})` }), problemy.map(([n, co, prvek]) => el('button.ps-ed-nalez', {
        type: 'button', onclick: () => { prvek.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (prvek.tagName === 'IMG') zobrazUchyt(prvek); },
      }, el('b', { text: n }), el('small', { text: co }))), el('p.ps-nav-pozn', { text: 'Proč to opravit: lidé, kteří používají čtečku obrazovky, se bez popisků v dokumentu neorientují.' }))
        : el('div.ps-pod-prazdno', {}, ik('pristupnost'), el('b', { text: 'Nebyly zjištěny žádné problémy s přístupností.' }), el('p', { text: 'Lidé s postižením by neměli mít potíže při čtení tohoto dokumentu.' })));
  }

  function kresliStyly() {
    podoknoP.replaceChildren(hlavaPodokna('Styly', () => P.podokno(null)),
      el('div.ps-styly-seznam', {}, STYLY.map((s) => el('button.ps-styly-pol' + (P.stav.styl === s.id ? '.aktivni' : ''), { type: 'button', onclick: () => { aplikujStyl(P, s.id); kresliStyly(); } },
        el('span.ps-gal-nahled', { dataset: { styl: s.id }, text: s.nazev }), el('small', { text: s.znak ? 'a' : '¶' })))),
      el('label.ps-dlg-radio', {}, el('input', { type: 'checkbox', checked: true }), ' Zobrazit náhled'));
  }

  function kresliSchranku() {
    podoknoP.replaceChildren(hlavaPodokna('Schránka', () => P.podokno(null)),
      el('div.ps-schr-tl', {}, el('button.ps-tlac.maly', { type: 'button', text: 'Vymazat vše', onclick: () => { st.schranka = []; kresliSchranku(); } })),
      el('div.ps-nav-pozn', { text: 'Klikněte na položku, kterou chcete vložit:' }),
      st.schranka.length ? el('div.ps-schr-seznam', {}, st.schranka.map((t) => el('button.ps-schr-pol', { type: 'button', text: t.slice(0, 160), onclick: () => P.prikaz(() => document.execCommand('insertText', false, t), 'Vložit ze schránky') })))
        : el('div.ps-pod-prazdno', {}, ik('vlozit'), el('p', { text: 'Schránka je prázdná. Zkopírujte nebo vyjměte text.' })));
  }

  function kresliNapovedu() {
    const temata = [
      ['Klávesové zkratky', 'Ctrl+B tučné · Ctrl+I kurzíva · Ctrl+U podtržení · Ctrl+E na střed · Ctrl+L/R/J zarovnání · Ctrl+Enter nová stránka · Ctrl+K odkaz · Ctrl+F hledat · Ctrl+H nahradit · Ctrl+Alt+1/2/3 nadpisy · Ctrl+Shift+N normální · Ctrl+S uložit · F12 uložit jako · Ctrl+P tisk'],
      ['Automatické formátování', 'Hvězdička nebo pomlčka a mezera na začátku řádku založí odrážky, „1.“ a mezera číslovaný seznam. Rovné uvozovky se mění na české „“.'],
      ['Záhlaví a zápatí', 'Poklepejte do horního nebo dolního okraje stránky. Čísla stránek najdete na kartě Vložení.'],
      ['Stránky', 'Text se sám rozděluje na stránky A4. Novou stránku vynutíte klávesami Ctrl+Enter.'],
      ['Ukládání', 'Dokumenty se ukládají na disk AstroOS jako .docx (formát AstroPísma). Přes Soubor → Export uložíte i HTML, text nebo PDF (tiskem).'],
      ['AstroAI', 'Tlačítko AstroAI na kartě Domů otevře pomocníka. V ukázkové verzi AI není.'],
    ];
    podoknoP.replaceChildren(hlavaPodokna('Nápověda', () => P.podokno(null)),
      el('div.ps-napoveda', {}, temata.map(([t, p]) => el('details', {}, el('summary', { text: t }), el('p', { text: p })))));
  }

  // AstroAI
  let aiRizeni = null;
  const aiHistorie = [];
  function kresliAI() {
    const log = el('div.ps-ai-log');
    const vstup = el('textarea.ps-ai-vstup', { rows: 2, placeholder: 'Zeptejte se nebo zadejte úkol pro tento dokument…' });
    const poslat = el('button.ps-ai-poslat', { type: 'button', title: 'Odeslat' }, ik('sipkaVlevo'));
    const akce = [
      ['Shrnout tento dokument', 'Shrň následující dokument do 3–5 odrážek, ve stejném jazyce, v jakém je napsaný.', 'dok'],
      ['Přepsat výběr', 'Přepiš následující text tak, aby byl čtivější a přirozenější, a zachovej jeho jazyk. Vrať jen přepsaný text.', 'vyber'],
      ['Opravit pravopis výběru', 'Oprav pravopis a gramatiku v následujícím textu a zachovej jeho jazyk. Vrať jen opravený text, nic jiného.', 'vyber'],
      ['Pokračovat v psaní', 'Pokračuj v psaní následujícího textu dalším odstavcem ve stejném stylu. Vrať jen nový odstavec.', 'dok'],
      ['Navrhnout název', 'Navrhni 3 krátké výstižné názvy pro tento dokument. Vrať je jako odrážky.', 'dok'],
    ];
    const zprava = (od, text) => {
      const b = el('div.ps-ai-zprava.' + od, {}, text);
      log.append(b);
      log.scrollTop = log.scrollHeight;
      return b;
    };
    const posli = async (instrukce, zdroj, popisek) => {
      const vyber = dok.vybranyText;
      const rozsah = dok.aktualniRozsah()?.cloneRange();
      if (zdroj === 'vyber' && !vyber) { zprava('ai', 'Nejdřív v dokumentu označte text, se kterým mám pracovat.'); return; }
      const text = zdroj === 'vyber' ? vyber : zdroj === 'dok' ? dok.text.slice(0, 3500) : '';
      zprava('ja', popisek || instrukce);
      const odp = zprava('ai', '');
      odp.classList.add('pise');
      const obsah = el('div.ps-ai-text', { text: 'Přemýšlím…' });
      odp.append(obsah);
      aiRizeni?.abort();
      aiRizeni = new AbortController();
      const zpravy = [...aiHistorie.slice(-4), { role: 'user', content: text ? `${instrukce}\n\n---\n${text}` : instrukce }];
      let vysledek = '';
      try {
        const { send } = await import('../ai.js');
        const r = await send(zpravy, {
          zdroj: 'office',
          signal: aiRizeni.signal,
          onToken: (t) => { vysledek += t; obsah.textContent = vysledek; log.scrollTop = log.scrollHeight; },
        });
        vysledek = (r.text || vysledek).trim();
        obsah.textContent = vysledek;
        aiHistorie.push({ role: 'user', content: popisek || instrukce }, { role: 'assistant', content: vysledek });
      } catch (e) {
        if (e.name === 'AbortError') return;
        obsah.textContent = 'AstroAI teď neodpovídá: ' + e.message;
        odp.classList.remove('pise');
        return;
      }
      odp.classList.remove('pise');
      const odstavce = vysledek.split(/\n{1,}/).map((r) => r.trim()).filter(Boolean);
      const html = odstavce.map((r) => /^[-*•]\s/.test(r) ? `<li>${esc(r.replace(/^[-*•]\s+/, '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</li>` : `<p>${esc(r).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`).join('')
        .replace(/(<li>.*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
      odp.append(el('div.ps-ai-tl', {},
        el('button.ps-tlac.maly', { type: 'button', onclick: () => { if (rozsah) dok.nastavRozsah(rozsah); const r2 = dok.aktualniRozsah(); r2?.collapse(false); P.prikaz(() => document.execCommand('insertHTML', false, html), 'Vložit z AstroAI'); } }, ik('vlozit'), ' Vložit'),
        zdroj === 'vyber' ? el('button.ps-tlac.maly.primarni', { type: 'button', onclick: () => { if (rozsah) dok.nastavRozsah(rozsah); P.prikaz(() => document.execCommand('insertText', false, vysledek), 'Nahradit z AstroAI'); } }, ' Nahradit výběr') : null,
        el('button.ps-tlac.maly', { type: 'button', onclick: () => navigator.clipboard?.writeText(vysledek) }, ik('kopirovat'), ' Kopírovat')));
    };
    poslat.onclick = () => { const t = vstup.value.trim(); if (!t) return; vstup.value = ''; posli(t, dok.vybranyText ? 'vyber' : 'dok', t); };
    vstup.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); poslat.click(); } });
    podoknoP.replaceChildren(
      hlavaPodokna('AstroAI', () => P.podokno(null), el('span.ps-ai-odznak', { text: 'Beta' })),
      el('div.ps-ai-uvod', {}, ik('astroai'), el('b', { text: 'Ahoj! Jsem AstroAI.' }), el('p', { text: 'Pomůžu vám psát, přepsat text nebo shrnout dokument. Označte text a vyberte akci, nebo napište vlastní zadání.' })),
      el('div.ps-ai-akce', {}, akce.map(([t, i, z]) => el('button.ps-ai-chip', { type: 'button', text: t, onclick: () => posli(i, z, t) }))),
      log,
      el('div.ps-ai-dole', {}, el('div.ps-ai-pole', {}, vstup, poslat), el('small', { text: 'Obsah vytvořený AI může být nepřesný. Model běží lokálně na tvém počítači.' })));
  }

  P.podokno = (typ, o = {}) => {
    if (typ === 'navigace' || (o.vlevo && !typ)) {
      if (!typ) { st.podoknoVlevo = null; podoknoL.hidden = true; zrusZvyrazneni(); prizpusob(); kresliPravitka(); obnov(); return; }
      st.podoknoVlevo = 'navigace';
      podoknoL.hidden = false;
      if (typeof o.hledat === 'string') navStav = { zalozka: 'vysledky', dotaz: o.hledat };
      const vstup = kresliNavigaci();
      if (o.hledat) setTimeout(() => { vstup.focus(); vstup.select(); if (typeof o.hledat === 'string') vstup.dispatchEvent(new Event('input')); }, 30);
      prizpusob(); kresliPravitka(); obnov();
      return;
    }
    if (st.podokno === 'ai' && typ !== 'ai') aiRizeni?.abort();
    st.podokno = typ;
    podoknoP.hidden = !typ;
    podoknoP.dataset.typ = typ || '';
    if (typ === 'komentare') kresliKomentare();
    if (typ === 'editor') kresliEditor();
    if (typ === 'pristupnost') kresliPristupnost();
    if (typ === 'styly') kresliStyly();
    if (typ === 'schranka') kresliSchranku();
    if (typ === 'napoveda') kresliNapovedu();
    if (typ === 'ai') kresliAI();
    prizpusob();
    kresliPravitka();
    obnov();
  };

  // ------------------------------------------------------------ zobrazení
  P.rezim = (r) => {
    if (st.zahlavi) ukonciZahlavi();
    st.rezim = r;
    dok.rezim = r === 'cteni' ? 'web' : r;
    koren.classList.toggle('ps-cteni', r === 'cteni');
    koren.classList.toggle('ps-web', r === 'web');
    dok.ed.contentEditable = r === 'cteni' || st.jenCteni ? 'false' : 'true';
    dok.prekresli();
    if (r !== 'tisk') dok.nastavMeritko(1);
    else P.lupa(dok.meritko);
    obnov();
    kresliPravitka();
  };
  const listaCteni = el('div.ps-cteni-lista', {},
    el('button', { type: 'button', text: 'Soubor', onclick: () => otevriZakulisi(P, 'domu') }),
    el('button', { type: 'button', text: 'Nástroje', onclick: (e) => rozbal(e.currentTarget, nabidka([{ text: 'Najít', ikona: 'najitMaly', akce: () => P.podokno('navigace', { hledat: true }) }, { text: 'Předčítat', ikona: 'predcitat', akce: () => P.predcitat() }])) }),
    el('button', { type: 'button', text: 'Zobrazení', onclick: (e) => rozbal(e.currentTarget, nabidka([
      { text: 'Upravit dokument', ikona: 'tuzka', akce: () => P.rezim('tisk') },
      { text: 'Navigační podokno', ikona: 'navigace', akce: () => P.podokno('navigace', { vlevo: true }) },
      'sep', { nadpis: 'Barva stránky' },
      ...[['', 'Žádná'], ['sepie', 'Sépiová'], ['inverzni', 'Inverzní']].map(([v, t]) => ({ text: t, zaskrtnuto: (koren.dataset.cteniBarva || '') === v, akce: () => { koren.dataset.cteniBarva = v; } })),
    ])) }),
    el('div.ps-karty-mezera'),
    el('span.ps-cteni-nazev', {}),
    el('div.ps-karty-mezera'),
    el('button', { type: 'button', text: 'Zavřít režim čtení', onclick: () => P.rezim('tisk') }));
  koren.insertBefore(listaCteni, stred);

  P.zamereni = (zap) => {
    koren.classList.toggle('ps-zamereni', zap);
    win.node.classList.toggle('ps-zamereni-okno', zap);
    if (zap && !win.maximized) { st.bezMaxima = true; win.toggleMax(); }
    if (!zap && st.bezMaxima) { st.bezMaxima = false; win.toggleMax(); }
    if (zap) toast({ title: 'Zaměření', body: 'Režim ukončíte klávesou Esc.', icon: 'info', timeout: 2500 });
    setTimeout(() => { prizpusob(); kresliPravitka(); }, 250);
  };
  koren.append(el('div.ps-zamereni-vrsek', {}, el('button.ps-tlac', { type: 'button', text: 'Ukončit zaměření', onclick: () => P.zamereni(false) })));

  P.lupa = (v) => {
    const g = dok.g;
    const sirka = plocha.clientWidth - 48;
    const vyska = plocha.clientHeight - 40;
    let m = v;
    if (v === 'sirka') m = sirka / g.w;
    if (v === 'text') m = sirka / (g.sirka + 40);
    if (v === 'strana') m = Math.min(sirka / g.w, vyska / g.h);
    if (v === 'vice') m = Math.min(sirka / g.w, vyska / (g.h * 2 + MEZERA));
    m = Math.max(0.1, Math.min(5, +m || 1));
    const stred = (plocha.scrollTop + plocha.clientHeight / 2) / Math.max(1, dok.obal.offsetHeight);
    dok.nastavMeritko(m);
    plocha.scrollTop = stred * dok.obal.offsetHeight - plocha.clientHeight / 2;
    polohaUchytu();
    kresliPravitka();
    obnovStav();
  };
  plocha.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    P.lupa(+(dok.meritko * (e.deltaY < 0 ? 1.1 : 1 / 1.1)).toFixed(2));
  }, { passive: false });

  P.pravitko = (v) => {
    st.pravitko = v;
    koren.classList.toggle('ps-s-pravitkem', v);
    kresliPravitka();
    obnov();
  };
  koren.classList.toggle('ps-s-pravitkem', st.pravitko);

  function kresliPravitka() {
    if (!st.pravitko || st.rezim !== 'tisk' || !koren.isConnected) return;
    const dpr = devicePixelRatio || 1;
    const tmava = koren.dataset.motiv !== 'barevny' && koren.dataset.motiv !== 'bily';
    const barvy = tmava ? { pozadi: '#2b2b2b', okraj: '#3d3d3d', papir: '#1f1f1f', text: '#c8c8c8' } : { pozadi: '#e9e9e9', okraj: '#c9c9c9', papir: '#fff', text: '#555' };
    const g = dok.g, m = dok.meritko;
    const cm = 10 * MM * m;
    // vodorovné
    const w = pravitkoH.clientWidth, h = pravitkoH.clientHeight;
    if (w && h) {
      pravitkoH.width = w * dpr; pravitkoH.height = h * dpr;
      const c = pravitkoH.getContext('2d');
      c.scale(dpr, dpr);
      c.clearRect(0, 0, w, h);
      const lr = dok.list.getBoundingClientRect(), pr = pravitkoH.getBoundingClientRect();
      const x0 = lr.left - pr.left;
      const L = x0 + g.ml * m, R = x0 + (g.w - g.mr) * m;
      c.fillStyle = barvy.okraj; c.fillRect(x0, 3, g.w * m, h - 6);
      c.fillStyle = barvy.papir; c.fillRect(L, 3, R - L, h - 6);
      c.fillStyle = barvy.text; c.strokeStyle = barvy.text; c.font = '9px Segoe UI, sans-serif'; c.textAlign = 'center';
      for (let i = -Math.floor(g.ml / (10 * MM)) * 4; L + (i / 4) * cm <= x0 + g.w * m; i++) {
        const x = L + (i / 4) * cm;
        if (x < x0) continue;
        if (i % 4 === 0 && i !== 0) c.fillText(String(Math.abs(i / 4)), x, h / 2 + 3);
        else if (i % 2 === 0) { c.beginPath(); c.moveTo(x + 0.5, h / 2 - 3); c.lineTo(x + 0.5, h / 2 + 3); c.stroke(); }
        else { c.beginPath(); c.moveTo(x + 0.5, h / 2 - 1); c.lineTo(x + 0.5, h / 2 + 1); c.stroke(); }
      }
      // značky odsazení
      const b = dok.blokKurzoru();
      const bcs = b ? getComputedStyle(b) : null;
      const ml = (parseFloat(bcs?.marginLeft) || 0) * m, mr = (parseFloat(bcs?.marginRight) || 0) * m, ti = (parseFloat(bcs?.textIndent) || 0) * m;
      c.fillStyle = tmava ? '#9a9a9a' : '#5b5b5b';
      const troj = (x, nahoru) => { c.beginPath(); if (nahoru) { c.moveTo(x - 4.5, h - 5); c.lineTo(x + 4.5, h - 5); c.lineTo(x, h - 10); } else { c.moveTo(x - 4.5, 1); c.lineTo(x + 4.5, 1); c.lineTo(x, 6); } c.fill(); };
      troj(L + ml + ti, false);
      troj(L + ml, true);
      c.fillRect(L + ml - 4.5, h - 5, 9, 4);
      troj(R - mr, true);
    }
    // svislé
    const vw = pravitkoV.clientWidth, vh = pravitkoV.clientHeight;
    if (vw && vh) {
      pravitkoV.width = vw * dpr; pravitkoV.height = vh * dpr;
      const c = pravitkoV.getContext('2d');
      c.scale(dpr, dpr);
      c.clearRect(0, 0, vw, vh);
      const lr = dok.list.getBoundingClientRect(), pr = pravitkoV.getBoundingClientRect();
      const k = Math.max(0, dok.stranaKurzoru() - 1);
      const y0 = lr.top - pr.top + k * g.rozestup * m;
      const T = y0 + g.mt * m, B = y0 + (g.h - g.mb) * m;
      c.fillStyle = barvy.okraj; c.fillRect(3, y0, vw - 6, g.h * m);
      c.fillStyle = barvy.papir; c.fillRect(3, T, vw - 6, B - T);
      c.fillStyle = barvy.text; c.strokeStyle = barvy.text; c.font = '9px Segoe UI, sans-serif'; c.textAlign = 'center';
      for (let i = -Math.floor(g.mt / (10 * MM)) * 4; T + (i / 4) * cm <= y0 + g.h * m; i++) {
        const y = T + (i / 4) * cm;
        if (y < y0 || y < 0 || y > vh) continue;
        if (i % 4 === 0 && i !== 0) { c.save(); c.translate(vw / 2 + 3, y); c.rotate(-Math.PI / 2); c.fillText(String(Math.abs(i / 4)), 0, 0); c.restore(); }
        else if (i % 2 === 0) { c.beginPath(); c.moveTo(vw / 2 - 3, y + 0.5); c.lineTo(vw / 2 + 3, y + 0.5); c.stroke(); }
      }
    }
  }
  plocha.addEventListener('scroll', () => { kresliPravitka(); }, { passive: true });

  P.jenCteni = (zap) => {
    st.jenCteni = zap;
    dok.ed.contentEditable = zap || st.rezim === 'cteni' ? 'false' : 'true';
    listaKonecny.hidden = !zap;
    koren.classList.toggle('ps-jen-cteni', zap);
    obnov();
  };

  // ------------------------------------------------------------ kreslení perem
  P.kreslit = (nastroj) => {
    st.kresleni = nastroj;
    koren.classList.toggle('ps-kreslime', !!nastroj);
    kresba.dataset.nastroj = nastroj?.id || '';
    obnov();
  };
  function kresliKresbu() {
    const tahy = dok.nast.kresba || [];
    kresba.setAttribute('viewBox', `0 0 ${dok.list.offsetWidth || 1} ${dok.list.offsetHeight || 1}`);
    kresba.innerHTML = tahy.map((t, i) => `<path d="${t.d}" data-i="${i}" fill="none" stroke="${t.b}" stroke-width="${t.s}" stroke-linecap="round" stroke-linejoin="round"${t.z ? ' opacity=".45" style="mix-blend-mode:multiply"' : ''}/>`).join('');
  }
  kresba.addEventListener('pointerdown', (e) => {
    const n = st.kresleni;
    if (!n) return;
    e.preventDefault();
    const lr = dok.list.getBoundingClientRect();
    const bod = (ev) => [((ev.clientX - lr.left) / dok.meritko).toFixed(1), ((ev.clientY - lr.top) / dok.meritko).toFixed(1)];
    if (n.id === 'guma') {
      const smaz = (ev) => {
        const p = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.ps-kresba path');
        if (!p) return;
        dok.nast.kresba.splice(+p.dataset.i, 1);
        kresliKresbu();
      };
      smaz(e);
      const konec = () => { removeEventListener('pointermove', smaz); removeEventListener('pointerup', konec); dok.zaznam('Guma'); zmena(); };
      addEventListener('pointermove', smaz);
      addEventListener('pointerup', konec);
      return;
    }
    const body = [bod(e)];
    const cesta = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    Object.entries({ fill: 'none', stroke: n.barva, 'stroke-width': n.sirka, 'stroke-linecap': n.zvyr ? 'square' : 'round', 'stroke-linejoin': 'round', opacity: n.zvyr ? '.45' : '1' }).forEach(([k, v]) => cesta.setAttribute(k, v));
    kresba.append(cesta);
    const d = () => 'M' + body.map((b) => b.join(' ')).join(' L');
    const pohyb = (ev) => { body.push(bod(ev)); cesta.setAttribute('d', d()); };
    const konec = () => {
      removeEventListener('pointermove', pohyb);
      removeEventListener('pointerup', konec);
      if (body.length < 2) body.push([+body[0][0] + 0.5, body[0][1]]);
      dok.nast.kresba = [...(dok.nast.kresba || []), { d: d(), b: n.barva, s: n.sirka, z: n.zvyr }];
      kresliKresbu();
      dok.zaznam('Kreslení');
      zmena();
    };
    addEventListener('pointermove', pohyb);
    addEventListener('pointerup', konec);
  });

  // ------------------------------------------------------------ diktování a předčítání
  let rozpoznavac = null;
  const diktLista = el('div.ps-diktovani', { hidden: true },
    el('span.ps-dikt-mikrofon', {}, ik('diktovat')), el('span.ps-dikt-text', { text: 'Poslouchám…' }),
    el('button.ps-pod-x', { type: 'button', title: 'Zastavit diktování', onclick: () => P.diktovat() }, ik('zavrit')));
  koren.append(diktLista);
  P.diktovat = (jazyk = anglicky() ? 'en-US' : 'cs-CZ') => {
    if (rozpoznavac) { rozpoznavac.stop(); rozpoznavac = null; st.diktovani = false; diktLista.hidden = true; obnov(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return zprava(koren, 'Diktování v tomhle prohlížeči nefunguje. Zkuste Google Chrome nebo Microsoft Edge.', 'Diktovat');
    if (st.jenCteni) return hlaskaJenCteni();
    const r = new SR();
    r.lang = jazyk;
    r.continuous = true;
    r.interimResults = true;
    const text = diktLista.querySelector('.ps-dikt-text');
    r.onresult = (e) => {
      let docasne = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const v = e.results[i];
        if (v.isFinal) {
          let t = v[0].transcript.trim();
          t = t.replace(/ ?(tečka)$/i, '.').replace(/ ?(čárka)$/i, ',').replace(/ ?nový řádek$/i, '\n');
          const pred = dok.aktualniRozsah()?.startContainer.textContent?.slice(0, dok.aktualniRozsah()?.startOffset) || '';
          if (!pred.trim() || /[.!?]\s*$/.test(pred)) t = t.charAt(0).toLocaleUpperCase('cs') + t.slice(1);
          P.prikaz(() => document.execCommand('insertText', false, (pred && !/\s$/.test(pred) ? ' ' : '') + t), 'Diktování');
        } else docasne += v[0].transcript;
      }
      text.textContent = docasne || 'Poslouchám…';
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed') zprava(koren, 'Přístup k mikrofonu je zakázaný. Povolte ho v prohlížeči (ikona zámku v adresním řádku).', 'Diktovat');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') text.textContent = 'Chyba: ' + e.error;
    };
    r.onend = () => { if (rozpoznavac === r) { try { r.start(); } catch { P.diktovat(); } } };
    try { r.start(); } catch (e) { return zprava(koren, e.message); }
    rozpoznavac = r;
    st.diktovani = true;
    diktLista.hidden = false;
    dok.vratVyber();
    obnov();
  };

  const cteniLista = el('div.ps-predcitani', { hidden: true });
  koren.append(cteniLista);
  P.predcitat = () => {
    if (st.predcitani) { speechSynthesis.cancel(); return; }
    if (!window.speechSynthesis) return zprava(koren, 'Předčítání v tomhle prohlížeči nefunguje.');
    const r = dok.aktualniRozsah();
    const kusy = [];
    const w = document.createTreeWalker(dok.ed, NodeFilter.SHOW_TEXT);
    let text = '';
    const odKurzoru = r && !dok.vybranyText;
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (dok.vybranyText && !r.intersectsNode(n)) continue;
      if (odKurzoru && r.comparePoint(n, n.length) < 0) continue;
      const blok = n.parentElement.closest('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, div');
      if (kusy.length && kusy[kusy.length - 1].blok !== blok) text += '\n';
      kusy.push({ n, od: text.length, blok });
      text += n.data;
    }
    if (!text.trim()) text = dok.text;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = dok.ed.lang === 'en' ? 'en-US' : 'cs-CZ';
    const hlas = speechSynthesis.getVoices().find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
    if (hlas) u.voice = hlas;
    u.rate = st.rychlostCteni || 1;
    u.onboundary = (e) => {
      if (!window.CSS?.highlights || e.name !== 'word') return;
      const k = [...kusy].reverse().find((x) => x.od <= e.charIndex);
      if (!k) return;
      const o = e.charIndex - k.od;
      const delka = e.charLength || (text.slice(e.charIndex).match(/^\S+/)?.[0].length || 1);
      try {
        const rr = document.createRange();
        rr.setStart(k.n, Math.min(o, k.n.length));
        rr.setEnd(k.n, Math.min(o + delka, k.n.length));
        CSS.highlights.set('ps-cteni', new Highlight(rr));
        if (e.charIndex % 5 === 0) rr.startContainer.parentElement?.scrollIntoView({ block: 'nearest' });
      } catch { /* mimo uzel */ }
    };
    const konec = () => { st.predcitani = false; cteniLista.hidden = true; CSS.highlights?.delete('ps-cteni'); obnov(); };
    u.onend = konec;
    u.onerror = konec;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    st.predcitani = true;
    cteniLista.hidden = false;
    cteniLista.replaceChildren(
      el('button', { type: 'button', title: 'Pozastavit / pokračovat', text: '⏯', onclick: () => (speechSynthesis.paused ? speechSynthesis.resume() : speechSynthesis.pause()) }),
      el('button', { type: 'button', title: 'Zastavit', text: '⏹', onclick: () => speechSynthesis.cancel() }),
      el('label', {}, 'Rychlost ', el('input', { type: 'range', min: 0.5, max: 2, step: 0.25, value: u.rate, onchange: (e) => { st.rychlostCteni = +e.target.value; } })),
      el('button.ps-pod-x', { type: 'button', title: 'Zavřít', onclick: () => speechSynthesis.cancel() }, ik('zavrit')));
    obnov();
  };

  // ------------------------------------------------------------ klávesy a automatické formátování
  dok.ed.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'historyUndo') { e.preventDefault(); dok.zpet(); obnov(); }
    if (e.inputType === 'historyRedo') { e.preventDefault(); dok.znovu(); obnov(); }
  });

  dok.ed.addEventListener('input', (e) => {
    if (st.obrazek && !dok.ed.contains(st.obrazek)) zobrazUchyt(null);
    if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
      if (dok.ed.querySelector('ol.ps-poznamky') || dok.ed.querySelector('sup.ps-pozn-ref')) {
        const refs = dok.ed.querySelectorAll('sup.ps-pozn-ref').length;
        const lis = dok.ed.querySelectorAll('ol.ps-poznamky > li').length;
        if (refs !== lis) precisluj();
      }
    }
    if (e.inputType !== 'insertText' || e.data !== ' ' || nast().autoformat === false) return;
    const b = dok.blokKurzoru();
    if (!b || !b.matches('p, div') || b.closest('li, td')) return;
    const t = b.textContent.replace(/ /g, ' ');
    const typ = /^[*-] $/.test(t) ? 'ul' : /^(1[.)]) $/.test(t) ? 'ol' : /^a\) $/.test(t) ? 'ola' : null;
    if (!typ) return;
    b.innerHTML = '<br>';
    kurzorDo(b);
    dok.prepniSeznam(typ === 'ul' ? 'ul' : 'ol', typ === 'ola' ? 'lower-alpha' : undefined);
    dok.zaznam('Automatický seznam');
    obnov();
  });

  koren.addEventListener('keydown', (e) => {
    // nechat projít systémové zkratky AstroOS
    if ((e.altKey && (e.key === 'F4' || e.key === 'Tab')) || e.key === 'Meta' || (e.ctrlKey && e.key === 'Escape')) return;
    e.stopPropagation();
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const vEditoru = e.target === dok.ed || dok.ed.contains(e.target);
    const hotovo = () => { e.preventDefault(); };

    if (e.key === 'Escape') {
      if (st.stetec) { P.stetec(); return hotovo(); }
      if (st.zahlavi) { P.zavriZahlavi(); return hotovo(); }
      if (koren.classList.contains('ps-zamereni')) { P.zamereni(false); return hotovo(); }
      if (st.rezim === 'cteni') { P.rezim('tisk'); return hotovo(); }
      if (st.kresleni) { P.kreslit(null); return hotovo(); }
      if (st.obrazek) { zobrazUchyt(null); return; }
      if (!vEditoru) { dok.vratVyber(); return; }
    }
    if (e.altKey && !ctrl && k === 'q') { hledat.focus(); return hotovo(); }
    if (e.key === 'F1') { P.podokno('napoveda'); return hotovo(); }
    if (e.key === 'F7') { P.podokno('editor'); return hotovo(); }
    if (e.key === 'F12') { otevriZakulisi(P, 'ulozitJako'); return hotovo(); }
    if (e.shiftKey && e.key === 'F3') {
      const t = dok.vybranyText;
      zmenVelikostPismen(P, t === t.toLocaleUpperCase('cs') ? 'mala' : t === t.toLocaleLowerCase('cs') ? 'veta' : 'velka');
      return hotovo();
    }
    if (ctrl && e.key === 'F1') { prepniPas(); return hotovo(); }

    if (ctrl && !e.altKey) {
      if (k === 's') { P.ulozit(); return hotovo(); }
      if (k === 'o') { otevriZakulisi(P, 'otevrit'); return hotovo(); }
      if (k === 'n' && !e.shiftKey) { P.novy('prazdny'); return hotovo(); }
      if (k === 'p') { otevriZakulisi(P, 'tisk'); return hotovo(); }
      if (k === 'w') { P.zavritDokument(); return hotovo(); }
      if (k === 'f') { P.podokno('navigace', { hledat: true }); return hotovo(); }
      if (k === 'h') { D.dialogNahradit(P, 'nahradit'); return hotovo(); }
      if (k === 'g') { D.dialogNahradit(P, 'prejit'); return hotovo(); }
      if (k === 'z' && !e.shiftKey) { dok.zpet(); obnov(); return hotovo(); }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { dok.znovu(); obnov(); return hotovo(); }
    }
    if (!vEditoru) return;
    if (st.jenCteni && !ctrl && !['Arrow', 'Page', 'Home', 'End'].some((x) => e.key.startsWith(x))) { if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') { hotovo(); } return; }

    if (ctrl && !e.altKey) {
      const exec = (c, v = null, p = c) => { P.prikaz(() => document.execCommand(c, false, v), p); hotovo(); };
      if (k === 'b') return exec('bold', null, 'Tučné');
      if (k === 'i') return exec('italic', null, 'Kurzíva');
      if (k === 'u') return exec('underline', null, 'Podtržení');
      if (k === 'e') return exec('justifyCenter', null, 'Zarovnat na střed');
      if (k === 'l' && !e.shiftKey) return exec('justifyLeft', null, 'Zarovnat doleva');
      if (k === 'l' && e.shiftKey) { P.prikaz(() => dok.prepniSeznam('ul'), 'Odrážky'); return hotovo(); }
      if (k === 'r') return exec('justifyRight', null, 'Zarovnat doprava');
      if (k === 'j') return exec('justifyFull', null, 'Zarovnat do bloku');
      if (k === 'k') { D.dialogOdkaz(P); return hotovo(); }
      if (e.key === 'Enter') { P.konecStranky(); return hotovo(); }
      if (e.shiftKey && k === 'n') { aplikujStyl(P, 'p'); return hotovo(); }
      if (e.shiftKey && k === 'c') { P.stetec(); return hotovo(); }
      if (e.code === 'Space') { P.prikaz(() => document.execCommand('removeFormat'), 'Vymazat formát'); return hotovo(); }
      if (e.shiftKey && e.code === 'Digit8') { P.prepniZnacky(); return hotovo(); }
      if (e.shiftKey && e.code === 'Period') { const b = obsahyKaret.domu.querySelector('[title^="Zvětšit písmo"]'); b?.click(); return hotovo(); }
      if (e.shiftKey && e.code === 'Comma') { const b = obsahyKaret.domu.querySelector('[title^="Zmenšit písmo"]'); b?.click(); return hotovo(); }
      if (e.code === 'BracketRight' || e.code === 'BracketLeft') {
        const v = (P.stav.velikost || 12) + (e.code === 'BracketRight' ? 1 : -1);
        dok.velikostCeka = Math.max(1, v);
        P.prikaz(() => { document.execCommand('fontSize', false, '7'); dok.normalizuj(); }, 'Velikost písma');
        return hotovo();
      }
      if (e.code === 'Equal') return exec(e.shiftKey ? 'superscript' : 'subscript', null, 'Index');
    }
    if (ctrl && e.altKey) {
      if (['1', '2', '3'].includes(e.key)) { aplikujStyl(P, 'h' + e.key); return hotovo(); }
      if (e.key === 'm' || e.key === 'M') { P.novyKomentar(); return hotovo(); }
      if (e.key === 'f' || e.key === 'F') { P.vlozPoznamku(); return hotovo(); }
    }

    if (e.key === 'Tab' && !ctrl && !e.altKey) {
      hotovo();
      const bunka = dok.prvekKurzoru()?.closest('td, th');
      if (bunka) {
        const vse = [...bunka.closest('table').querySelectorAll('td, th')];
        let i = vse.indexOf(bunka) + (e.shiftKey ? -1 : 1);
        if (i >= vse.length) { P.upravTabulku('radekPod'); return; }
        i = Math.max(0, i);
        const r = document.createRange();
        r.selectNodeContents(vse[i]);
        dok.nastavRozsah(r);
        return;
      }
      if (dok.prvekKurzoru()?.closest('li')) { P.prikaz(() => document.execCommand(e.shiftKey ? 'outdent' : 'indent'), 'Odsazení'); return; }
      if (!e.shiftKey) P.prikaz(() => document.execCommand('insertText', false, '\t'), 'Tabulátor');
      return;
    }
    if (e.key === '"' && !ctrl && nast().autoformat !== false) {
      const r = dok.aktualniRozsah();
      if (!r) return;
      const pred = r.startContainer.nodeType === 3 ? r.startContainer.data.slice(0, r.startOffset) : '';
      const znak = !pred || /[\s(\[{„]$/.test(pred) ? '„' : '“';
      hotovo();
      document.execCommand('insertText', false, znak);
      return;
    }
    if (e.key === 'Enter' && e.shiftKey && !ctrl) { hotovo(); document.execCommand('insertLineBreak'); }
  });

  // pravé tlačítko v dokumentu — nabídka jako ve Wordu
  dok.ed.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const vyber = dok.vybranyText;
    const a = e.target.closest('a[href]');
    const img = e.target.closest('img');
    const bunka = e.target.closest('td, th');
    const kotva = el('div', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } });
    document.body.append(kotva);
    const mini = el('div.ps-minilista', {},
      [['tucne', 'bold', 'Tučné'], ['kurziva', 'italic', 'Kurzíva'], ['podtrzeni', 'underline', 'Podtržení']].map(([i, c, t]) =>
        el('button.ps-b.male', { type: 'button', title: t, onclick: () => { zavriRozbal(); P.prikaz(() => document.execCommand(c), t); } }, ik(i))),
      el('button.ps-b.male', { type: 'button', title: 'Zvýraznění', onclick: () => { zavriRozbal(); P.prikaz(() => document.execCommand('hiliteColor', false, '#FFFF00'), 'Zvýraznění'); } }, ik('zvyraznovac')),
      el('button.ps-b.male', { type: 'button', title: 'Nový komentář', onclick: () => { zavriRozbal(); P.novyKomentar(); } }, ik('komentar')));
    const polozky = [
      { text: 'Vyjmout', ikona: 'vyjmout', zakazano: !vyber, akce: () => P.prikaz(() => document.execCommand('cut'), 'Vyjmout') },
      { text: 'Kopírovat', ikona: 'kopirovat', zakazano: !vyber, akce: () => { dok.vratVyber(); document.execCommand('copy'); } },
      { text: 'Možnosti vložení:', ikona: 'vlozit', akce: () => P.vlozit(false) },
      'sep',
      ...(a ? [{ text: 'Otevřít hypertextový odkaz', ikona: 'odkaz', akce: () => openApp('browser', { url: a.getAttribute('href') }) }, { text: 'Upravit hypertextový odkaz…', ikona: 'tuzka', akce: () => D.dialogOdkaz(P) }] : []),
      ...(img ? [{ text: 'Alternativní text…', ikona: 'textovePole', akce: () => { zobrazUchyt(img); D.dialogAlt(P); } }, { text: 'Obtékání textu', ikona: 'obtekani', akce: () => { zobrazUchyt(img); prepniKartu('obrazek'); } }] : []),
      ...(bunka ? [
        { text: 'Vložit řádek nad', ikona: 'vlozitNad', akce: () => P.upravTabulku('radekNad') },
        { text: 'Vložit řádek pod', ikona: 'vlozitPod', akce: () => P.upravTabulku('radekPod') },
        { text: 'Odstranit řádek', ikona: 'odstranit', akce: () => P.upravTabulku('smazRadek') },
        'sep'] : []),
      { text: 'Písmo…', ikona: 'barvaPisma', akce: () => D.dialogPismo(P) },
      { text: 'Odstavec…', ikona: 'radkovani', akce: () => D.dialogOdstavec(P) },
      ...(vyber ? [{ text: `Hledat „${vyber.slice(0, 20)}${vyber.length > 20 ? '…' : ''}“`, ikona: 'najitMaly', akce: () => P.podokno('navigace', { hledat: vyber.slice(0, 60) }) }] : []),
      { text: 'Zeptat se AstroAI', ikona: 'astroai', akce: () => P.podokno('ai') },
      'sep',
      { text: 'Odkaz', ikona: 'odkaz', akce: () => D.dialogOdkaz(P) },
      { text: 'Nový komentář', ikona: 'komentarNovy', akce: () => P.novyKomentar() },
    ];
    rozbal(kotva, el('div.ps-kontext', {}, mini, nabidka(polozky, { sirka: 240 })), { poZavreni: () => kotva.remove(), tema: koren.dataset.motiv });
  });

  // ------------------------------------------------------------ velikost okna
  const ro = new ResizeObserver(() => { prizpusob(); kresliPravitka(); polohaUchytu(); });
  ro.observe(koren);

  P.znic = () => {
    ro.disconnect();
    motivSledovac.disconnect();
    dok.znic();
    rozpoznavac?.stop();
    if (st.predcitani) speechSynthesis.cancel();
    aiRizeni?.abort();
    zavriRozbal();
    zrusZvyrazneni();
    CSS.highlights?.delete('ps-cteni');
  };

  // ------------------------------------------------------------ start
  prepniKartu('domu');
  obnovTitulek();
  if (win.opts?.path) P.otevri(win.opts.path);
  else if (win.opts?.sablona) P.novy(win.opts.sablona);
  else otevriZakulisi(P, 'domu');
  return P;
}

// ---------------------------------------------------------------- převody
function rgbNaHex(c) {
  const m = c.match(/\d+/g);
  return m ? '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('') : '#000000';
}

function htmlNaMd(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  const inline = (n) => [...n.childNodes].map((c) => {
    if (c.nodeType === 3) return c.data;
    const t = inline(c);
    if (c.matches('b, strong') || +c.style?.fontWeight >= 600) return `**${t}**`;
    if (c.matches('i, em') || c.style?.fontStyle === 'italic') return `*${t}*`;
    if (c.matches('a[href]')) return `[${t}](${c.getAttribute('href')})`;
    if (c.matches('br')) return '  \n';
    return t;
  }).join('');
  const out = [];
  for (const b of d.children) {
    const tag = b.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag)) out.push('#'.repeat(+tag[1] + 1) + ' ' + inline(b));
    else if (tag === 'h5') out.push('# ' + inline(b));
    else if (tag === 'h6') out.push('_' + inline(b) + '_');
    else if (tag === 'ul') out.push([...b.children].map((li) => '- ' + inline(li)).join('\n'));
    else if (tag === 'ol') out.push([...b.children].map((li, i) => `${i + 1}. ` + inline(li)).join('\n'));
    else if (tag === 'blockquote') out.push('> ' + inline(b));
    else if (tag === 'table') {
      const r = [...b.rows].map((tr) => '| ' + [...tr.cells].map((c) => c.textContent.trim()).join(' | ') + ' |');
      if (r.length) r.splice(1, 0, '|' + ' --- |'.repeat(b.rows[0].cells.length));
      out.push(r.join('\n'));
    } else if (tag === 'hr') out.push('---');
    else out.push(inline(b));
  }
  return out.join('\n\n').replace(/ /g, ' ') + '\n';
}

function mdNaHtml(md) {
  const e = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  const out = [];
  let seznam = null;
  for (const r of md.split(/\r?\n/)) {
    const li = r.match(/^\s*(?:[-*]|(\d+)\.)\s+(.*)/);
    if (li) {
      const typ = li[1] ? 'ol' : 'ul';
      if (seznam?.typ !== typ) { if (seznam) out.push(`</${seznam.typ}>`); out.push(`<${typ}>`); seznam = { typ }; }
      out.push(`<li>${e(li[2])}</li>`);
      continue;
    }
    if (seznam) { out.push(`</${seznam.typ}>`); seznam = null; }
    const h = r.match(/^(#{1,4})\s+(.*)/);
    if (h) out.push(h[1].length === 1 ? `<h5>${e(h[2])}</h5>` : `<h${h[1].length - 1}>${e(h[2])}</h${h[1].length - 1}>`);
    else if (/^>\s?/.test(r)) out.push(`<blockquote>${e(r.replace(/^>\s?/, ''))}</blockquote>`);
    else if (r.trim()) out.push(`<p>${e(r)}</p>`);
  }
  if (seznam) out.push(`</${seznam.typ}>`);
  return out.join('') || '<p><br></p>';
}
