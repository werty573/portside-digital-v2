// 19s 1080x1920 video ad: renders the background + text overlays as PNGs with Playwright,
// then composites them over the frame-exact reel clips from capture.js (9.5s Aura, 6s Ribbon & Rose) with ffmpeg.
// Key content stays inside the centre 1080x1350 band so the 4:5 feed crop keeps it.
// Run: NODE_PATH=<dir with playwright installed> node video.js
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const TMP = path.join(__dirname, 'video-layers'); fs.mkdirSync(TMP, { recursive: true });
const SHOTS = path.resolve(__dirname, '../screenshots'), OUT = path.resolve(__dirname, '../final/video-portside-19s.mp4');
const W = 1080, H = 1920, VX = 40, VY = 640, VW = 1000, VH = 625; // browser-window viewport for the recordings

const mark = `<svg viewBox="0 0 26.4 30" style="height:var(--m,44px)"><rect width="10" height="30" rx="2.4" fill="#fff"/><path d="M13.8 0H18.2A8.2 8.2 0 0 1 18.2 16.4H13.8A2.4 2.4 0 0 1 11.4 14V2.4A2.4 2.4 0 0 1 13.8 0Z" fill="#00B3A6"/><rect x="11.4" y="17.8" width="6.6" height="6.6" rx="2" fill="#FF6B5E"/></svg>`;
const logo = (x, y, m = 44, fs = 30) => `<div class="logo" style="left:${x}px;top:${y}px;--m:${m}px">${mark}<b style="font-size:${fs}px">Portside <i>Digital</i></b></div>`;
const css = `<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@600;700&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden;font-family:Inter,sans-serif;color:#fff}
.logo{position:absolute;display:flex;align-items:center;gap:14px}.logo b{font:800 30px/1 Sora;letter-spacing:-.04em}.logo i{font-style:normal;color:#00B3A6}
.h{position:absolute;left:60px;right:60px;font:800 92px/1.02 Sora;letter-spacing:-.045em}.h em{font-style:normal;color:#00B3A6}.h .co{color:#FF6B5E}
.k{font:700 22px/1 Inter;letter-spacing:.16em;text-transform:uppercase;color:#00B3A6;margin-bottom:16px}
.pill{position:absolute;display:inline-flex;gap:12px;align-items:center;background:#FF6B5E;color:#0B1F3A;font:800 40px/1 Sora;letter-spacing:-.02em;padding:30px 44px;border-radius:999px;box-shadow:0 18px 44px rgb(255 107 94/.4)}
.chip{position:absolute;font:700 24px/1 Inter;letter-spacing:.1em;text-transform:uppercase;padding:16px 24px;border-radius:999px;background:rgb(255 255 255/.1);border:1px solid rgb(255 255 255/.2)}
.bg{position:absolute;inset:0;background:radial-gradient(100% 60% at 85% 20%,#17396A 0%,#0B1F3A 55%,#071528 100%)}
.bg::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgb(255 255 255/.04) 1px,transparent 1px),linear-gradient(90deg,rgb(255 255 255/.04) 1px,transparent 1px);background-size:54px 54px}
.glow{position:absolute;border-radius:50%;filter:blur(110px);opacity:.45}
.win{position:absolute;left:${VX - 12}px;top:${VY - 56}px;width:${VW + 24}px;height:${VH + 68}px;border-radius:26px;background:#10141c;box-shadow:0 50px 90px rgb(0 0 0/.55),0 0 0 1px rgb(255 255 255/.08)}
.win i{position:absolute;top:22px;width:14px;height:14px;border-radius:50%}
.win u{position:absolute;top:14px;left:120px;right:120px;height:30px;border-radius:9px;background:#1d2330;text-decoration:none;font:600 16px/30px Inter;color:#8b94a7;text-align:center}
</style>`;

