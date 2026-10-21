// AstroOS — vstupní bod

import { OS } from './os.js';
import { State } from './state.js';
import { spustPreklad, nastavJazyk } from './i18n.js';
import './electron.js';

spustPreklad();

// ladicí rozhraní: v konzoli prohlížeče lze systém řídit ručně
window.AstroOS = {
  state: State,
  reset() { State.reset(); location.reload(); },
  fastboot(v = true) { State.set('fastboot', v); },
  // instalace (OOBE): přeskočit, nebo zrychlit běžící
  preskocOobe() { State.patch({ oobeHotovo: true }); location.reload(); },
  async oobeRychlost(r) { (await import('./oobe.js')).nastavRychlost(r); },
  /** Jazyk systému: AstroOS.jazyk('en') / AstroOS.jazyk('cs') */
  jazyk: nastavJazyk,
};

OS.start();
