// AstroOS — webové aplikace: skutečný web z internetu v okně, které se tváří jako aplikace
// systému (stejně jako Spotify nebo Discord na Windows — uvnitř je web, zvenku aplikace).
//
// Stránka jde přes proxy Novy (webproxy.js) a rám se jmenuje „astroapp:<id>“. Podle toho
// můstek proxy do stránky přidá sdk/webapp.js (motiv, nabídka, klávesy, bez bubliny s adresou)
// a úpravy sdk/app-<id>.css + app-<id>.js (schová přihlášení, reklamy, patičku webu…).
// Tady je okno: úvodní obrazovka jako u aplikací z Microsoft Store, chyby bez internetu,
// kontextová nabídka systému, odkazy ven do Novy a zapamatované místo.

import { el, cz } from './util.js';
import { icon, glyfAplikace } from './icons.js';
import { State } from './state.js';
import { toast, contextMenu, closeMenu } from './ui.js';
import { focus } from './wm.js';
import { adresaPresProxy, motivProStranku, sledujMotiv } from './hostitel.js';
import { firewallPovoli, zapisFirewall } from './obrana.js';
import * as Sit from './sit.js';
import { UKAZKA } from './demo.js';

// ---------------------------------------------------------------- aplikace
export const WEBAPLIKACE = [
  {
    id: 'mapy', name: 'Mapy', icon: 'mapa', color: 'linear-gradient(145deg,#4fd1a0,#1f8a6a)', cat: 'net',
    width: 1080, height: 700,
    url: 'https://www.openstreetmap.org/', domeny: ['openstreetmap.org'],
    zdroj: 'OpenStreetMap', popis: 'Mapa celého světa z OpenStreetMap — hledání míst, trasy pro auto, kolo i pěší.',
    pamatujMisto: true,
    volby: { tmava: { nazev: 'Tmavá mapa v tmavém motivu', vychozi: true } },
    menu: (a) => [
      { icon: 'search', label: 'Hledat místo', key: 'Ctrl+F', onClick: () => a.prikaz('hledat') },
      { icon: 'trasa', label: 'Naplánovat trasu', onClick: () => a.prikaz('trasa') },
      { icon: 'poloha', label: 'Moje poloha', onClick: () => a.prikaz('poloha') },
      { icon: 'vrstvy', label: 'Vrstvy mapy', onClick: () => a.prikaz('vrstvy') },
    ],
  },
  {
    id: 'monkeytype', name: 'Monkeytype', icon: 'keyboard', color: 'linear-gradient(145deg,#f2cc4b,#b88411)', cat: 'media',
    width: 1000, height: 640,
    url: 'https://monkeytype.com/', domeny: ['monkeytype.com'],
    zdroj: 'monkeytype.com', popis: 'Test psaní na klávesnici. Rekordy si pamatuje AstroOS.',
    volby: { barvy: { nazev: 'Barvy AstroOS', vychozi: true } },
    menu: (a) => [
      { icon: 'refresh', label: 'Nový test', key: 'Tab', onClick: () => a.prikaz('novy') },
      { icon: 'sliders', label: 'Nastavení testu', onClick: () => a.prikaz('nastaveni') },
      { icon: 'pohar', label: 'Moje rekordy', onClick: () => a.rekordy() },
    ],
    onZprava: (d, a) => { if (d.typ === 'vysledek') zapisVysledek(d, a); },
  },
];

const hostJe = (host, domena) => host === domena || host.endsWith('.' + domena);

/** Webová aplikace, ke které adresa patří (pro „Otevřít v aplikaci“ v Nově). */
export function webAplikacePro(url) {
  let host;
  try { host = new URL(url).hostname; } catch { return null; }
  return WEBAPLIKACE.find((a) => a.domeny.some((d) => hostJe(host, d))) || null;
}

/** Definice pro registr APPS (js/apps.js). */
export const webAplikaceApps = WEBAPLIKACE.map((d) => ({
  id: d.id, name: d.name, icon: d.icon, color: d.color, cat: d.cat, width: d.width, height: d.height,
  webova: d,
  mount: (body, win) => spust(d, body, win),
  unmount: (win) => win.onClose?.(),
  reopen: (win, opts) => { if (opts?.url) win.jdiNa?.(opts.url); },
}));

// ---------------------------------------------------------------- uložený stav
const stav = (id) => (State.get('webAplikace') || {})[id] || {};
function ulozStav(id, zmena) {
  const vse = State.get('webAplikace') || {};
  State.set('webAplikace', { ...vse, [id]: { ...(vse[id] || {}), ...zmena } });
}
const volbyPro = (d) => Object.fromEntries(Object.entries(d.volby || {}).map(([k, v]) => [k, stav(d.id).volby?.[k] ?? v.vychozi]));

