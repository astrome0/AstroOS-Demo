// AstroPísmo — zákulisí (karta Soubor): Domů, Nový, Otevřít, Informace, Uložit jako, Tisk, Export, Účet

import { el, cz, plural } from '../util.js';
import * as FS from '../fs.js';
import { ik } from './ikony.js';
import { SABLONY } from './sablony.js';
import { geometrie, MEZERA } from './dokument.js';
import { dialog, pole } from './ui.js';

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

const TYPY = [
  ['docx', 'Dokument AstroPísma (*.docx)'],
  ['html', 'Webová stránka (*.html)'],
  ['txt', 'Prostý text (*.txt)'],
  ['md', 'Markdown (*.md)'],
];

function pozdrav() {
  const h = new Date().getHours();
  return h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobré odpoledne' : 'Dobrý večer';
}

/** Miniatura stránky se skutečným obsahem (šablona nebo dokument). */
export function miniatura(html, nast = {}, sirka = 150) {
  const g = geometrie({ velikost: 'A4', orientace: 'na-vysku', okraje: 'normalni', ...nast });
  const m = sirka / g.w;
  const obsah = el('div.ps-obsah.ps-mini-obsah', { html, style: { left: g.ml + 'px', top: g.mt + 'px', width: g.sirka + 'px' } });
  const strana = el('div.ps-mini-strana', { style: { width: g.w + 'px', height: g.h + 'px', transform: `scale(${m})`, background: nast.barvaStranky || '#fff' } },
    nast.ohraniceni ? el('div.ps-ramecek') : null, obsah);
  return el('div.ps-miniatura', { style: { width: sirka + 'px', height: Math.round(g.h * m) + 'px' } }, strana);
}

function kartaSablony(P, s) {
  const jmeno = P.autor();
  return el('button.ps-sablona', { type: 'button', title: s.nazev, onclick: () => P.novy(s.id) },
    miniatura(s.html(jmeno), s.nast), el('span', { text: s.nazev }));
}

function tabulkaSouboru(P, soubory, { prazdne = 'Zatím jste neotevřeli žádné dokumenty.' } = {}) {
  if (!soubory.length) return el('div.ps-zk-prazdno', {}, ik('novy'), el('p', { text: prazdne }));
  return el('div.ps-zk-soubory', {},
    el('div.ps-zk-soubor.hlava', {}, el('span'), el('span', { text: 'Název' }), el('span', { text: 'Datum změny' })),
    soubory.map((c) => {
      const u = FS.get(c);
      return el('button.ps-zk-soubor', { type: 'button', title: c, onclick: () => P.otevri(c) },
        el('span.ps-zk-docx', {}, ik('novy')),
        el('span.ps-zk-nazev', {}, el('b', { text: FS.basename(c).replace(/\.docx$/i, '') }), el('small', { text: FS.dirname(c).replace(FS.HOME, 'Plocha › …').replace('Plocha › …', '~') })),
        el('span.ps-zk-datum', { text: u?.m ? cz.datumKratky(new Date(u.m)) : '' }));
    }));
}

function prochazec(P, { start, onSoubor, jenSlozky = false, filtr = /\.(docx|txt|md|html?)$/i, onCesta }) {
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
      soubory.map((s) => el('button.ps-zk-radek', { type: 'button', onclick: () => onSoubor(FS.join(cesta, s.name)) }, el('span.ps-zk-docx.mala', {}, ik('novy')), el('span', { text: s.name }),
        el('small', { text: s.node.m ? cz.datumKratky(new Date(s.node.m)) : '' }))),
      !slozky.length && !soubory.length ? el('p.ps-zk-pozn', { text: 'Tato složka je prázdná.' }) : null));
  };
  kresli(start);
  return box;
}

