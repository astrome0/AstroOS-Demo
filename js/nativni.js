// AstroOS — nativní karty prohlížeče v aplikaci (Electron, app/web.js)
//
// Skutečná karta Chromia se kreslí NAD celou stránkou AstroOS, přesně přes místo („slot“), které jí tu
// necháme. Tady se každý snímek obrazovky hlídá, kde slot je a jestli ho něco nepřekrývá (jiné okno,
// Start, nabídka, oznámení). Když ano, karta se schová a ve slotu zůstane její poslední snímek — takže
// to vypadá, jako by okno s webem bylo normálně pod ostatními.

const W = () => window.astroElectron?.web;
const sloty = new Map();    // id → { el, img, mez, viditelna, naStav, naNovy, naFokus, snimek, posledniSnimek }

let smycka = 0;

/**
 * Začne hlídat slot. o = { naStav(s), naNovy(url), naFokus(), vlastniMez(m) } — vlastniMez nahradí
 * posílání do karty (okno Jirky si posílá jen polohu svého rámu).
 */
export function sleduj(id, el, o = {}) {
  let img = null;
  if (!o.vlastniMez) {
    img = document.createElement('img');
    img.className = 'nb-snimek';
    img.alt = '';
    img.draggable = false;
    img.hidden = true;
    el.append(img);
    W()?.vytvor(id, o.relace);   // soukromé okno = vlastní relace jen v paměti
  }
  sloty.set(id, { el, img, mez: '', viditelna: false, ...o, posledniSnimek: 0 });
  if (!smycka) smycka = requestAnimationFrame(tik);
}

export function pust(id) {
  const s = sloty.get(id);
  if (!s) return;
  sloty.delete(id);
  if (s.vlastniMez) s.vlastniMez(null);
  else W()?.zavri(id);
}

export const jdi = (id, url) => W()?.jdi(id, url);
/** Soukromé okno se zavřelo → smazat jeho cookies, přihlášení a cache. */
export const zahodRelaci = (relace) => W()?.zahod?.(relace);
export const prikaz = (id, cmd) => W()?.prikaz(id, cmd);

/** Je slot opravdu vidět? Vzorky bodů: všude musí být nahoře slot (nebo něco v něm). */
function zakryto(el, r) {
  // 14 px od kraje: na okrajích okna jsou úchyty pro změnu velikosti (.rs), ty se nepočítají
  const o = 14, sx = (r.left + r.right) / 2, sy = (r.top + r.bottom) / 2;
  const body = [
    [r.left + o, r.top + o], [r.right - o, r.top + o], [r.left + o, r.bottom - o], [r.right - o, r.bottom - o],
    [sx, sy], [sx, r.top + o], [sx, r.bottom - o], [r.left + o, sy], [r.right - o, sy],
  ];
  for (const [x, y] of body) {
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const h = document.elementFromPoint(x, y);
    if (!h || (h !== el && !el.contains(h))) return true;
  }
  return false;
}

/**
 * Hlavní panel (hlavně automaticky skrývaný, který vyjede přes maximalizované okno) kartu nezakryje,
 * jen ji o svou výšku zkrátí — jinak by se při najetí myší dolů video zmrazilo na snímek a hrál jen zvuk.
 */
function orizniPanelem(r) {
  const panel = document.querySelector('#taskbar-root .taskbar');
  const p = panel?.getBoundingClientRect();
  if (!p || p.height < 4 || p.bottom <= r.top || p.top >= r.bottom || p.right <= r.left || p.left >= r.right) return r;
  let { left, top, right, bottom } = r;
  if (p.top > (r.top + r.bottom) / 2) bottom = Math.min(bottom, p.top);   // panel dole
  else top = Math.max(top, p.bottom);                                     // panel nahoře
  return { left, top, right, bottom, width: right - left, height: Math.max(0, bottom - top) };
}

async function snimek(id, s) {
  s.posledniSnimek = performance.now();
  const data = await W()?.snimek(id);
  if (data && s.img && sloty.get(id) === s) s.img.src = 'data:image/jpeg;base64,' + data;
}

function tik() {
  smycka = sloty.size ? requestAnimationFrame(tik) : 0;
  const ted = performance.now();
  for (const [id, s] of sloty) {
    const r = s.el.isConnected ? orizniPanelem(s.el.getBoundingClientRect()) : null;
    const vidi = !!(r && r.width > 20 && r.height > 20 && document.visibilityState === 'visible' && !zakryto(s.el, r));
    // zaokrouhlit okraje, ne rozměry — jinak karta přeteče slot o pixel
    const m = r ? {
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.right) - Math.round(r.left),
      h: Math.round(r.bottom) - Math.round(r.top), viditelna: vidi,
    } : { viditelna: false };
    const klic = JSON.stringify(m);
    if (klic !== s.mez) {
      s.mez = klic;
      if (s.vlastniMez) s.vlastniMez(m);
      else W()?.mez(id, m);
      // schovaná karta → ve slotu její poslední snímek; viditelná → snímek pryč (karta je nad ním)
      if (s.img) s.img.hidden = vidi || !s.img.src;
    }
    s.viditelna = vidi;
    // snímek se průběžně obnovuje, ať je po zakrytí čerstvý (karta se schová okamžitě, ne až po snímku)
    if (vidi && s.img && ted - s.posledniSnimek > 900) snimek(id, s);
  }
}

// události z hlavního procesu → slot podle id
if (W()) {
  W().naStav((st) => sloty.get(String(st.id))?.naStav?.(st));
  W().naFokus((id) => sloty.get(id)?.naFokus?.());
  W().naNovy(({ id, url }) => {
    const s = sloty.get(String(id));
    if (s?.naNovy) s.naNovy(url);
    else import('./apps.js').then(({ openApp }) => openApp('browser', { url }));
  });

  // Správce hesel: odpovídá jen kartám Novy (slot s naHeslo), adresu posílá hlavní proces z karty.
  // Heslo se z trezoru vydá jen pro účet, který patří webu karty, a jen přes https (http jen localhost).
  const W2 = W().hesla;
  if (W2) {
    const bezpecne = (url) => /^https:/i.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url);
    W2.naDotaz(async (d) => {
      const s = sloty.get(String(d.id));
      if (!s?.naHeslo || !bezpecne(String(d.url))) return null;
      const H = await import('./hesla.js');
      if (!H.odemceno()) return d.typ === 'seznam' && H.maTrezor() ? { zamceno: true } : null;
      const ucty = H.proWeb(d.url);
      if (d.typ === 'seznam') return { seznam: ucty.map((u) => ({ id: u.id, jmeno: u.jmeno })) };
      const u = ucty.find((x) => x.id === d.pid);
      if (!u) return null;
      H.pouzito(u.id);
      return u.heslo;
    });
    W2.naNavrh((d) => sloty.get(String(d.id))?.naHeslo?.('navrh', d));
    W2.naSpravovat((id) => sloty.get(id)?.naHeslo?.('spravovat'));
    W2.naOdemknout((id) => sloty.get(id)?.naHeslo?.('odemknout'));
  }
}
