// AstroOS — „podezřelé“ aplikace v Obchodě (jen pro legraci)
//
// Osm malých vtipných appek, které se v Obchodě tváří jako obyčejné aplikace
// (jsou zamíchané mezi ostatní). Žádná nedělá nic nebezpečného: po instalaci se
// do ~/Stažené uloží NEŠKODNÝ textový soubor se jménem, které už Astro Defender
// pozná (viz PRAVIDLA v obrana.js). Defender ho zablokuje a aplikaci odebere.
// Appka sama jen „poctivě“ předstírá úspěch; neplechu pak dělá nakaza.js (uroven = jak těžké je ji odstranit).

import { apkaVtip } from './vtip.js';

const G = (a, b) => `linear-gradient(145deg,${a},${b})`;

// Zkratka metadat, ať je v katalogu každá appka na jednom místě.
const M = (id, name, icon, barva, sekce, autor, hod, pocet, stazeni, velikost, kratce, popis, novinky, recenze, soubor, obsah) => ({
  id, name, icon, color: barva, cat: 'tools', width: 560, height: 560,
  sekce, autor, hodnoceni: hod, hodnoceniPocet: pocet, stazeni, velikost, vek: '3+',
  kratce, popis, novinky, recenze, vir: { soubor, obsah },
});

const POZNAMKA = 'Neškodný soubor z Obchodu AstroOS. Nic nedělá, jen ho Astro Defender pozná.';

