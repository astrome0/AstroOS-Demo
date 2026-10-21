// AstroPrezentace — přechody snímků a animace objektů (definice pro galerie + přehrávání přes Web Animations API)

import { el } from '../util.js';

// vlastní vlastnosti, které jde animovat (maska Kolo/Hodiny, pruhy)
try {
  CSS.registerProperty({ name: '--pr-uhel', syntax: '<angle>', inherits: false, initialValue: '0deg' });
  CSS.registerProperty({ name: '--pr-pruh', syntax: '<percentage>', inherits: false, initialValue: '0%' });
} catch { /* už registrováno */ }

// ---------------------------------------------------------------- přechody
export const PRECHODY = [
  { skupina: 'Jemné', polozky: [
    ['zadny', 'Žádný'], ['premena', 'Přeměna'], ['zeslabit', 'Zeslabit'], ['posunuti', 'Posunutí'], ['setrit', 'Setřít'], ['rozdelit', 'Rozdělit'],
    ['odhalit', 'Odhalit'], ['vyjmout', 'Vyjmout'], ['nahodnePruhy', 'Náhodné pruhy'], ['tvar', 'Tvar'], ['odkryt', 'Odkrýt'], ['pokryt', 'Pokrýt'], ['blesk', 'Záblesk'],
  ] },
  { skupina: 'Vzrušující', polozky: [
    ['opony', 'Opony'], ['vitr', 'Vítr'], ['prestiz', 'Prestiž'], ['rozdrtit', 'Rozdrtit'], ['odloupnout', 'Odloupnutí'], ['zaluzie', 'Žaluzie'],
    ['hodiny', 'Hodiny'], ['vlneni', 'Vlnění'], ['trpyt', 'Třpyt'], ['vir', 'Vír'], ['prepnout', 'Přepnout'], ['preklopit', 'Překlopit'],
    ['galerie', 'Galerie'], ['krychle', 'Krychle'], ['dvere', 'Dveře'], ['krabice', 'Krabice'], ['lupa', 'Lupa'], ['nahodny', 'Náhodný'],
  ] },
  { skupina: 'Dynamický obsah', polozky: [['posun', 'Posun'], ['dopravnik', 'Dopravník'], ['otocit', 'Otočit'], ['okno', 'Okno'], ['obeznaDraha', 'Oběžná dráha'], ['prulet', 'Průlet']] },
];
export const NAZVY_PRECHODU = Object.fromEntries(PRECHODY.flatMap((s) => s.polozky));
const SMER4 = [['zdola', 'Zdola'], ['zleva', 'Zleva'], ['zprava', 'Zprava'], ['shora', 'Shora']];
const SMER2 = [['zprava', 'Zprava'], ['zleva', 'Zleva']];
export const MOZNOSTI_PRECHODU = {
  zeslabit: [['plynule', 'Plynule'], ['cerna', 'Přes černou']],
  vyjmout: [['ne', 'Vyjmout'], ['cerna', 'Přes černou']],
  posunuti: SMER4, setrit: [...SMER4, ['zlevaNahore', 'Zleva nahoře'], ['zpravaDole', 'Zprava dole']], odkryt: SMER4, pokryt: SMER4, posun: SMER4, dopravnik: SMER2,
  rozdelit: [['svisleVen', 'Svisle ven'], ['svisleDovnitr', 'Svisle dovnitř'], ['vodorovneVen', 'Vodorovně ven'], ['vodorovneDovnitr', 'Vodorovně dovnitř']],
  odhalit: [['plynuleZprava', 'Plynule zprava'], ['plynuleZleva', 'Plynule zleva'], ['cernaZprava', 'Přes černou zprava'], ['cernaZleva', 'Přes černou zleva']],
  nahodnePruhy: [['svisle', 'Svisle'], ['vodorovne', 'Vodorovně']], zaluzie: [['svisle', 'Svisle'], ['vodorovne', 'Vodorovně']],
  tvar: [['kruh', 'Kruh'], ['kosoctverec', 'Kosočtverec'], ['plus', 'Plus'], ['dovnitr', 'Dovnitř'], ['ven', 'Ven']],
  opony: [['stred', 'Ze středu']], lupa: [['dovnitr', 'Dovnitř'], ['ven', 'Ven']],
  prepnout: SMER2, preklopit: SMER2, galerie: SMER2, krychle: [...SMER4], krabice: [...SMER4], dvere: [['svisle', 'Svisle'], ['vodorovne', 'Vodorovně']],
  hodiny: [['doprava', 'Po směru'], ['doleva', 'Proti směru']], vitr: SMER2, odloupnout: SMER2, otocit: SMER2, okno: [['svisle', 'Svisle'], ['vodorovne', 'Vodorovně']], obeznaDraha: SMER2, prulet: [['dovnitr', 'Dovnitř'], ['ven', 'Ven']],
};
export const VYCHOZI_DELKA = { zeslabit: 0.7, posunuti: 1, setrit: 1, rozdelit: 1.5, odhalit: 1.6, vyjmout: 0.01, nahodnePruhy: 1, tvar: 2, odkryt: 1, pokryt: 1, blesk: 0.8, premena: 2, krychle: 1.4, galerie: 1.6, dvere: 1.4, preklopit: 0.8, prepnout: 1.25, opony: 2.5, vitr: 2, lupa: 1, hodiny: 2, vlneni: 1.4, zaluzie: 1.6 };

const EASE = 'cubic-bezier(.45,.05,.25,1)';
const posun = (smer, W, H, k = 1) => ({ zdola: [0, H * k], shora: [0, -H * k], zleva: [-W * k, 0], zprava: [W * k, 0] }[smer] || [W * k, 0]);

