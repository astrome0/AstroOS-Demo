// AstroOS — Počasí
//
// Skutečná předpověď z open-meteo.com (zdarma, bez klíče). Požadavky jdou přes proxy
// Novy na vedlejším portu (webproxy.js, tvar /web/https/…), stejně jako weby v prohlížeči —
// proxy k odpovědi přidá CORS hlavičky, takže je AstroOS může číst.
// Vzniklo z ukázkové aplikace v Obchodě, ze které se stala součást systému.

import { el, pad } from '../util.js';
import { State } from '../state.js';
import { jazykTed, tx } from '../i18n.js';

// ukázková verze nemá proxy — open-meteo.com povoluje CORS, takže jde napřímo
const pres = (url) => url;

// kódy počasí WMO → obrázek a popis
const KODY = {
  0: ['☀️', 'jasno'], 1: ['🌤️', 'skoro jasno'], 2: ['⛅', 'polojasno'], 3: ['☁️', 'zataženo'],
  45: ['🌫️', 'mlha'], 48: ['🌫️', 'námraza'], 51: ['🌦️', 'mrholení'], 53: ['🌦️', 'mrholení'], 55: ['🌧️', 'silné mrholení'],
  56: ['🌧️', 'mrznoucí mrholení'], 57: ['🌧️', 'mrznoucí mrholení'],
  61: ['🌧️', 'slabý déšť'], 63: ['🌧️', 'déšť'], 65: ['🌧️', 'silný déšť'], 66: ['🌧️', 'mrznoucí déšť'], 67: ['🌧️', 'mrznoucí déšť'],
  71: ['🌨️', 'slabé sněžení'], 73: ['🌨️', 'sněžení'], 75: ['❄️', 'silné sněžení'], 77: ['🌨️', 'sněhová zrna'],
  80: ['🌦️', 'přeháňky'], 81: ['🌧️', 'přeháňky'], 82: ['⛈️', 'prudké přeháňky'], 85: ['🌨️', 'sněhové přeháňky'],
  86: ['🌨️', 'sněhové přeháňky'], 95: ['⛈️', 'bouřka'], 96: ['⛈️', 'bouřka s kroupami'], 99: ['⛈️', 'bouřka s kroupami'],
};
const kod = (k, noc) => {
  const [ikona, popis] = KODY[k] || ['🌡️', 'neznámo'];
  return [noc && k <= 1 ? '🌙' : ikona, popis];
};
const DNY = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const EN_DNY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VYCHOZI = { name: 'Praha', admin1: 'Hlavní město Praha', country: 'Česko', latitude: 50.088, longitude: 14.4208 };

async function stahni(url, signal) {
  const r = await fetch(pres(url), { signal });
  if (!r.ok) throw new Error(`Služba počasí odpověděla chybou ${r.status}.`);
  return r.json();
}

async function najdiMesto(nazev, signal) {
  const data = await stahni('https://geocoding-api.open-meteo.com/v1/search?count=1&language=' + jazykTed() + '&name=' + encodeURIComponent(nazev), signal);
  if (!data.results?.length) throw new Error(`Město „${nazev}“ jsem nenašel.`);
  const { name, admin1, country, latitude, longitude } = data.results[0];
  return { name, admin1, country, latitude, longitude };
}

/** Popis počasí podle kódu WMO („zataženo“) — domovská stránka Novy si kreslí vlastní ikony. */
export const popisPocasi = (k) => (KODY[k] || [null, 'neznámo'])[1];

export const predpoved = (m, signal) => stahni('https://api.open-meteo.com/v1/forecast?timezone=auto&forecast_days=7'
  + `&latitude=${m.latitude}&longitude=${m.longitude}`
  + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day'
  + '&hourly=temperature_2m,weather_code,is_day'
  + '&daily=temperature_2m_max,temperature_2m_min,weather_code', signal);

/** Město z aplikace (naposledy vyhledané), jinak Praha. */
export const mestoPocasi = () => State.get('pocasiMisto') || VYCHOZI;

/** Krátký text pro zámek — „15 °C, zataženo · Praha“. Uloží se, ať ho zámek ukáže hned. */
function zapamatuj(m, p) {
  const [ikona, popis] = kod(p.current.weather_code, !p.current.is_day);
  const teplota = Math.round(p.current.temperature_2m);
  const zaznam = { text: `${teplota} °C, ${popis} · ${m.name}`, teplota, popis, ikona, misto: m.name, cas: Date.now() };
  State.set('pocasiPosledni', zaznam);
  return zaznam;
}

/** Aktuální počasí pro zamykací obrazovku (stačí jedno číslo, ne celá předpověď). */
export async function aktualniPocasi(signal) {
  const m = mestoPocasi();
  const p = await stahni('https://api.open-meteo.com/v1/forecast?timezone=auto'
    + `&latitude=${m.latitude}&longitude=${m.longitude}&current=temperature_2m,weather_code,is_day`, signal);
  return zapamatuj(m, p);
}

