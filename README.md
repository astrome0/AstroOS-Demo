# AstroOS — Demo

> **⚠ This is a DEMO, not a finished product.**
> **© 2026 AstroMeo. All rights reserved.** This repository is for viewing and trying out only.
> Copying, modifying, redistributing or reusing any part of it is not allowed. See [LICENSE](LICENSE).

AstroOS is an operating system that runs in the browser, written from scratch in plain HTML, CSS and
JavaScript (no frameworks, no server). Boot, setup, lock screen, desktop, window manager, taskbar,
Start menu and a lot of apps. The interface is in Czech and English.

This demo is a cut-down version. Features that are missing are still visible in the menus, but they
show a "full version only" message instead.

## What's in the demo

- **Files, Terminal, Notes, Photos, Calculator, Task Manager**
- **AstroPísmo, AstroTabulky, AstroPrezentace** — an office suite (documents, spreadsheets, slides)
- **Code Editor** with a live preview
- **Astro 3D** — modeling, materials, lights and viewport
- **Nova** — a browser for `astro://` pages and files on the AstroOS disk
- **Paint, Music, Recorder, Mail, Weather, Games, Store, Defender, AstroGPU**
- Czech and English, light and dark theme, multiple user accounts

All data stays in your browser (localStorage, IndexedDB, Cache). Nothing is sent anywhere.

## Full version only

- **AI** — AstroAI, the voice assistant Jirka, Astro Studio and AI helpers inside the apps
- **Astro 3D** — Render Pro (path tracer), keyframe animation, OBJ import and export
- **Office** — export to HTML, text and CSV, PivotTables and PivotCharts, more presentation themes
- **Apps** — installing your own apps, most games and apps from the Store
- **Internet** — Nova and the web apps (Maps, Monkeytype) open real websites through a dedicated server

## Try it

**Live demo: <https://astrome0.github.io/AstroOS-Demo/>**

It is a static website, so it runs entirely in your browser. Default login password: `astro`.

To run it locally, any static server works, for example:

```bash
npx serve .
```

Double-clicking `index.html` is not enough: browsers don't run JavaScript modules or service workers
from `file://`, so it needs an `http(s)://` address.

## Tips

- The browser console has `AstroOS.reset()` (wipes the disk and starts setup again)
  and `AstroOS.preskocOobe()` (skips setup).
- You set your own account password during setup.
- Pages from the AstroOS disk are served by a service worker (`sw.js`) on the same address as the system.

## Copyright

© 2026 AstroMeo. **All rights reserved.**

The code, graphics, user interface, texts and the *AstroMeo Abstract* wallpapers are original work
protected by copyright. You may open the demo in a browser and read the source code. You may not copy,
modify, distribute, republish or use any part of this repository elsewhere without written permission
from the author. Full terms are in [LICENSE](LICENSE).
