// AstroOS — katalog aplikací v Obchodě
//
// Dvanáct malých aplikací (ukázková verze — plná jich má dvacet), které jsou součástí kódu systému, ale v Startu a na ploše
// se objeví až po „stažení“ z Obchodu (seznam nainstalovaných drží nastavení
// pod klíčem `obchodAplikace`). Nic nezabírají na virtuálním disku — jen svoje
// uložené skóre a stav pod klíčem `oa:<id>`.
// Hodnocení, stažení a recenze jsou vymyšlené, ať Obchod vypadá živě.

import { State } from '../state.js';
import { piskvorky, raketa, pexeso, sibenice, reakce } from './hry1.js';
import { pomodoro, prevodnik, kostky, morse } from './nastroje.js';
import { PODEZRELE } from './podezrele.js';
import { piano, mazlicek, kaleidoskop } from './relax.js';

export const KLIC = 'obchodAplikace';
export const nainstalovane = () => State.get(KLIC) || [];

export const SEKCE = [
  { id: 'hry', nazev: 'Hry', popis: 'Na chvilku i na dlouho' },
  { id: 'hudba', nazev: 'Hudba a tvoření', popis: 'Hraj, kresli, skládej' },
  { id: 'relax', nazev: 'Pohoda', popis: 'Něco na odpočinek' },
  { id: 'nastroje', nazev: 'Užitečné', popis: 'Malé pomocníky do každého dne' },
];

/** Obalí funkci aplikace do definice pro registr: úklid po zavření okna a fokus pro klávesy. */
function apka(meta, spust) {
  return {
    ...meta,
    obchod: true,
    mount(body, win) {
      body.tabIndex = 0;
      body.classList.add('oa-telo');
      win.oaUklid = spust(body, win) || null;
      win.title = meta.name;
      setTimeout(() => body.focus(), 60);
      body.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('input, textarea, select')) setTimeout(() => body.focus({ preventScroll: true }), 0);
      });
    },
    unmount(win) { win.oaUklid?.(); },
  };
}

const G = (a, b) => `linear-gradient(145deg,${a},${b})`;

