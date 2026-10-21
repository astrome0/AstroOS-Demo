// AstroOS — Astro Defender (okno ve stylu Zabezpečení Windows)
//
// Jádro (kontroly, karanténa, ochrana v reálném čase, firewall, SmartScreen) je v js/obrana.js
// a běží i bez otevřeného okna. Tady je jen rozhraní: přehled, stránky oblastí, historie
// a dialog „Kontrola uživatelských účtů“ pro změny, které snižují zabezpečení.

import { el, bus, plural, cz, pad } from '../util.js';
import { icon } from '../icons.js';
import { State } from '../state.js';
import * as FS from '../fs.js';
import { toast } from '../ui.js';
import { APPS, openApp } from '../apps.js';
import * as O from '../obrana.js';
import { WEBAPLIKACE } from '../webaplikace.js';
import { popis as popisSite } from '../sit.js';

const NAV = [
  ['domu', 'Domů', 'home'],
  ['viry', 'Ochrana před viry a hrozbami', 'shield'],
  ['ucet', 'Ochrana účtu', 'user'],
  ['firewall', 'Brána firewall a ochrana sítě', 'wall'],
  ['aplikace', 'Řízení aplikací a prohlížeče', 'grid'],
  ['zarizeni', 'Zabezpečení zařízení', 'chip'],
  ['vykon', 'Výkon a stav zařízení', 'heart'],
  ['historie', 'Historie ochrany', 'clock'],
];
const RODIC = { moznosti: 'viry', nastaveni: 'viry', vylouceni: 'viry', cfa: 'viry', povolene: 'viry' };

const OBLASTI = [
  ['viry', 'Ochrana před viry a hrozbami', 'shield'],
  ['ucet', 'Ochrana účtu', 'user'],
  ['firewall', 'Brána firewall a ochrana sítě', 'wall'],
  ['aplikace', 'Řízení aplikací a prohlížeče', 'grid'],
  ['zarizeni', 'Zabezpečení zařízení', 'chip'],
  ['vykon', 'Výkon a stav zařízení', 'heart'],
];

const PROFILY = [
  ['domena', 'Doménová síť', 'Pracovní síť, ke které se AstroOS nepřipojuje.'],
  ['soukroma', 'Privátní síť', 'Domácí síť, ve které důvěřuješ ostatním zařízením.'],
  ['verejna', 'Veřejná síť', 'Síť na veřejném místě, třeba v kavárně nebo ve škole.'],
];

const FIREWALL_APPS = [['browser', 'Nova Prohlížeč'], ['weather', 'Počasí'], ...WEBAPLIKACE.map((a) => [a.id, a.name])];

let cekaRestart = false;          // integrita paměti se „projeví po restartu“

const datum = (ts) => `${cz.datumKratky(new Date(ts))} ${cz.cas(new Date(ts))}`;
const zavaznostChip = (z) => z ? el('span.df-chip.' + z, { text: O.ZAVAZNOST[z].nazev }) : null;

function znak(uroven) {
  const ic = uroven === 'ok' ? 'check' : uroven === 'kriticke' ? 'x' : 'info';
  return el('span.df-znak.' + uroven, {}, icon(ic));
}

