// AstroPísmo — dialogová okna (Písmo, Odstavec, Najít a nahradit, Počet slov, Lupa…)

import { el } from '../util.js';
import * as FS from '../fs.js';
import { icon as ikonaOS } from '../icons.js';
import { ik } from './ikony.js';
import { dialog, zprava, pole, zavriRozbal } from './ui.js';
import { PISMA, VELIKOSTI_PISMA, VELIKOSTI, OKRAJE, MM, zasobnikPisma } from './dokument.js';

export const zpravaP = (P, text, titulek) => zprava(P.koren, text, titulek);

const cislo = (v) => parseFloat(String(v).replace(',', '.'));
const fmt = (v, d = 1) => (+v.toFixed(d)).toString().replace('.', ',');

function vyberSeznam(hodnoty, vybrana, { styl } = {}) {
  const s = el('select.ps-vyber', { size: 1 });
  for (const h of hodnoty) {
    const [v, t] = Array.isArray(h) ? h : [h, h];
    const o = el('option', { value: v, text: t });
    if (styl) o.style.fontFamily = styl(v);
    if (String(v) === String(vybrana)) o.selected = true;
    s.append(o);
  }
  return s;
}

// ---------------------------------------------------------------- Písmo
export function dialogPismo(P) {
  const s = P.stav;
  const pismo = vyberSeznam(PISMA, (s.pismoPopis || 'Aptos').replace(/ \(.*\)$/, ''), { styl: zasobnikPisma });
  const rez = vyberSeznam([['n', 'Obyčejné'], ['i', 'Kurzíva'], ['b', 'Tučné'], ['bi', 'Tučná kurzíva']], (s.tucne ? 'b' : '') + (s.kurziva ? 'i' : '') || 'n');
  const vel = el('input.ps-vstup', { type: 'text', value: fmt(s.velikost || 12), list: 'ps-velikosti' });
  const velList = el('datalist#ps-velikosti', {}, VELIKOSTI_PISMA.map((v) => el('option', { value: fmt(v) })));
  const barva = el('input', { type: 'color', value: s.barva || '#000000' });
  const podtrzeni = vyberSeznam([['', '(žádné)'], ['solid', 'Jednoduché'], ['double', 'Dvojité'], ['dotted', 'Tečkované'], ['wavy', 'Vlnovka']], s.podtrzeni ? 'solid' : '');
  const efekt = (t) => el('input', { type: 'checkbox', dataset: { e: t } });
  const ef = { preskrt: efekt('preskrt'), horni: efekt('horni'), dolni: efekt('dolni'), kapitalky: efekt('kapitalky'), velka: efekt('velka') };
  const nahled = el('div.ps-nahled-pisma', { text: P.dok.vybranyText.slice(0, 40) || 'Aptos' });

  const kresliNahled = () => Object.assign(nahled.style, {
    fontFamily: zasobnikPisma(pismo.value),
    fontStyle: rez.value.includes('i') ? 'italic' : 'normal',
    fontWeight: rez.value.includes('b') ? '700' : '400',
    fontSize: Math.min(cislo(vel.value) || 12, 40) + 'pt',
    color: barva.value,
    textDecoration: [podtrzeni.value ? `underline ${podtrzeni.value}` : '', ef.preskrt.checked ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
    fontVariant: ef.kapitalky.checked ? 'small-caps' : 'normal',
    textTransform: ef.velka.checked ? 'uppercase' : 'none',
  });
  [pismo, rez, vel, barva, podtrzeni, ...Object.values(ef)].forEach((x) => x.addEventListener('input', kresliNahled));
  kresliNahled();

  dialog(P.koren, {
    titulek: 'Písmo', sirka: 480,
    obsah: el('div.ps-dlg-pismo', {},
      el('div.ps-dlg-zalozky', {}, el('span.aktivni', { text: 'Písmo' }), el('span', { text: 'Upřesnit' })),
      el('div.ps-dlg-mrizka3', {}, pole('Písmo:', pismo), pole('Řez písma:', rez), pole('Velikost:', vel), velList),
      el('div.ps-dlg-mrizka3', {}, pole('Barva písma:', barva), pole('Styl podtržení:', podtrzeni)),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Efekty' }),
        el('div.ps-dlg-mrizka2', {},
          el('label', {}, ef.preskrt, ' Přeškrtnutí'), el('label', {}, ef.kapitalky, ' Kapitálky'),
          el('label', {}, ef.horni, ' Horní index'), el('label', {}, ef.velka, ' Velká písmena'),
          el('label', {}, ef.dolni, ' Dolní index'))),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Náhled' }), nahled),
      el('p.ps-dlg-pozn', { text: 'Toto písmo TrueType se použije pro tisk i zobrazení na obrazovce.' })),
    tlacitka: [
      { text: 'Nastavit jako výchozí', akce: () => { zpravaP(P, 'Výchozí písmo se nastavuje v Soubor → Možnosti.'); return false; } },
      { text: 'Textové efekty…', akce: () => false },
      {
        text: 'OK', primarni: true, akce: () => {
          P.dok.velikostCeka = cislo(vel.value) || 12;
          P.prikaz(() => {
            P.dok.obalVyber((sp) => Object.assign(sp.style, {
              fontFamily: zasobnikPisma(pismo.value),
              fontStyle: rez.value.includes('i') ? 'italic' : 'normal',
              fontWeight: rez.value.includes('b') ? '700' : '400',
              fontSize: (cislo(vel.value) || 12) + 'pt',
              color: barva.value,
              textDecoration: [podtrzeni.value ? `underline ${podtrzeni.value}` : '', ef.preskrt.checked ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
              fontVariant: ef.kapitalky.checked ? 'small-caps' : '',
              textTransform: ef.velka.checked ? 'uppercase' : '',
              verticalAlign: ef.horni.checked ? 'super' : ef.dolni.checked ? 'sub' : '',
            }));
          }, 'Písmo');
        },
      },
      { text: 'Zrušit' },
    ],
  });
}

// ---------------------------------------------------------------- Odstavec
export function dialogOdstavec(P) {
  const b = P.dok.blokKurzoru();
  const cs = b ? getComputedStyle(b) : null;
  const cm = (px) => fmt(px / MM / 10, 2);
  const zar = vyberSeznam([['left', 'Vlevo'], ['center', 'Na střed'], ['right', 'Vpravo'], ['justify', 'Do bloku']], cs?.textAlign === 'start' ? 'left' : cs?.textAlign || 'left');
  const vlevo = el('input.ps-vstup', { value: cm(parseFloat(cs?.marginLeft) || 0) + ' cm' });
  const vpravo = el('input.ps-vstup', { value: cm(parseFloat(cs?.marginRight) || 0) + ' cm' });
  const prvni = vyberSeznam([['', '(žádné)'], ['prvni', 'První řádek'], ['predsazeni', 'Předsazení']], parseFloat(cs?.textIndent) > 0 ? 'prvni' : parseFloat(cs?.textIndent) < 0 ? 'predsazeni' : '');
  const oKolik = el('input.ps-vstup', { value: cm(Math.abs(parseFloat(cs?.textIndent) || 0)) || '1,25' });
  const pred = el('input.ps-vstup', { value: Math.round((parseFloat(cs?.marginTop) || 0) * 0.75) + ' b.' });
  const za = el('input.ps-vstup', { value: Math.round((parseFloat(cs?.marginBottom) || 0) * 0.75) + ' b.' });
  const lh = cs ? (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)) / 1.17 : 1.15;
  const radk = vyberSeznam([['1', 'Jednoduché'], ['1.15', '1,15'], ['1.5', '1,5 řádku'], ['2', 'Dvojité'], ['3', 'Násobky 3']], [1, 1.15, 1.5, 2, 3].reduce((a, v) => (Math.abs(v - lh) < Math.abs(a - lh) ? v : a), 1.15));

  dialog(P.koren, {
    titulek: 'Odstavec', sirka: 470,
    obsah: el('div', {},
      el('div.ps-dlg-zalozky', {}, el('span.aktivni', { text: 'Odsazení a mezery' }), el('span', { text: 'Tok textu' })),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Obecné' }), pole('Zarovnání:', zar)),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Odsazení' }),
        el('div.ps-dlg-mrizka2', {}, pole('Vlevo:', vlevo), pole('Speciální:', prvni), pole('Vpravo:', vpravo), pole('O:', oKolik))),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Mezery' }),
        el('div.ps-dlg-mrizka2', {}, pole('Před:', pred), pole('Řádkování:', radk), pole('Za:', za)))),
    tlacitka: [
      { text: 'Tabulátory…', akce: () => false },
      {
        text: 'OK', primarni: true, akce: () => P.prikaz(() => {
          for (const x of P.dok.vybraneBloky()) {
            const o = cislo(oKolik.value) || 0;
            Object.assign(x.style, {
              textAlign: zar.value,
              marginLeft: (cislo(vlevo.value) || 0) * 10 * MM + 'px',
              marginRight: (cislo(vpravo.value) || 0) * 10 * MM + 'px',
              textIndent: prvni.value === 'prvni' ? o * 10 * MM + 'px' : prvni.value === 'predsazeni' ? -o * 10 * MM + 'px' : '',
              paddingLeft: prvni.value === 'predsazeni' ? o * 10 * MM + 'px' : '',
              marginTop: (cislo(pred.value) || 0) + 'pt',
              marginBottom: (cislo(za.value) || 0) + 'pt',
              lineHeight: String(+(cislo(radk.value) * 1.17).toFixed(3)),
            });
          }
        }, 'Odstavec'),
      },
      { text: 'Zrušit' },
    ],
  });
}

