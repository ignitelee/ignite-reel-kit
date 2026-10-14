# Reel style guide

The look every reel follows. The user's own brand comes from `brand.json` (copied into each project as
`assets/brand/brand.json`): their logo and accent colour replace the defaults everywhere. Nothing is
branded IGNITE unless the user's own logo or words say so.

## Style prompt

Professional, simple, premium-app feel. Calm confidence, not hype. Dark, clean, ONE bright accent (the
user's `accent_color`). The speaker stays the hero: graphics sit beside them or on clean cards, never over
their face, and land exactly on the words they say.

## Branding on the reel

- **No header bar and no fixed call-to-action text.** (Only add one if the user explicitly asks for it in
  that request: then `"header": {"lines": [...]}` in reel.json.)
- **Logo badge:** the user's logo, small, in the top-right corner for the whole reel (about 200 px wide,
  clear of the app buttons), with a soft shadow so it reads on any background. `"logo": false` in reel.json
  hides it; no logo in brand.json = no badge.
- **Accent colour** (brand.json `accent_color`): the spoken word in captions, key words, icons, highlight
  boxes, chart lines, card glows. Everything else white / near-black.

## Layouts

**Layout B — "full frame"** (vertical footage, the default): the video fills the frame. Optional hook in the
first ~3 s: two stacked label boxes (small black box with an icon + short caps label, then a white box with
the hook in black caps, the key word in the accent colour).

**Layout A — "studio band"** (landscape footage): black 9:16 canvas, a big headline in quotes above the
16:9 video band (one key word in the accent colour + underlined), a 2-line description below it, optional
website line. Headline / description stay on screen the whole reel.

**Captions (both layouts):** sentence case, up to 2 lines centred, ~50-58 px white semi-bold, no box, soft
shadow; words appear as they are spoken and the word being spoken is in the ACCENT colour (earlier words
turn white). Over the chest, never over the face. On by default.

## Colours (assets/brand/brand-tokens.css; the accent is swapped for the user's)

| Token | Default | Use |
|---|---|---|
| `--ig-teal` | user's `accent_color` | The ONLY accent |
| `--ig-mint` | `#B8FFF0` | Bottom of the title gradient (white -> light tint) |
| `--ig-bg` | `#050B0A` | Full-screen cards (soft accent glow behind the focal point) |
| `--ig-surface` | `#0C1716` | Glass panels, phone/laptop frames |
| `--ig-text` | `#FFFFFF` | Main text |
| `--ig-text-dim` | `#A9B8B5` | Labels, small print |
| `--ig-dark-text` | `#04110E` | Text on an accent highlight box |

No rainbow gradients. Red/green only inside real trading charts, plus the soft red (#FF6370) crosses and
strike-through on "no / not" lists.

## Typography (local fonts in assets/brand/fonts; never load web fonts)

- **Anton**: full-screen titles only, ALL CAPS, white -> light gradient.
- **Inter** 600/700/800: everything else (lines, list items, captions). Big kinetic words are Inter
  ExtraBold, lowercase, in the accent colour.
- **Playfair Display Italic**: the white accent word in a kinetic stack.
- **Material Icons Round**: icons by name (see fonts/MaterialIconsRound-Regular.codepoints).

## Signature looks

1. **Kinetic stack** (in clean space beside the speaker): small white line, BIG accent word, white italic word.
2. **Highlight box**: on the key word, an accent box wipes in behind it and the word turns dark.
3. **Full-screen card**: where EVERY diagram goes (never on top of a busy background). Near-black + slowly
   drifting faint grid + soft accent glow + vignette; the graphic in the middle, captions slid to the bottom.
   Cut back to the speaker between cards.
4. **Lists**: small accent CAPS label, then items with marks (tick / cross / number / chevron).
5. **Frosted glass cards** over the video for small things (a product name with its real logo, a number).

## Motion

- Entrances: rise 20-40 px + un-blur + fade, 0.35-0.6 s.
- Text lands ON the spoken word and clears 2.5-5 s after the line ends.
- Camera: calm. Few zooms, mostly slow push-ins, at most one snap zoom per reel, punch-ins only to hide cuts.
- Subtle SFX only (assets/brand/sfx) on graphic entrances, low level.
- Music (when chosen): a track from brand/music/<mood>/, ~18 dB under the voice.

## Layout (1080x1920)

- Social-safe text zone: x 90-930, y 200-1600. Nothing important in the right 150 px or bottom 320 px.
- Find the speaker's face in a real frame first. Landscape footage cropped to 9:16 puts the head high with
  little room above it: put text lower or on a card. Never cover eyes, mouth or hands mid-gesture.

## Don't

1. No PowerPoint look: no split panels or blanked backgrounds behind the speaker.
2. No hype words or emojis on screen. No made-up numbers: use the speaker's own figures, mark examples.
3. No full-screen linear gradients (banding). Solid bg + radial glow.
4. No `Math.random()` / `Date.now()` in compositions (renders must be repeatable).
5. Spelling follows what the speaker meant, not transcription mishearings.
