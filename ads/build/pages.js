// Generates ads/AD_COPY.md and ads/index.html (preview gallery) from build/copy.json,
// and checks every version against the copy rules (words, emojis, headline/description length).
// Run: node pages.js
const fs = require('fs'), path = require('path');
const ADS = path.resolve(__dirname, '..');
const { details: D, creatives } = JSON.parse(fs.readFileSync(path.join(__dirname, 'copy.json'), 'utf8'));
const coverage = JSON.parse(fs.readFileSync(path.join(__dirname, 'text-coverage.json'), 'utf8'));
const ANGLE = { A: 'Pain point', B: 'Proof', C: 'Free offer' };
const EMOJI = /\p{Extended_Pictographic}/gu;

const stats = v => ({ words: v.primary.trim().split(/\s+/).length, emojis: (v.primary.match(EMOJI) || []).length, h: v.headline.length, d: v.description.length });
const ok = s => s.words < 125 && s.emojis >= 1 && s.emojis <= 2 && s.h <= 40 && s.d <= 30;
let failures = 0;
for (const c of creatives) for (const [k, v] of Object.entries(c.versions)) if (!ok(stats(v))) { failures++; console.error('RULE FAIL', c.id, k, stats(v)); }

// ---------- AD_COPY.md ----------
let md = `# Portside Digital: Facebook / Instagram Ad Copy

Three versions per creative: **A = Pain point**, **B = Proof** (links to the live sites), **C = Free offer** (${D.offer.toLowerCase()}).
Each primary text stays under 125 words, opens with a hook in line 1, and uses 1–2 emojis. Headlines stay under 40 characters and descriptions under 30.

| Detail | Value |
|---|---|
| Service area | ${D.area} |
| Price | ${D.price} |
| Turnaround | ${D.turnaround} |
| WhatsApp | ${D.whatsapp} (${D.whatsappLink}) |
| Email | ${D.email} |
| Free offer | ${D.offer} |

> Run A, B and C as separate ads inside the same ad set so Meta can find the winner. Don't edit an ad once it's live, because editing resets learning. Duplicate it instead.

`;
for (const c of creatives) {
  md += `---\n\n## ${c.name}\n\n**Format:** ${c.format}  \n**File(s):** ${c.files.map(f => `\`${f}\``).join(', ')}\n\n`;
  if (c.cards) md += `**Card headlines / links:**\n\n| Card | Headline | Description | Link |\n|---|---|---|---|\n${c.cards.map((k, i) => `| ${i + 1} | ${k.headline} | ${k.description} | ${k.link} |`).join('\n')}\n\n`;
  for (const [k, v] of Object.entries(c.versions)) {
    const s = stats(v);
    md += `### Version ${k}: ${ANGLE[k]}\n\n**Primary text** _(${s.words} words, ${s.emojis} emoji)_\n\n${v.primary.split('\n').map(l => l ? `> ${l}` : '>').join('\n')}\n\n| Headline (${s.h}/40) | Description (${s.d}/30) | CTA button |\n|---|---|---|\n| ${v.headline} | ${v.description} | ${v.cta} |\n\n`;
  }
}
fs.writeFileSync(path.join(ADS, 'AD_COPY.md'), md);