export function otevriZakulisi(P, stranka = 'domu') {
  P.zavriZakulisi?.();
  const maDok = !!P.st.otevreno;
  const obsah = el('div.ps-zk-obsah');
  const menu = el('nav.ps-zk-menu');
  const zakulisi = el('div.ps-zakulisi', {}, menu, obsah);

  const zavri = () => {
    zakulisi.remove();
    P.zavriZakulisi = null;
    P.koren.classList.remove('v-zakulisi');
    if (!P.st.otevreno) P.novy('prazdny');
    else P.dok.vratVyber();
  };
  P.zavriZakulisi = () => { zakulisi.remove(); P.zavriZakulisi = null; P.koren.classList.remove('v-zakulisi'); };

  const polozka = (p) => {
    if (p === 'sep') return el('div.ps-zk-sep');
    const b = el('button.ps-zk-pol', { type: 'button', dataset: { id: p.id }, disabled: p.dok && !maDok }, p.ikona ? ik(p.ikona) : el('span.ps-zk-bez'), el('span', { text: p.text }));
    b.onclick = () => {
      if (p.id === 'ulozit') { if (P.st.cesta) { P.ulozit(); zavri(); } else ukaz('ulozitJako'); return; }
      if (p.id === 'zavrit') { P.zavritDokument(); return; }
      if (p.id === 'nazory') { import('./dialogy.js').then((D) => D.dialogNazory(P)); return; }
      if (p.id === 'moznosti') { moznosti(P); return; }
      ukaz(p.id);
    };
    return b;
  };
  menu.append(
    el('button.ps-zk-zpet', { type: 'button', title: 'Zpět', onclick: zavri }, ik('kruhZpet')),
    ...POLOZKY.map(polozka),
    el('div.ps-zk-mezera'),
    ...DOLE.map(polozka),
  );

  const STRANKY = {
    domu() {
      return [
        el('h1', { text: pozdrav() }),
        el('div.ps-zk-sekce', {},
          el('div.ps-zk-sablony', {}, SABLONY.slice(0, 6).map((s) => kartaSablony(P, s))),
          el('button.ps-zk-odkaz', { type: 'button', onclick: () => ukaz('novy') }, 'Další šablony', el('span', { text: ' →' }))),
        el('div.ps-zk-hledat', {}, ik('najitMaly'), el('input', {
          placeholder: 'Hledat', oninput: (e) => {
            const q = e.target.value.toLocaleLowerCase('cs');
            seznam.replaceChildren(tabulkaSouboru(P, P.nedavne().filter((c) => c.toLocaleLowerCase('cs').includes(q))));
          },
        })),
        el('div.ps-zk-zalozky', {}, el('span.aktivni', { text: 'Nedávné' }), el('span', { text: 'Připnuté' }), el('span', { text: 'Sdílené se mnou' })),
        (seznam = el('div', {}, tabulkaSouboru(P, P.nedavne()))),
        el('button.ps-zk-odkaz.vpravo', { type: 'button', onclick: () => ukaz('otevrit') }, 'Další dokumenty', el('span', { text: ' →' })),
      ];
    },
    novy() {
      return [
        el('h1', { text: 'Nový' }),
        el('div.ps-zk-hledat', {}, ik('najitMaly'), el('input', { placeholder: 'Hledat online šablony', disabled: true })),
        el('div.ps-zk-navrhy', {}, 'Navrhovaná hledání: ', ['Obchodní', 'Karty', 'Letáky', 'Dopisy', 'Vzdělávání', 'Životopisy'].map((t) => el('span', { text: t }))),
        el('div.ps-zk-sablony.velke', {}, SABLONY.map((s) => kartaSablony(P, s))),
      ];
    },
    otevrit() {
      const vpravo = el('div.ps-zk-otevrit-pravo');
      const leve = [
        ['nedavne', 'hodiny', 'Nedávné'],
        ['pc', 'pocitac', 'Tento počítač'],
        ['dokumenty', 'slozka', 'Dokumenty'],
        ['plocha', 'slozka', 'Plocha'],
      ];
      const vyber = (id) => {
        levy.querySelectorAll('button').forEach((b) => b.classList.toggle('aktivni', b.dataset.id === id));
        if (id === 'nedavne') vpravo.replaceChildren(el('h2', { text: 'Dokumenty' }), tabulkaSouboru(P, P.nedavne()));
        else {
          const start = id === 'plocha' ? FS.HOME + '/Plocha' : id === 'dokumenty' ? FS.HOME + '/Dokumenty' : FS.HOME;
          vpravo.replaceChildren(el('h2', { text: id === 'pc' ? 'Tento počítač' : leve.find((l) => l[0] === id)[2] }), prochazec(P, { start, onSoubor: (c) => P.otevri(c) }));
        }
      };
      const levy = el('div.ps-zk-mista', {}, leve.map(([id, i, t]) => el('button', { type: 'button', dataset: { id }, onclick: () => vyber(id) }, ik(i), el('span', { text: t }))),
        el('button', { type: 'button', onclick: () => P.otevritZeZarizeni() }, ik('otevrit'), el('span', { text: 'Procházet (toto zařízení)' })));
      setTimeout(() => vyber('nedavne'));
      return [el('h1', { text: 'Otevřít' }), el('div.ps-zk-dva', {}, levy, vpravo)];
    },
    informace() {
      const s = P.dok.statistika();
      const u = P.st.cesta ? FS.get(P.st.cesta) : null;
      const vel = u ? FS.humanSize(FS.size(u)) : 'Neuloženo';
      const radek = (k, v) => el('div.ps-zk-vl', {}, el('span', { text: k }), el('span', { text: v }));
      return [
        el('h1', { text: 'Informace' }),
        el('div.ps-zk-docnazev', {}, el('b', { text: P.st.nazev }), el('small', { text: P.st.cesta ? FS.dirname(P.st.cesta) : 'Dokument ještě není uložený' })),
        el('div.ps-zk-info', {},
          el('div.ps-zk-bloky', {},
            blokInfo('zamek', 'Chránit dokument', P.st.jenCteni ? 'Dokument je označený jako konečný, aby se zabránilo úpravám.' : 'Určete, jaké typy změn můžou ostatní v dokumentu provádět.', P.st.jenCteni ? 'Zrušit označení' : 'Označit jako konečné', () => { P.jenCteni(!P.st.jenCteni); ukaz('informace'); }),
            blokInfo('lupaKontrola', 'Zkontrolovat dokument', 'Před publikováním souboru si uvědomte, že obsahuje: vlastnosti dokumentu a jméno autora, obsah, který osoby s postižením nemusí dokázat číst.', 'Zkontrolovat přístupnost', () => { zavri(); P.podokno('pristupnost'); }),
            blokInfo('verze', 'Historie verzí', `Historie úprav tohoto dokumentu má ${plural(P.dok.hist.list.length, ['krok', 'kroky', 'kroků'])} (Zpět/Znovu).`, 'Zpět na začátek', () => { P.dok.zpet(999); zavri(); })),
          el('div.ps-zk-vlastnosti', {},
            el('h3', { text: 'Vlastnosti ▾' }),
            radek('Velikost', vel), radek('Stránky', String(s.stranky)), radek('Slova', s.slova.toLocaleString('cs-CZ')),
            radek('Celková doba úprav', `${Math.max(1, Math.round((Date.now() - P.st.otevrenoOd) / 60000))} min`),
            radek('Název', P.st.meta.nazev || 'Přidat název'), radek('Značky', 'Přidat značku'), radek('Komentáře', String(P.dok.nast.komentare.length)),
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
      const jmeno = el('input.ps-vstup', { value: P.st.nazev.replace(/\.(docx|txt|html|md)$/i, '') });
      const typ = el('select.ps-vyber', {}, TYPY.map(([v, t]) => el('option', { value: v, text: t, selected: v === (P.st.typUlozeni || 'docx') })));
      const cestaEl = el('div.ps-zk-cesta');
      const uloz = () => {
        const n = jmeno.value.trim().replace(/[\\/:*?"<>|]/g, '');
        if (!n) return jmeno.focus();
        const c = FS.join(slozka, `${n}.${typ.value}`);
        if (FS.exists(c) && c !== P.st.cesta) {
          dialog(P.koren, {
            titulek: 'Potvrdit uložit jako', sirka: 420,
            obsah: el('p.ps-zprava', { text: `${FS.basename(c)} již existuje. Chcete ho nahradit?` }),
            tlacitka: [{ text: 'Ano', primarni: true, akce: () => { if (P.ulozitDo(c, typ.value)) zavri(); } }, { text: 'Ne' }],
          });
          return;
        }
        if (P.ulozitDo(c, typ.value)) zavri();
      };
      jmeno.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') uloz(); });
      const prochazecBox = el('div');
      const prekresli = () => {
        prochazecBox.replaceChildren(prochazec(P, {
          start: slozka, filtr: /\.(docx|txt|html?|md)$/i,
          onCesta: (c) => { slozka = c; cestaEl.replaceChildren(ik('slozka'), el('span', { text: c.replace(FS.HOME, 'Domů') })); },
          onSoubor: (c) => { jmeno.value = FS.basename(c).replace(/\.[^.]+$/, ''); },
        }));
      };
      prekresli();
      setTimeout(() => { jmeno.focus(); jmeno.select(); }, 60);
      return [
        el('h1', { text: 'Uložit jako' }),
        el('div.ps-zk-dva', {},
          el('div.ps-zk-mista', {},
            el('button.aktivni', { type: 'button' }, ik('pocitac'), el('span', { text: 'Tento počítač' })),
            el('button', { type: 'button', onclick: () => { slozka = FS.HOME + '/Plocha'; prekresli(); } }, ik('slozka'), el('span', { text: 'Plocha' })),
            el('button', { type: 'button', onclick: () => { slozka = FS.HOME + '/Dokumenty'; prekresli(); } }, ik('slozka'), el('span', { text: 'Dokumenty' }))),
          el('div.ps-zk-otevrit-pravo', {},
            cestaEl,
            el('div.ps-zk-ulozit-radek', {}, jmeno, typ, el('button.ps-tlac.primarni', { type: 'button', onclick: uloz }, ik('ulozit'), ' Uložit')),
            prochazecBox)),
      ];
    },
    tisk() {
      const g = P.dok.g;
      let strana = 1;
      const nahled = el('div.ps-zk-nahled');
      const info = el('span');
      const kresliNahled = () => {
        const kopie = P.dok.list.cloneNode(true);
        kopie.querySelector('.ps-ed')?.removeAttribute('contenteditable');
        kopie.querySelectorAll('.ps-kom, .ps-vybrany').forEach((k) => k.classList.remove('ps-kom', 'ps-vybrany'));
        kopie.querySelectorAll('.ps-uchyt-ram').forEach((x) => x.remove());
        const vyska = Math.max(200, nahled.clientHeight - 40 || 600);
        const m = Math.min(vyska / g.h, 0.9);
        kopie.style.transform = `translateY(${-(strana - 1) * (g.h + MEZERA) * m}px) scale(${m})`;
        kopie.style.transformOrigin = '0 0';
        const okno = el('div.ps-zk-nahled-strana', { style: { width: g.w * m + 'px', height: g.h * m + 'px' } }, kopie);
        nahled.replaceChildren(okno);
        info.textContent = `${strana} z ${P.dok.pocetStran}`;
      };
      setTimeout(kresliNahled, 30);
      const kopie = el('input.ps-vstup.kratky', { type: 'number', value: 1, min: 1 });
      return [
        el('h1', { text: 'Tisk' }),
        el('div.ps-zk-tisk', {},
          el('div.ps-zk-tisk-vlevo', {},
            el('div.ps-zk-tisk-hlava', {},
              el('button.ps-zk-velky', { type: 'button', onclick: () => P.tiskni() }, ik('tisk'), el('span', { text: 'Tisk' })),
              pole('Kopie:', kopie)),
            el('h3', { text: 'Tiskárna' }),
            el('div.ps-zk-volba', {}, ik('tisk'), el('div', {}, el('b', { text: 'Tiskárna prohlížeče' }), el('small', { text: 'Připraveno · také „Uložit jako PDF“' }))),
            el('h3', { text: 'Nastavení' }),
            el('div.ps-zk-volba', {}, ik('rozlozeniTisk'), el('div', {}, el('b', { text: 'Vytisknout všechny stránky' }), el('small', { text: 'Celý dokument' }))),
            el('div.ps-zk-volba', {}, ik('rozlozeniTisk'), el('div', {}, el('b', { text: 'Jednostranný tisk' }), el('small', { text: 'Tisknout jen na jednu stranu' }))),
            el('div.ps-zk-volba', {}, ik('orientace'), el('div', {}, el('b', { text: P.dok.nast.orientace === 'na-sirku' ? 'Orientace na šířku' : 'Orientace na výšku' }))),
            el('div.ps-zk-volba', {}, ik('velikost'), el('div', {}, el('b', { text: P.dok.nast.velikost }), el('small', { text: `${(g.w / 37.795).toFixed(1).replace('.', ',')} cm × ${(g.h / 37.795).toFixed(1).replace('.', ',')} cm` }))),
            el('div.ps-zk-volba', {}, ik('okraje'), el('div', {}, el('b', { text: 'Okraje' }), el('small', { text: P.dok.nast.okraje }))),
            el('button.ps-zk-odkaz', { type: 'button', onclick: () => import('./dialogy.js').then((D) => D.dialogVzhledStranky(P)) }, 'Vzhled stránky')),
          el('div.ps-zk-tisk-vpravo', {}, nahled,
            el('div.ps-zk-strankovac', {},
              el('button', { type: 'button', text: '◀', onclick: () => { if (strana > 1) { strana--; kresliNahled(); } } }),
              info,
              el('button', { type: 'button', text: '▶', onclick: () => { if (strana < P.dok.pocetStran) { strana++; kresliNahled(); } } })))),
      ];
    },
    sdilet() {
      return [
        el('h1', { text: 'Sdílet' }),
        el('div.ps-zk-bloky.sirka', {},
          blokInfo('kopirovat', 'Kopírovat text dokumentu', 'Zkopíruje obsah dokumentu do schránky jako prostý text — pak ho vložíte do zprávy nebo chatu.', 'Kopírovat', async () => {
            try { await navigator.clipboard.writeText(P.dok.text); P.toast('Zkopírováno do schránky'); } catch { P.toast('Schránka není dostupná'); }
          }),
          blokInfo('odkaz', 'Otevřít v Nově', 'Uloží kopii jako webovou stránku a otevře ji v prohlížeči Nova.', 'Otevřít jako web', () => P.exportWeb()),
          blokInfo('obalka', 'Poslat poštou', 'Otevře aplikaci Pošta. Obsah dokumentu je ve schránce, stačí ho vložit do nové zprávy.', 'Otevřít Poštu', async () => {
            try { await navigator.clipboard.writeText(P.dok.text); } catch { /* bez schránky */ }
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
            el('button', { type: 'button', onclick: () => { P.st.typUlozeni = 'html'; ukaz('ulozitJako'); } }, ik('zmenitTyp'), el('span', { text: 'Změnit typ souboru' }))),
          el('div.ps-zk-otevrit-pravo', {},
            el('h2', { text: 'Vytvořit dokument PDF/XPS' }),
            el('ul.ps-zk-body', {}, el('li', { text: 'Zachová rozložení, formátování, písma a obrázky' }), el('li', { text: 'Obsah nelze snadno změnit' }), el('li', { text: 'Na webu jsou k dispozici bezplatné prohlížeče' })),
            el('button.ps-zk-velky', { type: 'button', onclick: () => P.tiskni() }, ik('pdf'), el('span', { text: 'Vytvořit PDF/XPS' })),
            el('h2', { text: 'Změnit typ souboru', style: { marginTop: '28px' } }),
            el('div.ps-zk-typy', {}, TYPY.map(([v, t]) => el('button', { type: 'button', onclick: () => { P.st.typUlozeni = v; ukaz('ulozitJako'); } }, ik('novy'), el('span', { text: t })))))),
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
            el('h3', { text: 'Motiv Office' }), motiv,
            el('h3', { text: 'Připojené služby' }),
            el('div.ps-zk-volba', {}, ik('astroai'), el('div', {}, el('b', { text: 'AstroAI' }), el('small', { text: 'Jen v plné verzi' })))),
          el('div', {},
            el('h3', { text: 'Informace o produktu' }),
            el('div.ps-zk-produkt', {}, el('div.ps-zk-logo', {}, el('span', { text: 'P' })), el('div', {}, el('b', { text: 'AstroPísmo pro AstroOS' }), el('small', { text: 'Součást balíku Astro Office' }))),
            el('div.ps-zk-vl', {}, el('span', { text: 'Verze' }), el('span', { text: '1.0 (sestavení 2026.09.23)' })),
            el('button.ps-zk-odkaz', { type: 'button', onclick: () => import('./dialogy.js').then((D) => D.dialogCoNoveho(P)) }, 'Co je nového'))),
      ];
    },
  };

  let seznam;
  function ukaz(id) {
    menu.querySelectorAll('.ps-zk-pol').forEach((b) => b.classList.toggle('aktivni', b.dataset.id === id));
    obsah.replaceChildren(...(STRANKY[id]?.() || []).filter(Boolean));
    obsah.dataset.stranka = id;
    obsah.scrollTop = 0;
  }

  zakulisi.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.target.closest('input')) { e.stopPropagation(); zavri(); }
  });
  P.koren.append(zakulisi);
  P.koren.classList.add('v-zakulisi');
  ukaz(stranka);
}

function blokInfo(ikona, nadpis, text, tlacitko, akce) {
  return el('div.ps-zk-blok', {},
    el('button.ps-zk-blok-tl', { type: 'button', onclick: akce }, ik(ikona), el('span', { text: tlacitko })),
    el('div', {}, el('h3', { text: nadpis }), el('p', { text })));
}

// ---------------------------------------------------------------- Možnosti
function moznosti(P) {
  const n = P.nastaveni();
  const jmeno = el('input.ps-vstup', { value: n.jmeno || P.autor() });
  const inicialy = el('input.ps-vstup.kratky', { value: n.inicialy || P.inicialy() });
  const motiv = el('select.ps-vyber', {}, [['barevny', 'Barevný'], ['tmave-sedy', 'Tmavě šedý'], ['cerny', 'Černý'], ['bily', 'Bílý'], ['system', 'Použít nastavení systému']].map(([v, t]) => el('option', { value: v, text: t, selected: (n.motiv || 'barevny') === v })));
  const auto = el('input', { type: 'checkbox', checked: !!n.autoUkladani });
  const znacky = el('input', { type: 'checkbox', checked: !!n.znacky });
  const pravitko = el('input', { type: 'checkbox', checked: !!n.pravitko });
  const kontrola = el('input', { type: 'checkbox', checked: n.kontrola !== false });
  const auto2 = el('input', { type: 'checkbox', checked: n.autoformat !== false });
  const umisteni = el('input.ps-vstup', { value: n.umisteni || FS.HOME + '/Dokumenty' });
  const kategorie = ['Obecné', 'Zobrazení', 'Kontrola pravopisu a mluvnice', 'Uložit', 'Jazyk', 'Usnadnění přístupu', 'Upřesnit'];
  const stranky = [
    el('div', {},
      el('h3', { text: 'Přizpůsobit kopii AstroPísma' }), pole('Uživatelské jméno:', jmeno), pole('Iniciály:', inicialy),
      pole('Motiv Office:', motiv)),
    el('div', {}, el('h3', { text: 'Tyto značky formátování vždy zobrazit na obrazovce' }), el('label.ps-dlg-radio', {}, znacky, ' Značky odstavců ¶'),
      el('h3', { text: 'Zobrazit' }), el('label.ps-dlg-radio', {}, pravitko, ' Zobrazovat pravítko')),
    el('div', {}, el('h3', { text: 'Při opravách pravopisu' }), el('label.ps-dlg-radio', {}, kontrola, ' Kontrolovat pravopis při psaní'),
      el('label.ps-dlg-radio', {}, auto2, ' Automaticky formátovat seznamy a uvozovky („“) při psaní')),
    el('div', {}, el('h3', { text: 'Ukládat dokumenty' }), el('label.ps-dlg-radio', {}, auto, ' Ve výchozím nastavení zapnout Automatické ukládání'),
      pole('Výchozí místní umístění souboru:', umisteni)),
    el('div', {}, el('h3', { text: 'Jazyk úprav' }), el('p', { text: 'čeština (Česko) — výchozí' })),
    el('div', {}, el('h3', { text: 'Usnadnění přístupu' }), el('p', { text: 'Zpětná vazba zvukem a animacemi se řídí nastavením AstroOS.' })),
    el('div', {}, el('h3', { text: 'Upřesnit' }), el('p', { text: 'Zpět/Znovu si pamatuje 150 kroků.' })),
  ];
  const obsah = el('div.ps-moz-obsah', {}, stranky[0]);
  const vlevo = el('div.ps-moz-kat', {}, kategorie.map((k, i) => el('button', { type: 'button', text: k, class: i === 0 ? 'aktivni' : '', onclick: (e) => {
    vlevo.querySelectorAll('button').forEach((b) => b.classList.remove('aktivni'));
    e.currentTarget.classList.add('aktivni');
    obsah.replaceChildren(stranky[i]);
  } })));
  dialog(P.koren, {
    titulek: 'Možnosti AstroPísma', sirka: 680, cls: 'ps-moznosti',
    obsah: el('div.ps-moz', {}, vlevo, obsah),
    tlacitka: [
      {
        text: 'OK', primarni: true, akce: () => {
          P.ulozNastaveni({
            jmeno: jmeno.value.trim(), inicialy: inicialy.value.trim(), motiv: motiv.value, autoUkladani: auto.checked,
            znacky: znacky.checked, pravitko: pravitko.checked, kontrola: kontrola.checked, autoformat: auto2.checked, umisteni: umisteni.value.trim(),
          });
        },
      },
      { text: 'Zrušit' },
    ],
  });
}
