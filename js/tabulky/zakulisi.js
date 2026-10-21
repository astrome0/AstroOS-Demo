// AstroTabulky — zákulisí (karta Soubor): Domů, Nový, Otevřít, Informace, Uložit jako, Tisk, Sdílet, Export, Účet

import { el, cz, plural } from '../util.js';
import * as FS from '../fs.js';
import { ik } from '../pismo/ikony.js';
import { dialog, pole, zprava } from '../pismo/ui.js';
import { SABLONY_TB } from './sablony.js';
import { formatuj } from './format.js';
import { klic } from './adresy.js';
import { stylTabulky } from './styly.js';
import * as D from './dialogy.js';

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
const TYPY = [['xlsx', 'Sešit AstroTabulek (*.xlsx)'], ['csv', 'CSV UTF-8 (oddělený středníkem) (*.csv)'], ['txt', 'Text (oddělený tabulátory) (*.txt)'], ['html', 'Webová stránka (*.html)']];

const pozdrav = () => { const h = new Date().getHours(); return h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobré odpoledne' : 'Dobrý večer'; };

/** Miniatura šablony: prvních pár řádků prvního listu jako malá tabulka. */
const cacheMiniatur = new Map();
export function miniatura(sablona) {
  if (sablona.id === 'prazdny') {
    const t = el('table.tb-mini-sablona.prazdna', {}, Array.from({ length: 9 }, (_, r) => el('tr', {}, Array.from({ length: 5 }, (_, c) => el('td', { text: r === 0 && c === 0 ? '' : '' })))));
    return el('div.tb-miniatura', {}, t);
  }
  if (cacheMiniatur.has(sablona.id)) return cacheMiniatur.get(sablona.id).cloneNode(true);
  let s;
  try { s = sablona.vytvor('Jan Novák'); } catch (e) { console.warn(e); return el('div.tb-miniatura'); }
  const l = s.listy[0];
  const radky = [];
  for (let r = 0; r < 14; r++) {
    const bunky = [];
    for (let c = 0; c < 8; c++) {
      const st = s.stylBunky(l, r, c) || {};
      const t = l.tabulky.find((x) => r >= x.oblast.r1 && r <= x.oblast.r2 && c >= x.oblast.c1 && c <= x.oblast.c2);
      const ts = t ? stylTabulky(t, r, c, s, l) : {};
      const text = s.textBunky(l, r, c);
      bunky.push(el('td', { text, style: `width:${Math.min(60, s.sirka(l, c) * 0.42)}px;background:${st.pozadi || ts.pozadi || 'transparent'};color:${st.barva || ts.pismo?.barva || '#222'};font-weight:${st.b || ts.pismo?.b ? 700 : 400};font-size:${Math.min(11, (st.vel || 11) * 0.42)}px` }));
    }
    radky.push(el('tr', {}, bunky));
  }
  const m = el('div.tb-miniatura', {}, el('table.tb-mini-sablona', {}, radky), l.grafy[0] ? el('div.tb-mini-graf', { style: { background: sablona.barva } }) : null);
  cacheMiniatur.set(sablona.id, m);
  return m.cloneNode(true);
}

function kartaSablony(P, s) {
  return el('button.ps-sablona.tb-sablona', { type: 'button', title: s.nazev, onclick: () => P.novy(s.id) }, miniatura(s), el('span', { text: s.nazev }));
}

function tabulkaSouboru(P, soubory, { prazdne = 'Zatím jste neotevřeli žádné sešity.' } = {}) {
  if (!soubory.length) return el('div.ps-zk-prazdno', {}, ik('sestitSesit'), el('p', { text: prazdne }));
  return el('div.ps-zk-soubory', {},
    el('div.ps-zk-soubor.hlava', {}, el('span'), el('span', { text: 'Název' }), el('span', { text: 'Datum změny' })),
    soubory.map((c) => {
      const u = FS.get(c);
      return el('button.ps-zk-soubor', { type: 'button', title: c, onclick: () => P.otevri(c) },
        el('span.ps-zk-docx.tb-zk-xlsx', {}, ik('list')),
        el('span.ps-zk-nazev', {}, el('b', { text: FS.basename(c).replace(/\.xlsx$/i, '') }), el('small', { text: FS.dirname(c).replace(FS.HOME, '~') })),
        el('span.ps-zk-datum', { text: u?.m ? cz.datumKratky(new Date(u.m)) : '' }));
    }));
}

function prochazec(P, { start, onSoubor, jenSlozky = false, filtr = /\.(xlsx|csv|txt|tsv)$/i, onCesta }) {
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
    const soubory = jenSlozky ? [] : polozky.filter((p) => !FS.isDir(p.node) && filtr.test(p.name));
    box.replaceChildren(drobky, el('div.ps-zk-seznam', {},
      slozky.map((s) => el('button.ps-zk-radek', { type: 'button', onclick: () => kresli(FS.join(cesta, s.name)) }, ik('slozka'), el('span', { text: s.name }), el('small', { text: 'Složka' }))),
      soubory.map((s) => el('button.ps-zk-radek', { type: 'button', onclick: () => onSoubor(FS.join(cesta, s.name)) }, el('span.ps-zk-docx.mala.tb-zk-xlsx', {}, ik('list')), el('span', { text: s.name }),
        el('small', { text: s.node.m ? cz.datumKratky(new Date(s.node.m)) : '' }))),
      !slozky.length && !soubory.length ? el('p.ps-zk-pozn', { text: 'Tato složka je prázdná.' }) : null));
  };
  kresli(start);
  return box;
}

