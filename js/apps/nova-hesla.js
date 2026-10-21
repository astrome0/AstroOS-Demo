// AstroOS — Nova: správce hesel (astro://hesla)
//
// Seznam uložených hesel z trezoru (js/hesla.js): hledání, zobrazení, kopírování, úpravy, mazání,
// ruční přidání s generátorem a weby, kde se heslo nenabízí („Nikdy“). Zamčený trezor se tu odemyká
// heslem účtu AstroOS.

import { el, bus, pred, plural } from '../util.js';
import { icon } from '../icons.js';
import { State } from '../state.js';
import { toast } from '../ui.js';
import { tx } from '../i18n.js';
import * as H from '../hesla.js';
import { znakWebu } from './nova-domu.js';

const PRIMO = !!window.astroElectron?.novaPrimo;

const kopiruj = (text, co) => navigator.clipboard.writeText(text)
  .then(() => toast({ title: tx(`${co} zkopírováno`, `${co} copied`), icon: 'copy', timeout: 2000 }))
  .catch(() => toast({ title: 'Kopírování se nepovedlo', icon: 'info' }));
const stop = (e) => e.stopPropagation();   // ať zkratky systému nekradou psaní

/** Pole pro heslo s okem a volitelně s generátorem. */
function poleHesla(hodnota = '', { generator = false, placeholder = 'Heslo' } = {}) {
  const vstup = el('input.nh-pole', { type: 'password', value: hodnota, placeholder, spellcheck: 'false', autocomplete: 'off', onkeydown: stop });
  const oko = el('button.nh-ikona', { type: 'button', title: tx('Zobrazit heslo', 'Show password') }, icon('eye'));
  oko.onclick = () => {
    const ukaz = vstup.type === 'password';
    vstup.type = ukaz ? 'text' : 'password';
    oko.replaceChildren(icon(ukaz ? 'eyeOff' : 'eye'));
  };
  const gen = generator ? el('button.nh-ikona', { type: 'button', title: tx('Vygenerovat silné heslo', 'Generate a strong password') }, icon('refresh')) : null;
  if (gen) gen.onclick = () => { vstup.value = H.vygeneruj(); vstup.type = 'text'; oko.replaceChildren(icon('eyeOff')); };
  return { obal: el('div.nh-heslo-pole', {}, vstup, oko, gen), vstup };
}

