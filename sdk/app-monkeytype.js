// Monkeytype jako aplikace AstroOS — cookies předem odmítnuté, příkazy z nabídky, výsledky testů
// posílá AstroOS (ten si pamatuje osobní rekordy a ohlásí nový oznámením).
(function () {
  var a = window.astroApp;
  if (!a) return;
  a.domeny = ['monkeytype.com'];

  // Souhlas s cookies = „jen nezbytné“, jako by to uživatel odklikl (klíč a tvar z webu)
  try {
    if (!localStorage.getItem('acceptedCookies')) {
      localStorage.setItem('acceptedCookies', JSON.stringify({ security: true, analytics: false, sentry: false }));
    }
  } catch (e) { /* bez úložiště */ }

  a.cekejNa('#words .word');

  function klikni(sel) { var b = document.querySelector(sel); if (b) b.click(); }
  a.prikazy.novy = function () {
    if (!document.querySelector('[data-nav-item="test"]') || location.pathname !== '/') klikni('header [data-nav-item="test"]');
    setTimeout(function () { klikni('#restartTestButton'); klikni('#nextTestButton'); }, 50);
  };
  a.prikazy.nastaveni = function () { klikni('header [data-nav-item="settings"]'); };

  function config() {
    try { return JSON.parse(localStorage.getItem('config')) || {}; } catch (e) { return {}; }
  }
  var posledni = '';
  setInterval(function () {
    var r = document.getElementById('result');
    if (!r || r.classList.contains('hidden') || !r.offsetParent) { posledni = ''; return; }
    var wpm = r.querySelector('.wpm .bottom'), acc = r.querySelector('.acc .bottom');
    if (!wpm || !acc || !wpm.textContent.trim() || wpm.textContent.trim() === '-') return;
    var klic = wpm.textContent + '|' + acc.textContent;
    if (klic === posledni) return;
    posledni = klic;
    var c = config();
    a.posli({
      typ: 'vysledek',
      wpm: parseFloat(wpm.textContent), acc: parseFloat(acc.textContent),
      rezim: c.mode, delka: c.mode === 'time' ? c.time : c.mode === 'words' ? c.words : null, jazyk: c.language,
    });
  }, 700);
})();
