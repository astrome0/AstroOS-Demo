// AstroOS — Soubory (správce souborů nad virtuálním diskem)

import { el, bus, cz, clamp, plural } from '../util.js';
import { icon } from '../icons.js';
import * as FS from '../fs.js';
import { jazykSouboru } from '../zvyrazneni.js';
import { contextMenu, toast } from '../ui.js';
import { jeAplikaceSlozka, zaznamPro } from '../aplikace.js';
import {
  PLOCHA, otevri, otevriV, aplikacePro, glyfSouboru, druhSouboru, schranka, doSchranky, vloz, presun, doKose, nabidkaNovy, novaSlozka, vlastnosti,
} from '../soubory.js';
import { tahni } from '../prenos.js';
import { t, tx } from '../i18n.js';
import * as Najdi from '../najdi.js';
import * as Zip from '../zip.js';
import * as Stitky from '../stitky.js';
import { State } from '../state.js';
import * as Vychozi from '../vychozi.js';

const PLACES = [
  { name: 'Domů', path: FS.HOME, icon: 'home' },
  { name: 'Plocha', path: FS.HOME + '/Plocha', icon: 'monitor' },
  { name: 'Dokumenty', path: FS.HOME + '/Dokumenty', icon: 'fileText' },
  { name: 'Obrázky', path: FS.HOME + '/Obrázky', icon: 'image' },
  { name: 'Hudba', path: FS.HOME + '/Hudba', icon: 'music' },
  { name: 'Stažené', path: FS.HOME + '/Stažené', icon: 'folder' },
  { name: 'Projekty', path: FS.HOME + '/projekty', icon: 'code' },
  '-',
  { name: 'Systém', path: '/system', icon: 'settings' },
  { name: 'Koš', path: FS.TRASH, icon: 'trash' },
];