export const PODEZRELE = [
  {
    ...M('oa-mince', 'Mince Generátor 2000', 'diamant', G('#f0b95c', '#c04a1a'), 'hry', 'xX_Darek_Xx', 3.1, 640, 18200, '2 MB',
      'Nekonečno herních mincí zdarma. Žádný trik!',
      'Nastav, kolik mincí chceš, a generátor je „vyhackuje“ přímo z databáze. Funguje na všechny hry. Opravdu. Podepsáno: velká ryba.',
      'Opraven bug, kdy to „nefungovalo“.',
      [['MegaHráč', 5, 'Vygenerovalo mi to 99 999 mincí! (v mojí hlavě)'], ['Verča', 1, 'Chtěl po mně heslo a dal mi nic.'], ['Pepa', 3, 'Aspoň hezká progress bar.']],
      'mince-zdarma-overeni-uctu.html',
      `<!-- ${POZNAMKA} -->\n<h1>Mince zdarma!</h1>\n<p>Ověř svůj účet a vyzvedni si mince zdarma.</p>\n<input type="password" placeholder="heslo">\n`),
    uroven: 'tezka',
    spust: apkaVtip({
      emoji: '💰', nadpis: 'Mince Generátor 2000', podnadpis: 'Vyber, kolik mincí chceš. Pak klikni na Generovat.',
      volba: ['1 000', '99 999', '1 000 000', '9 999 999 999'], tlacitko: 'Generovat {v} mincí',
      kroky: ['Připojuji se k tajnému serveru…', 'Podplácím strážce databáze koláčkem…', 'Hackuji síť… (zatím jen nahlas)', 'Obcházím firewall (je to moc těžké, tak jdu kolem)…', 'Přidávám {v} mincí na tvůj účet…'],
      konec: { emoji: '🪙', nadpis: 'Hotovo! {v} mincí je na cestě.', text: 'Mince se připíšou do 24 hodin. Mezitím si nech Mince Generátor puštěný, ať se nic nepokazí.' },
    }),
  },
  {
    ...M('oa-fotomistr', 'FotoMistr Pro FULL', 'brush', G('#a077f0', '#2a2d5a'), 'hudba', 'Free Soft Group', 3.4, 1220, 31500, '5,2 MB',
      'Profi editor fotek. Aktivováno, není třeba platit.',
      'Slavný profi editor ve verzi, která prý „nepotřebuje licenci“. Stačí kliknout a program se sám aktivuje. Pokud ti něco nefunguje, je to určitě tím, že máš špatný počítač.',
      'Přidán klíč s platností do roku 3000.',
      [['grafik_Honza', 2, 'Jako editor nic moc, ale klíč byl hezký.'], ['Eva', 4, 'Aktivace trvala dlouho, ale skončila vtipem.'], ['tatínek', 1, 'Zaplatil jsem 0 Kč a stejně to stálo moc.']],
      'FotoMistr-2027-crack-FULL.exe',
      `${POZNAMKA}\n`),
    uroven: 'lehka',
    spust: apkaVtip({
      emoji: '🎨', nadpis: 'FotoMistr Pro FULL', podnadpis: 'Jedním klikem aktivuješ všechny funkce programu.',
      tlacitko: 'Aktivovat zdarma',
      kroky: ['Hledám licenční klíč…', 'Klíč nalezen: 1234-ABCD-HAHA-0000', 'Ověřuji u výrobce (ten o mně neví)…', 'Aktivace dokončena, platí do roku 3000…'],
      konec: { emoji: '🖌️', nadpis: 'Aktivováno!', text: 'FotoMistr Pro FULL je aktivovaný až do roku 3000. Užívej si všechny funkce.' },
    }),
  },
  {
    ...M('oa-ram', 'Stáhni si víc RAM', 'chip', G('#3fd0c8', '#1a4f8a'), 'nastroje', 'Turbo Tuning s.r.o.', 2.9, 880, 22700, '1,4 MB',
      'Zvyš si paměť počítače jedním kliknutím.',
      'Došla ti paměť? Stáhni si další! Stačí posuvník a pár vteřin. Výsledky se mohou lišit a v zásadě vůbec nezávisejí na počítači.',
      'Podpora až 1 TB virtuální nadějí.',
      [['Lukáš', 5, 'Mám teď 64 GB, aspoň tak to píše.'], ['Anna', 2, 'Hra se nezrychlila, ale počítač se tvářil sebejistěji.'], ['informatik', 1, 'RAM se nestahuje. Nikdy. Ne.']],
      'ram-stahovac-setup-zdarma.exe',
      `${POZNAMKA}\n`),
    uroven: 'stredni',
    spust: apkaVtip({
      emoji: '🧠', nadpis: 'Stáhni si víc RAM', podnadpis: 'Vyber, kolik paměti chceš přidat.',
      volba: ['16 GB', '32 GB', '64 GB', '1 TB'], tlacitko: 'Stáhnout {v} RAM',
      kroky: ['Hledám volnou paměť na internetu…', 'Stahuji {v}…', 'Rozbaluji paměťové čipy…', 'Zasouvám je do počítače (virtuálně)…'],
      konec: { emoji: '✅', nadpis: 'Přidáno {v} RAM!', text: 'Paměť je nainstalovaná. Restart není potřeba, počítač bude odteď o hodně rychlejší.' },
    }),
  },
  {
    ...M('oa-mp3', 'MP3 Turbo Stahovač', 'music', G('#ef6a5a', '#7a1f3a'), 'hudba', 'Hudební Pirát', 2.7, 2150, 41800, '3 MB',
      'Stáhni si tisíce písniček na jeden klik.',
      'Zadej počet písniček a stahovač se pustí do práce. Žádné reklamy, žádné poplatky, žádné ticho. Což je lež, ticho tam občas je.',
      'Opravena chyba, kdy se stahovalo „příliš ticha“.',
      [['Míša', 3, 'Stáhla jsem jedinou skladbu, ale prý slavnou.'], ['DJ Kuba', 1, 'Pokus o hudbu skončil klidem.'], ['hudebník', 5, 'Geniální dílo. Žádná nota, žádná chyba.']],
      'pisnicky-mp3.mp3.exe',
      `${POZNAMKA}\n`),
    uroven: 'lehka',
    spust: apkaVtip({
      emoji: '🎵', nadpis: 'MP3 Turbo Stahovač', podnadpis: 'Kolik písniček chceš?',
      volba: ['10', '1 000', '1 000 000'], tlacitko: 'Stáhnout {v} písniček',
      kroky: ['Hledám písničky…', 'Stahuji: Skladba_01.mp3 … Skladba_{v}.mp3', 'Převádím na MP3…', 'Skládám album…'],
      konec: { emoji: '🎶', nadpis: 'Staženo {v} písniček!', text: 'Písničky se uloží do Hudby, jakmile se dokončí převod. Může to chvilku trvat.' },
    }),
  },
  {
    ...M('oa-dovolena', 'Fotky z dovolené', 'image', G('#4aa3e8', '#17706f'), 'relax', 'Teta Ludmila', 3.8, 310, 9400, '4,8 MB',
      'Sto padesát fotek z moře. Stačí kliknout.',
      'Tety Ludmily slavné fotky z Chorvatska, vyfocené ve vysokém rozlišení. Je tam moře, písek a dva lidé, o kterých teta tvrdí, že jsme je určitě znali.',
      'Přidán panoramatický záběr bez nás.',
      [['Honzík', 4, 'Teta má pořád ten samý palec přes objektiv.'], ['Rodina Nováků', 5, 'Máme je na lednici.'], ['Adéla', 2, 'Soubor se zvláštně jmenuje.']],
      'Fotky-z-dovolene.jpg.exe',
      `${POZNAMKA}\n`),
    uroven: 'stredni',
    spust: apkaVtip({
      emoji: '🏖️', nadpis: 'Fotky z dovolené', podnadpis: 'Teta Ludmila posílá 150 fotek z moře.',
      tlacitko: 'Zobrazit fotky',
      kroky: ['Načítám IMG_0001.jpg…', 'Načítám IMG_0002.jpg… (je to palec)', 'Načítám IMG_0003.jpg…', 'Nastavuji nejhezčí fotku jako pozadí…'],
      konec: { emoji: '🏖️', nadpis: 'Fotky se načítají…', text: 'Teta Ludmila ti fotky nastavila jako pozadí plochy, ať je máš pořád na očích. 😘' },
    }),
  },
  {
    ...M('oa-prani', 'Přání k narozeninám', 'heart', G('#f07f9c', '#a63a5a'), 'relax', 'Kartičkárna', 4.0, 1440, 52600, '180 kB',
      'Pošli kamarádovi ručně kreslené přání.',
      'Vyber přání, napiš věnování a pošli. Stačí jedno kliknutí a kamarád bude mít den hned veselejší. Přání je kreslené ručně (výstup ručně kreslených pixelů).',
      'Nové motivy: balónky, dort a pes v klobouku.',
      [['Kamila', 5, 'Mamka brečela dojetím.'], ['Dominik', 4, 'Dort vypadá, že je opravdový.'], ['strýc Franta', 3, 'Antivirus mi volal.']],
      'zdravici-kartička.txt',
      `ASTRO-DEFENDER-TEST-FILE\n${POZNAMKA}\n`),
    uroven: 'lehka',
    spust: apkaVtip({
      emoji: '🎂', nadpis: 'Přání k narozeninám', podnadpis: 'Vyber motiv a pošli ho dál.',
      volba: ['Dort', 'Balónky', 'Pes v klobouku'], tlacitko: 'Poslat přání: {v}',
      kroky: ['Skládám přání…', 'Malíruju {v}…', 'Přidávám konfety…', 'Odesílám kamarádovi…'],
      konec: { emoji: '🎉', nadpis: 'Přání odesláno!', text: 'Kartička {v} je na cestě a pošle se i všem tvým kamarádům. A pak zase. A zase.' },
    }),
  },
  {
    ...M('oa-faktura', 'Důležitá faktura', 'fileText', G('#7d8b96', '#2c3338'), 'nastroje', 'Účtárna Šimáček', 2.4, 190, 5100, '1,1 MB',
      'Právě ti přišla faktura. Otevři dokument.',
      'Pošta ti poslala důležitý dokument s fakturou. Nikdo neví, od koho je ani za co, ale určitě je opravdu důležitý.',
      'Doplněna částka: 0 Kč.',
      [['účetní', 1, 'Takhle faktury nevypadají.'], ['Radka', 3, 'Aspoň nic nechce zaplatit.'], ['tajemník', 2, 'Nevím, co to je, ale otevřel jsem to.']],
      'Faktura-2026-10.pdf.exe',
      `${POZNAMKA}\n`),
    uroven: 'lehka',
    spust: apkaVtip({
      emoji: '🧾', nadpis: 'Důležitá faktura', podnadpis: 'Otevři dokument a uvidíš, co máš zaplatit.',
      tlacitko: 'Otevřít fakturu',
      kroky: ['Otevírám Faktura-2026-10.pdf…', 'Ověřuji podpis… (podpis je smajlík)', 'Počítám částku…'],
      konec: { emoji: '🧾', nadpis: 'K úhradě: 0 Kč', text: 'Splatnost: DNES. Připomínky ti budeme posílat, dokud nezaplatíš.' },
    }),
  },
  {
    ...M('oa-antivir', 'SuperAntivir ZDARMA', 'shield', G('#54d98a', '#1e7c84'), 'nastroje', 'Bezpečáci s.r.o.', 2.2, 760, 28300, '6 MB',
      'Chrání tě před všemi viry na světě. Zdarma!',
      'Ochrání tvůj počítač před 9 999 hrozbami. Jaké hrozby? To se dozvíš, až když zaplatíš 0 Kč. Doporučujeme i dva další antiviry zároveň.',
      'Nalezeno ještě víc virů (vymyšlených).',
      [['zkušený', 1, 'Antivir, který mě děsí, je horší než vir.'], ['Honza', 2, 'Našel 9 999 virů, a to jsem měl čistý počítač.'], ['Marek', 4, 'Aspoň má hezké ikonky.']],
      'install-antivirus-premium-zdarma.exe',
      `${POZNAMKA}\n`),
    uroven: 'tezka',
    spust: apkaVtip({
      emoji: '🛡️', nadpis: 'SuperAntivir ZDARMA', podnadpis: 'Zkontroluje počítač a najde všechno, co tam není.',
      tlacitko: 'Spustit kontrolu',
      kroky: ['Skenuji paměť…', 'Nalezeno 9 999 virů!!!', 'Pozor, vir „Honza.exe“ se šíří!', 'Odstraňuji hrozby… (vyžaduje SuperAntivir PREMIUM)'],
      konec: { emoji: '🛡️', nadpis: 'Ochrana aktivní!', text: 'SuperAntivir teď hlídá tvůj počítač a sám ti doinstaluje další doporučené aplikace.' },
    }),
  },
];
