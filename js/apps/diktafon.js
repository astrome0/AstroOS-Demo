// AstroOS — Diktafon (nahrávání z mikrofonu na virtuální disk)
//
// MediaRecorder nahrává Opus do WebM; hotová nahrávka se uloží jako dataURL do ~/Nahrávky,
// stejně jako obrázky z Malování. Disk je localStorage (~5 MB na všechno), proto nízký
// datový tok (24 kb/s — na hlas bohatě stačí) a hlídání volného místa během nahrávání.

import { el, pad, bus } from '../util.js';
import { icon } from '../icons.js';
import { State } from '../state.js';
import * as FS from '../fs.js';
import { toast, contextMenu } from '../ui.js';

const SLOZKA = FS.HOME + '/Nahrávky';
const TOK = 24000;                           // bitů za sekundu
const ZNAKU_ZA_SEKUNDU = (TOK / 8) * (4 / 3); // base64 v dataURL je o třetinu delší
const KVOTA = 5 * 1024 * 1024;               // kolik znaků snese localStorage (odhad pro Chrome)
const REZERVA = 200 * 1024;                  // místo, které necháme systému

/** Kolik znaků ještě zbývá v localStorage (celý disk AstroOS i nastavení žijí tam). */
function volnoZnaku() {
  let pouzito = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      pouzito += k.length + (localStorage.getItem(k) || '').length;
    }
  } catch { /* bez přístupu k úložišti */ }
  return Math.max(0, KVOTA - pouzito - REZERVA);
}

const cas = (s) => {
  if (!isFinite(s) || s < 0) return '–:––';
  s = Math.floor(s);
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

function vyberFormat() {
  const moznosti = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
  const typ = moznosti.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
  const pripona = typ.includes('ogg') ? 'ogg' : typ.includes('mp4') ? 'm4a' : 'webm';
  return { typ, pripona };
}

// Délky nahrávek: WebM z MediaRecorderu nemá délku v hlavičce (audio.duration = Infinity).
// Zjistíme ji přetočením na konec a pamatujeme si ji podle cesty a času změny.
const DELKY = new Map();
function zjistiDelku(cesta, uzel) {
  const klic = cesta + '|' + (uzel?.m || 0);
  if (DELKY.has(klic)) return Promise.resolve(DELKY.get(klic));
  const src = FS.audioSrc(cesta);
  if (!src) return Promise.resolve(NaN);
  return new Promise((hotovo) => {
    const a = new Audio();
    const konec = (d) => { a.src = ''; DELKY.set(klic, d); hotovo(d); };
    const casovac = setTimeout(() => konec(NaN), 4000);
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      if (isFinite(a.duration)) { clearTimeout(casovac); return konec(a.duration); }
      a.ontimeupdate = () => { a.ontimeupdate = null; clearTimeout(casovac); konec(a.duration); };
      a.currentTime = 1e9;
    };
    a.onerror = () => { clearTimeout(casovac); konec(NaN); };
    a.src = src;
  });
}

