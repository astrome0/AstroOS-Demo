// AstroOS — síť: Wi-Fi sítě, režim Letadlo a hra „síťový detektiv“
//
// Všechno je vymyšlené. Skutečný počítač ani domácí síť se nečtou — sítě v dosahu, signál
// i rychlost jsou jen v AstroOS. „Online“ ale opravdu něco znamená: bez připojení (nebo
// v režimu Letadlo) Nova, Počasí, webové aplikace ani hledání AstroAI na internet nesmí.
//
// Hra: čas od času se v dosahu objeví nová síť. Heslo k ní je schované v systému — na účtence
// v Dokumentech, v e-mailu od souseda, na lístku na ploše… Kdo najde všechny, dostane heslo
// k té nejpodezřelejší síti.

import { State } from './state.js';
import { bus } from './util.js';
import * as FS from './fs.js';

const PLOCHA = FS.HOME + '/Plocha';

/** Sítě v okolí. `hra` = objeví se až časem a heslo je někde schované. */
export const SITE = [
  {
    id: 'astronet', ssid: 'AstroNet', zabezpeceni: 'WPA3', signal: 4, pasmo: '5 GHz', rychlost: 2400,
    profil: 'soukroma', heslo: 'astro-domov',
  },
  {
    id: 'kosmodrom', ssid: 'Kosmodrom_Free', zabezpeceni: null, signal: 2, pasmo: '2,4 GHz', rychlost: 54,
    profil: 'verejna',
  },
  {
    id: 'fbi', ssid: 'FBI_Dodávka_7', zabezpeceni: 'WPA2', signal: 3, pasmo: '5 GHz', rychlost: 866,
    profil: 'verejna', heslo: 'nejsmetady',
    napoveda: 'Heslo zná jen agent. Možná ti ho prozradí, až najdeš všechny ostatní sítě…',
  },
  {
    id: 'kometa', ssid: 'Kavárna U Komety', zabezpeceni: 'WPA2', signal: 2, pasmo: '2,4 GHz', rychlost: 144,
    profil: 'verejna', heslo: 'espresso42', hra: 1,
    napoveda: 'Byl jsi tam nedávno na kafi. Nezůstala ti účtenka v Dokumentech?',
    stopa: () => zapis(FS.HOME + '/Dokumenty', 'Účtenka – Kavárna U Komety.txt', [
      '        KAVÁRNA U KOMETY',
      '     Hvězdná 12, Astro City',
      '--------------------------------',
      '1× Espresso doppio        59 Kč',
      '1× Kometový koláč         72 Kč',
      '--------------------------------',
      'CELKEM                   131 Kč',
      '',
      'Wi-Fi pro hosty: Kavárna U Komety',
      'Heslo: espresso42',
      '',
      '   Děkujeme a zase přileťte!',
    ].join('\n')),
  },
  {
    id: 'pepa', ssid: 'Soused_Pepa', zabezpeceni: 'WPA2', signal: 3, pasmo: '2,4 GHz', rychlost: 300,
    profil: 'soukroma', heslo: 'Bobik2009', hra: 2,
    napoveda: 'Pepa ti psal do Pošty. Heslo si musíš poskládat sám.',
    stopa: () => posta({
      od: 'pepa.soused@astroos', odJmeno: 'Pepa (soused)',
      predmet: 'Wifina, kdybys potřeboval',
      telo: 'Ahoj sousede!\n\nViděl jsem, že ti občas padá internet. Klidně se připoj na moji wifinu, '
        + 'jmenuje se Soused_Pepa.\n\nHeslo je jméno našeho psa (s velkým písmenem, bez háčků) a hned za ním '
        + 'rok, kdy jsme se sem přistěhovali.\n\nPamatuješ, jak Bobík v roce 2009 celý den štěkal na stěhováky? '
        + 'Od té doby se to nezměnilo :D\n\nPepa',
    }),
  },
  {
    id: 'babicka', ssid: 'Babička_Wifi', zabezpeceni: 'WPA2', signal: 1, pasmo: '2,4 GHz', rychlost: 72,
    profil: 'soukroma', heslo: '12345678', hra: 3,
    napoveda: 'Babička ti nechala lístek na ploše.',
    stopa: () => zapis(PLOCHA, 'Lístek od babičky.txt',
      'Ahoj zlatíčko,\n\nkdyž budeš u mě, připoj se na wifinu. Heslo mám jednoduché, ať si ho '
      + 'zapamatuju: osm čísel, jak jdou po sobě, od jedničky.\n\nV ledničce máš řízek.\nPusu, babička'),
  },
  {
    id: 'lab', ssid: 'AstroLab_Tajné', zabezpeceni: 'WPA3', signal: 2, pasmo: '5 GHz', rychlost: 1200,
    profil: 'soukroma', heslo: 'hvezdy', hra: 4,
    napoveda: 'Něco se stáhlo do složky Stažené. Julius Caesar by věděl, co s tím.',
    stopa: () => zapis(FS.HOME + '/Stažené', 'lab-poznámka.txt',
      'INTERNÍ — NEPŘEPOSÍLAT\n\nHeslo k síti AstroLab_Tajné jsme zašifrovali, ať ho nikdo cizí nepřečte:\n\n'
      + '    KYHCGB\n\nKaždé písmeno je posunuté o 3 dál v abecedě (A→D, B→E…). '
      + 'Kdo ho chce přečíst, musí posouvat zpátky.\n\n— Laboratoř AstroOS'),
  },
  {
    id: 'otazka', ssid: 'Odpověď_na_všechno', zabezpeceni: 'WPA2', signal: 2, pasmo: '5 GHz', rychlost: 420,
    profil: 'verejna', heslo: '42', hra: 5,
    napoveda: 'Odpověď na základní otázku života, vesmíru a vůbec. (Stopařův průvodce po Galaxii)',
  },
];

