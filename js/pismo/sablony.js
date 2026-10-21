// AstroPísmo — šablony dokumentů pro Soubor → Domů / Nový
// Styly odstavců: p = Normální, div = Bez mezer, h1–h3 = Nadpisy, h5 = Název, h6 = Podtitul, blockquote = Citace

const dnes = () => new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });

export const SABLONY = [
  {
    id: 'prazdny', nazev: 'Prázdný dokument',
    html: () => '<p><br></p>',
  },
  {
    id: 'prohlidka', nazev: 'Vítá vás AstroPísmo',
    html: () => `
<h5>Vítá vás AstroPísmo</h5>
<h6>Pět tipů, jak začít</h6>
<p>Tenhle dokument je normální dokument — klidně do něj pište, mažte a zkoušejte. Nic se nerozbije a zavřít ho můžete bez uložení.</p>
<h1>1. Formátování na kartě Domů</h1>
<p>Označte kus textu a zkuste <b>tučné písmo</b> (Ctrl+B), <i>kurzívu</i> (Ctrl+I) nebo <u>podtržení</u> (Ctrl+U). <span style="background-color: rgb(255, 255, 0);">Zvýrazňovač</span> a <span style="color: rgb(192, 0, 0);">barva písma</span> jsou hned vedle.</p>
<h1>2. Styly dělají pořádek</h1>
<p>Nadpisy v tomhle dokumentu jsou ze stylu <b>Nadpis 1</b>. Klikněte do libovolného odstavce a vyberte styl v galerii Styly vpravo na pásu karet. Nadpisy se pak objeví i v <b>Navigačním podokně</b> (Ctrl+F).</p>
<h1>3. Seznamy a tabulky</h1>
<ul><li>Napište na začátek řádku hvězdičku a mezeru a vznikne odrážka.</li><li>Napište „1.“ a mezeru a vznikne číslovaný seznam.</li><li>Tabulku vložíte na kartě Vložení → Tabulka.</li></ul>
<table class="ps-tab ps-tab-mrizka"><tbody><tr><td><b>Klávesa</b></td><td><b>Co udělá</b></td></tr><tr><td>Ctrl+S</td><td>Uloží dokument</td></tr><tr><td>Ctrl+Enter</td><td>Nová stránka</td></tr><tr><td>Ctrl+H</td><td>Najít a nahradit</td></tr></tbody></table>
<p><br></p>
<h1>4. AstroAI vám pomůže psát</h1>
<p>Úplně vpravo na kartě Domů je tlačítko <b>AstroAI</b>. Umí shrnout dokument, přepsat označený text nebo napsat koncept podle zadání.</p>
<h1>5. Uložení a tisk</h1>
<p>Karta <b>Soubor</b> otevře zákulisí: uložení, otevření dalších dokumentů, tisk i export do PDF. Dokumenty se ukládají do složky Dokumenty jako soubory .docx.</p>
<blockquote>„Dobrý dokument nepotřebuje být dlouhý. Potřebuje být přehledný.“</blockquote>`,
  },
  {
    id: 'zivotopis', nazev: 'Životopis',
    html: (jmeno = 'Jan Novák') => `
<h5 style="text-align: left;">${jmeno}</h5>
<div style="color: rgb(89, 89, 89);">Brno · jan.novak@astroos.cz · +420 777 123 456</div>
<p><br></p>
<h1>Profil</h1>
<p>Zvídavý student se zájmem o programování, 3D grafiku a tvorbu her. Rád se učím nové věci a dotahuji projekty do konce.</p>
<h1>Zkušenosti</h1>
<h3>Vlastní projekty · 2024 – dosud</h3>
<ul><li>Operační systém v prohlížeči (HTML, CSS, JavaScript)</li><li>Mody a servery pro Minecraft</li><li>Hra v Roblox Studiu pro více hráčů</li></ul>
<h3>Brigáda · léto 2025</h3>
<p>Pomoc s IT v rodinné firmě — instalace počítačů, nastavení sítě a tiskáren.</p>
<h1>Vzdělání</h1>
<h3>Základní škola · 2017 – 2026</h3>
<p>Zaměření na matematiku a informatiku.</p>
<h1>Dovednosti</h1>
<table class="ps-tab ps-tab-bez"><tbody><tr><td>JavaScript, HTML, CSS</td><td>●●●●○</td></tr><tr><td>Lua (Roblox)</td><td>●●●○○</td></tr><tr><td>Angličtina</td><td>●●●●○</td></tr><tr><td>Linux</td><td>●●●○○</td></tr></tbody></table>`,
  },
  {
    id: 'dopis', nazev: 'Dopis',
    html: (jmeno = 'Jan Novák') => `
<div>${jmeno}</div>
<div>Masarykova 12</div>
<div>602 00 Brno</div>
<p><br></p>
<div>Vážená paní</div>
<div>Jana Dvořáková</div>
<div>Náměstí Míru 5</div>
<div>120 00 Praha 2</div>
<p><br></p>
<p style="text-align: right;">V Brně dne ${dnes()}</p>
<p><b>Věc: Žádost o …</b></p>
<p>Vážená paní Dvořáková,</p>
<p>obracím se na Vás s prosbou o … Sem napište, proč dopis píšete. Držte se jednoho tématu a buďte struční.</p>
<p>V druhém odstavci můžete doplnit podrobnosti — termíny, čísla, co přesně potřebujete a do kdy.</p>
<p>Předem děkuji za odpověď.</p>
<p>S pozdravem</p>
<p><br></p>
<p>${jmeno}</p>`,
  },
  {
    id: 'referat', nazev: 'Referát do školy',
    html: (jmeno = 'Jan Novák') => `
<h5>Sluneční soustava</h5>
<h6>Referát do přírodopisu · ${jmeno}</h6>
<h1>Úvod</h1>
<p>Sluneční soustava je planetární systém hvězdy zvané Slunce. Kromě osmi planet do ní patří trpasličí planety, měsíce, planetky, komety a meziplanetární prach.</p>
<h1>Planety</h1>
<p>Planety dělíme na <b>vnitřní</b> (kamenné) a <b>vnější</b> (plynné a ledové obry).</p>
<table class="ps-tab ps-tab-modra"><tbody><tr><td>Planeta</td><td>Vzdálenost od Slunce</td><td>Počet měsíců</td></tr><tr><td>Merkur</td><td>0,39 AU</td><td>0</td></tr><tr><td>Venuše</td><td>0,72 AU</td><td>0</td></tr><tr><td>Země</td><td>1,00 AU</td><td>1</td></tr><tr><td>Mars</td><td>1,52 AU</td><td>2</td></tr><tr><td>Jupiter</td><td>5,20 AU</td><td>95</td></tr></tbody></table>
<p><br></p>
<h2>Země</h2>
<p>Země je jediná planeta, o které víme, že na ní existuje život. Kolem Slunce oběhne za 365,25 dne.</p>
<h2>Jupiter</h2>
<p>Jupiter je největší planeta soustavy. Jeho Velká rudá skvrna je bouře větší než celá Země.</p>
<h1>Závěr</h1>
<p>Sluneční soustava je obrovská a pořád jsou v ní věci, které lidstvo neprozkoumalo.</p>
<h1>Zdroje</h1>
<ul><li>cs.wikipedia.org — Sluneční soustava</li><li>Učebnice přírodopisu pro 8. ročník</li></ul>`,
  },
  {
    id: 'pozvanka', nazev: 'Pozvánka na párty',
    html: () => `
<p style="text-align: center;"><br></p>
<h5 style="text-align: center;"><span style="color: rgb(160, 43, 147); font-size: 44pt;">Pozvánka</span></h5>
<p style="text-align: center;"><span style="font-size: 18pt; color: rgb(233, 113, 50);">na narozeninovou oslavu</span></p>
<p style="text-align: center;"><br></p>
<p style="text-align: center;"><span style="font-size: 16pt;"><b>Kdy:</b> sobota 10. října od 15:00</span></p>
<p style="text-align: center;"><span style="font-size: 16pt;"><b>Kde:</b> u nás na zahradě</span></p>
<p style="text-align: center;"><br></p>
<p style="text-align: center;"><span style="font-size: 14pt;">Bude pizza, hry a táborák. Vezměte si teplou mikinu!</span></p>
<p style="text-align: center;"><br></p>
<p style="text-align: center;"><span style="font-size: 12pt; color: rgb(89, 89, 89);">Dejte prosím vědět do středy, jestli dorazíte.</span></p>`,
    nast: { barvaStranky: '#fdf3e7', ohraniceni: true },
  },
];