/**
 * Přehraje přechod mezi dvěma vrstvami (každá obsahuje vykreslený snímek). Vrací Promise.
 * vrstvy: { stary, novy, kontejner } — elementy absolutně přes sebe, W×H v obrazovkových px.
 */
export function prehrajPrechod(pr, { stary, novy, kontejner, W, H }) {
  const typ = pr?.typ === 'nahodny' ? PRECHODY.flatMap((s) => s.polozky.map((p) => p[0])).filter((t) => !/zadny|nahodny|premena/.test(t))[Math.floor(Math.random() * 30) % 28] : pr?.typ;
  const d = Math.max(10, (pr?.trvani ?? VYCHOZI_DELKA[typ] ?? 1) * 1000);
  const smer = pr?.smer || MOZNOSTI_PRECHODU[typ]?.[0]?.[0];
  const anim = [];
  const a = (uzel, kf, o = {}) => { const x = uzel.animate(kf, { duration: d, easing: EASE, fill: 'both', ...o }); anim.push(x); return x; };
  const hotovo = () => Promise.all(anim.map((x) => x.finished.catch(() => {})));
  if (!typ || typ === 'zadny' || !stary) return Promise.resolve();
  kontejner.style.perspective = '';
  novy.style.zIndex = 2; stary.style.zIndex = 1;
  switch (typ) {
    case 'zeslabit':
      if (smer === 'cerna') { a(stary, [{ opacity: 1 }, { opacity: 0 }], { duration: d / 2 }); a(novy, [{ opacity: 0 }, { opacity: 1 }], { duration: d / 2, delay: d / 2 }); }
      else a(novy, [{ opacity: 0 }, { opacity: 1 }], { easing: 'linear' });
      break;
    case 'vyjmout':
      if (smer === 'cerna') { a(stary, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'steps(1, end)' }); a(novy, [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: 300 }); }
      break;
    case 'posunuti': case 'posun': {
      const [x, y] = posun(smer, W, H);
      a(novy, [{ transform: `translate(${x}px,${y}px)` }, { transform: 'none' }]);
      a(stary, [{ transform: 'none' }, { transform: `translate(${-x}px,${-y}px)` }]);
      break;
    }
    case 'pokryt': { const [x, y] = posun(smer, W, H); a(novy, [{ transform: `translate(${x}px,${y}px)` }, { transform: 'none' }]); break; }
    case 'odkryt': {
      const [x, y] = posun(smer, W, H);
      novy.style.zIndex = 1; stary.style.zIndex = 2;
      a(stary, [{ transform: 'none' }, { transform: `translate(${-x}px,${-y}px)` }]);
      break;
    }
    case 'setrit': {
      const z = { zdola: ['inset(100% 0 0 0)'], shora: ['inset(0 0 100% 0)'], zleva: ['inset(0 100% 0 0)'], zprava: ['inset(0 0 0 100%)'], zlevaNahore: ['polygon(0 0,0 0,0 0,0 0)'], zpravaDole: ['polygon(100% 100%,100% 100%,100% 100%,100% 100%)'] }[smer] || ['inset(0 0 0 100%)'];
      if (/^polygon/.test(z[0])) a(novy, [{ clipPath: z[0] }, { clipPath: smer === 'zlevaNahore' ? 'polygon(0 0,200% 0,200% 0,0 200%)' : 'polygon(100% 100%,-100% 100%,-100% 100%,100% -100%)' }], { easing: 'linear' });
      else a(novy, [{ clipPath: z[0] }, { clipPath: 'inset(0 0 0 0)' }], { easing: 'ease-in-out' });
      break;
    }
    case 'rozdelit': {
      const ven = /Ven/.test(smer), svisle = /^svisle/.test(smer);
      const zavreno = svisle ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)';
      if (ven) a(novy, [{ clipPath: zavreno }, { clipPath: 'inset(0 0 0 0)' }]);
      else { novy.style.zIndex = 1; stary.style.zIndex = 2; a(stary, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: zavreno }]); }
      break;
    }
    case 'odhalit': {
      const x = /Zleva/.test(smer) ? -W * 0.25 : W * 0.25;
      if (/^cerna/.test(smer)) { a(stary, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-x}px)` }], { duration: d / 2 }); a(novy, [{ opacity: 0, transform: `translateX(${x}px)` }, { opacity: 1, transform: 'none' }], { duration: d / 2, delay: d / 2 }); }
      else { a(stary, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-x}px)` }]); a(novy, [{ opacity: 0, transform: `translateX(${x}px)` }, { opacity: 1, transform: 'none' }], { delay: d * 0.25, duration: d * 0.75 }); }
      break;
    }
    case 'nahodnePruhy': case 'zaluzie': {
      const n = typ === 'zaluzie' ? 6 : 24;
      const svisle = smer === 'svisle';
      const poradi = [...Array(n).keys()];
      if (typ === 'nahodnePruhy') poradi.sort(() => Math.random() - 0.5);
      novy.style.visibility = 'hidden';
      const pruhy = [];
      for (let i = 0; i < n; i++) {
        const k = novy.cloneNode(true);
        k.style.visibility = '';
        const z1 = (i / n) * 100, z2 = 100 - ((i + 1) / n) * 100;
        const plny = svisle ? `inset(0 ${z2}% 0 ${z1}%)` : `inset(${z1}% 0 ${z2}% 0)`;
        const prazdny = svisle ? `inset(0 ${z2 + (100 / n)}% 0 ${z1}%)` : `inset(${z1}% 0 ${z2 + 100 / n}% 0)`;
        kontejner.append(k); pruhy.push(k);
        if (typ === 'zaluzie') a(k, [{ clipPath: prazdny }, { clipPath: plny }], { easing: 'ease-in-out' });
        else a(k, [{ clipPath: plny, opacity: 0 }, { clipPath: plny, opacity: 1 }], { duration: 30, delay: (poradi[i] / n) * d, easing: 'linear' });
      }
      return hotovo().then(() => { pruhy.forEach((p) => p.remove()); novy.style.visibility = ''; });
    }
    case 'tvar': {
      const t = smer === 'kosoctverec' ? ['polygon(50% 50%,50% 50%,50% 50%,50% 50%)', 'polygon(50% -50%,150% 50%,50% 150%,-50% 50%)']
        : smer === 'plus' ? ['polygon(50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%)', 'polygon(35% -40%,65% -40%,65% 35%,140% 35%,140% 65%,65% 65%,65% 140%,35% 140%,35% 65%,-40% 65%,-40% 35%,35% 35%)']
          : smer === 'ven' ? ['inset(50% 50% 50% 50%)', 'inset(0 0 0 0)'] : smer === 'dovnitr' ? null : ['circle(0% at 50% 50%)', 'circle(75% at 50% 50%)'];
      if (!t) { novy.style.zIndex = 1; stary.style.zIndex = 2; a(stary, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(50% 50% 50% 50%)' }]); }
      else a(novy, [{ clipPath: t[0] }, { clipPath: t[1] }], { easing: 'ease-in-out' });
      break;
    }
    case 'blesk': {
      const f = el('div.pr-show-blesk');
      kontejner.append(f);
      a(f, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { easing: 'ease-out' });
      a(novy, [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1, offset: 0.46 }, { opacity: 1 }], { easing: 'linear' });
      return hotovo().then(() => f.remove());
    }
    case 'opony': {
      novy.style.zIndex = 1; stary.style.zIndex = 2;
      stary.style.visibility = 'hidden';
      const l = stary.cloneNode(true), r = stary.cloneNode(true);
      l.style.visibility = r.style.visibility = '';
      l.style.clipPath = 'inset(0 50% 0 0)'; r.style.clipPath = 'inset(0 0 0 50%)';
      l.style.zIndex = r.style.zIndex = 3;
      kontejner.append(l, r);
      a(l, [{ transform: 'none' }, { transform: `translateX(${-W * 0.5}px) scaleY(1.05) skewY(-4deg)`, opacity: 0.2 }], { easing: 'ease-in' });
      a(r, [{ transform: 'none' }, { transform: `translateX(${W * 0.5}px) scaleY(1.05) skewY(4deg)`, opacity: 0.2 }], { easing: 'ease-in' });
      return hotovo().then(() => { l.remove(); r.remove(); stary.style.visibility = ''; });
    }
    case 'vitr': {
      novy.style.zIndex = 1; stary.style.zIndex = 2;
      const x = smer === 'zleva' ? W * 1.2 : -W * 1.2;
      a(stary, [{ transform: 'none', opacity: 1 }, { transform: `translateX(${x}px) skewX(${x > 0 ? -25 : 25}deg) rotate(${x > 0 ? 6 : -6}deg)`, opacity: 0 }], { easing: 'ease-in' });
      a(novy, [{ transform: 'scale(.94)', opacity: 0.6 }, { transform: 'none', opacity: 1 }]);
      break;
    }
    case 'prestiz': {
      kontejner.style.perspective = '1400px';
      a(stary, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-10%) rotateX(35deg) scale(.8)', opacity: 0 }]);
      a(novy, [{ transform: 'translateY(40%) rotateX(-40deg) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { delay: d * 0.2, duration: d * 0.8 });
      break;
    }
    case 'rozdrtit': {
      novy.style.zIndex = 1; stary.style.zIndex = 2;
      a(stary, [{ transform: 'none', opacity: 1, filter: 'none' }, { transform: 'scale(.15) rotate(12deg)', opacity: 0, filter: 'blur(4px) contrast(1.4)' }], { easing: 'ease-in' });
      break;
    }
    case 'odloupnout': {
      kontejner.style.perspective = '1600px';
      novy.style.zIndex = 1; stary.style.zIndex = 2;
      stary.style.transformOrigin = smer === 'zleva' ? '100% 0' : '0 0';
      a(stary, [{ transform: 'none' }, { transform: `rotate3d(1, ${smer === 'zleva' ? -1 : 1}, 0, 95deg) translate(${smer === 'zleva' ? 20 : -20}%, -30%)`, opacity: 0.3 }], { easing: 'ease-in' });
      return hotovo().then(() => { stary.style.transformOrigin = ''; });
    }
    case 'hodiny': {
      novy.style.maskImage = novy.style.webkitMaskImage = `conic-gradient(from 0deg, #000 var(--pr-uhel), transparent 0)`;
      if (smer === 'doleva') novy.style.transform = 'scaleX(-1)';
      a(novy, [{ '--pr-uhel': '0deg' }, { '--pr-uhel': '360deg' }], { easing: 'linear' });
      return hotovo().then(() => { novy.style.maskImage = novy.style.webkitMaskImage = ''; novy.style.transform = ''; });
    }
    case 'vlneni': {
      a(novy, [{ clipPath: 'circle(0% at 50% 50%)', transform: 'scale(1.08)' }, { clipPath: 'circle(75% at 50% 50%)', transform: 'none' }], { easing: 'cubic-bezier(.2,.7,.3,1)' });
      a(stary, [{ transform: 'none' }, { transform: 'scale(.96)' }]);
      break;
    }
    case 'trpyt': {
      a(novy, [{ opacity: 0, filter: 'brightness(2.2) blur(6px)', transform: 'scale(1.04)' }, { opacity: 1, filter: 'none', transform: 'none' }]);
      break;
    }
    case 'vir': {
      a(stary, [{ transform: 'none', opacity: 1 }, { transform: 'rotate(160deg) scale(.1)', opacity: 0 }], { duration: d * 0.6, easing: 'ease-in' });
      a(novy, [{ transform: 'rotate(-160deg) scale(.1)', opacity: 0 }, { transform: 'none', opacity: 1 }], { delay: d * 0.4, duration: d * 0.6, easing: 'ease-out' });
      break;
    }
    case 'prepnout': {
      kontejner.style.perspective = '1600px';
      const s = smer === 'zleva' ? -1 : 1;
      a(stary, [{ transform: 'none', zIndex: 2 }, { transform: `translateX(${s * -55}%) rotateY(${s * 35}deg) scale(.8)`, zIndex: 2, offset: 0.5 }, { transform: 'translateZ(-300px) scale(.8)', zIndex: 1, opacity: 0 }]);
      a(novy, [{ transform: 'translateZ(-300px) scale(.8)', zIndex: 1, opacity: 0.4 }, { transform: `translateX(${s * 55}%) rotateY(${s * -35}deg) scale(.8)`, zIndex: 1, offset: 0.5 }, { transform: 'none', zIndex: 3, opacity: 1 }]);
      break;
    }
    case 'preklopit': {
      kontejner.style.perspective = '1800px';
      const s = smer === 'zleva' ? -1 : 1;
      a(stary, [{ transform: 'rotateY(0)', opacity: 1 }, { transform: `rotateY(${s * 90}deg)`, opacity: 1 }], { duration: d / 2, easing: 'ease-in' });
      a(novy, [{ transform: `rotateY(${-s * 90}deg)`, opacity: 1 }, { transform: 'rotateY(0)', opacity: 1 }], { duration: d / 2, delay: d / 2, easing: 'ease-out' });
      a(novy, [{ visibility: 'hidden' }, { visibility: 'visible' }], { duration: d / 2, easing: 'steps(1, end)' });
      break;
    }
    case 'galerie': {
      kontejner.style.perspective = '1400px';
      const s = smer === 'zleva' ? -1 : 1;
      a(stary, [{ transform: 'none' }, { transform: `translateX(${-s * 105}%) rotateY(${s * 30}deg) scale(.85)` }]);
      a(novy, [{ transform: `translateX(${s * 105}%) rotateY(${-s * 30}deg) scale(.85)` }, { transform: 'none' }]);
      break;
    }
    case 'krychle': case 'krabice': case 'otocit': {
      kontejner.style.perspective = typ === 'krabice' ? '900px' : '2000px';
      const [osa, znam] = { zprava: ['Y', 1], zleva: ['Y', -1], zdola: ['X', -1], shora: ['X', 1] }[smer] || ['Y', 1];
      const vel = osa === 'Y' ? W : H;
      const t = osa === 'Y' ? 'X' : 'Y';
      const posunuti = (k) => (osa === 'Y' ? `translateX(${k * vel / 2}px)` : `translateY(${-k * vel / 2}px)`);
      a(stary, [{ transform: `translateZ(${-vel / 2}px) rotate${osa}(0deg) translateZ(${vel / 2}px)` }, { transform: `translateZ(${-vel / 2}px) rotate${osa}(${-znam * 90}deg) translateZ(${vel / 2}px)` }]);
      a(novy, [{ transform: `translateZ(${-vel / 2}px) rotate${osa}(${znam * 90}deg) translateZ(${vel / 2}px)` }, { transform: `translateZ(${-vel / 2}px) rotate${osa}(0deg) translateZ(${vel / 2}px)` }]);
      void t; void posunuti;
      break;
    }
    case 'dvere': case 'okno': {
      kontejner.style.perspective = '1600px';
      novy.style.zIndex = 1; stary.style.zIndex = 2;
      stary.style.visibility = 'hidden';
      const svisle = smer !== 'vodorovne';
      const l = stary.cloneNode(true), r = stary.cloneNode(true);
      l.style.visibility = r.style.visibility = '';
      l.style.clipPath = svisle ? 'inset(0 50% 0 0)' : 'inset(0 0 50% 0)'; r.style.clipPath = svisle ? 'inset(0 0 0 50%)' : 'inset(50% 0 0 0)';
      l.style.transformOrigin = svisle ? '0 50%' : '50% 0'; r.style.transformOrigin = svisle ? '100% 50%' : '50% 100%';
      l.style.zIndex = r.style.zIndex = 3;
      kontejner.append(l, r);
      const rot = svisle ? 'rotateY' : 'rotateX';
      a(l, [{ transform: `${rot}(0)` }, { transform: `${rot}(${svisle ? -90 : 90}deg)` }], { easing: 'ease-in' });
      a(r, [{ transform: `${rot}(0)` }, { transform: `${rot}(${svisle ? 90 : -90}deg)` }], { easing: 'ease-in' });
      a(novy, [{ transform: 'translateZ(-260px)', opacity: 0.5 }, { transform: 'none', opacity: 1 }]);
      return hotovo().then(() => { l.remove(); r.remove(); stary.style.visibility = ''; });
    }
    case 'lupa': case 'prulet': {
      if (smer === 'ven') { novy.style.zIndex = 1; stary.style.zIndex = 2; a(stary, [{ transform: 'none', opacity: 1 }, { transform: 'scale(3)', opacity: 0 }]); a(novy, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }]); }
      else { a(novy, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'none', opacity: 1 }]); a(stary, [{ transform: 'none', opacity: 1 }, { transform: 'scale(2.2)', opacity: 0 }]); }
      break;
    }
    case 'dopravnik': {
      const s = smer === 'zleva' ? -1 : 1;
      kontejner.style.perspective = '1400px';
      a(stary, [{ transform: 'none' }, { transform: `translateX(${-s * 100}%) scale(.8) rotateY(${s * 15}deg)` }]);
      a(novy, [{ transform: `translateX(${s * 100}%) scale(.8) rotateY(${-s * 15}deg)` }, { transform: 'none' }]);
      break;
    }
    case 'obeznaDraha': {
      kontejner.style.perspective = '1600px';
      const s = smer === 'zleva' ? -1 : 1;
      a(stary, [{ transform: 'none', opacity: 1 }, { transform: `translateX(${-s * 40}%) translateZ(-500px) rotateY(${s * 60}deg)`, opacity: 0 }]);
      a(novy, [{ transform: `translateX(${s * 40}%) translateZ(-500px) rotateY(${-s * 60}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }]);
      break;
    }
    case 'premena':
      return premena(stary, novy, d);
    default:
      a(novy, [{ opacity: 0 }, { opacity: 1 }]);
  }
  return hotovo().then(() => { for (const u of [stary, novy]) { u.style.zIndex = ''; } });
}

/** Přeměna: objekty se stejným klíčem (morf/id/text) plynule přejdou do nové polohy a velikosti, ostatní se prolnou. */
function premena(stary, novy, d) {
  const klic = (u) => u.dataset.morf || u.dataset.id;
  const stare = new Map([...stary.querySelectorAll('.pr-o')].map((u) => [klic(u), u]));
  const text = (u) => u.textContent.trim().slice(0, 60);
  const stareText = new Map([...stary.querySelectorAll('.pr-o')].filter((u) => text(u)).map((u) => [text(u), u]));
  const anim = [];
  anim.push(stary.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d * 0.6, fill: 'both', easing: 'ease' }));
  const pouzite = new Set();
  const pozadi = novy.querySelector('.pr-pozadi');
  if (pozadi) anim.push(pozadi.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d * 0.6, fill: 'both' }));
  for (const u of novy.querySelectorAll('.pr-o')) {
    const s = stare.get(klic(u)) || stareText.get(text(u));
    if (!s || pouzite.has(s)) { anim.push(u.animate([{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }], { duration: d, fill: 'both', easing: 'ease' })); continue; }
    pouzite.add(s);
    const a = { x: parseFloat(s.style.left), y: parseFloat(s.style.top), w: parseFloat(s.style.width), h: parseFloat(s.style.height) };
    const b = { x: parseFloat(u.style.left), y: parseFloat(u.style.top), w: parseFloat(u.style.width), h: parseFloat(u.style.height) };
    const zakl = u.style.transform || '';
    const rotA = /rotate\(([-\d.]+)deg\)/.exec(s.style.transform)?.[1] || 0, rotB = /rotate\(([-\d.]+)deg\)/.exec(zakl)?.[1] || 0;
    const sx = a.w / (b.w || 1), sy = a.h / (b.h || 1);
    const tx = a.x + a.w / 2 - (b.x + b.w / 2), ty = a.y + a.h / 2 - (b.y + b.h / 2);
    s.style.visibility = 'hidden';
    anim.push(u.animate([
      { transform: `translate(${tx}px, ${ty}px) rotate(${rotA}deg) scale(${sx}, ${sy})` },
      { transform: `translate(0,0) rotate(${rotB}deg) scale(1,1)` },
    ], { duration: d, fill: 'both', easing: 'cubic-bezier(.45,0,.25,1)' }));
  }
  return Promise.all(anim.map((x) => x.finished.catch(() => {}))).then(() => stary.querySelectorAll('.pr-o').forEach((u) => { u.style.visibility = ''; }));
}

// ---------------------------------------------------------------- animace objektů
export const ANIMACE = {
  vstup: { nazev: 'Úvodní animace', barva: '#4EA72E', polozky: [
    ['zobrazit', 'Zobrazit'], ['zeslabit', 'Zeslabit'], ['priletet', 'Přiletět'], ['ploutDovnitr', 'Plout dovnitř'], ['rozdelit', 'Rozdělit'], ['setrit', 'Setřít'],
    ['tvar', 'Tvar'], ['kolo', 'Kolo'], ['nahodnePruhy', 'Náhodné pruhy'], ['zvetsitOtocit', 'Zvětšit a otočit'], ['lupa', 'Lupa'], ['otocit', 'Otočit'], ['odrazit', 'Odrazit'],
  ] },
  zduraz: { nazev: 'Zdůraznění', barva: '#E8A202', polozky: [
    ['pulz', 'Pulz'], ['barevnyPulz', 'Barevný pulz'], ['kyvacka', 'Kývačka'], ['otaceni', 'Otáčení'], ['zvetsitZmensit', 'Zvětšit/zmenšit'], ['pruhlednost', 'Průhlednost'],
    ['tucneBlikani', 'Tučné blikání'], ['vlna', 'Vlna'], ['zesvetlit', 'Zesvětlit'],
  ] },
  vystup: { nazev: 'Ukončovací animace', barva: '#C43E1C', polozky: [
    ['zmizet', 'Zmizet'], ['zeslabit', 'Zeslabit'], ['odletet', 'Odletět'], ['ploutVen', 'Plout ven'], ['rozdelit', 'Rozdělit'], ['setrit', 'Setřít'],
    ['tvar', 'Tvar'], ['kolo', 'Kolo'], ['nahodnePruhy', 'Náhodné pruhy'], ['zmensitOtocit', 'Zmenšit a otočit'], ['lupa', 'Lupa'], ['otocit', 'Otočit'], ['odrazit', 'Odrazit'],
  ] },
  cesta: { nazev: 'Cesty pohybu', barva: '#7A7A7A', polozky: [['cary', 'Čáry'], ['oblouky', 'Oblouky'], ['otocky', 'Otočky'], ['tvary', 'Tvary'], ['smycky', 'Smyčky']] },
};
export const nazevAnimace = (a) => ANIMACE[a.druh]?.polozky.find((p) => p[0] === a.efekt)?.[1] || a.efekt;
export const MOZNOSTI_ANIMACE = {
  priletet: [['zdola', 'Zdola'], ['zlevaDole', 'Zleva dole'], ['zleva', 'Zleva'], ['zlevaNahore', 'Zleva nahoře'], ['shora', 'Shora'], ['zpravaNahore', 'Zprava nahoře'], ['zprava', 'Zprava'], ['zpravaDole', 'Zprava dole']],
  odletet: [['dolu', 'Dolů'], ['doleva', 'Doleva'], ['nahoru', 'Nahoru'], ['doprava', 'Doprava']],
  ploutDovnitr: [['nahoru', 'Plout nahoru'], ['dolu', 'Plout dolů']], ploutVen: [['nahoru', 'Plout nahoru'], ['dolu', 'Plout dolů']],
  setrit: [['zdola', 'Zdola'], ['zleva', 'Zleva'], ['zprava', 'Zprava'], ['shora', 'Shora']],
  rozdelit: [['vodorovneVen', 'Vodorovně ven'], ['vodorovneDovnitr', 'Vodorovně dovnitř'], ['svisleVen', 'Svisle ven'], ['svisleDovnitr', 'Svisle dovnitř']],
  tvar: [['kruh', 'Kruh'], ['kosoctverec', 'Kosočtverec'], ['plus', 'Plus'], ['ramecek', 'Rámeček']],
  nahodnePruhy: [['vodorovne', 'Vodorovně'], ['svisle', 'Svisle']],
  kolo: [['1', '1 paprsek'], ['2', '2 paprsky'], ['4', '4 paprsky'], ['8', '8 paprsků']],
  otaceni: [['doprava', 'Po směru hodinových ručiček'], ['doleva', 'Proti směru hodinových ručiček']],
  zvetsitZmensit: [['150', 'Větší (150 %)'], ['200', 'Obrovská (200 %)'], ['50', 'Menší (50 %)']],
  cary: [['dolu', 'Dolů'], ['doleva', 'Doleva'], ['doprava', 'Doprava'], ['nahoru', 'Nahoru']],
  oblouky: [['dolu', 'Dolů'], ['nahoru', 'Nahoru'], ['doleva', 'Doleva'], ['doprava', 'Doprava']],
};
export const VYCHOZI_TRVANI = { zobrazit: 0, zmizet: 0, zeslabit: 0.5, priletet: 0.5, odletet: 0.5, ploutDovnitr: 1, ploutVen: 1, rozdelit: 0.5, setrit: 0.5, tvar: 2, kolo: 2, nahodnePruhy: 0.5, zvetsitOtocit: 0.5, zmensitOtocit: 0.5, lupa: 0.5, otocit: 2, odrazit: 2, pulz: 0.5, barevnyPulz: 0.5, kyvacka: 1, otaceni: 2, zvetsitZmensit: 2, pruhlednost: 2, tucneBlikani: 1, vlna: 1, zesvetlit: 0.5, cary: 2, oblouky: 2, otocky: 2, tvary: 2, smycky: 2 };

/** Stav objektu před a po animaci (kvůli skrytí vstupujících objektů při startu snímku). */
export const skrytPredAnimaci = (a) => a.druh === 'vstup';

/**
 * Vrátí [keyframes, trvání ms] animace pro prvek objektu. zakl = základní transform objektu (otočení, převrácení).
 * geo = { o, W, H } v jednotkách snímku.
 */
export function keyframesAnimace(a, zakl, { o, W, H }) {
  const d = Math.max(1, (a.trvani ?? VYCHOZI_TRVANI[a.efekt] ?? 0.5) * 1000);
  const T = (t) => `${t} ${zakl}`.trim();
  const ven = a.druh === 'vystup';
  const vstup = (kf) => (ven ? kf.slice().reverse().map((k, i, arr) => ({ ...k, offset: k.offset !== undefined ? 1 - k.offset : undefined, easing: arr[i].easing })) : kf);
  const smerLet = a.smer || (ven ? 'dolu' : 'zdola');
  const mimo = () => {
    const m = { zdola: [0, H - o.y + 10], dolu: [0, H - o.y + 10], shora: [0, -(o.y + o.h + 10)], nahoru: [0, -(o.y + o.h + 10)], zleva: [-(o.x + o.w + 10), 0], doleva: [-(o.x + o.w + 10), 0], zprava: [W - o.x + 10, 0], doprava: [W - o.x + 10, 0] };
    if (m[smerLet]) return m[smerLet];
    const x = /zleva/.test(smerLet) ? -(o.x + o.w + 10) : W - o.x + 10, y = /Dole/.test(smerLet) ? H - o.y + 10 : -(o.y + o.h + 10);
    return [x, y];
  };
  let kf;
  switch (a.efekt) {
    case 'zobrazit': case 'zmizet': kf = ven ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }]; return [kf, 1, 'steps(1, end)'];
    case 'zeslabit': kf = vstup([{ opacity: 0 }, { opacity: 1 }]); break;
    case 'priletet': case 'odletet': { const [x, y] = mimo(); kf = vstup([{ transform: T(`translate(${x}px, ${y}px)`), easing: 'cubic-bezier(.2,.8,.3,1)' }, { transform: T('') }]); break; }
    case 'ploutDovnitr': case 'ploutVen': { const y = (a.smer === 'dolu' ? -1 : 1) * 60; kf = vstup([{ opacity: 0, transform: T(`translateY(${y}px)`) }, { opacity: 1, transform: T('') }]); break; }
    case 'setrit': { const z = { zdola: 'inset(100% 0 0 0)', shora: 'inset(0 0 100% 0)', zleva: 'inset(0 100% 0 0)', zprava: 'inset(0 0 0 100%)' }[a.smer || 'zdola']; kf = vstup([{ clipPath: z }, { clipPath: 'inset(0 0 0 0)' }]); break; }
    case 'rozdelit': { const sv = /^svisle/.test(a.smer || ''); const z = sv ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)'; const dovnitr = /Dovnitr/.test(a.smer || ''); kf = vstup(dovnitr ? [{ clipPath: 'inset(0 0 0 0)', opacity: 0 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }] : [{ clipPath: z }, { clipPath: 'inset(0 0 0 0)' }]); break; }
    case 'tvar': { const t = a.smer === 'kosoctverec' ? ['polygon(50% 50%,50% 50%,50% 50%,50% 50%)', 'polygon(50% -50%,150% 50%,50% 150%,-50% 50%)'] : a.smer === 'ramecek' ? ['inset(50% 50% 50% 50%)', 'inset(0 0 0 0)'] : a.smer === 'plus' ? ['inset(50% 50% 50% 50%)', 'inset(0 0 0 0)'] : ['circle(0% at 50% 50%)', 'circle(71% at 50% 50%)']; kf = vstup([{ clipPath: t[0] }, { clipPath: t[1] }]); break; }
    case 'kolo': { const n = +(a.smer || 1); const g = n === 1 ? 'conic-gradient(#000 var(--pr-uhel), transparent 0)' : `repeating-conic-gradient(#000 0 calc(var(--pr-uhel) / ${n}), transparent 0 ${360 / n}deg)`; kf = vstup([{ '--pr-uhel': '0deg', maskImage: g }, { '--pr-uhel': '360deg', maskImage: g }]); return [kf, d, 'linear', { maska: g }]; }
    case 'nahodnePruhy': { const sv = a.smer === 'svisle'; const g = `repeating-linear-gradient(${sv ? 90 : 180}deg, #000 0 var(--pr-pruh), transparent var(--pr-pruh) 8%)`; kf = vstup([{ '--pr-pruh': '0%' }, { '--pr-pruh': '8.1%' }]); return [kf, d, 'linear', { maska: g }]; }
    case 'zvetsitOtocit': case 'zmensitOtocit': kf = vstup([{ opacity: 0, transform: T('scale(.1) rotate(-90deg)') }, { opacity: 1, transform: T('') }]); break;
    case 'lupa': kf = vstup([{ opacity: 0, transform: T('scale(0)') }, { opacity: 1, transform: T('') }]); break;
    case 'otocit': kf = vstup([{ opacity: 0, transform: T('rotateY(0deg) scale(.2)') }, { opacity: 1, transform: T('rotateY(1080deg) scale(1)') }]); break;
    case 'odrazit': {
      const y = -(o.y + o.h);
      kf = vstup([
        { transform: T(`translateY(${y}px)`), opacity: 0, easing: 'cubic-bezier(.55,0,1,.45)' }, { transform: T(''), opacity: 1, offset: 0.45, easing: 'cubic-bezier(0,.55,.45,1)' },
        { transform: T('translateY(-40px)'), offset: 0.62, easing: 'cubic-bezier(.55,0,1,.45)' }, { transform: T(''), offset: 0.78, easing: 'cubic-bezier(0,.55,.45,1)' },
        { transform: T('translateY(-12px)'), offset: 0.88, easing: 'cubic-bezier(.55,0,1,.45)' }, { transform: T('') },
      ]);
      break;
    }
    // zdůraznění
    case 'pulz': kf = [{ transform: T('scale(1)') }, { transform: T('scale(1.08)') }, { transform: T('scale(1)') }]; break;
    case 'barevnyPulz': kf = [{ filter: 'none' }, { filter: 'brightness(1.3) saturate(1.8) hue-rotate(-20deg) drop-shadow(0 0 6px rgba(255,160,0,.8))' }, { filter: 'none' }]; break;
    case 'kyvacka': kf = [{ transform: T('rotate(0)') }, { transform: T('rotate(5deg)') }, { transform: T('rotate(-5deg)') }, { transform: T('rotate(5deg)') }, { transform: T('rotate(-5deg)') }, { transform: T('rotate(0)') }]; break;
    case 'otaceni': kf = [{ transform: T('rotate(0)') }, { transform: T(`rotate(${a.smer === 'doleva' ? -360 : 360}deg)`) }]; break;
    case 'zvetsitZmensit': { const k = +(a.smer || 150) / 100; kf = [{ transform: T('scale(1)') }, { transform: T(`scale(${k})`) }]; return [kf, d, 'ease-in-out', { drzet: true }]; }
    case 'pruhlednost': kf = [{ opacity: 1 }, { opacity: 0.5 }]; return [kf, d, 'ease', { drzet: true }];
    case 'tucneBlikani': kf = [{ fontWeight: 'inherit' }, { fontWeight: 900, offset: 0.1 }, { fontWeight: 900, offset: 0.9 }, { fontWeight: 'inherit' }]; break;
    case 'vlna': kf = [{ transform: T('translateY(0)') }, { transform: T('translateY(-14px) scale(1.05)') }, { transform: T('translateY(0)') }]; break;
    case 'zesvetlit': kf = [{ filter: 'none' }, { filter: 'brightness(1.5) saturate(.6)' }]; return [kf, d, 'ease', { drzet: true }];
    // cesty pohybu
    case 'cary': { const v = { dolu: [0, 120], nahoru: [0, -120], doleva: [-160, 0], doprava: [160, 0] }[a.smer || 'dolu']; kf = [{ transform: T('') }, { transform: T(`translate(${v[0]}px, ${v[1]}px)`) }]; return [kf, d, 'ease-in-out', { drzet: true }]; }
    case 'oblouky': { const s = a.smer === 'nahoru' ? -1 : 1; kf = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ transform: T(`translate(${t * 180}px, ${s * Math.sin(t * Math.PI) * 90}px)`) })); return [kf, d, 'ease-in-out', { drzet: true }]; }
    case 'otocky': kf = [{ transform: T('') }, { transform: T('translate(140px,0)'), offset: 0.5 }, { transform: T('translate(140px,120px)') }]; return [kf, d, 'ease-in-out', { drzet: true }];
    case 'tvary': kf = Array.from({ length: 13 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return { transform: T(`translate(${Math.sin(t) * 90}px, ${(1 - Math.cos(t)) * 90}px)`) }; }); break;
    case 'smycky': kf = Array.from({ length: 17 }, (_, i) => { const t = (i / 16) * Math.PI * 2; return { transform: T(`translate(${t * 40 + Math.sin(t * 2) * 50}px, ${Math.sin(t) * 60}px)`) }; }); return [kf, d, 'linear', { drzet: true }];
    default: kf = vstup([{ opacity: 0 }, { opacity: 1 }]);
  }
  return [kf, d, 'ease'];
}

