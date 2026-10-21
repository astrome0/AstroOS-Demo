// AstroOS — AstroPrezentace, prezentace jako Microsoft PowerPoint (Microsoft 365)
//
// Části v js/prezentace/: model.js (snímky, historie, soubor), motivy.js (motivy, rozvržení), render.js (vykreslení
// snímku), editor.js (plátno: výběr, tažení, text), prikazy.js (příkazy), pas.js (pás karet), podokna.js,
// dialogy.js, efekty.js (přechody a animace), prezentovani.js (prezentační režim), zakulisi.js, sablony.js.
// Tady je lepidlo: okno, panel miniatur, poznámky, stavový řádek, zobrazení a soubory.

import { el, bus } from '../util.js';
import * as FS from '../fs.js';
import { State } from '../state.js';
import { toast } from '../ui.js';
import { ik } from '../pismo/ikony.js';
import '../tabulky/ikony.js';
import '../prezentace/ikony.js';
import { rozbal, zavriRozbal, nabidka, dialog, zprava, pole } from '../pismo/ui.js';
import { prizpusobKartu } from '../pismo/pas.js';
import { Prezentace, novySnimek, textZHtml, jePrazdnyText, odstavce } from '../prezentace/model.js';
import { rozvrzeniPodleId, SIRKA, VYSKA } from '../prezentace/motivy.js';
import { miniatura, kresliSnimek, poVlozeni, barvyPrezentace, kontextSnimku, jeCara } from '../prezentace/render.js';
import { Editor } from '../prezentace/editor.js';
import { KARTY_PR, postavKartyPr, galerieRozvrzeni } from '../prezentace/pas.js';
import { pridejPrikazy } from '../prezentace/prikazy.js';
import { pridejPodokna, kontrolaPristupnosti } from '../prezentace/podokna.js';
import { otevriZakulisi } from '../prezentace/zakulisi.js';
import { vytvorZeSablony, SABLONY_PR } from '../prezentace/sablony.js';
import { krokyAnimaci } from '../prezentace/efekty.js';
import * as D from '../prezentace/dialogy.js';

const openApp = (id, o) => import('../apps.js').then((m) => m.openApp(id, o));
let citac = 0;

export const prezentaceApp = {
  id: 'prezentace', name: 'AstroPrezentace', icon: 'prezentace', color: 'linear-gradient(145deg,#ff8f6b,#c43e1c)',
  cat: 'office', width: 1240, height: 800,
  mount(body, win) { win.P = vytvor(body, win); },
  reopen(win, opts) {
    if (opts?.path) win.P?.otevri(opts.path);
    else if (opts?.sablona) win.P?.novaPrezentace(opts.sablona);
  },
  unmount(win) { win.P?.znic(); },
  muzeZavrit(win) { return win.P ? win.P.muzeZavrit() : true; },
};

