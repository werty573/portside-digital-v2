// One 16s 1080x1920 video ad per concept site in ../../../demos/<slug>.
// 1. Records the site frame by frame with Playwright's fake clock, so GSAP intro and scroll
//    animations advance exactly 1/30s per frame (smooth, never sped up or dropped).
// 2. Renders the background, hook, label and end-card layers as PNGs.
// 3. Composites them with ffmpeg: 0-2.8s hook, 2.8-12.5s site label, 12.5-16s end card.
// Run: NODE_PATH=<dir with playwright installed> node demo-videos.js [slug ...]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const DEMOS = path.resolve(__dirname, '../../../demos');
const CLIPS = path.resolve(__dirname, '../screenshots/demos'), OUT = path.resolve(__dirname, '../final');
const FPS = 30, CLIP = 12.5, END = 16, HOOK = 2.8;
const W = 1080, H = 1920, VX = 40, VY = 640, VW = 1000, VH = 625;

const SITES = {
  'tamarind-table': { hook: ['Your food is the best in town.', 'Does your website say so?'], kind: 'Restaurant and bar', name: 'Tamarind Table', line: ['Menu, story and bookings', 'in one scroll.'], stop: '#reserve' },
  'gloss-lab': { hook: ['Your work shines.', 'Does your website?'], kind: 'Car detailing', name: 'Gloss Lab', line: ['Before and after', 'that sells the job.'], stop: '#book' },
  'gilded-hour': { hook: ['Couples judge you online first.', 'Make it beautiful.'], kind: 'Weddings and events', name: 'Gilded Hour', line: ['Inquiries that arrive', 'ready to book.'], stop: '#inquire' },
  'pulse-yard': { hook: ['New members check your gym at 11pm.', 'Is your site open?'], kind: 'Gym and fitness', name: 'Pulse Yard', line: ['Classes, prices and', 'free-week sign-ups.'], stop: '#free-week' },
  'leeward-house': { hook: ['Tired of paying booking fees?', 'Take bookings direct.'], kind: 'Villa rental', name: 'Leeward House', line: ['Live availability', 'and pricing.'], stop: '#book' },
};

const inOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function recordClip(browser, slug, stopSel, out) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const t0 = Date.now() + 60000;
  await page.clock.install({ time: t0 - 1000 });
  await page.clock.pauseAt(t0);
  await page.goto('file:///' + path.join(DEMOS, slug, 'index.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // lazy images below the fold: load them all up front so nothing pops in mid-scroll
    document.querySelectorAll('img[loading=lazy]').forEach(i => (i.loading = 'eager'));
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  });
  await page.clock.runFor(50);
  const stop = await page.evaluate(sel => Math.max(0, document.querySelector(sel).getBoundingClientRect().top + scrollY - 40), stopSel);
  // 1.6s for the intro animation, 10.1s scroll to the booking section, 0.8s settle on it
  const frames = [], n = Math.round(CLIP * FPS), hold = Math.round(1.6 * FPS), tail = Math.round(.8 * FPS);
  for (let i = 0; i < n; i++) frames.push(i < hold ? 0 : i >= n - tail ? stop : stop * inOut((i - hold) / (n - hold - tail - 1)));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), slug + '-'));
  for (let i = 0; i < n; i++) {
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), Math.round(frames[i]));
    await page.clock.runFor(1000 / FPS);
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 90 });
  }
  await page.close();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg'), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  fs.rmSync(dir, { recursive: true, force: true });
}

const mark = `<svg viewBox="0 0 26.4 30" style="height:var(--m,44px)"><rect width="10" height="30" rx="2.4" fill="#fff"/><path d="M13.8 0H18.2A8.2 8.2 0 0 1 18.2 16.4H13.8A2.4 2.4 0 0 1 11.4 14V2.4A2.4 2.4 0 0 1 13.8 0Z" fill="#00B3A6"/><rect x="11.4" y="17.8" width="6.6" height="6.6" rx="2" fill="#FF6B5E"/></svg>`;
const logo = (x, y, m = 44, f = 30) => `<div class="logo" style="left:${x}px;top:${y}px;--m:${m}px">${mark}<b style="font-size:${f}px">Portside <i>Digital</i></b></div>`;
const CSS = `<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@600;700&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden;font-family:Inter,sans-serif;color:#fff}
.logo{position:absolute;display:flex;align-items:center;gap:14px}.logo b{font:800 30px/1 Sora;letter-spacing:-.04em}.logo i{font-style:normal;color:#00B3A6}
.h{position:absolute;left:60px;right:60px;font:800 84px/1.02 Sora;letter-spacing:-.045em;text-wrap:balance}.h em{font-style:normal;color:#00B3A6}.co{color:#FF6B5E}
.k{font:700 22px/1 Inter;letter-spacing:.16em;text-transform:uppercase;color:#00B3A6;margin-bottom:16px}
.pill{position:absolute;display:inline-flex;align-items:center;background:#FF6B5E;color:#0B1F3A;font:800 40px/1 Sora;letter-spacing:-.02em;padding:30px 44px;border-radius:999px;box-shadow:0 18px 44px rgb(255 107 94/.4)}
.chip{position:absolute;font:700 24px/1 Inter;letter-spacing:.1em;text-transform:uppercase;padding:16px 24px;border-radius:999px;background:rgb(255 255 255/.1);border:1px solid rgb(255 255 255/.2)}
.bg{position:absolute;inset:0;background:radial-gradient(100% 60% at 85% 20%,#17396A 0%,#0B1F3A 55%,#071528 100%)}
.bg::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgb(255 255 255/.04) 1px,transparent 1px),linear-gradient(90deg,rgb(255 255 255/.04) 1px,transparent 1px);background-size:54px 54px}
.glow{position:absolute;border-radius:50%;filter:blur(110px);opacity:.45}
.win{position:absolute;left:${VX - 12}px;top:${VY - 56}px;width:${VW + 24}px;height:${VH + 68}px;border-radius:26px;background:#10141c;box-shadow:0 50px 90px rgb(0 0 0/.55),0 0 0 1px rgb(255 255 255/.08)}
.win i{position:absolute;top:22px;width:14px;height:14px;border-radius:50%}
.win u{position:absolute;top:14px;left:120px;right:120px;height:30px;border-radius:9px;background:#1d2330;text-decoration:none;font:600 16px/30px Inter;color:#c9d0dc;text-align:center}
</style>`;

