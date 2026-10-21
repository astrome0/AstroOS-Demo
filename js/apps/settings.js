// AstroOS — Nastavení

import { el, bus, cz, pred, plural } from '../util.js';
import { icon, logo, glyfAplikace } from '../icons.js';
import { State, ACCENTS } from '../state.js';
import { applyAccent, applyDisplay, applyVzhled, VZHLED } from '../vzhled.js';
import { wallpaperList, applyWallpaper, vyberTapetuZPocitace } from '../wallpapers.js';
import * as FS from '../fs.js';
import { toast } from '../ui.js';
import * as Sit from '../sit.js';
import * as Kurzor from '../kurzor.js';
import { JAZYKY, jazykTed, nastavJazyk, tx } from '../i18n.js';
import * as Akt from '../aktualizace.js';
import * as Uloziste from '../uloziste.js';
import * as Verze from '../verze.js';
import * as Ucty from '../ucty.js';
import * as Vychozi from '../vychozi.js';

const SECTIONS = [
  { id: 'vzhled', name: 'Vzhled', icon: 'palette' },
  { id: 'tapeta', name: 'Tapeta', icon: 'image' },
  { id: 'plocha', name: 'Plocha', icon: 'monitor' },
  { id: 'panel', name: 'Hlavní panel', icon: 'grid' },
  { id: 'ucet', name: 'Účet', icon: 'user' },
  { id: 'sit', name: 'Síť a internet', icon: 'wifi' },
  { id: 'zvuk', name: 'Zvuk a oznámení', icon: 'volume' },
  { id: 'jazyk', name: 'Čas a jazyk', icon: 'globe' },
  { id: 'system', name: 'Systém', icon: 'settings' },
  { id: 'disk', name: 'Úložiště', icon: 'hdd' },
  { id: 'aplikace', name: 'Výchozí aplikace', icon: 'grid' },
  { id: 'aktualizace', name: 'Aktualizace', icon: 'refresh' },
  { id: 'info', name: 'O systému', icon: 'info' },
];

// ---------------------------------------------------------------- stavební prvky
const card = (...kids) => el('div.set-card', {}, kids);
const head = (t, s) => el('div.set-head', {}, el('h2', { text: t }), s ? el('p', { text: s }) : null);

/** Řádek Aktivace — překreslí se sám, když se systém aktivuje nebo deaktivuje. */
function radekAktivace() {
  const obal = el('div');
  const EDICE = { home: 'AstroOS Home', pro: 'AstroOS Pro', edu: 'AstroOS Education', astro: 'AstroOS Pro pro pracovní stanice ve vesmíru' };
  const kresli = () => {
    if (!obal.isConnected && obal.childElementCount) { odhlas(); return; }
    const aktivni = State.get('aktivovano') !== false;
    const klic = State.get('produktKlic');
    const deakt = el('button.btn', { text: 'Deaktivovat' });
    deakt.onclick = () => {
      if (deakt.dataset.sure !== '1') {
        deakt.dataset.sure = '1';
        deakt.textContent = 'Opravdu? Klikni znovu';
        setTimeout(() => { deakt.dataset.sure = '0'; deakt.textContent = 'Deaktivovat'; }, 4000);
        return;
      }
      import('../aktivace.js').then(({ deaktivuj }) => deaktivuj());
    };
    obal.replaceChildren(row('Aktivace',
      aktivni
        ? `${EDICE[State.get('edice')] || 'AstroOS Pro'} je aktivovaný${klic ? ' · kód •••••-…-' + klic.slice(-5) : ''}`
        : 'AstroOS není aktivovaný — licenci koupíte v Nově na astro://koupit',
      aktivni
        ? el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          el('span', { text: '✓', style: { color: 'var(--accent)', fontSize: '18px' } }), deakt)
        : el('div', { style: { display: 'flex', gap: '8px' } },
          el('button.btn', { text: 'Koupit', onclick: () => import('../apps.js').then(({ openApp }) => openApp('browser', { url: 'astro://koupit' })) }),
          el('button.btn.primary', { text: 'Zadat kód Product Key', onclick: () => import('../aktivace.js').then(({ aktivacniDialog }) => aktivacniDialog()) }))));
  };
  const odhlas = bus.on('state:aktivovano', kresli);
  kresli();
  return obal;
}

function row(title, desc, control) {
  return el('div.set-row', {},
    el('div', {}, el('div.t', { text: title }), desc ? el('div.s', { text: desc }) : null),
    el('div.set-ctl', {}, control),
  );
}

function toggle(key, onChange) {
  const hodnota = State.get(key) ?? VZHLED[key] ?? false;
  const sw = el('div.switch' + (hodnota ? '.on' : ''));
  sw.onclick = () => {
    const v = !(State.get(key) ?? VZHLED[key] ?? false);
    State.set(key, v);
    sw.classList.toggle('on', v);
    onChange?.(v);
  };
  return sw;
}

/**
 * Řada tlačítek, ze kterých je vybrané jedno.
 * volby: [[hodnota, popisek], …]
 */
function prepinac(key, volby, onChange) {
  const box = el('div.set-volby');
  const aktualni = () => State.get(key) ?? VZHLED[key];
  for (const [hodnota, popisek] of volby) {
    const b = el('button.set-volba' + (aktualni() === hodnota ? '.on' : ''), { text: popisek });
    b.onclick = () => {
      State.set(key, hodnota);
      [...box.children].forEach((c) => c.classList.remove('on'));
      b.classList.add('on');
      onChange?.(hodnota);
    };
    box.append(b);
  }
  return box;
}

function slider(key, min, max, onChange) {
  const val = el('span.set-val', { text: State.get(key) + ' %' });
  const inp = el('input', { type: 'range', min, max, value: State.get(key), style: { width: '160px' } });
  inp.oninput = () => {
    const v = +inp.value;
    State.set(key, v);
    val.textContent = v + ' %';
    onChange?.(v);
  };
  return el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, inp, val);
}

function textField(value, placeholder, onSave) {
  const inp = el('input.set-input', { value, placeholder, spellcheck: 'false' });
  inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); };
  inp.onblur = () => onSave(inp.value.trim(), inp);
  return inp;
}

