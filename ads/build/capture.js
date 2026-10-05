// Captures hero + section screenshots and a smooth-scroll recording of each portfolio site.
// Run: NODE_PATH=<dir with playwright installed> node capture.js [site-name]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { recordScroll } = require('./frames');
const OUT = path.resolve(__dirname, '../screenshots');
const SITES = {
  // Bow Expressions tt is a real company and must not be named in ads: its build is shown as the fictional "Ribbon & Rose" concept.
  'ribbon-and-rose': { url: 'https://werty573.github.io/bowexpressionstt/', sections: { about: '#about', gallery: '#gallery', inquiry: '#inquiry' }, rebrand: true,
    // 6s for the video ad: drift on the hero, then cut to the custom-order form. Skips About (founder-story
    // placeholder) and stops before the footer (placeholder phone numbers).
    reel: async top => { const f = await top('#inquiry'); return [{ from: 0, to: 140, dur: 2.6, ease: 'out' }, { from: f - 200, to: f - 40, dur: 3.4, ease: 'out' }]; } },
  'aura-atelier': { url: 'https://werty573.github.io/demo/', sections: { craft: '#brand', showroom: '#showroom', commission: '#commission' },
    // 9.5s for the video ad: hold the hero, then glide down to the commission form
    reel: async top => [{ from: 0, to: 0, dur: 1.5 }, { from: 0, to: await top('#commission'), dur: 8 }] },
};

// Swap the real business name for the fictional concept name everywhere on the page.
const REBRAND = () => {
  document.querySelectorAll('.logo').forEach(l => { l.innerHTML = 'Ribbon <span>&amp; Rose</span>'; });
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) n.textContent = n.textContent.replace(/Bow Expressions( tt)?/g, 'Ribbon & Rose').replace(/bowexpressionstt/g, 'ribbonandrose');
  document.title = document.title.replace(/Bow Expressions tt/g, 'Ribbon & Rose');
};

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

(async () => {
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

    // frame-exact scroll recordings at 1440x900: the full-page scroll, plus the short reel clip for the video ad
    const vctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const vp = await vctx.newPage();
    await vp.goto(site.url, { waitUntil: 'networkidle' });
    if (site.rebrand) await vp.evaluate(REBRAND);
    await settle(vp);
    const max = await vp.evaluate(() => document.body.scrollHeight - innerHeight);
    await recordScroll(vp, [{ from: 0, to: 0, dur: 0.8 }, { from: 0, to: max, dur: 12 }, { from: max, to: max, dur: 1 }], path.join(dir, 'scroll.mp4'));
    const top = sel => vp.$eval(sel, el => Math.round(el.getBoundingClientRect().top + scrollY));
    await recordScroll(vp, await site.reel(top), path.join(dir, 'reel.mp4'));
    await vctx.close();
  }
  await browser.close();
})();
