// Mapy (www.openstreetmap.org) jako aplikace AstroOS — příkazy z nabídky a klávesy.
(function () {
  var a = window.astroApp;
  if (!a) return;
  a.domeny = ['openstreetmap.org'];
  a.cekejNa('.leaflet-tile-loaded');

  function klikni(sel) { var b = document.querySelector(sel); if (b) b.click(); }
  function hledej() {
    var q = document.querySelector('#sidebar .search_form input[name=query]') || document.querySelector('input[name=query]');
    if (q) { q.focus(); q.select(); }
  }
  a.prikazy.hledat = hledej;
  a.prikazy.trasa = function () { klikni('#sidebar .switch_link'); };
  a.prikazy.poloha = function () { klikni('.control-locate .control-button'); };
  a.prikazy.vrstvy = function () { klikni('.control-layers .control-button'); };

  // Ctrl+F / Ctrl+L = hledat místo (jako v aplikaci Mapy), ne hledání v prohlížeči
  addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && /^[fFlL]$/.test(e.key)) { e.preventDefault(); hledej(); }
  }, true);
})();