// ---------------------------------------------------------------- sekce
function vzhled() {
  const wrap = el('div.set-page', {}, head('Vzhled', 'Motiv, barva systému, tvary a jas. Změny se projeví hned.'));

  // --- barva systému ---
  const dots = el('div.acc-row');
  const vlastniBarva = el('input', {
    type: 'color', value: State.get('accentVlastni') || '#46c36f',
    style: { width: '30px', height: '26px', border: '0', background: 'none', cursor: 'pointer' },
  });
  vlastniBarva.oninput = () => {
    State.patch({ accentVlastni: vlastniBarva.value, accent: 'vlastni' });
    applyAccent();
    drawDots();
  };
  const drawDots = () => {
    dots.innerHTML = '';
    for (const [id, a] of Object.entries(ACCENTS)) {
      const b = el('button.acc' + (State.get('accent') === id ? '.on' : ''), {
        title: a.name, style: { background: a.accent },
      }, State.get('accent') === id ? icon('check') : null);
      b.onclick = () => { State.set('accent', id); applyAccent(id); drawDots(); };
      dots.append(b);
    }
    dots.append(el('div.acc-vlastni' + (State.get('accent') === 'vlastni' ? '.on' : ''), {
      title: 'Vlastní barva',
    }, vlastniBarva));
  };
  drawDots();

  wrap.append(
    card(
      row('Motiv', 'Světlý motiv obarví okna, panel i nabídky',
        prepinac('motiv', [['tmavy', 'Tmavý'], ['svetly', 'Světlý'], ['podle-systemu', 'Podle systému']], applyVzhled)),
      row('Barva systému', 'Zvýraznění tlačítek, ikon a výběru', dots),
    ),
    card(
      el('div.set-sub', { text: 'Tvary a průhlednost' }),
      row('Zaoblení rohů', 'Okna, nabídky i tlačítka',
        prepinac('rohy', [['ostre', 'Ostré'], ['normal', 'Normální'], ['kulate', 'Kulaté']], applyVzhled)),
      row('Sklo za panely', 'Rozostřené pozadí stojí výkon',
        prepinac('sklo', [['vyp', 'Vypnuto'], ['jemne', 'Jemné'], ['silne', 'Silné']], applyVzhled)),
      row('Animace', 'Omezené animace zrychlí ovládání',
        prepinac('animace', [['plne', 'Plné'], ['min', 'Omezené']], applyVzhled)),
    ),
    card(
      el('div.set-sub', { text: 'Obrazovka' }),
      row('Jas', 'Ztmaví tapetu, ne obsah oken', slider('brightness', 20, 100)),
      row('Noční režim', 'Teplejší barvy pro večerní práci', toggle('night')),
    ),
    kurzorKarta(),
  );
  return wrap;
}

/** Kurzor myši: styl (s náhledem šipky i „ruky“ nad tlačítkem), velikost a stopa. */
function kurzorKarta() {
  const styly = el('div.set-kurzory');
  const kresli = () => {
    const ted = State.get('kurzor') || 'system';
    styly.replaceChildren(...Kurzor.STYLY.map(([id, nazev]) => {
      const sipka = Kurzor.nahled(id), ruka = Kurzor.nahled(id, true);
      const b = el('button.set-kurzor' + (ted === id ? '.on' : ''), { title: nazev },
        el('div.set-kurzor-nahled', {}, sipka
          ? [el('img', { src: sipka, alt: '' }), el('img', { src: ruka, alt: '' })]
          : [el('span', { text: 'Windows' })]),
        el('span', { text: nazev }));
      b.onclick = () => { State.set('kurzor', id); kresli(); };
      return b;
    }));
  };
  kresli();
  // akcent se mohl změnit nahoře na stejné stránce → náhledy v nové barvě
  const off = bus.on('state:accent', () => { if (styly.isConnected) kresli(); else off(); });
  return card(
    el('div.set-sub', { text: 'Kurzor myši' }),
    styly,
    row('Velikost', null, prepinac('kurzorVelikost', Kurzor.VELIKOSTI.map(([id, n]) => [id, n]))),
    row('Stopa za kurzorem', 'Jen pro zábavu — kreslí se, jen když hýbeš myší', prepinac('kurzorStopa', Kurzor.STOPY)),
  );
}

function tapeta() {
  const wrap = el('div.set-page', {}, head('Tapeta', 'Pozadí plochy i zamykací obrazovky.'));

  const gal = el('div.wall-grid');
  const drawGal = () => {
    gal.innerHTML = '';
    for (const [id, w] of Object.entries(wallpaperList())) {
      const prev = el('div.wall-prev', { style: { background: w.base } });
      if (w.image) prev.style.background = `url("${w.image}") center / cover`;
      else if (w.blobs?.length) {
        prev.append(...w.blobs.map((b) => el('i', {
          style: {
            position: 'absolute', borderRadius: '50%', filter: 'blur(14px)',
            background: b.c, left: b.x, top: b.y, width: '60%', height: '60%', opacity: String(b.o),
          },
        })));
      }
      const t = el('button.wall' + (State.get('wallpaper') === id ? '.on' : ''), { title: w.autor ? `${w.name} · © 2026 ${w.autor} · All rights reserved` : null },
        prev, el('span', { text: w.name }), w.autor ? el('small.wall-autor', { text: `© ${w.autor}` }) : null);
      t.onclick = () => { State.set('wallpaper', id); applyWallpaper(id); drawGal(); };
      gal.append(t);
    }
    // poslední dlaždice: vlastní fotka z disku počítače
    gal.append(el('button.wall.wall-pc', { onclick: () => vyberTapetuZPocitace(drawGal) },
      el('div.wall-prev', {}, icon('plus')), el('span', { text: 'Z počítače…' })));
  };
  drawGal();

  wrap.append(
    card(el('div.set-sub', { text: 'Vyber si pozadí' }), gal),
    card(
      row('Fotka z počítače', 'Jakýkoli obrázek z tohohle počítače — velké fotky se zmenší na 4K',
        el('button.btn', { text: 'Procházet…', onclick: () => vyberTapetuZPocitace(drawGal) })),
      row('Obrázek z AstroOS', 'Ve Fotkách klikni u obrázku na „Tapeta“',
        el('button.btn', { text: 'Otevřít Fotky', onclick: () => import('../apps.js').then(({ openApp }) => openApp('photos')) })),
    ),
  );
  return wrap;
}

function plocha() {
  const wrap = el('div.set-page', {}, head('Plocha', 'Ikony a pracovní plochy.'));
  wrap.append(
    card(
      row('Velikost ikon', null,
        prepinac('ikony', [['male', 'Malé'], ['stredni', 'Střední'], ['velke', 'Velké']], applyVzhled)),
      row('Srovnat ikony', 'Poskládá ikony zpátky do mřížky',
        el('button.btn', {
          text: 'Srovnat',
          onclick: () => import('../desktop.js').then((d) => { d.arrangeIcons(); toast({ title: 'Ikony srovnány', icon: 'grid' }); }),
        })),
      row('Vlastní názvy ikon', 'Vrátí všem ikonám původní jména',
        el('button.btn', {
          text: 'Obnovit názvy',
          onclick: () => {
            State.set('iconNames', {});
            import('../desktop.js').then((d) => d.initDesktop());
            toast({ title: 'Názvy obnoveny', icon: 'refresh' });
          },
        })),
    ),
    card(
      el('div.set-sub', { text: 'Pracovní plochy' }),
      row('Počet ploch', 'Přepínají se ploškami vlevo v panelu',
        prepinac('pocetPloch', [[1, '1'], [2, '2'], [3, '3'], [4, '4']])),
      row('Zobrazit přepínač ploch', null, toggle('zobrazitPlochy')),
    ),
  );
  return wrap;
}