// ---------- index.html ----------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const media = c => {
  const f = c.files;
  if (f[0].endsWith('.mp4')) return `<video src="${f[0]}" controls muted loop playsinline preload="metadata" class="tall"></video>`;
  if (f.length > 1) return `<div class="car">${f.map(x => `<img src="${x}" alt="" loading="lazy">`).join('')}</div>`;
  return `<img src="${f[0]}" alt="" loading="lazy" class="${c.format.includes('1920') ? 'tall' : ''}">`;
};
const cov = c => { const v = c.files.map(f => coverage[path.basename(f, '.png')]).filter(x => x != null); return v.length ? `Text cover ${Math.max(...v)}%` : 'Video'; };
const versionCard = (k, v) => {
  const s = stats(v);
  return `<article class="ver"><header><span class="badge b${k}">${k}</span><b>${ANGLE[k]}</b><button class="copy" data-copy="${esc(v.primary)}">Copy text</button></header>
  <p class="primary">${esc(v.primary).replace(/\n/g, '<br>')}</p>
  <div class="fbcard"><div><small>${esc(v.description)}</small><strong>${esc(v.headline)}</strong></div><span class="fbcta">${esc(v.cta)}</span></div>
  <p class="meta">${s.words} words · ${s.emojis} emoji · headline ${s.h}/40 · description ${s.d}/30</p></article>`;
};
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portside Ad Gallery</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--navy:#0B1F3A;--teal:#00B3A6;--teal-ink:#00897F;--coral:#FF6B5E;--paper:#F4F6FA;--line:#DDE3EC;--ink:#0B1F3A;--muted:#5B6B82;--card:#fff}
@media (prefers-color-scheme:dark){:root{--paper:#08162B;--line:#1E3352;--ink:#E8EEF7;--muted:#93A3BA;--card:#0F2340;--teal-ink:#2FD1C4}}
*{box-sizing:border-box;margin:0}body{background:var(--paper);color:var(--ink);font:15px/1.55 Inter,system-ui,sans-serif}
.top{background:var(--navy);color:#fff;padding:40px 16px 34px}.wrap{max-width:1240px;margin:0 auto;padding:0 16px}
.top .wrap{display:flex;flex-wrap:wrap;gap:24px;align-items:end;justify-content:space-between}
.logo{display:flex;align-items:center;gap:12px;font:800 22px/1 Sora;letter-spacing:-.04em}.logo svg{height:32px}.logo i{font-style:normal;color:var(--teal)}
h1{font:800 clamp(30px,5vw,48px)/1.05 Sora;letter-spacing:-.04em;margin-top:18px}h1 em{font-style:normal;color:var(--teal)}
.facts{display:flex;flex-wrap:wrap;gap:8px}.facts span{font-weight:600;font-size:13px;padding:8px 12px;border-radius:999px;background:rgb(255 255 255/.08);border:1px solid rgb(255 255 255/.15)}
nav.toc{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
nav.toc .wrap{display:flex;gap:6px;overflow-x:auto;padding-top:10px;padding-bottom:10px}nav.toc .wrap{scrollbar-width:none}nav.toc a{white-space:nowrap;font-weight:600;font-size:13px;color:var(--muted);text-decoration:none;padding:6px 12px;border-radius:999px}nav.toc a:hover{background:var(--card);color:var(--ink)}
section.ad{padding:48px 0;scroll-margin-top:56px;border-bottom:1px solid var(--line)}
.ad h2{font:800 26px/1.15 Sora;letter-spacing:-.03em}.ad .fmt{color:var(--muted);font-weight:500;margin:4px 0 22px}.ad .fmt b{color:var(--teal-ink)}
.grid{display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:28px;align-items:start}
.media{position:sticky;top:64px}.media img,.media video{width:100%;display:block;border-radius:14px;box-shadow:0 12px 30px rgb(11 31 58/.15);background:#000}
.media .tall{max-width:300px;margin:0 auto}
.car{display:grid;grid-template-columns:1fr 1fr;gap:10px}.car img{border-radius:10px;aspect-ratio:1;object-fit:cover}
.cards{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:6px;font-size:13px;color:var(--muted)}.cards b{color:var(--ink)}
.vers{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.ver{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:12px}
.ver header{display:flex;align-items:center;gap:10px}.ver header b{font:700 15px Sora;flex:1}
.badge{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font:800 14px Sora;color:var(--navy)}.bA{background:var(--coral)}.bB{background:var(--teal)}.bC{background:#F5C04A}
.copy{font:600 12px Inter;border:1px solid var(--line);background:none;color:var(--muted);border-radius:999px;padding:6px 10px;cursor:pointer;min-height:32px}.copy:hover{color:var(--ink);border-color:var(--ink)}
.primary{font-size:14px;flex:1}
.fbcard{display:flex;gap:10px;align-items:center;justify-content:space-between;background:var(--paper);border-radius:10px;padding:12px}
.fbcard small{display:block;color:var(--muted);font-size:12px}.fbcard strong{display:block;font-size:14px}
.fbcta{flex:none;font-weight:700;font-size:12px;background:var(--line);border-radius:8px;padding:8px 10px;color:var(--ink)}
.meta{font-size:12px;color:var(--muted)}
footer{padding:40px 16px;color:var(--muted);text-align:center;font-size:13px}
@media (max-width:820px){.grid{grid-template-columns:1fr}.media{position:static}}
</style></head><body>
<header class="top"><div class="wrap"><div><div class="logo"><svg viewBox="0 0 26.4 30"><rect width="10" height="30" rx="2.4" fill="#fff"/><path d="M13.8 0H18.2A8.2 8.2 0 0 1 18.2 16.4H13.8A2.4 2.4 0 0 1 11.4 14V2.4A2.4 2.4 0 0 1 13.8 0Z" fill="#00B3A6"/><rect x="11.4" y="17.8" width="6.6" height="6.6" rx="2" fill="#FF6B5E"/></svg>Portside <i>Digital</i></div>
<h1>Facebook ad set: <em>${creatives.length} creatives, ${creatives.length * 3} ads</em></h1></div>
<div class="facts"><span>${D.area}</span><span>${D.price}</span><span>Live in ${D.turnaround}</span><span>WhatsApp ${D.whatsapp}</span><span>${D.offer}</span></div></div></header>
<nav class="toc"><div class="wrap">${creatives.map(c => `<a href="#${c.id}">${esc(c.name.split(' — ')[0])}</a>`).join('')}<a href="CAMPAIGN_PLAN.md">Campaign plan</a></div></nav>
<main class="wrap">${creatives.map(c => `
<section class="ad" id="${c.id}"><h2>${esc(c.name)}</h2><p class="fmt">${esc(c.format)} · <b>${cov(c)}</b></p>
<div class="grid"><div class="media">${media(c)}${c.cards ? `<ol class="cards">${c.cards.map(k => `<li><b>${esc(k.headline)}</b> · ${esc(k.description)}</li>`).join('')}</ol>` : ''}</div>
<div class="vers">${Object.entries(c.versions).map(([k, v]) => versionCard(k, v)).join('')}</div></div></section>`).join('')}
</main>
<footer>Text cover = share of the canvas under text on a 20px grid (target under 20%). Generated from build/copy.json by build/pages.js.</footer>
<script>document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='Copied ✓'}catch{b.textContent='Select & copy'}setTimeout(()=>b.textContent='Copy text',1600)}))</script>
</body></html>`;
fs.writeFileSync(path.join(ADS, 'index.html'), html);
console.log(`AD_COPY.md + index.html written · ${creatives.length} creatives · ${failures} rule failures`);
if (failures) process.exitCode = 1;
