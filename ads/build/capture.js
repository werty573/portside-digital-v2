// Captures hero + section screenshots and a smooth-scroll recording of each portfolio site.
// Run: NODE_PATH=<dir with playwright installed> node capture.js [site-name]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const OUT = path.resolve(__dirname, '../screenshots');
const SITES = {
  // Bow Expressions tt is a real company and must not be named in ads: its build is shown as the fictional "Ribbon & Rose" concept.
  'ribbon-and-rose': { url: 'https://werty573.github.io/bowexpressionstt/', sections: { about: '#about', gallery: '#gallery', inquiry: '#inquiry' }, rebrand: true },
  'aura-atelier': { url: 'https://werty573.github.io/demo/', sections: { craft: '#brand', showroom: '#showroom', commission: '#commission' } },
};

// Swap the real business name for the fictional concept name everywhere on the page.
const REBRAND = () => {
  document.querySelectorAll('.logo').forEach(l => { l.innerHTML = 'Ribbon <span>&amp; Rose</span>'; });
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) n.textContent = n.textContent.replace(/Bow Expressions( tt)?/g, 'Ribbon & Rose').replace(/bowexpressionstt/g, 'ribbonandrose');
  document.title = document.title.replace(/Bow Expressions tt/g, 'Ribbon & Rose');
};
exports.REBRAND = REBRAND;

async function settle(page) {
  // walk the page so lazy images load, then wait for every image + webfont
  const H = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 500) { await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(100); }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(2500); // let hero intro animations finish
}

if (require.main === module) (async () => {
  const browser = await chromium.launch();
  for (const [name, site] of Object.entries(SITES)) {
    if (process.argv[2] && process.argv[2] !== name) continue;
    const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });

    for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: label === 'mobile', hasTouch: label === 'mobile' });
      const page = await ctx.newPage();
      await page.goto(site.url, { waitUntil: 'networkidle' });
      if (site.rebrand) await page.evaluate(REBRAND);
      await settle(page);
      await page.screenshot({ path: path.join(dir, `${label}-hero.png`) });
      if (label === 'desktop') {
        for (const [sec, sel] of Object.entries(site.sections)) {
          await page.$eval(sel, el => el.scrollIntoView({ block: 'start' }));
          await page.waitForTimeout(1500); // reveal-on-scroll transitions
          await page.screenshot({ path: path.join(dir, `desktop-${sec}.png`) });
        }
      }
      await ctx.close();
    }

    // ~14s eased smooth-scroll recording at 1440x900
    const vctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
    const vp = await vctx.newPage();
    await vp.goto(site.url, { waitUntil: 'networkidle' });
    if (site.rebrand) await vp.evaluate(REBRAND);
    await settle(vp);
    await vp.evaluate(() => new Promise(done => {
      const max = document.body.scrollHeight - innerHeight, dur = 12000, t0 = performance.now();
      const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      (function step(now) { const t = Math.min(1, (now - t0) / dur); scrollTo(0, ease(t) * max); t < 1 ? requestAnimationFrame(step) : setTimeout(done, 1200); })(t0);
    }));
    const video = vp.video(); await vctx.close();
    // keep only the scroll itself (12s glide + 1.2s hold), dropping the load/settle frames
    const raw = await video.path();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-13.4', '-i', raw, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', path.join(dir, 'scroll.mp4')]);
    fs.unlinkSync(raw);
  }
  await browser.close();
})();