function panelSekce() {
  const wrap = el('div.set-page', {}, head('Hlavní panel', 'Vzhled a obsah panelu dole.'));
  wrap.append(
    card(
      row('Zarovnání', 'Vycentrované jako Windows, vlevo jako Mint',
        prepinac('zarovnani', [['uprostred', 'Uprostřed'], ['vlevo', 'Vlevo']], applyVzhled)),
      row('Výška panelu', null,
        prepinac('panel', [['kompakt', 'Kompaktní'], ['normal', 'Normální'], ['velky', 'Velký']], applyVzhled)),
      row('Skrývat panel', 'Vyjede, až na něj najedeš myší', toggle('skrytPanel', applyVzhled)),
    ),
    card(
      el('div.set-sub', { text: 'Hodiny' }),
      row('Formát času', null, prepinac('hodiny24', [[true, '24 hodin'], [false, '12 hodin']])),
      row('Zobrazit sekundy', null, toggle('sekundy')),
      row('Zobrazit datum', null, toggle('datumVPanelu')),
    ),
    card(
      el('div.set-sub', { text: 'Co ukazovat v panelu' }),
      row('Zvoneček s oznámeními', null, toggle('zobrazitZvonecek')),
      row('Tlačítko „Zobrazit plochu“', 'Úzký proužek úplně vpravo', toggle('zobrazitPlochuBtn')),
    ),
  );
  return wrap;
}

function zvukSekce() {
  const wrap = el('div.set-page', {}, head('Zvuk a oznámení', 'Systémové zvuky si AstroOS skládá sám, žádné soubory nepotřebuje.'));
  wrap.append(
    card(
      row('Hlasitost', 'Platí pro všechny systémové zvuky', slider('volume', 0, 100)),
      row('Systémové zvuky', 'Přihlášení, oznámení, chyby', toggle('zvuky')),
      row('Vyzkoušet', null, el('div', { style: { display: 'flex', gap: '6px' } },
        ...[['prihlaseni', 'Přihlášení'], ['oznameni', 'Oznámení'], ['chyba', 'Chyba'], ['zamek', 'Zámek']]
          .map(([id, popis]) => el('button.btn', {
            text: popis,
            onclick: () => import('../zvuk.js').then(({ zvuk }) => zvuk(id)),
          })))),
    ),
    card(
      el('div.set-sub', { text: 'Oznámení' }),
      row('Nerušit', 'Skryje vyskakovací oznámení', toggle('dnd')),
    ),
    card(
      el('div.set-sub', { text: 'Bluetooth' }),
      row('Bluetooth', null, toggle('bluetooth')),
    ),
  );
  return wrap;
}

function sitSekce() {
  const wrap = el('div.set-page', {}, head('Síť a internet',
    'Sítě v AstroOS jsou vymyšlené — skutečný počítač ani domácí síť se nečtou. Bez připojení ale Nova, Počasí ani hledání AstroAI na internet nepustí.'));
  const prepinac = (zap, onClick) => {
    const sw = el('div.switch' + (zap ? '.on' : ''));
    sw.onclick = onClick;
    return sw;
  };
  const kresli = () => {
    const a = Sit.aktualni();
    const hra = Sit.stavHry();
    const zname = Sit.SITE.filter((s) => Sit.jeZnama(s.id) && Sit.viditelna(s.id));
    const nazvy = { soukroma: 'Soukromá', verejna: 'Veřejná' };
    wrap.replaceChildren(wrap.firstChild,
      card(
        el('div.set-sub', { text: 'Připojení' }),
        row('Wi-Fi', Sit.popis(), prepinac(Sit.wifiZapnuta(), () => { Sit.nastavWifi(!Sit.wifiZapnuta()); kresli(); })),
        row('Režim Letadlo', 'Vypne Wi-Fi i Bluetooth. AstroAI dál funguje, protože model běží u tebe.',
          prepinac(Sit.letadlo(), () => { Sit.nastavLetadlo(!Sit.letadlo()); kresli(); })),
        a ? row(a.ssid, `${a.zabezpeceni || 'Otevřená síť'} · ${a.pasmo} · ${a.rychlost >= 1000 ? (a.rychlost / 1000).toLocaleString('cs') + ' Gb/s' : a.rychlost + ' Mb/s'} · ${nazvy[a.profil]} síť`,
          el('button.btn', { text: 'Odpojit', onclick: () => { Sit.odpoj(); kresli(); } })) : null,
        el('button.btn', { text: 'Sítě v dosahu…', style: { marginTop: '10px' }, onclick: () => import('../taskbar.js').then((m) => m.otevriSite()) }),
      ),
      card(
        el('div.set-sub', { text: 'Uložené sítě' }),
        ...zname.map((s) => row(s.ssid, `${s.zabezpeceni || 'Otevřená'} · ${nazvy[s.profil]} síť${s.id === a?.id ? ' · připojeno' : ''}`,
          s.id === 'astronet' ? el('span.set-pozn', { text: 'domácí síť' })
            : el('button.btn', { text: 'Zapomenout', onclick: () => { Sit.zapomen(s.id); kresli(); } }))),
      ),
      card(
        el('div.set-sub', { text: `Síťový detektiv · ${hra.nalezeno}/${hra.celkem}` }),
        el('div.set-detektiv', {},
          el('div.set-detektiv-pruh', {}, el('i', { style: { width: Math.round(hra.nalezeno / hra.celkem * 100) + '%' } })),
          el('p', { text: hra.konec
            ? 'Hotovo! Dostal ses do všech sítí v okolí, i do dodávky FBI.'
            : 'Čas od času se v dosahu objeví nová síť. Heslo k ní je schované někde v systému — v Dokumentech, v Poště, na ploše… Najdi ho a připoj se.' })),
      ),
    );
  };
  kresli();
  const off = bus.on('sit:zmena', () => { if (wrap.isConnected) kresli(); else off(); });
  return wrap;
}