export const pocasiApp = {
  id: 'weather', name: 'Počasí', icon: 'weather', color: 'linear-gradient(145deg,#4aa3e8,#2563a8)',
  cat: 'net', width: 460, height: 640,

  mount(body, win) {
    let ac = null;
    const pole = el('input.pc-pole', { placeholder: 'Město, třeba Brno', autocomplete: 'off', spellcheck: 'false' });
    const obsah = el('div.pc-obsah');
    const hledat = (e) => {
      e.preventDefault();
      if (pole.value.trim()) ukaz(pole.value.trim());
    };
    pole.addEventListener('keydown', (e) => e.stopPropagation());   // ať zkratky systému nekradou psaní

    body.append(el('div.pc', {},
      el('form.pc-hledani', { onsubmit: hledat }, pole, el('button.btn.primary', { text: 'Hledat' })),
      obsah,
      el('p.pc-zdroj', { text: 'Data: open-meteo.com' }),
    ));

    const zprava = (text) => obsah.replaceChildren(el('p.pc-zprava', { text }));

    function vykresli(m, p) {
      const [ikona, popis] = kod(p.current.weather_code, !p.current.is_day);

      // příštích 24 hodin od aktuální hodiny
      const ted = p.current.time.slice(0, 13);
      const od = Math.max(0, p.hourly.time.findIndex((t) => t.slice(0, 13) === ted));
      // první sloupec „teď“ bere aktuální měření, ať nesedí jiné číslo než velká teplota nahoře
      const hodiny = p.hourly.time.slice(od, od + 24).map((t, i) => el('div.pc-hodina', {},
        el('span', { text: i === 0 ? 'teď' : pad(new Date(t).getHours()) }),
        el('span.pc-hodina-ic', { text: i === 0 ? ikona : kod(p.hourly.weather_code[od + i], !p.hourly.is_day[od + i])[0] }),
        el('b', { text: Math.round(i === 0 ? p.current.temperature_2m : p.hourly.temperature_2m[od + i]) + '°' }),
      ));

      // pruh u každého dne ukazuje rozsah teplot vůči celému týdnu
      const min = Math.min(...p.daily.temperature_2m_min), max = Math.max(...p.daily.temperature_2m_max);
      const rozsah = Math.max(1, max - min);
      const dny = p.daily.time.map((den, i) => {
        const d = new Date(den);
        const lo = p.daily.temperature_2m_min[i], hi = p.daily.temperature_2m_max[i];
        return el('div.pc-den', {},
          el('span', { text: i === 0 ? 'dnes' : tx(`${DNY[d.getDay()]} ${d.getDate()}.`, `${EN_DNY[d.getDay()]} ${d.getDate()}`) }),
          el('span.pc-den-ic', { text: kod(p.daily.weather_code[i])[0] }),
          el('span.pc-min', { text: Math.round(lo) + '°' }),
          el('div.pc-pruh', {}, el('i', { style: { left: ((lo - min) / rozsah * 100) + '%', right: ((max - hi) / rozsah * 100) + '%' } })),
          el('span.pc-max', { text: Math.round(hi) + '°' }),
        );
      });

      obsah.replaceChildren(
        el('div.pc-ted', {},
          el('div.pc-misto', { text: m.name }),
          el('div.pc-kraj', { text: [m.admin1, m.country].filter(Boolean).join(', ') }),
          el('div.pc-ikona', { text: ikona }),
          el('div.pc-teplota', { text: Math.round(p.current.temperature_2m) + '°' }),
          el('div.pc-popis', { text: `${popis} · pocitově ${Math.round(p.current.apparent_temperature)}°` }),
          el('div.pc-detail', { text: `vítr ${Math.round(p.current.wind_speed_10m)} km/h · vlhkost ${p.current.relative_humidity_2m} %` }),
        ),
        el('div.pc-hodiny', {}, hodiny),
        el('div.pc-dny', {}, dny),
      );
      win.title = 'Počasí — ' + m.name;
      zapamatuj(m, p);            // zámek pak ukazuje totéž, co aplikace
    }

    async function firewall() {
      const { online, letadlo } = await import('../sit.js');
      if (!online()) throw new Error(letadlo() ? 'jsi v režimu Letadlo, předpověď počká.' : 'nejsi připojený k internetu.');
      const { firewallPovoli, zapisFirewall } = await import('../obrana.js');
      if (firewallPovoli('weather')) return;
      zapisFirewall('weather', 'Počasí');
      throw new Error('brána firewall Astro Defenderu Počasí nepouští na internet.');
    }

    async function nacti(m) {
      ac?.abort();
      ac = new AbortController();
      try {
        await firewall();
        vykresli(m, await predpoved(m, ac.signal));
      } catch (e) {
        if (e.name !== 'AbortError') zprava('Předpověď se nepodařilo stáhnout: ' + e.message);
      }
    }

    async function ukaz(nazev) {
      zprava(`Hledám ${nazev}…`);
      ac?.abort();
      ac = new AbortController();
      try {
        await firewall();
        const m = await najdiMesto(nazev, ac.signal);
        State.set('pocasiMisto', m);
        pole.value = '';
        await nacti(m);
      } catch (e) {
        if (e.name !== 'AbortError') zprava(e.message);
      }
    }

    zprava('Načítám…');
    nacti(mestoPocasi());
    const obnova = setInterval(() => nacti(mestoPocasi()), 15 * 60 * 1000);
    win.onClose = () => { clearInterval(obnova); ac?.abort(); };
  },

  unmount(win) { win.onClose?.(); },
};
