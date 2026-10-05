// Frame-exact scroll capture: positions the page for every frame, screenshots it, and joins the
// frames at a fixed fps with ffmpeg. Unlike recordVideo this never drops frames, so the scroll is smooth.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const EASE = {
  inOut: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  linear: t => t,
};

// segments: [{ from, to, dur (s), ease? }] played back to back; a segment whose `from` differs
// from the previous `to` is a hard cut. Returns the y position for every frame.
function positions(segments, fps) {
  const ys = [];
  for (const s of segments) {
    const n = Math.round(s.dur * fps), e = EASE[s.ease || 'inOut'];
    for (let i = 0; i < n; i++) ys.push(s.from + (s.to - s.from) * e(n > 1 ? i / (n - 1) : 1));
  }
  return ys;
}

async function recordScroll(page, segments, out, { fps = 30 } = {}) {
  // the sites use `scroll-behavior: smooth`, which would animate every scrollTo and cause judder
  await page.addStyleTag({ content: 'html,body{scroll-behavior:auto!important}' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
  const ys = positions(segments, fps);
  for (let i = 0; i < ys.length; i++) {
    await page.evaluate(y => new Promise(r => { scrollTo({ top: y, behavior: 'instant' }); requestAnimationFrame(() => requestAnimationFrame(r)); }), Math.round(ys[i]));
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%05d.jpg'),
    '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  return ys.length / fps;
}

module.exports = { recordScroll };
