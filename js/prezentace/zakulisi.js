// AstroPrezentace — zákulisí (karta Soubor): Domů, Nový, Otevřít, Informace, Uložit jako, Tisk, Sdílet, Export, Zavřít, Účet

import { el, cz, plural } from '../util.js';
import * as FS from '../fs.js';
import { ik } from '../pismo/ikony.js';
import { dialog } from '../pismo/ui.js';
import { SABLONY_PR } from './sablony.js';
import { miniatura } from './render.js';
import { kontrolaPristupnosti } from './podokna.js';

const POLOZKY = [
  { id: 'domu', text: 'Domů', ikona: 'domu' },
  { id: 'novy', text: 'Nový', ikona: 'novy' },
  { id: 'otevrit', text: 'Otevřít', ikona: 'otevrit' },
  'sep',
  { id: 'informace', text: 'Informace', dok: true },
  { id: 'ulozit', text: 'Uložit', dok: true, akce: true },
  { id: 'ulozitJako', text: 'Uložit jako', dok: true },
  { id: 'tisk', text: 'Tisk', dok: true },
  { id: 'sdilet', text: 'Sdílet', dok: true },
  { id: 'export', text: 'Export', dok: true },
  { id: 'zavrit', text: 'Zavřít', dok: true, akce: true },
];
const DOLE = [{ id: 'ucet', text: 'Účet' }, { id: 'nazory', text: 'Názory', akce: true }, { id: 'moznosti', text: 'Možnosti', akce: true }];
export const TYPY = [['pptx', 'Prezentace AstroPrezentací (*.pptx)'], ['html', 'Webová stránka (*.html)'], ['txt', 'Osnova (*.txt)'], ['pdf', 'PDF (*.pdf) — přes tisk']];