const HERNI = SITE.filter((s) => s.hra).sort((a, b) => a.hra - b.hra);
export const sit = (id) => SITE.find((s) => s.id === id);

const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function zapis(slozka, nazev, text) {
  try {
    if (!FS.exists(slozka)) FS.mkdir(slozka, { parents: true });
    FS.write(`${slozka}/${nazev}`, text + '\n');
  } catch { /* plný disk — nápověda v seznamu sítí to stejně řekne */ }
}

function posta(zprava) {
  import('./apps/posta.js').then(({ dorucZpravu }) => dorucZpravu(zprava)).catch(() => {});
}

const toast = (o) => import('./ui.js').then(({ toast: t }) => t(o));

// ---------------------------------------------------------------- stav
const zname = () => ({ astronet: true, ...(State.get('sitZname') || {}) });
const hra = () => ({ objevene: [], dalsi: 0, konec: false, ...(State.get('sitHra') || {}) });

export const letadlo = () => !!State.get('letadlo');
export const wifiZapnuta = () => !!State.get('wifi');
export const aktualni = () => (wifiZapnuta() && State.get('sit') !== null ? sit(State.get('sit') ?? 'astronet') || null : null);
/** Smí AstroOS na internet? */
export const online = () => !!aktualni();
export const jeZnama = (id) => !!zname()[id];
export const viditelna = (id) => !sit(id)?.hra || hra().objevene.includes(id);

/** Text pro lištu, zámek a dlaždici. */
export function popis() {
  if (letadlo() && !wifiZapnuta()) return 'Režim Letadlo';
  if (!wifiZapnuta()) return 'Wi-Fi vypnutá';
  return aktualni()?.ssid || 'Nepřipojeno';
}

/** Profil pro bránu firewall (Astro Defender). Bez připojení se bere jako veřejná síť. */
export const profil = () => aktualni()?.profil || 'verejna';

const zmena = () => bus.emit('sit:zmena');

/** Sítě v dosahu, seřazené: připojená, známé, podle signálu. Signál trochu kolísá. */
export function vDosahu() {
  if (!wifiZapnuta()) return [];
  const ted = aktualni()?.id;
  return SITE.filter((s) => viditelna(s.id))
    .map((s) => ({
      ...s,
      sila: Math.max(1, Math.min(4, s.signal + (Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0))),
      pripojena: s.id === ted,
      znama: jeZnama(s.id) || !s.zabezpeceni,
    }))
    .sort((a, b) => (b.pripojena - a.pripojena) || (b.znama - a.znama) || (b.sila - a.sila));
}

// ---------------------------------------------------------------- akce
export function nastavWifi(zapnout) {
  State.set('wifi', !!zapnout);
  if (zapnout && State.get('sit') === null) State.set('sit', 'astronet');
  zmena();
}

export function nastavLetadlo(zapnout) {
  if (zapnout) {
    State.patch({ letadlo: true, letadloPred: { wifi: wifiZapnuta(), bluetooth: !!State.get('bluetooth') }, wifi: false, bluetooth: false });
  } else {
    const pred = State.get('letadloPred') || { wifi: true, bluetooth: false };
    State.patch({ letadlo: false, wifi: pred.wifi, bluetooth: pred.bluetooth });
  }
  zmena();
}