export const filesApp = {
  id: 'files', name: 'Soubory', icon: 'folder', color: 'linear-gradient(145deg,#4aa3e8,#2563a8)',
  cat: 'tools', width: 900, height: 580,

  mount(body, win) {
    const st = {
      cwd: win.opts?.path || FS.HOME,
      hist: [], fwd: [],
      view: 'grid',
      sel: new Set(),
      dotaz: '',          // hledání (najdi.js) — prázdné = běžný výpis složky
      hledej: { rozsah: 'slozka', druh: 'vse', velikost: 'vse', datum: 'vse', stitek: 'vse', obsah: true },
      hidden: false,
    };
    win.fm = st;

    // ---------- lišta ----------
    const btn = (ic, title, fn, cls = '') => {
      const b = el('button.fm-tool' + cls, { title, onclick: fn }, icon(ic));
      return b;
    };
    const bBack = btn('chevronLeft', 'Zpět', () => back());
    const bFwd = btn('chevronRight', 'Vpřed', () => forward());
    const bUp = btn('arrowRight', 'O úroveň výš', () => go(FS.dirname(st.cwd)));
    bUp.firstChild.style.transform = 'rotate(-90deg)';
    const crumbs = el('div.fm-crumbs');
    const search = el('input.fm-search', { spellcheck: 'false' });
    let odklad = 0;
    search.oninput = () => {
      clearTimeout(odklad);
      odklad = setTimeout(() => { st.dotaz = search.value.trim(); st.sel.clear(); draw(); }, 140);
    };
    search.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') zrusHledani();
      if (e.key === 'Enter') { clearTimeout(odklad); st.dotaz = search.value.trim(); draw(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); body.focus(); }
    };
    // filtry platí jen pro jedno hledání; „I v obsahu“ si okno pamatuje
    const vychoziFiltry = () => { st.hledej = { rozsah: 'slozka', druh: 'vse', velikost: 'vse', datum: 'vse', stitek: 'vse', obsah: st.hledej.obsah }; };
    const zrusHledani = () => { clearTimeout(odklad); search.value = ''; st.dotaz = ''; vychoziFiltry(); st.sel.clear(); draw(); };
    const bView = btn('grid', 'Přepnout zobrazení', () => {
      st.view = st.view === 'grid' ? 'list' : 'grid';
      bView.replaceChildren(icon(st.view === 'grid' ? 'grid' : 'fileText'));
      draw();
    });
    const bNew = btn('plus', 'Nová složka', () => newFolder());

    const bar = el('div.fm-bar', {}, bBack, bFwd, bUp, crumbs, search, bNew, bView);

    // ---------- karty (jako v Průzkumníku Windows 11) ----------
    // `st` je vždycky stav aktivní karty; ostatní karty drží snímek těch polí, při přepnutí se prohodí.
    const POLE_KARTY = ['cwd', 'hist', 'fwd', 'view', 'sel', 'dotaz', 'hledej'];
    const snimek = () => ({ ...Object.fromEntries(POLE_KARTY.map((k) => [k, st[k]])), scroll: view.scrollTop });
    const karty = [null];      // snímek aktivní karty doplní kresliKarty() při každém draw()
    let aktivni = 0;
    const kartyEl = el('div.fm-karty');

    function prepniKartu(i) {
      if (i === aktivni || !karty[i]) return;
      karty[aktivni] = snimek();
      nactiKartu(i);
    }

    function novaKarta(path = FS.HOME, { naPozadi = false } = {}) {
      karty[aktivni] = snimek();
      karty.splice(aktivni + 1, 0, {
        cwd: FS.isDir(FS.get(path)) ? path : FS.HOME, hist: [], fwd: [], view: st.view, sel: new Set(), dotaz: '',
        hledej: { rozsah: 'slozka', druh: 'vse', velikost: 'vse', datum: 'vse', stitek: 'vse', obsah: st.hledej.obsah }, scroll: 0,
      });
      if (naPozadi) kresliKarty();
      else prepniKartu(aktivni + 1);
    }

    function zavriKartu(i = aktivni) {
      if (karty.length === 1) return win.close();
      karty[aktivni] = snimek();
      karty.splice(i, 1);
      nactiKartu(i < aktivni ? aktivni - 1 : Math.min(aktivni, karty.length - 1));
    }
    function nactiKartu(i) {   // načte kartu bez uložení té současné (zavřená karta už neexistuje)
      aktivni = i;
      const k = karty[i];
      Object.assign(st, Object.fromEntries(POLE_KARTY.map((p) => [p, k[p]])));
      clearTimeout(odklad);
      search.value = st.dotaz;
      bView.replaceChildren(icon(st.view === 'grid' ? 'grid' : 'fileText'));
      zavriNahled();
      draw();
      view.scrollTop = k.scroll || 0;
    }

    const nazevKarty = (k) => (k.dotaz ? `Hledání „${k.dotaz}“` : k.hledej?.stitek && k.hledej.stitek !== 'vse' ? `Štítek: ${Stitky.nazevStitku(k.hledej.stitek)}` : nazevSlozky(k.cwd));
    function kresliKarty() {
      karty[aktivni] = { ...snimek() };
      kartyEl.replaceChildren(
        ...karty.map((k, i) => {
          const b = el('div.fm-karta' + (i === aktivni ? '.on' : ''), { title: k.cwd.replace(FS.HOME, '~'), 'data-no-i18n': true },
            icon(k.dotaz ? 'search' : k.cwd === FS.TRASH ? 'trash' : k.cwd === FS.HOME ? 'home' : 'folder'),
            el('span', { text: nazevKarty(k) }),
            el('button.fm-karta-x', { title: 'Zavřít kartu (Ctrl+W)', onclick: (e) => { e.stopPropagation(); zavriKartu(i); } }, icon('x')));
          b.onpointerdown = (e) => { if (e.button === 0 && !e.target.closest('.fm-karta-x')) prepniKartu(i); };
          b.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); zavriKartu(i); } };
          return b;
        }),
        el('button.fm-karta-plus', { title: 'Nová karta (Ctrl+T)', onclick: () => novaKarta() }, icon('plus')),
      );
    }

    // ---------- boční panel ----------
    const side = el('div.fm-side');
    for (const p of PLACES) {
      if (p === '-') { side.append(el('div.fm-sep')); continue; }
      const b = el('button.fm-place', { dataset: { path: p.path } }, icon(p.icon), el('span', { text: p.name }));
      b.onclick = () => go(p.path);
      b.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); novaKarta(p.path, { naPozadi: true }); } };
      side.append(b);
    }
    // štítky (stitky.js): klik = všechno se štítkem na celém disku, pravé tlačítko = přejmenovat
    const stitkyBox = el('div.fm-stitky');
    side.append(el('div.fm-sep'), stitkyBox);
    function kresliStitky() {
      const pocty = Stitky.pocty();
      stitkyBox.replaceChildren(el('div.fm-side-nadpis', { text: 'Štítky' }), ...Stitky.STITKY.map((s) => {
        const on = !st.dotaz && st.hledej.stitek === s.id;
        const b = el('button.fm-place.fm-stitek' + (on ? '.on' : ''), { dataset: { stitek: s.id } },
          el('span.fm-tecka', { style: { background: s.barva } }),
          el('span', { text: Stitky.nazevStitku(s.id), 'data-no-i18n': !!(State.get('stitkyNazvy') || {})[s.id] }),
          pocty[s.id] ? el('small', { text: String(pocty[s.id]) }) : null);
        b.onclick = () => ukazStitek(s.id);
        b.oncontextmenu = (e) => {
          e.preventDefault();
          contextMenu([
            { icon: 'search', label: 'Zobrazit vše se štítkem', onClick: () => ukazStitek(s.id) },
            { icon: 'notes', label: 'Přejmenovat štítek', onClick: () => prejmenujStitekNaMiste(b, s.id) },
          ], { x: e.clientX, y: e.clientY });
        };
        return b;
      }));
    }
    function ukazStitek(id) {
      clearTimeout(odklad);
      search.value = '';
      st.dotaz = '';
      st.sel.clear();
      st.hledej = { rozsah: 'disk', druh: 'vse', velikost: 'vse', datum: 'vse', stitek: id, obsah: st.hledej.obsah };
      draw();
    }
    function prejmenujStitekNaMiste(b, id) {
      const vstup = el('input.fm-rename.fm-stitek-vstup', { value: Stitky.nazevStitku(id), spellcheck: 'false' });
      b.querySelector('span:nth-child(2)').replaceWith(vstup);
      vstup.focus();
      vstup.select();
      const hotovo = (ulozit) => {
        vstup.onblur = null;
        if (ulozit) Stitky.prejmenujStitek(id, vstup.value.trim().slice(0, 24));
        else kresliStitky();
      };
      vstup.onblur = () => hotovo(true);
      vstup.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') hotovo(true); if (e.key === 'Escape') hotovo(false); };
      vstup.onclick = (e) => e.stopPropagation();
    }

    const diskBox = el('div.fm-disk');
    side.append(diskBox);

    const view = el('div.fm-view');
    const status = el('div.fm-status');
    const fbar = el('div.fm-filtry');   // filtry hledání — jen když se hledá
    body.append(el('div.fm', {}, kartyEl, bar, fbar, el('div.fm-main', {}, side, view), status));

    // ---------- navigace ----------
    function go(path, remember = true) {
      const n = FS.normalize(path);
      if (!FS.isDir(FS.get(n))) return;
      if (remember && n !== st.cwd) { st.hist.push(st.cwd); st.fwd.length = 0; }
      st.cwd = n;
      st.sel.clear();
      clearTimeout(odklad);
      search.value = '';
      st.dotaz = '';
      vychoziFiltry();
      draw();
    }
    function back() { if (st.hist.length) { st.fwd.push(st.cwd); go(st.hist.pop(), false); } }
    function forward() { if (st.fwd.length) { st.hist.push(st.cwd); go(st.fwd.pop(), false); } }

    // ---------- vykreslení ----------
    function drawCrumbs() {
      crumbs.innerHTML = '';
      const parts = st.cwd === '/' ? [] : st.cwd.slice(1).split('/');
      const rootBtn = el('button.crumb', {}, icon('hdd'), el('span', { text: 'Disk' }));
      rootBtn.onclick = () => go('/');
      crumbs.append(rootBtn);
      let acc = '';
      parts.forEach((p, i) => {
        acc += '/' + p;
        const path = acc;
        crumbs.append(el('span.crumb-sep', {}, icon('chevronRight')));
        const b = el('button.crumb' + (i === parts.length - 1 ? '.on' : ''), { text: p });
        b.onclick = () => go(path);
        crumbs.append(b);
      });
    }

    function draw() {
      drawCrumbs();
      kresliKarty();
      bBack.disabled = !st.hist.length;
      bFwd.disabled = !st.fwd.length;
      bUp.disabled = st.cwd === '/';
      [...side.querySelectorAll('.fm-place')].forEach((b) => b.classList.toggle('on', b.dataset.path === st.cwd && !st.dotaz && st.hledej.stitek === 'vse'));
      kresliStitky();
      win.title = st.cwd === FS.HOME ? 'Domů'
        : st.cwd === FS.TRASH ? 'Koš'
        : (FS.basename(st.cwd) || 'Tento počítač');

      const u = FS.usage();
      diskBox.innerHTML = '';
      diskBox.append(
        el('div.fm-disk-t', {}, icon('hdd'), el('span', { text: 'NOVA NVMe' })),
        el('div.fm-disk-bar', {}, el('i', { style: { width: clamp(u.percent, 2, 100) + '%' } })),
        el('div.fm-disk-s', { text: `${FS.humanSize(u.used)} z 2 TB` }),
      );

      search.placeholder = `Prohledat: ${nazevSlozky(st.cwd)}`;
      if (st.dotaz || st.hledej.stitek !== 'vse') return drawHledani();
      fbar.hidden = true;

      view.innerHTML = '';
      view.className = 'fm-view ' + st.view;
      view.dataset.cwd = st.cwd;
      let items;
      try { items = FS.list(st.cwd, { hidden: st.hidden || st.cwd === FS.TRASH }); }
      catch { items = []; }

      if (!items.length) {
        view.append(el('div.fm-empty', {},
          icon('folderOpen'),
          el('div', { text: st.cwd === FS.TRASH ? 'Koš je prázdný' : 'Tahle složka je prázdná' }),
        ));
      }

      for (const it of items) view.append(itemNode(it));

      const dirs = items.filter((i) => i.dir).length;
      status.innerHTML = '';
      status.append(...[
        el('span', { text: plural(items.length, ['položka', 'položky', 'položek']) + (dirs ? ` · ${plural(dirs, ['složka', 'složky', 'složek'])}` : '') }),
        el('span', { text: FS.humanSize(items.reduce((s, i) => s + i.size, 0)) }),
        st.cwd === FS.TRASH && items.length
          ? el('button.fm-mini', { text: 'Vysypat koš', onclick: () => { FS.emptyTrash(); toast({ title: 'Koš vysypán', icon: 'trash' }); } })
          : null,
        st.sel.size > 1 ? el('span', { text: `Vybráno: ${st.sel.size}` }) : null,
        schranka.cesty.length ? el('span.fm-clip', {
          text: `${schranka.rezim === 'cut' ? 'Vyjmuto' : 'Zkopírováno'}: ${schranka.cesty.length === 1 ? FS.basename(schranka.cesty[0]) : plural(schranka.cesty.length, ['položka', 'položky', 'položek'])}`,
        }) : null,
      ].filter(Boolean));
    }

    // ---------- hledání (najdi.js) ----------
    const nazevSlozky = (p) => (p === FS.HOME ? t('Domů') : p === '/' ? 'Disk' : p === FS.TRASH ? t('Koš')
      : FS.dirname(p) === FS.HOME ? t(FS.basename(p)) : FS.basename(p));
    const ROZSAHY = () => [
      ['slozka', nazevSlozky(st.cwd)],
      ...(st.cwd !== FS.HOME ? [['domov', t('Domů')]] : []),
      ...(st.cwd !== '/' ? [['disk', 'Celý disk']] : []),
    ];
    const korenHledani = () => ({ slozka: st.cwd, domov: FS.HOME, disk: '/' }[st.hledej.rozsah] || st.cwd);

    /** Tlačítko filtru: klik otevře nabídku voleb, vybraná má fajfku. */
    function filtr(klic, nazev, volby) {
      const vybrana = volby.find(([v]) => v === st.hledej[klic]) || volby[0];
      const aktivni = vybrana !== volby[0] && klic !== 'rozsah';
      const b = el('button.fm-filtr' + (aktivni ? '.on' : ''), {},
        el('span.fm-filtr-n', { text: nazev }), el('span', { text: vybrana[1] }), icon('chevronDown'));
      b.onclick = () => {
        const r = b.getBoundingClientRect();
        contextMenu(volby.map(([v, popis, barva]) => ({
          icon: v === st.hledej[klic] ? 'check' : null, barva: barva && v !== st.hledej[klic] ? barva : null, label: popis,
          onClick: () => { st.hledej[klic] = v; draw(); },
        })), { x: r.left, y: r.bottom + 4 });
      };
      return b;
    }

    function drawHledani() {
      const h = st.hledej;
      if (!ROZSAHY().some(([v]) => v === h.rozsah)) h.rozsah = 'slozka';
      const koren = korenHledani();
      const zacatek = performance.now();
      const vysledky = Najdi.hledej(st.dotaz, { kde: koren, obsah: h.obsah, druh: h.druh, velikost: h.velikost, datum: h.datum, stitek: h.stitek, skryte: st.hidden });
      const ms = Math.max(1, Math.round(performance.now() - zacatek));

      // lišta filtrů
      const obsahBtn = el('button.fm-filtr' + (h.obsah ? '.on' : ''), { title: 'Hledat i uvnitř textových souborů' },
        icon(h.obsah ? 'check' : 'fileText'), el('span', { text: 'I v obsahu' }));
      obsahBtn.onclick = () => { h.obsah = !h.obsah; draw(); };
      fbar.hidden = false;
      fbar.replaceChildren(
        icon('search'),
        filtr('rozsah', 'Kde:', ROZSAHY()),
        filtr('druh', 'Druh:', Najdi.DRUHY),
        filtr('velikost', 'Velikost:', Najdi.VELIKOSTI),
        filtr('datum', 'Změněno:', Najdi.DATA),
        filtr('stitek', 'Štítek:', [['vse', 'Vše'], ...Stitky.STITKY.map((x) => [x.id, Stitky.nazevStitku(x.id), x.barva])]),
        obsahBtn,
        el('button.fm-filtr.fm-filtr-zavrit', { title: 'Zavřít hledání (Esc)', onclick: zrusHledani }, icon('x'), el('span', { text: 'Zavřít' })),
      );

      const jenStitek = !st.dotaz;   // boční lišta ▸ Štítky: všechno se štítkem
      win.title = jenStitek ? `Štítek: ${Stitky.nazevStitku(h.stitek)}` : `Hledání „${st.dotaz}“`;
      view.innerHTML = '';
      view.className = 'fm-view list fm-hledani';
      view.dataset.cwd = st.cwd;

      if (!vysledky.length) {
        view.append(el('div.fm-empty', {},
          icon('search'),
          el('div', { text: jenStitek ? `Nic nemá štítek ${Stitky.nazevStitku(h.stitek)}` : `Nic nenalezeno pro „${st.dotaz}“` }),
          jenStitek ? el('div.set-s', { text: 'Štítek přidáš pravým tlačítkem na souboru nebo složce ▸ Štítky.' }) : null,
          h.rozsah !== 'disk' && st.cwd !== '/'
            ? el('button.btn.fm-empty-btn', { text: 'Hledat na celém disku', onclick: () => { h.rozsah = 'disk'; draw(); } }) : null,
        ));
      }
      for (const it of vysledky) view.append(hitNode(it));

      status.replaceChildren(...[
        el('span', { text: plural(vysledky.celkem || 0, ['výsledek', 'výsledky', 'výsledků']) + (vysledky.celkem > vysledky.length ? ` (zobrazeno ${vysledky.length})` : '') }),
        el('span.fm-stav-kde', {}, icon('folder'), el('span', { text: koren === '/' ? 'Disk' : koren.replace(FS.HOME, '~'), 'data-no-i18n': true })),
        h.obsah && vysledky.prohledano ? el('span', { text: `obsah: ${plural(vysledky.prohledano, ['soubor', 'soubory', 'souborů'])}` }) : null,
        el('span', { text: `${ms} ms` }),
        st.sel.size > 1 ? el('span', { text: `Vybráno: ${st.sel.size}` }) : null,
      ].filter(Boolean));
    }

    /** Text se zvýrazněnými shodami (mark), bez innerHTML — názvy i obsah jsou uživatelovy. */
    const sZvyraznenim = (cls, text) => el(cls, { 'data-no-i18n': true },
      ...Najdi.zvyrazni(text, st.dotaz).map((k) => (k.shoda ? el('mark', { text: k.t }) : k.t)));

    function hitNode(it) {
      const n = itemNode(it, true);
      const cesta = FS.dirname(it.path);
      n.querySelector('.fm-name').replaceWith(el('div.fm-hit', {},
        el('div.fm-hit-n', {}, sZvyraznenim('div.fm-name', it.name), ...tecky(it.node)),
        el('div.fm-hit-cesta', { text: cesta === FS.HOME ? '~' : cesta.replace(FS.HOME + '/', '~/'), 'data-no-i18n': true }),
        it.uryvek ? el('div.fm-hit-ury', { 'data-no-i18n': true },
          it.uryvek.pred, el('mark', { text: it.uryvek.shoda }), it.uryvek.za) : null,
      ));
      return n;
    }

    /** Skočí do složky souboru a označí ho (z výsledků hledání). */
    function ukazUmisteni(path) {
      go(FS.dirname(path));
      st.sel = new Set([path]);
      oznac();
      view.querySelector(`[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({ block: 'center' });
    }

    // ---------- rychlý náhled (mezerník, jako Quick Look v macOS) ----------
    let nahled = null;    // { path, uzel }

    async function obsahNahledu(path) {
      const node = FS.get(path);
      const name = FS.basename(path);
      const text = (t) => el('pre.ql-text', { text: t, 'data-no-i18n': true });
      const stranka = (html) => el('iframe.ql-html', {
        sandbox: '',   // bez skriptů a bez přístupu k čemukoli — jen se vykreslí
        srcdoc: `<meta charset="utf-8"><style>body{font:14px/1.55 "Segoe UI",sans-serif;padding:22px 28px;color:#1d2327;background:#fff;margin:0}img{max-width:100%}</style>${html}`,
      });
      if (FS.isDir(node)) {
        const items = FS.list(path, { hidden: st.hidden });
        return el('div.ql-slozka', {},
          el('div.ql-velky-glyf', {}, glyfSouboru(path, node)),
          el('div.ql-seznam', {}, items.slice(0, 16).map((i) => el('div.ql-polozka', {},
            el('span.ql-mini-glyf', {}, glyfSouboru(i.path, i.node)), el('span', { text: i.name, 'data-no-i18n': true }))),
          items.length > 16 ? el('div.ql-dalsi', { text: `…a dalších ${items.length - 16}` }) : null));
      }
      const c = String(node.c);
      const img = FS.imageSrc(path);
      if (img) return el('img.ql-obr', { src: img, alt: '' });
      const zvuk = FS.audioSrc(path);
      if (zvuk) {
        return zvuk.startsWith('data:video/')
          ? el('video.ql-video', { src: zvuk, controls: true })
          : el('div.ql-zvuk', {}, el('div.ql-velky-glyf', {}, glyfSouboru(path, node)), el('audio', { src: zvuk, controls: true }));
      }
      if (Zip.jeZip(name) && c.startsWith('data:')) {
        try {
          const polozky = await Zip.prectiZip(Zip.zDataUrl(c).data);
          return el('div.ql-seznam.ql-zip', {}, polozky.map((p) => el('div.ql-polozka', {},
            el('span.ql-mini-glyf', {}, p.slozka ? icon('folder') : glyfSouboru('/' + p.cesta, { c: '' })),
            el('span', { text: p.cesta, 'data-no-i18n': true }),
            el('small', { text: p.slozka ? '' : FS.humanSize(p.data.length) }))));
        } catch (err) { return el('div.ql-info', {}, icon('box'), el('div', { text: err.message })); }
      }
      // dokumenty Astro Office jsou JSON — Písmo má html, u ostatních aspoň texty z buněk/snímků
      if (/\.(docx|xlsx|pptx)$/i.test(name) && c.startsWith('{')) {
        try {
          const j = JSON.parse(c);
          if (typeof j.html === 'string') return stranka(j.html);
          const texty = [];
          (function sber(v) {
            if (texty.length > 300) return;
            if (typeof v === 'string') { if (v.trim() && !/^[#a-z0-9_-]{1,12}$/i.test(v)) texty.push(v.replace(/<[^>]+>/g, ' ').trim()); }
            else if (v && typeof v === 'object') Object.values(v).forEach(sber);
          })(j);
          return text(texty.filter(Boolean).join('\n'));
        } catch { /* poškozený — ukáže se jako text */ }
      }
      if (/\.html?$/i.test(name) && !c.startsWith('data:')) return stranka(c);
      if (FS.isText(name) && !c.startsWith('data:')) return text(c.length > 200000 ? c.slice(0, 200000) + '\n…' : c);
      return el('div.ql-info', {}, el('div.ql-velky-glyf', {}, glyfSouboru(path, node)), el('div', { text: 'Náhled pro tenhle typ souboru není k dispozici.' }));
    }

    async function otevriNahled(path) {
      const node = FS.get(path);
      if (!node) return;
      zavriNahled();
      const name = FS.basename(path);
      const [appId, appNazev] = aplikacePro(path);
      const telo = el('div.ql-telo', {}, el('div.ql-nacitani', {}, icon('eye')));
      const zavrit = el('button.ql-tl', { title: 'Zavřít (mezerník)', onclick: zavriNahled }, icon('x'));
      const okno = el('div.ql-okno', {},
        el('div.ql-hlava', {},
          el('span.ql-mini-glyf', {}, glyfSouboru(path, node)),
          el('div.ql-titul', {},
            el('b', { 'data-no-i18n': true }, name, ...tecky(node)),
            el('small', { text: `${druhSouboru(path)} · ${FS.isDir(node) ? plural(Object.keys(node.d).length, ['položka', 'položky', 'položek']) : FS.humanSize(FS.size(node))} · ${cz.datumKratky(new Date(node.m || 0))}` })),
          appId && path.indexOf(FS.TRASH + '/') !== 0
            ? el('button.btn.ql-otevrit', { onclick: () => { zavriNahled(); open(entry(path)); } }, el('span', { text: FS.isDir(node) ? 'Otevřít složku' : `Otevřít v aplikaci ${appNazev}` }))
            : null,
          zavrit),
        telo,
        el('div.ql-pata', { text: 'Mezerník nebo Esc zavře · ← → předchozí a další soubor · Enter otevře' }));
      const uzel = el('div.ql', {}, okno);
      uzel.onpointerdown = (e) => { if (e.target === uzel) zavriNahled(); };
      view.parentElement.append(uzel);
      nahled = { path, uzel };
      st.sel = new Set([path]);
      oznac();
      view.querySelector(`[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({ block: 'nearest' });
      body.focus({ preventScroll: true });
      const obsah = await obsahNahledu(path);
      if (nahled?.path === path) telo.replaceChildren(obsah);
    }

    function zavriNahled() {
      nahled?.uzel.remove();   // odebrání zastaví i přehrávané video/zvuk
      nahled = null;
    }

    /** Klávesy, když je náhled otevřený. Vrací true, když je spolkl. */
    function nahledKlavesa(e) {
      if (!nahled) return false;
      const cesty = [...view.querySelectorAll('.fm-item')].map((n) => n.dataset.path);
      const i = cesty.indexOf(nahled.path);
      if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); zavriNahled(); return true; }
      if (e.key === 'Enter') { e.preventDefault(); const p = nahled.path; zavriNahled(); open(entry(p)); return true; }
      const smer = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
      if (smer) {
        e.preventDefault();
        const dalsi = cesty[(i + smer + cesty.length) % cesty.length];
        if (dalsi && dalsi !== nahled.path) otevriNahled(dalsi);
        return true;
      }
      return false;
    }

    /** Barevné tečky štítků za názvem položky. */
    const tecky = (uzel) => {
      const t = Stitky.stitkyUzlu(uzel);
      return t.length ? [el('span.fm-tecky', { title: t.map(Stitky.nazevStitku).join(', ') },
        t.map((id) => el('i', { style: { background: Stitky.stitek(id).barva } })))] : [];
    };

    /** Podnabídky Štítky a Barva složky pro vybrané položky. */
    function nabidkaStitku(cesty) {
      const slozky = cesty.every((c) => FS.isDir(FS.get(c)));
      const barva = slozky && cesty.length === 1 ? FS.get(cesty[0]).barva || '' : null;
      return [
        {
          icon: 'pin', label: 'Štítky', sub: [
            ...Stitky.STITKY.map((s) => ({
              barva: s.barva, label: Stitky.nazevStitku(s.id), key: Stitky.majiVsechny(cesty, s.id) ? '✓' : '',
              onClick: () => Stitky.prepniStitek(cesty, s.id),
            })),
            '-',
            { icon: 'x', label: 'Odebrat všechny štítky', disabled: !cesty.some((c) => Stitky.stitkyUzlu(FS.get(c)).length),
              onClick: () => { for (const c of cesty) delete FS.get(c).tagy; FS.save(FS.dirname(cesty[0])); } },
          ],
        },
        slozky ? {
          icon: 'palette', label: 'Barva složky', sub: [
            { icon: 'folder', label: 'Výchozí', key: barva === '' ? '✓' : '', onClick: () => Stitky.nastavBarvu(cesty, null) },
            ...Stitky.BARVY_SLOZEK.map((b) => ({
              barva: b.tecka, label: b.nazev, key: barva === b.id ? '✓' : '', onClick: () => Stitky.nastavBarvu(cesty, b.id),
            })),
          ],
        } : null,
      ];
    }

    const oznac = () => [...view.children].forEach((c) => c.classList.toggle('sel', st.sel.has(c.dataset.path)));

    function itemNode(it, seznam = st.view === 'list') {
      const vyjmuto = schranka.rezim === 'cut' && schranka.cesty.includes(it.path);
      const node = el('div.fm-item' + (st.sel.has(it.path) ? '.sel' : '') + (vyjmuto ? '.vyjmuto' : ''), {
        dataset: { path: it.path, dir: it.dir ? '1' : '' },
        title: `${it.name}\n${druhSouboru(it.path)} · ${it.dir ? plural(it.count, ['položka', 'položky', 'položek']) : FS.humanSize(it.size)}`,
      },
        el('div.fm-ic', {}, glyfSouboru(it.path, it.node)),
        // názvy souborů se nepřekládají, jen výchozí složky v Domů (Dokumenty → Documents)
        el('div.fm-name', { text: it.dir && FS.dirname(it.path) === FS.HOME ? t(it.name) : it.name, 'data-no-i18n': true },
          ...tecky(it.node || FS.get(it.path))),
        seznam ? el('div.fm-kind', { text: druhSouboru(it.path) }) : null,
        seznam ? el('div.fm-size', { text: it.dir ? plural(it.count, ['položka', 'položky', 'položek']) : FS.humanSize(it.size) }) : null,
        seznam ? el('div.fm-date', { text: cz.datumKratky(new Date(it.modified)) }) : null,
      );

      node.onpointerdown = (e) => {
        if (e.button === 2) { if (!st.sel.has(it.path)) { st.sel.clear(); st.sel.add(it.path); oznac(); } return; }
        if (e.ctrlKey) {
          if (st.sel.has(it.path)) st.sel.delete(it.path); else st.sel.add(it.path);
        } else if (!st.sel.has(it.path)) {
          st.sel.clear();
          st.sel.add(it.path);
        }
        oznac();
        if (st.cwd === FS.TRASH || !st.sel.has(it.path)) return;
        tahni(e, { cesty: [...st.sel], nahled: glyfSouboru(it.path, it.node) });
      };
      node.onclick = (e) => {
        // klik bez tažení na už označenou položku sbalí výběr na ni (jako ve Windows)
        if (!e.ctrlKey && st.sel.size > 1) { st.sel.clear(); st.sel.add(it.path); oznac(); }
      };
      node.ondblclick = () => open(it);
      // prostřední tlačítko na složce = nová karta na pozadí (jako v prohlížeči)
      node.onauxclick = (e) => { if (e.button === 1 && it.dir) { e.preventDefault(); novaKarta(it.path, { naPozadi: true }); } };
      node.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!st.sel.has(it.path)) { st.sel.clear(); st.sel.add(it.path); oznac(); }
        itemMenu(e, it);
      };
      return node;
    }

    // ---------- akce ----------
    function open(it) {
      if (it.dir) return go(it.path);
      otevri(it.path);
    }

    const vybrane = () => [...st.sel].filter((p) => FS.exists(p));

    function itemMenu(e, it) {
      const inTrash = st.cwd === FS.TRASH;
      const cesty = vybrane();
      const vice = cesty.length > 1;
      if (inTrash) {
        return contextMenu([
          { icon: 'refresh', label: 'Obnovit', onClick: () => { cesty.forEach((c) => FS.restore(FS.basename(c))); toast({ title: 'Obnoveno', body: vice ? plural(cesty.length, ['položka', 'položky', 'položek']) : it.name, icon: 'refresh' }); } },
          { icon: 'trash', label: 'Odstranit natrvalo', danger: true, onClick: () => cesty.forEach((c) => FS.remove(c, { toTrash: false })) },
          'sep',
          { icon: 'info', label: 'Vlastnosti', disabled: vice, onClick: () => vlastnosti(it.path) },
        ], { x: e.clientX, y: e.clientY });
      }
      const odeslat = (nazev, cil) => ({
        icon: cil === PLOCHA ? 'monitor' : 'folder', label: nazev,
        onClick: () => { presun(cesty, cil, { kopie: true }); toast({ title: `Zkopírováno: ${nazev}`, icon: 'copy', timeout: 2200 }); },
      });
      contextMenu([
        { icon: it.dir ? 'folderOpen' : 'arrowRight', label: 'Otevřít', key: 'Enter', onClick: () => open(it) },
        // Otevřít v programu ▸ (vychozi.js): jednorázově jinou aplikací + odkaz na výchozí aplikace
        !it.dir && !vice && Vychozi.kandidatiPro(it.path).length > 1 ? {
          icon: 'grid', label: 'Otevřít v programu', sub: [
            ...Vychozi.kandidatiPro(it.path).map((id) => ({
              icon: id === aplikacePro(it.path)[0] ? 'check' : null, label: Vychozi.NAZVY[id] || id, onClick: () => otevriV(it.path, id),
            })),
            '-',
            { icon: 'settings', label: `Výchozí aplikace pro .${Vychozi.pripona(it.name)}…`, onClick: () => import('../apps.js').then(({ openApp }) => openApp('settings', { section: 'aplikace' })) },
          ],
        } : null,
        st.dotaz ? { icon: 'folder', label: 'Otevřít umístění souboru', onClick: () => ukazUmisteni(it.path) } : null,
        it.dir ? { icon: 'plus', label: 'Otevřít na nové kartě', onClick: () => novaKarta(it.path) } : null,
        it.dir ? { icon: 'folderOpen', label: 'Otevřít v novém okně', onClick: () => import('../wm.js').then((wm) => wm.openWindow(filesApp, { path: it.path })) } : null,
        !it.dir ? { icon: 'eye', label: 'Rychlý náhled', key: 'Mezerník', onClick: () => otevriNahled(it.path) } : null,
        !it.dir && !vice ? { icon: 'clock', label: 'Historie verzí…', onClick: () => import('../apps.js').then(({ openApp }) => openApp('historie', { path: it.path })) } : null,
        !it.dir && FS.isImage(it.name) && FS.imageSrc(it.path)
          ? { icon: 'brush', label: 'Upravit v Malování', onClick: () => import('../apps.js').then(({ openApp }) => openApp('malovani', { path: it.path })) } : null,
        !it.dir && /\.html?$/i.test(it.name)
          ? { icon: 'globe', label: 'Otevřít v Nově', onClick: () => otevriVNove(it.path) } : null,
        !it.dir && jazykSouboru(it.name)
          ? { icon: 'code', label: 'Upravit v Editoru kódu', onClick: () => import('../apps.js').then(({ openApp }) => openApp('editor', { path: it.path })) } : null,
        ...polozkyAplikace(it),
        '-',
        { icon: 'cut', label: 'Vyjmout', key: 'Ctrl+X', onClick: () => doSchranky('cut', cesty) },
        { icon: 'copy', label: 'Kopírovat', key: 'Ctrl+C', onClick: () => doSchranky('copy', cesty) },
        it.dir && schranka.cesty.length ? { icon: 'paste', label: 'Vložit do složky', onClick: () => vloz(it.path) } : null,
        '-',
        { icon: 'send', label: 'Odeslat do', sub: [
          ['Plocha', PLOCHA], ['Dokumenty', FS.HOME + '/Dokumenty'], ['Obrázky', FS.HOME + '/Obrázky'], ['Stažené', FS.HOME + '/Stažené'],
        ].filter(([, cil]) => cil !== st.cwd).map(([nazev, cil]) => odeslat(nazev, cil)) },
        ...nabidkaStitku(cesty),
        '-',
        // ZIP (zip.js)
        !vice && !it.dir && Zip.jeZip(it.name) ? { icon: 'box', label: 'Rozbalit vše', onClick: () => rozbalZip(it.path) } : null,
        { icon: 'box', label: 'Komprimovat do souboru ZIP', onClick: () => komprimujZip(cesty) },
        { icon: 'download', label: 'Stáhnout do počítače', disabled: vice, onClick: () => Zip.stahniDoPocitace(it.path).catch((err) => toast({ title: 'Stažení se nepovedlo', body: err.message, icon: 'x' })) },
        '-',
        {
          icon: 'shield', label: 'Zkontrolovat pomocí Astro Defenderu',
          onClick: () => import('../apps.js').then(({ openApp }) => openApp('defender', { stranka: 'viry', kontrola: { typ: 'vlastni', cesta: it.path } })),
        },
        '-',
        { icon: 'notes', label: 'Přejmenovat', key: 'F2', disabled: vice, onClick: () => renameItem(it) },
        { icon: 'trash', label: 'Odstranit', key: 'Del', danger: true, onClick: () => doKose(cesty) },
        '-',
        { icon: 'info', label: 'Vlastnosti', key: 'Alt+Enter', disabled: vice, onClick: () => vlastnosti(it.path) },
      ], { x: e.clientX, y: e.clientY });
    }

    // ---------- ZIP a počítač (zip.js) ----------
    async function komprimujZip(cesty) {
      try {
        const r = await Zip.komprimuj(cesty, st.cwd === FS.TRASH || st.dotaz ? FS.dirname(cesty[0]) : st.cwd);
        const usetreno = r.puvodne ? Math.round((1 - r.zip / r.puvodne) * 100) : 0;
        toast({
          title: `Vytvořeno ${FS.basename(r.cesta)}`, icon: 'box',
          body: `${plural(r.polozek, ['soubor', 'soubory', 'souborů'])} · ${FS.humanSize(r.puvodne)} → ${FS.humanSize(r.zip)}`
            + (usetreno > 0 ? ` (ušetřeno ${usetreno} %)` : ''),
        });
        if (!st.dotaz && FS.dirname(r.cesta) === st.cwd) { st.sel = new Set([r.cesta]); draw(); }
      } catch (err) { toast({ title: 'Komprimace se nepovedla', body: err.message, icon: 'x' }); }
    }

    async function rozbalZip(cesta) {
      try {
        const r = await Zip.rozbal(cesta);
        toast({ title: 'Rozbaleno', body: `${plural(r.souboru, ['soubor', 'soubory', 'souborů'])} → ${FS.basename(r.cesta)}`, icon: 'box' });
        go(r.cesta);
      } catch (err) { toast({ title: 'Rozbalení se nepovedlo', body: err.message, icon: 'x' }); }
    }

    async function nahraj(soubory) {
      if (!soubory?.length || st.cwd === FS.TRASH) return;
      try {
        const nove = await Zip.nahrajZPocitace([...soubory], st.cwd);
        st.sel = new Set(nove);
        draw();
        toast({ title: 'Nahráno z počítače', body: nove.length === 1 ? FS.basename(nove[0]) : plural(nove.length, ['soubor', 'soubory', 'souborů']), icon: 'download' });
      } catch (err) { toast({ title: 'Nahrání se nepovedlo', body: err.message, icon: 'x' }); }
    }

    function vyberZPocitace() {
      const vstup = el('input', { type: 'file', multiple: true });
      vstup.onchange = () => nahraj(vstup.files);
      vstup.click();
    }

    // přetažení souborů z Windows do okna (vnitřní tažení jde přes pointer události, tohle ne)
    view.ondragover = (e) => {
      if (![...(e.dataTransfer?.items || [])].some((i) => i.kind === 'file') || st.cwd === FS.TRASH) return;
      e.preventDefault();
      view.classList.add('fm-cil-pc');
    };
    view.ondragleave = (e) => { if (!view.contains(e.relatedTarget)) view.classList.remove('fm-cil-pc'); };
    view.ondrop = (e) => {
      view.classList.remove('fm-cil-pc');
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      nahraj(e.dataTransfer.files);
    };

    function otevriVNove(cesta) {
      import('../apps.js').then(({ openApp }) => openApp('browser', { url: 'file://' + cesta }));
    }

    /** Složka s index.html = web, ze kterého jde udělat aplikace. */
    function polozkyAplikace(it) {
      if (!it.dir || !jeAplikaceSlozka(it.path)) return [];
      const z = zaznamPro(it.path);
      const openApp = (id, o) => import('../apps.js').then((m) => m.openApp(id, o));
      return [
        '-',
        { icon: 'globe', label: 'Otevřít v Nově', onClick: () => otevriVNove(it.path + '/index.html') },
        z ? { icon: 'arrowRight', label: `Spustit aplikaci ${z.nazev}`, onClick: () => openApp(z.id) } : null,
        { icon: 'store', label: z ? 'Upravit instalaci…' : 'Nainstalovat jako aplikaci…', onClick: () => openApp('instalator', { slozka: it.path }) },
      ].filter(Boolean);
    }

    function renameItem(it) {
      const node = view.querySelector(`[data-path="${CSS.escape(it.path)}"] .fm-name`);
      if (!node) return;
      const input = el('input.fm-rename', { value: it.name });
      node.replaceWith(input);
      input.focus();
      const dot = it.name.lastIndexOf('.');
      input.setSelectionRange(0, dot > 0 && !it.dir ? dot : it.name.length);
      const done = (save) => {
        input.onblur = null;
        if (save && input.value.trim() && input.value !== it.name) {
          try { FS.rename(it.path, input.value.trim()); }
          catch (err) { toast({ title: 'Přejmenování selhalo', body: err.message, icon: 'info' }); }
        }
        draw();
      };
      input.onblur = () => done(true);
      input.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') done(true);
        if (e.key === 'Escape') done(false);
      };
    }

    /** Po vytvoření nové položky ji označí a rovnou nabídne přejmenování. */
    function poVytvoreni(cesta) {
      st.sel.clear();
      st.sel.add(cesta);
      draw();
      setTimeout(() => renameItem(entry(cesta)), 30);
    }

    function newFolder() {
      try { poVytvoreni(novaSlozka(st.cwd)); }
      catch (err) { toast({ title: 'Nešlo vytvořit', body: err.message, icon: 'info' }); }
    }

    function paste() {
      const nove = vloz(st.cwd);
      if (nove.length) { st.sel = new Set(nove); draw(); }
    }

    view.oncontextmenu = (e) => {
      if (e.target.closest('.fm-item')) return;
      e.preventDefault();
      st.sel.clear();
      oznac();
      const vKosi = st.cwd === FS.TRASH;
      contextMenu([
        { icon: st.view === 'grid' ? 'fileText' : 'grid', label: st.view === 'grid' ? 'Zobrazit jako seznam' : 'Zobrazit jako ikony', onClick: () => bView.click() },
        { icon: 'refresh', label: tx('Obnovit', 'Refresh'), key: 'F5', onClick: draw },
        '-',
        { icon: 'paste', label: 'Vložit', key: 'Ctrl+V', disabled: !schranka.cesty.length || vKosi, onClick: paste },
        '-',
        { icon: 'plus', label: 'Nový', disabled: vKosi, sub: nabidkaNovy(st.cwd, poVytvoreni) },
        { icon: 'download', label: 'Nahrát z počítače…', disabled: vKosi, onClick: vyberZPocitace },
        vKosi ? { icon: 'trash', label: 'Vysypat koš', danger: true, onClick: () => FS.emptyTrash() } : null,
        '-',
        { icon: 'info', label: 'Vlastnosti složky', onClick: () => vlastnosti(st.cwd) },
        { icon: st.hidden ? 'eyeOff' : 'eye', label: st.hidden ? 'Skrýt skryté soubory' : 'Zobrazit skryté soubory', onClick: () => { st.hidden = !st.hidden; draw(); } },
        { icon: 'terminal', label: 'Otevřít terminál zde', onClick: () => import('../apps.js').then(({ openApp }) => openApp('terminal', { cwd: st.cwd })) },
      ], { x: e.clientX, y: e.clientY });
    };

    view.onpointerdown = (e) => {
      if (e.target.closest('.fm-item')) return;
      st.sel.clear();
      [...view.children].forEach((c) => c.classList.remove('sel'));
    };

    body.tabIndex = 0;
    body.onkeydown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (nahledKlavesa(e)) return;
      const cesty = vybrane();
      const one = cesty[0];
      const k = e.key.toLowerCase();
      // karty
      if (e.ctrlKey && !e.shiftKey && k === 't') { e.preventDefault(); novaKarta(st.cwd); }
      else if (e.ctrlKey && k === 'w') { e.preventDefault(); zavriKartu(); }
      else if (e.ctrlKey && k === 'tab') { e.preventDefault(); prepniKartu((aktivni + (e.shiftKey ? -1 : 1) + karty.length) % karty.length); }
      else if (e.ctrlKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); prepniKartu(e.key === '9' ? karty.length - 1 : +e.key - 1); }
      // rychlý náhled
      else if (e.key === ' ' && one && !e.repeat) { e.preventDefault(); otevriNahled(one); }
      else if ((e.ctrlKey && k === 'f') || e.key === 'F3') { e.preventDefault(); search.focus(); search.select(); }
      else if (e.key === 'Escape' && st.dotaz) { e.preventDefault(); zrusHledani(); }
      else if (e.key === 'F2' && one) { e.preventDefault(); renameItem(entry(one)); }
      else if (e.key === 'Delete' && cesty.length) {
        e.preventDefault();
        if (st.cwd === FS.TRASH || e.shiftKey) cesty.forEach((c) => FS.remove(c, { toTrash: false }));
        else doKose(cesty);
      }
      else if (e.key === 'Enter' && e.altKey && one) { e.preventDefault(); vlastnosti(one); }
      else if (e.key === 'Enter' && one) { e.preventDefault(); cesty.forEach((c) => open(entry(c))); }
      else if (e.key === 'Backspace') { e.preventDefault(); back(); }
      else if (e.key === 'F5') { e.preventDefault(); draw(); }
      else if (e.ctrlKey && k === 'a') { e.preventDefault(); st.sel = new Set([...view.querySelectorAll('.fm-item')].map((n) => n.dataset.path)); oznac(); draw(); }
      else if (e.ctrlKey && k === 'c' && cesty.length) doSchranky('copy', cesty);
      else if (e.ctrlKey && k === 'x' && cesty.length) doSchranky('cut', cesty);
      else if (e.ctrlKey && k === 'v') { e.preventDefault(); paste(); }
      else if (e.ctrlKey && e.shiftKey && k === 'n') { e.preventDefault(); newFolder(); }
    };

    function entry(path) {
      const node = FS.get(path);
      return {
        path, name: FS.basename(path), dir: FS.isDir(node),
        size: FS.size(node), modified: node?.m || 0,
        count: FS.isDir(node) ? Object.keys(node.d).length : 0,
      };
    }

    const odpoj = [
      bus.on('fs:change', () => { if (body.isConnected) draw(); }),
      bus.on('schranka', () => { if (body.isConnected) draw(); }),
    ];
    win.onClose = () => odpoj.forEach((f) => f());
    win.go = go;
    draw();
  },

  unmount(win) { win.onClose?.(); },

  reopen(win, opts) {
    if (!opts?.path || !win.go) return;
    win.go(FS.isDir(FS.get(opts.path)) ? opts.path : FS.dirname(opts.path));
  },
};
