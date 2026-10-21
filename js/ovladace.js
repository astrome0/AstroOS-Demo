// AstroOS — AstroGPU: jádro grafického ovladače (jako NVIDIA App)
//
// Běží na pozadí (spustSluzbu z taskbar.js): hledá nové ovladače, stahuje je a instaluje.
// Všechno je kulisa, ale chová se jako skutečný ovladač: při odebrání starého přejde systém
// na „základní grafiku“ (bez skla, vybledlé barvy), při instalaci obrazovka bliká a na pár
// vteřin zčerná, pak se přepne rozlišení. Digitální živost a odstín opravdu mění barvy
// celého systému (filtr na <body>). Stav v nastavení pod klíčem `ovladac`.

import { bus, sleep, clamp } from './util.js';
import { State } from './state.js';
import { toast } from './ui.js';

const KLIC = 'ovladac';

export const GPU = { nazev: 'AstroGPU AX 4070', pamet: 12, typPameti: 'GDDR6X', jader: 5888 };
export const TYPY = { game: 'Game Ready', studio: 'Studio' };

const VYCHOZI_OBRAZ = { zivost: 50, odstin: 0, latence: 'vyp', vsync: 'aplikace', fpsLimit: 0 };

const VYCHOZI = {
  verze: '571.20', nainstalovanyTyp: 'game', velikost: 612,
  nainstalovano: Date.now() - 6 * 864e5,
  typ: 'game',                 // co chce uživatel dostávat
  historie: [], cekajici: null, posledniKontrola: null,
  kontrola: '30min', autoStahovat: false, oznameni: true,
  ...VYCHOZI_OBRAZ,
};

const data = { ...VYCHOZI, ...(State.get(KLIC) || {}) };
// formát z první verze (bez stahování a typů)
if (data.cekajici && !data.cekajici.novinky) data.cekajici = null;
data.historie = data.historie.filter((h) => h.nainstalovano && h.odebrano);
export const nastaveni = () => data;

function uloz() {
  State.set(KLIC, data);
  bus.emit('ovladac', data);
}

export function nastav(klic, hodnota) {
  data[klic] = hodnota;
  if (klic in VYCHOZI_OBRAZ) aplikujObraz();
  if (klic === 'kontrola') naplanuj();
  uloz();
}

// ---------------------------------------------------------------- obraz (digitální živost)
export function aplikujObraz() {
  const f = [];
  if (data.zivost !== 50) f.push(`saturate(${(data.zivost / 50).toFixed(2)})`);
  if (data.odstin) f.push(`hue-rotate(${data.odstin}deg)`);
  document.documentElement.style.setProperty('--gpu-filtr', f.length ? f.join(' ') : 'none');
}
aplikujObraz();

export function obnovObraz() {
  Object.assign(data, VYCHOZI_OBRAZ);
  aplikujObraz();
  uloz();
}

// ---------------------------------------------------------------- poznámky k vydání
const NOVINKY = {
  game: [
    'Game Ready pro Miny a 2048 — plynulejší animace dlaždic',
    'Až o 18 % víc snímků ve hře Had',
    'Podpora nových her z Obchodu AstroOS',
    'Nižší odezva při hraní v okně',
    'Optimalizace pro widgety na ploše',
  ],
  studio: [
    'Studio: rychlejší plátno v Malování',
    'Studio: plynulejší živý náhled v Editoru kódu',
    'Studio: přesnější barvy ve Fotkách',
    'Studio: stabilnější nahrávání v Diktafonu',
    'Studio: rychlejší export obrázků na disk',
  ],
};
const OPRAVY = [
  'Opraveno občasné škubnutí při přepínání ploch',
  'Opraveno blikání kurzoru v Terminálu',
  'Opraveno zaseknutí náhledu v Editoru po uložení',
  'Opravena černá obrazovka po probuzení ze spánku',
  'Opraveno rozmazání ikon při velikosti „velké“',
  'Opraveno vypadávání zvuku v Hudbě při přehrávání videa v Nově',
  'Opraveno problikávání průhledného panelu při skrývání',
];
const ZNAME = [
  'Obrazovka může během instalace několikrát bliknout nebo na pár vteřin zčernat.',
  'Widget teploty může po probuzení chvíli ukazovat nesmyslnou hodnotu.',
  'Při velmi rychlém přepínání ploch může problikávat hlavní panel.',
];

const vyber = (pole, n) => [...pole].sort(() => Math.random() - 0.5).slice(0, n);

// ---------------------------------------------------------------- stav běhu
const beh = { faze: null, stazeno: 0, celkem: 0, rychlost: 0, zrusit: false, kroky: [], krok: -1, hotovo: null };
export const prubeh = () => beh;
const emit = () => bus.emit('ovladac:prubeh', beh);