export function odpoj() {
  State.set('sit', null);
  zmena();
}

export function zapomen(id) {
  if (id === 'astronet') return;
  const z = { ...(State.get('sitZname') || {}) };
  delete z[id];
  State.set('sitZname', z);
  if (State.get('sit') === id) State.set('sit', null);
  zmena();
}

/** Připojí se k síti. Vrací { ok } nebo { ok: false, chyba }. Chvíli to trvá, jako doopravdy. */
export async function pripoj(id, heslo = '') {
  const s = sit(id);
  if (!s || !wifiZapnuta()) return { ok: false, chyba: 'Wi-Fi je vypnutá.' };
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 900));
  if (s.zabezpeceni && !jeZnama(id) && bezDiakritiky(heslo) !== bezDiakritiky(s.heslo)) {
    return { ok: false, chyba: 'Heslo není správné.' };
  }
  const prvniPripojeni = !jeZnama(id);
  State.patch({ sit: id, sitZname: { ...(State.get('sitZname') || {}), [id]: true } });
  zmena();
  if (s.profil === 'verejna') {
    toast({ title: `Připojeno k ${s.ssid}`, body: 'Veřejná síť — Astro Defender přepnul bránu firewall na veřejný profil.', icon: 'shield' });
  }
  if (prvniPripojeni && (s.hra || s.id === 'fbi')) oslav(s);
  return { ok: true };
}

// ---------------------------------------------------------------- hra
const DETEKTIV = 'Síťový detektiv';
export function stavHry() {
  const h = hra();
  const vsechny = [...HERNI, sit('fbi')];
  return {
    nalezeno: vsechny.filter((s) => jeZnama(s.id)).length,
    celkem: vsechny.length,
    objevene: h.objevene.length,
    konec: h.konec,
  };
}

function oslav(s) {
  const { nalezeno, celkem } = stavHry();
  if (s.id === 'fbi') {
    State.set('sitHra', { ...hra(), konec: true });
    toast({ title: `🕵️ ${DETEKTIV}`, body: 'Všechny sítě v okolí jsou tvoje. Dodávka FBI to ví.', icon: 'star', timeout: 9000 });
    return;
  }
  toast({ title: `Heslo prolomeno! ${nalezeno}/${celkem}`, body: `Jsi připojený k ${s.ssid}.`, icon: 'key', timeout: 6000 });
  if (HERNI.every((h) => jeZnama(h.id)) && !hra().fbiPoslano) {
    State.set('sitHra', { ...hra(), fbiPoslano: true });
    setTimeout(() => posta({
      od: 'agent.k@fbi-dodavka.fake', odJmeno: 'Agent K.',
      predmet: 'Víme, co děláš',
      telo: 'Dobrý den,\n\nsledujeme vás. Pět sítí za sebou, to už není náhoda.\n\nUznáváme schopnosti. '
        + 'Heslo k naší dodávce je: nejsmetady\n\nTato zpráva se nezničí sama, protože to neumíme.\n\nAgent K.',
    }), 8000);
  }
}

/** Objeví další síť ze hry: ukáže ji v dosahu a schová k ní stopu. */
export function objevDalsi() {
  const h = hra();
  const dalsi = HERNI.find((s) => !h.objevene.includes(s.id));
  if (!dalsi) return null;
  State.set('sitHra', { ...h, objevene: [...h.objevene, dalsi.id], dalsi: Date.now() + (4 + Math.random() * 3) * 60000 });
  dalsi.stopa?.();
  zmena();
  toast({
    title: 'Nová síť v dosahu', body: `${dalsi.ssid} — zkus zjistit heslo.`, icon: 'wifi', timeout: 7000,
    onClick: () => import('./taskbar.js').then((m) => m.otevriSite?.()),
  });
  return dalsi;
}

let tik = null;
/** Hra běží jen na ploše a jen se zapnutou Wi-Fi — v letadle se nové sítě neobjevují. */
export function spustHru() {
  clearInterval(tik);
  const h = hra();
  if (!h.dalsi) State.set('sitHra', { ...h, dalsi: Date.now() + 2 * 60000 });
  tik = setInterval(() => {
    const { dalsi, objevene } = hra();
    if (!wifiZapnuta() || objevene.length >= HERNI.length) return;
    if (Date.now() >= dalsi) objevDalsi();
  }, 15000);
}

export function zastavHru() { clearInterval(tik); }