function vytvor(body, win) {
  const nast = () => State.get('prezentace') || {};
  const st = {
    cesta: null, nazev: 'Prezentace1', dirty: false, otevreno: false, meta: {}, otevrenoOd: Date.now(),
    karta: 'domu', pasSkryty: false, autoUkladani: !!nast().autoUkladani, ukladani: null, zavrit: false,
    aktivni: null, vybraneSnimky: [], zobrazeni: 'normalni', podokno: null, poznamky: nast().poznamky !== false,
    fokus: 'platno', mrizka: false, voditka: false, pravitko: false, sbalene: new Set(), jenCteni: false,
  };
  const koren = el('div.ps.pr', { dataset: { motiv: 'barevny', app: 'prezentace' } });
  win.node.dataset.psApp = 'prezentace';
  const P = {
    win, koren, st, prikazy: [], stavy: [], obnovy: [], stav: {},
    pres: new Prezentace(),
    schranka: null,
  };

  // ------------------------------------------------------------ titulek okna (jako PowerPoint)
  const lista = win.node.querySelector('.win-bar');
  win.node.classList.add('ps-okno', 'pr-okno');
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
  const bOdZacatku = el('button.ps-t-b', { type: 'button', title: 'Od začátku (F5)', onclick: () => P.prezentovat(0) }, ik('prezentaceMaly'));
  const bPrizpusobit = el('button.ps-t-b.sipka', { type: 'button', title: 'Přizpůsobit panel nástrojů Rychlý přístup' }, ik('sipkaDolu'));
  const nazevDok = el('button.ps-t-nazev', { type: 'button' }, el('span.ps-t-jmeno'), el('span.ps-t-stav'), ik('sipkaDolu'));
  const hledat = el('input.ps-t-hledat-vstup', { type: 'text', placeholder: 'Hledat (Alt+Q)', spellcheck: 'false' });
  const hledatBox = el('div.ps-t-hledat', {}, ik('najitMaly'), hledat);
  const ucet = el('button.ps-t-ucet', { type: 'button', title: 'Účet' }, el('span.ps-t-ucet-jmeno'), el('span.ps-avatar'));
  const levo = el('div.ps-t-levo', {},
    el('div.ps-t-logo.pr-logo', { title: 'AstroPrezentace' }, el('span', { text: 'P' })),
    el('span.ps-t-auto-popis', { text: 'Automatické ukládání' }), prepinac,
    bUlozit, el('div.ps-t-skupina', {}, bZpet, bZpetSipka), bZnovu, bOdZacatku, bPrizpusobit, nazevDok);
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
    const h = P.pres.historie;
    const kroky = h.list.slice(1, h.i + 1).reverse();
    if (!kroky.length) return;
    rozbal(bZpetSipka, nabidka(kroky.slice(0, 20).map((k, i) => ({ text: k.popis || 'Úprava', akce: () => P.zpet(i + 1) })), { sirka: 220 }));
  };
  bPrizpusobit.onclick = () => rozbal(bPrizpusobit, nabidka([
    { nadpis: 'Přizpůsobit panel nástrojů Rychlý přístup' },
    { text: 'Nový', ikona: 'novy', akce: () => P.novaPrezentace('prazdny') },
    { text: 'Otevřít', ikona: 'otevrit', akce: () => otevriZakulisi(P, 'otevrit') },
    { text: 'Uložit', ikona: 'ulozit', zaskrtnuto: true, akce: () => P.ulozit() },
    { text: 'Tisk', ikona: 'tisk', akce: () => otevriZakulisi(P, 'tisk') },
    { text: 'Zpět', ikona: 'zpet', zaskrtnuto: true, akce: () => P.zpet() },
    { text: 'Znovu', ikona: 'znovu', zaskrtnuto: true, akce: () => P.znovu() },
    { text: 'Od začátku', ikona: 'prezentaceMaly', zaskrtnuto: true, akce: () => P.prezentovat(0) },
    'sep',
    { text: st.pasSkryty ? 'Zobrazit pás karet' : 'Skrýt pás karet', akce: () => prepniPas() },
  ], { sirka: 260 }));
  nazevDok.onclick = () => {
    const jmeno = el('input.ps-vstup', { value: st.nazev.replace(/\.[^.]+$/, '') });
    const obsah = el('div.ps-t-popover', {},
      el('b', { text: st.cesta ? 'Uloženo do: Tento počítač' : 'Tato prezentace ještě není uložená' }),
      pole('Název souboru', jmeno),
      st.cesta ? el('div.ps-t-pop-umisteni', {}, el('span', { text: 'Umístění' }), el('div', {}, ik('slozka'), el('span', { text: FS.dirname(st.cesta).replace(FS.HOME, 'Domů') }))) : null,
      el('div.ps-nab-sep'),
      nabidka([{ text: 'Historie verzí', ikona: 'verze', akce: () => otevriZakulisi(P, 'informace') }]));
    jmeno.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); P.prejmenujSoubor(jmeno.value.trim()); zavriRozbal(); P.fokus(); }
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
    if (e.key === 'Escape') { hledat.value = ''; hledat.blur(); P.fokus(); zavriRozbal(); }
    if (e.key === 'Enter') document.querySelector('.ps-hledani-vysledky .ps-nab-polozka')?.click();
  });
  hledat.addEventListener('input', () => ukazHledani());
  hledat.addEventListener('focus', () => ukazHledani());
  function ukazHledani() {
    const q = hledat.value.trim().toLocaleLowerCase('cs');
    const videne = new Set();
    const navrhy = ['Nový snímek', 'Designer', 'Od začátku', 'Formát pozadí', 'Obrazce', 'Obrázky', 'Podokno animací'];
    const shody = (q ? P.prikazy.filter((p) => p.text.toLocaleLowerCase('cs').includes(q)) : P.prikazy.filter((p) => navrhy.includes(p.text.replace('\n', ' '))))
      .filter((p) => (videne.has(p.text) ? false : videne.add(p.text))).slice(0, 8);
    const polozky = [
      { nadpis: q ? 'Nejlepší výsledek' : 'Navrhované akce' },
      ...shody.map((p) => ({ text: p.text.replace('\n', ' '), ikona: p.ikona, klavesa: p.klavesa, akce: () => { hledat.value = ''; hledat.blur(); p.akce(); } })),
    ];
    if (q) polozky.push('sep', { text: `Najít „${hledat.value.trim()}“ v prezentaci`, ikona: 'najitMaly', akce: () => { const t = hledat.value.trim(); hledat.value = ''; D.dialogNajit(P); setTimeout(() => { const i = document.querySelector('.ps-dialog input'); if (i) i.value = t; }, 40); } });
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
  kartyRadek.append(el('button.ps-karta.soubor', { type: 'button', text: 'Soubor', onclick: () => otevriZakulisi(P, 'domu') }));
  for (const k of KARTY_PR) {
    const b = el('button.ps-karta' + (k.kontext ? '.kontext' : ''), { type: 'button', text: k.nazev, dataset: { karta: k.id } });
    b.onclick = () => { if (st.pasSkryty) pas.classList.add('docasne'); prepniKartu(k.id); };
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('dblclick', () => prepniPas());
    tlKaret[k.id] = b;
    kartyRadek.append(b);
  }
  const bNahravat = el('button.ps-karta-tl.pr-nahravat', { type: 'button', title: 'Nahrávat' }, el('span.pr-tecka'), el('span', { text: 'Nahrávat' }));
  const bKomentare = el('button.ps-karta-tl', { type: 'button', title: 'Komentáře' }, ik('komentar'), el('span', { text: 'Komentáře' }));
  const bPrezentace = el('div.ps-karta-tl.pr-prezentace-tl', {},
    el('button', { type: 'button', title: 'Spustit od aktuálního snímku (Shift+F5)', onclick: () => P.prezentovat() }, ik('prezentaceMaly'), el('span', { text: 'Prezentace' })),
    el('button.pr-sipka', { type: 'button', title: 'Možnosti prezentace' }, ik('sipkaDolu')));
  const bSdilet = el('button.ps-karta-tl.sdilet', { type: 'button', title: 'Sdílet' }, ik('sdilet'), el('span', { text: 'Sdílet' }), ik('sipkaDolu'));
  kartyRadek.append(el('div.ps-karty-mezera'), bNahravat, bKomentare, bPrezentace, bSdilet);
  [bNahravat, bKomentare, bPrezentace, bSdilet].forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
  bNahravat.onclick = () => rozbal(bNahravat, nabidka([{ text: 'Od začátku', akce: () => P.prezentovat(0, { zkouska: true }) }, { text: 'Od aktuálního snímku', akce: () => P.prezentovat(null, { zkouska: true }) }, 'sep', { text: 'Nahrát zvuk…', ikona: 'diktovat', akce: () => P.nahratZvuk() }], { sirka: 220 }), { zarovnat: 'vpravo' });
  bKomentare.onclick = () => P.podokno(st.podokno === 'komentare' ? null : 'komentare');
  bPrezentace.lastChild.onclick = () => rozbal(bPrezentace, nabidka([
    { text: 'Od začátku', ikona: 'prezentaceZacatek', klavesa: 'F5', akce: () => P.prezentovat(0) },
    { text: 'Od aktuálního snímku', ikona: 'prezentaceAktualni', klavesa: 'Shift+F5', akce: () => P.prezentovat() },
    'sep',
    { text: 'Použít zobrazení prezentujícího', zaskrtnuto: !!P.pres.nastaveni.prezentujici, akce: () => P.nastavPrezentaci({ prezentujici: !P.pres.nastaveni.prezentujici }) },
  ], { sirka: 260 }), { zarovnat: 'vpravo' });
  bSdilet.onclick = () => otevriZakulisi(P, 'sdilet');
  const bPasMoznosti = el('button.ps-pas-moznosti', { type: 'button', title: 'Možnosti zobrazení pásu karet' }, ik('sipkaDolu'));
  bPasMoznosti.addEventListener('mousedown', (e) => e.preventDefault());
  bPasMoznosti.onclick = () => rozbal(bPasMoznosti, nabidka([
    { nadpis: 'Zobrazit pás karet' },
    { text: 'Zobrazit jen karty', zaskrtnuto: st.pasSkryty, akce: () => { if (!st.pasSkryty) prepniPas(); } },
    { text: 'Vždy zobrazovat pás karet', zaskrtnuto: !st.pasSkryty, akce: () => { if (st.pasSkryty) prepniPas(); } },
  ], { sirka: 240 }), { zarovnat: 'vpravo' });

  function prepniKartu(id) {
    st.karta = id;
    for (const [k, b] of Object.entries(tlKaret)) b.classList.toggle('aktivni', k === id);
    const o = obsahyKaret[id];
    if (!o) return;
    for (const x of Object.values(obsahyKaret)) x.classList.remove('aktivni');
    o.classList.add('aktivni');
    pasTelo.replaceChildren(o, bPasMoznosti);
    obnov();
    prizpusob();
    ed.kresliVyber();
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
    requestAnimationFrame(() => ed.prizpusobit && ed.prizpusob());
  }
  P.prepniPas = prepniPas;

  // ------------------------------------------------------------ rozvržení okna
  const levy = el('div.pr-levy', { tabindex: '-1' });
  const levyTahlo = el('div.pr-levy-tahlo', { title: 'Změnit šířku' });
  const ed = new Editor(P);
  P.ed = ed;
  P.dok = { vratVyber: () => P.fokus() };
  const poznamkyEd = el('div.pr-poznamky-ed', { contenteditable: 'plaintext-only', spellcheck: 'true', dataset: { vyzva: 'Kliknutím přidáte poznámky' } });
  const poznamky = el('div.pr-poznamky', {}, poznamkyEd);
  const poznTahlo = el('div.pr-pozn-tahlo', { title: 'Změnit výšku poznámek' });
  const hlavni = el('div.pr-hlavni', {}, ed.plocha, poznTahlo, poznamky);
  const razeni = el('div.pr-razeni', { hidden: true, tabindex: '-1' });
  const strankaPozn = el('div.pr-stranky-poznamek', { hidden: true });
  const podoknoP = el('aside.ps-podokno.vpravo.pr-podokno', { hidden: true });
  const stred = el('div.pr-stred', {}, levy, levyTahlo, hlavni, razeni, strankaPozn, podoknoP);
  P.podoknoUzel = podoknoP;
  const lista2 = el('div.pr-lista-konecne', { hidden: true }, el('b', { text: 'OZNAČENO JAKO KONEČNÉ' }), el('span', { text: 'Autor označil tuto prezentaci jako konečnou, aby se zabránilo jejím úpravám.' }), el('button.ps-tlac', { type: 'button', text: 'Přesto upravit', onclick: () => P.jenCteni(false) }));

  // stavový řádek
  const sSnimek = el('button.ps-s-pol', { type: 'button', title: 'Přejít na snímek' });
  const sJazyk = el('button.ps-s-pol', { type: 'button', title: 'Jazyk' }, el('span', { text: 'čeština' }));
  const sPristupnost = el('button.ps-s-pol', { type: 'button', title: 'Kontrola přístupnosti' }, ik('pristupnost'), el('span', { text: 'Přístupnost: Vše je v pořádku' }));
  const sStav = el('span.ps-s-pol.pr-s-stav');
  const sPoznamky = el('button.ps-s-pol', { type: 'button', title: 'Poznámky' }, ik('poznamky'), el('span', { text: 'Poznámky' }));
  const sKomentare = el('button.ps-s-pol', { type: 'button', title: 'Komentáře' }, ik('komentar'), el('span', { text: 'Komentáře' }));
  const sRezimy = [['normalni', 'normalniMaly', 'Normální'], ['razeni', 'razeniMaly', 'Řazení snímků'], ['cteni', 'cteniMaly', 'Zobrazení pro čtení'], ['prezentace', 'prezentaceMaly', 'Prezentace']].map(([r, i, t]) =>
    el('button.ps-s-rezim', { type: 'button', dataset: { r }, title: t, onclick: () => (r === 'cteni' ? P.prezentovat(null, { okno: true }) : r === 'prezentace' ? P.prezentovat() : P.zobrazeni(r)) }, ik(i)));
  const zoomPosuvnik = el('input.ps-s-zoom', { type: 'range', min: 0, max: 100, step: 1, value: 50, title: 'Lupa' });
  const zoomText = el('button.ps-s-pol.zoom-proc', { type: 'button', title: 'Úroveň lupy' });
  const bFit = el('button.ps-s-pol.ikona', { type: 'button', title: 'Přizpůsobit snímek aktuálnímu oknu', onclick: () => P.lupaPrizpusobit() }, ik('prizpusobitMaly'));
  const stavovy = el('footer.ps-stav', {},
    el('div.ps-s-levo', {}, sSnimek, sJazyk, sPristupnost, sStav),
    el('div.ps-s-pravo', {}, sPoznamky, sKomentare, el('div.ps-s-rezimy', {}, sRezimy),
      el('button.ps-s-pm', { type: 'button', text: '−', title: 'Oddálit', onclick: () => P.lupa(Math.round(ed.z * 100) - 10) }),
      zoomPosuvnik,
      el('button.ps-s-pm', { type: 'button', text: '+', title: 'Přiblížit', onclick: () => P.lupa(Math.round(ed.z * 100) + 10) }),
      zoomText, bFit));
  stavovy.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
  const zoomNaHodnotu = (v) => (v <= 50 ? 10 + (v / 50) * 90 : 100 + ((v - 50) / 50) * 300);
  const hodnotaZoomu = (z) => (z <= 100 ? ((z - 10) / 90) * 50 : 50 + ((z - 100) / 300) * 50);
  zoomPosuvnik.oninput = () => P.lupa(Math.round(zoomNaHodnotu(+zoomPosuvnik.value)));
  zoomText.onclick = () => D.dialogLupa(P);
  sPristupnost.onclick = () => P.podokno('pristupnost');
  sPoznamky.onclick = () => P.prepniPoznamky();
  sKomentare.onclick = () => P.podokno(st.podokno === 'komentare' ? null : 'komentare');
  sSnimek.onclick = () => {
    const v = el('input.ps-vstup', { type: 'number', min: 1, max: P.pres.snimky.length, value: P.pres.index(st.aktivni) + 1 });
    v.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { zavriRozbal(); const s = P.pres.snimky[+v.value - 1]; if (s) P.jdiNaSnimek(s.id); } });
    rozbal(sSnimek, el('div.ps-t-popover', {}, pole('Přejít na snímek:', v)), { nad: true });
    setTimeout(() => v.select(), 30);
  };
  sJazyk.onclick = () => rozbal(sJazyk, nabidka([{ text: 'čeština', zaskrtnuto: true, akce: () => {} }, { text: 'angličtina (Spojené státy)', akce: () => {} }], { sirka: 220 }), { nad: true });

  koren.append(pas, lista2, stred, stavovy);
  body.append(koren);

  // ------------------------------------------------------------ příkazy, podokna, pás
  P.snimek = () => P.pres.snimek(st.aktivni) || P.pres.snimky[0];
  P.barvy = () => barvyPrezentace(P.pres);
  P.pismaMotivu = () => { const c = kontextSnimku(P.pres, P.snimek() || { rozvrzeni: 'obsah' }); return { nadpis: c.pismoNadpis, telo: c.pismoTelo }; };
  pridejPrikazy(P);
  pridejPodokna(P);
  obsahyKaret = postavKartyPr(P);
  // dialogy dostupné z pásu karet
  Object.assign(P, {
    dialogPismo: () => D.dialogPismo(P), dialogOdstavec: () => D.dialogOdstavec(P), dialogOdrazky: (c) => D.dialogOdrazky(P, c), dialogTabulka: () => D.dialogTabulka(P),
    dialogGraf: () => D.dialogGraf(P), dialogIkony: () => D.dialogIkony(P), dialogOdkaz: () => D.dialogOdkaz(P), dialogZapati: (z) => D.dialogZapati(P, z),
    dialogVelikostSnimku: () => D.dialogVelikostSnimku(P), dialogNastavit: () => D.dialogNastavit(P), dialogLupa: () => D.dialogLupa(P), dialogMrizka: () => D.dialogMrizka(P),
    dialogAlt: () => D.dialogAlt(P), dialogOrez: () => D.dialogOrez(P), dialogAnimace: (id, z) => D.dialogAnimace(P, id, z), dialogSmartArt: (p) => D.dialogSmartArt(P, p),
    dialogNazory: () => D.dialogNazory(P), coNoveho: () => D.dialogCoNoveho(P), najit: (n) => D.dialogNajit(P, n), nahraditPisma: () => D.dialogNahraditPisma(P),
  });

  // ------------------------------------------------------------ pomocné
  P.autor = () => nast().jmeno || State.get('pismo')?.jmeno || State.get('user')?.name || 'Uživatel';
  P.inicialy = () => P.autor().split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  P.nastaveni = nast;
  P.ulozNastaveni = (o) => { State.set('prezentace', { ...nast(), ...o }); if ('motiv' in o) P.nastavMotivOffice(o.motiv, false); obnovTitulek(); };
  P.nadpisSnimku = (s) => textZHtml(s?.objekty.find((o) => o.ph === 'nadpis')?.html || '').split('\n')[0];
  P.textObjektu = (o) => (o.typ === 'tabulka' ? o.tab.radky.flat().map((b) => textZHtml(b.html)).join(' ') : textZHtml(o.html));
  P.osnovaText = () => P.pres.snimky.map((s, i) => {
    const t = P.nadpisSnimku(s) || '(bez názvu)';
    const telo = s.objekty.filter((o) => o.ph !== 'nadpis' && (o.typ === 'text' || o.typ === 'tvar')).flatMap((o) => textZHtml(o.html).split('\n').filter(Boolean));
    return `${i + 1}. ${t}\n${telo.map((x) => '   • ' + x).join('\n')}`;
  }).join('\n\n');
  P.toast = (t) => toast({ title: 'AstroPrezentace', body: t, icon: 'check', timeout: 2600 });
  P.zprava = (t, titulek = 'AstroPrezentace') => zprava(koren, t, titulek);
  P.dotaz = (text, tlacitka, poZavreni) => dialog(koren, { titulek: 'AstroPrezentace', sirka: 420, obsah: el('p.ps-zprava', { text }), tlacitka, pri_zavreni: poZavreni });
  P.otevriAplikaci = (id, o) => openApp(id, o);
  P.otevriOdkaz = (url) => {
    if (/^#/.test(url)) {
      const i = P.pres.index(st.aktivni);
      const m = /^#snimek-(\d+)/.exec(url);
      const cil = url === '#dalsi' ? P.pres.snimky[i + 1] : url === '#predchozi' ? P.pres.snimky[i - 1] : m ? P.pres.snimky[+m[1] - 1] : null;
      if (cil) P.jdiNaSnimek(cil.id);
      return;
    }
    openApp('browser', { url });
  };
  P.fokus = () => { if (st.zobrazeni === 'razeni') razeni.focus({ preventScroll: true }); else if (st.fokus === 'miniatury') levy.focus({ preventScroll: true }); else ed.plocha.focus({ preventScroll: true }); };
  P.toastStav = (t) => { sStav.textContent = t || ''; };

  /** Rozmístí zástupné symboly nového snímku podle velikosti snímků (rozvržení jsou v 16 : 9). */
  P.pripravSnimek = (s, jenPh = false) => {
    const W = P.pres.velikost.w, H = P.pres.velikost.h;
    if (Math.abs(W - SIRKA) < 0.5 && Math.abs(H - VYSKA) < 0.5) return s;
    const r = rozvrzeniPodleId(s.rozvrzeni);
    for (const o of s.objekty) {
      const def = o.ph && r.ph.find((p) => p.ph === o.ph);
      if (!def) continue;
      Object.assign(o, { x: def.x * (W / SIRKA), y: def.y * (H / VYSKA), w: def.w * (W / SIRKA), h: def.h * (H / VYSKA) });
      if (W / SIRKA < 0.9 && !o.vel) o.vel = Math.round((def.vel || (o.ph === 'nadpis' ? 44 : 28)) * Math.min(1, (W / SIRKA) * 1.15));
    }
    void jenPh;
    return s;
  };

  // ------------------------------------------------------------ změny a historie
  P.prikaz = (popis, fn) => {
    if (st.jenCteni) { P.hlaskaJenCteni(); return false; }
    if (ed.upravuje && !/^(Psaní|Formát)/.test(popis)) {
      // úprava objektu během psaní: nejdřív uložit text
      ed.ulozText(ed.upravuje);
    }
    let ok;
    try { ok = P.pres.zmena(popis, fn); } catch (e) { console.error('AstroPrezentace:', e); P.zprava('Příkaz se nepodařilo dokončit: ' + e.message); return false; }
    return ok;
  };
  let textovyKrok = false;
  P.ulozKrokTextu = (popis) => { textovyKrok = true; P.pres.ulozKrok(popis); textovyKrok = false; };
  P.poPsani = () => { planujMiniatury(); };
  let autoCeka = 0;
  function zmena(popis) {
    const s = P.pres.snimek(st.aktivni);
    if (!s) st.aktivni = P.pres.snimky[Math.min(P.pres.snimky.length - 1, Math.max(0, st.posledniIndex || 0))]?.id;
    st.vybraneSnimky = st.vybraneSnimky.filter((id) => P.pres.snimek(id));
    if (!st.vybraneSnimky.length) st.vybraneSnimky = [st.aktivni];
    if (!textovyKrok) {
      ed.kresli();
      if (st.zobrazeni === 'razeni') kresliRazeni();
      if (st.zobrazeni === 'poznamky') kresliStrankyPoznamek();
      if (st.zobrazeni === 'osnova' && !levy.contains(document.activeElement)) kresliOsnovu();
    }
    kresliMiniatury();
    if (document.activeElement !== poznamkyEd) nactiPoznamky();
    planujObnovu();
    P.podoknoPoVyberu?.();
    P.podoknoPoZmeneSnimku?.();
    if (!st.otevreno) return;
    if (!st.dirty) { st.dirty = true; obnovTitulek(); }
    clearTimeout(autoCeka);
    if (st.autoUkladani && st.cesta) autoCeka = setTimeout(() => P.ulozit({ tise: true }), 1500);
    void popis;
  }
  P.zpet = (n = 1) => { if (ed.upravuje) { ed.ulozText(ed.upravuje); } if (P.pres.zpet(n)) { ed.vyber = ed.vyber.filter((id) => ed.objekt(id)); } };
  P.znovu = () => { if (ed.upravuje) ed.ulozText(ed.upravuje); P.pres.znovu(); };

  // ------------------------------------------------------------ výběr snímku
  P.vybraneSnimky = () => (st.vybraneSnimky.length ? P.pres.snimky.filter((s) => st.vybraneSnimky.includes(s.id)).map((s) => s.id) : [st.aktivni]);
  P.jdiNaSnimek = (id, { pridat = false, rozsah = false } = {}) => {
    if (!P.pres.snimek(id)) return;
    ed.ukonciUpravy();
    ulozPoznamky();
    if (rozsah) {
      const a = P.pres.index(st.aktivni), b = P.pres.index(id);
      st.vybraneSnimky = P.pres.snimky.slice(Math.min(a, b), Math.max(a, b) + 1).map((s) => s.id);
    } else if (pridat) {
      st.vybraneSnimky = st.vybraneSnimky.includes(id) && st.vybraneSnimky.length > 1 ? st.vybraneSnimky.filter((x) => x !== id) : [...new Set([...st.vybraneSnimky, id])];
    } else st.vybraneSnimky = [id];
    const zmenaSnimku = st.aktivni !== id;
    st.aktivni = id;
    st.posledniIndex = P.pres.index(id);
    if (zmenaSnimku) { ed.vyber = []; st.vybraneAnimace = []; }
    ed.kresli();
    nactiPoznamky();
    oznacMiniatury();
    if (st.zobrazeni === 'razeni') oznacRazeni();
    if (st.zobrazeni === 'poznamky') strankaPozn.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    planujObnovu();
    P.podoknoPoVyberu?.();
    P.podoknoPoZmeneSnimku?.();
  };

  // ------------------------------------------------------------ panel miniatur
  const cacheMini = new Map();   // id → { klic, uzel }
  let klicMotivu = '';
  function klicSnimku(s) { return JSON.stringify(s) + klicMotivu; }
  function polozkaMiniatury(s, i) {
    const w = Math.max(80, (levy.clientWidth || 200) - 50);
    const klic = klicSnimku(s) + w + (i + 1);
    let c = cacheMini.get(s.id);
    if (!c || c.klic !== klic) {
      const mini = miniatura(P.pres, s, w, { cislo: i + 1 });
      const cislo = el('div.pr-mini-cislo', {}, el('span', { text: String(i + 1) }),
        (s.prechod?.typ && s.prechod.typ !== 'zadny') || s.animace?.length ? el('span.pr-mini-hvezda', { title: 'Tento snímek má přechod nebo animace', html: '<svg viewBox="0 0 16 16"><path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.4L8 11.2 4.1 13.4l.9-4.4-3.3-3 4.4-.5z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>' }) : null,
        s.komentare?.length ? el('span.pr-mini-kom', { title: 'Komentáře', html: '<svg viewBox="0 0 16 16"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>' }) : null);
      const uzel = el('div.pr-mini-pol' + (s.skryty ? '.skryty' : ''), { dataset: { id: s.id }, title: P.nadpisSnimku(s) || `Snímek ${i + 1}` }, cislo, el('div.pr-mini-ram', {}, mini));
      c = { klic, uzel };
      cacheMini.set(s.id, c);
    }
    return c.uzel;
  }
  function kresliMiniatury(vynutit = false) {
    if (st.zobrazeni === 'osnova') return;
    if (vynutit) cacheMini.clear();
    klicMotivu = JSON.stringify([P.pres.motiv, P.pres.varianta, P.pres.barvyZ, P.pres.pisma, P.pres.velikost, P.pres.zapati]);
    const deti = [];
    let i = 0;
    for (const sk of P.pres.skupiny()) {
      if (sk.oddil) {
        const sbalene = st.sbalene.has(sk.oddil.id);
        const hlava = el('div.pr-oddil' + (sbalene ? '.sbaleny' : ''), { dataset: { oddil: sk.oddil.id } },
          el('button.pr-oddil-sipka', { type: 'button', text: sbalene ? '›' : '⌄' }), el('span', { text: sk.oddil.nazev }), sbalene ? el('small', { text: `(${sk.snimky.length})` }) : null);
        hlava.onclick = () => { if (sbalene) st.sbalene.delete(sk.oddil.id); else st.sbalene.add(sk.oddil.id); kresliMiniatury(); };
        hlava.oncontextmenu = (e) => { e.preventDefault(); if (!sk.oddil.virtualni) { P.jdiNaSnimek(sk.oddil.od); nabidkaOddilu(e); } };
        hlava.ondblclick = () => { if (!sk.oddil.virtualni) { P.jdiNaSnimek(sk.oddil.od); P.oddil('prejmenovat'); } };
        deti.push(hlava);
        if (sbalene) { i += sk.snimky.length; continue; }
      }
      for (const s of sk.snimky) deti.push(polozkaMiniatury(s, i++));
    }
    const ids = new Set(P.pres.snimky.map((s) => s.id));
    for (const k of cacheMini.keys()) if (!ids.has(k)) cacheMini.delete(k);
    const seznam = levy.querySelector('.pr-mini-seznam') || el('div.pr-mini-seznam');
    // jen když se něco změnilo (zabrání problikávání)
    const stejne = seznam.children.length === deti.length && deti.every((d, k) => seznam.children[k] === d);
    if (!stejne) seznam.replaceChildren(...deti);
    if (!seznam.isConnected) levy.replaceChildren(seznam);
    oznacMiniatury();
  }
  P.kresliMiniatury = kresliMiniatury;
  let miniCeka = 0;
  function planujMiniatury() { clearTimeout(miniCeka); miniCeka = setTimeout(() => {
    // při psaní se překreslí jen miniatura aktuálního snímku z živého DOM
    const s = P.snimek();
    if (!s) return;
    const c = cacheMini.get(s.id);
    if (!c) return;
    const t = ed.upravuje && ed.editovatelne(ed.upravuje);
    if (!t) return;
    const kopieSn = ed.snObal.firstElementChild?.cloneNode(true);
    if (!kopieSn) return;
    kopieSn.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
    kopieSn.querySelectorAll('.pr-vyzva').forEach((x) => { x.closest('.pr-o').style.visibility = 'hidden'; });
    const ram = c.uzel.querySelector('.pr-mini');
    const w = parseFloat(ram.style.width);
    kopieSn.style.transform = `scale(${w / P.pres.velikost.w})`;
    kopieSn.classList.add('mini');
    ram.replaceChildren(kopieSn);
  }, 350); }
  function oznacMiniatury() {
    for (const u of levy.querySelectorAll('.pr-mini-pol')) {
      u.classList.toggle('aktivni', u.dataset.id === st.aktivni);
      u.classList.toggle('vybrano', st.vybraneSnimky.includes(u.dataset.id) && st.vybraneSnimky.length > 1);
    }
    const a = levy.querySelector('.pr-mini-pol.aktivni');
    if (a && st.zobrazeni !== 'osnova') {
      const r = a.getBoundingClientRect(), l = levy.getBoundingClientRect();
      if (r.top < l.top || r.bottom > l.bottom) a.scrollIntoView({ block: 'nearest' });
    }
  }
  function nabidkaOddilu(e) {
    const k = el('div', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } });
    document.body.append(k);
    rozbal(k, nabidka([
      { text: 'Přejmenovat oddíl', akce: () => P.oddil('prejmenovat') },
      { text: 'Odebrat oddíl', akce: () => P.oddil('odebrat') },
      { text: 'Odebrat všechny oddíly', akce: () => P.oddil('odebratVse') },
      'sep', { text: 'Sbalit vše', akce: () => P.oddil('sbalit') }, { text: 'Rozbalit vše', akce: () => P.oddil('rozbalit') },
    ], { sirka: 220 }), { poZavreni: () => k.remove() });
  }

  // interakce v panelu miniatur: výběr, přetahování, nabídka
  levy.addEventListener('pointerdown', (e) => {
    st.fokus = 'miniatury';
    const pol = e.target.closest('.pr-mini-pol');
    if (!pol) return;
    levy.focus({ preventScroll: true });
    const id = pol.dataset.id;
    if (e.button === 2) { if (!st.vybraneSnimky.includes(id)) P.jdiNaSnimek(id); return; }
    if (e.shiftKey || e.ctrlKey) { P.jdiNaSnimek(id, { pridat: e.ctrlKey, rozsah: e.shiftKey }); return; }
    if (!st.vybraneSnimky.includes(id) || st.vybraneSnimky.length === 1) P.jdiNaSnimek(id);
    tahniMiniatury(e, levy, '.pr-mini-pol', 'y');
  });
  levy.addEventListener('contextmenu', (e) => { e.preventDefault(); P.kontextovaNabidka(e, 'miniatury'); });
  levy.addEventListener('keydown', (e) => klavesaMiniatur(e));
  ed.plocha.addEventListener('pointerdown', () => { st.fokus = 'platno'; }, true);

  function tahniMiniatury(e, kont, sel, osa) {
    const x0 = e.clientX, y0 = e.clientY;
    let cil = null, carka = null, tazeno = false;
    const ids = P.vybraneSnimky();
    const mv = (ev) => {
      if (!tazeno && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      tazeno = true;
      kont.classList.add('tazeni');
      const pol = [...kont.querySelectorAll(sel)];
      cil = pol.length;
      for (let k = 0; k < pol.length; k++) {
        const r = pol[k].getBoundingClientRect();
        const pred = osa === 'y' ? ev.clientY < r.top + r.height / 2 : (ev.clientY < r.bottom && ev.clientX < r.left + r.width / 2) || ev.clientY < r.top;
        if (pred) { cil = k; break; }
      }
      carka?.remove();
      carka = el('div.pr-mini-cil' + (osa === 'x' ? '.svisla' : ''));
      const ref = pol[cil] || pol[pol.length - 1];
      const r = ref.getBoundingClientRect(), kr = kont.getBoundingClientRect();
      if (osa === 'y') Object.assign(carka.style, { top: (cil < pol.length ? r.top - 4 : r.bottom + 2) - kr.top + kont.scrollTop + 'px' });
      else Object.assign(carka.style, { left: (cil < pol.length ? r.left - 8 : r.right + 6) - kr.left + kont.scrollLeft + 'px', top: r.top - kr.top + kont.scrollTop + 'px', height: r.height + 'px' });
      kont.append(carka);
      // automatické posouvání
      const kr2 = kont.getBoundingClientRect();
      if (ev.clientY < kr2.top + 30) kont.scrollTop -= 12; else if (ev.clientY > kr2.bottom - 30) kont.scrollTop += 12;
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      carka?.remove();
      kont.classList.remove('tazeni');
      if (!tazeno || cil === null) return;
      const pol = [...kont.querySelectorAll(sel)];
      const idCil = pol[cil]?.dataset.id;
      const naIndex = idCil ? P.pres.index(idCil) : P.pres.snimky.length;
      P.presunoutSnimky(ids, naIndex);
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function klavesaMiniatur(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    const i = P.pres.index(st.aktivni);
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); const s = P.pres.snimky[i + 1]; if (s) P.jdiNaSnimek(s.id, { rozsah: e.shiftKey }); return; }
    if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); const s = P.pres.snimky[i - 1]; if (s) P.jdiNaSnimek(s.id, { rozsah: e.shiftKey }); return; }
    if (k === 'Home') { e.preventDefault(); P.jdiNaSnimek(P.pres.snimky[0].id); return; }
    if (k === 'End') { e.preventDefault(); P.jdiNaSnimek(P.pres.snimky.at(-1).id); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); P.odstranitSnimky(); return; }
    if (k === 'Enter') { e.preventDefault(); P.novySnimek(); return; }
    if (ctrl && k.toLowerCase() === 'a') { e.preventDefault(); st.vybraneSnimky = P.pres.snimky.map((s) => s.id); oznacMiniatury(); oznacRazeni(); return; }
    if (ctrl && k.toLowerCase() === 'c') { e.preventDefault(); P.kopirovat(); return; }
    if (ctrl && k.toLowerCase() === 'x') { e.preventDefault(); P.vyjmout(); return; }
    if (ctrl && k.toLowerCase() === 'v') { e.preventDefault(); P.vlozit(); return; }
    if (ctrl && k.toLowerCase() === 'd') { e.preventDefault(); P.duplikovatSnimky(); return; }
    if (ctrl && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); P.presunoutSnimky(P.vybraneSnimky(), Math.max(0, i + (k === 'ArrowUp' ? -1 : 2))); }
  }
  P.klavesaSnimku = (e) => {
    const i = P.pres.index(st.aktivni);
    if (e.key === 'PageDown') { e.preventDefault(); const s = P.pres.snimky[i + 1]; if (s) P.jdiNaSnimek(s.id); }
    if (e.key === 'PageUp') { e.preventDefault(); const s = P.pres.snimky[i - 1]; if (s) P.jdiNaSnimek(s.id); }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); P.kopirovat(); }
    if (ctrl && e.key.toLowerCase() === 'x') { e.preventDefault(); P.vyjmout(); }
    if (ctrl && e.key.toLowerCase() === 'v') {
      P.stalaSeUdalostVlozeni = false;
      setTimeout(() => { if (!P.stalaSeUdalostVlozeni && P.schranka) P.vlozit(); }, 30);
    }
  };
  // Ctrl+C/X/V nad vybranými objekty (editor je volá přes klavesaSnimku jen bez výběru)
  ed.plocha.addEventListener('keydown', (e) => {
    if (ed.upravuje || !(e.ctrlKey || e.metaKey) || !ed.vyber.length) return;
    const k = e.key.toLowerCase();
    if (k === 'c') { e.preventDefault(); P.kopirovat(); }
    if (k === 'x') { e.preventDefault(); P.vyjmout(); }
    if (k === 'v') { P.stalaSeUdalostVlozeni = false; setTimeout(() => { if (!P.stalaSeUdalostVlozeni && P.schranka) P.vlozit(); }, 30); }
  }, true);

  // šířka panelu miniatur
  levyTahlo.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = levy.offsetWidth;
    const mv = (ev) => { levy.style.width = Math.max(110, Math.min(520, w0 + ev.clientX - x0)) + 'px'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); P.ulozNastaveni({ sirkaPanelu: levy.offsetWidth }); kresliMiniatury(true); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  if (nast().sirkaPanelu) levy.style.width = nast().sirkaPanelu + 'px';

  // ------------------------------------------------------------ poznámky
  function nactiPoznamky() { poznamkyEd.textContent = P.snimek()?.poznamky || ''; }
  let poznCeka = 0;
  function ulozPoznamky() {
    clearTimeout(poznCeka);
    const s = P.snimek();
    if (!s) return;
    const t = poznamkyEd.textContent;
    if ((s.poznamky || '') === t) return;
    s.poznamky = t;
    P.ulozKrokTextu('Poznámky');
    kresliMiniatury();
  }
  poznamkyEd.addEventListener('input', () => { clearTimeout(poznCeka); poznCeka = setTimeout(ulozPoznamky, 700); });
  poznamkyEd.addEventListener('blur', ulozPoznamky);
  poznamkyEd.addEventListener('focus', () => { st.fokus = 'poznamky'; ed.ukonciUpravy(); });
  poznamkyEd.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { ulozPoznamky(); P.fokus(); } if (e.key === 'F5') { e.preventDefault(); P.prezentovat(e.shiftKey ? null : 0); } });
  poznTahlo.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const y0 = e.clientY, h0 = poznamky.offsetHeight;
    const mv = (ev) => { poznamky.style.height = Math.max(40, Math.min(hlavni.clientHeight - 120, h0 - (ev.clientY - y0))) + 'px'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); P.ulozNastaveni({ vyskaPoznamek: poznamky.offsetHeight }); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  if (nast().vyskaPoznamek) poznamky.style.height = nast().vyskaPoznamek + 'px';
  P.prepniPoznamky = (v) => {
    st.poznamky = v ?? !st.poznamky;
    koren.classList.toggle('bez-poznamek', !st.poznamky);
    P.ulozNastaveni({ poznamky: st.poznamky });
    obnov();
    if (st.poznamky) setTimeout(() => poznamkyEd.focus(), 30);
  };
  koren.classList.toggle('bez-poznamek', !st.poznamky);

  // ------------------------------------------------------------ zobrazení: osnova, řazení, stránka poznámek
  P.zobrazeni = (r) => {
    ed.ukonciUpravy();
    ulozPoznamky();
    st.zobrazeni = r;
    koren.dataset.zobrazeni = r;
    razeni.hidden = r !== 'razeni';
    strankaPozn.hidden = r !== 'poznamky';
    hlavni.hidden = r === 'razeni' || r === 'poznamky';
    levy.hidden = levyTahlo.hidden = r === 'razeni' || r === 'poznamky';
    if (r === 'osnova') kresliOsnovu(); else { levy.replaceChildren(); cacheMini.clear(); kresliMiniatury(); }
    if (r === 'razeni') kresliRazeni();
    if (r === 'poznamky') kresliStrankyPoznamek();
    requestAnimationFrame(() => { if (ed.prizpusobit) ed.prizpusob(); });
    obnov();
  };
  function kresliOsnovu() {
    const obal = el('div.pr-osnova');
    P.pres.snimky.forEach((s, i) => {
      const nadpis = s.objekty.find((o) => o.ph === 'nadpis');
      const telo = s.objekty.find((o) => /^(obsah|podtitul|text)/.test(o.ph || ''));
      const n = el('div.pr-osnova-nadpis', { contenteditable: nadpis ? 'plaintext-only' : 'false', text: textZHtml(nadpis?.html || '') });
      const t = el('div.pr-osnova-telo', { contenteditable: telo ? 'true' : 'false', html: telo?.html || '' });
      const blok = el('div.pr-osnova-snimek' + (s.id === st.aktivni ? '.aktivni' : ''), { dataset: { id: s.id } },
        el('div.pr-osnova-cislo', {}, el('span', { text: String(i + 1) }), el('span.pr-osnova-ik')), el('div', {}, n, telo ? t : null));
      const uloz = () => {
        P.prikaz('Osnova', () => {
          if (nadpis) nadpis.html = n.textContent.trim() ? odstavce(n.textContent.split('\n')) : '';
          if (telo) telo.html = jePrazdnyText(t.innerHTML) ? '' : t.innerHTML.replace(/<div/g, '<p').replace(/<\/div>/g, '</p>');
        });
      };
      for (const x of [n, t]) {
        x.addEventListener('focus', () => { if (st.aktivni !== s.id) { st.aktivni = s.id; st.vybraneSnimky = [s.id]; ed.kresli(); nactiPoznamky(); obal.querySelectorAll('.pr-osnova-snimek').forEach((b) => b.classList.toggle('aktivni', b === blok)); planujObnovu(); } });
        x.addEventListener('blur', uloz);
        x.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Tab' && x === t) { e.preventDefault(); const sel = getSelection(); const p = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement).closest('p'); if (p) { const u = Math.max(0, Math.min(4, +(p.dataset.u || 0) + (e.shiftKey ? -1 : 1))); if (u) p.dataset.u = u; else delete p.dataset.u; } }
          if (e.key === 'Enter' && x === n) { e.preventDefault(); uloz(); if (e.ctrlKey || !telo) P.novySnimek(); else t.focus(); }
        });
      }
      obal.append(blok);
    });
    levy.replaceChildren(obal);
  }
  function kresliRazeni() {
    const w = Math.round(Math.max(150, Math.min(320, (razeni.clientWidth - 70) / 4 - 40)) * (st.zoomRazeni || 1));
    const deti = [];
    let i = 0;
    for (const sk of P.pres.skupiny()) {
      if (sk.oddil) deti.push(el('div.pr-razeni-oddil', {}, el('span', { text: sk.oddil.nazev }), el('small', { text: `(${sk.snimky.length})` })));
      deti.push(el('div.pr-razeni-mrizka', {}, sk.snimky.map((s) => {
        const n = i++;
        const pol = el('div.pr-razeni-pol' + (s.skryty ? '.skryty' : ''), { dataset: { id: s.id } }, el('div.pr-mini-ram', {}, miniatura(P.pres, s, w, { cislo: n + 1 })),
          el('div.pr-razeni-info', {}, el('span', { text: String(n + 1) }), (s.prechod?.typ && s.prechod.typ !== 'zadny') || s.animace?.length ? el('span.pr-mini-hvezda', { text: '☆' }) : null, s.prechod?.auto !== undefined && s.prechod?.auto !== null ? el('small', { text: `${String(Math.floor(s.prechod.auto / 60)).padStart(2, '0')}:${String(Math.round(s.prechod.auto % 60)).padStart(2, '0')}` }) : null));
        pol.ondblclick = () => { P.zobrazeni('normalni'); P.jdiNaSnimek(s.id); };
        return pol;
      })));
    }
    razeni.replaceChildren(...deti);
    oznacRazeni();
  }
  function oznacRazeni() {
    for (const u of razeni.querySelectorAll('.pr-razeni-pol')) u.classList.toggle('vybrano', P.vybraneSnimky().includes(u.dataset.id));
  }
  razeni.addEventListener('pointerdown', (e) => {
    st.fokus = 'miniatury';
    razeni.focus({ preventScroll: true });
    const pol = e.target.closest('.pr-razeni-pol');
    if (!pol) return;
    const id = pol.dataset.id;
    if (e.button === 2) { if (!st.vybraneSnimky.includes(id)) P.jdiNaSnimek(id); return; }
    if (e.shiftKey || e.ctrlKey) { P.jdiNaSnimek(id, { pridat: e.ctrlKey, rozsah: e.shiftKey }); return; }
    if (!st.vybraneSnimky.includes(id) || st.vybraneSnimky.length === 1) P.jdiNaSnimek(id);
    tahniMiniatury(e, razeni, '.pr-razeni-pol', 'x');
  });
  razeni.addEventListener('contextmenu', (e) => { e.preventDefault(); P.kontextovaNabidka(e, 'miniatury'); });
  razeni.addEventListener('keydown', (e) => klavesaMiniatur(e));
  razeni.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); st.zoomRazeni = Math.max(0.5, Math.min(2.2, (st.zoomRazeni || 1) + (e.deltaY < 0 ? 0.1 : -0.1))); kresliRazeni(); obnovStav(); } }, { passive: false });

  function kresliStrankyPoznamek() {
    const w = 520;
    strankaPozn.replaceChildren(...P.pres.snimky.map((s, i) => {
      const txt = el('div.pr-sp-text', { contenteditable: 'plaintext-only', text: s.poznamky || '', dataset: { vyzva: 'Kliknutím přidáte poznámky' } });
      txt.addEventListener('keydown', (e) => e.stopPropagation());
      txt.addEventListener('blur', () => { if ((s.poznamky || '') !== txt.textContent) { s.poznamky = txt.textContent; P.ulozKrokTextu('Poznámky'); } });
      txt.addEventListener('focus', () => { if (st.aktivni !== s.id) { st.aktivni = s.id; st.vybraneSnimky = [s.id]; planujObnovu(); } });
      return el('div.pr-sp-stranka', { dataset: { id: s.id } }, el('div.pr-mini-ram', {}, miniatura(P.pres, s, w, { cislo: i + 1 })), txt, el('div.pr-sp-cislo', { text: String(i + 1) }));
    }));
  }

  // ------------------------------------------------------------ kontextové nabídky
  P.kontextovaNabidka = (e, druh) => {
    const k = el('div', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } });
    document.body.append(k);
    const sub = (text, ikona, obsah) => ({ uzel: el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (ev) => { ev.stopPropagation(); rozbal(ev.currentTarget, typeof obsah === 'function' ? obsah() : nabidka(obsah, { sirka: 220 }), { app: 'prezentace' }); } }, el('span.ps-nab-ik', {}, ikona ? ik(ikona) : ''), el('span.ps-nab-text', { text }), el('span.tb-sub-sipka', { text: '›' })) });
    const vlozeni = [{ nadpis: 'Možnosti vložení:' }, { text: 'Vložit', ikona: 'vlozit', zakazano: !P.schranka, akce: () => P.vlozit() }];
    let polozky;
    const o = ed.vybrane()[0];
    if (druh === 'miniatury') {
      polozky = [
        { text: 'Vyjmout', ikona: 'vyjmout', akce: () => P.vyjmout() }, { text: 'Kopírovat', ikona: 'kopirovat', akce: () => { st.fokus = 'miniatury'; P.kopirovat(); } }, ...vlozeni, 'sep',
        { text: 'Nový snímek', ikona: 'novySnimek', akce: () => P.novySnimek() }, { text: 'Duplikovat snímek', ikona: 'duplikovat', akce: () => P.duplikovatSnimky() }, { text: 'Odstranit snímek', ikona: 'odstranit', akce: () => P.odstranitSnimky() }, 'sep',
        { text: 'Přidat oddíl', ikona: 'oddil', akce: () => P.oddil('pridat') }, sub('Rozložení', 'rozvrzeni', () => galerieRozvrzeni(P, P.zmenRozvrzeni)), { text: 'Obnovit snímek', ikona: 'obnovit', akce: () => P.obnovitSnimek() }, { text: 'Formát pozadí…', ikona: 'formatPozadi', akce: () => P.podokno('pozadi') }, 'sep',
        { text: P.snimek()?.skryty ? 'Zobrazit snímek' : 'Skrýt snímek', ikona: 'skrytSnimek', akce: () => P.skrytSnimek() }, { text: 'Nový komentář', ikona: 'komentarNovy', akce: () => P.novyKomentar() },
      ];
    } else if (druh === 'text') {
      polozky = [
        { text: 'Vyjmout', ikona: 'vyjmout', akce: () => document.execCommand('cut') }, { text: 'Kopírovat', ikona: 'kopirovat', akce: () => document.execCommand('copy') }, { text: 'Vložit', ikona: 'vlozit', akce: () => P.vlozit() }, 'sep',
        { text: 'Písmo…', ikona: 'barvaPisma', akce: () => P.dialogPismo() }, { text: 'Odstavec…', ikona: 'zarovnatVlevo', akce: () => P.dialogOdstavec() },
        sub('Odrážky', 'odrazky', [{ text: 'Žádné', akce: () => P.odrazky('ne') }, ...['•', '○', '■', '➢', '✓'].map((z) => ({ text: z + '  odrážka', akce: () => P.odrazky(z) }))]),
        sub('Číslování', 'cislovani', [{ text: 'Žádné', akce: () => P.cislovani('ne') }, { text: '1. 2. 3.', akce: () => P.cislovani('1.') }, { text: 'a) b) c)', akce: () => P.cislovani('a)') }, { text: 'I. II. III.', akce: () => P.cislovani('I.') }]),
        { text: 'Převést na obrázek SmartArt…', ikona: 'prevestSmartArt', akce: () => P.dialogSmartArt(true) }, 'sep',
        { text: 'Odkaz…', ikona: 'odkaz', klavesa: 'Ctrl+K', akce: () => P.dialogOdkaz() }, { text: 'Nový komentář', ikona: 'komentarNovy', akce: () => P.novyKomentar() },
      ];
    } else if (druh === 'objekt') {
      const obr = o?.typ === 'obrazek';
      polozky = [
        { text: 'Vyjmout', ikona: 'vyjmout', akce: () => P.vyjmout() }, { text: 'Kopírovat', ikona: 'kopirovat', akce: () => P.kopirovat() }, ...vlozeni, 'sep',
        TEXTOVE_OBJ(o) ? { text: 'Upravit text', ikona: 'tuzka', akce: () => ed.zacniUpravy(o.id, { vybratVse: true }) } : null,
        o?.typ === 'graf' ? { text: 'Upravit data…', ikona: 'upravitData', akce: () => P.upravDataGrafu(o.id) } : null,
        obr ? { text: 'Změnit obrázek…', ikona: 'obrazky', akce: () => P.zmenitObrazek() } : null,
        sub('Přenést do popředí', 'dopredu', [{ text: 'Přenést do popředí', akce: () => P.usporadat('popredi') }, { text: 'Přenést blíž', akce: () => P.usporadat('dopredu') }]),
        sub('Přenést do pozadí', 'dozadu', [{ text: 'Přenést do pozadí', akce: () => P.usporadat('pozadi') }, { text: 'Přenést dál', akce: () => P.usporadat('dozadu') }]), 'sep',
        { text: 'Odkaz…', ikona: 'odkaz', akce: () => P.dialogOdkaz() },
        obr ? { text: 'Uložit jako obrázek…', ikona: 'ulozitJako', akce: () => P.ulozitObrazek(o) } : null,
        { text: 'Upravit alternativní text…', ikona: 'alternativniText', akce: () => P.dialogAlt() },
        { text: 'Velikost a umístění…', ikona: 'velikost', akce: () => P.podokno('format', { zalozka: 'velikost' }) },
        { text: obr ? 'Formát obrázku…' : 'Formát obrazce…', ikona: 'vyplnTvaru', akce: () => P.podokno('format') },
        { text: 'Nový komentář', ikona: 'komentarNovy', akce: () => P.novyKomentar() },
      ].filter(Boolean);
    } else {
      polozky = [
        { text: 'Vyjmout', ikona: 'vyjmout', zakazano: true }, { text: 'Kopírovat', ikona: 'kopirovat', zakazano: true }, ...vlozeni, 'sep',
        sub('Rozložení', 'rozvrzeni', () => galerieRozvrzeni(P, P.zmenRozvrzeni)), { text: 'Obnovit snímek', ikona: 'obnovit', akce: () => P.obnovitSnimek() }, 'sep',
        { text: 'Pravítko', zaskrtnuto: st.pravitko, akce: () => P.nastavZobrazeni({ pravitko: !st.pravitko }) },
        sub('Mřížka a vodítka', 'mrizka', [{ text: 'Mřížka', zaskrtnuto: st.mrizka, akce: () => P.nastavZobrazeni({ mrizka: !st.mrizka }) }, { text: 'Vodítka', zaskrtnuto: st.voditka, akce: () => P.nastavZobrazeni({ voditka: !st.voditka }) }, 'sep', { text: 'Mřížka a vodítka…', akce: () => P.dialogMrizka() }]),
        'sep', { text: 'Formát pozadí…', ikona: 'formatPozadi', akce: () => P.podokno('pozadi') }, { text: 'Nový komentář', ikona: 'komentarNovy', akce: () => P.novyKomentar() },
      ];
    }
    rozbal(k, nabidka(polozky, { sirka: 250 }), { poZavreni: () => k.remove() });
  };
  const TEXTOVE_OBJ = (o) => o && (o.typ === 'text' || (o.typ === 'tvar' && !jeCara(o.tvar)) || o.typ === 'tabulka');
  P.ulozitObrazek = (o) => {
    const src = P.pres.src(o.src);
    const typ = /^data:image\/(\w+)/.exec(src)?.[1] || 'png';
    const slozka = FS.HOME + '/Obrázky';
    const c = FS.join(slozka, FS.freeName(slozka, (o.nazevSouboru || 'Obrázek').replace(/\.[^.]+$/, '') + '.' + (typ === 'jpeg' ? 'jpg' : typ)));
    try { FS.write(c, src); P.toast(`Uloženo do ${c.replace(FS.HOME, '~')}`); } catch (e) { P.zprava(e.message); }
  };

  // ------------------------------------------------------------ obnova UI
  let obnovaCeka = 0;
  function planujObnovu() { if (obnovaCeka) return; obnovaCeka = requestAnimationFrame(() => { obnovaCeka = 0; obnov(); }); }
  P.planujObnovu = planujObnovu;

  function spocitejStav() {
    const vyb = ed.vybrane();
    const o = vyb[0] || (ed.upravuje ? ed.objekt(ed.upravuje) : null);
    const stav = { objekt: o, typ: o?.typ };
    // text: z výběru při úpravě, jinak z prvního odstavce objektu
    let prvek = null;
    if (ed.upravuje) {
      const sel = getSelection();
      const t = ed.editovatelne(ed.upravuje);
      if (sel.anchorNode && t?.contains(sel.anchorNode)) prvek = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      else prvek = t?.querySelector('p') || t;
    } else if (o) {
      const u = ed.uzel(o.id);
      prvek = u?.querySelector('.pr-t p span, .pr-t p, .pr-tab td') || null;
    }
    if (prvek) {
      const cs = getComputedStyle(prvek);
      const rodina = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      const pm = P.pismaMotivu();
      const motivove = !o?.pismo || o.pismo.startsWith('+');
      const jeNadpis = o?.pismo === '+nadpis' || (!o?.pismo && o?.ph?.startsWith('nadpis'));
      stav.pismo = motivove && jeNadpis && rodina === pm.nadpis ? `${rodina} (Nadpisy)` : motivove && rodina === pm.telo ? `${rodina} (Základní text)` : motivove && rodina === pm.nadpis ? `${rodina} (Nadpisy)` : rodina;
      const fit = +(ed.uzel(o?.id)?.dataset.fit || 0) / 100;
      stav.velikost = +(parseFloat(cs.fontSize) / (fit || 1)).toFixed(1);
      stav.fit = !!fit && fit < 1;
      stav.tucne = +cs.fontWeight >= 600;
      stav.kurziva = cs.fontStyle === 'italic';
      const dek = [...ancestorsDekorace(prvek)].join(' ');
      stav.podtrzeni = dek.includes('underline');
      stav.preskrtnuti = dek.includes('line-through');
      stav.stin = cs.textShadow && cs.textShadow !== 'none';
      stav.rozestup = parseFloat(cs.letterSpacing) || 0;
      const p = prvek.closest('p, td');
      if (p) {
        const pa = getComputedStyle(p).textAlign;
        stav.zar = { left: 'l', start: 'l', center: 'c', right: 'r', end: 'r', justify: 'j' }[pa] || 'l';
        stav.odrazky = !!p.dataset.b && !p.classList.contains('cislo');
        stav.cislovani = p.classList.contains('cislo');
      }
    }
    if (o) {
      stav.svisle = o.svisle || (o.typ === 'tvar' ? 'm' : o.ph === 'nadpis' ? 'm' : o.ph ? rozvrzeniPodleId(P.snimek().rozvrzeni).ph.find((x) => x.ph === o.ph)?.svisle || 't' : 't');
      stav.sloupce = o.sloupce || 1;
      stav.radkovani = o.radkovani;
    }
    return stav;
  }
  function ancestorsDekorace(u) {
    const out = new Set();
    for (let x = u; x && !x.classList?.contains('pr-o'); x = x.parentElement) { const d = getComputedStyle(x).textDecorationLine; if (d && d !== 'none') out.add(d); }
    return out;
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
    for (const f of P.obnovyGalerii || []) { try { f(); } catch { /* nic */ } }
    // kontextové karty
    const o = P.stav.objekt;
    const typy = new Set(ed.vybrane().map((x) => x.typ));
    const kontext = {
      tvar: !!o && (typy.has('tvar') || typy.has('text') || typy.has('ikona')),
      obrazek: typy.has('obrazek'),
      tabulka: typy.has('tabulka') || (ed.upravuje && ed.objekt(ed.upravuje)?.typ === 'tabulka'),
      graf: typy.has('graf'),
    };
    let prepnout = false;
    for (const k of KARTY_PR) {
      if (!k.kontext) continue;
      const vid = !!kontext[k.kontext];
      tlKaret[k.id].hidden = !vid;
      if (!vid && st.karta === k.id) prepnout = true;
    }
    if (prepnout) prepniKartu('domu');
    obnovZpet();
    obnovStav();
  }
  P.obnov = obnov;
  function obnovZpet() {
    bZpet.disabled = !P.pres.muzeZpet && !ed.upravuje;
    bZpet.title = P.pres.muzeZpet ? `Zpět: ${P.pres.popisZpet || 'Úprava'} (Ctrl+Z)` : 'Nelze vrátit zpět';
    bZnovu.disabled = !P.pres.muzeZnovu;
  }
  function obnovStav() {
    const n = P.pres.snimky.length;
    sSnimek.textContent = st.vybraneSnimky.length > 1 ? `Vybrané snímky: ${st.vybraneSnimky.length} z ${n}` : `Snímek ${P.pres.index(st.aktivni) + 1} z ${n}`;
    const z = st.zobrazeni === 'razeni' ? Math.round((st.zoomRazeni || 1) * 100) : Math.round(ed.z * 100);
    zoomText.textContent = z + ' %';
    if (document.activeElement !== zoomPosuvnik) zoomPosuvnik.value = String(hodnotaZoomu(z));
    const problemy = kontrolaPristupnosti(P).length;
    sPristupnost.lastChild.textContent = problemy ? 'Přístupnost: Prozkoumat' : 'Přístupnost: Vše je v pořádku';
    sRezimy.forEach((b) => b.classList.toggle('aktivni', b.dataset.r === st.zobrazeni || (b.dataset.r === 'normalni' && st.zobrazeni === 'osnova')));
    sPoznamky.classList.toggle('aktivni', st.poznamky);
    sKomentare.classList.toggle('aktivni', st.podokno === 'komentare');
    bKomentare.classList.toggle('aktivni', st.podokno === 'komentare');
    lista2.hidden = !st.jenCteni;
  }
  P.poZmeneZoomu = () => obnovStav();
  P.poZmeneVyberu = () => {
    if (P.st.stetec && ed.vyber.length) P.pouzijStetec(ed.vyber);
    if (P.st.stetecAnimace && ed.vyber.length) P.pouzijStetecAnimace(ed.vyber);
    st.vybraneAnimace = [];
    planujObnovu();
    P.podoknoPoVyberu?.();
  };
  // štítky pořadí animací na plátně (karta Animace nebo podokno animací)
  P.poKresleniVyberu = () => {
    ed.vrstva.querySelectorAll('.pr-anim-stitek').forEach((x) => x.remove());
    if (st.karta !== 'animace' && st.podokno !== 'animace') return;
    const s = P.snimek();
    if (!s?.animace?.length) return;
    const kroky = krokyAnimaci(s);
    const cisla = new Map();
    kroky.forEach((k, i) => { for (const { a } of k.polozky) { const c = k.automaticky ? 0 : i + (kroky[0]?.automaticky ? 0 : 1); cisla.set(a.obj, [...(cisla.get(a.obj) || []), c]); } });
    for (const [id, c] of cisla) {
      const o = ed.objekt(id);
      if (!o) continue;
      ed.vrstva.append(el('div.pr-anim-stitek', { text: [...new Set(c)].join(','), style: { left: o.x * ed.z - 22 + 'px', top: o.y * ed.z + 'px' } }));
    }
  };
  // stav výběru textu se mění i bez kliknutí na objekt
  const vyberZmena = () => { if (ed.upravuje) planujObnovu(); };
  document.addEventListener('selectionchange', vyberZmena);

  // ------------------------------------------------------------ zobrazení, lupa, motiv Office
  P.lupa = (proc) => { ed.nastavZoom(Math.max(10, Math.min(400, proc)) / 100); obnovStav(); };
  P.lupaPrizpusobit = () => { ed.prizpusobit = true; ed.prizpusob(); obnovStav(); };
  P.nastavZobrazeni = (z) => {
    Object.assign(st, z);
    koren.classList.toggle('pr-s-pravitkem', !!st.pravitko);
    ed.kresliMrizku();
    obnov();
  };
  P.barevnyRezim = (r) => { st.barevnyRezim = r; koren.dataset.barvy = r || ''; obnov(); };
  P.nastavMotivOffice = (m, uloz = true) => {
    if (uloz) State.set('prezentace', { ...nast(), motiv: m });
    const sys = document.documentElement.dataset.motiv === 'svetly' ? 'barevny' : 'cerny';
    koren.dataset.motiv = m === 'system' ? sys : m || 'barevny';
    win.node.dataset.psMotiv = koren.dataset.motiv;
  };
  P.nastavMotivOffice(nast().motiv || 'barevny', false);
  const motivSledovac = new MutationObserver(() => { if ((nast().motiv || 'barevny') === 'system') P.nastavMotivOffice('system', false); });
  motivSledovac.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motiv'] });
  P.jenCteni = (v) => { st.jenCteni = v; koren.classList.toggle('jen-cteni', v); ed.ukonciUpravy(); obnov(); if (v) P.toast('Prezentace je označená jako konečná.'); };
  P.hlaskaJenCteni = () => P.toast('Prezentace je označená jako konečná. Úpravy povolíte tlačítkem Přesto upravit.');

  // ------------------------------------------------------------ prezentování
  P.prezentovat = async (od = null, o = {}) => {
    ed.ukonciUpravy();
    ulozPoznamky();
    ed.zrusVkladani();
    const { prezentuj } = await import('../prezentace/prezentovani.js');
    const index = od ?? P.pres.index(st.aktivni);
    await prezentuj(P, { od: index, prezentujici: !o.okno && !!P.pres.nastaveni.prezentujici && !o.zkouska, ...o });
    P.fokus();
  };

  // ------------------------------------------------------------ soubory
  P.nedavne = () => (State.get('prezentaceNedavne') || []).filter((c) => FS.exists(c));
  function pridejNedavne(c) { State.set('prezentaceNedavne', [c, ...(State.get('prezentaceNedavne') || []).filter((x) => x !== c)].slice(0, 25)); }
  function obnovTitulek() {
    const jmeno = st.nazev.replace(/\.pptx$/i, '');
    nazevDok.querySelector('.ps-t-jmeno').textContent = jmeno;
    nazevDok.querySelector('.ps-t-stav').textContent = st.ukladani ? ' • Ukládání…' : st.cesta && !st.dirty ? ' • Uloženo do tohoto počítače' : st.cesta && st.autoUkladani ? ' • Uloženo' : '';
    prepinac.classList.toggle('zapnuto', st.autoUkladani);
    prepinac.setAttribute('aria-checked', String(st.autoUkladani));
    prepinac.querySelector('.ps-auto-text').textContent = st.autoUkladani ? 'Zap' : 'Vyp';
    win.title = `${jmeno} – AstroPrezentace`;
    ucet.querySelector('.ps-t-ucet-jmeno').textContent = P.autor();
    ucet.querySelector('.ps-avatar').textContent = P.inicialy();
  }
  P.obnovTitulek = obnovTitulek;

  function nactiPrezentaci(pres, { cesta = null, nazev, meta = {} } = {}) {
    P.zavriZakulisi?.();
    ed.ukonciUpravy();
    P.pres = pres;
    pres.onZmena = (popis) => zmena(popis);
    st.cesta = cesta;
    st.nazev = nazev || (cesta ? FS.basename(cesta) : `Prezentace${++citac}`);
    st.meta = { vytvoreno: Date.now(), autor: P.autor(), ...(pres.meta || {}), ...meta };
    st.dirty = false;
    st.otevreno = true;
    st.otevrenoOd = Date.now();
    st.autoUkladani = !!nast().autoUkladani && !!cesta && /\.pptx$/i.test(cesta);
    st.aktivni = pres.snimky[0]?.id;
    st.vybraneSnimky = [st.aktivni];
    st.sbalene = new Set();
    st.jenCteni = !!pres.meta?.konecne;
    koren.classList.toggle('jen-cteni', st.jenCteni);
    ed.vyber = [];
    cacheMini.clear();
    levy.replaceChildren();
    if (st.zobrazeni !== 'normalni') P.zobrazeni('normalni');
    kresliMiniatury(true);
    ed.prizpusobit = true;
    ed.kresli();
    ed.prizpusob();
    nactiPoznamky();
    obnovTitulek();
    if (st.podokno) P.podokno(st.podokno === 'designer' || st.podokno === 'ai' ? null : st.podokno);
    setTimeout(() => { P.fokus(); prizpusob(); obnov(); }, 30);
  }
  P.nactiPrezentaci = nactiPrezentaci;

  P.novaPrezentace = async (id = 'prazdny') => {
    if (!(await zeptejSeNaUlozeni())) return;
    const s = SABLONY_PR.find((x) => x.id === id) || SABLONY_PR[0];
    const pres = vytvorZeSablony(s.id, P.autor());
    nactiPrezentaci(pres, { nazev: id === 'prazdny' ? undefined : `${s.nazev}${++citac > 1 ? citac : ''}` });
  };
  P.otevri = async (cesta) => {
    if (cesta === st.cesta && st.otevreno) { P.zavriZakulisi?.(); return; }
    if (!(await zeptejSeNaUlozeni())) return;
    let text;
    try { text = FS.read(cesta); } catch (e) { zprava(koren, `Soubor se nepodařilo otevřít.\n${e.message}`); return; }
    let pres;
    try {
      if (/\.(txt|md)$/i.test(cesta)) {
        pres = new Prezentace();
        pres.snimky = [novySnimek('uvodni')];
        pres.zalozHistorii();
        nactiPrezentaci(pres, { nazev: FS.basename(cesta).replace(/\.[^.]+$/, '') });
        const { rozeberOsnovu } = await import('../prezentace/podokna.js');
        const radky = /^#/m.test(text) ? text : text.split('\n').map((r) => (/^\s+|^[-*•]/.test(r) ? '- ' + r.trim().replace(/^[-*•]\s*/, '') : r.trim() ? '# ' + r.trim() : '')).join('\n');
        P.snimkyZOsnovyDat(rozeberOsnovu(radky));
        return;
      }
      pres = Prezentace.rozeber(text);
    } catch {
      zprava(koren, `Soubor „${FS.basename(cesta)}“ nelze otevřít, protože formát nebo přípona souboru nejsou platné. Ověřte, že soubor není poškozený a že přípona souboru odpovídá jeho formátu.`);
      return;
    }
    pres.zalozHistorii();
    nactiPrezentaci(pres, { cesta });
    pridejNedavne(cesta);
  };
  P.otevritZeZarizeni = () => {
    const vstup = el('input', { type: 'file', accept: '.pptx,.txt,.md' });
    vstup.onchange = async () => {
      const f = vstup.files[0];
      if (!f) return;
      if (/\.pptx$/i.test(f.name) && !(await f.slice(0, 1).text()).startsWith('{')) {
        zprava(koren, 'Tenhle soubor je skutečná prezentace Microsoft PowerPoint (ZIP). AstroPrezentace umí otevřít svoje prezentace a osnovy v textu — v PowerPointu ji uložte jako Osnovu (RTF/text) a otevřete znovu.');
        return;
      }
      const text = await f.text();
      const cil = FS.join(FS.HOME + '/Dokumenty', FS.freeName(FS.HOME + '/Dokumenty', f.name));
      try { FS.write(cil, text); } catch (e) { zprava(koren, e.message); return; }
      P.otevri(cil);
    };
    vstup.click();
  };
  const jePrazdna = () => P.pres.snimky.length === 1 && P.pres.snimky[0].objekty.every((o) => o.ph && jePrazdnyText(o.html));
  function zeptejSeNaUlozeni() {
    return new Promise((hotovo) => {
      ulozPoznamky();
      ed.ukonciUpravy();
      if (!st.otevreno || !st.dirty || (!st.cesta && jePrazdna())) return hotovo(true);
      dialog(koren, {
        titulek: 'AstroPrezentace', sirka: 440,
        obsah: el('div.ps-ulozit-dotaz', {}, el('div.ps-t-logo.pr-logo.velke', {}, el('span', { text: 'P' })), el('p', { text: `Chcete uložit změny do souboru „${st.nazev}“?` })),
        tlacitka: [
          { text: 'Uložit', primarni: true, akce: () => { if (st.cesta) P.ulozit().then(hotovo); else P.rychleUlozeni(() => hotovo(true), () => hotovo(false)); } },
          { text: 'Neukládat', akce: () => hotovo(true) },
          { text: 'Zrušit', akce: () => hotovo(false) },
        ],
      });
    });
  }
  P.muzeZavrit = () => {
    if (st.zavrit) return true;
    zeptejSeNaUlozeni().then((ok) => { if (ok) { st.zavrit = true; win.close(); } });
    return false;
  };

  P.obsahSouboru = async (typ) => {
    if (typ === 'txt') return P.osnovaText();
    if (typ === 'html') return exportHtml();
    return P.pres.serializuj({ ...st.meta, zmeneno: Date.now(), konecne: st.jenCteni || undefined });
  };
  P.ulozitDo = async (cesta, typ = 'pptx') => {
    ed.ukonciUpravy();
    ulozPoznamky();
    // ukázková verze: ukládá jen ve formátu AstroPrezentace, export (HTML…) je v plné verzi
    if (typ !== 'pptx') { zprava(koren, `Export do ${typ.toUpperCase()} je jen v plné verzi AstroOS. Prezentaci můžeš uložit jako .pptx.`, 'AstroPrezentace'); return false; }
    try { FS.write(cesta, await P.obsahSouboru(typ)); }
    catch (e) { zprava(koren, `Prezentaci se nepodařilo uložit.\n\n${e.message}${/plný|místo|quota/i.test(e.message) ? '\n\nTip: Soubor › Informace › Komprimovat média zmenší obrázky.' : ''}`, 'AstroPrezentace'); return false; }
    if (typ !== 'pptx') { P.toast(`Uloženo jako ${typ.toUpperCase()}.`); if (typ === 'html') openApp('browser', { url: 'file://' + cesta }); return true; }
    st.cesta = cesta;
    st.nazev = FS.basename(cesta);
    st.dirty = false;
    pridejNedavne(cesta);
    obnovTitulek();
    return true;
  };
  P.ulozit = async ({ tise = false } = {}) => {
    if (!st.cesta) { P.rychleUlozeni(); return false; }
    st.ukladani = true;
    obnovTitulek();
    const ok = await P.ulozitDo(st.cesta, 'pptx');
    setTimeout(() => { st.ukladani = null; obnovTitulek(); }, tise ? 400 : 250);
    return ok;
  };
  P.rychleUlozeni = (poUlozeni, poZruseni) => {
    const vychozi = nast().umisteni || FS.HOME + '/Dokumenty';
    const prvni = (P.nadpisSnimku(P.pres.snimky[0]) || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 40).trim();
    const jmeno = el('input.ps-vstup', { value: prvni || st.nazev.replace(/\.[^.]+$/, '') });
    const mista = [[vychozi, 'Dokumenty'], [FS.HOME + '/Plocha', 'Plocha'], [FS.HOME, 'Domovská složka']];
    const kam = el('select.ps-vyber', {}, mista.filter((m, i, a) => FS.exists(m[0]) && a.findIndex((x) => x[0] === m[0]) === i).map(([c, t]) => el('option', { value: c, text: `${t}  ·  ${c.replace(FS.HOME, '~')}` })));
    let hotovo = false;
    dialog(koren, {
      titulek: 'Uložit tento soubor', sirka: 460, cls: 'ps-rychle-ulozeni',
      obsah: el('div', {}, pole('Název souboru', jmeno), pole('Zvolit umístění', kam),
        el('button.ps-zk-odkaz', { type: 'button', text: 'Další možnosti uložení…', onclick: (e) => { e.currentTarget.closest('.ps-kryt').remove(); otevriZakulisi(P, 'ulozitJako'); } })),
      tlacitka: [
        { text: 'Uložit', primarni: true, akce: () => {
          const n = jmeno.value.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\.pptx$/i, '');
          if (!n) return false;
          const c = FS.join(kam.value, FS.exists(FS.join(kam.value, n + '.pptx')) ? FS.freeName(kam.value, n + '.pptx') : n + '.pptx');
          P.ulozitDo(c, 'pptx').then((ok) => { if (ok) { hotovo = true; toast({ title: 'Uloženo', body: c.replace(FS.HOME, '~'), icon: 'check', timeout: 2200 }); poUlozeni?.(); } });
        } },
        { text: 'Zrušit' },
      ],
      pri_zavreni: () => { if (!hotovo) setTimeout(() => { if (!hotovo) poZruseni?.(); }, 60); P.fokus(); },
    });
    jmeno.addEventListener('keydown', (e) => e.stopPropagation());
    setTimeout(() => jmeno.select(), 40);
  };
  P.prejmenujSoubor = (nove) => {
    nove = nove.replace(/[\\/:*?"<>|]/g, '');
    if (!nove) return;
    if (!st.cesta) { st.nazev = nove; obnovTitulek(); return; }
    try {
      FS.rename(st.cesta, nove + '.pptx');
      const nova = FS.join(FS.dirname(st.cesta), nove + '.pptx');
      State.set('prezentaceNedavne', (State.get('prezentaceNedavne') || []).map((c) => (c === st.cesta ? nova : c)));
      st.cesta = nova; st.nazev = nove + '.pptx';
      obnovTitulek();
    } catch (e) { zprava(koren, e.message); }
  };
  P.zavritDokument = async () => {
    if (!(await zeptejSeNaUlozeni())) return;
    st.otevreno = false; st.dirty = false; st.cesta = null;
    otevriZakulisi(P, 'domu');
  };
  P.dialogMoznosti = () => {
    const jmeno = el('input.ps-vstup', { value: P.autor() });
    const umisteni = el('input.ps-vstup', { value: nast().umisteni || FS.HOME + '/Dokumenty' });
    const [auto, cAuto] = [el('label.ps-zaskrt', {}, el('input', { type: 'checkbox', checked: !!nast().autoUkladani }), el('span', { text: 'Automaticky ukládat soubory uložené v tomto počítači' }))].map((l) => [l, l.querySelector('input')])[0];
    for (const i of [jmeno, umisteni]) i.addEventListener('keydown', (e) => e.stopPropagation());
    dialog(koren, { titulek: 'Možnosti aplikace AstroPrezentace', sirka: 480, obsah: el('div', {}, el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Přizpůsobit kopii balíku Astro Office' }), pole('Uživatelské jméno:', jmeno)), el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Ukládání' }), pole('Výchozí umístění:', umisteni), auto)),
      tlacitka: [{ text: 'OK', primarni: true, akce: () => { P.ulozNastaveni({ jmeno: jmeno.value.trim() || undefined, umisteni: umisteni.value.trim(), autoUkladani: cAuto.checked }); } }, { text: 'Zrušit' }] });
  };
  P.komprimovatMedia = async () => {
    const { pripravObrazek } = await import('../prezentace/prikazy.js');
    let pred = 0, po = 0;
    for (const [id, v] of Object.entries(P.pres.media)) {
      pred += v.length;
      if (/^data:image\/(jpeg|png|webp)/.test(v)) { try { const r = await pripravObrazek(v, 1280); if (r.src.length < v.length) P.pres.media[id] = r.src; } catch { /* nechat */ } }
      po += P.pres.media[id].length;
    }
    P.zprava(`Média zabírala ${FS.humanSize(pred)}, po komprimaci ${FS.humanSize(po)}.`);
    zmena('Komprimovat média');
  };
  P.podkladyDoPisma = () => {
    const html = P.pres.snimky.map((s, i) => {
      const n = P.nadpisSnimku(s) || `Snímek ${i + 1}`;
      const telo = s.objekty.filter((o) => o.ph !== 'nadpis' && (o.typ === 'text' || o.typ === 'tvar')).flatMap((o) => textZHtml(o.html).split('\n').filter(Boolean));
      return `<h2>${i + 1}. ${n.replace(/</g, '&lt;')}</h2>${telo.length ? `<ul>${telo.map((t) => `<li>${t.replace(/</g, '&lt;')}</li>`).join('')}</ul>` : ''}${s.poznamky ? `<p><i>Poznámky: ${s.poznamky.replace(/</g, '&lt;')}</i></p>` : ''}`;
    }).join('');
    const slozka = FS.HOME + '/Dokumenty';
    const c = FS.join(slozka, FS.freeName(slozka, st.nazev.replace(/\.pptx$/i, '') + ' – podklady.docx'));
    try { FS.write(c, JSON.stringify({ format: 'astropismo', verze: 1, html: `<h1>${st.nazev.replace(/\.pptx$/i, '')}</h1>${html}`, nast: {}, meta: { vytvoreno: Date.now(), autor: P.autor() } })); } catch (e) { zprava(koren, e.message); return; }
    openApp('pismo', { path: c });
  };

  // ------------------------------------------------------------ export webu a tisk
  let cssCache = null;
  async function cssSnimku() {
    if (!cssCache) { try { cssCache = await (await fetch('css/prezentace.css')).text(); } catch { cssCache = ''; } }
    return cssCache.split('/* ==== EDITOR ==== */')[0];
  }
  async function exportHtml() {
    const css = await cssSnimku();
    const W = P.pres.velikost.w, H = P.pres.velikost.h;
    const snimky = P.pres.snimky.filter((s) => !s.skryty).map((s) => { const sn = kresliSnimek(P.pres, s, { cislo: P.pres.index(s.id) + 1 }); sn.classList.add('export'); return sn.outerHTML; });
    return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><title>${st.nazev.replace(/\.pptx$/i, '').replace(/</g, '&lt;')}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}