// ---------------------------------------------------------------- Seřadit
export function dialogSeradit(P) {
  const vz = el('input', { type: 'radio', name: 'ps-rad', checked: true });
  const se = el('input', { type: 'radio', name: 'ps-rad' });
  dialog(P.koren, {
    titulek: 'Seřadit text', sirka: 360,
    obsah: el('div', {}, pole('Seřadit podle:', vyberSeznam([['o', 'Odstavce']], 'o')), pole('Typ:', vyberSeznam([['t', 'Text'], ['c', 'Číslo']], 't')),
      el('div.ps-dlg-radio', {}, el('label', {}, vz, ' Vzestupně'), el('label', {}, se, ' Sestupně'))),
    tlacitka: [
      {
        text: 'OK', primarni: true, akce: () => P.prikaz(() => {
          const bloky = P.dok.vybraneBloky();
          if (bloky.length < 2) return;
          const rodic = bloky[0].parentNode;
          const serazene = [...bloky].sort((a, b) => a.textContent.localeCompare(b.textContent, 'cs', { numeric: true }) * (se.checked ? -1 : 1));
          const kotva = bloky[bloky.length - 1].nextSibling;
          for (const b of serazene) rodic.insertBefore(b, kotva);
        }, 'Seřadit'),
      },
      { text: 'Zrušit' },
    ],
  });
}