// ---------------------------------------------------------------- okno aplikace
function spust(d, body, win) {
  const patri = (url) => {
    try { const u = new URL(url); return u.protocol === 'https:' && d.domeny.some((x) => hostJe(u.hostname, x)); } catch { return false; }
  };

  // Stejný sandbox jako panely Novy: vlastní původ (proxy port) od AstroOS odděluje, sandbox
  // bere stránce přepsání celého systému přes top.location. Jméno rámu = režim aplikace.
  const ramec = el('iframe.wa-ramec', {
    name: 'astroapp:' + d.id,
    sandbox: 'allow-scripts allow-forms allow-same-origin allow-modals allow-presentation',
    allow: 'autoplay; fullscreen; geolocation; clipboard-write',
    title: d.name,
  });
  const uvod = el('div.wa-uvod', { style: { background: d.color } },
    el('div.wa-uvod-ic', {}, icon(d.icon)),
    el('div.wa-uvod-toc', {}, el('i'), el('i'), el('i'), el('i'), el('i')));
  const kryt = el('div.wa-kryt', { hidden: true });      // chyba, firewall, O aplikaci, rekordy
  const obal = el('div.wa', {}, ramec, uvod, kryt);
  body.append(obal);

  let adresa = null;          // skutečná adresa stránky (poslední hlášená)
  let casovac = 0;

  const a = {
    d, win,
    prikaz(nazev, arg) {
      try { ramec.contentWindow?.postMessage({ astroApp: 1, typ: 'prikaz', nazev, arg }, '*'); } catch { /* rám zmizel */ }
    },
    rekordy: () => ukazRekordy(),
  };

  function posliMotiv() {
    const m = motivProStranku();
    // Rám dostane color-scheme podle motivu systému — Chrome podle něj řídí i
    // prefers-color-scheme uvnitř stránky (OpenStreetMap tak přepne tmavý vzhled sám).
    ramec.style.colorScheme = m.nazev === 'svetly' ? 'light' : 'dark';
    try { ramec.contentWindow?.postMessage({ astroApp: 1, typ: 'motiv', motiv: m, volby: volbyPro(d) }, '*'); } catch { /* rám zmizel */ }
  }
  posliMotiv();
  const odhlasMotiv = sledujMotiv(posliMotiv);

  // ---------- načítání ----------
  function nacti(url) {
    closeKryt();
    if (!Sit.online()) {
      ramec.removeAttribute('src');
      return ukazKryt(bezPripojeni(
        Sit.letadlo() ? 'letadlo' : 'wifiOff', `${d.name} potřebuje internet`,
        Sit.letadlo() ? 'Jsi v režimu Letadlo. Vypni ho a aplikace se načte.' : 'Nejsi připojený k žádné síti.',
      ));
    }
    if (!firewallPovoli(d.id)) {
      zapisFirewall(d.id, d.name);
      ramec.removeAttribute('src');
      return ukazKryt(bezPripojeni(
        'wall', `${d.name} se nemůže připojit`,
        'Astro Defender blokuje aplikaci v bráně firewall. Povolit ji můžeš v Bráně firewall a ochraně sítě.',
        el('button.btn.primary', { text: 'Otevřít bránu firewall', onclick: () => otevri('defender', { stranka: 'firewall' }) }),
      ));
    }
    // Ukázková verze nemá proxy (server.js), přes kterou web dostane úpravy a vzhled aplikace.
    if (UKAZKA) {
      ramec.removeAttribute('src');
      uvod.hidden = true;
      return ukazKryt(bezPripojeni(
        'globe', `${d.name} v ukázkové verzi nejde`,
        `Webové aplikace v plné verzi AstroOS běží přes vlastní server. Ukázka běží jen v prohlížeči, takže ${d.zdroj} sem vložit nejde.`,
        el('button.btn.primary', { text: `Otevřít ${d.zdroj} v prohlížeči`, onclick: () => window.open(d.url, '_blank', 'noopener') }),
      ));
    }
    uvod.hidden = false;
    uvod.classList.remove('pryc');
    ramec.src = adresaPresProxy(url);
    clearTimeout(casovac);
    casovac = setTimeout(() => {
      if (!uvod.hidden && !uvod.classList.contains('pryc')) {
        chyba('Aplikace se nenačetla včas. Je počítač připojený k internetu?');
      }
    }, 25000);
  }

  function pripraveno() {
    clearTimeout(casovac);
    // Appka doběhla i po zobrazení chyby o připojení (ta jela na časovač, ne na tuhle zprávu) —
    // kryt s hláškou o připojení zavřeme, ale okno „O aplikaci“/rekordy (má wa-dialog) necháme být.
    if (!kryt.hidden && !kryt.classList.contains('wa-dialog')) closeKryt();
    if (uvod.hidden || uvod.classList.contains('pryc')) return;
    uvod.classList.add('pryc');
    setTimeout(() => { if (uvod.classList.contains('pryc')) uvod.hidden = true; }, 320);
  }

  function chyba(zprava) {
    clearTimeout(casovac);
    uvod.hidden = true;
    ukazKryt(bezPripojeni('wifiOff', `${d.name} se nemůže připojit`,
      `Pro tuhle aplikaci je potřeba internet. ${zprava || ''}`.trim()));
  }

  function bezPripojeni(ic, nadpis, text, ...tlacitka) {
    return el('div.wa-chyba', {},
      el('div.wa-chyba-ic', {}, icon(ic)),
      el('h2', { text: nadpis }),
      el('p', { text }),
      el('div.wa-akce', {}, ...tlacitka,
        el('button.btn' + (tlacitka.length ? '' : '.primary'), { text: 'Zkusit znovu', onclick: () => nacti(adresa || startovni()) })));
  }

  function ukazKryt(obsah, zavrit = false) {
    kryt.replaceChildren(obsah);
    kryt.classList.toggle('wa-dialog', zavrit);
    kryt.hidden = false;
    if (zavrit) kryt.onclick = (e) => { if (e.target === kryt) closeKryt(); };
    else kryt.onclick = null;
  }
  function closeKryt() { kryt.hidden = true; kryt.replaceChildren(); }

  const otevri = (id, opts) => import('./apps.js').then(({ openApp }) => openApp(id, opts));
  const doNovy = (url) => otevri('browser', { url });

  // ---------- zprávy ze stránky ----------
  function zprava(e) {
    if (e.source !== ramec.contentWindow) return;
    const m = e.data;
    if (!m || m.astroWeb !== 1) return;
    switch (m.typ) {
      case 'ahoj': posliMotiv(); break;
      case 'pripraveno': pripraveno(); break;
      case 'chyba': chyba(m.zprava); break;
      case 'url':
      case 'nacteno':
        if (typeof m.url === 'string' && patri(m.url)) {
          adresa = m.url;
          if (d.pamatujMisto) ulozStav(d.id, { url: m.url });
        }
        break;
      case 'novyPanel':
        if (typeof m.url === 'string' && /^https?:\/\//i.test(m.url)) doNovy(m.url);
        break;
      case 'menu': nabidka(m); break;
      case 'klik': closeMenu(); break;
      case 'klavesa':
        if (m.udalost === 'keydown' || m.udalost === 'keyup') {
          window.dispatchEvent(new KeyboardEvent(m.udalost, { key: String(m.key), metaKey: !!m.metaKey }));
        }
        break;
      default: d.onZprava?.(m, a);
    }
  }
  window.addEventListener('message', zprava);

  // ---------- kontextová nabídka systému ----------
  function nabidka(m) {
    const r = ramec.getBoundingClientRect();
    const volby = volbyPro(d);
    const polozky = [];
    if (m.vyber?.trim()) polozky.push({ icon: 'copy', label: 'Kopírovat', key: 'Ctrl+C', onClick: () => a.prikaz('kopirovat', m.vyber) }, '-');
    if (m.odkaz) {
      polozky.push(
        { icon: 'globe', label: 'Otevřít odkaz v Nově', onClick: () => doNovy(m.odkaz) },
        { icon: 'copy', label: 'Kopírovat adresu odkazu', onClick: () => navigator.clipboard?.writeText(m.odkaz) },
        '-');
    }
    const vlastni = d.menu?.(a) || [];
    if (vlastni.length) polozky.push(...vlastni, '-');
    polozky.push(
      { icon: 'chevronLeft', label: 'Zpět', key: 'Alt+←', onClick: () => a.prikaz('zpet') },
      { icon: 'chevronRight', label: 'Vpřed', key: 'Alt+→', onClick: () => a.prikaz('vpred') },
      { icon: 'refresh', label: 'Obnovit', key: 'F5', onClick: () => a.prikaz('obnov') },
    );
    const klice = Object.keys(d.volby || {});
    if (klice.length) {
      polozky.push('-', ...klice.map((k) => ({
        icon: volby[k] ? 'check' : null,
        label: d.volby[k].nazev,
        onClick: () => { ulozStav(d.id, { volby: { ...volby, [k]: !volby[k] } }); posliMotiv(); },
      })));
    }
    polozky.push('-', { icon: 'info', label: `O aplikaci ${d.name}`, onClick: () => oAplikaci() });
    contextMenu(polozky, { x: r.left + m.x, y: r.top + m.y });
  }

  // ---------- O aplikaci ----------
  function oAplikaci() {
    const s = stav(d.id);
    ukazKryt(el('div.wa-karta', {},
      el('div.wa-karta-hlava', {},
        glyfAplikace(d, 'div.wa-karta-ic'),
        el('div', {}, el('h2', { text: d.name }), el('span', { text: 'Webová aplikace AstroOS' }))),
      el('p', { text: d.popis }),
      el('div.wa-tabulka', {},
        el('div', {}, el('span', { text: 'Obsah z webu' }), el('b', { text: `${d.zdroj} (${new URL(d.url).hostname})` })),
        el('div', {}, el('span', { text: 'Běží' }), el('b', { text: 'v izolovaném okně, odděleně od disku a nastavení' })),
        s.prvni ? el('div', {}, el('span', { text: 'Poprvé spuštěno' }), el('b', { text: cz.datumKratky(new Date(s.prvni)) })) : null),
      el('div.wa-akce', {},
        el('button.btn', { text: 'Otevřít v Nově', onclick: () => { closeKryt(); doNovy(adresa || d.url); } }),
        el('button.btn.primary', { text: 'Zavřít', onclick: closeKryt }))), true);
  }

  // ---------- rekordy (Monkeytype) ----------
  function ukazRekordy() {
    const r = State.get('monkeytypeRekordy') || {};
    const radky = Object.entries(r).sort((x, y) => y[1].wpm - x[1].wpm);
    ukazKryt(el('div.wa-karta', {},
      el('div.wa-karta-hlava', {},
        el('div.wa-karta-ic', { style: { background: d.color } }, icon('pohar')),
        el('div', {}, el('h2', { text: 'Moje rekordy' }), el('span', { text: 'Nejlepší výsledek pro každý druh testu' }))),
      radky.length
        ? el('div.wa-rekordy', {}, radky.map(([k, v]) => el('div.wa-rekord', {},
          el('span.wa-rekord-druh', { text: k }),
          el('b', { text: `${v.wpm} wpm` }),
          el('span', { text: `${v.acc} % · ${cz.datumKratky(new Date(v.kdy))}` }))))
        : el('p', { text: 'Zatím žádný dokončený test. Začni psát — rekordy se ukládají samy.' }),
      el('div.wa-akce', {}, el('button.btn.primary', { text: 'Zavřít', onclick: closeKryt }))), true);
  }

  // ---------- fokus ----------
  // Klik do rámu se ke správci oken nedostane — okno vytáhneme dopředu, když rám získá fokus.
  const priBlur = () => setTimeout(() => {
    if (document.activeElement === ramec) { closeMenu(); focus(win); }
  }, 0);
  window.addEventListener('blur', priBlur);

  // ---------- start ----------
  const startovni = () => {
    if (win.opts?.url && patri(win.opts.url)) return win.opts.url;
    const ulozena = stav(d.id).url;
    return d.pamatujMisto && ulozena && patri(ulozena) ? ulozena : d.url;
  };
  if (!stav(d.id).prvni) ulozStav(d.id, { prvni: Date.now() });

  win.title = d.name;
  win.jdiNa = (url) => { if (patri(url)) nacti(url); else doNovy(url); };
  win.onClose = () => {
    clearTimeout(casovac);
    window.removeEventListener('message', zprava);
    window.removeEventListener('blur', priBlur);
    odhlasMotiv();
    ramec.src = 'about:blank';
  };
  nacti(startovni());
}

// ---------------------------------------------------------------- Monkeytype: rekordy
function zapisVysledek(v, a) {
  const wpm = Math.round(Number(v.wpm)), acc = Math.round(Number(v.acc));
  if (!(wpm > 0) || !(acc >= 0)) return;
  const druh = v.rezim === 'time' ? `${v.delka} s` : v.rezim === 'words' ? `${v.delka} slov` : v.rezim || 'test';
  const klic = druh + (v.jazyk && v.jazyk !== 'english' ? ` · ${v.jazyk}` : '');
  const vse = State.get('monkeytypeRekordy') || {};
  const stary = vse[klic];
  if (stary && stary.wpm >= wpm) return;
  State.set('monkeytypeRekordy', { ...vse, [klic]: { wpm, acc, kdy: Date.now() } });
  toast({
    title: stary ? 'Nový osobní rekord!' : 'První rekord uložen',
    body: `${wpm} wpm · přesnost ${acc} % (${klic})${stary ? ` — předtím ${stary.wpm} wpm` : ''}`,
    icon: 'pohar',
    onClick: () => a.rekordy(),
  });
}
