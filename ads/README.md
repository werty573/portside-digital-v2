# Portside Digital: Facebook ad set

Open **`index.html`** to see every creative next to its copy. It needs a local server, e.g. `npx http-server ads`.

| Path | What |
|---|---|
| `final/` | Upload-ready creatives: 4 squares, 4 carousel cards, 2 stories, 1 × 19s video |
| `AD_COPY.md` | A (pain) / B (proof) / C (free offer) copy for each creative |
| `CAMPAIGN_PLAN.md` | Objective, targeting, budget, Instant Form questions, KPIs |
| `screenshots/` | Playwright captures of the portfolio sites (hero, sections, scroll recordings) |
| `build/` | Scripts + HTML/CSS sources that produce everything above |

The accessories site is shown as the fictional **"Ribbon & Rose"** concept build. Don't name the real business in ads.

## Rebuild

```bash
npm i playwright && npx playwright install chromium   # once, anywhere; point NODE_PATH at that node_modules
cd ads/build
node capture.js            # screenshots + frame-exact scroll recordings (scroll.mp4, reel.mp4)

node render.js             # HTML ads -> final/*.png (+ text-coverage.json)
node video.js              # final/video-portside-19s.mp4 (needs ffmpeg)
node pages.js              # AD_COPY.md + index.html from copy.json, validates copy limits
```
