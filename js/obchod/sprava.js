// AstroOS — instalace a odinstalace aplikací z Obchodu
//
// Instalace jen zaregistruje hotovou aplikaci z katalogu: přidá ji do APPS,
// připne do Startu a dá zástupce na plochu (stejně jako aplikace ze složek v aplikace.js).

import { bus } from '../util.js';
import { State } from '../state.js';
import { APPS, prepniPin, jePripnuto } from '../apps.js';
import { windows } from '../wm.js';
import { KLIC, nainstalovane, PODLE_ID } from './katalog.js';

export const jeNainstalovana = (id) => nainstalovane().includes(id);

const sirkaVyska = (a) => ({ width: 780, height: 540, cat: 'tools', ...a });

export function nainstalujAplikaci(id, { plocha = true } = {}) {
  const a = PODLE_ID[id];
  if (!a || jeNainstalovana(id)) return;
  State.set(KLIC, [...nainstalovane(), id]);
  State.set('oaInstalovano', { ...(State.get('oaInstalovano') || {}), [id]: Date.now() });
  APPS[id] = sirkaVyska(a);
  if (!jePripnuto('pinyStart', id)) prepniPin('pinyStart', id);
  if (plocha) State.set('plochaAplikace', [...new Set([...(State.get('plochaAplikace') || []), id])]);
  bus.emit('piny', 'pinyStart');
  bus.emit('aplikace', { id });
  // podezřelá appka: soubory na disk a neplecha (nakaza.js)
  if (a.vir) import('../nakaza.js').then((m) => m.nakazit(a));
}

export function odinstalujAplikaci(id) {
  if (!jeNainstalovana(id)) return;
  for (const w of windows.filter((x) => x.app.id === id)) w.close();
  State.set(KLIC, nainstalovane().filter((x) => x !== id));
  if (jePripnuto('pinyStart', id)) prepniPin('pinyStart', id);
  if (jePripnuto('pinyPanel', id)) prepniPin('pinyPanel', id);
  State.set('plochaAplikace', (State.get('plochaAplikace') || []).filter((x) => x !== id));
  delete APPS[id];
  bus.emit('piny', 'pinyStart');
  bus.emit('piny', 'pinyPanel');
  bus.emit('aplikace', null);
}