/** kontroluje | stahuje | instaluje | stazeno | dostupny | aktualni */
export function faze() {
  if (beh.faze) return beh.faze;
  if (!data.cekajici) return 'aktualni';
  return data.cekajici.stazeno ? 'stazeno' : 'dostupny';
}

function pripravAktualizaci(typ = data.typ) {
  if (data.cekajici && data.cekajici.typ === typ) return data.cekajici;
  const zaklad = Math.max(parseInt(data.verze, 10) || 571, parseInt(data.cekajici?.verze, 10) || 0);
  data.cekajici = {
    verze: `${zaklad + 1}.${10 + Math.floor(Math.random() * 88)}`,
    typ,
    novinky: vyber(NOVINKY[typ], 2 + Math.floor(Math.random() * 2)),
    opravy: vyber(OPRAVY, 2 + Math.floor(Math.random() * 2)),
    zname: vyber(ZNAME, 1),
    velikost: 480 + Math.floor(Math.random() * 420),
    vydano: Date.now(),
    stazeno: false,
  };
  return data.cekajici;
}

export function otevriAplikaci(stranka = 'ovladace') {
  import('./apps.js').then(({ openApp }) => openApp('astrogpu', { stranka }));
}

// ---------------------------------------------------------------- kontrola
/** Ruční kontrola z aplikace. Vrací fázi po kontrole. */
export async function zkontrolujTed() {
  if (beh.faze) return faze();
  beh.faze = 'kontroluje';
  emit();
  await sleep(1300 + Math.random() * 900);
  beh.faze = null;
  data.posledniKontrola = Date.now();
  if (data.cekajici || Date.now() - data.nainstalovano > 2 * 60e3) pripravAktualizaci();
  uloz();
  emit();
  return faze();
}

let casovac = 0;
function naplanuj() {
  clearTimeout(casovac);
  if (data.kontrola === 'vyp') return;
  const za = data.kontrola === 'denne'
    ? Math.max(5 * 60e3, (data.posledniKontrola || 0) + 864e5 - Date.now())
    : (25 + Math.random() * 15) * 60e3;
  casovac = setTimeout(automatickaKontrola, za);
}

function automatickaKontrola() {
  data.posledniKontrola = Date.now();
  const nove = !data.cekajici && !beh.faze;
  if (!beh.faze) pripravAktualizaci();
  uloz();
  if (nove) {
    if (data.autoStahovat) stahni();
    else if (data.oznameni) {
      const u = data.cekajici;
      toast({
        title: 'Nový ovladač AstroGPU k dispozici',
        body: `${TYPY[u.typ]} ${u.verze} · ${u.velikost} MB`,
        icon: 'gpu', timeout: 9000, onClick: () => otevriAplikaci(),
      });
    }
  }
  naplanuj();
}

let sluzba = false;
export function spustSluzbu() {
  if (sluzba) return;
  sluzba = true;
  naplanuj();
}

/** Přepnutí Game Ready ↔ Studio: nabídne ovladač zvoleného typu. */
export function nastavTyp(typ) {
  if (beh.faze === 'instaluje') return;
  if (beh.faze === 'stahuje') beh.zrusit = true;
  data.typ = typ;
  if (typ !== data.nainstalovanyTyp || data.cekajici) pripravAktualizaci(typ);
  uloz();
}

// ---------------------------------------------------------------- stahování
export async function stahni() {
  const u = data.cekajici;
  if (beh.faze || !u || u.stazeno) return false;
  Object.assign(beh, { faze: 'stahuje', stazeno: 0, celkem: u.velikost * 1024 * 1024, rychlost: 0, zrusit: false });
  emit();

  let mbs = 45 + Math.random() * 40;
  let posledni = performance.now();
  while (beh.stazeno < beh.celkem) {
    await sleep(200);
    if (beh.zrusit || data.cekajici !== u) {
      beh.faze = null;
      emit();
      return false;
    }
    const ted = performance.now();
    const dt = Math.min(1.5, (ted - posledni) / 1000);
    posledni = ted;
    mbs = clamp(mbs + (Math.random() - 0.5) * 14, 18, 115);
    beh.rychlost = mbs * 1024 * 1024;
    beh.stazeno = Math.min(beh.celkem, beh.stazeno + beh.rychlost * dt);
    emit();
  }

  beh.faze = null;
  u.stazeno = true;
  uloz();
  emit();
  if (data.oznameni) {
    toast({
      title: 'Ovladač je připravený k instalaci',
      body: `AstroGPU · ${TYPY[u.typ]} ${u.verze} je stažený.`,
      icon: 'gpu', timeout: 9000, onClick: () => otevriAplikaci(),
    });
  }
  return true;
}

