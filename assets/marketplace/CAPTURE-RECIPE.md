# Marketplace asset capture recipe

Reproducible instructions for the visual assets needed when submitting `enuff-is-enuff-unsubscribe` to the Claude Code plugin marketplace. Some assets are captured headlessly from this repo (already shipped); others need a live Claude Code session to capture authentically.

## Already in this folder

| File | Size | Source | Use case |
|---|---|---|---|
| `../enuff-is-enuff.png` | 600×600 (341 KB) | Display logo | README, getting-started.html |
| `../enuff-is-enuff-512.png` | 512×512 (254 KB) | Marketplace icon | Plugin manifest icon |
| `../enuff-is-enuff-1024.png` | 1024×1024 (923 KB) | App-store-style icon | Apple-style listings, retina |
| `hero.png` | 3200×2000 @2x (~350 KB) | `report.html` after pre-approving 3 items | Hero card on the listing page |
| `report-full.png` | 2800×7200 @2x (~1.1 MB) | Full scrollable `report.html` | Gallery shot |
| `getting-started-hero.png` | 2560×1800 @2x (~250 KB) | Top of `getting-started.html` | Landing page preview |

## To capture: workflow screenshot

A real Claude Code session showing the brand-by-brand approval prompt. **Cannot be faked** — the marketplace expects an authentic screenshot of the actual product.

**Recipe:**

```bash
# 1. Fresh state, scan the sample inbox
cd /path/to/enuff-is-enuff-unsubscribe
rm -rf enuff-is-enuff-report
node bin/enuff_scan.mjs scan examples/sample-inbox

# 2. Open Claude Code in this directory (CLAUDE.md auto-loads)
claude
```

Then in the Claude Code session, type:
> walk me through the candidates

Wait for Claude to render the brand-by-brand table (it will list Ollama, Substack/Lenny's, Acmestore, Snackbox, Linear, Railway, etc. with their stream counts and unsub-header status). When the table is fully visible:

- **macOS**: `Shift + Cmd + 5` → "Capture Selected Window" → click the Terminal/iTerm window. Saves to Desktop.
- Recommended terminal: a clean iTerm or Terminal window, dark or light theme matching your taste, ~1280×800.

Save as `assets/marketplace/workflow-review.png`.

Best moment to capture: right after Claude posts the company table but before you respond — the prompt-table-prompt structure reads as "AI is helping me decide" which is the marketplace pitch.

## To capture: demo GIF (≤45s, ≤8 MB)

The full flow: paste path → ranking appears → review a few brands → confirm → act runs → summary. Loop.

Tools needed (none currently installed):

```bash
brew install asciinema
npm install -g svg-term-cli
brew install ffmpeg     # already installed
brew install gifski     # for high-quality GIF compression (optional but recommended)
```

**Recipe:**

```bash
cd /path/to/enuff-is-enuff-unsubscribe
rm -rf enuff-is-enuff-report

# 1. Record the session (will spawn a new shell; everything you type is captured)
asciinema rec demo.cast --max-wait 1.5 --idle-time-limit 1.5

# Inside the recording:
node bin/enuff_scan.mjs scan examples/sample-inbox
claude
# (in Claude) "walk me through the candidates"
# (respond with) "all newsletters except GitHub"
# (in Claude) "render the report"
# (in Claude) "I'm ready to act"
# (when prompted) "yes"
# (wait for end-of-act summary)
# (Ctrl+D to exit Claude, then Ctrl+D to end recording)

# 2. Convert .cast → .svg (animated)
svg-term --in demo.cast --out demo.svg --window --no-cursor --width=120 --height=32

# 3. Render SVG → MP4 → GIF
# (svg-term produces an SVG that animates; convert via headless Chrome → frames → ffmpeg → gif)
# Easier path: skip svg-term and use a screen recorder instead.
```

**Easier alternative** if asciinema gives you trouble — record the screen directly:

```bash
# macOS built-in screen recorder
# Cmd+Shift+5 → "Record Selected Portion" → drag over the Terminal window → click Record
# Run the flow above, stop recording when done.
# Saves as .mov to Desktop.

# Convert .mov → .gif with ffmpeg + gifski (high quality)
ffmpeg -i ~/Desktop/demo.mov -vf "fps=12,scale=1000:-1:flags=lanczos" -f yuv4mpegpipe - | \
  gifski -o demo.gif --fps 12 --quality 90 -

# Or vanilla ffmpeg (smaller but lower quality)
ffmpeg -i ~/Desktop/demo.mov -vf "fps=12,scale=1000:-1:flags=lanczos,palettegen" /tmp/palette.png
ffmpeg -i ~/Desktop/demo.mov -i /tmp/palette.png \
  -filter_complex "fps=12,scale=1000:-1:flags=lanczos[x];[x][1:v]paletteuse" demo.gif
```

Target: <8 MB, ≤45s. If too big, lower `fps` to 10, `scale` to 800.

Save as `assets/marketplace/demo.gif`.

## Marketplace submission packing list

Once `workflow-review.png` and `demo.gif` are captured:

| Asset | Path | Status |
|---|---|---|
| Plugin icon (square) | `assets/enuff-is-enuff-512.png` | ✅ |
| Plugin icon (large) | `assets/enuff-is-enuff-1024.png` | ✅ |
| Hero card | `assets/marketplace/hero.png` | ✅ |
| Full report screenshot | `assets/marketplace/report-full.png` | ✅ |
| Getting-started hero | `assets/marketplace/getting-started-hero.png` | ✅ |
| Workflow screenshot | `assets/marketplace/workflow-review.png` | ⬜ needs live session |
| Demo GIF | `assets/marketplace/demo.gif` | ⬜ needs interactive recording |

## Re-rendering the headless screenshots

If the report HTML changes, regenerate the captures:

```bash
cd /path/to/enuff-is-enuff-unsubscribe
rm -rf enuff-is-enuff-report
node bin/enuff_scan.mjs scan examples/sample-inbox
node -e "
const fs=require('fs');
const a=JSON.parse(fs.readFileSync('enuff-is-enuff-report/approved-actions.json','utf8'));
for (const i of a) {
  if (['ollama.example::newsletter', 'substack.example::marketing_promos', 'acmestore.example::marketing_promos'].includes(i.id)) i.approved = true;
}
fs.writeFileSync('enuff-is-enuff-report/approved-actions.json', JSON.stringify(a,null,2)+'\n');
"
node bin/enuff_scan.mjs review enuff-is-enuff-report

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=1600,1000 --force-device-scale-factor=2 \
  --screenshot=assets/marketplace/hero.png \
  "file://$PWD/enuff-is-enuff-report/report.html"

"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=1400,3600 --force-device-scale-factor=2 \
  --screenshot=assets/marketplace/report-full.png \
  "file://$PWD/enuff-is-enuff-report/report.html"

"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=1280,900 --force-device-scale-factor=2 \
  --screenshot=assets/marketplace/getting-started-hero.png \
  "file://$PWD/getting-started.html"
```