const layers = (slug, s) => ({
  bg: `<div class="bg"></div><div class="glow" style="left:560px;top:380px;width:640px;height:640px;background:#00B3A6"></div>
       <div class="win"><i style="left:22px;background:#FF6B5E"></i><i style="left:46px;background:#F5C04A"></i><i style="left:70px;background:#00B3A6"></i><u>werty573.github.io/${slug}</u></div>`,
  hook: `${logo(60, 300)}<h1 class="h" style="top:380px">${s.hook[0]}</h1><h2 class="h co" style="top:1340px;font-size:76px">${s.hook[1]}</h2>`,
  label: `${logo(60, 300)}<div class="h" style="top:390px"><div class="k">${s.kind} · concept build</div>${s.name}</div>
          <h2 class="h" style="top:1340px;font-size:64px">${s.line[0]}<br><em>${s.line[1]}</em></h2>`,
  end: `<div class="bg"></div><div class="glow" style="left:400px;top:300px;width:700px;height:700px;background:#00B3A6"></div>
        ${logo(60, 340, 64, 44)}<h1 class="h" style="top:470px;font-size:120px">Your<br>business<br><span class="co">next?</span></h1>
        <div class="chip" style="left:60px;top:930px">Free homepage mockup</div>
        <div class="pill" style="left:60px;top:1040px">WhatsApp 868-259-1409</div>
        <div style="position:absolute;left:62px;top:1190px;font:700 34px/1.3 Inter">From <b style="color:#FF6B5E">$1,500 TTD</b> · Live in 7 days<br><span style="opacity:.75;font-size:28px">Websites for Trinidad &amp; Tobago small businesses</span></div>`,
});

(async () => {
  const only = process.argv.slice(2);
  const browser = await chromium.launch();
  for (const [slug, s] of Object.entries(SITES)) {
    if (only.length && !only.includes(slug)) continue;
    const clip = path.join(CLIPS, slug, 'reel.mp4');
    await recordClip(browser, slug, s.stop, clip);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-'));
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    for (const [name, body] of Object.entries(layers(slug, s))) {
      await page.setContent(`<!doctype html><html><head>${CSS}</head><body>${body}</body></html>`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(tmp, name + '.png'), omitBackground: true });
    }
    await page.close();

    const L = n => ['-loop', '1', '-framerate', String(FPS), '-t', String(END), '-i', path.join(tmp, n + '.png')];
    const fc = [
      `[1:v]setpts=PTS-STARTPTS,scale=${VW}:${VH}:flags=lanczos[v]`,
      `[0:v][v]overlay=${VX}:${VY}:eof_action=pass[s1]`,
      `[2:v]format=rgba,fade=in:st=0.15:d=0.35:alpha=1,fade=out:st=${HOOK - .25}:d=0.25:alpha=1[th]`,
      `[3:v]format=rgba,fade=in:st=${HOOK}:d=0.35:alpha=1,fade=out:st=${CLIP - .3}:d=0.3:alpha=1[tl]`,
      `[4:v]format=rgba,fade=in:st=${CLIP}:d=0.4:alpha=1[te]`,
      `[s1][th]overlay=0:0[s2]`, `[s2][tl]overlay=0:0[s3]`, `[s3][te]overlay=0:0:enable='gte(t,${CLIP})',format=yuv420p[out]`,
    ].join(';');
    const out = path.join(OUT, `demo-${slug}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...L('bg'), '-i', clip, ...L('hook'), ...L('label'), ...L('end'),
      '-f', 'lavfi', '-t', String(END), '-i', 'anullsrc=r=48000:cl=stereo',
      '-filter_complex', fc, '-map', '[out]', '-map', '5:a', '-t', String(END), '-r', String(FPS),
      '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('wrote', out);
  }
  await browser.close();
})();
