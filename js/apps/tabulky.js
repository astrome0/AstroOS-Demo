// AstroOS — AstroTabulky, tabulkový procesor jako Microsoft Excel (Microsoft 365, 2025)
//
// Části v js/tabulky/: sesit.js (model, přepočet, historie), vzorce.js (vzorce a funkce),
// format.js (čísla a data), mrizka.js + kresleni.js (plátno a editace), pas.js (pás karet),
// prikazy.js (příkazy), dialogy.js, podokna.js, objekty.js (grafy a obrázky na listu),
// zakulisi.js (karta Soubor), sablony.js. Tady je lepidlo: okno, řádek vzorců, listy, stavový řádek.

import { el, bus } from '../util.js';
import * as FS from '../fs.js';
import { State } from '../state.js';
import { toast } from '../ui.js';
import { ik } from '../pismo/ikony.js';
import '../tabulky/ikony.js';
import { rozbal, zavriRozbal, nabidka, dialog, zprava, pole } from '../pismo/ui.js';
import { prizpusobKartu } from '../pismo/pas.js';
import { Sesit, ChybaUpravy } from '../tabulky/sesit.js';
import { Mrizka, setCaret, obarvi } from '../tabulky/mrizka.js';
import { KARTY_TB, postavKartyTb } from '../tabulky/pas.js';
import { pridejPrikazy } from '../tabulky/prikazy.js';
import { pridejObjekty } from '../tabulky/objekty.js';
import { pridejPodokna } from '../tabulky/podokna.js';
import { otevriZakulisi } from '../tabulky/zakulisi.js';
import { SABLONY_TB } from '../tabulky/sablony.js';
import * as D from '../tabulky/dialogy.js';
import { adresa, textOblasti, rozeberOblast, MAX_R, MAX_C, pismena, klic } from '../tabulky/adresy.js';
import { formatuj, jeChyba, obecne } from '../tabulky/format.js';

const openApp = (id, o) => import('../apps.js').then((m) => m.openApp(id, o));
let citacSesitu = 0;

export const tabulkyApp = {
  id: 'tabulky', name: 'AstroTabulky', icon: 'tabulky', color: 'linear-gradient(145deg,#33c481,#107c41)',
  cat: 'office', width: 1240, height: 800,
  mount(body, win) { win.P = vytvor(body, win); },
  reopen(win, opts) {
    if (opts?.path) win.P?.otevri(opts.path);
    else if (opts?.sablona) win.P?.novy(opts.sablona);
  },
  unmount(win) { win.P?.znic(); },
  muzeZavrit(win) { return win.P ? win.P.muzeZavrit() : true; },
};