export function strankaHesla(ctx, arg) {
  const koren = el('div.nb-str.nh');
  let hledat = arg.dotaz || '';
  let pridavam = false;
  let upravuji = null;          // id položky ve formuláři
  const ukazana = new Set();    // id položek se zobrazeným heslem
  let mazu = null;              // id čekající na potvrzení smazání

  function kresli() {
    const hlava = el('div.nh-hlava', {},
      el('div', {},
        el('h2.nb-nadpis', { text: 'Hesla' }),
        el('p.nh-pod', { text: 'Šifrovaná heslem tvého účtu AstroOS (AES-256). Odemknou se, když se přihlásíš heslem.' })),
      H.odemceno() ? el('button.nh-tl.nh-tl-hlavni', { type: 'button', onclick: () => { pridavam = true; upravuji = null; kresli(); } }, icon('plus'), el('span', { text: 'Přidat heslo' })) : null);
    koren.replaceChildren(hlava);

    if (!PRIMO) {
      koren.append(el('p.nh-info', {}, icon('info'),
        el('span', { text: 'Ukládání a vyplňování přímo ve webech funguje v aplikaci AstroOS. Tady je můžeš spravovat ručně.' })));
    }

    if (!H.odemceno()) return koren.append(zamceno());

    if (pridavam) koren.append(formular(null));

    const vse = H.seznam();
    const opakovanych = vse.filter((p) => H.opakovane(p.heslo)).length;

    const hledani = el('input.nh-hledat', { placeholder: 'Hledat web nebo jméno', value: hledat, spellcheck: 'false', onkeydown: stop });
    hledani.oninput = () => { hledat = hledani.value; kresliSeznam(); };
    const seznamEl = el('div.nh-seznam');
    koren.append(
      el('div.nh-lista', {},
        el('div.nh-hledat-obal', {}, icon('search'), hledani),
        el('span.nh-pocet', { text: plural(vse.length, ['heslo', 'hesla', 'hesel']) }),
        opakovanych ? el('span.nh-varovani', {}, icon('shieldAlert'), el('span', { text: tx(`${opakovanych} použitých víckrát`, `${opakovanych} reused`) })) : null),
      seznamEl);

    function kresliSeznam() {
      const q2 = hledat.trim().toLowerCase();
      const polozky = q2 ? vse.filter((p) => p.web.toLowerCase().includes(q2) || p.jmeno.toLowerCase().includes(q2)) : vse;
      if (!vse.length) {
        return seznamEl.replaceChildren(el('div.nh-prazdno', {}, icon('key'),
          el('b', { text: 'Zatím žádná hesla' }),
          el('span', { text: PRIMO ? 'Když se na webu přihlásíš, Nova nabídne heslo uložit.' : 'Přidej heslo tlačítkem nahoře.' })));
      }
      if (!polozky.length) return seznamEl.replaceChildren(el('p.nb-nic', { text: 'Nic takového tu není.' }));
      seznamEl.replaceChildren(...polozky.map((p) => (upravuji === p.id ? formular(p) : radek(p))));
    }
    kresliSeznam();
    if (!arg.dotaz) setTimeout(() => hledani.focus({ preventScroll: true }), 60);

    const nikdy = H.seznamNikdy();
    if (nikdy.length) {
      koren.append(el('div.nb-sekce', {},
        el('h3', { text: 'Nikdy neukládat pro' }),
        el('div.nh-nikdy', {}, nikdy.map((h) => el('span.nh-cip', {}, el('span', { text: h, 'data-no-i18n': true }),
          el('button', { type: 'button', title: tx('Odebrat', 'Remove'), onclick: () => H.nastavNikdy(h, false) }, icon('x')))))));
    }
    return koren;
  }

  function radek(p) {
    const vidim = ukazana.has(p.id);
    const heslo = el('span.nh-heslo' + (vidim ? '.vidim' : ''), { text: vidim ? p.heslo : '••••••••••', 'data-no-i18n': true });
    const oko = el('button.nh-ikona', { type: 'button', title: vidim ? tx('Skrýt heslo', 'Hide password') : tx('Zobrazit heslo', 'Show password') }, icon(vidim ? 'eyeOff' : 'eye'));
    oko.onclick = () => { if (vidim) ukazana.delete(p.id); else ukazana.add(p.id); kresli(); };
    const smazat = el('button.nh-ikona.nh-smazat' + (mazu === p.id ? '.potvrdit' : ''), { type: 'button', title: mazu === p.id ? tx('Klikni znovu pro smazání', 'Click again to delete') : tx('Smazat', 'Delete') },
      icon('trash'), mazu === p.id ? el('span', { text: 'Smazat?' }) : null);
    smazat.onclick = async () => {
      if (mazu !== p.id) { mazu = p.id; return kresli(); }
      mazu = null;
      await H.smaz(p.id);
      toast({ title: 'Heslo smazáno', body: `${p.jmeno || p.web}`, icon: 'trash' });
    };
    return el('div.nh-radek', {},
      znakWebu('https://' + p.web, null, 'nh-fav'),
      el('div.nh-kdo', { 'data-no-i18n': true },
        el('b', { text: p.web }),
        el('span', { text: p.jmeno || tx('(bez jména)', '(no username)') })),
      el('div.nh-heslo-misto', {}, heslo, oko,
        H.opakovane(p.heslo) ? el('span.nh-znacka', { title: tx('Stejné heslo máš i u jiného webu', 'You use this password on another site too') }, icon('shieldAlert')) : null),
      el('span.nh-cas', { text: p.zmeneno ? pred(p.zmeneno) : '' }),
      el('div.nh-akce', {},
        p.jmeno ? el('button.nh-ikona', { type: 'button', title: tx('Kopírovat jméno', 'Copy username'), onclick: () => kopiruj(p.jmeno, tx('Jméno', 'Username')) }, icon('user')) : null,
        el('button.nh-ikona', { type: 'button', title: tx('Kopírovat heslo', 'Copy password'), onclick: () => kopiruj(p.heslo, tx('Heslo', 'Password')) }, icon('copy')),
        el('button.nh-ikona', { type: 'button', title: tx('Upravit', 'Edit'), onclick: () => { upravuji = p.id; pridavam = false; kresli(); } }, icon('pencil')),
        el('button.nh-ikona', { type: 'button', title: tx('Otevřít web', 'Open site'), onclick: () => ctx.novyTab?.(p.url || 'https://' + p.web) }, icon('globe')),
        smazat));
  }

  /** Formulář pro nové heslo (p = null) nebo úpravu. */
  function formular(p) {
    const web = el('input.nh-pole', { value: p ? (p.url || p.web) : '', placeholder: 'Web, třeba github.com', spellcheck: 'false', onkeydown: stop });
    const jmeno = el('input.nh-pole', { value: p?.jmeno || '', placeholder: 'Jméno nebo e-mail', spellcheck: 'false', autocomplete: 'off', onkeydown: stop });
    const { obal, vstup: heslo } = poleHesla(p?.heslo || '', { generator: true });
    const chyba = el('p.nh-chyba');
    const zrusit = () => { pridavam = false; upravuji = null; kresli(); };
    const ulozit = async () => {
      let url = web.value.trim();
      if (!url) { chyba.textContent = 'Napiš adresu webu.'; return web.focus(); }
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (!H.hostZ(url).includes('.') && !/localhost/.test(url)) { chyba.textContent = 'Tohle nevypadá jako adresa webu.'; return web.focus(); }
      if (!heslo.value) { chyba.textContent = 'Heslo nesmí být prázdné.'; return heslo.focus(); }
      if (p) await H.uprav(p.id, { url, web: H.hostZ(url), jmeno: jmeno.value.trim(), heslo: heslo.value });
      else await H.ulozHeslo({ url, jmeno: jmeno.value.trim(), heslo: heslo.value });
      pridavam = false; upravuji = null;
      toast({ title: p ? 'Heslo upraveno' : 'Heslo uloženo', body: H.hostZ(url), icon: 'key' });
      kresli();
    };
    for (const x of [web, jmeno, heslo]) x.addEventListener('keydown', (e) => { if (e.key === 'Enter') ulozit(); if (e.key === 'Escape') zrusit(); });
    setTimeout(() => (p ? heslo : web).focus(), 40);
    return el('div.nh-formular', {},
      el('b', { text: p ? 'Upravit heslo' : 'Nové heslo' }),
      el('div.nh-formular-pole', {},
        el('label', {}, el('span', { text: 'Web' }), web),
        el('label', {}, el('span', { text: 'Jméno' }), jmeno),
        el('label', {}, el('span', { text: 'Heslo' }), obal)),
      chyba,
      el('div.nh-formular-tl', {},
        el('button.nh-tl', { type: 'button', text: 'Zrušit', onclick: zrusit }),
        el('button.nh-tl.nh-tl-hlavni', { type: 'button', text: 'Uložit', onclick: ulozit })));
  }

  function zamceno() {
    const bezHesla = !State.get('user')?.password;
    const { obal, vstup } = poleHesla('', { placeholder: 'Heslo účtu AstroOS' });
    const chyba = el('p.nh-chyba');
    const odemkni = async () => {
      if (State.get('user')?.password !== vstup.value) {
        chyba.textContent = 'Heslo účtu nesedí.';
        vstup.select();
        return;
      }
      if (!(await H.odemkni(vstup.value))) chyba.textContent = 'Trezor je zašifrovaný jiným heslem (třeba po obnovení nastavení).';
    };
    vstup.addEventListener('keydown', (e) => { if (e.key === 'Enter') odemkni(); });
    if (bezHesla) H.odemkni('');   // účet bez hesla: odemkne se hned (a ozve se hesla:zmena)
    setTimeout(() => vstup.focus(), 60);
    return el('div.nh-zamek', {},
      el('div.nh-zamek-ic', {}, icon('lock')),
      el('b', { text: 'Hesla jsou zamčená' }),
      el('span', { text: 'Přihlásil ses PINem nebo se obrazovka zamkla. Odemkni je heslem účtu AstroOS.' }),
      el('div.nh-zamek-radek', {}, obal, el('button.nh-tl.nh-tl-hlavni', { type: 'button', text: 'Odemknout', onclick: odemkni })),
      chyba);
  }

  const off = bus.on('hesla:zmena', () => { if (koren.isConnected) kresli(); else off(); });
  ctx.signal?.addEventListener('abort', off);
  return kresli();
}