// ---------------------------------------------------------------- Najít a nahradit
export function dialogNahradit(P, zalozka = 'nahradit') {
  const najit = el('input.ps-vstup', { value: P.dok.vybranyText.slice(0, 80) || P.st.posledniHledani || '' });
  const nahradit = el('input.ps-vstup', { value: P.st.posledniNahrazeni || '' });
  const velka = el('input', { type: 'checkbox' });
  const cela = el('input', { type: 'checkbox' });
  const prejit = el('input.ps-vstup', { placeholder: 'Zadejte číslo stránky' });
  const stav = el('div.ps-dlg-pozn');
  let aktivni = zalozka;

  const radekNahr = pole('Nahradit čím:', nahradit);
  const radekNajit = pole('Najít:', najit);
  const radekPrejit = pole('Zadejte číslo stránky:', prejit);
  const zal = ['najit', 'nahradit', 'prejit'].map((z) => el('span', { text: { najit: 'Najít', nahradit: 'Nahradit', prejit: 'Přejít na' }[z], dataset: { z } }));
  const zalozky = el('div.ps-dlg-zalozky.klik', {}, zal);
  const moznosti = el('div.ps-dlg-radio', {}, el('label', {}, velka, ' Rozlišovat malá a velká'), el('label', {}, cela, ' Jen celá slova'));

  const tlNahradit = el('button.ps-tlac', { type: 'button', text: 'Nahradit' });
  const tlVse = el('button.ps-tlac', { type: 'button', text: 'Nahradit vše' });
  const tlDalsi = el('button.ps-tlac.primarni', { type: 'button', text: 'Najít další' });
  const tlPrejit = el('button.ps-tlac.primarni', { type: 'button', text: 'Přejít na' });

  const ukaz = () => {
    zal.forEach((z) => z.classList.toggle('aktivni', z.dataset.z === aktivni));
    radekNajit.hidden = moznosti.hidden = tlDalsi.hidden = aktivni === 'prejit';
    radekNahr.hidden = tlNahradit.hidden = tlVse.hidden = aktivni !== 'nahradit';
    radekPrejit.hidden = tlPrejit.hidden = aktivni !== 'prejit';
    stav.textContent = '';
  };
  zalozky.onclick = (e) => { const z = e.target.dataset.z; if (z) { aktivni = z; ukaz(); } };

  const volby = () => ({ velka: velka.checked, cela: cela.checked });
  tlDalsi.onclick = () => {
    P.st.posledniHledani = najit.value;
    const nasel = P.najdiDalsi(najit.value, volby());
    stav.textContent = nasel ? '' : 'AstroPísmo prohledalo celý dokument. Hledaná položka nebyla nalezena.';
  };
  tlNahradit.onclick = () => {
    P.st.posledniNahrazeni = nahradit.value;
    const vyb = P.dok.vybranyText;
    const shoda = volby().velka ? vyb === najit.value : vyb.toLocaleLowerCase('cs') === najit.value.toLocaleLowerCase('cs');
    if (vyb && shoda) P.prikaz(() => document.execCommand('insertText', false, nahradit.value), 'Nahradit');
    tlDalsi.click();
  };
  tlVse.onclick = () => {
    P.st.posledniNahrazeni = nahradit.value;
    const n = P.nahradVse(najit.value, nahradit.value, volby());
    zpravaP(P, `Hotovo. Počet nahrazení: ${n}.`);
  };
  tlPrejit.onclick = () => {
    const s = parseInt(prejit.value, 10);
    if (s) P.prejdiNaStranu(s);
  };

  const d = dialog(P.koren, {
    titulek: 'Najít a nahradit', sirka: 520, tlacitka: [],
    obsah: el('div', {}, zalozky, radekNajit, radekNahr, radekPrejit, moznosti, stav,
      el('div.ps-dialog-pata.vlozena', {}, tlNahradit, tlVse, tlDalsi, tlPrejit, el('button.ps-tlac', { type: 'button', text: 'Zrušit', onclick: () => d.zavri() }))),
  });
  ukaz();
}

