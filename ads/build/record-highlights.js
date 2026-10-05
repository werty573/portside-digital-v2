// Records a short "highlights" clip of the Ribbon & Rose concept (live Bow Expressions tt build, renamed) for the video ad: slow drift on the hero,
// then a cut to the custom-order form. Skips the About section (it still shows "[Founder's story placeholder]").
// Run: NODE_PATH=<dir with playwright installed> node record-highlights.js
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const { REBRAND } = require('./capture');
const dir = path.resolve(__dirname, '../screenshots/ribbon-and-rose');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
  const p = await ctx.newPage();
  await p.goto('https://werty573.github.io/bowexpressionstt/', { waitUntil: 'networkidle' });
  await p.evaluate(REBRAND);
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  const glide = (from, to, dur) => p.evaluate(([from, to, dur]) => new Promise(done => {
    const s = performance.now(), e = t => 1 - Math.pow(1 - t, 3);
    (function f(n) { const t = Math.min(1, (n - s) / dur); scrollTo(0, from + (to - from) * e(t)); t < 1 ? requestAnimationFrame(f) : done(); })(s);
  }), [from, to, dur]);
  const start = Date.now();
  await p.waitForTimeout(400);
  await glide(0, 140, 2600);
  const formTop = await p.$eval('#inquiry', el => el.getBoundingClientRect().top + scrollY);
  await p.evaluate(y => scrollTo(0, y), formTop - 200);
  await p.waitForTimeout(700); // reveal animation
  await glide(formTop - 200, formTop - 40, 3400); // stop before the footer (placeholder phone numbers)
  await p.waitForTimeout(500);
  const recorded = (Date.now() - start) / 1000;
  const v = p.video(); await ctx.close(); await browser.close();
  const raw = await v.path(), out = path.join(dir, 'highlights.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', `-${recorded.toFixed(2)}`, '-i', raw, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', out]);
  fs.unlinkSync(raw);
  console.log('wrote', out, recorded.toFixed(1) + 's');
})();