function ucet() {
  const u = State.get('user');
  const wrap = el('div.set-page', {}, head('Účet', 'Jméno, obrázek a heslo pro přihlášení.'));

  const av = el('div.set-av', { text: u.avatar || u.name[0] });

  const jmeno = textField(u.name, 'Jméno', (v) => {
    if (!v) return;
    State.patch({ user: { ...State.get('user'), name: v, avatar: v[0].toUpperCase() } });
    av.textContent = v[0].toUpperCase();
    toast({ title: 'Jméno změněno', body: `Ahoj, ${v}!`, icon: 'user' });
  });

  // změna hesla
  const staré = el('input.set-input', { type: 'password', placeholder: 'Staré heslo' });
  const nové = el('input.set-input', { type: 'password', placeholder: 'Nové heslo' });
  const napoveda = el('input.set-input', { placeholder: tx('Nápověda', 'Hint'), value: u.hint });
  [staré, nové, napoveda].forEach((i) => (i.onkeydown = (e) => e.stopPropagation()));
  const zprava = el('div.set-msg');

  const ulozit = el('button.btn.primary', {
    text: 'Změnit heslo',
    onclick: () => {
      const cur = State.get('user');
      if (staré.value !== cur.password) {
        zprava.textContent = 'Staré heslo nesedí.';
        zprava.className = 'set-msg bad';
        return;
      }
      if (nové.value.length < 3) {
        zprava.textContent = 'Nové heslo musí mít aspoň 3 znaky.';
        zprava.className = 'set-msg bad';
        return;
      }
      // uložená hesla Novy jsou šifrovaná heslem účtu → přešifrovat novým
      import('../hesla.js').then((H) => H.zmenaHeslaUctu(cur.password, nové.value)).catch(() => {});
      State.patch({ user: { ...cur, password: nové.value, hint: napoveda.value.trim() || 'žádná nápověda' } });
      staré.value = nové.value = '';
      zprava.textContent = 'Heslo změněno. Použij ho při příštím přihlášení.';
      zprava.className = 'set-msg ok';
      toast({ title: 'Heslo změněno', icon: 'lock' });
    },
  });

  wrap.append(
    card(el('div.set-user', {}, av, el('div', {},
      el('div.set-user-n', { text: u.name }),
      el('div.set-user-s', { text: `${u.email ? 'Astro účet · ' + u.email : 'Místní účet'} · vytvořen ${cz.datumKratky(new Date(State.get('installed')))}` }),
    ))),
    card(row('Jméno', 'Zobrazí se na zámku i v nabídce Start', jmeno)),
    card(
      el('div.set-sub', { text: 'Heslo' }),
      row('Staré heslo', null, staré),
      row('Nové heslo', null, nové),
      row(tx('Nápověda', 'Hint'), 'Ukáže se po nepovedeném pokusu', napoveda),
      el('div.set-actions', {}, zprava, ulozit),
    ),
    dalsiUzivatele(),
  );
  return wrap;
}