// ---------------------------------------------------------------- vložení
export function dialogTabulka(P) {
  const s = el('input.ps-vstup', { type: 'number', value: 5, min: 1, max: 63 });
  const r = el('input.ps-vstup', { type: 'number', value: 2, min: 1, max: 200 });
  dialog(P.koren, {
    titulek: 'Vložit tabulku', sirka: 340,
    obsah: el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Velikost tabulky' }), pole('Počet sloupců:', s), pole('Počet řádků:', r)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.vlozTabulku(Math.max(1, +r.value || 2), Math.max(1, Math.min(63, +s.value || 5))) }, { text: 'Zrušit' }],
  });
}

export function dialogOdkaz(P) {
  const a = P.dok.prvekKurzoru()?.closest('a');
  const text = el('input.ps-vstup', { value: a ? a.textContent : P.dok.vybranyText });
  const adresa = el('input.ps-vstup', { value: a ? a.getAttribute('href') : '', placeholder: 'https://' });
  dialog(P.koren, {
    titulek: a ? 'Upravit hypertextový odkaz' : 'Vložit hypertextový odkaz', sirka: 480,
    obsah: el('div.ps-dlg-odkaz', {},
      el('div.ps-dlg-odkaz-bok', {}, el('button.aktivni', { type: 'button' }, ik('odkaz'), el('span', { text: 'Existující soubor nebo webová stránka' }))),
      el('div', {}, pole('Zobrazený text:', text), pole('Adresa:', adresa))),
    tlacitka: [
      {
        text: 'OK', primarni: true, akce: () => {
          let url = adresa.value.trim();
          if (!url) return false;
          if (!/^[a-z]+:/i.test(url)) url = 'https://' + url;
          P.prikaz(() => {
            if (a) { a.href = url; a.textContent = text.value || url; return; }
            const t = (text.value || url).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
            document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '%22')}">${t}</a>`);
          }, 'Hypertextový odkaz');
        },
      },
      ...(a ? [{ text: 'Odebrat odkaz', akce: () => P.prikaz(() => a.replaceWith(...a.childNodes), 'Odebrat odkaz') }] : []),
      { text: 'Zrušit' },
    ],
  });
}