function blokInfo(ikona, nadpis, text, tlacitko, akce) {
  return el('div.ps-zk-blok', {},
    el('button.ps-zk-blok-tl', { type: 'button', onclick: akce }, ik(ikona), el('span', { text: tlacitko })),
    el('div', {}, el('h3', { text: nadpis }), el('p', { text })));
}

export function otevriZakulisi(P, stranka = 'domu') {
  P.zavriZakulisi?.();
  if (P.grid.edit) P.grid.potvrdEditaci();
  const maDok = !!P.st.otevreno;
  const obsah = el('div.ps-zk-obsah');
  const menu = el('nav.ps-zk-menu');
  const zakulisi = el('div.ps-zakulisi.tb-zakulisi', {}, menu, obsah);
  let seznam;

  const zavri = () => {
    zakulisi.remove();
    P.zavriZakulisi = null;
    P.koren.classList.remove('v-zakulisi');
    if (!P.st.otevreno) P.novy('prazdny');
    else P.grid.fokus();
  };
  P.zavriZakulisi = () => { zakulisi.remove(); P.zavriZakulisi = null; P.koren.classList.remove('v-zakulisi'); };

  const polozka = (p) => {
    if (p === 'sep') return el('div.ps-zk-sep');
    const b = el('button.ps-zk-pol', { type: 'button', dataset: { id: p.id }, disabled: p.dok && !maDok }, p.ikona ? ik(p.ikona) : el('span.ps-zk-bez'), el('span', { text: p.text }));
    b.onclick = () => {
      if (p.id === 'ulozit') { if (P.st.cesta) { P.ulozit(); zavri(); } else ukaz('ulozitJako'); return; }
      if (p.id === 'zavrit') { P.zavritDokument(); return; }
      if (p.id === 'nazory') { D.dialogNazory(P); return; }
      if (p.id === 'moznosti') { D.dialogMoznosti(P); return; }
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
          el('div.ps-zk-sablony.tb-zk-sablony', {}, SABLONY_TB.slice(0, 6).map((s) => kartaSablony(P, s))),
          el('button.ps-zk-odkaz', { type: 'button', onclick: () => ukaz('novy') }, 'Další šablony', el('span', { text: ' →' }))),
        el('div.ps-zk-hledat', {}, ik('najitMaly'), el('input', {
          placeholder: 'Hledat', oninput: (e) => {
            const q = e.target.value.toLocaleLowerCase('cs');
            seznam.replaceChildren(tabulkaSouboru(P, P.nedavne().filter((c) => c.toLocaleLowerCase('cs').includes(q))));
          },
        })),
        el('div.ps-zk-zalozky', {}, el('span.aktivni', { text: 'Nedávné' }), el('span', { text: 'Připnuté' }), el('span', { text: 'Sdílené se mnou' })),
        (seznam = el('div', {}, tabulkaSouboru(P, P.nedavne()))),
        el('button.ps-zk-odkaz.vpravo', { type: 'button', onclick: () => ukaz('otevrit') }, 'Další sešity', el('span', { text: ' →' })),
      ];
    },
    novy() {
      return [
        el('h1', { text: 'Nový' }),
        el('div.ps-zk-hledat', {}, ik('najitMaly'), el('input', { placeholder: 'Hledat online šablony', disabled: true })),
        el('div.ps-zk-navrhy', {}, 'Navrhovaná hledání: ', ['Obchodní', 'Osobní', 'Plánovače a sledování', 'Seznamy', 'Rozpočty', 'Grafy', 'Kalendáře'].map((t) => el('span', { text: t }))),
        el('div.ps-zk-sablony.velke.tb-zk-sablony', {}, SABLONY_TB.map((s) => kartaSablony(P, s))),
      ];
    },
    otevrit() {
      const vpravo = el('div.ps-zk-otevrit-pravo');
      const leve = [['nedavne', 'hodiny', 'Nedávné'], ['pc', 'pocitac', 'Tento počítač'], ['dokumenty', 'slozka', 'Dokumenty'], ['plocha', 'slozka', 'Plocha']];
      const vyber = (id) => {
        levy.querySelectorAll('button').forEach((b) => b.classList.toggle('aktivni', b.dataset.id === id));
        if (id === 'nedavne') vpravo.replaceChildren(el('h2', { text: 'Sešity' }), tabulkaSouboru(P, P.nedavne()));
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
      const zamknute = P.S.listy.filter((l) => l.zamek).length;
      return [
        el('h1', { text: 'Informace' }),
        el('div.ps-zk-docnazev', {}, el('b', { text: P.st.nazev }), el('small', { text: P.st.cesta ? FS.dirname(P.st.cesta) : 'Sešit ještě není uložený' })),
        el('div.ps-zk-info', {},
          el('div.ps-zk-bloky', {},
            blokInfo('zamek', 'Zamknout sešit', zamknute ? `Zamknuté listy: ${zamknute}. Zamknuté buňky nelze měnit.` : 'Určete, jaké typy změn můžou ostatní v sešitu provádět.', 'Zamknout sešit', () => { zavri(); D.dialogZamknoutList(P); }),
            blokInfo('lupaKontrola', 'Zkontrolovat sešit', 'Před publikováním souboru si uvědomte, že obsahuje: vlastnosti dokumentu, jméno autora a obsah, který osoby s postižením nemusí dokázat číst.', 'Zkontrolovat přístupnost', () => { zavri(); P.podokno('pristupnost'); }),
            blokInfo('verze', 'Historie verzí', `Historie úprav tohoto sešitu má ${plural(P.S.historie.list.length, ['krok', 'kroky', 'kroků'])} (Zpět/Znovu).`, 'Zpět na začátek', () => { P.zpet(999); zavri(); }),
            blokInfo('prepocitat', 'Možnosti prohlížeče', 'Sešit lze otevřít také v prohlížeči Nova jako webovou stránku.', 'Otevřít v Nově', () => P.exportWeb())),
          el('div.ps-zk-vlastnosti', {},
            el('h3', { text: 'Vlastnosti ▾' }),
            radek('Velikost', vel), radek('Listy', String(P.S.listy.length)), radek('Buňky s daty', String(P.S.listy.reduce((n, l) => n + l.b.size, 0))),
            radek('Celková doba úprav', `${Math.max(1, Math.round((Date.now() - P.st.otevrenoOd) / 60000))} min`),
            radek('Název', P.st.meta.nazev || 'Přidat název'), radek('Značky', 'Přidat značku'), radek('Kategorie', 'Přidat kategorii'),
            el('h3', { text: 'Související kalendářní data' }),
            radek('Poslední změna', u?.m ? new Date(u.m).toLocaleString('cs-CZ') : '—'),
            radek('Vytvořeno', P.st.meta.vytvoreno ? new Date(P.st.meta.vytvoreno).toLocaleString('cs-CZ') : 'Dnes'),
            radek('Poslední tisk', P.st.meta.tisk ? new Date(P.st.meta.tisk).toLocaleString('cs-CZ') : '—'),
            el('h3', { text: 'Související lidé' }),
            el('div.ps-zk-autor', {}, el('span.ps-avatar', { text: P.inicialy() }), el('span', { text: P.st.meta.autor || P.autor() })))),
      ];
    },
    ulozitJako() {
      let slozka = P.st.cesta ? FS.dirname(P.st.cesta) : P.nastaveni().umisteni || FS.HOME + '/Dokumenty';
      const jmeno = el('input.ps-vstup', { value: P.st.nazev.replace(/\.(xlsx|csv|txt|html)$/i, '') });
      jmeno.addEventListener('keydown', (e) => e.stopPropagation());
      const typ = el('select.ps-vyber', {}, TYPY.map(([v, t]) => el('option', { value: v, text: t, selected: v === (P.st.typUlozeni || 'xlsx') })));
      const cestaEl = el('div.ps-zk-cesta');
      const ulozit = () => {
        const n = jmeno.value.trim().replace(/[\\/:*?"<>|]/g, '');
        if (!n) return;
        const c = FS.join(slozka, n + '.' + typ.value);
        const proved = () => {
          if (P.ulozitDo(c, typ.value)) { P.toast(`Uloženo: ${c.replace(FS.HOME, '~')}`); zavri(); }
        };
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
      const l = P.S.list;
      const t = l.tisk || {};
      let co = 'list';
      const nahled = el('div.tb-zk-nahled');
      const info = el('span');
      const kresliNahled = () => {
        const f = el('iframe.tb-nahled-ram', { title: 'Náhled tisku' });
        const sirka = t.orientace === 'sirka' ? 1123 : 794, vyska = t.orientace === 'sirka' ? 794 : 1123;
        const obal = el('div.tb-nahled-strana', { style: { width: sirka * 0.52 + 'px', height: vyska * 0.52 + 'px' } }, f);
        nahled.replaceChildren(obal);
        f.srcdoc = P.exportHtml(co).replace('<body>', `<body style="padding:${t.okraje === 'uzke' ? 24 : t.okraje === 'siroke' ? 96 : 68}px 48px;box-sizing:border-box">`);
        f.style.width = sirka + 'px'; f.style.height = vyska + 'px'; f.style.transform = 'scale(0.52)';
        info.textContent = `${Math.max(1, P.stranky().length)} ${P.stranky().length > 4 ? 'stránek' : 'stránky'}`;
      };
      setTimeout(kresliNahled, 30);
      const volba = (popis, moznosti, hodnota, zmena) => el('label.tb-zk-volba', {}, el('small', { text: popis }), el('select.ps-vyber', { onchange: (e) => { zmena(e.target.value); kresliNahled(); } }, moznosti.map(([v, x]) => el('option', { value: v, text: x, selected: v === hodnota }))));
      const nastav = (z) => { l.tisk = { ...(l.tisk || {}), ...z }; Object.assign(t, z); };
      return [
        el('h1', { text: 'Tisk' }),
        el('div.ps-zk-tisk', {},
          el('div.ps-zk-tisk-vlevo', {},
            el('div.ps-zk-tisk-hlava', {},
              el('button.ps-zk-velky', { type: 'button', onclick: () => P.tiskni(co) }, ik('tisk'), el('span', { text: 'Tisk' })),
              el('label', {}, el('small', { text: 'Kopie:' }), el('input.ps-vstup.kratky', { type: 'number', value: 1, min: 1 }))),
            el('h3', { text: 'Tiskárna' }),
            el('div.ps-zk-tiskarna', {}, ik('tisk'), el('div', {}, el('b', { text: 'Uložit jako PDF' }), el('small', { text: 'Připraveno' }))),
            el('h3', { text: 'Nastavení' }),
            volba('Co tisknout', [['list', 'Vytisknout aktivní listy'], ['sesit', 'Vytisknout celý sešit'], ['vyber', 'Vytisknout výběr']], co, (v) => { co = v; }),
            volba('Orientace', [['vyska', 'Orientace na výšku'], ['sirka', 'Orientace na šířku']], t.orientace === 'sirka' ? 'sirka' : 'vyska', (v) => nastav({ orientace: v })),
            volba('Papír', [['A4', 'A4 21 cm × 29,7 cm'], ['A3', 'A3 29,7 cm × 42 cm'], ['A5', 'A5 14,8 cm × 21 cm'], ['Letter', 'Letter 21,59 cm × 27,94 cm']], t.papir || 'A4', (v) => nastav({ papir: v })),
            volba('Okraje', [['normalni', 'Normální okraje'], ['siroke', 'Široké okraje'], ['uzke', 'Úzké okraje']], t.okraje || 'normalni', (v) => nastav({ okraje: v })),
            volba('Měřítko', [['bez', 'Bez měřítka'], ['sirka', 'Přizpůsobit všechny sloupce na jednu stránku'], ['list', 'Přizpůsobit list na jednu stránku']], t.naSirku1 ? 'sirka' : 'bez', (v) => nastav({ naSirku1: v !== 'bez', meritko: v === 'list' ? 60 : undefined })),
            el('button.ps-zk-odkaz', { type: 'button', text: 'Vzhled stránky', onclick: () => D.dialogVzhledStranky(P) })),
          el('div.ps-zk-tisk-vpravo', {}, nahled, el('div.ps-zk-tisk-strana', {}, info))),
      ];
    },
    sdilet() {
      return [
        el('h1', { text: 'Sdílet' }),
        el('div.ps-zk-bloky.sirka', {},
          blokInfo('kopirovat', 'Kopírovat data listu', 'Zkopíruje obsah aktivního listu do schránky jako tabulku oddělenou tabulátory — vložíte ho do zprávy, Písma nebo jiné tabulky.', 'Kopírovat', async () => {
            try { await navigator.clipboard.writeText(P.S.naCsv(P.S.list, '\t')); P.toast('Zkopírováno do schránky'); } catch { P.toast('Schránka není dostupná'); }
          }),
          blokInfo('odkaz', 'Otevřít v Nově', 'Uloží kopii listu jako webovou stránku a otevře ji v prohlížeči Nova.', 'Otevřít jako web', () => P.exportWeb()),
          blokInfo('obalka', 'Poslat poštou', 'Otevře aplikaci Pošta. Data listu jsou ve schránce, stačí je vložit do nové zprávy.', 'Otevřít Poštu', async () => {
            try { await navigator.clipboard.writeText(P.S.naCsv(P.S.list, '\t')); } catch { /* bez schránky */ }
            P.otevriAplikaci('mail');
          })),
      ];
    },
    export() {
      return [
        el('h1', { text: 'Export' }),
        el('div.ps-zk-dva', {},
          el('div.ps-zk-mista', {},
            el('button.aktivni', { type: 'button' }, ik('pdf'), el('span', { text: 'Vytvořit dokument PDF/XPS' })),
            el('button', { type: 'button', onclick: () => { P.st.typUlozeni = 'csv'; ukaz('ulozitJako'); } }, ik('zmenitTyp'), el('span', { text: 'Změnit typ souboru' }))),
          el('div.ps-zk-otevrit-pravo', {},
            el('h2', { text: 'Vytvořit dokument PDF/XPS' }),
            el('ul.ps-zk-body', {}, el('li', { text: 'Zachová rozložení, formátování, písma a obrázky' }), el('li', { text: 'Obsah nelze snadno změnit' }), el('li', { text: 'Na webu jsou k dispozici bezplatné prohlížeče' })),
            el('button.ps-zk-velky', { type: 'button', onclick: () => P.tiskni() }, ik('pdf'), el('span', { text: 'Vytvořit PDF/XPS' })),
            el('h2', { text: 'Změnit typ souboru', style: { marginTop: '28px' } }),
            el('div.ps-zk-typy', {}, TYPY.map(([v, x]) => el('button', { type: 'button', onclick: () => { P.st.typUlozeni = v; ukaz('ulozitJako'); } }, ik('list'), el('span', { text: x })))))),
      ];
    },
    ucet() {
      const n = P.nastaveni();
      const motiv = el('select.ps-vyber', { onchange: (e) => P.nastavMotiv(e.target.value) },
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
            el('div.tb-zk-produkt', {}, el('div.ps-t-logo.tb-logo.velke', {}, el('span', { text: 'T' })), el('div', {}, el('b', { text: 'AstroTabulky pro AstroOS' }), el('small', { text: 'Součást balíku Astro Office · verze 1.0 (2026)' }))),
            el('p', { text: 'Obsahuje přes 170 funkcí, dynamická pole, tabulky, grafy, kontingenční tabulky, podmíněné formátování a AstroAI.' }))),
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