const ZAKLAD = [
  // ---------------------------------------------------------------- hry
  apka({
    id: 'oa-raketa', name: 'Raketa', icon: 'raketa', color: G('#ef6a5a', '#8e2a20'), cat: 'media', width: 460, height: 680,
    sekce: 'hry', autor: 'Kometa Games', hodnoceni: 4.6, hodnoceniPocet: 9120, stazeni: 388000, velikost: '188 kB', vek: '3+',
    kratce: 'Prolétni mezi asteroidy. Jedno tlačítko, nekonečně pokusů.',
    popis: 'Jeden zážeh motoru = jeden skok nahoru. Proplouvej mezerami ve skalách, sbírej body a překonej svůj rekord. Čím dál doletíš, tím podivnějšími místy vesmíru proletíš.',
    novinky: 'Opraveny kolize se skalami, které „nebyly vidět“. Prý.',
    recenze: [['Dominik', 5, 'Můj rekord je 41 a nikdo to nepřekoná.'], ['Lucie_K', 4, 'Strašně těžký, ale nejde přestat.'], ['pan_Novák', 3, 'Moje vnučka mě porazila. Pětkrát.']],
  }, raketa),
  apka({
    id: 'oa-piskvorky', name: 'Piškvorky', icon: 'piskvorky', color: G('#4aa3e8', '#1d4f86'), cat: 'media', width: 640, height: 700,
    sekce: 'hry', autor: 'AstroOS', hodnoceni: 4.5, hodnoceniPocet: 6420, stazeni: 274000, velikost: '64 kB', vek: '3+',
    kratce: 'Pět v řadě proti počítači, který nespí.',
    popis: 'Klasika ze sešitu s kostičkami, tentokrát proti počítači. Na lehké obtížnosti se dá vyhrát snadno, na těžké si soupeř všimne každé čtyřky. Skóre si aplikace pamatuje.',
    novinky: 'Počítač na těžké obtížnosti už nedělá hloupé chyby.',
    recenze: [['Ondra', 5, 'Na těžkou jsem vyhrál jednou. Mám to vyfocené.'], ['Bára', 4, 'Hodilo by se hrát i proti kamarádovi.'], ['Matěj', 5, 'Lepší než o přestávce na papíře.']],
  }, piskvorky),
  apka({
    id: 'oa-pexeso', name: 'Pexeso', icon: 'pexeso', color: G('#f07f9c', '#a63a5a'), cat: 'media', width: 620, height: 700,
    sekce: 'hry', autor: 'Bublina Studio', hodnoceni: 4.3, hodnoceniPocet: 2210, stazeni: 98000, velikost: '48 kB', vek: '3+',
    kratce: 'Najdi dvojice, trénuj paměť.',
    popis: 'Otáčej kartičky s vesmírnými obrázky a hledej páry. Malá hra 4 × 4 na rozehřátí, velká 6 × 6 pro opravdové paměťové mistry. Počítají se tahy i čas.',
    novinky: 'Nové obrázky karet.',
    recenze: [['babička Jana', 5, 'Hrajeme s vnoučaty každou neděli.'], ['Kuba', 4, '6×6 je fakt těžký.']],
  }, pexeso),
  apka({
    id: 'oa-sibenice', name: 'Šibenice', icon: 'sibenice', color: G('#7d8b96', '#3a444c'), cat: 'media', width: 640, height: 640,
    sekce: 'hry', autor: 'Slovíčkáři', hodnoceni: 4.1, hodnoceniPocet: 1320, stazeni: 61000, velikost: '40 kB', vek: '7+',
    kratce: 'Hádej slovo dřív, než bude pozdě.',
    popis: 'Česká slova v pěti kategoriích. Hádej písmena myší nebo klávesnicí — diakritika se doplní sama. Za uhádnutá slova za sebou roste série.',
    novinky: 'Přibyla kategorie Hry.',
    recenze: [['Tereza', 4, 'Slovo „mravenečník“ mě dostalo.'], ['Filip', 4, 'Hezká, jednoduchá.']],
  }, sibenice),
  apka({
    id: 'oa-reakce', name: 'Reakce', icon: 'blesk', color: G('#f0e05c', '#a8920f'), cat: 'media', width: 620, height: 520,
    sekce: 'hry', autor: 'Bleskovka', hodnoceni: 4.0, hodnoceniPocet: 940, stazeni: 44000, velikost: '12 kB', vek: '3+',
    kratce: 'Jak rychlé máš reflexy? Gepard, nebo lenochod?',
    popis: 'Čekej, až se plocha rozsvítí zeleně, a klikni co nejrychleji. Pět kol, průměr a zvíře, kterému se podobáš. Kdo klikne moc brzo, prohrál.',
    novinky: 'Nová zvířata ve výsledcích.',
    recenze: [['Max', 5, '198 ms, jsem sokol.'], ['Eliška', 3, 'Pořád mi to píše lenochod 🦥']],
  }, reakce),

  // ---------------------------------------------------------------- hudba a tvoření
  apka({
    id: 'oa-piano', name: 'AstroPiano', icon: 'piano', color: G('#2c3338', '#0d1013'), cat: 'media', width: 900, height: 420,
    sekce: 'hudba', autor: 'Notička', hodnoceni: 4.6, hodnoceniPocet: 4310, stazeni: 167000, velikost: '86 kB', vek: '3+',
    kratce: 'Dvě oktávy pod prsty — myší i klávesnicí.',
    popis: 'Hraj na piano, varhany, flétnu nebo syntezátor. Klávesy A až Ů jsou bílé, řada nad nimi černé. Melodii si můžeš nahrát a přehrát, a jedna slavná skladba je připravená jako ukázka.',
    novinky: 'Nový nástroj Flétna.',
    recenze: [['Natálka', 5, 'Zahrála jsem celou Ódu na radost!'], ['Jirka', 4, 'Na klávesnici se hraje super.']],
  }, piano),
  apka({
    id: 'oa-kaleidoskop', name: 'Kaleidoskop', icon: 'kaleidoskop', color: G('#f07f9c', '#6a43c0'), cat: 'media', width: 760, height: 640,
    sekce: 'hudba', autor: 'Bublina Studio', hodnoceni: 4.6, hodnoceniPocet: 2480, stazeni: 97000, velikost: '38 kB', vek: '3+',
    kratce: 'Kresli a sleduj, jak vznikají zářivé obrazce.',
    popis: 'Každá čára se zrcadlí kolem středu, takže i čmáranice vypadá jako mandala. Barvy se samy mění do duhy. Hotový obrázek ulož do Obrázků a nastav si ho třeba jako tapetu.',
    novinky: 'Tlačítko Náhoda pro línější umělce.',
    recenze: [['Sára', 5, 'Mám z toho tapetu na ploše 💜'], ['Tomáš', 4, 'Uklidňující.']],
  }, kaleidoskop),

  // ---------------------------------------------------------------- pohoda
  apka({
    id: 'oa-mazlicek', name: 'Mazlíček', icon: 'mazlicek', color: G('#54d98a', '#1e7c84'), cat: 'media', width: 480, height: 640,
    sekce: 'relax', autor: 'Planeta Gloop', hodnoceni: 4.9, hodnoceniPocet: 18900, stazeni: 731000, velikost: '96 kB', vek: '3+',
    kratce: 'Mimozemský kamarád, který na tebe čeká.',
    popis: 'Vylíhni si malého mimozemšťana, pojmenuj ho a starej se o něj — krm ho, hraj si s ním, umývej ho a ukládej ke spánku. Mazlíček žije dál, i když okno zavřeš, a s časem roste. Co se stane, když ho pohladíš?',
    novinky: 'Mazlíček teď ví, kdy jsi byl dlouho pryč.',
    recenze: [['Nela', 5, 'Jmenuje se Bublík a je to můj nejlepší kamarád.'], ['Vojta', 5, 'Ráno ho krmím dřív než sebe.'], ['maminka', 5, 'Konečně zvíře, které nešpiní koberec.']],
  }, mazlicek),

  // ---------------------------------------------------------------- užitečné
  apka({
    id: 'oa-pomodoro', name: 'Pomodoro', icon: 'pomodoro', color: G('#ef6a5a', '#b8382c'), cat: 'tools', width: 420, height: 620,
    sekce: 'nastroje', autor: 'Rajčátko', hodnoceni: 4.6, hodnoceniPocet: 3190, stazeni: 134000, velikost: '24 kB', vek: '3+',
    kratce: 'Pracuj 25 minut, pak pauza. Funguje to.',
    popis: 'Časovač podle techniky Pomodoro: soustředěná práce, krátká pauza, a po čtyřech kolech dlouhá. Délky si nastavíš sám, upozornění přijde do oznámení a počítá se, kolik rajčat máš dnes za sebou.',
    novinky: 'Odpočet běží dál, i když okno zavřeš a znovu otevřeš.',
    recenze: [['studentka Eva', 5, 'S tímhle jsem se naučila na přijímačky.'], ['Lukáš', 4, 'Upozornění je příjemné.']],
  }, pomodoro),
  apka({
    id: 'oa-prevodnik', name: 'Převodník', icon: 'prevodnik', color: G('#3fd0c8', '#1e6f92'), cat: 'tools', width: 560, height: 640,
    sekce: 'nastroje', autor: 'AstroOS', hodnoceni: 4.4, hodnoceniPocet: 2050, stazeni: 119000, velikost: '30 kB', vek: '3+',
    kratce: 'Délka, váha, teplota, měny… a banány.',
    popis: 'Převádí jednotky v osmi kategoriích. Kromě metrů a kilogramů tu jsou i jednotky, které ve škole neučí — kolik banánů měří fotbalové hřiště nebo kolik koček váží slon? Kurzy měn jsou orientační a offline.',
    novinky: 'Nové jednotky. Najdeš je?',
    recenze: [['Dan', 5, 'Moje výška je 9,6 banánu.'], ['Petra', 4, 'Používám hlavně na recepty.']],
  }, prevodnik),
  apka({
    id: 'oa-kostky', name: 'Kostky a náhoda', icon: 'kostka', color: G('#a077f0', '#c04a6a'), cat: 'tools', width: 560, height: 600,
    sekce: 'nastroje', autor: 'Štěstěna', hodnoceni: 4.5, hodnoceniPocet: 2870, stazeni: 104000, velikost: '34 kB', vek: '3+',
    kratce: 'Kostky, mince, losování a magická koule.',
    popis: 'Ztratila se kostka od Člověče, nezlob se? Tady jich je šest. K tomu hod mincí, losování ze jmen a magická koule, která odpoví na každou otázku ano/ne. Je opravdu vševědoucí? Zeptej se jí na něco zvláštního.',
    novinky: 'Magická koule ví víc, než se zdá.',
    recenze: [['Rodina Malých', 5, 'Losujeme s tím, kdo myje nádobí.'], ['Honza', 4, 'Koule mi řekla, že AstroOS je nejlepší. Souhlasím.']],
  }, kostky),
  apka({
    id: 'oa-morse', name: 'Morseovka', icon: 'morse', color: G('#f0b95c', '#7a4f12'), cat: 'tools', width: 760, height: 520,
    sekce: 'nastroje', autor: 'Pípající spolek', hodnoceni: 4.3, hodnoceniPocet: 1150, stazeni: 52000, velikost: '22 kB', vek: '7+',
    kratce: 'Překládej text do morseovky a ťukej zprávy.',
    popis: 'Vlevo napiš text a uslyšíš ho jako tečky a čárky (s blikajícím světlem). Vpravo ťukej mezerníkem nebo myší a aplikace tvoje pípání přeloží zpátky na písmena. Skvělé na táboráky, šifrovačky a tajné zprávy.',
    novinky: 'Podpora písmene CH.',
    recenze: [['skaut Ríša', 5, 'Používáme na výpravách.'], ['Alžběta', 4, 'Ťukání mi zatím moc nejde, ale baví mě to.']],
  }, morse),
];

// Podezřelé appky (podezrele.js) se zamíchají mezi normální: každá na pevné místo v řadě své sekce.
const POZICE = {
  'oa-mince': 3, 'oa-fotomistr': 1, 'oa-mp3': 3, 'oa-dovolena': 1,
  'oa-prani': 3, 'oa-ram': 1, 'oa-antivir': 3, 'oa-faktura': 5,
};

function zamichej() {
  const vse = [...ZAKLAD];
  for (const { spust, ...meta } of PODEZRELE) {
    const ve_sekci = vse.map((a, i) => [a, i]).filter(([a]) => a.sekce === meta.sekce);
    const kam = POZICE[meta.id] ?? ve_sekci.length;
    const idx = kam < ve_sekci.length ? ve_sekci[kam][1] : ve_sekci[ve_sekci.length - 1][1] + 1;
    vse.splice(idx, 0, apka(meta, spust));
  }
  return vse;
}

export const KATALOG = zamichej();

export const PODLE_ID = Object.fromEntries(KATALOG.map((a) => [a.id, a]));