export function dialogDatum(P) {
  const d = new Date();
  const moznosti = [
    d.toLocaleDateString('cs-CZ'),
    d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }),
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`,
    d.toISOString().slice(0, 10),
    d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' }),
    d.toLocaleString('cs-CZ'),
    d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
  ];
  const seznam = el('select.ps-vyber.seznam', { size: 8 }, moznosti.map((m, i) => el('option', { value: m, text: m, selected: i === 0 })));
  dialog(P.koren, {
    titulek: 'Datum a čas', sirka: 380,
    obsah: el('div', {}, el('div.ps-dlg-pozn', { text: 'Dostupné formáty:' }), seznam, pole('Jazyk:', vyberSeznam(['čeština'], 'čeština'))),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.prikaz(() => document.execCommand('insertText', false, seznam.value), 'Datum a čas') }, { text: 'Zrušit' }],
  });
  seznam.ondblclick = () => seznam.closest('.ps-dialog').querySelector('.ps-tlac.primarni').click();
}

const SYMBOLY = '€£¥©®™±≠≤≥÷×∞µαβπΩ∑√∆°§¶•…–—„“‚‘«»←↑→↓↔⇒✓✗★☆♥♦♣♠☺☼☎✉✂✈⌚⌛☀☁☂☃⚡❄♪♫¼½¾¹²³';

export function nabidkaSymbolu(P) {
  const nedavne = P.st.symboly || ['€', '£', '¥', '©', '®', '™', '±', '≠', '≤', '≥', '÷', '×', '∞', 'µ', 'α', 'β', 'π', 'Ω', '∑', '☺'];
  const vloz = (z) => {
    zavriRozbal();
    P.st.symboly = [z, ...nedavne.filter((x) => x !== z)].slice(0, 20);
    P.prikaz(() => document.execCommand('insertText', false, z), 'Symbol');
  };
  return el('div.ps-symboly', {},
    el('div.ps-symboly-mrizka', {}, nedavne.map((z) => el('button', { type: 'button', text: z, onclick: () => vloz(z) }))),
    el('div.ps-nab-sep'),
    el('button.ps-nab-polozka', { type: 'button', onclick: () => { zavriRozbal(); dialogSymbol(P, vloz); } }, el('span.ps-nab-ik', {}, 'Ω'), el('span', { text: 'Další symboly…' })));
}

function dialogSymbol(P, vloz) {
  let vybrany = null;
  const info = el('div.ps-dlg-pozn', { text: ' ' });
  const mr = el('div.ps-symboly-mrizka.velka', {}, [...SYMBOLY].map((z) => el('button', {
    type: 'button', text: z,
    onclick: (e) => {
      mr.querySelectorAll('.vybrano').forEach((x) => x.classList.remove('vybrano'));
      e.currentTarget.classList.add('vybrano');
      vybrany = z;
      info.textContent = `Kód znaku: ${z.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  z: Unicode (hex)`;
    },
    ondblclick: () => { vloz(z); },
  })));
  dialog(P.koren, {
    titulek: 'Symbol', sirka: 560,
    obsah: el('div', {}, el('div.ps-dlg-zalozky', {}, el('span.aktivni', { text: 'Symboly' }), el('span', { text: 'Speciální znaky' })),
      pole('Písmo:', vyberSeznam(['(normální text)'], '(normální text)')), mr, info),
    tlacitka: [{ text: 'Vložit', primarni: true, akce: () => { if (vybrany) vloz(vybrany); return false; } }, { text: 'Zavřít' }],
  });
}

export function dialogObrazky(P) {
  const obrazky = FS.findImages(FS.HOME).slice(0, 60);
  const mr = el('div.ps-obr-mrizka', {}, obrazky.length ? obrazky.map((c) => {
    const src = FS.imageSrc(c);
    return el('button.ps-obr-dlazdice', {
      type: 'button', title: c,
      onclick: () => { d.zavri(); P.vlozObrazek(src, null, FS.basename(c)); },
    }, el('img', { src, alt: '', loading: 'lazy' }), el('span', { text: FS.basename(c) }));
  }) : el('p', { text: 'Na disku nejsou žádné obrázky.' }));
  const d = dialog(P.koren, { titulek: 'Vložit obrázek — AstroOS', sirka: 620, obsah: mr, tlacitka: [{ text: 'Zrušit' }] });
}

const IKONY_OS = ['star', 'globe', 'music', 'image', 'mail', 'game', 'calc', 'folder', 'computer', 'wifi', 'battery', 'bell', 'lock', 'ai', 'settings', 'search', 'trash', 'send', 'download', 'key', 'chip', 'gpu', 'power', 'restart'];

export function dialogIkony(P) {
  let barva = '#0F6CBD';
  const vzor = el('input', { type: 'color', value: barva, oninput: (e) => { barva = e.target.value; mr.style.color = barva; } });
  const mr = el('div.ps-ikony-mrizka', { style: { color: barva } }, IKONY_OS.map((n) => el('button', {
    type: 'button', title: n,
    onclick: () => {
      const svg = ikonaOS(n);
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('stroke', barva);
      svg.setAttribute('width', '96');
      svg.setAttribute('height', '96');
      d.zavri();
      P.vlozObrazek('data:image/svg+xml,' + encodeURIComponent(svg.outerHTML), 96, 'Ikona ' + n);
    },
  }, ikonaOS(n))));
  const d = dialog(P.koren, { titulek: 'Vložit ikony', sirka: 520, obsah: el('div', {}, pole('Barva:', vzor), mr), tlacitka: [{ text: 'Zrušit' }] });
}

export function dialogTitulek(P) {
  const typ = vyberSeznam(['Obrázek', 'Tabulka', 'Rovnice'], 'Obrázek');
  const n = () => P.dok.ed.querySelectorAll(`.ps-titulek[data-typ="${typ.value}"]`).length + 1;
  const text = el('input.ps-vstup', { value: `Obrázek ${n()}` });
  typ.onchange = () => { text.value = `${typ.value} ${n()}`; };
  dialog(P.koren, {
    titulek: 'Titulek', sirka: 380,
    obsah: el('div', {}, pole('Titulek:', text), pole('Popisek:', typ)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.prikaz(() => document.execCommand('insertHTML', false, `<p class="ps-titulek" data-typ="${typ.value}">${text.value.replace(/[<>&]/g, '')}</p>`), 'Titulek') }, { text: 'Zrušit' }],
  });
}

export function dialogAlt(P) {
  const o = P.st.obrazek;
  if (!o) return zpravaP(P, 'Nejdřív klikněte na obrázek.');
  const t = el('textarea.ps-vstup', { rows: 4, text: o.alt || '' });
  dialog(P.koren, {
    titulek: 'Alternativní text', sirka: 380,
    obsah: el('div', {}, el('p.ps-dlg-pozn', { text: 'Jak byste tento objekt popsali někomu, kdo je nevidomý? (doporučeno 1–2 věty)' }), t),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.prikaz(() => { o.alt = t.value; }, 'Alternativní text') }, { text: 'Zrušit' }],
  });
}

// ---------------------------------------------------------------- stránka
export function dialogVodoznak(P) {
  const t = el('input.ps-vstup', { value: P.dok.nast.vodoznak || 'KONCEPT' });
  dialog(P.koren, {
    titulek: 'Vodoznak', sirka: 380,
    obsah: el('div', {}, pole('Text:', t), pole('Rozložení:', vyberSeznam([['d', 'Úhlopříčně']], 'd'))),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.nastavStranku({ vodoznak: t.value.trim() || null }, 'Vodoznak') }, { text: 'Zrušit' }],
  });
}

export function dialogVzhledStranky(P) {
  const n = P.dok.nast;
  const o = OKRAJE[n.okraje] || OKRAJE.normalni;
  const pole4 = ['t', 'b', 'l', 'r'].map((k) => el('input.ps-vstup', { value: fmt(o[k] / 10, 2) + ' cm', dataset: { k } }));
  const vel = vyberSeznam(Object.entries(VELIKOSTI).map(([id, v]) => [id, `${v.nazev} (${v.popis})`]), n.velikost);
  const naVysku = el('input', { type: 'radio', name: 'ps-or', checked: n.orientace !== 'na-sirku' });
  const naSirku = el('input', { type: 'radio', name: 'ps-or', checked: n.orientace === 'na-sirku' });
  dialog(P.koren, {
    titulek: 'Vzhled stránky', sirka: 460,
    obsah: el('div', {},
      el('div.ps-dlg-zalozky', {}, el('span.aktivni', { text: 'Okraje' }), el('span', { text: 'Papír' }), el('span', { text: 'Rozložení' })),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Okraje' }),
        el('div.ps-dlg-mrizka2', {}, pole('Nahoře:', pole4[0]), pole('Dole:', pole4[1]), pole('Vlevo:', pole4[2]), pole('Vpravo:', pole4[3]))),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Orientace' }),
        el('div.ps-dlg-radio', {}, el('label', {}, naVysku, ' Na výšku'), el('label', {}, naSirku, ' Na šířku'))),
      el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Papír' }), pole('Velikost papíru:', vel))),
    tlacitka: [
      {
        text: 'OK', primarni: true, akce: () => {
          const [t, b, l, r] = pole4.map((p) => Math.max(0, cislo(p.value) || 0) * 10);
          const shoda = Object.entries(OKRAJE).find(([, x]) => Math.abs(x.t - t) < 0.2 && Math.abs(x.b - b) < 0.2 && Math.abs(x.l - l) < 0.2 && Math.abs(x.r - r) < 0.2);
          let okraje = shoda?.[0];
          if (!okraje) { OKRAJE.vlastni = { nazev: 'Poslední vlastní nastavení', t, b, l, r }; okraje = 'vlastni'; }
          P.nastavStranku({ okraje, velikost: vel.value, orientace: naSirku.checked ? 'na-sirku' : 'na-vysku', vlastniOkraje: okraje === 'vlastni' ? { t, b, l, r } : null }, 'Vzhled stránky');
        },
      },
      { text: 'Zrušit' },
    ],
  });
}

// ---------------------------------------------------------------- zobrazení a informace
export function dialogPocetSlov(P) {
  const jenVyber = !!P.dok.vybranyText;
  const s = P.dok.statistika(jenVyber);
  const r = (k, v) => el('tr', {}, el('td', { text: k }), el('td', { text: v.toLocaleString('cs-CZ') }));
  dialog(P.koren, {
    titulek: 'Počet slov', sirka: 340,
    obsah: el('div', {}, el('div.ps-dlg-pozn', { text: jenVyber ? 'Statistika výběru:' : 'Statistika:' }),
      el('table.ps-statistika', {}, el('tbody', {}, r('Stránky', s.stranky), r('Slova', s.slova), r('Znaky (bez mezer)', s.znaky),
        r('Znaky (včetně mezer)', s.znakyMezery), r('Odstavce', s.odstavce), r('Řádky', s.radky))),
      el('label.ps-dlg-radio', {}, el('input', { type: 'checkbox', checked: true }), ' Zahrnout textová pole, poznámky pod čarou a vysvětlivky')),
    tlacitka: [{ text: 'Zavřít', primarni: true }],
  });
}

export function dialogLupa(P) {
  const akt = Math.round(P.dok.meritko * 100);
  const volby = [[200, '200 %'], [100, '100 %'], [75, '75 %'], ['sirka', 'Šířka stránky'], ['text', 'Šířka textu'], ['strana', 'Celá stránka'], ['vice', 'Více stránek']];
  let vyber = akt;
  const proc = el('input.ps-vstup', { type: 'number', value: akt, min: 10, max: 500 });
  const radia = volby.map(([v, t]) => el('label', {}, el('input', {
    type: 'radio', name: 'ps-lupa', checked: v === akt,
    onchange: () => { vyber = v; if (typeof v === 'number') proc.value = v; },
  }), ' ' + t));
  proc.oninput = () => { vyber = +proc.value; };
  dialog(P.koren, {
    titulek: 'Lupa', sirka: 360,
    obsah: el('div', {}, el('fieldset.ps-dlg-sada', {}, el('legend', { text: 'Lupa' }), el('div.ps-dlg-mrizka2', {}, radia)), pole('Procenta:', proc)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.lupa(typeof vyber === 'number' ? Math.max(10, Math.min(500, vyber)) / 100 : vyber) }, { text: 'Zrušit' }],
  });
}

export function dialogDoplnky(P) {
  const dopl = [
    ['astroai', 'AstroAI', 'Pomocník pro psaní, shrnutí a přepisování textu. Jen v plné verzi AstroOS.', true],
    ['pravopis', 'Editor', 'Kontrola pravopisu, gramatiky a upřesnění stylu.', true],
    ['prelozit', 'Překladač', 'Připravujeme.', false],
    ['obsah', 'Wikipedie', 'Připravujeme.', false],
  ];
  dialog(P.koren, {
    titulek: 'Doplňky pro AstroPísmo', sirka: 520,
    obsah: el('div.ps-doplnky', {}, dopl.map(([i, n, p, zap]) => el('div.ps-doplnek', {},
      el('div.ps-doplnek-ik', {}, ik(i)), el('div', {}, el('b', { text: n }), el('div', { text: p })),
      el('button.ps-tlac' + (zap ? '.primarni' : ''), { type: 'button', text: zap ? 'Otevřít' : 'Brzy', disabled: !zap, onclick: (e) => { e.currentTarget.closest('.ps-kryt').remove(); P.podokno(i === 'astroai' ? 'ai' : 'editor'); } })))),
    tlacitka: [{ text: 'Zavřít' }],
  });
}

export function dialogNazory(P) {
  const t = el('textarea.ps-vstup', { rows: 4, placeholder: 'Co se vám líbilo nebo co bychom měli zlepšit?' });
  dialog(P.koren, {
    titulek: 'Názory pro AstroOS', sirka: 420,
    obsah: el('div', {}, el('div.ps-nazory', {}, el('button.ps-tlac', { type: 'button', text: '🙂 Líbí se mi' }), el('button.ps-tlac', { type: 'button', text: '🙁 Nelíbí se mi' })), t),
    tlacitka: [{ text: 'Odeslat', primarni: true, akce: () => { setTimeout(() => zpravaP(P, 'Děkujeme za zpětnou vazbu!'), 50); } }, { text: 'Zrušit' }],
  });
}

export function dialogCoNoveho(P) {
  const body = [
    ['astroai', 'AstroAI v Písmu', 'Pomocník vpravo na kartě Domů shrne dokument nebo přepíše výběr.'],
    ['diktovat', 'Diktování česky', 'Klikněte na Diktovat a mluvte — text se píše sám.'],
    ['pero', 'Kreslení perem', 'Na kartě Kreslení můžete psát rukou přímo do dokumentu.'],
    ['predcitat', 'Předčítání', 'Revize → Předčítat přečte dokument nahlas.'],
  ];
  dialog(P.koren, {
    titulek: 'Co je nového', sirka: 460,
    obsah: el('div.ps-doplnky', {}, body.map(([i, n, p]) => el('div.ps-doplnek', {}, el('div.ps-doplnek-ik', {}, ik(i)), el('div', {}, el('b', { text: n }), el('div', { text: p }))))),
    tlacitka: [{ text: 'Zavřít', primarni: true }],
  });
}