/** Přehraje animaci na prvku objektu. Vrací Animation. */
export function prehrajAnimaci(uzel, a, geo) {
  const zakl = uzel.dataset.zaklTransform ?? (uzel.dataset.zaklTransform = uzel.style.transform || '');
  const [kf, d, easing, x = {}] = keyframesAnimace(a, zakl, geo);
  if (x.maska) { uzel.style.maskImage = uzel.style.webkitMaskImage = x.maska; }
  uzel.style.visibility = '';
  const vystup = a.druh === 'vystup';
  const anim = uzel.animate(kf, { duration: d, easing, fill: 'both', iterations: a.opakovani || 1 });
  anim.finished.then(() => {
    if (x.maska) uzel.style.maskImage = uzel.style.webkitMaskImage = '';
    if (vystup) { uzel.style.visibility = 'hidden'; anim.cancel(); }
    else if (a.druh === 'vstup' || !x.drzet) { if (!x.drzet && a.druh !== 'cesta') anim.cancel(); }
  }).catch(() => {});
  return anim;
}

/**
 * Rozdělí animace snímku do kroků: [{ automaticky, polozky: [{ a, start (ms), konec (ms) }] }].
 * „Po kliknutí“ = nový krok; „S předchozí“ = stejný začátek; „Po předchozí“ = po konci předchozí.
 */