export function zrusStahovani() {
  if (beh.faze === 'stahuje') beh.zrusit = true;
}

// ---------------------------------------------------------------- efekty obrazovky
let cernaVrstva = null;

async function zcernej(ms) {
  if (!cernaVrstva) cernaVrstva = document.createElement('div');
  cernaVrstva.className = 'gpu-cerno';
  document.body.append(cernaVrstva);
  await sleep(ms);
  cernaVrstva.remove();
}

function prepniRozliseni() {
  const koren = document.documentElement;
  koren.classList.remove('gpu-prepnuti');
  void koren.offsetWidth;
  koren.classList.add('gpu-prepnuti');
  setTimeout(() => koren.classList.remove('gpu-prepnuti'), 800);
}

const zakladniGrafika = (zap) => document.documentElement.classList.toggle('gpu-bez-ovladace', zap);

async function provedKrok(k) {
  if (k.fx === 'odebrat') {
    await sleep(k.ms * 0.55);
    await zcernej(260);
    zakladniGrafika(true);
    prepniRozliseni();
    await sleep(k.ms * 0.45);
  } else if (k.fx === 'cista') {
    Object.assign(data, VYCHOZI_OBRAZ);
    aplikujObraz();
    await sleep(k.ms);
  } else if (k.fx === 'instalovat') {
    await sleep(1100);
    await zcernej(380);
    await sleep(900);
    await zcernej(110);
    await sleep(90);
    await zcernej(160);
    await sleep(1200);
    await zcernej(2100);                 // tady se opravdu přepíná ovladač
    zakladniGrafika(false);
    prepniRozliseni();
    await sleep(1000);
    await zcernej(140);
    await sleep(Math.max(300, k.ms - 5300));
  } else {
    await sleep(k.ms);
  }
}

// ---------------------------------------------------------------- instalace
/** o = { cista, audio, physx, reinstalace } */
export async function nainstaluj({ cista = false, audio = true, physx = true, reinstalace = false } = {}) {
  if (beh.faze) return;
  const u = reinstalace ? { verze: data.verze, typ: data.nainstalovanyTyp, velikost: data.velikost } : data.cekajici;
  if (!u || (!reinstalace && !u.stazeno)) return;
  const stara = data.verze;

  const kroky = [
    { t: 'Kontrola kompatibility systému', ms: 1100 },
    { t: 'Příprava instalace', ms: 1500 },
    { t: `Odebírání ovladače ${stara}`, ms: 2300, fx: 'odebrat' },
    cista ? { t: 'Obnovení výchozího nastavení grafiky', ms: 900, fx: 'cista' } : null,
    { t: `Instalace grafického ovladače ${u.verze}`, ms: 7000, fx: 'instalovat' },
    audio ? { t: 'Instalace ovladače HD Audio', ms: 1300 } : null,
    physx ? { t: 'Instalace systémového softwaru PhysX', ms: 1100 } : null,
    { t: 'Dokončování', ms: 900 },
  ].filter(Boolean).map((k) => ({ ...k, stav: 'ceka' }));

  Object.assign(beh, { faze: 'instaluje', kroky, krok: 0, cil: u, reinstalace, hotovo: null });
  emit();

  try {
    for (let i = 0; i < kroky.length; i++) {
      beh.krok = i;
      kroky[i].stav = 'bezi';
      emit();
      await provedKrok(kroky[i]);
      kroky[i].stav = 'hotovo';
      emit();
    }
  } finally {
    zakladniGrafika(false);
  }

  if (!reinstalace) {
    data.historie.unshift({ verze: stara, typ: data.nainstalovanyTyp, nainstalovano: data.nainstalovano, odebrano: Date.now() });
    data.historie.length = Math.min(data.historie.length, 20);
    data.verze = u.verze;
    data.nainstalovanyTyp = u.typ;
    data.velikost = u.velikost;
    data.cekajici = null;
  }
  data.nainstalovano = Date.now();
  beh.faze = null;
  beh.hotovo = { verze: u.verze, typ: u.typ, cista, reinstalace, cas: Date.now() };
  uloz();
  emit();
  toast({
    title: reinstalace ? 'Ovladač přeinstalován' : 'Instalace dokončena',
    body: `AstroGPU · ${TYPY[u.typ]} ${u.verze} je nainstalovaný.`,
    icon: 'gpu', onClick: () => otevriAplikaci(),
  });
}

export const zavriHotovo = () => { beh.hotovo = null; emit(); };