/** Velký štít pro přehled — barva podle stavu, při kontrole kolem něj běží oblouk. */
function stit(uroven, skenuje) {
  const barvy = { ok: ['#4fd07f', '#1f8a48'], varovani: ['#f5c164', '#c47f26'], kriticke: ['#f27a6a', '#b3352a'] }[uroven];
  const znakCesta = uroven === 'ok' ? 'M37 50l9 9 17-18' : uroven === 'varovani' ? 'M50 36v18M50 64v1' : 'M40 40l20 20M60 40L40 60';
  const box = el('div.df-stit' + (skenuje ? '.skenuje' : ''));
  box.innerHTML = `
    <svg viewBox="0 0 100 100">
      <defs><linearGradient id="dfs-${uroven}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${barvy[0]}"/><stop offset="1" stop-color="${barvy[1]}"/></linearGradient></defs>
      <circle class="df-stit-krouzek" cx="50" cy="50" r="47" fill="none" stroke="${barvy[0]}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M50 14 78 24v22c0 17-12 29-28 35-16-6-28-18-28-35V24z" fill="url(#dfs-${uroven})"/>
      <path d="M50 14 78 24v22c0 17-12 29-28 35z" fill="#fff" fill-opacity=".1"/>
      <path d="${znakCesta}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  return box;
}

function prepinac(zapnuto, zmen, { citlive = false, co = '', texty = ['Zapnuto', 'Vypnuto'] } = {}) {
  const sw = el('button.df-prepinac', { role: 'switch', 'aria-checked': String(zapnuto) },
    el('span.switch' + (zapnuto ? '.on' : '')), el('span', { text: zapnuto ? texty[0] : texty[1] }));
  sw.onclick = async () => {
    if (zapnuto && citlive && !(await uac(co))) return;
    zmen(!zapnuto);
  };
  return sw;
}

const odkaz = (text, fn) => el('button.df-odkaz', { onclick: fn }, el('span', { text }));

function sekce(nadpis, ...obsah) {
  return el('section.df-sekce', {}, nadpis ? el('h2', { text: nadpis }) : null, ...obsah);
}

function hlavicka(ic, nadpis, popis) {
  return el('header.df-hlava', {}, el('div.df-hlava-ic', {}, icon(ic)),
    el('div', {}, el('h1', { text: nadpis }), popis ? el('p', { text: popis }) : null));
}

function nastaveniRadek(nadpis, popis, ovladac, varovani) {
  return el('div.df-volba' + (varovani ? '.varovani' : ''), {},
    el('div.df-volba-text', {},
      el('h3', {}, varovani ? znak('kriticke') : null, el('span', { text: nadpis })),
      el('p', { text: popis }),
      varovani ? el('p.df-volba-var', { text: varovani }) : null),
    ovladac);
}

// ---------------------------------------------------------------- dialogy
function modal(obsah, zavrit) {
  const zaves = el('div.df-zaves', {}, obsah);
  document.getElementById('overlay').append(zaves);
  const klavesy = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') zavrit(false);
  };
  zaves.addEventListener('keydown', klavesy);
  return zaves;
}

/** „Kontrola uživatelských účtů“. S ochranou proti neoprávněným změnám chce heslo. */
export function uac(co) {
  const heslem = O.nastaveni().tamper;
  return new Promise((hotovo) => {
    const pole = el('input.df-pole', { type: 'password', placeholder: 'Heslo', autocomplete: 'off' });
    const chyba = el('p.df-uac-chyba');
    const karta = el('div.df-uac', {},
      el('div.df-uac-pruh', { text: 'Kontrola uživatelských účtů' }),
      el('div.df-uac-telo', {},
        el('h3', { text: 'Chcete této aplikaci povolit provádět změny ve vašem zařízení?' }),
        el('div.df-uac-app', {},
          el('div.df-uac-glyph', {}, icon('shield')),
          el('div', {}, el('b', { text: 'Astro Defender' }), el('span', { text: 'Ověřený vydavatel: AstroOS' }))),
        co ? el('p.df-uac-co', { text: co }) : null,
        heslem ? el('div.df-uac-heslo', {},
          el('p', { text: `Pokračuj zadáním hesla účtu ${State.get('user').name}.` }), pole, chyba) : null),
      el('div.df-uac-tlacitka', {},
        el('button.btn.primary', { text: 'Ano', onclick: () => potvrd() }),
        el('button.btn', { text: 'Ne', onclick: () => zavri(false) })));

    const zavri = (v) => { zaves.remove(); hotovo(v); };
    const potvrd = () => {
      if (heslem && pole.value !== State.get('user').password) {
        chyba.textContent = 'Heslo není správné.';
        karta.classList.remove('tres');
        void karta.offsetWidth;
        karta.classList.add('tres');
        pole.select();
        return;
      }
      zavri(true);
    };
    const zaves = modal(karta, zavri);
    zaves.addEventListener('keydown', (e) => { if (e.key === 'Enter') potvrd(); });
    setTimeout(() => (heslem ? pole : karta.querySelector('.btn.primary')).focus(), 30);
  });
}

function potvrzeni(nadpis, text, ano = 'Pokračovat') {
  return new Promise((hotovo) => {
    const karta = el('div.df-uac.df-potvrzeni', {},
      el('div.df-uac-telo', {}, el('h3', { text: nadpis }), el('p.df-uac-co', { text })),
      el('div.df-uac-tlacitka', {},
        el('button.btn.primary', { text: ano, onclick: () => zavri(true) }),
        el('button.btn', { text: 'Zrušit', onclick: () => zavri(false) })));
    const zavri = (v) => { zaves.remove(); hotovo(v); };
    const zaves = modal(karta, zavri);
    setTimeout(() => karta.querySelector('.btn.primary').focus(), 30);
  });
}

// ---------------------------------------------------------------- kontrola offline
async function kontrolaOffline() {
  const ok = await potvrzeni('Kontrola Astro Defender offline',
    'Ulož si rozdělanou práci. Systém se restartuje, zkontroluje celý disk ještě před přihlášením, hrozby dá rovnou do karantény a znovu nastartuje.',
    'Zkontrolovat');
  if (!ok) return;

  const pocet = el('span'), cesta = el('div.df-off-cesta'), pruh = el('i'), stav = el('p', { text: 'Restartování…' });
  const obrazovka = el('div.df-offline', {},
    el('div.df-off-okno', {},
      el('div.df-off-titul', {}, icon('shield'), el('span', { text: 'Astro Defender offline' })),
      stav, el('div.df-off-pruh', {}, pruh), el('div.df-off-info', {}, pocet), cesta,
      el('p.df-off-pozn', { text: 'Nevypínej počítač. Po dokončení se systém sám restartuje.' })));
  document.body.append(obrazovka);
  await new Promise((r) => setTimeout(r, 1400));
  obrazovka.classList.add('bezi');
  stav.textContent = 'Kontroluje se zařízení…';

  const off = bus.on('obrana:prubeh', (b) => {
    if (!b) return;
    pruh.style.width = (b.celkem ? (b.hotovo / b.celkem) * 100 : 0) + '%';
    pocet.textContent = `Zkontrolováno položek: ${b.hotovo.toLocaleString('cs')} · nalezeno hrozeb: ${b.nalezeno.length}`;
    cesta.textContent = b.aktualni;
  });
  const vysledek = await O.spustKontrolu('offline');
  off();
  pruh.style.width = '100%';
  cesta.textContent = '';
  stav.textContent = vysledek.nalezeno.length
    ? `Hotovo. ${plural(vysledek.nalezeno.length, ['hrozba je', 'hrozby jsou', 'hrozeb je'])} v karanténě. Restartuji…`
    : 'Hotovo. Nebyly nalezeny žádné hrozby. Restartuji…';
  await new Promise((r) => setTimeout(r, 2600));
  bus.emit('power', 'restart');
  setTimeout(() => obrazovka.remove(), 700);
}

// ---------------------------------------------------------------- průběh kontroly
function kartaPrubehu(b, kompaktni = false) {
  const r = {
    nadpis: el('h3'), pruh: el('i'), hotovo: el('span'), zbyva: el('span'), nalezeno: el('span'), cesta: el('div.df-pr-cesta'),
  };
  const k = el('div.df-prubeh' + (kompaktni ? '.kompakt' : ''), {},
    el('div.df-pr-hlava', {}, el('span.df-toc'), r.nadpis),
    el('div.df-pr-pruh', {}, r.pruh),
    el('div.df-pr-cisla', {}, r.hotovo, r.zbyva, r.nalezeno),
    kompaktni ? null : r.cesta,
    kompaktni ? null : el('div.df-pr-akce', {}, el('button.btn', { text: 'Zrušit', onclick: () => O.zrusKontrolu() })));
  k._r = r;
  aktualizujPrubeh(k, b);
  return k;
}

function aktualizujPrubeh(k, b) {
  const { nadpis, pruh, hotovo, zbyva, nalezeno, cesta } = k._r;
  nadpis.textContent = `Probíhá ${O.TYPY[b.typ].nazev.toLowerCase()}…`;
  pruh.style.width = (b.celkem ? (b.hotovo / b.celkem) * 100 : 2) + '%';
  hotovo.textContent = `Zkontrolováno souborů: ${b.hotovo.toLocaleString('cs')}`;
  const ubehlo = Date.now() - b.start;
  const zbyvaMs = b.hotovo ? (ubehlo / b.hotovo) * (b.celkem - b.hotovo) : 0;
  const s = Math.ceil(zbyvaMs / 1000);
  zbyva.textContent = `Odhad zbývajícího času: ${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  nalezeno.textContent = `Nalezené hrozby: ${b.nalezeno.length}`;
  nalezeno.classList.toggle('pozor', b.nalezeno.length > 0);
  cesta.textContent = b.aktualni;
}

// ---------------------------------------------------------------- síla hesla
function silaHesla(h) {
  let body = 0;
  if (h.length >= 8) body++;
  if (h.length >= 12) body++;
  if (/\d/.test(h) && /[a-zá-ž]/i.test(h)) body++;
  if (/[A-ZÁ-Ž]/.test(h) && /[a-zá-ž]/.test(h)) body++;
  if (/[^\p{L}\d]/u.test(h)) body++;
  return body <= 1 ? ['Slabé', 'kriticke', 25] : body <= 3 ? ['Střední', 'varovani', 60] : ['Silné', 'ok', 100];
}

// ---------------------------------------------------------------- aplikace
export const defenderApp = {
  id: 'defender', name: 'Astro Defender', icon: 'shield', color: 'linear-gradient(145deg,#4a9be8,#1f5aa8)',
  cat: 'system', width: 1000, height: 680,

  mount(body, win) {
    const st = {
      stranka: win.opts?.stranka || 'domu',
      rozbaleno: new Set(),
      filtr: 'vse',
      typKontroly: 'rychla',
      vlastniCesta: FS.HOME,
      akce: {},
      aktualizuji: false,
      bezi: !!O.probihajici(),
    };
    const d = O.nastaveni;

    const nav = el('nav.df-nav');
    const obsah = el('div.df-obsah');
    body.append(el('div.df', {}, nav, obsah));

    const jdi = (s) => { st.stranka = s; obsah.scrollTop = 0; kresli(); };
    win.jdi = jdi;

    // ---------- navigace ----------
    function kresliNav() {
      const oblasti = O.stavOblasti();
      const aktivni = RODIC[st.stranka] || st.stranka;
      nav.replaceChildren(
        el('div.df-znacka', {}, el('div.df-znacka-ic', {}, icon('shield')), el('span', { text: 'Astro Defender' })),
        ...NAV.map(([id, nazev, ic]) => {
          const u = oblasti[id]?.uroven;
          return el('button.df-nav-i' + (aktivni === id ? '.on' : ''), { title: nazev, onclick: () => jdi(id) },
            icon(ic), el('span', { text: nazev }), u && u !== 'ok' ? el('b.df-tecka.' + u) : null);
        }),
      );
    }

    // ---------- stránky ----------
    const STRANKY = {
      domu() {
        const oblasti = O.stavOblasti();
        const cel = O.celkovyStav();
        const b = O.probihajici();
        const pk = d().posledniKontrola;
        const nadpis = { ok: 'Zařízení je chráněné', varovani: 'Doporučujeme pár akcí', kriticke: 'Zařízení je ohrožené' }[cel];
        return el('div.df-stranka', {},
          el('div.df-hero.' + cel, {},
            stit(cel, !!b),
            el('div.df-hero-text', {},
              el('h1', { text: b ? 'Probíhá kontrola…' : nadpis }),
              el('p', { text: 'Zabezpečení na první pohled. Podívej se, co se děje s ochranou a stavem zařízení, a proveď potřebné akce.' }),
              b ? kartaPrubehu(b, true) : el('div.df-hero-akce', {},
                el('button.btn.primary', { onclick: () => O.spustKontrolu('rychla') }, icon('radar'), el('span', { text: 'Rychlá kontrola' })),
                el('span.df-mdl', { text: pk ? `Poslední kontrola ${datum(pk.cas)}` : 'Zatím neproběhla žádná kontrola' })))),
          el('div.df-dlazdice-mrizka', {}, OBLASTI.map(([id, nazev, ic]) => {
            const o = oblasti[id];
            return el('button.df-dlazdice.' + o.uroven, { onclick: () => jdi(id) },
              el('div.df-dl-ic', {}, icon(ic), znak(o.uroven)),
              el('h3', { text: nazev }),
              el('p', { text: o.text }));
          })),
        );
      },

      viry() {
        const n = d();
        const b = O.probihajici();
        const pk = n.posledniKontrola;
        const aktualni = Date.now() - n.definice < 3 * 864e5;

        let hrozby;
        if (b) hrozby = kartaPrubehu(b);
        else if (n.hrozby.length) hrozby = seznamHrozeb();
        else {
          hrozby = el('div.df-karta.df-cisto', {},
            el('div.df-cisto-hlava', {}, znak('ok'), el('b', { text: 'Žádné aktuální hrozby.' })),
            pk ? el('div.df-fakta', {},
              el('span', { text: `Poslední kontrola: ${datum(pk.cas)} (${O.TYPY[pk.typ].nazev.toLowerCase()})` }),
              el('span', { text: `Nalezené hrozby: ${pk.nalezeno}` }),
              el('span', { text: `Kontrola trvala ${O.trvaniText(pk.trvani)}` }),
              el('span', { text: `Zkontrolováno souborů: ${pk.souboru.toLocaleString('cs')}` }))
              : el('p.df-mdl', { text: 'Zatím neproběhla žádná kontrola.' }));
        }

        return el('div.df-stranka', {},
          hlavicka('shield', 'Ochrana před viry a hrozbami', 'Ochrana zařízení před hrozbami.'),
          sekce('Aktuální hrozby', hrozby,
            el('div.df-radek-akci', {},
              el('button.btn.primary', { disabled: !!b, onclick: () => O.spustKontrolu('rychla') }, icon('radar'), el('span', { text: 'Rychlá kontrola' })),
              odkaz('Možnosti kontroly', () => jdi('moznosti')),
              odkaz('Povolené hrozby', () => jdi('povolene')),
              odkaz('Historie ochrany', () => jdi('historie')))),
          sekce('Nastavení ochrany před viry a hrozbami',
            n.rt ? el('p.df-mdl', { text: 'Nevyžaduje se žádná akce.' })
              : el('div.df-upozorneni.kriticke', {}, znak('kriticke'),
                el('div', {}, el('b', { text: 'Ochrana v reálném čase je vypnutá' }),
                  el('p', { text: 'Zařízení je teď zranitelné. Ochrana se po 15 minutách zapne sama.' })),
                el('button.btn.primary', { text: 'Zapnout', onclick: () => O.nastav('rt', true) })),
            odkaz('Spravovat nastavení', () => jdi('nastaveni'))),
          sekce('Aktualizace ochrany před viry a hrozbami',
            el('p.df-mdl', { text: aktualni ? 'Informace o zabezpečení jsou aktuální.' : 'Definice hrozeb jsou zastaralé.' }),
            el('div.df-fakta', {},
              el('span', { text: `Verze definic: ${O.verzeDefinic()}` }),
              el('span', { text: `Poslední aktualizace: ${datum(n.definice)}` })),
            el('button.btn' + (st.aktualizuji ? '.df-nacita' : ''), {
              disabled: st.aktualizuji,
              onclick: async () => {
                st.aktualizuji = true; kresli();
                await O.aktualizujDefinice();
                st.aktualizuji = false; kresli();
                toast({ title: 'Ochrana je aktuální', body: `Astro Defender · definice ${O.verzeDefinic()}`, icon: 'shield' });
              },
            }, st.aktualizuji ? el('span.df-toc') : icon('refresh'), el('span', { text: st.aktualizuji ? 'Hledám aktualizace…' : 'Vyhledat aktualizace' }))),
          sekce('Ochrana před ransomwarem',
            el('p.df-mdl', { text: `Řízený přístup ke složkám: ${n.cfa ? 'zapnuto' : 'vypnuto'}` }),
            odkaz('Spravovat ochranu před ransomwarem', () => jdi('cfa'))),
          n.karantena.length ? sekce('Karanténa',
            el('p.df-mdl', { text: `V karanténě je ${plural(n.karantena.length, ['soubor', 'soubory', 'souborů'])}. Nedají se otevřít ani spustit.` }),
            odkaz('Zobrazit v historii ochrany', () => { st.filtr = 'karantena'; jdi('historie'); })) : null,
        );
      },

      moznosti() {
        const volby = [
          ['rychla', 'Rychlá kontrola', 'Zkontroluje místa, kde se hrozby vyskytují nejčastěji: Plocha, Stažené, Aplikace, dočasné soubory, spuštěné aplikace a načtené soubory systému.'],
          ['uplna', 'Úplná kontrola', 'Zkontroluje všechny soubory na disku, nastavení systému i spuštěné aplikace. Trvá déle.'],
          ['vlastni', 'Vlastní kontrola', 'Vyber, kterou složku nebo soubor chceš zkontrolovat.'],
          ['offline', 'Kontrola Astro Defender offline', 'Některé hrozby se za běhu odstraňují špatně. Systém se restartuje, zkontroluje disk ještě před přihlášením a hrozby rovnou dá do karantény.'],
        ];
        const pole = el('input.df-pole', { value: st.vlastniCesta, spellcheck: 'false' });
        pole.addEventListener('keydown', (e) => e.stopPropagation());
        pole.oninput = () => { st.vlastniCesta = pole.value; };
        const b = O.probihajici();

        return el('div.df-stranka', {},
          zpet('viry', 'Ochrana před viry a hrozbami'),
          hlavicka('radar', 'Možnosti kontroly', 'Spusť rychlou, úplnou, vlastní nebo offline kontrolu.'),
          b ? kartaPrubehu(b) : null,
          el('div.df-karta.df-volby', {}, volby.map(([id, nazev, popis]) => el('label.df-radio' + (st.typKontroly === id ? '.on' : ''), {},
            el('input', { type: 'radio', name: 'df-typ', checked: st.typKontroly === id, onchange: () => { st.typKontroly = id; kresli(); } }),
            el('div', {}, el('b', { text: nazev }), el('p', { text: popis }),
              id === 'vlastni' && st.typKontroly === 'vlastni' ? el('div.df-vlastni', {}, pole,
                el('div.df-chipy', {}, ['', '/Dokumenty', '/Stažené', '/Aplikace', '/projekty'].map((s) => el('button.df-chip.volba', {
                  text: s ? s.slice(1) : 'Domov',
                  onclick: (e) => { e.preventDefault(); st.vlastniCesta = FS.HOME + s; kresli(); },
                })))) : null)))),
          el('button.btn.primary.df-velke', {
            disabled: !!b,
            onclick: () => {
              if (st.typKontroly === 'offline') return kontrolaOffline();
              if (st.typKontroly === 'vlastni') {
                const cesta = FS.normalize(st.vlastniCesta.trim().replace(/^~/, FS.HOME));
                if (!FS.exists(cesta)) return toast({ title: 'Cesta neexistuje', body: cesta, icon: 'info' });
                O.spustKontrolu('vlastni', { cesta });
              } else O.spustKontrolu(st.typKontroly);
              jdi('viry');
            },
          }, el('span', { text: 'Zkontrolovat nyní' })),
        );
      },

      nastaveni() {
        const n = d();
        return el('div.df-stranka', {},
          zpet('viry', 'Ochrana před viry a hrozbami'),
          hlavicka('settings', 'Nastavení ochrany před viry a hrozbami', 'Zobraz a aktualizuj nastavení ochrany.'),
          el('div.df-karta', {},
            nastaveniRadek('Ochrana v reálném čase',
              'Hlídá každý uložený, zkopírovaný nebo přesunutý soubor a hrozby hned dá do karantény. Vypnout jde jen na chvíli — po 15 minutách se zapne sama.',
              prepinac(n.rt, (v) => O.nastav('rt', v), { citlive: true, co: 'Vypnout ochranu v reálném čase' }),
              n.rt ? null : 'Ochrana v reálném čase je vypnutá, zařízení je zranitelné.'),
            nastaveniRadek('Cloudová ochrana',
              'Rozšířená pravidla (v názvu mají „!ml“) poznají i nové hrozby, třeba podvodné přihlašovací stránky.',
              prepinac(n.cloud, (v) => O.nastav('cloud', v), { citlive: true, co: 'Vypnout cloudovou ochranu' }),
              n.cloud ? null : 'Cloudová ochrana je vypnutá.'),
            nastaveniRadek('Automatické odesílání vzorků',
              'Ve Windows posílá podezřelé soubory k rozboru. AstroOS nikam nic neposílá — přepínač je tu jen pro úplnost.',
              prepinac(n.vzorky, (v) => O.nastav('vzorky', v))),
            nastaveniRadek('Ochrana proti neoprávněným změnám',
              'Když je zapnutá, vypnutí jakékoli ochrany chce heslo účtu. Bez ní stačí potvrdit.',
              prepinac(n.tamper, (v) => O.nastav('tamper', v), { citlive: true, co: 'Vypnout ochranu proti neoprávněným změnám' }))),
          sekce('Řízený přístup ke složkám',
            el('p.df-mdl', { text: 'Chrání dokumenty, obrázky a další složky před změnami od nedůvěryhodných aplikací.' }),
            odkaz('Spravovat řízený přístup ke složkám', () => jdi('cfa'))),
          sekce('Vyloučení',
            el('p.df-mdl', { text: 'Položky, které kontroly ani ochrana v reálném čase nebudou zkoumat.' }),
            odkaz('Přidat nebo odebrat vyloučení', () => jdi('vylouceni'))),
        );
      },

      vylouceni() {
        const n = d();
        const pole = el('input.df-pole', { placeholder: '~/projekty/pokusy', spellcheck: 'false' });
        pole.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') pridej(); });
        async function pridej() {
          const cesta = FS.normalize(pole.value.trim().replace(/^~/, FS.HOME));
          if (!pole.value.trim() || !FS.exists(cesta)) return toast({ title: 'Cesta neexistuje', body: cesta, icon: 'info' });
          if (n.vylouceni.includes(cesta)) return;
          if (!(await uac(`Vyloučit z kontrol: ${cesta}`))) return;
          O.nastav('vylouceni', [...n.vylouceni, cesta]);
        }
        return el('div.df-stranka', {},
          zpet('nastaveni', 'Nastavení ochrany'),
          hlavicka('ban', 'Vyloučení', 'Vyloučené složky a soubory Astro Defender nekontroluje. Přidávej jen to, čemu opravdu věříš.'),
          el('div.df-karta', {},
            el('div.df-pridat', {}, pole, el('button.btn.primary', { onclick: pridej }, icon('plus'), el('span', { text: 'Přidat vyloučení' }))),
            n.vylouceni.length ? n.vylouceni.map((c) => el('div.df-polozka', {},
              icon(FS.isDir(FS.get(c)) ? 'folder' : 'fileText'), el('span', { text: c }),
              el('button.df-ikbtn', { title: 'Odebrat', onclick: () => O.nastav('vylouceni', n.vylouceni.filter((x) => x !== c)) }, icon('x'))))
              : el('p.df-prazdne', { text: 'Žádná vyloučení.' })),
        );
      },

      cfa() {
        const n = d();
        const pole = el('input.df-pole', { placeholder: '~/projekty', spellcheck: 'false' });
        pole.addEventListener('keydown', (e) => e.stopPropagation());
        const vlastni = Object.values(APPS).filter((a) => a.uzivatelska);
        const vyber = el('select.df-select', {},
          el('option', { value: '', text: 'Vyber aplikaci…' }),
          vlastni.filter((a) => !n.cfaPovolene.includes(a.id)).map((a) => el('option', { value: a.id, text: a.name })));

        return el('div.df-stranka', {},
          zpet('viry', 'Ochrana před viry a hrozbami'),
          hlavicka('folderLock', 'Ochrana před ransomwarem', 'Řízený přístup ke složkám nepustí nedůvěryhodné aplikace ke změnám v chráněných složkách.'),
          el('div.df-karta', {},
            nastaveniRadek('Řízený přístup ke složkám',
              'Vlastní aplikace z disku (astro.fs) nesmí zapisovat ani mazat v chráněných složkách, dokud je nepovolíš. Aplikace systému to omezení nemají.',
              prepinac(n.cfa, (v) => O.nastav('cfa', v), { citlive: true, co: 'Vypnout řízený přístup ke složkám' }))),
          sekce('Chráněné složky',
            el('div.df-karta', {},
              n.cfaSlozky.map((c) => el('div.df-polozka', {}, icon('folderLock'), el('span', { text: c.replace(FS.HOME, '~') }),
                el('button.df-ikbtn', {
                  title: 'Odebrat',
                  onclick: async () => { if (await uac(`Odebrat ochranu složky ${c}`)) O.nastav('cfaSlozky', n.cfaSlozky.filter((x) => x !== c)); },
                }, icon('x')))),
              el('div.df-pridat', {}, pole, el('button.btn', {
                onclick: () => {
                  const cesta = FS.normalize(pole.value.trim().replace(/^~/, FS.HOME));
                  if (!FS.isDir(FS.get(cesta))) return toast({ title: 'Složka neexistuje', body: cesta, icon: 'info' });
                  if (!n.cfaSlozky.includes(cesta)) O.nastav('cfaSlozky', [...n.cfaSlozky, cesta]);
                },
              }, icon('plus'), el('span', { text: 'Přidat chráněnou složku' }))))),
          sekce('Povolené aplikace',
            el('p.df-mdl', { text: 'Těmhle aplikacím řízený přístup ke složkám věří.' }),
            el('div.df-karta', {},
              n.cfaPovolene.length ? n.cfaPovolene.map((id) => el('div.df-polozka', {}, icon(APPS[id]?.icon || 'grid'),
                el('span', { text: APPS[id]?.name || id }),
                el('button.df-ikbtn', { title: 'Odebrat', onclick: () => O.nastav('cfaPovolene', n.cfaPovolene.filter((x) => x !== id)) }, icon('x'))))
                : el('p.df-prazdne', { text: 'Žádná povolená aplikace.' }),
              vlastni.length ? el('div.df-pridat', {}, vyber, el('button.btn', {
                onclick: async () => {
                  const a = APPS[vyber.value];
                  if (a && await uac(`Povolit aplikaci ${a.name} přístup k chráněným složkám`)) O.povolAplikaciCfa({ id: a.id, nazev: a.name });
                },
              }, icon('plus'), el('span', { text: 'Povolit aplikaci' }))) : el('p.df-mdl', { text: 'Zatím nemáš žádnou vlastní aplikaci.' }))),
        );
      },

      povolene() {
        const n = d();
        return el('div.df-stranka', {},
          zpet('viry', 'Ochrana před viry a hrozbami'),
          hlavicka('check', 'Povolené hrozby', 'Hrozby, které jsi povolil. Astro Defender proti nim nezasahuje.'),
          el('div.df-karta', {},
            n.povolene.length ? n.povolene.map((p) => el('div.df-polozka.dva', {}, icon('bug'),
              el('div', {}, el('b', { text: p.nazev }), el('span', { text: p.cesta })),
              el('button.btn', { text: 'Nepovolit', onclick: () => O.nepovol(p.hash) })))
              : el('p.df-prazdne', { text: 'Žádné povolené hrozby.' })),
        );
      },

      ucet() {
        const u = State.get('user');
        const vychozi = u.password === 'astro';
        const [sila, silaUroven, silaProc] = silaHesla(u.password);
        const prozrazuje = u.hint && u.password && u.hint.toLowerCase().includes(u.password.toLowerCase());
        const zamek = State.get('zamknoutPo') || 0;
        const doNastaveni = () => openApp('settings', { section: 'ucet' });

        return el('div.df-stranka', {},
          hlavicka('user', 'Ochrana účtu', 'Zabezpečení účtu a přihlašování.'),
          el('div.df-ucet', {}, el('div.df-avatar', { text: u.avatar || u.name[0] }),
            el('div', {}, el('b', { text: u.name }), el('span', { text: `Místní účet · počítač ${State.get('jmenoPc')}` }))),
          el('div.df-karta', {},
            el('div.df-kontrola', {}, znak(vychozi || silaUroven !== 'ok' ? 'info' : 'ok'),
              el('div', {}, el('h3', { text: 'Heslo' }),
                el('p', { text: vychozi ? 'Používáš výchozí heslo „astro“. Kdybys chtěl vlastní, změníš ho v Nastavení.' : `Síla hesla: ${sila.toLowerCase()}.` }),
                vychozi ? null : el('div.df-sila.' + silaUroven, {}, el('i', { style: { width: silaProc + '%' } }))),
              vychozi || silaUroven !== 'ok' ? el('button.btn', { text: 'Změnit heslo', onclick: doNastaveni }) : null),
            el('div.df-kontrola', {}, znak(prozrazuje ? 'info' : 'ok'),
              el('div', {}, el('h3', { text: 'Nápověda k heslu' }),
                el('p', { text: prozrazuje ? 'Nápověda obsahuje samotné heslo.' : 'Nápověda heslo neprozrazuje.' })),
              prozrazuje ? el('button.btn', { text: 'Upravit nápovědu', onclick: doNastaveni }) : null),
            el('div.df-kontrola', {}, znak(zamek ? 'ok' : 'info'),
              el('div', {}, el('h3', { text: 'Automatické zamknutí' }),
                el('p', { text: zamek ? `Počítač se zamkne po ${zamek} min nečinnosti.` : 'Když od počítače odejdeš, zůstane odemčený.' })),
              zamek ? null : el('button.btn', { text: 'Zamykat po 5 minutách', onclick: () => State.set('zamknoutPo', 5) }))),
        );
      },

      firewall() {
        const n = d();
        const aktivni = O.aktivniProfil();
        return el('div.df-stranka', {},
          hlavicka('wall', 'Brána firewall a ochrana sítě', 'Kdo a co má přístup k sítím.'),
          el('div.df-profily', {}, PROFILY.map(([id, nazev, popis]) => {
            const zap = n.firewall[id];
            return el('div.df-karta.df-profil' + (id === aktivni ? '.aktivni' : ''), {},
              el('div.df-profil-hlava', {}, znak(zap ? 'ok' : 'kriticke'), el('h3', { text: nazev }),
                id === aktivni ? el('span.df-chip.aktivni', { text: 'aktivní' }) : null),
              el('p', { text: popis }),
              id === aktivni ? el('p.df-mdl', { text: popisSite() }) : null,
              el('div.df-profil-stav', {}, el('span', { text: 'Brána firewall' }),
                prepinac(zap, (v) => O.nastav('firewall', { ...n.firewall, [id]: v }), { citlive: true, co: `Vypnout bránu firewall pro síť: ${nazev}` })));
          })),
          sekce('Povolit aplikaci přes bránu firewall',
            el('p.df-mdl', { text: 'Aplikace, které smí do internetu. Zablokovaná aplikace se na aktivní síti nepřipojí.' }),
            el('div.df-karta', {}, FIREWALL_APPS.map(([id, nazev]) => el('div.df-polozka', {},
              icon(APPS[id]?.icon || 'globe'), el('span', { text: nazev }),
              prepinac(!n.fwBlok[id], (v) => O.nastav('fwBlok', { ...n.fwBlok, [id]: !v }), { texty: ['Povoleno', 'Blokováno'] }))))),
          sekce(null, odkaz('Obnovit výchozí nastavení brány firewall', async () => {
            if (await potvrzeni('Obnovit výchozí nastavení?', 'Brána firewall se zapne pro všechny sítě a všechny aplikace zase smí do internetu.', 'Obnovit')) {
              O.nastav('fwBlok', {});
              O.nastav('firewall', { domena: true, soukroma: true, verejna: true });
            }
          })),
        );
      },

      aplikace() {
        const n = d();
        return el('div.df-stranka', {},
          hlavicka('grid', 'Řízení aplikací a prohlížeče', 'Ochrana před nebezpečnými aplikacemi, soubory a weby.'),
          el('div.df-karta', {},
            nastaveniRadek('Kontrola aplikací a souborů',
              'Před spuštěním vlastní aplikace z disku zkontroluje její složku. Když najde hrozbu, aplikaci nespustí.',
              prepinac(n.kontrolaAplikaci, (v) => O.nastav('kontrolaAplikaci', v), { citlive: true, co: 'Vypnout kontrolu aplikací a souborů' }),
              n.kontrolaAplikaci ? null : 'Aplikace se spouští bez kontroly.'),
            nastaveniRadek('SmartScreen pro Novu',
              'Varuje před podvodnými weby, napodobeninami známých stránek (třeba roblox-login.xyz) a weby, které slibují herní měnu zdarma.',
              prepinac(n.smartscreen, (v) => O.nastav('smartscreen', v), { citlive: true, co: 'Vypnout SmartScreen pro Novu' }),
              n.smartscreen ? null : 'Nova teď nebezpečné weby nezablokuje.')),
          sekce('Vyzkoušet ochranu',
            el('p.df-mdl', { text: 'Google provozuje neškodné testovací stránky, které prohlížeče schválně hlásí jako nebezpečné.' }),
            el('div.df-radek-akci', {},
              el('button.btn', { onclick: () => openApp('browser', { url: 'https://testsafebrowsing.appspot.com/s/phishing.html' }) }, icon('globe'), el('span', { text: 'Otevřít testovací phishing' })),
              el('button.btn', { onclick: zalozTestovaciSoubor }, icon('bug'), el('span', { text: 'Vytvořit testovací soubor' })))),
        );
      },

      zarizeni() {
        const n = d();
        return el('div.df-stranka', {},
          hlavicka('chip', 'Zabezpečení zařízení', 'Zabezpečení zabudované přímo v zařízení.'),
          el('div.df-karta', {},
            el('div.df-kontrola', {}, znak(n.integritaPameti ? 'ok' : 'varovani'),
              el('div', {}, el('h3', { text: 'Izolace jádra' }),
                el('p', { text: 'Integrita paměti brání škodlivému kódu, aby se dostal do nejcitlivějších částí systému.' }),
                cekaRestart ? el('p.df-volba-var', { text: 'Změna se projeví po restartu.' }) : null),
              el('div.df-sloupec', {},
                prepinac(n.integritaPameti, (v) => { O.nastav('integritaPameti', v); cekaRestart = !cekaRestart; kresli(); },
                  { citlive: true, co: 'Vypnout integritu paměti' }),
                cekaRestart ? el('button.btn', { text: 'Restartovat', onclick: () => { cekaRestart = false; bus.emit('power', 'restart'); } }) : null))),
          el('div.df-karta', {},
            el('div.df-kontrola', {}, znak('ok'),
              el('div', {}, el('h3', { text: 'Bezpečnostní procesor' }),
                el('p', { text: 'Bezpečnostní procesor (TPM) chrání šifrovací klíče zařízení.' }),
                el('div.df-tabulka', {}, [
                  ['Výrobce', 'AstroMeo (ASTR)'], ['Verze výrobce', '7.2.3.1'], ['Verze specifikace', '2.0'], ['Stav', 'Bezpečnostní procesor funguje správně.'],
                ].map(([k, v]) => el('div', {}, el('span', { text: k }), el('b', { text: v }))))))),
          el('div.df-karta', {},
            el('div.df-kontrola', {}, znak('ok'),
              el('div', {}, el('h3', { text: 'Zabezpečené spouštění' }),
                el('p', { text: 'Zapnuto. AstroBIOS spouští jen podepsaný zavaděč, takže se škodlivý software nemůže načíst ještě před systémem.' })))),
        );
      },

      vykon() {
        const m = O.vyuzitiUloziste();
        const kos = FS.size(FS.get(FS.TRASH));
        const vlastni = Object.values(APPS).filter((a) => a.uzivatelska);
        const rozbite = vlastni.filter((a) => !FS.isFile(FS.get(a.slozka + '/index.html')));
        const n = d();
        const karanteny = n.karantena.reduce((s, k) => s + FS.size(FS.get(`${O.KARANTENA}/${k.id}.bin`)), 0);
        const plne = m.procent > 85;

        return el('div.df-stranka', {},
          hlavicka('heart', 'Výkon a stav zařízení', 'Zpráva o stavu zařízení.'),
          el('p.df-mdl', { text: `Poslední kontrola: ${datum(Date.now())}` }),
          el('div.df-karta', {},
            el('div.df-kontrola', {}, znak(plne ? 'varovani' : 'ok'),
              el('div', {}, el('h3', { text: 'Kapacita úložiště' }),
                el('p', { text: `Disk AstroOS (úložiště prohlížeče) zabírá ${FS.humanSize(m.bajtu)} z přibližně ${FS.humanSize(m.limit)}.` }),
                el('div.df-sila.' + (plne ? 'varovani' : 'ok'), {}, el('i', { style: { width: Math.min(100, m.procent) + '%' } }))),
              kos > 0 ? el('button.btn', { text: `Vysypat koš (${FS.humanSize(kos)})`, onclick: () => { FS.emptyTrash(); kresli(); } }) : null),
            el('div.df-kontrola', {}, znak(rozbite.length ? 'varovani' : 'ok'),
              el('div', {}, el('h3', { text: 'Aplikace a software' }),
                el('p', {
                  text: rozbite.length
                    ? `Nejde spustit: ${rozbite.map((a) => a.name).join(', ')} — ve složce chybí index.html.`
                    : vlastni.length ? `${plural(vlastni.length, ['vlastní aplikace', 'vlastní aplikace', 'vlastních aplikací'])} v pořádku.` : 'Žádné problémy.',
                }))),
            el('div.df-kontrola', {}, znak(Date.now() - n.definice < 3 * 864e5 ? 'ok' : 'varovani'),
              el('div', {}, el('h3', { text: 'Definice hrozeb' }), el('p', { text: `Verze ${O.verzeDefinic()} z ${datum(n.definice)}.` }))),
            el('div.df-kontrola', {}, znak('ok'),
              el('div', {}, el('h3', { text: 'Karanténa' }),
                el('p', { text: n.karantena.length ? `${plural(n.karantena.length, ['soubor', 'soubory', 'souborů'])}, ${FS.humanSize(karanteny)}.` : 'Prázdná.' })))),
        );
      },

      historie() {
        const n = d();
        const FILTRY = [
          ['vse', 'Vše'],
          ['hrozby', 'Hrozby'],
          ['karantena', 'V karanténě'],
          ['blokovano', 'Blokováno'],
          ['system', 'Kontroly a nastavení'],
        ];
        const vKarantene = (z) => z.typ === 'hrozba' && z.stav === 'karantena' && n.karantena.some((k) => k.id === z.hrozba.id);
        const sedi = (z) => st.filtr === 'vse'
          || (st.filtr === 'hrozby' && z.typ === 'hrozba')
          || (st.filtr === 'karantena' && vKarantene(z))
          || (st.filtr === 'blokovano' && (z.typ === 'blokovano' || z.typ === 'web'))
          || (st.filtr === 'system' && ['kontrola', 'aktualizace', 'nastaveni'].includes(z.typ));
        const zaznamy = n.historie.filter(sedi);

        return el('div.df-stranka', {},
          hlavicka('clock', 'Historie ochrany', 'Nejnovější akce a doporučení Astro Defenderu.'),
          el('div.df-filtry', {},
            el('div.df-chipy', {}, FILTRY.map(([id, nazev]) => el('button.df-chip.volba' + (st.filtr === id ? '.on' : ''), { text: nazev, onclick: () => { st.filtr = id; kresli(); } }))),
            n.historie.length ? odkaz('Vymazat historii', async () => {
              if (await potvrzeni('Vymazat historii ochrany?', 'Záznamy zmizí. Soubory v karanténě zůstanou.', 'Vymazat')) O.smazHistorii();
            }) : null),
          zaznamy.length ? el('div.df-historie', {}, zaznamy.map((z) => zaznamHistorie(z, vKarantene(z))))
            : el('div.df-karta', {}, el('p.df-prazdne', { text: 'Žádné záznamy.' })),
        );
      },
    };

    // ---------- dílčí části ----------
    function zpet(kam, text) {
      return el('button.df-zpet', { onclick: () => jdi(kam) }, icon('chevronLeft'), el('span', { text }));
    }

    function seznamHrozeb() {
      const n = d();
      const serazene = [...n.hrozby].sort((a, b) => O.ZAVAZNOST[b.zavaznost].poradi - O.ZAVAZNOST[a.zavaznost].poradi);
      return el('div.df-karta.df-hrozby', {},
        el('div.df-hrozby-hlava', {}, znak('kriticke'),
          el('div', {}, el('b', { text: `Nalezené hrozby: ${n.hrozby.length}` }), el('p', { text: 'Spusť doporučené akce. Karanténa soubor zneškodní, ale jde ho vrátit.' }))),
        serazene.map((h) => {
          const rozbaleno = st.rozbaleno.has(h.id);
          const volba = st.akce[h.id] || 'karantena';
          const vyber = el('select.df-select', { onchange: (e) => { st.akce[h.id] = e.target.value; } },
            [['karantena', 'Karanténa'], ['odebrat', 'Odebrat'], ['povolit', 'Povolit na zařízení']]
              .map(([v, t]) => el('option', { value: v, text: t, selected: v === volba })));
          return el('div.df-hrozba', {},
            el('button.df-hrozba-radek', { onclick: () => { rozbaleno ? st.rozbaleno.delete(h.id) : st.rozbaleno.add(h.id); kresli(); } },
              el('span.df-hrozba-ic', {}, icon('bug')),
              el('div', {}, el('b', { text: h.nazev }), el('span', { text: `${datum(h.cas)} · ${h.cesta}` })),
              zavaznostChip(h.zavaznost), icon(rozbaleno ? 'chevronDown' : 'chevronRight')),
            rozbaleno ? detailHrozby(h) : null,
            el('div.df-hrozba-akce', {}, el('span', { text: 'Akce:' }), vyber));
        }),
        el('div.df-radek-akci', {}, el('button.btn.primary', {
          onclick: async () => {
            const hrozby = [...n.hrozby];
            const povolit = hrozby.filter((h) => st.akce[h.id] === 'povolit');
            if (povolit.length && !(await uac(`Povolit na zařízení: ${povolit.map((h) => h.nazev).join(', ')}`))) return;
            for (const h of hrozby) {
              const a = st.akce[h.id] || 'karantena';
              if (a === 'odebrat') O.odeber(h);
              else if (a === 'povolit') O.povol(h);
              else O.karantena(h);
            }
            st.akce = {};
            toast({ title: 'Akce dokončeny', body: 'Astro Defender · hrozby jsou vyřešené.', icon: 'shield' });
          },
        }, el('span', { text: 'Spustit akce' }))));
    }

    function detailHrozby(h, stav) {
      return el('div.df-detail', {},
        el('div.df-tabulka', {}, [
          ['Zjištěno', h.nazev],
          stav ? ['Stav', stav] : null,
          ['Datum', datum(h.cas)],
          ['Kategorie', h.kategorie],
          ['Závažnost', O.ZAVAZNOST[h.zavaznost].nazev],
          ['Otisk', h.hash],
        ].filter(Boolean).map(([k, v]) => el('div', {}, el('span', { text: k }), el('b', { text: v })))),
        el('p', { text: h.popis }),
        el('div.df-dotcene', {}, el('span', { text: 'Ovlivněné položky:' }), el('code', { text: 'soubor: ' + h.cesta })));
    }

    function zaznamHistorie(z, vKarantene) {
      const rozbaleno = st.rozbaleno.has(z.id);
      const STAVY = { karantena: 'V karanténě', odebrano: 'Odebráno', povoleno: 'Povoleno', obnoveno: 'Obnoveno' };
      const ic = { hrozba: 'bug', blokovano: 'folderLock', web: 'globe', kontrola: 'radar', aktualizace: 'refresh', nastaveni: 'settings' }[z.typ] || 'info';
      const stav = z.typ === 'hrozba' ? (z.stav === 'karantena' && !vKarantene ? 'Vyřízeno z karantény' : STAVY[z.stav]) : null;

      let detail = null;
      if (rozbaleno) {
        if (z.typ === 'hrozba') {
          const k = O.nastaveni().karantena.find((x) => x.id === z.hrozba.id);
          const povolena = z.stav === 'povoleno' && O.nastaveni().povolene.some((x) => x.hash === z.hrozba.hash);
          detail = el('div', {}, detailHrozby(z.hrozba, stav),
            vKarantene ? el('div.df-radek-akci', {},
              el('button.btn', {
                disabled: k && !k.ulozeno,
                onclick: async () => { if (await uac(`Obnovit ${z.hrozba.jmeno} z karantény`)) O.obnov(z.hrozba.id); },
              }, icon('refresh'), el('span', { text: 'Obnovit' })),
              el('button.btn.danger', { onclick: () => O.smazZKaranteny(z.hrozba.id) }, icon('trash'), el('span', { text: 'Odebrat' }))) : null,
            povolena ? el('div.df-radek-akci', {}, el('button.btn', { text: 'Nepovolit', onclick: () => O.nepovol(z.hrozba.hash) })) : null);
        } else {
          detail = el('div.df-detail', {},
            z.text ? el('p', { text: z.text }) : null,
            z.duvod ? el('p', { text: z.duvod }) : null,
            z.typ === 'blokovano' && z.app && !O.nastaveni().cfaPovolene.includes(z.app.id)
              ? el('div.df-radek-akci', {}, el('button.btn', {
                onclick: async () => { if (await uac(`Povolit aplikaci ${z.app.nazev} přístup k chráněným složkám`)) O.povolAplikaciCfa(z.app); },
              }, icon('check'), el('span', { text: 'Povolit na zařízení' }))) : null);
        }
      }

      return el('div.df-zaznam' + (rozbaleno ? '.on' : ''), {},
        el('button.df-zaznam-radek', { onclick: () => { rozbaleno ? st.rozbaleno.delete(z.id) : st.rozbaleno.add(z.id); kresli(); } },
          el('span.df-zaznam-ic.' + z.typ, {}, icon(ic)),
          el('div', {}, el('b', { text: z.nadpis }),
            el('span', { text: datum(z.cas) + (z.typ === 'hrozba' ? ` · ${z.hrozba.nazev}` : z.text && !rozbaleno ? ` · ${z.text}` : '') })),
          stav ? el('span.df-chip.stav', { text: stav }) : null,
          zavaznostChip(z.zavaznost),
          icon(rozbaleno ? 'chevronDown' : 'chevronRight')),
        detail);
    }

    function zalozTestovaciSoubor() {
      const slozka = FS.HOME + '/Stažené';
      if (!FS.exists(slozka)) FS.mkdir(slozka, { parents: true });
      const jmeno = FS.freeName(slozka, 'test-defender.txt');
      FS.write(`${slozka}/${jmeno}`, `${O.TESTOVACI_TEXT}\n\nNeškodný testovací soubor Astro Defenderu.\n`);
      if (!d().rt) toast({ title: 'Soubor vytvořen', body: `~/Stažené/${jmeno} — ochrana v reálném čase je vypnutá, zkus kontrolu.`, icon: 'bug' });
    }

    // ---------- vykreslení ----------
    function kresli() {
      kresliNav();
      const posun = obsah.scrollTop;
      obsah.replaceChildren((STRANKY[st.stranka] || STRANKY.domu)());
      obsah.scrollTop = posun;
    }

    const odpoj = [
      bus.on('obrana', () => body.isConnected && kresli()),
      bus.on('obrana:prubeh', (b) => {
        if (!body.isConnected) return;
        if (!!b !== st.bezi) { st.bezi = !!b; kresli(); return; }
        const k = obsah.querySelector('.df-prubeh');
        if (b && k) aktualizujPrubeh(k, b);
      }),
      ...['user', 'zamknoutPo', 'wifi'].map((k) => bus.on('state:' + k, () => body.isConnected && kresli())),
      bus.on('sit:zmena', () => body.isConnected && kresli()),
    ];
    win.onClose = () => odpoj.forEach((f) => f());

    kresli();
    const k = win.opts?.kontrola;
    if (k) O.spustKontrolu(k.typ, { cesta: k.cesta });
  },

  unmount(win) { win.onClose?.(); },

  reopen(win, opts) {
    if (opts?.stranka) win.jdi?.(opts.stranka);
    if (opts?.kontrola) O.spustKontrolu(opts.kontrola.typ, { cesta: opts.kontrola.cesta });
  },
};