function vytvor(body, win) {
  const nast = () => State.get('tabulky') || {};
  const st = {
    cesta: null, nazev: 'Sešit1', dirty: false, otevreno: false, meta: {}, otevrenoOd: Date.now(),
    karta: 'domu', pasSkryty: false, autoUkladani: !!nast().autoUkladani, ukladani: null, zavrit: false,
    zobrazeni: 'normalni', podokno: null, radekVzorcu: nast().radekVzorcu !== false, rozbalenyRadek: false,
    rezim: 'Připraven', stetec: null, objekt: null,
  };
  const koren = el('div.ps.tb', { dataset: { motiv: 'barevny', app: 'tabulky' } });
  win.node.dataset.psApp = 'tabulky';
  const P = {
    win, koren, st, prikazy: [], stavy: [], obnovy: [], stav: {},
    S: new Sesit(),
    schranka: null,
  };
  // pás karet z Písma volá P.dok.vratVyber() — tady vrací fokus do mřížky
  P.dok = { vratVyber: () => P.grid?.fokus() };

  // ------------------------------------------------------------ titulek okna (jako Excel)
  const lista = win.node.querySelector('.win-bar');
  win.node.classList.add('ps-okno', 'tb-okno');
  const zastav = (u) => {
    u.addEventListener('pointerdown', (e) => e.stopPropagation());
    u.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
    u.addEventListener('dblclick', (e) => e.stopPropagation());
    return u;
  };
  const prepinac = el('button.ps-auto-prepinac', { type: 'button', role: 'switch', title: 'Automatické ukládání' }, el('span.ps-auto-kulicka'), el('span.ps-auto-text'));
  const bUlozit = el('button.ps-t-b', { type: 'button', title: 'Uložit (Ctrl+S)', onclick: () => P.ulozit() }, ik('ulozit'));
  const bZpet = el('button.ps-t-b', { type: 'button', title: 'Zpět (Ctrl+Z)', onclick: () => P.zpet() }, ik('zpet'));
  const bZpetSipka = el('button.ps-t-b.sipka', { type: 'button', title: 'Zpět' }, ik('sipkaDolu'));
  const bZnovu = el('button.ps-t-b', { type: 'button', title: 'Znovu (Ctrl+Y)', onclick: () => P.znovu() }, ik('znovu'));
  const bPrizpusobit = el('button.ps-t-b.sipka', { type: 'button', title: 'Přizpůsobit panel nástrojů Rychlý přístup' }, ik('sipkaDolu'));
  const nazevDok = el('button.ps-t-nazev', { type: 'button' }, el('span.ps-t-jmeno'), el('span.ps-t-stav'), ik('sipkaDolu'));
  const hledat = el('input.ps-t-hledat-vstup', { type: 'text', placeholder: 'Hledat (Alt+Q)', spellcheck: 'false' });
  const hledatBox = el('div.ps-t-hledat', {}, ik('najitMaly'), hledat);
  const ucet = el('button.ps-t-ucet', { type: 'button', title: 'Účet' }, el('span.ps-t-ucet-jmeno'), el('span.ps-avatar'));
  const levo = el('div.ps-t-levo', {},
    el('div.ps-t-logo.tb-logo', { title: 'AstroTabulky' }, el('span', { text: 'T' })),
    el('span.ps-t-auto-popis', { text: 'Automatické ukládání' }), prepinac,
    bUlozit, el('div.ps-t-skupina', {}, bZpet, bZpetSipka), bZnovu, bPrizpusobit, nazevDok);
  [levo, hledatBox, ucet].forEach(zastav);
  const tah = lista.querySelector('.drag');
  lista.insertBefore(levo, tah);
  tah.after(hledatBox, el('div.drag'));
  lista.insertBefore(ucet, lista.querySelector('.win-ctl'));

  prepinac.onclick = () => {
    if (!st.autoUkladani && !st.cesta) { P.rychleUlozeni(() => { st.autoUkladani = true; obnovTitulek(); }); return; }
    st.autoUkladani = !st.autoUkladani;
    if (st.autoUkladani && st.dirty) P.ulozit();
    obnovTitulek();
  };
  bZpetSipka.onclick = () => {
    const h = P.S.historie;
    const kroky = h.list.slice(1, h.i + 1).reverse();
    if (!kroky.length) return;
    rozbal(bZpetSipka, nabidka(kroky.slice(0, 20).map((k, i) => ({ text: k.popis || 'Úprava', akce: () => P.zpet(i + 1) })), { sirka: 220 }));
  };
  bPrizpusobit.onclick = () => rozbal(bPrizpusobit, nabidka([
    { nadpis: 'Přizpůsobit panel nástrojů Rychlý přístup' },
    { text: 'Nový', ikona: 'novy', akce: () => P.novy('prazdny') },
    { text: 'Otevřít', ikona: 'otevrit', akce: () => otevriZakulisi(P, 'otevrit') },
    { text: 'Uložit', ikona: 'ulozit', zaskrtnuto: true, akce: () => P.ulozit() },
    { text: 'Tisk', ikona: 'tisk', akce: () => otevriZakulisi(P, 'tisk') },
    { text: 'Zpět', ikona: 'zpet', zaskrtnuto: true, akce: () => P.zpet() },
    { text: 'Znovu', ikona: 'znovu', zaskrtnuto: true, akce: () => P.znovu() },
    { text: 'Seřadit vzestupně', ikona: 'seraditAZ', akce: () => P.seraditRychle(true) },
    { text: 'Seřadit sestupně', ikona: 'seraditZA', akce: () => P.seraditRychle(false) },
    'sep',
    { text: st.pasSkryty ? 'Zobrazit pás karet' : 'Skrýt pás karet', akce: () => prepniPas() },
  ], { sirka: 260 }));
  nazevDok.onclick = () => {
    const jmeno = el('input.ps-vstup', { value: st.nazev.replace(/\.[^.]+$/, '') });
    const obsah = el('div.ps-t-popover', {},
      el('b', { text: st.cesta ? 'Uloženo do: Tento počítač' : 'Tento sešit ještě není uložený' }),
      pole('Název souboru', jmeno),
      st.cesta ? el('div.ps-t-pop-umisteni', {}, el('span', { text: 'Umístění' }), el('div', {}, ik('slozka'), el('span', { text: FS.dirname(st.cesta).replace(FS.HOME, 'Domů') }))) : null,
      el('div.ps-nab-sep'),
      nabidka([{ text: 'Historie verzí', ikona: 'verze', akce: () => otevriZakulisi(P, 'informace') }]));
    jmeno.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); P.prejmenujSoubor(jmeno.value.trim()); zavriRozbal(); P.grid.fokus(); }
    });
    rozbal(nazevDok, obsah);
    setTimeout(() => { jmeno.focus(); jmeno.select(); }, 30);
  };
  ucet.onclick = () => rozbal(ucet, el('div.ps-t-ucet-karta', {},
    el('div.ps-t-ucet-hlava', {}, el('span', { text: 'AstroOS' }), el('button.ps-zk-odkaz', { type: 'button', text: 'Odhlásit se', onclick: () => { zavriRozbal(); bus.emit('power', 'logout'); } })),
    el('div.ps-zk-autor.velky', {}, el('span.ps-avatar', { text: P.inicialy() }), el('div', {}, el('b', { text: P.autor() }), el('small', { text: 'Místní účet' }),
      el('button.ps-zk-odkaz', { type: 'button', text: 'Zobrazit účet', onclick: () => { zavriRozbal(); otevriZakulisi(P, 'ucet'); } })))), { zarovnat: 'vpravo' });

  hledat.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { hledat.value = ''; hledat.blur(); P.grid.fokus(); zavriRozbal(); }
    if (e.key === 'Enter') document.querySelector('.ps-hledani-vysledky .ps-nab-polozka')?.click();
  });
  hledat.addEventListener('input', () => ukazHledani());
  hledat.addEventListener('focus', () => ukazHledani());
  function ukazHledani() {
    const q = hledat.value.trim().toLocaleLowerCase('cs');
    const videne = new Set();
    const navrhy = ['Vložit funkci…', 'Podmíněné formátování', 'Formátovat jako tabulku', 'Filtr', 'Doporučené grafy', 'Ukotvit příčky', 'Kontingenční tabulka'];
    const shody = (q ? P.prikazy.filter((p) => p.text.toLocaleLowerCase('cs').includes(q)) : P.prikazy.filter((p) => navrhy.includes(p.text)))
      .filter((p) => (videne.has(p.text) ? false : videne.add(p.text))).slice(0, 8);
    const polozky = [
      { nadpis: q ? 'Nejlepší výsledek' : 'Navrhované akce' },
      ...shody.map((p) => ({ text: p.text, ikona: p.ikona, klavesa: p.klavesa, akce: () => { hledat.value = ''; hledat.blur(); P.grid.fokus(); p.akce(); } })),
    ];
    if (q) polozky.push('sep', { text: `Najít „${hledat.value.trim()}“ v sešitu`, ikona: 'najitMaly', akce: () => { const t = hledat.value.trim(); hledat.value = ''; D.dialogNajit(P, 'najit', t); } });
    if (q && !shody.length) polozky.splice(1, 0, { text: 'Žádné akce neodpovídají', zakazano: true });
    zavriRozbal();
    const u = rozbal(hledatBox, nabidka(polozky, { sirka: Math.max(320, hledatBox.offsetWidth) }));
    u?.classList.add('ps-hledani-vysledky');
  }

  // ------------------------------------------------------------ pás karet
  const kartyRadek = el('div.ps-karty');
  const pasTelo = el('div.ps-pas-telo');
  const pas = el('div.ps-pas', {}, kartyRadek, pasTelo);
  P.pas = pasTelo;
  const tlKaret = {};
  let obsahyKaret = {};
  const soubor = el('button.ps-karta.soubor', { type: 'button', text: 'Soubor', onclick: () => otevriZakulisi(P, 'domu') });
  kartyRadek.append(soubor);
  for (const k of KARTY_TB) {
    const b = el('button.ps-karta' + (k.kontext ? '.kontext' : ''), { type: 'button', text: k.nazev, dataset: { karta: k.id } });
    b.onclick = () => { if (st.pasSkryty || koren.classList.contains('tb-nizke')) pas.classList.add('docasne'); prepniKartu(k.id); };
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('dblclick', () => prepniPas());
    tlKaret[k.id] = b;
    kartyRadek.append(b);
  }
  const bKomentare = el('button.ps-karta-tl', { type: 'button', title: 'Komentáře' }, ik('komentar'), el('span', { text: 'Komentáře' }));
  const bSdilet = el('button.ps-karta-tl.sdilet', { type: 'button', title: 'Sdílet' }, ik('sdilet'), el('span', { text: 'Sdílet' }), ik('sipkaDolu'));
  kartyRadek.append(el('div.ps-karty-mezera'), bKomentare, bSdilet);
  [bKomentare, bSdilet].forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
  bKomentare.onclick = () => P.podokno(st.podokno === 'komentare' ? null : 'komentare');
  bSdilet.onclick = () => otevriZakulisi(P, 'sdilet');
  const bPasMoznosti = el('button.ps-pas-moznosti', { type: 'button', title: 'Možnosti zobrazení pásu karet' }, ik('sipkaDolu'));
  bPasMoznosti.addEventListener('mousedown', (e) => e.preventDefault());
  bPasMoznosti.onclick = () => rozbal(bPasMoznosti, nabidka([
    { nadpis: 'Zobrazit pás karet' },
    { text: 'Režim na celou obrazovku', akce: () => P.celaObrazovka(true) },
    { text: 'Zobrazit jen karty', zaskrtnuto: st.pasSkryty, akce: () => { if (!st.pasSkryty) prepniPas(); } },
    { text: 'Vždy zobrazovat pás karet', zaskrtnuto: !st.pasSkryty, akce: () => { if (st.pasSkryty) prepniPas(); } },
  ], { sirka: 240 }), { zarovnat: 'vpravo' });

  function prepniKartu(id) {
    st.karta = id;
    for (const [k, b] of Object.entries(tlKaret)) b.classList.toggle('aktivni', k === id);
    for (const o of Object.values(obsahyKaret)) o.classList.remove('aktivni');
    const o = obsahyKaret[id];
    if (!o) return;
    o.classList.add('aktivni');
    pasTelo.replaceChildren(o, bPasMoznosti);
    obnov();
    prizpusob();
  }
  P.prepniKartu = prepniKartu;
  function prizpusob() {
    const o = obsahyKaret[st.karta];
    if (o && pasTelo.clientWidth) prizpusobKartu(o, pasTelo.clientWidth - 28);
  }
  function prepniPas() {
    st.pasSkryty = !st.pasSkryty;
    pas.classList.toggle('skryty', st.pasSkryty);
    pas.classList.remove('docasne');
  }
  P.prepniPas = prepniPas;

  // ------------------------------------------------------------ řádek vzorců
  const poleNazvu = el('input.tb-pole-nazvu-vstup', { type: 'text', spellcheck: 'false', title: 'Pole názvů' });
  const bNazvy = el('button.tb-pole-nazvu-sipka', { type: 'button', title: 'Pole názvů' }, ik('sipkaDolu'));
  const bZrusit = el('button.tb-rv-b', { type: 'button', title: 'Zrušit', disabled: true }, ik('zrusitX'));
  const bPotvrdit = el('button.tb-rv-b', { type: 'button', title: 'Zadat', disabled: true }, ik('potvrdit'));
  const bFx = el('button.tb-rv-b', { type: 'button', title: 'Vložit funkci' }, ik('fx'));
  const radekVzorcu = el('div.tb-rv', { contenteditable: 'plaintext-only', spellcheck: 'false', role: 'textbox', 'aria-label': 'Řádek vzorců' });
  const bRozbalit = el('button.tb-rv-rozbal', { type: 'button', title: 'Rozbalit řádek vzorců (Ctrl+Shift+U)' }, ik('rozbalit'));
  const radek = el('div.tb-radek', {},
    el('div.tb-pole-nazvu', {}, poleNazvu, bNazvy),
    el('div.tb-rv-oddel', {}, el('span'), el('span'), el('span')),
    el('div.tb-rv-tlacitka', {}, bZrusit, bPotvrdit, bFx),
    el('div.tb-rv-ram', {}, radekVzorcu), bRozbalit);
  radek.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  P.radekVzorcu = radekVzorcu;

  // ------------------------------------------------------------ plocha, listy, stavový řádek
  const plocha = el('div.tb-plocha');
  const podoknoP = el('aside.ps-podokno.vpravo.tb-podokno', { hidden: true });
  const stred = el('div.tb-stred', {}, plocha, podoknoP);
  P.podoknoUzel = podoknoP;

  const bListVlevo = el('button.tb-listy-sipka', { type: 'button', title: 'Posunout na předchozí list. Klikněte pravým tlačítkem pro seznam listů.' }, ik('predchozi'));
  const bListVpravo = el('button.tb-listy-sipka', { type: 'button', title: 'Posunout na další list' }, ik('dalsi'));
  const zalozky = el('div.tb-zalozky');
  const bNovyList = el('button.tb-novy-list', { type: 'button', title: 'Nový list (Shift+F11)' }, ik('plus'));
  const hscroll = el('div.tb-hscroll', {}, el('div.tb-hscroll-rozmer'));
  const tahloListu = el('div.tb-listy-tahlo', { title: 'Změnit šířku oblasti karet listů' });
  const listy = el('div.tb-listy', {}, el('div.tb-listy-nav', {}, bListVlevo, bListVpravo), zalozky, bNovyList, tahloListu, hscroll);
  listy.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });

  const sRezim = el('span.ps-s-pol.tb-s-rezim', { text: 'Připraven' });
  const sPristupnost = el('button.ps-s-pol', { type: 'button', title: 'Kontrola přístupnosti' }, ik('pristupnost'), el('span', { text: 'Přístupnost: Vše je v pořádku' }));
  const sVypocet = el('button.ps-s-pol', { type: 'button', text: '', hidden: true });
  const sSouhrn = el('button.ps-s-pol.tb-s-souhrn', { type: 'button', title: 'Klikněte pravým tlačítkem pro výběr zobrazených hodnot' });
  const sRezimy = ['normalni', 'rozlozeni', 'konce'].map((r) => el('button.ps-s-rezim', {
    type: 'button', dataset: { r }, title: { normalni: 'Normální', rozlozeni: 'Rozložení stránky', konce: 'Zobrazení konců stránek' }[r], onclick: () => P.zobrazeni(r),
  }, ik({ normalni: 'normalni', rozlozeni: 'rozlozeniStranky', konce: 'konceStranek' }[r])));
  const zoomPosuvnik = el('input.ps-s-zoom', { type: 'range', min: 0, max: 100, step: 1, value: 50, title: 'Lupa' });
  const zoomText = el('button.ps-s-pol.zoom-proc', { type: 'button', title: 'Úroveň lupy' });
  const stavovy = el('footer.ps-stav', {},
    el('div.ps-s-levo', {}, sRezim, sPristupnost, sVypocet),
    el('div.ps-s-pravo', {}, sSouhrn, el('div.ps-s-rezimy', {}, sRezimy),
      el('button.ps-s-pm', { type: 'button', text: '−', title: 'Oddálit', onclick: () => P.lupa(Math.max(0.1, +(P.S.list.zoom - 0.1).toFixed(2))) }),
      zoomPosuvnik,
      el('button.ps-s-pm', { type: 'button', text: '+', title: 'Přiblížit', onclick: () => P.lupa(Math.min(4, +(P.S.list.zoom + 0.1).toFixed(2))) }),
      zoomText));
  stavovy.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
  const zoomNaHodnotu = (v) => (v <= 50 ? 0.1 + (v / 50) * 0.9 : 1 + ((v - 50) / 50) * 3);
  const hodnotaZoomu = (z) => (z <= 1 ? ((z - 0.1) / 0.9) * 50 : 50 + ((z - 1) / 3) * 50);
  zoomPosuvnik.oninput = () => { const v = +zoomPosuvnik.value; P.lupa(Math.abs(v - 50) < 3 ? 1 : +zoomNaHodnotu(v).toFixed(2)); };
  zoomText.onclick = () => D.dialogLupa(P);
  sPristupnost.onclick = () => P.podokno('pristupnost');
  sVypocet.onclick = () => P.prepocitat();
  const souhrnVolby = () => ({ prumer: true, pocet: true, soucet: true, ...(nast().souhrn || {}) });
  sSouhrn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const v = souhrnVolby();
    const pol = [['prumer', 'Průměr'], ['pocet', 'Počet'], ['pocetCisel', 'Počet čísel'], ['min', 'Minimum'], ['max', 'Maximum'], ['soucet', 'Součet']];
    rozbal(sSouhrn, nabidka([{ nadpis: 'Přizpůsobit stavový řádek' }, ...pol.map(([k, t]) => ({ text: t, zaskrtnuto: !!v[k], akce: () => { P.ulozNastaveni({ souhrn: { ...v, [k]: !v[k] } }); obnovSouhrn(); } }))], { sirka: 220 }), { nad: true, zarovnat: 'vpravo' });
  });
  sSouhrn.onclick = async () => { try { await navigator.clipboard.writeText(sSouhrn.dataset.hodnota || ''); P.toast('Hodnota zkopírována do schránky'); } catch { /* bez schránky */ } };

  koren.append(pas, radek, stred, listy, stavovy);
  body.append(koren);

  // ------------------------------------------------------------ mřížka
  const grid = new Mrizka(P);
  P.grid = grid;
  plocha.append(grid.uzel);
  // dočasně rozbalený pás karet (skrytý nebo v nízkém okně) se kliknutím do listu zase schová
  stred.addEventListener('pointerdown', () => pas.classList.remove('docasne'), true);

  // svázat vodorovný posuvník v liště listů s mřížkou
  let synchronizace = false;
  const hRozmer = hscroll.firstChild;
  grid.scroll.addEventListener('scroll', () => {
    if (synchronizace) { synchronizace = false; return; }
    hRozmer.style.width = grid.rozmer.style.width;
    if (hscroll.scrollLeft !== grid.scroll.scrollLeft) { synchronizace = true; hscroll.scrollLeft = grid.scroll.scrollLeft; }
  });
  hscroll.addEventListener('scroll', () => {
    if (synchronizace) { synchronizace = false; return; }
    if (grid.scroll.scrollLeft !== hscroll.scrollLeft) { synchronizace = true; grid.scroll.scrollLeft = hscroll.scrollLeft; }
  });
  P.poKresleni = () => {
    hRozmer.style.width = grid.rozmer.style.width;
    hscroll.style.setProperty('--vlevo', grid.zahlaviSirka + 'px');
    P.umistiSipkuOvereni?.();
  };
  // šířka oblasti karet
  tahloListu.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = hscroll.offsetWidth;
    const mv = (ev) => { hscroll.style.flexBasis = Math.max(80, Math.min(listy.offsetWidth - 180, w0 - (ev.clientX - x0))) + 'px'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
  });

  // ------------------------------------------------------------ příkazy, objekty, podokna
  pridejPrikazy(P);
  pridejObjekty(P);
  pridejPodokna(P);
  obsahyKaret = postavKartyTb(P);

  // ------------------------------------------------------------ obnova UI
  let obnovaCeka = 0;
  function planujObnovu() {
    if (obnovaCeka) return;
    obnovaCeka = requestAnimationFrame(() => { obnovaCeka = 0; obnov(); });
  }
  P.planujObnovu = planujObnovu;

  function spocitejStav() {
    const S = P.S, l = S.list, v = l.vyber;
    const s = S.stylBunky(l, v.r, v.c) || {};
    const val = S.hodnota(l, v.r, v.c);
    return {
      s, pismo: s.font || 'Aptos Narrow', velikost: s.vel || 11, tucne: !!s.b, kurziva: !!s.i, podtrzeni: s.u || null, preskrtnuti: !!s.st,
      h: s.h || null, v: s.v || 'b', zalam: !!s.zalam, nf: s.nf || 'General', hodnota: val,
      slouceno: !!S.sloucenaV(l, v.r, v.c),
      tabulka: S.tabulkaV(l, v.r, v.c),
    };
  }

  function obnov() {
    if (!koren.isConnected) return;
    P.stav = spocitejStav();
    for (const s of P.stavy) {
      let z = false;
      try { z = s.fn(); } catch { /* nic */ }
      if (z !== null) s.uzel.classList.toggle('zapnuto', !!z);
    }
    for (const f of P.obnovy) { try { f(); } catch { /* nic */ } }
    // kontextové karty
    const kontext = { tabulka: !!P.stav.tabulka, graf: st.objekt?.typ === 'graf', obrazek: st.objekt && st.objekt.typ !== 'graf' };
    for (const k of KARTY_TB) {
      if (!k.kontext) continue;
      const vid = !!kontext[k.kontext];
      tlKaret[k.id].hidden = !vid;
      if (!vid && st.karta === k.id) prepniKartu('domu');
    }
    obnovZpet();
    obnovStav();
  }
  P.obnov = obnov;

  function obnovZpet() {
    bZpet.disabled = !P.S.muzeZpet;
    bZpet.title = P.S.muzeZpet ? `Zpět: ${P.S.popisZpet || 'Úprava'} (Ctrl+Z)` : 'Nelze vrátit zpět';
    bZnovu.disabled = !P.S.muzeZnovu;
  }

  function obnovStav() {
    const l = P.S.list;
    sRezim.textContent = st.rezim;
    sRezimy.forEach((b) => b.classList.toggle('aktivni', b.dataset.r === st.zobrazeni));
    zoomText.textContent = Math.round(l.zoom * 100) + ' %';
    if (document.activeElement !== zoomPosuvnik) zoomPosuvnik.value = String(hodnotaZoomu(l.zoom));
    sVypocet.hidden = !P.S.cekaNaVypocet && !P.S.cyklus;
    sVypocet.textContent = P.S.cekaNaVypocet ? 'Vypočítat' : P.S.cyklus ? `Cyklické odkazy: ${P.S.cyklus.list}` : '';
    bKomentare.classList.toggle('aktivni', st.podokno === 'komentare');
    const problemy = P.kontrolaPristupnosti?.().length || 0;
    sPristupnost.lastChild.textContent = problemy ? 'Přístupnost: Prozkoumat' : 'Přístupnost: Vše je v pořádku';
    obnovSouhrn();
  }

  let souhrnCeka = 0;
  function obnovSouhrn() {
    clearTimeout(souhrnCeka);
    souhrnCeka = setTimeout(() => {
      const S = P.S, l = S.list;
      let n = 0, cisel = 0, suma = 0, min = Infinity, max = -Infinity, prohledano = 0;
      const jedna = l.vyber.oblasti.length === 1 && l.vyber.oblasti[0].r1 === l.vyber.oblasti[0].r2 && l.vyber.oblasti[0].c1 === l.vyber.oblasti[0].c2;
      if (!jedna) {
        for (const o of l.vyber.oblasti) {
          const oo = { ...o, r2: Math.min(o.r2, S.rozsah(l).r), c2: Math.min(o.c2, S.rozsah(l).c) };
          S.projdi(l, oo, (r, c, v) => {
            if (++prohledano > 200000) return;
            if (l.skryteR.has(r) || l.skryteFiltrem.has(r)) return;
            n++;
            if (typeof v === 'number') { cisel++; suma += v; if (v < min) min = v; if (v > max) max = v; }
          });
        }
      }
      const v = souhrnVolby();
      const nf = P.stav.s?.nf;
      const f = (x) => formatuj(x, nf && !/^general$/i.test(nf) ? nf : null).text || obecne(x);
      const casti = [];
      if (n >= 2) {
        if (cisel && v.prumer) casti.push(['Průměr', f(suma / cisel)]);
        if (v.pocet) casti.push(['Počet', String(n)]);
        if (cisel && v.pocetCisel) casti.push(['Počet čísel', String(cisel)]);
        if (cisel && v.min) casti.push(['Minimum', f(min)]);
        if (cisel && v.max) casti.push(['Maximum', f(max)]);
        if (cisel && v.soucet) casti.push(['Součet', f(suma)]);
      }
      sSouhrn.replaceChildren(...casti.map(([k, x]) => el('span', {}, `${k}: `, el('b', { text: x }))));
      sSouhrn.dataset.hodnota = casti.find((x) => x[0] === 'Součet')?.[1] || '';
      sSouhrn.hidden = !casti.length;
    }, 60);
  }

  // stav editace → řádek vzorců, tlačítka ×/✓, režim ve stavovém řádku
  P.poEditaci = () => {
    const e = grid.edit;
    bZrusit.disabled = bPotvrdit.disabled = !e;
    st.rezim = !e ? 'Připraven' : grid.muzeUkazovat() && e.ukaz ? 'Ukázat' : e.rezim === 'zadat' ? 'Zadat' : 'Upravit';
    sRezim.textContent = st.rezim;
    koren.classList.toggle('tb-edituje', !!e);
  };

  P.poZmeneVyberu = (tazeni = false) => {
    const l = P.S.list, v = l.vyber, o = v.oblasti[v.oblasti.length - 1];
    if (document.activeElement !== poleNazvu) {
      if (tazeni && (o.r1 !== o.r2 || o.c1 !== o.c2)) poleNazvu.value = `${o.r2 - o.r1 + 1}Ř × ${o.c2 - o.c1 + 1}S`;
      else {
        const jm = P.nazevOblasti(o);
        poleNazvu.value = jm || adresa(v.r, v.c);
      }
    }
    if (!grid.edit) zobrazObsahVRadku();
    if (st.stetec && !tazeni) P.pouzijStetec();
    if (st.objekt) P.vyberObjekt(null);
    P.poZmeneVyberuPodokna?.(tazeni);
    planujObnovu();
  };

  function zobrazObsahVRadku() {
    const v = P.S.list.vyber;
    const t = grid.textProEditaci(v.r, v.c);
    const b = P.S.bunka(P.S.list, v.r, v.c);
    const skryto = P.S.list.zamek && P.S.stylBunky(P.S.list, v.r, v.c)?.skryty && b?.f;
    radekVzorcu.innerHTML = skryto ? '' : obarvi(t);
    // pole v rozlité oblasti: vzorec kotvy šedě
    const kotva = P.S.list.presah.get(klic(v.r, v.c));
    if (!b && kotva !== undefined) {
      const [kr, kc] = [Math.floor(kotva / MAX_C), kotva % MAX_C];
      radekVzorcu.innerHTML = `<span class="tb-rv-sede">${obarvi(grid.textProEditaci(kr, kc))}</span>`;
    }
  }
  P.zobrazObsahVRadku = zobrazObsahVRadku;

  radekVzorcu.addEventListener('focus', () => {
    if (!grid.zacniVRadkuVzorcu(radekVzorcu)) return;
    setTimeout(() => grid.poPohybuStrisky(radekVzorcu));
  });
  radekVzorcu.addEventListener('input', () => { if (grid.edit) grid.poVstupu(radekVzorcu); });
  radekVzorcu.addEventListener('keydown', (e) => {
    if (!grid.edit) grid.zacniVRadkuVzorcu(radekVzorcu);
    grid.klavesaEditoru(e, radekVzorcu);
  });
  radekVzorcu.addEventListener('keyup', (e) => { if (/^Arrow|Home|End/.test(e.key)) grid.poPohybuStrisky(radekVzorcu, e); });
  radekVzorcu.addEventListener('pointerup', () => grid.poPohybuStrisky(radekVzorcu));
  radekVzorcu.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
  bZrusit.onclick = () => grid.zrusEditaci();
  bPotvrdit.onclick = () => grid.potvrdEditaci();
  bFx.onclick = () => D.dialogVlozitFunkci(P);
  bRozbalit.onclick = () => {
    st.rozbalenyRadek = !st.rozbalenyRadek;
    radek.classList.toggle('rozbaleny', st.rozbalenyRadek);
    bRozbalit.replaceChildren(ik(st.rozbalenyRadek ? 'sbalit' : 'rozbalit'));
    grid.prekresli();
  };

  // pole názvů
  poleNazvu.addEventListener('focus', () => poleNazvu.select());
  poleNazvu.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { P.poZmeneVyberu(); grid.fokus(); }
    if (e.key === 'Enter') { e.preventDefault(); P.prejdiNa(poleNazvu.value.trim()); grid.fokus(); }
  });
  poleNazvu.addEventListener('blur', () => P.poZmeneVyberu());
  bNazvy.onclick = () => {
    const nazvy = [...P.S.nazvy.values()].map((d) => ({ text: d.nazev, akce: () => P.prejdiNa(d.nazev) }));
    const tabulky = P.S.listy.flatMap((l) => l.tabulky.map((t) => ({ text: t.nazev, akce: () => P.prejdiNa(t.nazev) })));
    const pol = [...nazvy, ...tabulky];
    rozbal(bNazvy.parentNode, nabidka(pol.length ? pol : [{ text: 'Sešit neobsahuje žádné názvy', zakazano: true }], { sirka: Math.max(180, poleNazvu.parentNode.offsetWidth) }));
  };

  // ------------------------------------------------------------ karty listů
  function kresliListy() {
    const S = P.S;
    zalozky.replaceChildren(...S.listy.map((l, i) => {
      if (l.skryty) return null;
      const b = el('button.tb-zalozka' + (i === S.aktivni ? '.aktivni' : ''), { type: 'button', dataset: { i } }, el('span', { text: l.nazev }));
      if (l.barva) b.style.setProperty('--barva-listu', l.barva);
      if (l.zamek) b.title = `${l.nazev} (zamknutý)`;
      b.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (grid.edit && grid.muzeUkazovat()) { P.prepniNaList(l); return; }
        if (i !== S.aktivni) P.prepniNaList(l);
        // tažení = přesun listu
        const x0 = e.clientX;
        let cil = null;
        const mv = (ev) => {
          if (Math.abs(ev.clientX - x0) < 6) return;
          const karty = [...zalozky.children];
          cil = karty.findIndex((k) => { const r = k.getBoundingClientRect(); return ev.clientX < r.left + r.width / 2; });
          if (cil < 0) cil = karty.length;
          karty.forEach((k, j) => k.classList.toggle('cil-vlevo', j === cil));
          zalozky.classList.toggle('cil-konec', cil === karty.length);
        };
        const up = () => {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
          [...zalozky.children].forEach((k) => k.classList.remove('cil-vlevo'));
          zalozky.classList.remove('cil-konec');
          if (cil === null) return;
          const z = S.listy.indexOf(l);
          const na = cil > z ? cil - 1 : cil;
          if (na !== z) P.prikaz('Přesunout list', () => S.presunList(z, na), { prepocet: false });
        };
        addEventListener('pointermove', mv);
        addEventListener('pointerup', up);
      });
      b.addEventListener('dblclick', () => P.prejmenovatListNaMiste(l));
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); P.prepniNaList(l); P.nabidkaListu(b, l); });
      return b;
    }));
    zalozky.querySelector('.aktivni')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  P.kresliListy = kresliListy;
  bNovyList.onclick = () => P.novyList();
  bListVlevo.onclick = () => P.prepniList(-1);
  bListVpravo.onclick = () => P.prepniList(1);
  const seznamListu = (e) => {
    e.preventDefault();
    rozbal(e.currentTarget, nabidka(P.S.listy.map((l, i) => ({ text: l.nazev + (l.skryty ? ' (skrytý)' : ''), zaskrtnuto: i === P.S.aktivni, zakazano: l.skryty, akce: () => P.prepniNaList(l) })), { sirka: 200 }), { nad: true });
  };
  bListVlevo.addEventListener('contextmenu', seznamListu);
  bListVpravo.addEventListener('contextmenu', seznamListu);

  P.prepniNaList = (l) => {
    const i = P.S.listy.indexOf(l);
    if (i < 0 || i === P.S.aktivni) return;
    if (grid.edit && !grid.muzeUkazovat()) { if (!grid.potvrdEditaci()) return; }
    P.S.aktivni = i;
    grid.kopie = grid.kopie;
    kresliListy();
    grid.obnovPosun();
    P.obnovObjekty?.();
    P.poZmeneVyberu();
    if (!grid.edit) grid.fokus();
    else (grid.edit.zdroj || radekVzorcu).focus();
  };
  P.prepniList = (smer) => {
    const S = P.S;
    let i = S.aktivni;
    for (let k = 0; k < S.listy.length; k++) {
      i = (i + smer + S.listy.length) % S.listy.length;
      if (!S.listy[i].skryty) break;
    }
    P.prepniNaList(S.listy[i]);
  };

  // ------------------------------------------------------------ změny sešitu
  /**
   * Každá úprava: provede fn v historii sešitu, přepočítá, překreslí.
   * o.chyba(err) = vlastní obsluha ChybaUpravy, o.prepocet = false pro čistě vizuální změny.
   */
  P.prikaz = (popis, fn, o = {}) => {
    if (grid.edit && !grid.ukladam && !o.bezEditace) { if (!grid.potvrdEditaci()) return false; }
    let ok;
    try {
      ok = P.S.zmena(popis, fn, { ...o, poVypoctu: () => P.rozsirSloupceProCisla?.() });
    } catch (e) {
      if (e instanceof ChybaUpravy) {
        if (e.druh === 'zamek') P.hlaskaZamek(e.message);
        else if (o.chyba) o.chyba(e);
        else zprava(koren, e.message, 'AstroTabulky');
        grid.prekresli();
        P.obnovObjekty?.();
        return false;
      }
      console.error('AstroTabulky:', e);
      zprava(koren, 'Příkaz se nepodařilo dokončit: ' + e.message, 'AstroTabulky');
      return false;
    }
    if (ok === false) return false;
    return true;
  };

  let autoCeka = 0;
  P.S.onZmena = (popis) => zmena(popis);
  function zmena(popis) {
    P.prepocitejVysky();
    for (const l of P.S.listy) if (l.filtr || l.tabulky.some((t) => t.filtr)) P.S.pouzijFiltr(l);
    grid.prekresli();
    P.obnovObjekty?.();
    kresliListy();
    if (!grid.edit) zobrazObsahVRadku();
    planujObnovu();
    P.poZmeneDat?.();
    if (!st.otevreno) return;
    if (!st.dirty) { st.dirty = true; obnovTitulek(); }
    clearTimeout(autoCeka);
    if (st.autoUkladani && st.cesta) autoCeka = setTimeout(() => P.ulozit({ tise: true }), 1500);
  }
  P.zmena = zmena;

  P.zpet = (kroku = 1) => {
    if (grid.edit) { grid.zrusEditaci(); return; }
    if (P.S.zpet(kroku)) { grid.obnovPosun(); P.poZmeneVyberu(); }
  };
  P.znovu = () => {
    if (grid.edit) return;
    if (P.S.znovu()) { grid.obnovPosun(); P.poZmeneVyberu(); }
  };

  // ------------------------------------------------------------ titulek
  function obnovTitulek() {
    const jmeno = st.nazev.replace(/\.(xlsx|csv)$/i, '');
    nazevDok.querySelector('.ps-t-jmeno').textContent = jmeno;
    nazevDok.querySelector('.ps-t-stav').textContent = st.ukladani ? ' • Ukládání…' : st.cesta && !st.dirty ? ' • Uloženo do tohoto počítače' : st.cesta && st.autoUkladani ? ' • Uloženo' : '';
    prepinac.classList.toggle('zapnuto', st.autoUkladani);
    prepinac.setAttribute('aria-checked', String(st.autoUkladani));
    prepinac.querySelector('.ps-auto-text').textContent = st.autoUkladani ? 'Zap' : 'Vyp';
    win.title = `${jmeno} – AstroTabulky`;
    ucet.querySelector('.ps-t-ucet-jmeno').textContent = P.autor();
    ucet.querySelector('.ps-avatar').textContent = P.inicialy();
  }
  P.obnovTitulek = obnovTitulek;

  // ------------------------------------------------------------ nastavení a motiv
  P.nastaveni = nast;
  P.ulozNastaveni = (o) => {
    State.set('tabulky', { ...nast(), ...o });
    if ('motiv' in o) P.nastavMotiv(o.motiv, false);
    obnovTitulek();
  };
  P.autor = () => nast().jmeno || State.get('pismo')?.jmeno || State.get('user')?.name || 'Uživatel';
  P.inicialy = () => P.autor().split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  P.nastavMotiv = (m, uloz = true) => {
    if (uloz) State.set('tabulky', { ...nast(), motiv: m });
    const sys = document.documentElement.dataset.motiv === 'svetly' ? 'barevny' : 'cerny';
    koren.dataset.motiv = m === 'system' ? sys : m || 'barevny';
    win.node.dataset.psMotiv = koren.dataset.motiv;
    grid.prekresli();
  };
  P.tmaveZahlavi = () => koren.dataset.motiv === 'cerny' || koren.dataset.motiv === 'tmave-sedy';
  P.nastavMotiv(nast().motiv || 'barevny', false);
  const motivSledovac = new MutationObserver(() => { if ((nast().motiv || 'barevny') === 'system') P.nastavMotiv('system', false); });
  motivSledovac.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motiv'] });
  P.smerEnter = () => nast().smerEnter || 'dolu';
  P.automatickeDokoncovani = () => nast().dokoncovani !== false;
  P.radekVzorcuViditelny = (ano) => { st.radekVzorcu = ano; radek.hidden = !ano; P.ulozNastaveni({ radekVzorcu: ano }); grid.prekresli(); };
  radek.hidden = !st.radekVzorcu;

  P.lupa = (z) => {
    const l = P.S.list;
    l.zoom = Math.max(0.1, Math.min(4, z));
    grid.kresliTed();
    P.obnovObjekty?.();
    obnovStav();
  };

  P.zobrazeni = (r) => {
    st.zobrazeni = r;
    koren.classList.toggle('tb-rozlozeni', r === 'rozlozeni');
    grid.prekresli();
    obnovStav();
  };

  P.celaObrazovka = (ano) => {
    koren.classList.toggle('tb-cela', ano);
    win.node.classList.toggle('ps-zamereni-okno', ano);
    if (ano) P.toast('Režim celé obrazovky — Esc ho ukončí');
    grid.prekresli();
  };

  // ------------------------------------------------------------ soubory
  P.nedavne = () => (State.get('tabulkyNedavne') || []).filter((c) => FS.exists(c));
  function pridejNedavne(c) { State.set('tabulkyNedavne', [c, ...(State.get('tabulkyNedavne') || []).filter((x) => x !== c)].slice(0, 25)); }

  function nactiSesit(sesit, { cesta = null, nazev, meta = {} } = {}) {
    P.S = sesit;
    sesit.onZmena = (popis) => zmena(popis);
    st.cesta = cesta;
    st.nazev = nazev || (cesta ? FS.basename(cesta) : `Sešit${++citacSesitu}`);
    st.meta = { vytvoreno: Date.now(), autor: P.autor(), ...(sesit.meta || {}), ...meta };
    st.dirty = false;
    st.otevreno = true;
    st.otevrenoOd = Date.now();
    st.autoUkladani = !!nast().autoUkladani && !!cesta && /\.xlsx$/i.test(cesta);
    st.objekt = null;
    P.zavriZakulisi?.();
    grid.kopie = null;
    grid.sipky = [];
    P.prepocitejVysky();
    kresliListy();
    grid.obnovPosun();
    P.obnovObjekty?.();
    obnovTitulek();
    P.poZmeneVyberu();
    setTimeout(() => { grid.fokus(); prizpusob(); obnov(); }, 30);
    if (st.podokno) P.podokno(st.podokno);
  }
  P.nactiSesit = nactiSesit;

  P.novy = async (id = 'prazdny') => {
    if (!(await zeptejSeNaUlozeni())) return;
    const s = SABLONY_TB.find((x) => x.id === id) || SABLONY_TB[0];
    const sesit = s.vytvor(P.autor());
    sesit.zalozHistorii();
    nactiSesit(sesit, { nazev: id === 'prazdny' ? undefined : `${s.nazev}${++citacSesitu > 1 ? citacSesitu : ''}` });
  };

  P.otevri = async (cesta) => {
    if (cesta === st.cesta && st.otevreno) { P.zavriZakulisi?.(); return; }
    if (!(await zeptejSeNaUlozeni())) return;
    let text;
    try { text = FS.read(cesta); } catch (e) { zprava(koren, `Soubor se nepodařilo otevřít.\n${e.message}`); return; }
    let sesit;
    try {
      if (/\.csv$|\.txt$|\.tsv$/i.test(cesta)) sesit = Sesit.zCsv(text, FS.basename(cesta).replace(/\.[^.]+$/, ''));
      else sesit = Sesit.rozeber(text);
    } catch (e) {
      zprava(koren, `Soubor „${FS.basename(cesta)}“ nelze otevřít, protože formát nebo přípona souboru nejsou platné. Ověřte, že soubor není poškozený a že přípona souboru odpovídá jeho formátu.`);
      return;
    }
    nactiSesit(sesit, { cesta });
    pridejNedavne(cesta);
  };

  P.otevritZeZarizeni = () => {
    const vstup = el('input', { type: 'file', accept: '.xlsx,.csv,.tsv,.txt' });
    vstup.onchange = async () => {
      const f = vstup.files[0];
      if (!f) return;
      if (/\.xlsx$/i.test(f.name) && !(await f.slice(0, 1).text()).startsWith('{')) {
        zprava(koren, 'Tenhle soubor je skutečný sešit Microsoft Excel (ZIP). AstroTabulky umí otevřít svoje sešity a soubory CSV — v Excelu ho ulož jako „CSV UTF-8“ a otevři znovu.');
        return;
      }
      const text = await f.text();
      const cil = FS.join(FS.HOME + '/Dokumenty', FS.freeName(FS.HOME + '/Dokumenty', f.name));
      try { FS.write(cil, text); } catch (e) { zprava(koren, e.message); return; }
      P.otevri(cil);
    };
    vstup.click();
  };

  function jePrazdny() {
    return P.S.listy.length === 1 && !P.S.listy[0].b.size && !P.S.listy[0].grafy.length;
  }
  function zeptejSeNaUlozeni() {
    return new Promise((hotovo) => {
      if (!st.otevreno || !st.dirty || (!st.cesta && jePrazdny())) return hotovo(true);
      dialog(koren, {
        titulek: 'AstroTabulky', sirka: 440,
        obsah: el('div.ps-ulozit-dotaz', {}, el('div.ps-t-logo.tb-logo.velke', {}, el('span', { text: 'T' })),
          el('p', { text: `Chcete uložit změny do souboru „${st.nazev}“?` })),
        tlacitka: [
          { text: 'Uložit', primarni: true, akce: () => { if (st.cesta) hotovo(P.ulozit()); else P.rychleUlozeni(() => hotovo(true), () => hotovo(false)); } },
          { text: 'Neukládat', akce: () => hotovo(true) },
          { text: 'Zrušit', akce: () => hotovo(false) },
        ],
      });
    });
  }
  P.zeptejSeNaUlozeni = zeptejSeNaUlozeni;

  P.muzeZavrit = () => {
    if (st.zavrit) return true;
    if (grid.edit) grid.potvrdEditaci();
    zeptejSeNaUlozeni().then((ok) => { if (ok) { st.zavrit = true; win.close(); } });
    return false;
  };

  P.obsahSouboru = (typ) => {
    if (typ === 'csv') return P.S.naCsv(P.S.list, ';');
    if (typ === 'txt') return P.S.naCsv(P.S.list, '\t');
    if (typ === 'html') return P.exportHtml();
    return P.S.serializuj({ ...st.meta, zmeneno: Date.now() });
  };

  P.ulozitDo = (cesta, typ = 'xlsx') => {
    if (grid.edit) grid.potvrdEditaci();
    // ukázková verze: ukládá jen ve formátu AstroTabulek, export (CSV…) je v plné verzi
    if (typ !== 'xlsx') { zprava(koren, `Export do ${typ.toUpperCase()} je jen v plné verzi AstroOS. Sešit můžeš uložit jako .xlsx.`, 'AstroTabulky'); return false; }
    try { FS.write(cesta, P.obsahSouboru(typ)); }
    catch (e) { zprava(koren, `Sešit se nepodařilo uložit.\n\n${e.message}`, 'AstroTabulky'); return false; }
    if (typ === 'csv' && P.S.listy.length > 1) P.toast('Do CSV se uložil jen aktivní list.');
    st.cesta = cesta;
    st.nazev = FS.basename(cesta);
    st.dirty = false;
    pridejNedavne(cesta);
    obnovTitulek();
    return true;
  };

  P.ulozit = ({ tise = false } = {}) => {
    if (!st.cesta) { P.rychleUlozeni(); return false; }
    st.ukladani = true;
    obnovTitulek();
    const typ = (st.cesta.match(/\.([^.]+)$/)?.[1] || 'xlsx').toLowerCase();
    const ok = P.ulozitDo(st.cesta, typ === 'xlsx' ? 'xlsx' : typ);
    setTimeout(() => { st.ukladani = null; obnovTitulek(); }, tise ? 400 : 250);
    return ok;
  };

  P.rychleUlozeni = (poUlozeni, poZruseni) => {
    const vychozi = nast().umisteni || FS.HOME + '/Dokumenty';
    const prvni = String(P.S.hodnota(P.S.listy[0], 0, 0) ?? '').replace(/[\\/:*?"<>|]/g, '').slice(0, 40).trim();
    const jmeno = el('input.ps-vstup', { value: prvni && !jePrazdny() ? prvni : st.nazev.replace(/\.[^.]+$/, '') });
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
            const n = jmeno.value.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\.xlsx$/i, '');
            if (!n) return false;
            const c = FS.join(kam.value, FS.exists(FS.join(kam.value, n + '.xlsx')) ? FS.freeName(kam.value, n + '.xlsx') : n + '.xlsx');
            if (P.ulozitDo(c, 'xlsx')) { hotovo = true; toast({ title: 'Uloženo', body: c.replace(FS.HOME, '~'), icon: 'check', timeout: 2200 }); poUlozeni?.(); }
          },
        },
        { text: 'Zrušit' },
      ],
      pri_zavreni: () => { if (!hotovo) poZruseni?.(); grid.fokus(); },
    });
    setTimeout(() => jmeno.select(), 40);
  };

  P.prejmenujSoubor = (nove) => {
    nove = nove.replace(/[\\/:*?"<>|]/g, '');
    if (!nove) return;
    if (!st.cesta) { st.nazev = nove; obnovTitulek(); return; }
    const pripona = st.cesta.match(/\.[^.]+$/)?.[0] || '.xlsx';
    try {
      FS.rename(st.cesta, nove + pripona);
      const nova = FS.join(FS.dirname(st.cesta), nove + pripona);
      State.set('tabulkyNedavne', (State.get('tabulkyNedavne') || []).map((c) => (c === st.cesta ? nova : c)));
      st.cesta = nova;
      st.nazev = nove + pripona;
      obnovTitulek();
    } catch (e) { zprava(koren, e.message); }
  };

  P.zavritDokument = async () => {
    if (!(await zeptejSeNaUlozeni())) return;
    st.otevreno = false;
    st.dirty = false;
    st.cesta = null;
    P.S = new Sesit();
    P.S.onZmena = (popis) => zmena(popis);
    kresliListy();
    grid.obnovPosun();
    P.obnovObjekty?.();
    otevriZakulisi(P, 'domu');
  };

  P.toast = (t) => toast({ title: 'AstroTabulky', body: t, icon: 'check', timeout: 2400 });
  P.zprava = (t, titulek = 'AstroTabulky') => zprava(koren, t, titulek);
  P.otevriAplikaci = (id, o) => openApp(id, o);
  P.exportWeb = () => {
    const slozka = st.cesta ? FS.dirname(st.cesta) : FS.HOME + '/Dokumenty';
    const c = FS.join(slozka, st.nazev.replace(/\.[^.]+$/, '') + '.html');
    try { FS.write(c, P.exportHtml('sesit')); } catch (e) { zprava(koren, e.message); return; }
    openApp('browser', { url: 'file://' + c });
  };
  P.otevriOdkaz = (url) => {
    if (/^#/.test(url) || /^'?[^/]+'?![A-Z]+\d+/i.test(url)) { P.prejdiNa(url.replace(/^#/, '')); return; }
    openApp('browser', { url });
  };

  // ------------------------------------------------------------ klávesy celé aplikace
  koren.addEventListener('keydown', (e) => {
    if ((e.altKey && (e.key === 'F4' || e.key === 'Tab')) || e.key === 'Meta' || (e.ctrlKey && e.key === 'Escape')) return;
    e.stopPropagation();
    if (e.defaultPrevented) return;
    if (e.target === grid.klav) return;   // mřížka má vlastní obsluhu (predKlavesou)
    P.globalniKlavesa(e);
  });
  P.globalniKlavesa = (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const hotovo = () => { e.preventDefault(); e.stopPropagation(); return true; };
    if (e.key === 'Escape') {
      if (koren.classList.contains('tb-cela')) { P.celaObrazovka(false); return hotovo(); }
      if (st.stetec) { P.stetec(false); return hotovo(); }
      if (st.kresleni) { P.kreslit(null); return hotovo(); }
      if (st.objekt) { P.vyberObjekt(null); grid.fokus(); return hotovo(); }
    }
    if (e.altKey && !ctrl && k === 'q') { hledat.focus(); return hotovo(); }
    if (e.key === 'F1' && !ctrl) { P.podokno('napoveda'); return hotovo(); }
    if (e.key === 'F12') { otevriZakulisi(P, 'ulozitJako'); return hotovo(); }
    if (ctrl && e.key === 'F1') { prepniPas(); return hotovo(); }
    if (ctrl && !e.altKey) {
      if (k === 's') { P.ulozit(); return hotovo(); }
      if (k === 'o') { otevriZakulisi(P, 'otevrit'); return hotovo(); }
      if (k === 'n') { P.novy('prazdny'); return hotovo(); }
      if (k === 'p') { otevriZakulisi(P, 'tisk'); return hotovo(); }
      if (k === 'w') { P.zavritDokument(); return hotovo(); }
      if (k === 'z' && !grid.edit && !e.shiftKey) { P.zpet(); return hotovo(); }
      if ((k === 'y' || (k === 'z' && e.shiftKey)) && !grid.edit) { P.znovu(); return hotovo(); }
      if (k === 'f' && !grid.edit) { D.dialogNajit(P, 'najit'); return hotovo(); }
      if (k === 'h' && !grid.edit) { D.dialogNajit(P, 'nahradit'); return hotovo(); }
    }
    return false;
  };

  // ------------------------------------------------------------ velikost okna
  // v nízkém okně Excel sbalí pás karet (a v úplně nízkém i řádek vzorců), ať zbyde místo na list
  const ro = new ResizeObserver(() => {
    const h = koren.clientHeight;
    koren.classList.toggle('tb-nizke', h > 0 && h < 440);
    koren.classList.toggle('tb-velmi-nizke', h > 0 && h < 300);
    prizpusob();
  });
  ro.observe(koren);

  P.znic = () => {
    ro.disconnect();
    motivSledovac.disconnect();
    grid.znic();
    zavriRozbal();
    P.zavriPodokna?.();
  };

  // ------------------------------------------------------------ start
  prepniKartu('domu');
  obnovTitulek();
  kresliListy();
  setTimeout(() => grid.kresliTed(), 0);
  if (win.opts?.path) P.otevri(win.opts.path);
  else if (win.opts?.sablona) P.novy(win.opts.sablona);
  else otevriZakulisi(P, 'domu');
  return P;
}