html,body{margin:0;height:100%;background:#111;overflow:hidden;font-family:"Segoe UI",sans-serif}
#s{position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;transform-origin:0 0}
#s>.pr-sn{position:absolute;left:0;top:0;display:none}#s>.pr-sn.a{display:block}
#n{position:fixed;left:12px;bottom:10px;color:#aaa;font-size:13px}</style></head><body>
<div id="s">${snimky.join('')}</div><div id="n"></div>
<script>const s=[...document.querySelectorAll('#s>.pr-sn')];let i=0;const n=document.getElementById('n');
function u(){s.forEach((x,k)=>x.classList.toggle('a',k===i));n.textContent=(i+1)+' / '+s.length;const k=Math.min(innerWidth/${W},innerHeight/${H});const e=document.getElementById('s');e.style.transform='translate(-50%,-50%) scale('+k+')';e.style.transformOrigin='center';e.style.left='50%';e.style.top='50%';e.style.translate='';}
addEventListener('keydown',e=>{if(['ArrowRight','ArrowDown',' ','PageDown','Enter'].includes(e.key))i=Math.min(s.length-1,i+1);if(['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(e.key))i=Math.max(0,i-1);u()});
addEventListener('click',()=>{i=Math.min(s.length-1,i+1);u()});addEventListener('resize',u);u();<\/script></body></html>`;
  }
  P.exportWeb = async () => {
    const slozka = st.cesta ? FS.dirname(st.cesta) : FS.HOME + '/Dokumenty';
    const c = FS.join(slozka, st.nazev.replace(/\.[^.]+$/, '') + '.html');
    try { FS.write(c, await exportHtml()); } catch (e) { zprava(koren, e.message); return; }
    P.zavriZakulisi?.();
    openApp('browser', { url: 'file://' + c });
  };
  P.strankyTisku = ({ rozlozeni = 'snimky', skryte = true } = {}) => {
    const snimky = P.pres.snimky.filter((s) => skryte || !s.skryty).filter((s) => st.tiskRozsah !== 'aktualni' || s.id === st.aktivni);
    const stranky = [];
    const mini = (s, w) => { const m = miniatura(P.pres, s, w, { cislo: P.pres.index(s.id) + 1 }); m.classList.add('tisk'); return m; };
    if (rozlozeni === 'snimky') for (const s of snimky) stranky.push(el('div.pr-tisk-strana.nasirku', {}, mini(s, 1000)));
    if (rozlozeni === 'poznamky') for (const s of snimky) stranky.push(el('div.pr-tisk-strana', {}, mini(s, 620), el('div.pr-tisk-pozn', { text: s.poznamky || '' }), el('div.pr-tisk-cislo', { text: String(P.pres.index(s.id) + 1) })));
    if (rozlozeni === 'osnova') stranky.push(el('div.pr-tisk-strana.osnova', {}, el('pre', { text: P.osnovaText() })));
    if (rozlozeni === 'podklady3') for (let i = 0; i < snimky.length; i += 3) stranky.push(el('div.pr-tisk-strana.podklady3', {}, snimky.slice(i, i + 3).map((s) => el('div.pr-tisk-radek', {}, mini(s, 330), el('div.pr-tisk-cary', {}, Array.from({ length: 8 }, () => el('i')))))));
    if (rozlozeni === 'podklady6') for (let i = 0; i < snimky.length; i += 6) stranky.push(el('div.pr-tisk-strana.podklady6', {}, snimky.slice(i, i + 6).map((s) => mini(s, 330))));
    return stranky;
  };
  P.tiskni = (o = {}) => {
    const stranky = P.strankyTisku({ rozlozeni: o.rozlozeni || st.tiskRozlozeni || 'snimky', skryte: o.skryte ?? true });
    const na = (o.rozlozeni || st.tiskRozlozeni || 'snimky') === 'snimky';
    const obal = el('div.pr-tisk' + (st.tiskBarva ? '.' + st.tiskBarva : ''), {}, stranky);
    const styl = el('style', { text: `@media print { @page { size: A4 ${na ? 'landscape' : 'portrait'}; margin: 10mm; } body > *:not(.pr-tisk) { display: none !important; } .pr-tisk { display: block !important; } }` });
    document.body.append(obal, styl);
    requestAnimationFrame(() => {
      obal.querySelectorAll('.pr-sn').forEach((sn) => { const s = P.pres.snimek(sn.dataset.id); if (s) poVlozeni(sn, P.pres, s); });
      st.meta.tisk = Date.now();
      setTimeout(() => { window.print(); setTimeout(() => { obal.remove(); styl.remove(); }, 400); }, 120);
    });
  };

  // ------------------------------------------------------------ klávesy celé aplikace
  koren.addEventListener('keydown', (e) => {
    if ((e.altKey && (e.key === 'F4' || e.key === 'Tab')) || e.key === 'Meta' || (e.ctrlKey && e.key === 'Escape')) return;
    e.stopPropagation();
    if (e.defaultPrevented) return;
    P.globalniKlavesa(e);
  });
  P.globalniKlavesa = (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const hotovo = () => { e.preventDefault(); e.stopPropagation(); return true; };
    if (e.target.closest?.('input, textarea, select') && !/^F\d+$/.test(e.key)) return false;
    if (e.key === 'F5') { P.prezentovat(e.shiftKey ? null : 0); return hotovo(); }
    if (e.altKey && e.key === 'F5') { P.prezentovat(null, { prezentujici: true }); return hotovo(); }
    if (e.key === 'Escape') {
      if (st.stetec || st.stetecAnimace) { st.stetec = null; st.stetecAnimace = null; koren.classList.remove('pr-stetec'); obnov(); return hotovo(); }
      if (st.kresleni) { P.kreslit(null); return hotovo(); }
    }
    if (e.altKey && !ctrl && k === 'q') { hledat.focus(); return hotovo(); }
    if (e.key === 'F1' && !ctrl) { P.podokno('napoveda'); return hotovo(); }
    if (e.key === 'F7') { P.pravopis(); return hotovo(); }
    if (e.key === 'F12') { otevriZakulisi(P, 'ulozitJako'); return hotovo(); }
    if (ctrl && e.key === 'F1') { prepniPas(); return hotovo(); }
    if (ctrl && !e.altKey) {
      if (k === 's') { P.ulozit(); return hotovo(); }
      if (k === 'o') { otevriZakulisi(P, 'otevrit'); return hotovo(); }
      if (k === 'n') { P.novaPrezentace('prazdny'); return hotovo(); }
      if (k === 'p') { otevriZakulisi(P, 'tisk'); return hotovo(); }
      if (k === 'w') { P.zavritDokument(); return hotovo(); }
      if (k === 'm') { P.novySnimek(); return hotovo(); }
      if (k === 'k') { P.dialogOdkaz(); return hotovo(); }
      if (k === 'f' && !ed.upravuje) { P.najit(); return hotovo(); }
      if (k === 'h' && !ed.upravuje) { P.najit(true); return hotovo(); }
      if (k === 'z' && !ed.upravuje && !e.shiftKey) { P.zpet(); return hotovo(); }
      if ((k === 'y' || (k === 'z' && e.shiftKey)) && !ed.upravuje) { P.znovu(); return hotovo(); }
      if (k === 'd' && st.fokus === 'miniatury') { P.duplikovatSnimky(); return hotovo(); }
    }
    return false;
  };

  // ------------------------------------------------------------ velikost okna
  const ro = new ResizeObserver(() => { cancelAnimationFrame(ro.raf); ro.raf = requestAnimationFrame(poZmeneVelikosti); });
  function poZmeneVelikosti() {
    prizpusob();
    if (st.zobrazeni === 'razeni') { clearTimeout(ro.t); ro.t = setTimeout(kresliRazeni, 150); }
    const w = levy.clientWidth;
    if (w && Math.abs((ro.w || 0) - w) > 4) { ro.w = w; clearTimeout(ro.m); ro.m = setTimeout(() => kresliMiniatury(true), 120); }
  }
  ro.observe(koren);

  P.znic = () => {
    ro.disconnect();
    motivSledovac.disconnect();
    document.removeEventListener('selectionchange', vyberZmena);
    ed.znic();
    zavriRozbal();
    P.zavriPodokna?.();
    P.st.diktovani?.stop();
  };

  // ------------------------------------------------------------ start
  prepniKartu('domu');
  const prvni = vytvorZeSablony('prazdny', P.autor());
  P.pres = prvni;
  prvni.onZmena = (popis) => zmena(popis);
  st.aktivni = prvni.snimky[0].id;
  st.vybraneSnimky = [st.aktivni];
  obnovTitulek();
  setTimeout(() => { ed.prizpusob(); ed.kresli(); kresliMiniatury(true); }, 0);
  if (win.opts?.path) P.otevri(win.opts.path);
  else if (win.opts?.sablona) P.novaPrezentace(win.opts.sablona);
  else otevriZakulisi(P, 'domu');
  return P;
}