/** Nastavení ▸ Účet ▸ Další uživatelé (ucty.js): seznam, přepnutí, přidání a odebrání účtů. */
function dalsiUzivatele() {
  const obal = el('div');
  const kresli = () => {
    const ucty = Ucty.vsichni();
    const spravce = Ucty.jsemSpravce();
    const nazevTypu = (t) => (Ucty.TYPY.find(([v]) => v === t) || Ucty.TYPY[1])[1];

    const radky = ucty.map((u) => {
      const ovladani = [];
      if (!u.aktivni) ovladani.push(el('button.btn', { text: 'Přihlásit se', onclick: () => Ucty.prepni(u.id) }));
      if (spravce && !u.hlavni && !u.aktivni) {
        ovladani.push(el('button.btn', {
          text: u.typ === 'spravce' ? 'Udělat standardním' : 'Udělat správcem',
          onclick: () => { Ucty.zmenTyp(u.id, u.typ === 'spravce' ? 'standardni' : 'spravce'); kresli(); },
        }));
        const smazat = el('button.btn.danger', { text: 'Odebrat' });
        smazat.onclick = async () => {
          if (smazat.dataset.sure !== '1') {
            smazat.dataset.sure = '1';
            smazat.textContent = 'Smaže i jeho soubory. Klikni znovu';
            setTimeout(() => { if (smazat.isConnected) { smazat.dataset.sure = '0'; smazat.textContent = 'Odebrat'; } }, 4000);
            return;
          }
          await Ucty.odeber(u.id);
          toast({ title: 'Účet odebrán', body: u.jmeno, icon: 'user' });
          kresli();
        };
        ovladani.push(smazat);
      }
      return el('div.set-row.uc-radek', {},
        el('div.uc-av', { text: Ucty.avatarPismeno(u) }),
        el('div', { style: { flex: '1', minWidth: '0' } },
          el('div.t', {}, el('span', { text: u.jmeno, 'data-no-i18n': true }), u.aktivni ? el('span.uc-ted', { text: 'přihlášený' }) : null),
          el('div.s', { text: `${nazevTypu(u.typ)}${u.hlavni ? ' · hlavní účet' : ''}${u.heslo ? '' : ' · bez hesla'}` })),
        el('div.set-ctl', {}, ...ovladani));
    });

    let formular = null;
    if (spravce) {
      const jmeno = el('input.set-input', { placeholder: 'Jméno (třeba Tomáš)', maxlength: 32 });
      const heslo = el('input.set-input', { type: 'password', placeholder: 'Heslo (nepovinné)' });
      const napoveda = el('input.set-input', { placeholder: 'Nápověda k heslu (nepovinné)' });
      [jmeno, heslo, napoveda].forEach((i) => (i.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') pridat.click(); }));
      let typ = 'standardni';
      const typy = el('div.set-volby', {}, Ucty.TYPY.map(([v, t]) => {
        const b = el('button.set-volba' + (v === typ ? '.on' : ''), { text: t });
        b.onclick = () => { typ = v; [...typy.children].forEach((x) => x.classList.toggle('on', x === b)); };
        return b;
      }));
      const zprava = el('div.set-msg');
      const pridat = el('button.btn.primary', { text: 'Přidat účet' });
      pridat.onclick = () => {
        try {
          Ucty.pridej({ jmeno: jmeno.value, heslo: heslo.value, napoveda: napoveda.value, typ });
          toast({ title: 'Účet přidán', body: `${jmeno.value.trim()} se může přihlásit na zamykací obrazovce.`, icon: 'user' });
          kresli();
        } catch (err) { zprava.textContent = err.message; zprava.className = 'set-msg bad'; }
      };
      formular = card(
        el('div.set-sub', { text: 'Přidat uživatele' }),
        row('Jméno', 'Zobrazí se na zámku a v nabídce Start', jmeno),
        row('Heslo', 'Bez hesla se přihlásí jedním klikem', heslo),
        row(tx('Nápověda', 'Hint'), null, napoveda),
        row('Typ účtu', 'Správce může přidávat a odebírat účty', typy),
        el('div.set-actions', {}, zprava, pridat),
      );
    }

    obal.replaceChildren(
      card(
        el('div.set-sub', { text: 'Další uživatelé' }),
        el('div.set-s.uc-popis', { text: 'Každý účet má vlastní soubory, tapetu, nastavení i Astro Studio. Přepínat jde na zamykací obrazovce nebo v nabídce Start.' }),
        ...radky,
      ),
      formular || card(el('div.set-s.uc-popis', { text: 'Účty může přidávat a odebírat jen správce.' })),
    );
  };
  kresli();
  return obal;
}

function jazykSekce() {
  const wrap = el('div.set-page', {}, head('Čas a jazyk', 'Jazyk, oblast a formát data.'));
  const region = State.get('region') || {};
  const ukazka = el('span.set-val', { style: { width: 'auto' } });
  const restart = el('div');
  const volby = el('div.set-volby');

  const kresli = () => {
    volby.replaceChildren(...JAZYKY.map(([kod, nazev]) => {
      // názvy jazyků se nepřekládají — každý je napsaný svým jazykem
      const b = el('button.set-volba' + (jazykTed() === kod ? '.on' : ''), { text: nazev, 'data-no-i18n': true });
      b.onclick = () => {
        if (jazykTed() === kod) return;
        nastavJazyk(kod);
        State.set('region', { ...(State.get('region') || {}), jazyk: kod });
        kresli();
        restart.replaceChildren(card(row('Pro úplné přepnutí restartuj', 'Otevřená okna a některé texty se přeloží až po restartu.',
          el('button.btn.primary', { text: 'Restartovat', onclick: () => bus.emit('power', 'restart') }))));
      };
      return b;
    }));
    ukazka.textContent = `${cz.datumDlouhy()} · ${cz.datumKratky()}`;
  };
  kresli();

  wrap.append(
    card(
      row('Jazyk zobrazení', 'Nabídky, okna a dialogy. Přepne se hned.', volby),
      row('Formát data', 'Řídí se jazykem zobrazení', ukazka),
    ),
    restart,
    card(
      el('div.set-sub', { text: 'Oblast' }),
      row('Země nebo oblast', 'Zvolená při instalaci', el('span.set-val', { text: region.zeme || 'Česko', style: { width: 'auto' } })),
      row('Klávesnice', null, el('span.set-val', { text: region.klavesnice || 'Česká', style: { width: 'auto' } })),
    ),
    card(
      el('div.set-sub', { text: 'Přeloženo' }),
      el('div.set-s', { text: 'Zatím jsou přeložené systémové části: instalace, zámek, Start, panel, plocha, Soubory a Nastavení. Aplikace přijdou postupně.' }),
    ),
  );
  return wrap;
}

function system() {
  const wrap = el('div.set-page', {}, head('Systém', 'Jméno počítače, spouštění, zámek a obnovení.'));
  wrap.append(
    card(
      row('Jméno počítače', 'Vidíš ho v terminálu a v neofetch',
        textField(State.get('jmenoPc') || 'astro', 'astro', (v) => {
          const jmeno = (v || 'astro').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'astro';
          State.set('jmenoPc', jmeno);
          toast({ title: 'Počítač přejmenován', body: jmeno, icon: 'monitor' });
        })),
      row('Uzamknout po nečinnosti', 'Systém se sám zamkne, když nic neděláš',
        prepinac('zamknoutPo', [[0, 'Nikdy'], [1, '1 min'], [5, '5 min'], [15, '15 min']])),
    ),
    card(
      radekAktivace(),
      row('Rychlé spuštění', 'Přeskočí POST obrazovku při startu', toggle('fastboot')),
      row('Zkusit boot znovu', 'Restartuje systém a ukáže celou sekvenci',
        el('button.btn', {
          text: 'Restartovat s POST',
          onclick: () => { State.set('fastboot', false); bus.emit('power', 'restart'); },
        })),
    ),
    card(
      el('div.set-sub', { text: 'Obnovení' }),
      row('Výchozí nastavení', 'Tapeta, barva, heslo a ikony se vrátí na začátek. Soubory zůstanou.',
        el('button.btn', {
          text: 'Obnovit nastavení',
          onclick: () => {
            State.reset();
            toast({ title: 'Nastavení obnoveno', body: 'Heslo je zase „astro“. Restartuj systém.', icon: 'refresh', timeout: 7000 });
            applyAccent(); applyWallpaper(); applyDisplay();
          },
        })),
      row('Resetovat tento počítač', 'Přeinstaluje AstroOS a spustí znovu celé první nastavení.',
        el('div', { style: { display: 'flex', gap: '8px' } },
          ...[['Zachovat soubory', true], ['Odebrat vše', false]].map(([text, zachovat]) => el('button.btn' + (zachovat ? '' : '.danger'), {
            text,
            onclick: (e) => {
              const b = e.currentTarget;
              if (b.dataset.sure !== '1') {
                b.dataset.sure = '1';
                b.textContent = 'Opravdu? Klikni znovu';
                setTimeout(() => { b.dataset.sure = '0'; b.textContent = text; }, 4000);
                return;
              }
              import('../oobe.js').then(({ resetujPocitac }) => resetujPocitac(zachovat));
            },
          })))),
      row('Vymazat disk', 'Smaže všechny soubory a vrátí výchozí složky.',
        el('button.btn.danger', {
          text: 'Vymazat disk',
          onclick: (e) => {
            const b = e.currentTarget;
            if (b.dataset.sure !== '1') {
              b.dataset.sure = '1';
              b.textContent = 'Opravdu? Klikni znovu';
              setTimeout(() => { b.dataset.sure = '0'; b.textContent = 'Vymazat disk'; }, 4000);
              return;
            }
            FS.resetDisk();
            b.dataset.sure = '0';
            b.textContent = 'Vymazat disk';
            toast({ title: 'Disk vymazán', body: 'Výchozí složky jsou zpátky.', icon: 'hdd' });
          },
        })),
    ),
  );
  return wrap;
}

// ---------------------------------------------------------------- úložiště (js/uloziste.js)
// co zůstane rozbalené / zaškrtnuté, když se stránka po změně na disku překreslí
const ulozisteUi = { otevrena: null, vybrane: null };
const podil = (p) => (p < 0.1 ? '< 0.1 %' : p < 10 ? `${p.toFixed(1)} %` : `${Math.round(p)} %`);

function disk() {
  const u = FS.usage();
  const a = Uloziste.analyza();
  const wrap = el('div.set-page', {}, head('Úložiště', 'Co doopravdy zabírá místo a jak ho uvolnit.'));
  const otevri = (id, opts) => import('../apps.js').then(({ openApp }) => openApp(id, opts));
  const kdeLezi = (path) => otevri('files', { path: FS.dirname(path) });
  const doKose = (path) => {
    try { FS.remove(path); toast({ title: 'Přesunuto do koše', body: FS.basename(path), icon: 'trash' }); }
    catch (err) { toast({ title: 'Nejde smazat', body: err.message, icon: 'x' }); }
  };

  /** Řádek souboru: název + cesta, velikost, tlačítka. Virtuální položky (data aplikací) jen ukazují velikost. */
  const radekSouboru = (s, { smazat = true } = {}) => el('div.ul-soubor', {},
    el('div.ul-soubor-ic', {}, icon(s.virtualni ? 'grid' : FS.fileInfo(s.name).icon)),
    el('div.ul-soubor-t', {},
      el('div.t', { text: s.name, 'data-no-i18n': !s.virtualni }),
      s.path ? el('div.s', { text: FS.dirname(s.path).replace(FS.HOME, '~'), 'data-no-i18n': true }) : null),
    el('div.ul-soubor-v', { text: FS.humanSize(s.size) }),
    s.path ? el('div.ul-soubor-akce', {},
      el('button.btn.mini', { text: 'Otevřít umístění', onclick: () => kdeLezi(s.path) }),
      smazat && Uloziste.jdeSmazat(s) ? el('button.btn.mini', { text: 'Do koše', onclick: () => doKose(s.path) }) : null) : null,
  );

  // --- přehled
  const plne = a.procenta >= 95 ? 'plny' : a.procenta >= 80 ? 'skoro' : '';
  const kat = a.kategorie.filter((k) => k.velikost > 0);
  const pruh = el('div.ul-pruh', {}, kat.map((k) => el('i', {
    title: `${k.nazev} · ${FS.humanSize(k.velikost)}`,
    style: { width: Math.max(0.6, k.velikost / a.limit * 100) + '%', background: k.barva },
  })));
  const legenda = el('div.ul-kat', {}, kat.map((k) => {
    const otevrena = ulozisteUi.otevrena === k.id;
    const hlava = el('button.ul-kat-h' + (otevrena ? '.on' : ''), {},
      el('span.ul-tecka', { style: { background: k.barva } }),
      icon(k.icon),
      el('span.ul-kat-n', { text: k.nazev }),
      el('span.ul-kat-p', { text: podil(k.velikost / a.celkem * 100) }),
      el('span.ul-kat-v', { text: FS.humanSize(k.velikost) }),
      icon(otevrena ? 'minus' : 'plus'));
    hlava.onclick = () => { ulozisteUi.otevrena = otevrena ? null : k.id; prekresli(); };
    return el('div.ul-kat-i', {}, hlava, otevrena
      ? el('div.ul-kat-obsah', {}, ...k.polozky.slice(0, 8).map((s) => radekSouboru(s)),
        k.polozky.length > 8 ? el('div.set-s.ul-dalsi', { text: `…a dalších ${k.polozky.length - 8}` }) : null)
      : null);
  }));

  // --- vyčištění
  const navrhy = Uloziste.navrhy(a);
  if (!ulozisteUi.vybrane) ulozisteUi.vybrane = new Set(navrhy.filter((n) => n.vychozi).map((n) => n.id));
  const vybrane = ulozisteUi.vybrane;
  const souhrn = () => navrhy.filter((n) => vybrane.has(n.id)).reduce((s, n) => s + n.velikost, 0);
  const tlacitko = el('button.btn.primary');
  const nastavTlacitko = () => {
    const v = souhrn();
    tlacitko.textContent = v ? `Vyčistit · ${FS.humanSize(v)}` : 'Není co čistit';
    tlacitko.disabled = !v;
    tlacitko.dataset.sure = '0';
  };
  tlacitko.onclick = () => {
    // vysypání koše nejde vrátit → potvrzení druhým klikem, jako u resetu
    if (vybrane.has('kos') && tlacitko.dataset.sure !== '1') {
      tlacitko.dataset.sure = '1';
      tlacitko.textContent = 'Smazat natrvalo? Klikni znovu';
      setTimeout(nastavTlacitko, 4000);
      return;
    }
    const uvolneno = Uloziste.vycisti([...vybrane]);
    toast({ title: 'Úložiště vyčištěno', body: `Uvolněno ${FS.humanSize(uvolneno)}`, icon: 'check' });
    prekresli();
  };
  nastavTlacitko();
  const uklid = card(
    el('div.set-sub', { text: 'Vyčištění' }),
    ...navrhy.map((n) => {
      const cb = el('input', { type: 'checkbox', checked: vybrane.has(n.id) && !!n.velikost, disabled: !n.velikost });
      cb.onchange = () => { cb.checked ? vybrane.add(n.id) : vybrane.delete(n.id); nastavTlacitko(); };
      return el('label.set-row.ul-uklid', {},
        cb,
        el('div', { style: { flex: '1' } }, el('div.t', { text: n.nazev }), el('div.s', { text: n.popis })),
        el('div.set-val', { text: n.velikost ? FS.humanSize(n.velikost) : '—', style: { width: 'auto' } }));
    }),
    el('div.set-actions', {}, tlacitko),
  );

  // --- automatika
  const auto = card(row('Vysypávat koš po 30 dnech', 'Co je v koši déle než měsíc, se po přihlášení smaže samo', toggle('uklidKose')));

  // --- historie verzí (verze.js, IndexedDB — mimo těch 5 MB)
  const historieInfo = el('div.set-s', { text: 'Počítám…' });
  const sirotciBtn = el('button.btn', { text: 'Smazat verze smazaných souborů', disabled: true });
  const vseBtn = el('button.btn.danger', { text: 'Smazat celou historii', disabled: true });
  Verze.statistika().then((s) => {
    historieInfo.textContent = s.nedostupne ? 'Historie není k dispozici (prohlížeč nedovolí IndexedDB).'
      : s.pocet ? `${plural(s.pocet, ['verze', 'verze', 'verzí'])} u ${plural(s.souboru, ['souboru', 'souborů', 'souborů'])} · ${FS.humanSize(s.velikost)} — leží mimo 5 MB disku`
        : 'Zatím žádné uložené verze.';
    sirotciBtn.disabled = !s.sirotku;
    if (s.sirotku) sirotciBtn.textContent = `Smazat verze smazaných souborů · ${FS.humanSize(s.sirotciVelikost)}`;
    vseBtn.disabled = !s.pocet;
  });
  sirotciBtn.onclick = async () => { const n = await Verze.smazSirotky(); toast({ title: 'Historie vyčištěna', body: `Smazáno ${n} verzí`, icon: 'clock' }); prekresli(); };
  vseBtn.onclick = async () => {
    if (vseBtn.dataset.sure !== '1') { vseBtn.dataset.sure = '1'; vseBtn.textContent = 'Opravdu? Klikni znovu'; return; }
    await Verze.smazVse();
    toast({ title: 'Historie verzí smazána', icon: 'clock' });
    prekresli();
  };
  const historieSw = el('div.switch' + (Verze.zapnuto() ? '.on' : ''));
  historieSw.onclick = () => { const v = !Verze.zapnuto(); Verze.nastavZapnuto(v); historieSw.classList.toggle('on', v); };
  const historie = card(
    el('div.set-sub', { text: 'Historie verzí' }),
    row('Ukládat předchozí verze souborů', `Před změnou souboru se uloží jeho dosavadní obsah — nejvýš jednou za ${Math.round(Verze.INTERVAL / 60e3)} minut, ${Verze.MAX_VERZI} verzí na soubor. Najdeš je v Souborech ▸ pravý klik ▸ Historie verzí.`, historieSw),
    historieInfo,
    el('div.set-actions', {}, sirotciBtn, vseBtn),
  );

  wrap.append(
    card(
      el('div.ul-hlava', {},
        el('div', {},
          el('div.ul-cislo', {}, el('b', { text: FS.humanSize(a.celkem) }), el('span', { text: `z ${FS.humanSize(a.limit)}` })),
          el('div.set-s', { text: plne === 'plny' ? 'Úložiště je skoro plné — nové soubory se nemusí uložit. Zkus vyčištění níž.'
            : plne === 'skoro' ? 'Místo dochází. Videa a nahrávky zaberou nejvíc.'
              : `Volných ${FS.humanSize(Math.max(0, a.limit - a.celkem))}. Tolik dovolí prohlížeč — tady se disk plní doopravdy.` })),
        el('div.ul-proc' + (plne ? '.' + plne : ''), { text: podil(a.procenta) })),
      pruh,
      legenda,
    ),
    uklid,
    a.nejvetsi.length ? card(el('div.set-sub', { text: 'Největší soubory' }), ...a.nejvetsi.map((s) => radekSouboru(s))) : '',
    auto,
    historie,
    card(
      el('div.set-sub', { text: 'Jednotky' }),
      el('div.ul-jednotka', {}, icon('hdd'), el('div', { style: { flex: '1' } },
        el('div.t', { text: 'NOVA NVMe 2 TB · systémová jednotka' }),
        el('div.disk-bar', {}, el('i', { style: { width: Math.max(2, u.percent) + '%' } })),
        el('div.set-s', { text: `${FS.humanSize(u.used)} využito · ${FS.humanSize(u.total - u.used)} volných` }))),
    ),
  );

  function prekresli() {
    const nova = disk();
    wrap.replaceWith(nova);
  }
  return wrap;
}

// ---------------------------------------------------------------- výchozí aplikace (js/vychozi.js)
function vychoziAplikace() {
  const wrap = el('div.set-page', {}, head('Výchozí aplikace', 'Čím se otevře který typ souboru — dvojklikem v Souborech i na ploše.'));
  const hledat = el('input.set-input.va-hledat', { placeholder: 'Hledat typ souboru (třeba .txt)', spellcheck: 'false' });
  hledat.onkeydown = (e) => e.stopPropagation();
  const seznam = el('div');
  const obnovit = el('button.btn', { text: 'Obnovit výchozí', onclick: () => { Vychozi.obnovVse(); kresli(); toast({ title: 'Výchozí aplikace obnoveny', icon: 'grid' }); } });
  wrap.append(card(row('Typ souboru', null, hledat)), seznam,
    card(row('Všechno vrátit', 'Každý typ se zase otevře v aplikaci, kterou vybral systém', obnovit)),
    card(el('div.set-s.va-pozn', { text: 'Video z Astro 3D (.webm) se otevře v Astro 3D, nahrávka z Diktafonu (.webm) v Diktafonu — podle toho, co v souboru je.' })));

  let APPS = null;
  function tlacitko(ext) {
    const k = Vychozi.KANDIDATI[ext] || [];
    const ted = Vychozi.vychoziProPriponu(ext);
    const app = APPS?.[ted] || { id: ted, name: Vychozi.NAZVY[ted] || ted };
    const b = el('button.va-app' + (k.length < 2 ? '.pevna' : ''), { title: k.length < 2 ? 'Tenhle typ umí otevřít jen jedna aplikace' : '' },
      APPS ? glyfAplikace(app, 'div.va-glyf') : null, el('span', { text: Vychozi.NAZVY[ted] || app.name }),
      Vychozi.jeZmenena(ext) ? el('span.va-zmena', { text: 'tvoje volba' }) : null,
      k.length > 1 ? icon('chevronDown') : null);
    if (k.length > 1) {
      b.onclick = () => {
        const r = b.getBoundingClientRect();
        import('../ui.js').then(({ contextMenu }) => contextMenu(k.map((id, i) => ({
          icon: id === ted ? 'check' : null, label: (Vychozi.NAZVY[id] || id) + (i === 0 ? ' (výchozí systému)' : ''),
          onClick: () => { Vychozi.nastav(ext, id); kresli(); },
        })), { x: r.left, y: r.bottom + 4 }));
      };
    }
    return b;
  }

  function kresli() {
    const q = hledat.value.trim().toLowerCase().replace(/^\./, '');
    seznam.replaceChildren(...Vychozi.SKUPINY.map(([nazev, pripony]) => {
      const vybrane = pripony.filter((x) => !q || x.includes(q) || FS.fileInfo('a.' + x).kind.toLowerCase().includes(q));
      if (!vybrane.length) return '';
      return card(el('div.set-sub', { text: nazev }), ...vybrane.map((x) => {
        const info = FS.fileInfo('a.' + x);
        return el('div.set-row.va-radek', {},
          el('div.va-typ', { style: { color: info.color } }, icon(info.icon)),
          el('div', { style: { flex: '1', minWidth: '0' } }, el('div.t', { text: '.' + x, 'data-no-i18n': true }), el('div.s', { text: info.kind })),
          el('div.set-ctl', {}, tlacitko(x)));
      }));
    }));
  }
  hledat.oninput = kresli;
  kresli();
  import('../apps.js').then((m) => { APPS = m.APPS; kresli(); });   // ikony aplikací (apps.js importuje Nastavení → dynamicky)
  return wrap;
}

// ---------------------------------------------------------------- aktualizace (js/aktualizace.js)
const fazeText = (x) => ({
  ceka: `Připraveno ke stažení · ${x.bal.mb} MB`,
  stahuje: `Stahování – ${x.p} % · ${Math.round(x.stazeno)} MB z ${x.bal.mb} MB`,
  instaluje: `Instalace – ${x.p} %`,
  restart: 'Čeká na restart',
  hotovo: 'Nainstalováno',
  chyba: 'Stahování se nepovedlo',
}[x.faze]);

function aktualizaceSekce() {
  const wrap = el('div.set-page', {}, head('Aktualizace', 'Nové funkce, opravy a zabezpečení pro AstroOS.'));
  const hero = el('div.set-card.akt-hero');
  const seznam = el('div');
  const radky = new Map();     // id balíčku → { uzel, t, pruh }
  let posledni = '';
  let pripojeno = false;

  const otevri = (id, opts) => import('../apps.js').then(({ openApp }) => openApp(id, opts));

  function kresliHero({ stav, polozky, chyba }) {
    const ceka = polozky.filter((x) => x.faze === 'ceka');
    const mb = ceka.reduce((s, x) => s + x.bal.mb, 0);
    const kdy = Akt.posledniKontrola();
    const zkontrolovano = kdy ? `Naposledy zkontrolováno ${pred(kdy)}` : 'Aktualizace se zatím nehledaly';
    const btn = (text, onclick, hlavni = false) => el('button.btn' + (hlavni ? '.primary' : ''), { text, onclick });
    const v = {
      klid: ['ok', 'check', Akt.nazevOS(), zkontrolovano, btn('Vyhledat aktualizace', () => Akt.hledej())],
      aktualni: ['ok', 'check', 'Máš nejnovější verzi', `${Akt.nazevOS()} · ${zkontrolovano.toLowerCase()}`, btn('Vyhledat aktualizace', () => Akt.hledej())],
      hledam: ['bezi', 'refresh', 'Hledání aktualizací…', 'Ptám se serveru AstroMeo, co je nového.', null],
      'k-dispozici': ['nove', 'download', 'K dispozici jsou aktualizace', `${ceka.length === 1 ? '1 aktualizace' : ceka.length + ' aktualizace'} · celkem ${mb} MB`,
        btn('Stáhnout a nainstalovat', () => Akt.nainstaluj(), true)],
      pracuji: ['bezi', 'refresh', 'Instalace aktualizací…', 'Můžeš klidně dál pracovat. Až bude potřeba restart, AstroOS dá vědět.', null],
      restart: ['restart', 'restart', 'Je potřeba restart', 'Aktualizace se dokončí po restartu počítače. Ulož si rozdělanou práci.',
        btn('Restartovat hned', () => bus.emit('power', 'restart'), true)],
      chyba: ['chyba', 'x', 'Aktualizace se nepovedla', chyba,
        btn('Zkusit znovu', () => (polozky.some((x) => x.faze === 'chyba') ? Akt.nainstaluj() : Akt.hledej()))],
    }[stav];
    const [druh, ic, nadpis, text, tlacitko] = v;
    hero.dataset.druh = druh;
    hero.replaceChildren(
      el('div.akt-ikona', {}, icon(ic)),
      el('div.akt-txt', {}, el('div.akt-nadpis', { text: nadpis }), el('div.set-s', { text })),
      el('div.set-ctl', {}, tlacitko),
    );
  }

  function kresliSeznam({ polozky }) {
    if (!polozky.length) { seznam.replaceChildren(); radky.clear(); return; }
    const ids = polozky.map((x) => x.bal.id).join(',');
    if (seznam.dataset.ids !== ids) {
      seznam.dataset.ids = ids;
      radky.clear();
      seznam.replaceChildren(card(...polozky.map((x) => {
        const t = el('div.s');
        const pruh = el('i');
        const uzel = el('div.set-row.akt-radek', {},
          el('div', { style: { flex: '1' } },
            el('div.t', { text: x.bal.nazev }),
            el('div.s', { text: x.bal.popis }),
            t,
            el('div.akt-pruh', {}, pruh)),
        );
        radky.set(x.bal.id, { uzel, t, pruh });
        return uzel;
      })));
    }
    for (const x of polozky) {
      const r = radky.get(x.bal.id);
      r.t.textContent = fazeText(x);
      r.uzel.dataset.faze = x.faze;
      r.pruh.style.width = (x.faze === 'ceka' ? 0 : x.faze === 'stahuje' || x.faze === 'instaluje' ? x.p : 100) + '%';
    }
  }

  const historie = () => {
    const h = Akt.historie();
    return card(
      el('div.set-sub', { text: 'Historie aktualizací' }),
      ...h.map((n) => row(n.bal.nazev, `${n.bal.popis} · nainstalováno ${cz.datumKratky(new Date(n.cas))}`, null)),
      row(`AstroOS ${Akt.ZAKLAD.verze} „${Akt.ZAKLAD.kodnazev}“`, `Instalace systému · ${cz.datumKratky(new Date(State.get('installed')))}`, null),
    );
  };
  const histObal = el('div');

  const novinky = () => {
    const v = Akt.verzeOS();
    const hlavni = v.verze.split('.').slice(0, 2).join('.');
    if (!Akt.NOVINKY[hlavni] || hlavni === Akt.ZAKLAD.verze) return null;
    return card(row(`Co je nového v AstroOS ${hlavni}`, 'Přehled novinek, které tahle verze přinesla',
      el('button.btn', { text: 'Zobrazit', onclick: () => otevri('novinky', { verze: hlavni }) })));
  };

  const autoSw = el('div.switch' + (Akt.autoHledani() ? '.on' : ''));
  autoSw.onclick = () => { const v = !Akt.autoHledani(); Akt.nastavAuto(v); autoSw.classList.toggle('on', v); };

  const kresli = () => {
    if (pripojeno && !wrap.isConnected) { off(); return; }
    const s = Akt.stavTed();
    if (s.stav !== posledni) {
      posledni = s.stav;
      kresliHero(s);
      histObal.replaceChildren(historie());
    } else if (s.stav === 'chyba') kresliHero(s);
    kresliSeznam(s);
  };
  const off = bus.on('aktualizace', kresli);
  kresli();
  pripojeno = true;

  wrap.append(hero, seznam, novinky() || '',
    card(
      el('div.set-sub', { text: 'Další možnosti' }),
      row('Hledat aktualizace automaticky', 'Po přihlášení se AstroOS občas sám zeptá, jestli je něco nového', autoSw),
      row('Kanál', 'Odkud AstroOS bere aktualizace', el('span.set-val', { text: 'Stabilní', style: { width: 'auto' } })),
    ),
    histObal);
  return wrap;
}

function info() {
  const v = Akt.verzeOS();
  const specs = [
    ['Název systému', Akt.nazevOS()],
    ['Sestavení', `${v.sestaveni} · kanál stabilní`],
    ['Jádro', `nova ${v.jadro}`],
    ['Procesor', 'Astro Core X7-9900 @ 4.20 GHz'],
    ['Paměť', '32 GB DDR5'],
    ['Grafika', 'AstroGPU 12 GB'],
    ['Úložiště', 'NOVA NVMe 2 TB · ASTRO SSD 1 TB'],
    ['Uživatel', State.get('user').name],
    ['Prostředí', 'Astro Shell (web)'],
  ];
  return el('div.set-page', {},
    head('O systému'),
    card(
      el('div.about-top', {}, logo('logo'), el('div', {},
        el('h3', { text: 'AstroOS' }),
        el('div.set-s', { text: `Verze ${v.verze} · vytvořeno pro AstroMeo` }),
      )),
      ...specs.map(([k, v]) => el('div.spec', {}, el('div.k', { text: k }), el('div.v', { text: v }))),
    ),
  );
}

const PAGES = { vzhled, tapeta, plocha, panel: panelSekce, ucet, sit: sitSekce, zvuk: zvukSekce, jazyk: jazykSekce, system, disk, aplikace: vychoziAplikace, aktualizace: aktualizaceSekce, info };

// ---------------------------------------------------------------- aplikace
export const settingsApp = {
  id: 'settings', name: 'Nastavení', icon: 'settings', color: 'linear-gradient(145deg,#7d8b96,#4a565f)',
  cat: 'system', width: 880, height: 620,

  mount(body, win) {
    const nav = el('div.set-nav');
    const page = el('div.set-body');
    let cur = win.opts?.section || 'vzhled';

    const draw = () => {
      [...nav.children].forEach((b) => b.classList.toggle('on', b.dataset.id === cur));
      page.innerHTML = '';
      page.append(PAGES[cur]());
      win.title = 'Nastavení — ' + SECTIONS.find((s) => s.id === cur).name;
    };

    for (const s of SECTIONS) {
      const b = el('button.set-nav-i', { dataset: { id: s.id } }, icon(s.icon), el('span', { text: s.name }));
      b.onclick = () => { cur = s.id; draw(); };
      nav.append(b);
    }

    body.append(el('div.set', {}, nav, page));
    draw();

    const off = bus.on('fs:change', () => { if (cur === 'disk' && body.isConnected) draw(); });
    win.onClose = off;
  },

  unmount(win) { win.onClose?.(); },
  reopen(win, opts) { if (opts?.section) { win.opts = opts; win.body.innerHTML = ''; settingsApp.mount(win.body, win); } },
};