const pozdrav = () => { const h = new Date().getHours(); return h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobré odpoledne' : 'Dobrý večer'; };

const cache = new Map();
export function miniaturaSablony(s, w = 180) {
  const klic = s.id + w;
  if (!cache.has(klic)) {
    try {
      const p = s.vytvor('Jan Novák');
      cache.set(klic, { p, s0: p.snimky[0] });
    } catch (e) { console.warn(e); return el('div.pr-zk-mini'); }
  }
  const { p, s0 } = cache.get(klic);
  return el('div.pr-zk-mini', {}, miniatura(p, s0, w));
}

function kartaSablony(P, s) {
  return el('button.ps-sablona.pr-sablona', { type: 'button', title: s.nazev, onclick: () => P.novaPrezentace(s.id) }, miniaturaSablony(s), el('span', { text: s.nazev }));
}

function tabulkaSouboru(P, soubory, { prazdne = 'Zatím jste neotevřeli žádné prezentace.' } = {}) {
  if (!soubory.length) return el('div.ps-zk-prazdno', {}, ik('novySnimek'), el('p', { text: prazdne }));
  return el('div.ps-zk-soubory', {},
    el('div.ps-zk-soubor.hlava', {}, el('span'), el('span', { text: 'Název' }), el('span', { text: 'Datum změny' })),
    soubory.map((c) => {
      const u = FS.get(c);
      return el('button.ps-zk-soubor', { type: 'button', title: c, onclick: () => P.otevri(c) },
        el('span.ps-zk-docx.pr-zk-pptx', {}, el('b', { text: 'P' })),
        el('span.ps-zk-nazev', {}, el('b', { text: FS.basename(c).replace(/\.pptx$/i, '') }), el('small', { text: FS.dirname(c).replace(FS.HOME, '~') })),
        el('span.ps-zk-datum', { text: u?.m ? cz.datumKratky(new Date(u.m)) : '' }));
    }));
}

function prochazec(P, { start, onSoubor, filtr = /\.(pptx|txt|md)$/i, onCesta }) {
  const box = el('div.ps-zk-prochazec');
  const kresli = (cesta) => {
    onCesta?.(cesta);
    const casti = cesta.split('/').filter(Boolean);
    const drobky = el('div.ps-zk-drobky', {},
      el('button', { type: 'button', text: '⮤', title: 'Nahoru', disabled: cesta === '/', onclick: () => kresli(FS.dirname(cesta)) }),
      casti.map((c, i) => [el('span', { text: '›' }), el('button', { type: 'button', text: c, onclick: () => kresli('/' + casti.slice(0, i + 1).join('/')) })]).flat());
    let polozky = [];
    try { polozky = FS.list(cesta); } catch { /* neexistuje */ }
    const slozky = polozky.filter((p) => FS.isDir(p.node));
    const soubory = polozky.filter((p) => !FS.isDir(p.node) && filtr.test(p.name));
    box.replaceChildren(drobky, el('div.ps-zk-seznam', {},
      slozky.map((s) => el('button.ps-zk-radek', { type: 'button', onclick: () => kresli(FS.join(cesta, s.name)) }, ik('slozka'), el('span', { text: s.name }), el('small', { text: 'Složka' }))),
      soubory.map((s) => el('button.ps-zk-radek', { type: 'button', onclick: () => onSoubor(FS.join(cesta, s.name)) }, el('span.ps-zk-docx.mala.pr-zk-pptx', {}, el('b', { text: 'P' })), el('span', { text: s.name }), el('small', { text: s.node.m ? cz.datumKratky(new Date(s.node.m)) : '' }))),
      !slozky.length && !soubory.length ? el('p.ps-zk-pozn', { text: 'Tato složka je prázdná.' }) : null));
  };
  kresli(start);
  return box;
}

const blok = (ikona, nadpis, text, tlacitko, akce) => el('div.ps-zk-blok', {},
  el('button.ps-zk-blok-tl', { type: 'button', onclick: akce }, ik(ikona), el('span', { text: tlacitko })),
  el('div', {}, el('h3', { text: nadpis }), el('p', { text })));

export function otevriZakulisi(P, stranka = 'domu') {
  P.zavriZakulisi?.();
  P.ed.ukonciUpravy();
  const maDok = !!P.st.otevreno;
  const obsah = el('div.ps-zk-obsah');
  const menu = el('nav.ps-zk-menu');
  const zakulisi = el('div.ps-zakulisi.pr-zakulisi', {}, menu, obsah);
  let seznam;

  const zavri = () => {
    zakulisi.remove();
    P.zavriZakulisi = null;
    P.koren.classList.remove('v-zakulisi');
    if (!P.st.otevreno) P.novaPrezentace('prazdny');
    else P.fokus();
  };
  P.zavriZakulisi = () => { zakulisi.remove(); P.zavriZakulisi = null; P.koren.classList.remove('v-zakulisi'); };

  const polozka = (p) => {
    if (p === 'sep') return el('div.ps-zk-sep');
    const b = el('button.ps-zk-pol', { type: 'button', dataset: { id: p.id }, disabled: p.dok && !maDok }, p.ikona ? ik(p.ikona) : el('span.ps-zk-bez'), el('span', { text: p.text }));
    b.onclick = () => {
      if (p.id === 'ulozit') { if (P.st.cesta) { P.ulozit(); zavri(); } else ukaz('ulozitJako'); return; }
      if (p.id === 'zavrit') { P.zavritDokument(); return; }
      if (p.id === 'nazory') { P.dialogNazory(); return; }
      if (p.id === 'moznosti') { P.dialogMoznosti(); return; }
      ukaz(p.id);
    };
    return b;
  };
  menu.append(el('button.ps-zk-zpet', { type: 'button', title: 'Zpět', onclick: zavri }, ik('kruhZpet')), ...POLOZKY.map(polozka), el('div.ps-zk-mezera'), ...DOLE.map(polozka));

  const STRANKY = {
    domu() {
      return [
        el('h1', { text: pozdrav() }),
        el('div.ps-zk-sekce', {},
          el('div.ps-zk-sablony.pr-zk-sablony', {}, SABLONY_PR.slice(0, 5).map((s) => kartaSablony(P, s))),
          el('button.ps-zk-odkaz', { type: 'button', onclick: () => ukaz('novy') }, 'Další motivy', el('span', { text: ' →' }))),
        el('div.ps-zk-hledat', {}, ik('najitMaly'), el('input', {
          placeholder: 'Hledat', oninput: (e) => {
            const q = e.target.value.toLocaleLowerCase('cs');
            seznam.replaceChildren(tabulkaSouboru(P, P.nedavne().filter((c) => c.toLocaleLowerCase('cs').includes(q))));
          },
        })),
        el('div.ps-zk-zalozky', {}, el('span.aktivni', { text: 'Nedávné' }), el('span', { text: 'Připnuté' }), el('span', { text: 'Sdílené se mnou' })),
        (seznam = el('div', {}, tabulkaSouboru(P, P.nedavne()))),
        el('button.ps-zk-odkaz.vpravo', { type: 'button', onclick: () => ukaz('otevrit') }, 'Další prezentace', el('span', { text: ' →' })),
      ];
    },
    novy() {
      return [
        el('h1', { text: 'Nový' }),
        el('div.ps-zk-hledat', {}, ik('najitMaly'), el('input', { placeholder: 'Hledat online šablony a motivy', disabled: true })),
        el('div.ps-zk-navrhy', {}, 'Navrhovaná hledání: ', ['Prezentace', 'Vzdělávání', 'Obchod', 'Diagramy', 'Portfolio', 'Motivy'].map((t) => el('span', { text: t }))),
        el('div.ps-zk-sablony.velke.pr-zk-sablony', {}, SABLONY_PR.map((s) => kartaSablony(P, s))),
      ];
    },
    otevrit() {
      const vpravo = el('div.ps-zk-otevrit-pravo');
      const leve = [['nedavne', 'hodiny', 'Nedávné'], ['pc', 'pocitac', 'Tento počítač'], ['dokumenty', 'slozka', 'Dokumenty'], ['plocha', 'slozka', 'Plocha']];
      const vyber = (id) => {
        levy.querySelectorAll('button').forEach((b) => b.classList.toggle('aktivni', b.dataset.id === id));
        if (id === 'nedavne') vpravo.replaceChildren(el('h2', { text: 'Prezentace' }), tabulkaSouboru(P, P.nedavne()));
        else {
          const start = id === 'plocha' ? FS.HOME + '/Plocha' : id === 'dokumenty' ? FS.HOME + '/Dokumenty' : FS.HOME;
          vpravo.replaceChildren(el('h2', { text: leve.find((l) => l[0] === id)[2] }), prochazec(P, { start, onSoubor: (c) => P.otevri(c) }));
        }
      };
      const levy = el('div.ps-zk-mista', {}, leve.map(([id, i, t]) => el('button', { type: 'button', dataset: { id }, onclick: () => vyber(id) }, ik(i), el('span', { text: t }))),
        el('button', { type: 'button', onclick: () => P.otevritZeZarizeni() }, ik('otevrit'), el('span', { text: 'Procházet (toto zařízení)' })));
      setTimeout(() => vyber('nedavne'));
      return [el('h1', { text: 'Otevřít' }), el('div.ps-zk-dva', {}, levy, vpravo)];
    },
    informace() {
      const u = P.st.cesta ? FS.get(P.st.cesta) : null;
      const vel = u ? FS.humanSize(FS.size(u)) : 'Neuloženo';
      const radek = (k, v) => el('div.ps-zk-vl', {}, el('span', { text: k }), el('span', { text: v }));
      const problemy = kontrolaPristupnosti(P).length;
      const slova = P.pres.snimky.reduce((n, s) => n + s.objekty.reduce((m, o) => m + (P.textObjektu(o).match(/\S+/g)?.length || 0), 0), 0);
      return [
        el('h1', { text: 'Informace' }),
        el('div.ps-zk-docnazev', {}, el('b', { text: P.st.nazev }), el('small', { text: P.st.cesta ? FS.dirname(P.st.cesta) : 'Prezentace ještě není uložená' })),
        el('div.ps-zk-info', {},
          el('div.ps-zk-bloky', {},
            blok('zamek', 'Zamknout prezentaci', P.st.jenCteni ? 'Prezentace je označená jako konečná — jen pro čtení.' : 'Určete, jaké typy změn můžou ostatní v prezentaci provádět.', P.st.jenCteni ? 'Povolit úpravy' : 'Označit jako konečnou', () => { P.jenCteni(!P.st.jenCteni); zavri(); }),
            blok('lupaKontrola', 'Zkontrolovat prezentaci', problemy ? `Kontrola přístupnosti našla ${plural(problemy, ['problém', 'problémy', 'problémů'])}.` : 'Před sdílením souboru zkontrolujte, jestli ho přečtou všichni.', 'Zkontrolovat přístupnost', () => { zavri(); P.podokno('pristupnost'); }),
            blok('verze', 'Historie verzí', `Historie úprav této prezentace má ${plural(P.pres.historie.list.length, ['krok', 'kroky', 'kroků'])} (Zpět/Znovu).`, 'Zpět na začátek', () => { P.zpet(999); zavri(); }),
            blok('obrazky', 'Velikost médií', `Obrázky a zvuky v prezentaci: ${FS.humanSize(Object.values(P.pres.media).reduce((n, x) => n + x.length, 0))}. Disk AstroOS má jen asi 5 MB.`, 'Komprimovat média', () => { P.komprimovatMedia(); })),
          el('div.ps-zk-vlastnosti', {},
            el('h3', { text: 'Vlastnosti ▾' }),
            radek('Velikost', vel), radek('Snímky', String(P.pres.snimky.length)), radek('Skryté snímky', String(P.pres.snimky.filter((s) => s.skryty).length)), radek('Slova', String(slova)),
            radek('Poznámky', String(P.pres.snimky.filter((s) => s.poznamky).length)),
            radek('Celková doba úprav', `${Math.max(1, Math.round((Date.now() - P.st.otevrenoOd) / 60000))} min`),
            radek('Název', P.nadpisSnimku(P.pres.snimky[0]) || 'Přidat název'),
            el('h3', { text: 'Související kalendářní data' }),
            radek('Poslední změna', u?.m ? new Date(u.m).toLocaleString('cs-CZ') : '—'),
            radek('Vytvořeno', P.st.meta.vytvoreno ? new Date(P.st.meta.vytvoreno).toLocaleString('cs-CZ') : 'Dnes'),
            el('h3', { text: 'Související lidé' }),
            el('div.ps-zk-autor', {}, el('span.ps-avatar', { text: P.inicialy() }), el('span', { text: P.st.meta.autor || P.autor() })))),
      ];
    },
    ulozitJako() {
      let slozka = P.st.cesta ? FS.dirname(P.st.cesta) : FS.HOME + '/Dokumenty';
      const jmeno = el('input.ps-vstup', { value: P.st.nazev.replace(/\.(pptx|html|txt)$/i, '') });
      jmeno.addEventListener('keydown', (e) => e.stopPropagation());
      const typ = el('select.ps-vyber', {}, TYPY.map(([v, t]) => el('option', { value: v, text: t, selected: v === (P.st.typUlozeni || 'pptx') })));
      const cestaEl = el('div.ps-zk-cesta');
      const ulozit = () => {
        const n = jmeno.value.trim().replace(/[\\/:*?"<>|]/g, '');
        if (!n) return;
        if (typ.value === 'pdf') { P.tiskni(); return; }
        const c = FS.join(slozka, n + '.' + typ.value);
        const proved = async () => { if (await P.ulozitDo(c, typ.value)) { P.toast(`Uloženo: ${c.replace(FS.HOME, '~')}`); zavri(); } };
        if (FS.exists(c) && c !== P.st.cesta) dialog(P.koren, { titulek: 'Potvrdit uložení jako', obsah: el('p.ps-zprava', { text: `${n}.${typ.value} už existuje. Chcete ho nahradit?` }), tlacitka: [{ text: 'Ano', primarni: true, akce: proved }, { text: 'Ne' }] });
        else proved();
      };
      return [
        el('h1', { text: 'Uložit jako' }),
        el('div.ps-zk-dva', {},
          el('div.ps-zk-mista', {},
            el('button.aktivni', { type: 'button' }, ik('pocitac'), el('span', { text: 'Tento počítač' })),
            el('button', { type: 'button', onclick: () => { slozka = FS.HOME + '/Dokumenty'; ukaz('ulozitJako'); } }, ik('slozka'), el('span', { text: 'Dokumenty' }))),
          el('div.ps-zk-otevrit-pravo', {},
            cestaEl,
            el('div.ps-zk-ulozit-radek', {}, jmeno, typ, el('button.ps-tlac.primarni', { type: 'button', text: 'Uložit', onclick: ulozit })),
            prochazec(P, { start: slozka, onCesta: (c) => { slozka = c; cestaEl.textContent = c.replace(FS.HOME, '~'); }, onSoubor: (c) => { jmeno.value = FS.basename(c).replace(/\.[^.]+$/, ''); } }))),
      ];
    },
    tisk() {
      let rozlozeni = P.st.tiskRozlozeni || 'snimky';
      let skryte = true;
      const nahled = el('div.pr-zk-tisk-nahled');
      const info = el('span');
      const kresli = () => {
        const stranky = P.strankyTisku({ rozlozeni, skryte });
        nahled.replaceChildren(...stranky.slice(0, 12).map((s) => { const r = el('div.pr-zk-tisk-strana' + (rozlozeni === 'snimky' ? '.nasirku' : '')); r.append(s); return r; }));
        info.textContent = `${stranky.length} ${stranky.length === 1 ? 'stránka' : stranky.length < 5 ? 'stránky' : 'stránek'}`;
      };
      setTimeout(kresli, 20);
      const volba = (popis, moznosti, hodnota, zmena) => el('label.tb-zk-volba', {}, el('small', { text: popis }), el('select.ps-vyber', { onchange: (e) => { zmena(e.target.value); kresli(); } }, moznosti.map(([v, x]) => el('option', { value: v, text: x, selected: v === hodnota }))));
      return [
        el('h1', { text: 'Tisk' }),
        el('div.ps-zk-tisk', {},
          el('div.ps-zk-tisk-vlevo', {},
            el('div.ps-zk-tisk-hlava', {},
              el('button.ps-zk-velky', { type: 'button', onclick: () => P.tiskni({ rozlozeni, skryte }) }, ik('tisk'), el('span', { text: 'Tisk' })),
              el('label', {}, el('small', { text: 'Kopie:' }), el('input.ps-vstup.kratky', { type: 'number', value: 1, min: 1 }))),
            el('h3', { text: 'Tiskárna' }),
            el('div.ps-zk-tiskarna', {}, ik('tisk'), el('div', {}, el('b', { text: 'Uložit jako PDF' }), el('small', { text: 'Připraveno' }))),
            el('h3', { text: 'Nastavení' }),
            volba('Rozsah', [['vse', 'Vytisknout všechny snímky'], ['aktualni', 'Vytisknout aktuální snímek']], 'vse', (v) => { P.st.tiskRozsah = v; }),
            volba('Rozložení', [['snimky', 'Snímky na celou stránku'], ['poznamky', 'Stránky poznámek'], ['osnova', 'Osnova'], ['podklady3', 'Podklady: 3 snímky'], ['podklady6', 'Podklady: 6 snímků vodorovně']], rozlozeni, (v) => { rozlozeni = v; P.st.tiskRozlozeni = v; }),
            volba('Skryté snímky', [['ano', 'Tisknout skryté snímky'], ['ne', 'Netisknout skryté snímky']], 'ano', (v) => { skryte = v === 'ano'; }),
            volba('Barva', [['barva', 'Barevně'], ['sedi', 'Stupně šedi'], ['cb', 'Černobíle']], 'barva', (v) => { P.st.tiskBarva = v; }),
            el('button.ps-zk-odkaz', { type: 'button', text: 'Upravit záhlaví a zápatí', onclick: () => P.dialogZapati() })),
          el('div.ps-zk-tisk-vpravo', {}, nahled, el('div.ps-zk-tisk-strana', {}, info))),
      ];
    },
    sdilet() {
      return [
        el('h1', { text: 'Sdílet' }),
        el('div.ps-zk-bloky.sirka', {},
          blok('odkaz', 'Otevřít v Nově jako web', 'Uloží prezentaci jako webovou stránku (šipkami se přepínají snímky) a otevře ji v prohlížeči Nova.', 'Otevřít jako web', () => P.exportWeb()),
          blok('obalka', 'Poslat poštou', 'Otevře aplikaci Pošta. Osnova prezentace je ve schránce, stačí ji vložit do zprávy.', 'Otevřít Poštu', async () => {
            try { await navigator.clipboard.writeText(P.osnovaText()); } catch { /* bez schránky */ }
            P.otevriAplikaci('mail');
          }),
          blok('kopirovat', 'Kopírovat osnovu', 'Zkopíruje nadpisy a text všech snímků do schránky — vložíte je třeba do AstroPísma.', 'Kopírovat', async () => {
            try { await navigator.clipboard.writeText(P.osnovaText()); P.toast('Osnova zkopírována do schránky'); } catch { P.toast('Schránka není dostupná'); }
          })),
      ];
    },
    export() {
      return [
        el('h1', { text: 'Export' }),
        el('div.ps-zk-dva', {},
          el('div.ps-zk-mista', {},
            el('button.aktivni', { type: 'button' }, ik('pdf'), el('span', { text: 'Vytvořit dokument PDF/XPS' })),
            el('button', { type: 'button', onclick: () => P.exportWeb() }, ik('odkaz'), el('span', { text: 'Webová stránka' })),
            el('button', { type: 'button', onclick: () => P.podkladyDoPisma() }, ik('novy'), el('span', { text: 'Vytvořit podklady' })),
            el('button', { type: 'button', onclick: () => { P.st.typUlozeni = 'txt'; ukaz('ulozitJako'); } }, ik('zmenitTyp'), el('span', { text: 'Změnit typ souboru' }))),
          el('div.ps-zk-otevrit-pravo', {},
            el('h2', { text: 'Vytvořit dokument PDF/XPS' }),
            el('ul.ps-zk-body', {}, el('li', { text: 'Zachová rozložení, formátování, písma a obrázky' }), el('li', { text: 'Obsah nelze snadno změnit' }), el('li', { text: 'Na webu jsou k dispozici bezplatné prohlížeče' })),
            el('button.ps-zk-velky', { type: 'button', onclick: () => P.tiskni() }, ik('pdf'), el('span', { text: 'Vytvořit PDF/XPS' })),
            el('h2', { text: 'Vytvořit podklady', style: { marginTop: '28px' } }),
            el('p', { text: 'Pošle snímky a poznámky do AstroPísma, kde je můžete upravit a vytisknout.' }),
            el('button.ps-zk-velky', { type: 'button', onclick: () => P.podkladyDoPisma() }, ik('novy'), el('span', { text: 'Vytvořit podklady' })))),
      ];
    },
    ucet() {
      const n = P.nastaveni();
      const motiv = el('select.ps-vyber', { onchange: (e) => P.nastavMotivOffice(e.target.value) },
        [['barevny', 'Barevný'], ['tmave-sedy', 'Tmavě šedý'], ['cerny', 'Černý'], ['bily', 'Bílý'], ['system', 'Použít nastavení systému']].map(([v, t]) => el('option', { value: v, text: t, selected: (n.motiv || 'barevny') === v })));
      return [
        el('h1', { text: 'Účet' }),
        el('div.ps-zk-dva.ucet', {},
          el('div', {},
            el('h3', { text: 'Informace o uživateli' }),
            el('div.ps-zk-autor.velky', {}, el('span.ps-avatar', { text: P.inicialy() }), el('div', {}, el('b', { text: P.autor() }), el('small', { text: 'Místní účet AstroOS' }))),
            el('h3', { text: 'Motiv Office' }), motiv),
          el('div', {},
            el('h3', { text: 'Informace o produktu' }),
            el('div.tb-zk-produkt', {}, el('div.ps-t-logo.pr-logo.velke', {}, el('span', { text: 'P' })), el('div', {}, el('b', { text: 'AstroPrezentace pro AstroOS' }), el('small', { text: 'Součást balíku Astro Office · verze 1.0 (2026)' }))),
            el('p', { text: 'Obsahuje 13 motivů, 37 přechodů, 40 animací, Designer, zobrazení prezentujícího a AstroAI.' }))),
      ];
    },
  };

  function ukaz(id) {
    menu.querySelectorAll('.ps-zk-pol').forEach((b) => b.classList.toggle('aktivni', b.dataset.id === id));
    obsah.replaceChildren(el('div.ps-zk-stranka', {}, STRANKY[id]()));
    obsah.scrollTop = 0;
  }
  P.koren.append(zakulisi);
  P.koren.classList.add('v-zakulisi');
  ukaz(stranka);
  zakulisi.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); zavri(); } });
}
