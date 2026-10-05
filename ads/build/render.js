// Builds every static ad as an HTML page (build/html/) and renders it to PNG (final/) with Playwright.
// Also measures how much of each canvas is covered by text and writes build/text-coverage.json.
// Run: NODE_PATH=<dir with playwright installed> node render.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const HTML = path.join(__dirname, 'html'), FINAL = path.resolve(__dirname, '../final');
fs.mkdirSync(HTML, { recursive: true }); fs.mkdirSync(FINAL, { recursive: true });
const shot = (site, name) => `../../screenshots/${site}/${name}.png`;
const AURA = 'aura-atelier', BOW = 'ribbon-and-rose'; // real client name withheld: shown as a concept build

// Approved Portside "P" mark (see memory: stem / bowl / pixel geometry, u = 10)
const mark = (stem = '#fff') => `<svg viewBox="0 0 26.4 30" aria-hidden="true"><rect width="10" height="30" rx="2.4" fill="${stem}"/><path d="M13.8 0H18.2A8.2 8.2 0 0 1 18.2 16.4H13.8A2.4 2.4 0 0 1 11.4 14V2.4A2.4 2.4 0 0 1 13.8 0Z" fill="#00B3A6"/><rect x="11.4" y="17.8" width="6.6" height="6.6" rx="2" fill="#FF6B5E"/></svg>`;
const logo = (x, y, theme) => `<div class="logo" style="left:${x}px;top:${y}px">${mark(theme === 'light' ? '#0B1F3A' : '#fff')}<b>Portside <i>Digital</i></b></div>`;
const laptop = (x, y, w, inner) => `<div class="laptop" style="left:${x}px;top:${y}px;width:${w}px"><div class="scr"><div class="vp">${inner}</div></div><div class="base"></div></div>`;
const phone = (x, y, w, src) => `<div class="phone" style="left:${x}px;top:${y}px;width:${w}px"><div class="vp"><img src="${src}"></div></div>`;
const img = src => `<img src="${src}">`;
const wire = `<div class="wire"><div class="nav"><i style="width:18%;background:#0B1F3A"></i><span style="display:flex;gap:14px;width:40%"><i style="flex:1"></i><i style="flex:1"></i><i style="flex:1"></i></span></div><div class="hero"><div class="t"><b>Your<br>business<br><em>here.</em></b><i style="width:90%"></i><i style="width:70%"></i><div class="btn"></div></div><div class="ph"></div></div><div class="cards"><i></i><i></i><i></i></div></div>`;
const glow = (x, y, s, c) => `<div class="glow" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${c}"></div>`;
const searchIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>`;

const SQ = { w: 1080, h: 1080 }, ST = { w: 1080, h: 1920 };
const ads = [
  // ---------- 4 squares ----------
  { id: 'sq1-look-premium', ...SQ, theme: 'dark', body: `
    ${glow(620, -120, 520, '#00B3A6')}${logo(56, 56)}
    <h1 class="h" style="left:56px;top:140px;--hs:86px">Look premium.<br><em>Get booked.</em></h1>
    ${laptop(84, 380, 760, img(shot(AURA, 'desktop-hero')))}
    ${phone(800, 440, 236, shot(AURA, 'mobile-hero'))}
    <div class="tag" style="left:56px;top:968px">Bridal hair art · Built by Portside</div>` },
  { id: 'sq2-open-24-7', ...SQ, theme: 'light', body: `
    ${glow(-160, 520, 520, '#00B3A6')}${logo(56, 56, 'light')}
    <h1 class="h" style="left:56px;top:140px;--hs:86px">Your shop,<br>open <em>24/7.</em></h1>
    ${laptop(240, 380, 760, img(shot(BOW, 'desktop-hero')))}
    ${phone(56, 450, 240, shot(BOW, 'mobile-hero'))}
    <div class="tag" style="left:440px;top:968px">Concept build · Accessories</div>` },
  { id: 'sq3-no-website', ...SQ, theme: 'dark', body: `
    ${glow(-120, 600, 560, '#FF6B5E')}${logo(56, 56)}
    <h1 class="h" style="left:56px;top:140px;--hs:96px">No website?<br><span class="co">Invisible.</span></h1>
    ${laptop(240, 400, 760, img(shot(AURA, 'desktop-commission')))}
    ${phone(56, 470, 230, shot(BOW, 'mobile-hero'))}
    <div class="tag" style="left:620px;top:968px">Get found. Get inquiries.</div>` },
  { id: 'sq4-free-mockup', ...SQ, theme: 'dark', body: `
    ${glow(600, 420, 560, '#00B3A6')}${logo(56, 56)}
    <h1 class="h" style="left:56px;top:140px;--hs:86px">Your homepage.<br><em>Mocked up free.</em></h1>
    ${laptop(84, 390, 760, wire)}
    ${phone(800, 450, 236, shot(AURA, 'mobile-hero'))}
    <div class="cta" style="left:56px;top:950px">Claim your free mockup</div>` },

  // ---------- carousel (4 cards) ----------
  { id: 'car1-hook', ...SQ, theme: 'dark', body: `
    ${glow(560, -160, 560, '#00B3A6')}${logo(56, 56)}
    <h1 class="h" style="left:56px;top:140px;--hs:86px">Customers are<br><em>searching.</em></h1>
    <div class="search" style="left:90px;top:410px;width:900px">
      <div class="bar">${searchIcon}custom hair bows trinidad</div>
      <div class="res">
        <div class="r"><b>Their Boutique · Custom Bows</b></div>
        <div class="r"><b>Another Studio · Bridal Pieces</b></div>
        <div class="r you"><u>your business</u><b>No website found.</b><span>Swipe to see yours →</span></div>
      </div>
    </div>` },
  { id: 'car2-aura', ...SQ, theme: 'dark', body: `
    ${glow(500, 300, 640, '#00B3A6')}${logo(56, 56)}
    <div class="label" style="left:56px;top:150px"><small>Industry · Bridal hair art</small><strong>Aura Atelier</strong></div>
    ${laptop(84, 300, 780, img(shot(AURA, 'desktop-hero')))}
    ${phone(800, 400, 230, shot(AURA, 'mobile-hero'))}
    <div class="tag" style="left:56px;top:968px">Demo build · werty573.github.io/demo</div>` },
  { id: 'car3-ribbon', ...SQ, theme: 'light', body: `
    ${glow(-100, 300, 600, '#00B3A6')}${logo(56, 56, 'light')}
    <div class="label" style="left:56px;top:150px"><small>Industry · Handmade accessories</small><strong>Ribbon &amp; Rose</strong></div>
    ${laptop(216, 300, 780, img(shot(BOW, 'desktop-hero')))}
    ${phone(56, 400, 230, shot(BOW, 'mobile-hero'))}
    <div class="tag" style="left:440px;top:968px">Concept build · Custom order form</div>` },
  { id: 'car4-your-business', ...SQ, theme: 'dark', body: `
    ${glow(560, 300, 600, '#00B3A6')}${logo(56, 56)}
    <h1 class="h" style="left:56px;top:150px;--hs:104px">Your<br>business<br><span class="co">next?</span></h1>
    ${laptop(470, 420, 560, wire)}
    <div class="cta" style="left:56px;top:810px">Message us on WhatsApp</div>
    <div class="price" style="left:58px;top:930px">From <b>$1,500 TTD</b> · Live in 7 days</div>` },

  // ---------- 2 stories / reels (keep text out of top 270px and bottom 380px) ----------
  { id: 'story1-aura', ...ST, theme: 'dark', body: `
    ${glow(500, 500, 700, '#00B3A6')}${logo(64, 290)}
    <h1 class="h" style="left:64px;top:390px;--hs:92px">Your site could<br><em>look this good.</em></h1>
    ${laptop(100, 680, 840, img(shot(AURA, 'desktop-hero')))}
    ${phone(700, 900, 320, shot(AURA, 'mobile-hero'))}
    <div class="cta" style="left:64px;top:1330px">Get a free mockup</div>
    <div class="price" style="left:66px;top:1440px">From <b>$1,500 TTD</b> · Live in 7 days</div>` },
  { id: 'story2-ribbon', ...ST, theme: 'light', body: `
    ${glow(-200, 600, 700, '#00B3A6')}${logo(64, 290, 'light')}
    <h1 class="h" style="left:64px;top:390px;--hs:86px">Websites for<br>T&amp;T small<br><em>businesses.</em></h1>
    ${laptop(150, 760, 840, img(shot(BOW, 'desktop-hero')))}
    ${phone(64, 960, 300, shot(BOW, 'mobile-hero'))}
    <div class="cta" style="left:420px;top:1360px">Chat on WhatsApp</div>
    <div class="price" style="left:422px;top:1470px;color:var(--navy)">From <b>$1,500 TTD</b> · Live in 7 days</div>` },
];

const page = a => `<!doctype html><html><head><meta charset="utf-8"><title>${a.id}</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../ads.css"></head>
<body class="${a.theme}" style="--w:${a.w}px;--h:${a.h}px">${a.body}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const coverage = {};
  for (const a of ads) {
    const file = path.join(HTML, `${a.id}.html`);
    fs.writeFileSync(file, page(a));
    const p = await browser.newPage({ viewport: { width: a.w, height: a.h } });
    await p.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
    // text coverage: union of text-line boxes on a 20px grid (approximates Meta's old text-overlay grid)
    coverage[a.id] = await p.evaluate(() => {
      const W = innerWidth, H = innerHeight, cell = 20, cols = Math.ceil(W / cell), grid = new Uint8Array(cols * Math.ceil(H / cell));
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) {
        if (!n.textContent.trim()) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        for (const b of r.getClientRects())
          for (let y = Math.max(0, Math.floor(b.top / cell)); y < Math.min(H, b.bottom) / cell; y++)
            for (let x = Math.max(0, Math.floor(b.left / cell)); x < Math.min(W, b.right) / cell; x++) grid[y * cols + x] = 1;
      }
      return +(grid.reduce((s, v) => s + v, 0) / grid.length * 100).toFixed(1);
    });
    await p.screenshot({ path: path.join(FINAL, `${a.id}.png`) });
    await p.close();
    console.log(a.id.padEnd(22), `${a.w}x${a.h}`, `text ${coverage[a.id]}%`);
  }
  fs.writeFileSync(path.join(__dirname, 'text-coverage.json'), JSON.stringify(coverage, null, 2));
  await browser.close();
})();
