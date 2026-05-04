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

A real Claude Code session showing the brand-by-brand approval prompt — **using plugin mode (slash commands)**, since that's the install path the marketplace listing is selling. **Cannot be faked** — the marketplace expects an authentic screenshot of the actual product.

**Setup (one-time, in any Claude Code session):**

```text
/plugin marketplace add codecoincognition/enuff-is-enuff-unsubscribe
/plugin install enuff-is-enuff-unsubscribe@enuff-is-enuff-local
/reload-plugins
```

**Recipe (in any directory — slash commands work from anywhere):**

```bash
cd /tmp                  # or anywhere; doesn't matter, plugin is global
mkdir demo-capture && cd demo-capture
claude                   # opens fresh session
```

Then in the Claude Code session, run the actual plugin commands:

```text
/enuff-is-enuff-unsubscribe:scan /path/to/enuff-is-enuff-unsubscribe/examples/sample-inbox
/enuff-is-enuff-unsubscribe:review
```

Wait for Claude to render the brand-by-brand table (it will list Ollama, Substack/Lenny's, Acmestore, Snackbox, Linear, Railway, etc. with their stream counts and unsub-header status). When the table is fully visible:

- **macOS**: `Shift + Cmd + 5` → "Capture Selected Window" → click the Terminal/iTerm window. Saves to Desktop.
- Recommended terminal: a clean iTerm or Terminal window, dark or light theme matching your taste, ~1280×800.

Save as `assets/marketplace/workflow-review.png`.

Best moment to capture: right after Claude posts the company table but before you respond — the slash-command-prompt-table structure reads as "I ran a slash command and AI is helping me decide" which is exactly the marketplace pitch.

> **Why slash commands and not the node command?** The marketplace listing's pitch is "install this plugin and get slash commands." Showing `node bin/enuff_scan.mjs scan …` in the demo would be off-message — it's the directory-mode under-the-hood detail. Plugin users never see that command.

## To capture: demo GIF (≤45s, ≤8 MB)

The full flow: paste path → ranking appears → review a few brands → confirm → act runs → summary. Loop.

Tools needed (none currently installed):

```bash
brew install asciinema
npm install -g svg-term-cli
brew install ffmpeg     # already installed
brew install gifski     # for high-quality GIF compression (optional but recommended)
```

**Prerequisite:** plugin already installed (one-time setup):

```text
/plugin marketplace add codecoincognition/enuff-is-enuff-unsubscribe
/plugin install enuff-is-enuff-unsubscribe@enuff-is-enuff-local
/reload-plugins
```

**Recipe (record plugin-mode flow with slash commands):**

```bash
cd /tmp
mkdir demo-capture && cd demo-capture

# 1. Record the session (spawns a new shell; everything you type is captured).
# --idle-time-limit caps long pauses to 2s in playback so the GIF stays under 45s.
# (asciinema 3.x dropped --max-wait; only --idle-time-limit survives.)
asciinema rec demo.cast --idle-time-limit 2

# Inside the recording:
claude
# (in Claude) /enuff-is-enuff-unsubscribe:scan /path/to/enuff-is-enuff-unsubscribe/examples/sample-inbox
# (in Claude) /enuff-is-enuff-unsubscribe:review
# (respond with) all newsletters except GitHub
# (in Claude) /enuff-is-enuff-unsubscribe:act
# (when prompted) yes
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