const layers = {
  // opaque background with the browser window the recordings sit in
  bg: `<div class="bg"></div><div class="glow" style="left:560px;top:380px;width:640px;height:640px;background:#00B3A6"></div>
       <div class="win"><i style="left:22px;background:#FF6B5E"></i><i style="left:46px;background:#F5C04A"></i><i style="left:70px;background:#00B3A6"></i><u></u></div>`,
  urlAura: `<div style="position:absolute;left:${VX + 108}px;top:${VY - 42}px;width:${VW - 216}px;font:600 16px/30px Inter;color:#c9d0dc;text-align:center">werty573.github.io/demo</div>`,
  urlBow: `<div style="position:absolute;left:${VX + 108}px;top:${VY - 42}px;width:${VW - 216}px;font:600 16px/30px Inter;color:#c9d0dc;text-align:center">Concept build · Portside Digital</div>`,
  // 0–3s hook
  hook: `${logo(60, 300)}<h1 class="h" style="top:380px;font-size:84px">Customers are<br><em>searching for you.</em></h1>
         <h2 class="h co" style="top:1340px;font-size:76px">What do<br>they find?</h2>`,
  aura: `${logo(60, 300)}<div class="h" style="top:390px"><div class="k">Bridal hair art</div>Aura Atelier</div>
         <h2 class="h" style="top:1340px;font-size:64px">Premium look.<br><em>Mobile-first.</em></h2>`,
  bow: `${logo(60, 300)}<div class="h" style="top:390px"><div class="k">Handmade accessories · concept build</div>Ribbon &amp; Rose</div>
        <h2 class="h" style="top:1340px;font-size:64px">Custom order form<br><em>built right in.</em></h2>`,
  end: `<div class="bg"></div><div class="glow" style="left:400px;top:300px;width:700px;height:700px;background:#00B3A6"></div>
        ${logo(60, 340, 64, 44)}
        <h1 class="h" style="top:470px;font-size:120px">Your<br>business<br><span class="co">next?</span></h1>
        <div class="chip" style="left:60px;top:930px">Free homepage mockup</div>
        <div class="pill" style="left:60px;top:1040px">WhatsApp 868-259-1409</div>
        <div style="position:absolute;left:62px;top:1190px;font:700 34px/1.3 Inter">From <b style="color:#FF6B5E">$1,500 TTD</b> · Live in 7 days<br><span style="opacity:.75;font-size:28px">Websites for Trinidad &amp; Tobago small businesses</span></div>`,
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const [name, body] of Object.entries(layers)) {
    await page.setContent(`<!doctype html><html><head>${css}</head><body>${body}</body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(TMP, `${name}.png`), omitBackground: true });
  }
  await browser.close();

  const L = n => path.join(TMP, `${n}.png`);
  const aura = path.join(SHOTS, 'aura-atelier', 'reel.mp4'), bow = path.join(SHOTS, 'ribbon-and-rose', 'reel.mp4');
  // timeline: 0–3 hook (Aura hero) · 3–9.5 Aura · 9.5–15.5 Ribbon & Rose concept · 15.5–19 end card
  const fc = [
    `[1:v]setpts=PTS-STARTPTS,scale=${VW}:${VH}:flags=lanczos[va]`,
    `[2:v]setpts=PTS-STARTPTS+9.5/TB,scale=${VW}:${VH}:flags=lanczos[vb]`,
    `[0:v][va]overlay=${VX}:${VY}:enable='lt(t,9.5)'[s1]`,
    `[s1][vb]overlay=${VX}:${VY}:eof_action=pass:enable='gte(t,9.5)'[s2]`,
    `[3:v]format=rgba[ua]`, `[4:v]format=rgba[ub]`,
    `[s2][ua]overlay=0:0:enable='lt(t,9.5)'[s3]`, `[s3][ub]overlay=0:0:enable='gte(t,9.5)'[s4]`,
    `[5:v]format=rgba,fade=in:st=0.15:d=0.35:alpha=1,fade=out:st=2.75:d=0.25:alpha=1[th]`,
    `[6:v]format=rgba,fade=in:st=3.0:d=0.35:alpha=1,fade=out:st=9.2:d=0.3:alpha=1[ta]`,
    `[7:v]format=rgba,fade=in:st=9.5:d=0.35:alpha=1,fade=out:st=15.2:d=0.3:alpha=1[tb]`,
    `[8:v]format=rgba,fade=in:st=15.5:d=0.4:alpha=1[te]`,
    `[s4][th]overlay=0:0[s5]`, `[s5][ta]overlay=0:0[s6]`, `[s6][tb]overlay=0:0[s7]`,
    `[s7][te]overlay=0:0:enable='gte(t,15.5)',format=yuv420p[out]`,
  ].join(';');
  const still = (n, t = 19) => ['-loop', '1', '-framerate', '30', '-t', String(t), '-i', L(n)];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
    ...still('bg'), '-i', aura, '-i', bow, ...still('urlAura'), ...still('urlBow'),
    ...still('hook'), ...still('aura'), ...still('bow'), ...still('end'),
    '-f', 'lavfi', '-t', '19', '-i', 'anullsrc=r=48000:cl=stereo',
    '-filter_complex', fc, '-map', '[out]', '-map', '9:a',
    '-t', '19', '-r', '30', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  console.log('wrote', OUT);
})();