export function krokyAnimaci(s) {
  const kroky = [];
  let krok = null, predchozi = null;
  for (const a of s.animace || []) {
    const trv = (a.trvani ?? VYCHOZI_TRVANI[a.efekt] ?? 0.5) * 1000 * (a.opakovani || 1);
    const zp = (a.zpozdeni || 0) * 1000;
    if (!krok || a.start === 'klik' || !a.start) {
      krok = { automaticky: !kroky.length && a.start && a.start !== 'klik', polozky: [] };
      if (a.start === 'klik' || !a.start) krok.automaticky = false;
      kroky.push(krok);
      const zacatek = zp;
      krok.polozky.push({ a, start: zacatek, konec: zacatek + trv });
      predchozi = { start: zacatek, konec: zacatek + trv };
      continue;
    }
    const zakl = a.start === 'spolu' ? predchozi.start : predchozi.konec;
    const st = zakl + zp;
    krok.polozky.push({ a, start: st, konec: st + trv });
    predchozi = { start: st, konec: st + trv };
  }
  // první krok bez kliknutí (s předchozí / po předchozí na začátku) se spustí sám
  if (kroky[0] && (s.animace[0]?.start === 'spolu' || s.animace[0]?.start === 'po')) kroky[0].automaticky = true;
  return kroky;
}

/** Přehraje jeden krok na snímku (uzly .pr-o v kontejneru). Vrací Promise po skončení. */
export function prehrajKrok(krok, kontejner, geoPro) {
  const cekani = [];
  for (const { a, start } of krok.polozky) {
    const u = kontejner.querySelector(`.pr-o[data-id="${a.obj}"]`);
    if (!u) continue;
    cekani.push(new Promise((hotovo) => {
      const t = setTimeout(() => {
        const an = prehrajAnimaci(u, a, geoPro(a.obj));
        an.finished.then(hotovo, hotovo);
      }, start);
      u._casovace = [...(u._casovace || []), t];
    }));
  }
  return Promise.all(cekani);
}

/** Na začátku snímku skryje objekty, které teprve vstoupí. */
export function pripravAnimace(s, kontejner) {
  const skryte = new Set();
  for (const a of s.animace || []) {
    if (skryte.has(a.obj)) continue;
    if (a.druh === 'vstup') { const u = kontejner.querySelector(`.pr-o[data-id="${a.obj}"]`); if (u) u.style.visibility = 'hidden'; }
    skryte.add(a.obj);   // rozhoduje první animace objektu
  }
}