export const diktafonApp = {
  id: 'recorder', name: 'Diktafon', icon: 'mic', color: 'linear-gradient(145deg,#ef6a5a,#b8382c)',
  cat: 'media', width: 820, height: 560,

  mount(body, win) {
    const st = {
      stav: 'klid',          // klid | nahrava | pauza | uklada
      proud: null, rec: null, kusy: [], velikost: 0,
      zacatek: 0, nahrano: 0,  // ms nahrané před poslední pauzou
      ctx: null, analyzer: null, historie: [], animace: 0,
      hraje: null,           // cesta právě přehrávané nahrávky
      zarizeni: State.get('diktafonMic') || '',
    };
    const format = vyberFormat();

    // ---------------------------------------------------------------- rozvržení
    const platno = el('canvas.dk-vlna');
    const casovac = el('div.dk-cas', { text: '0:00' });
    const stavText = el('div.dk-stav', { text: 'Připraveno k nahrávání' });
    const bNahrat = el('button.dk-nahrat', { title: 'Nahrávat (mezerník)' }, el('span.dk-tecka'));
    const bPauza = el('button.dk-ovl', { title: 'Pozastavit', disabled: true }, icon('pause'));
    const bStop = el('button.dk-ovl', { title: 'Zastavit a uložit', disabled: true }, icon('stop'));
    const vyberMic = el('select.dk-mic', { title: 'Mikrofon' }, el('option', { value: '', text: 'Výchozí mikrofon' }));
    const misto = el('div.dk-misto');

    const seznam = el('div.dk-seznam');
    const prehravac = el('audio', { preload: 'auto' });
    const pNazev = el('div.dk-p-nazev', { text: 'Vyber nahrávku' });
    const pCas = el('span.dk-p-cas', { text: '0:00 / 0:00' });
    const pPruh = el('div.dk-p-pruh', {}, el('i'));
    const pHrat = el('button.dk-p-hrat', { title: 'Přehrát', disabled: true }, icon('play'));

    body.append(el('div.dk', {},
      el('div.dk-studio', {},
        platno,
        casovac,
        stavText,
        el('div.dk-ovladani', {}, bPauza, bNahrat, bStop),
        el('div.dk-dole', {}, el('span.dk-mic-ic', {}, icon('mic')), vyberMic),
        misto,
      ),
      el('div.dk-knihovna', {},
        el('div.dk-hlavicka', {}, el('span', { text: 'Nahrávky' }),
          el('button.dk-slozka', { title: 'Otevřít ve Správci souborů', onclick: () => otevriSlozku() }, icon('folderOpen'))),
        seznam,
        el('div.dk-prehravac', {}, pHrat, el('div.dk-p-info', {}, pNazev, el('div.dk-p-radka', {}, pPruh, pCas))),
      ),
    ));

    // ---------------------------------------------------------------- místo na disku
    function kreslimisto() {
      const s = Math.floor(volnoZnaku() / ZNAKU_ZA_SEKUNDU);
      misto.textContent = s < 5 ? 'Disk je plný — smaž některé nahrávky nebo obrázky'
        : `Místo na disku zhruba na ${s >= 120 ? Math.floor(s / 60) + ' min' : s + ' s'} nahrávání`;
      misto.classList.toggle('malo', s < 60);
    }

    // ---------------------------------------------------------------- mikrofony
    async function nactiMikrofony() {
      try {
        const vse = await navigator.mediaDevices.enumerateDevices();
        const mic = vse.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
        vyberMic.replaceChildren(el('option', { value: '', text: 'Výchozí mikrofon' }),
          ...mic.map((d, i) => el('option', { value: d.deviceId, text: d.label || `Mikrofon ${i + 1}` })));
        vyberMic.value = mic.some((d) => d.deviceId === st.zarizeni) ? st.zarizeni : '';
      } catch { /* bez seznamu zařízení to jde taky */ }
    }
    vyberMic.onchange = () => { st.zarizeni = vyberMic.value; State.set('diktafonMic', st.zarizeni); };

    // ---------------------------------------------------------------- nahrávání
    async function zacni() {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        return chyba('Tenhle prohlížeč nahrávání zvuku neumí.');
      }
      if (volnoZnaku() < ZNAKU_ZA_SEKUNDU * 5) return chyba('Na disku není místo ani na pár sekund. Smaž starší nahrávky.');
      zastavPrehravani();
      stavText.textContent = 'Čekám na povolení mikrofonu…';
      try {
        st.proud = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: st.zarizeni ? { exact: st.zarizeni } : undefined, echoCancellation: true, noiseSuppression: true },
        });
      } catch (e) {
        stavText.textContent = 'Připraveno k nahrávání';
        if (e.name === 'NotAllowedError') return chyba('Přístup k mikrofonu je zakázaný. Povol ho v prohlížeči (ikona vlevo od adresy) a zkus to znovu.');
        if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') return chyba('Žádný mikrofon nenalezen. Připoj ho nebo vyber jiný.');
        return chyba('Mikrofon se nepodařilo spustit: ' + e.message);
      }
      nactiMikrofony();   // po povolení prohlížeč prozradí i jména zařízení

      // živá vlna
      st.ctx = new AudioContext();
      st.analyzer = st.ctx.createAnalyser();
      st.analyzer.fftSize = 1024;
      st.ctx.createMediaStreamSource(st.proud).connect(st.analyzer);
      st.historie = [];

      st.rec = new MediaRecorder(st.proud, { mimeType: format.typ || undefined, audioBitsPerSecond: TOK });
      st.kusy = [];
      st.velikost = 0;
      const limit = volnoZnaku() / (4 / 3);    // bajtů, které se ještě vejdou jako base64
      st.rec.ondataavailable = (e) => {
        if (!e.data.size) return;
        st.kusy.push(e.data);
        st.velikost += e.data.size;
        if (st.velikost > limit * 0.97 && st.stav === 'nahrava') {
          toast({ title: 'Diktafon', body: 'Disk je skoro plný, nahrávání jsem zastavil a ukládám.', icon: 'mic' });
          dokonci();
        }
      };
      st.rec.onstop = uloz;
      st.rec.start(1000);
      st.zacatek = performance.now();
      st.nahrano = 0;
      nastavStav('nahrava');
      kresli();
    }

    function pauza() {
      if (st.stav === 'nahrava') {
        st.rec.pause();
        st.nahrano += performance.now() - st.zacatek;
        nastavStav('pauza');
      } else if (st.stav === 'pauza') {
        st.rec.resume();
        st.zacatek = performance.now();
        nastavStav('nahrava');
      }
    }

    function dokonci() {
      if (st.stav !== 'nahrava' && st.stav !== 'pauza') return;
      if (st.stav === 'nahrava') st.nahrano += performance.now() - st.zacatek;
      nastavStav('uklada');
      st.rec.stop();                 // → onstop → uloz()
    }

    function uvolni() {
      st.proud?.getTracks().forEach((t) => t.stop());   // zhasne indikátor mikrofonu v prohlížeči
      st.proud = null;
      st.ctx?.close().catch(() => {});
      st.ctx = null;
      st.analyzer = null;
      cancelAnimationFrame(st.animace);
    }

    function uloz() {
      const blob = new Blob(st.kusy, { type: st.rec?.mimeType || format.typ || 'audio/webm' });
      const delka = st.nahrano / 1000;
      uvolni();
      if (st.zrusit || !blob.size) { st.zrusit = false; nastavStav('klid'); return; }

      const cteni = new FileReader();
      cteni.onload = () => {
        try {
          if (!FS.exists(SLOZKA)) FS.mkdir(SLOZKA, { parents: true });
          const d = new Date();
          const jmeno = FS.freeName(SLOZKA,
            `Nahrávka ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}.${format.pripona}`);
          const cesta = SLOZKA + '/' + jmeno;
          const uzel = FS.write(cesta, cteni.result);
          DELKY.set(cesta + '|' + uzel.m, delka);
          toast({ title: 'Nahrávka uložena', body: `${jmeno} · ${cas(delka)} · ${FS.humanSize(cteni.result.length)}`, icon: 'mic' });
          nastavStav('klid');
          kresliSeznam(cesta);
        } catch (e) {
          nastavStav('klid');
          chyba('Nahrávku se nepodařilo uložit: ' + e.message);
        }
      };
      cteni.onerror = () => { nastavStav('klid'); chyba('Nahrávku se nepodařilo přečíst.'); };
      cteni.readAsDataURL(blob);
    }

    function nastavStav(s) {
      st.stav = s;
      bNahrat.classList.toggle('nahrava', s === 'nahrava' || s === 'pauza');
      bNahrat.title = s === 'klid' ? 'Nahrávat (mezerník)' : 'Zastavit a uložit';
      bPauza.disabled = !(s === 'nahrava' || s === 'pauza');
      bStop.disabled = bPauza.disabled;
      bPauza.replaceChildren(icon(s === 'pauza' ? 'mic' : 'pause'));
      bPauza.title = s === 'pauza' ? 'Pokračovat' : 'Pozastavit';
      vyberMic.disabled = s !== 'klid';
      stavText.textContent = { klid: 'Připraveno k nahrávání', nahrava: 'Nahrávám…', pauza: 'Pozastaveno', uklada: 'Ukládám na disk…' }[s];
      body.querySelector('.dk').classList.toggle('zaznam', s === 'nahrava');
      win.title = s === 'nahrava' ? '● Nahrávám — Diktafon' : 'Diktafon';
      if (s === 'klid') { casovac.textContent = '0:00'; kresliPrazdno(); }
      kreslimisto();
    }

    function chyba(text) {
      toast({ title: 'Diktafon', body: text, icon: 'mic' });
    }

    // ---------------------------------------------------------------- vlna
    function rozmer() {
      const r = platno.getBoundingClientRect(), dpr = devicePixelRatio || 1;
      if (platno.width !== Math.round(r.width * dpr)) { platno.width = Math.round(r.width * dpr); platno.height = Math.round(r.height * dpr); }
      return { w: platno.width, h: platno.height, dpr };
    }
    const barva = (jmeno) => getComputedStyle(body).getPropertyValue(jmeno).trim() || '#46c36f';

    function kresliPrazdno() {
      const { w, h, dpr } = rozmer();
      const g = platno.getContext('2d');
      g.clearRect(0, 0, w, h);
      g.fillStyle = barva('--txt-3');
      g.globalAlpha = 0.35;
      for (let x = 0; x < w; x += 6 * dpr) g.fillRect(x, h / 2 - dpr, 3 * dpr, 2 * dpr);
      g.globalAlpha = 1;
    }

    const data = new Uint8Array(1024);
    function kresli() {
      if (!st.analyzer) return;
      st.animace = requestAnimationFrame(kresli);
      const { w, h, dpr } = rozmer();
      const g = platno.getContext('2d');

      // hlasitost (RMS) posledního okamžiku → nový sloupek vpravo
      st.analyzer.getByteTimeDomainData(data);
      let suma = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; suma += v * v; }
      const uroven = st.stav === 'pauza' ? 0 : Math.min(1, Math.sqrt(suma / data.length) * 4);
      const krok = 6 * dpr, pocet = Math.ceil(w / krok);
      if (st.stav === 'nahrava') { st.historie.push(uroven); if (st.historie.length > pocet) st.historie.shift(); }

      g.clearRect(0, 0, w, h);
      const akcent = barva('--accent'), cervena = '#ef6a5a';
      st.historie.forEach((u, i) => {
        const x = w - (st.historie.length - i) * krok;
        const v = Math.max(2 * dpr, u * (h - 8 * dpr));
        g.fillStyle = i > st.historie.length - 4 ? cervena : akcent;
        g.globalAlpha = 0.35 + 0.65 * (i / st.historie.length);
        g.beginPath();
        if (g.roundRect) g.roundRect(x, (h - v) / 2, 3 * dpr, v, 1.5 * dpr);
        else g.rect(x, (h - v) / 2, 3 * dpr, v);
        g.fill();
      });
      g.globalAlpha = 1;

      const ms = st.nahrano + (st.stav === 'nahrava' ? performance.now() - st.zacatek : 0);
      casovac.textContent = cas(ms / 1000);
    }

    // ---------------------------------------------------------------- knihovna
    function nahravky() {
      if (!FS.exists(SLOZKA)) return [];
      return FS.list(SLOZKA).filter((p) => !p.dir && FS.isAudio(p.name))
        .sort((a, b) => b.modified - a.modified);
    }

    function kresliSeznam(zvyraznit) {
      const vse = nahravky();
      if (!vse.length) {
        seznam.replaceChildren(el('div.dk-prazdno', {}, icon('mic'),
          el('b', { text: 'Zatím žádné nahrávky' }),
          el('span', { text: 'Klikni na červené tlačítko a začni mluvit.' })));
        return;
      }
      seznam.replaceChildren(...vse.map((p) => {
        const delka = el('span.dk-delka', { text: '…' });
        zjistiDelku(p.path, p.node).then((d) => { delka.textContent = cas(d); });
        const d = new Date(p.modified);
        const radek = el('button.dk-radek' + (p.path === st.hraje ? '.on' : '') + (p.path === zvyraznit ? '.nova' : ''), {},
          el('span.dk-r-ic', {}, icon(p.path === st.hraje && !prehravac.paused ? 'pause' : 'play')),
          el('span.dk-r-jmeno', {},
            el('b', { text: p.name.replace(/\.[^.]+$/, '') }),
            el('i', { text: `${d.toLocaleDateString('cs-CZ')} ${pad(d.getHours())}:${pad(d.getMinutes())} · ${FS.humanSize(p.size)}` })),
          delka,
        );
        radek.onclick = () => (p.path === st.hraje ? prepniPrehravani() : prehraj(p.path));
        radek.oncontextmenu = (e) => {
          e.preventDefault();
          contextMenu([
            { icon: 'play', label: 'Přehrát', onClick: () => prehraj(p.path) },
            { icon: 'pencil', label: 'Přejmenovat', onClick: () => prejmenuj(p, radek) },
            { icon: 'folderOpen', label: 'Zobrazit ve Správci souborů', onClick: () => otevriSlozku() },
            '-',
            { icon: 'trash', label: 'Přesunout do koše', danger: true, onClick: () => smaz(p) },
          ], { x: e.clientX, y: e.clientY });
        };
        return radek;
      }));
    }

    function prejmenuj(p, radek) {
      const pripona = p.name.slice(p.name.lastIndexOf('.'));
      const pole = el('input.dk-prejmenovat', { value: p.name.slice(0, -pripona.length), spellcheck: 'false' });
      const jmeno = radek.querySelector('.dk-r-jmeno b');
      jmeno.replaceWith(pole);
      pole.focus();
      pole.select();
      let hotovo = false;
      const potvrd = (ulozit) => {
        if (hotovo) return;
        hotovo = true;
        const nove = pole.value.trim().replace(/[/\\]/g, '-');
        if (ulozit && nove && nove + pripona !== p.name) {
          try {
            const cesta = FS.rename(p.path, nove + pripona);
            if (st.hraje === p.path) { st.hraje = cesta; pNazev.textContent = nove; }
          } catch (e) { chyba(e.message); }
        }
        kresliSeznam();
      };
      pole.onclick = (e) => e.stopPropagation();
      pole.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') potvrd(true);
        if (e.key === 'Escape') potvrd(false);
      };
      pole.onblur = () => potvrd(true);
    }

    function smaz(p) {
      if (st.hraje === p.path) zastavPrehravani(true);
      try { FS.remove(p.path); } catch (e) { return chyba(e.message); }
      toast({ title: 'Diktafon', body: `${p.name} je v koši.`, icon: 'trash' });
    }

    function otevriSlozku() {
      if (!FS.exists(SLOZKA)) FS.mkdir(SLOZKA, { parents: true });
      import('../apps.js').then(({ openApp }) => openApp('files', { path: SLOZKA }));
    }

    // ---------------------------------------------------------------- přehrávání
    const hlasitost = () => (State.get('zvuky') === false ? 0 : (State.get('volume') ?? 62) / 100);

    function prehraj(cesta) {
      if (st.stav !== 'klid') return chyba('Během nahrávání nejde přehrávat.');
      const src = FS.audioSrc(cesta);
      if (!src) return chyba('Tenhle soubor se přehrát nedá.');
      st.hraje = cesta;
      st.delka = NaN;
      zjistiDelku(cesta, FS.get(cesta)).then((d) => { if (st.hraje === cesta) { st.delka = d; kresliPrehravac(); } });
      prehravac.src = src;
      prehravac.volume = hlasitost();
      prehravac.play().catch(() => {});
      pNazev.textContent = FS.basename(cesta).replace(/\.[^.]+$/, '');
      pHrat.disabled = false;
      kresliSeznam();
    }

    function prepniPrehravani() {
      if (!st.hraje) return;
      if (prehravac.paused) prehravac.play().catch(() => {}); else prehravac.pause();
    }

    function zastavPrehravani(uplne = false) {
      prehravac.pause();
      if (uplne) {
        st.hraje = null;
        prehravac.removeAttribute('src');
        pNazev.textContent = 'Vyber nahrávku';
        pHrat.disabled = true;
        kresliPrehravac();
      }
    }

    function kresliPrehravac() {
      const d = isFinite(prehravac.duration) ? prehravac.duration : st.delka;
      const t = prehravac.currentTime || 0;
      pCas.textContent = `${cas(t)} / ${cas(d)}`;
      pPruh.firstChild.style.width = isFinite(d) && d > 0 ? `${Math.min(100, (t / d) * 100)}%` : '0%';
      pHrat.replaceChildren(icon(st.hraje && !prehravac.paused ? 'pause' : 'play'));
    }

    prehravac.ontimeupdate = kresliPrehravac;
    prehravac.onplay = () => { kresliPrehravac(); kresliSeznam(); };
    prehravac.onpause = () => { kresliPrehravac(); kresliSeznam(); };
    prehravac.onended = () => { prehravac.currentTime = 0; kresliPrehravac(); };
    pHrat.onclick = prepniPrehravani;
    pPruh.onclick = (e) => {
      const d = isFinite(prehravac.duration) ? prehravac.duration : st.delka;
      if (!st.hraje || !isFinite(d)) return;
      const r = pPruh.getBoundingClientRect();
      prehravac.currentTime = ((e.clientX - r.left) / r.width) * d;
    };

    // ---------------------------------------------------------------- ovládání
    bNahrat.onclick = () => (st.stav === 'klid' ? zacni() : dokonci());
    bPauza.onclick = pauza;
    bStop.onclick = dokonci;

    body.tabIndex = -1;
    body.addEventListener('keydown', (e) => {
      if (e.target.closest('input, select')) return;
      if (e.key === ' ') { e.preventDefault(); if (st.stav === 'klid') zacni(); else pauza(); }
      if (e.key === 'Escape' && st.stav !== 'klid') dokonci();
    });

    const offFs = bus.on('fs:change', (cesta) => {
      if (typeof cesta !== 'string' || cesta === '/' || cesta.startsWith(SLOZKA) || cesta.startsWith(FS.TRASH)) {
        if (st.hraje && !FS.exists(st.hraje)) zastavPrehravani(true);
        kresliSeznam();
        kreslimisto();
      }
    });
    const offHlas = bus.on('state:volume', () => { prehravac.volume = hlasitost(); });

    new ResizeObserver(() => { if (st.stav === 'klid') kresliPrazdno(); }).observe(platno);

    win.prehraj = (cesta) => prehraj(cesta);
    win.onClose = () => {
      if (st.rec && st.stav !== 'klid') {
        // zavření okna uprostřed nahrávky = uložit, co máme (jako Diktafon ve Windows)
        st.rec.onstop = uloz;
        try { st.rec.stop(); } catch { uvolni(); }
      } else uvolni();
      prehravac.pause();
      offFs();
      offHlas();
    };

    nastavStav('klid');
    kresliSeznam();
    if (win.opts?.path) setTimeout(() => prehraj(win.opts.path), 50);
  },

  unmount(win) { win.onClose?.(); },
  reopen(win, opts) { if (opts?.path) win.prehraj?.(opts.path); },
};
