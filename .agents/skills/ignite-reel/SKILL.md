---
name: ignite-reel
description: IGNITE Reel Kit workflow. Turn the user's talking-head video into one or more finished 9:16 reels (their logo badge and brand colour, word-timed captions with the spoken word in the accent colour, hook, graphics that fit the words, calm zooms, SFX, music by mood) PLUS a social post package per reel (hooks, Instagram/TikTok/Facebook/YouTube captions, hashtags, cover text) written like a human, and optional trial-reel variants. Use whenever the user drops a video, asks for reels/Shorts/TikToks, captions or hooks, or the dashboard sends a job.
---

# IGNITE reel

The user is an IGNITE IB (or similar creator). Their videos are about ANYTHING: trading and IGNITE, but
also lifestyle, fitness, travel, mindset, family, business, tech. Every reel must be edited for what THIS
video is about, like a skilled editor who listened to it, never a trading template applied to everything.
For each video they want:
1. the finished reel(s) (MP4, 1080x1920),
2. a social post package per reel (POST.md) with strong hooks and human-sounding captions,
3. on request, several reels from one longer video, a full-length version, and trial-reel variants.

Read `brand/brand.json` (their name, logo, accent colour, website, usual CTA, voice, defaults) and the project's `DESIGN.md` (the IGNITE look and layouts) before building. If
`brand/brand.json` is missing, run the `reel-setup` skill first.

## Tools (all local and free; run from the kit folder; quote paths with spaces)

| Step | Command |
| --- | --- |
| New project | `npm run new-reel -- <name> "<path to video>"` (copies to assets/raw.mp4, adds the brand) |
| Transcribe | `npm run transcribe -- video-projects/<name>/assets/raw.mp4` -> raw.json (faster-whisper, local) |
| Silences | `node .agents/skills/cut-silences/scripts/cut-silences.mjs video-projects/<name>/assets/raw.json --gap 0.45 --out-dir video-projects/<name>/assets` |
| Mistakes | `.agents/skills/cut-mistakes` (find candidates, REVIEW each in context, never trust blindly) |
| Assemble | `node scripts/assemble.mjs video-projects/<name>/assets/segments.json` -> edited.mp4 + edited.json + edited-edl.json |
| Build | `node scripts/build-reel.mjs video-projects/<name>` (reel.json -> index.html) |
| Check | `cd video-projects/<name> && npx hyperframes lint` (2 "track too dense" warnings are normal) |
| Snapshots | `cd video-projects/<name> && npx hyperframes snapshot --at 1.5,8,15 --no-end --describe false` |
| Render | `node scripts/render-reel.mjs video-projects/<name> [--draft] [--variants]` -> renders/ |

segments.json: `{"source":"raw.mp4","transcript":"raw.json","from_edl":"raw.silence-edl.json","drop":[[s,e],...],
"loudness":-16}` for a straight cut, or `"segments":[{"start","end","note"}]` in ANY order (cold open = put the
hook line first; never repeat the same words unless deliberate). `"prepend"` adds a cold open before an
EDL cut. `"bleep": [[s,e],...]` mutes swearing with a tone. `"output": "edited-v2.mp4"` for variant cuts.
Times are source seconds from raw.json. Always level the voice (`"loudness": -16`).

## Dashboard jobs

The dashboard (`npm run dashboard`, http://localhost:4747) does not run Claude: the user pastes a message
like "Please make my reels: read dashboard/jobs/<id>/JOB.md and follow it". Read that JOB.md: it holds the
video path and their choices, and says how to report progress (`status.json`, every step) and results
(`results.json`, at the end) so the dashboard can show them. JOB.md may list several main-video parts
(up to 3: join them first, in order) and up to 3 extra pictures/clips, each with a "how" (beside them or
full screen) and a "when" in their words. These users often don't read long messages: keep chat
replies to a line or two, don't stop for a draft review, and only ask a question if you truly can't continue. Change requests ("Reel job <id>: please make this change...") come in the same chat: make
the change, re-render, update both files. If they say "open my reel dashboard", run `npm run dashboard` in
the background.

In results.json, `"variants"` is a list of the hook-test MP4 **file paths** (strings, relative to the kit
folder), e.g. `"variants": ["video-projects/<name>/renders/<name> - v2-question.mp4"]`, or `[]`. Don't
copy the variant objects from reel.json (`{name, hook}`) into it.

## Several reels from one video

When the user wants N reels from a longer video: transcribe once, then find N self-contained moments (each
one idea, a strong first line, a payoff, 15-60 s). Make one project per reel
(`npm run new-reel -- <name>-1 "<video>"`, etc. reusing the same transcript by copying raw.json) and give
each its own segments.json. If they also want a full-length version, make it as its own project.
Rank moments by hook strength; if the video can't honestly give N good reels, make fewer and say why.

## Platforms (from the user's choice; default brand.json "default_platforms")

| Platform | Length sweet spot | Pace | Captions / safe zone |
| --- | --- | --- | --- |
| TikTok | 15-45 s | fastest: hook in the first second, change every 2-3 s | keep text out of the right 150 px and bottom 400 px |
| Instagram Reels | 15-60 s | polished, hook in 2 s | bottom ~320 px and top ~200 px are covered by the app |
| Facebook Reels | 20-60 s | a little calmer; many watch muted, so captions are essential | same as Instagram |
| YouTube Shorts | 20-60 s | clear topic early (search), loops well | bottom ~300 px |
One render works for all four if text stays inside x 90-930, y 200-1600. Write a caption per platform.

## Workflow

1. **Set up + transcribe.** Probe the video (landscape -> layout A, vertical -> B). Grab a frame and
   note the face position in SOURCE pixels for `"face"`. Front-camera footage with backwards text on
   clothes -> `"mirror": true`.
2. **Read the whole transcript.** Fix mishearings (`captions.fix`), join split words (`captions.merge`,
   e.g. "chat gpt" -> "ChatGPT"). "CHECK" lines = words > 0.75 s = possible hidden retake: look there.
3. **Decide the topic, then find the story.** In one line, write what the video is about and who it's
   for (e.g. "morning routine for busy parents", "how IGNITE IBs get paid"). This decides EVERYTHING
   visual and written: trading/IGNITE graphics, Hub B-roll, trading hashtags and the risk line are ONLY for
   videos about trading or IGNITE. Then the story (one idea per reel): the claim, the proof/example, the
   payoff, the CTA.
4. **Write hooks** (below). Often the strongest line is mid-video -> cold open.
5. **Cut.** Silences (`--gap 0.45`, keeps a breath), then mistakes, retakes, waffle. Never cut mid-thought
   or make them say something they didn't mean. Put every cut inside a real silence (check the audio level
   around it, not just the word times: transcript word times can be ~0.3 s off).
   **Then re-transcribe the cut** (`npm run transcribe -- video-projects/<name>/assets/edited.mp4`, which
   rewrites edited.json): the word list assemble writes can mislabel or drop words at the joins (seen in
   testing: a stray "But" and a missing "Yeah"/"You"), and captions must match what's actually said.
6. **Write the edit plan** (below) line by line, then turn it into reel.json; build, lint, snapshot,
   render `--draft`.
7. **Check the draft yourself** before showing them: snapshots at every graphic, the hook, each card and
   the end. Look for: text over the face, graphics on the captions, cut-off text, icons rendering as words,
   spelling, a clipped first word.
8. **Show them** the draft and the hook choices. Apply notes.
9. **POST.md** (below), humanised. Final render. Give them the file paths. Never post anything.

## Hooks: the most important part

The hook = what the viewer sees AND hears in the first 1-3 seconds. Muted viewers must get it from the
text alone. Write 10 candidates from the actual transcript using different angles: contrarian truth,
call out the viewer, hidden problem, specific number (only numbers they say, marked as examples),
mistake/warning, curiosity gap, story, objection. Score each 1-5 on: specific, audience obvious, creates
a question the video answers, TRUE (the video pays it off), readable in under 2 s (<= 7 words on screen).
Keep the top 3, use the best, offer the others as variants. First spoken words should be the hook (no
"Hi guys"). Never promise income, guaranteed results or "easy money". No clickbait the video can't back up.

## The edit plan: design every reel for its content

Before writing reel.json, write a short plan in your reply (one line per beat): the words, the TREATMENT,
and why. Edit like a top short-form editor: every visual earns its place by showing what the words MEAN,
and the reel feels designed for this video, not filled from a template.

**Treatments** (pick per beat):
| Treatment | Use it for | reel.json |
| --- | --- | --- |
| **Stay on them** | personal, emotional, funny or story lines; the hook; the payoff. Let the face carry it. | no graphic (maybe a slow push-in) |
| **Split screen** | EXPLAINING something: steps, a comparison, a process, a list, before/after, a number with context. They glide into a rounded panel at the top, the explanation builds below, captions move into their panel. | any diagram type with `"pos": "split"` |
| **Liquid glass pop-up** | a short point, a name, a number, a brand, a quick "not this / this": beside them in clean space, never over the face or captions | `glass` (side or top position) |
| **Real logo** | they NAME a brand, app, company or platform (Instagram, Netflix, Spotify, Uber, Apple, YouTube...) | `glass` item with `"logo": "si:<slug>"`: find slugs with `npm run logo -- <brand>` (3,400+ real logos, offline). Not found -> a fitting Material icon; never draw or invent a logo |
| **Full-screen card** | ONE big moment (the key number, the big reveal, the final line): use sparingly, max 1-2 per reel | `title`, `stat` or a diagram with `"pos": "card"` |
| **B-roll / screen recording** | showing the actual thing they talk about (an app, the Hub, a place): their own uploaded clips first, then the IGNITE library (IGNITE videos only), then free stock footage | `phone` or `clip` |
| **Stock B-roll cutaway** | a place, activity or scene they DESCRIBE ("down the pub", "on the beach", "in the gym", "on my laptop"): a short full-screen cutaway, voice carries on | `{"type": "clip", "pos": "card", "src": "assets/broll/<name>.mp4", "at", "until"}` |
| **Chip / highlight** | one punchy phrase on screen | `chip`, `stack`, `hl` |

**Rules that make it look designed:**
- **Topic decides the visuals.** IGNITE Hub/Edge B-roll, trading diagrams (money flows, charts, pips) only
  when the video is about trading or IGNITE. A lifestyle video gets lifestyle visuals: real logos of the
  apps/brands they mention, glass cards, simple icons for objects and ideas (Material Icons: e.g.
  fitness_center, flight, restaurant, family_restroom, schedule, self_improvement, savings, favorite).
- **Explaining = split, not a cover-up.** Prefer split screen over a full-screen card whenever they explain
  something, so the viewer keeps their face AND sees the idea.
- **Variety:** never the same treatment twice in a row; alternate split / glass / staying on them. At least
  2-3 s on the speaker (full frame, no graphic) between graphics. No more than ~50% of the reel with a
  graphic up. One graphic at a time.
- **Density by choice:** "light" graphics = 2-4 treatments per minute, "full" = 5-8. Fewer, better
  graphics beat many average ones.
- **Timing:** each graphic lands on the exact words (`at`) and leaves when the thought ends (`until`).
- **Their own library first:** `brand/my-library/library.json` lists the photos and clips they saved (with notes
  like "me at the gym, use when I talk about discipline"). On every reel, check it and use what fits BEFORE
  anything else: their own visuals make the reel theirs. Order: files they added for this job > their library >
  IGNITE library (IGNITE/trading videos only) > stock B-roll. No note? Look at the picture (or a frame of the
  clip) to see what it shows. Copy what you use into the project assets.
- **Stock B-roll** (`npm run broll -- video-projects/<name> "search words" --name <x>`, free Pexels clips,
  needs the user's own PEXELS_API_KEY in .env; if it prints NO_PEXELS_KEY, skip stock B-roll silently and
  mention once at the end that they can turn it on): 1-3 per reel, 1.5-3 s each, only where it shows what
  they describe and gives the reel a different feel. Never during emotional or personal lines (their face
  matters more), never two in a row, never in the hook. Search simple concrete words ("friends pub",
  "laptop beach", "gym workout"); use `--list` to see options, then look at a frame of the downloaded clip
  before using it (stock clips can change shot partway; pick `media_start` to use the right part). The
  dashboard's "Stock footage" choice (none / a little) wins.
- **Their logo badge only when it's about their brand:** show the corner logo on videos about their
  business, trading or IGNITE; set `"logo": false` on personal, lifestyle and general videos (it adds
  nothing there). The dashboard's "Show my logo" choice (auto / always / never) wins; "auto" = this rule.
- **Never** over the face, never over the captions, never cut-off text. Check every graphic in snapshots.
- **Close-up selfie footage** (the face fills most of the frame, typical phone video): don't use
  `side-left`/`side-right` (the camera glide has to zoom in a lot and crops the head). Put glass in the
  clear area under the captions instead, e.g. `"pos": {"x": 60, "y": 1330, "w": 960, "h": 330}` with
  `"align": "center"` and `"row": true` (cards side by side), captions at `"y": 1180`; and use `split` for
  anything bigger. Side positions suit wider shots with clean space beside the person.

What a split / glass beat looks like:
```json
{ "type": "list", "pos": "split", "at": "first you", "until": "and that's it", "label": "My morning",
  "icon": "wb_sunny", "items": [{"text": "Wake at 6", "at": "six", "mark": "num"}, {"text": "Gym", "at": "gym", "mark": "num"}] }
{ "type": "glass", "pos": {"x": 560, "y": 330, "w": 480, "h": 420}, "at": "Netflix", "until": "every night",
  "items": [{"logo": "si:netflix", "title": "Netflix", "cross_at": "stopped"}] }
```
Graphics never sit on clutter: diagrams go on `split` or `card` (both have a clean dark background);
`glass` and `chip` sit beside the speaker in clean space (`side-left`/`side-right`/`top` or a custom box).

**Camera: calm.** Few zooms (3-4 per minute max, only on big lines), mostly SLOW push-ins (2-4 s,
`sine.inOut`), at most one snap zoom per reel, never in-then-out within a few seconds. Auto punch-ins only
to hide visible cuts (`"punch": {"auto": true, "min_hold": 7, "style": "snap"}`).

reel.json:
```json
{ "title": "...", "layout": "A|B", "video": "assets/edited.mp4", "transcript": "assets/edited.json",
  "face": {"x": 950, "y": 290},
  // no header bar by default (the logo badge comes from brand.json); add "header": {"lines": [...]} ONLY if asked
  "headline": "\"Get Paid When _*Others*_ Trade\"",          // layout A only. *accent*  _underline_
  "description": "...", "url": "...",                       // layout A only
  "hook": {"label": "Forex IB: did you know", "title": "You don't need to *trade*", "until": "how to trade"},
  "captions": {"fix": {"cause": "course"}, "merge": {"chat gpt": "ChatGPT"}, "y": 1150},
  "punch": {"auto": true, "edl": "assets/edited-edl.json", "scales": [1, 1.08], "min_hold": 7, "style": "snap"},
  "zooms": [{"at": "words", "to": 1.12, "dur": 3, "ease": "sine.inOut"}],
  "music": {"file": "assets/brand/music/calm/<track>.mp3", "under_db": 18},
  "popups": [ {"type": "...", "pos": "card", "at": "exact spoken words", "until": "words"} ],
  "variants": [ {"name": "v2-question", "hook": {"title": "..."}} ] }
```
- `at` / `until` = exact words from the edited transcript (after fixes); `"words#2"` = 2nd time said.
  Inside a graphic, words are searched from that graphic onwards. The build fails loudly if a phrase
  isn't found: fix the phrase, don't guess times.
- Types (all take `label` + `icon` and optional `title`): `list` (`items: [{text, at, mark}]`), `split`
  (`tiles: [{icon, title, sub, at, highlight}]`), `flow` (`nodes`, `pay: {at, text, chip}`), `phone` (`src`,
  `caption`, `stamp: {text, at}`), `clip` (B-roll video), `stat` (`value`, `sub`), `chip`, `stack`, `title`
  (+ `sub`), `hl`, `image`, `glass` (`items: [{logo|icon, title, sub, at, cross_at}]`; `logo: "si:<slug>"` = real brand logo; `"row": true` = cards side by side; `"align"`), `network`
  (`center`, `agents`, `counter`), `beforeafter` (`before` tile -> `after` phone). `size`, `lead`, `hold`, `sfx`.
- Positions: `card` (full-screen cut-away), `split` (layout B: speaker panel on top, graphic below). A: `band`,
  `band-left/right`, `gap`. B: `side-left/right`, `low`, `low-clear`, `top`, or a custom `{x,y,w,h}`.
  Split options in reel.json: `split_top`, `split_h` (panel), `split_face_y` (0-1, where the face sits),
  `split_scale`, `captions.split_y`.
- Reel options: `"logo": false` (hide the corner logo badge), `"header": {"lines": [...]}` (a top bar, only on request), `"mirror": true`, `"tail": 2.4` (end card holds after the footage),
  `"zoom_origin_dx"` (zooms push the face away from side graphics).
- Icons: Material Icons Round names (`brand/fonts/MaterialIconsRound-Regular.codepoints`).
- IGNITE Hub / Edge / onboarding B-roll: `library/hub/` (see its README, tagged by topic). ONLY for videos
  about IGNITE or trading: copy the clip into the project's assets and show it in a `phone` or `clip` when
  they talk about that part of the Hub.

**Music:** use the mood they chose (brand.json `music_mood` or the dashboard). Pick a track from
`brand/music/<mood>/`, copy it into the project's assets, `"under_db": 18`. Empty folder -> no music, and
tell them how to add tracks (brand/music/README.md). `"music": false` if they said no music.

## Trial-reel variants

Up to 5 versions that differ only in the OPENING (cold-open line, hook text or headline), so
the test shows which hook works. Name them by angle (`v2-question`...), render with `--variants`, give
each its own caption line 1 in POST.md, and tell them to post as trial reels a day or so apart and keep
the one with the best 3-second hold.

## POST.md: the social post package (one per reel)

Write as an expert short-form marketer who knows each platform's search, in the user's voice (brand.json
"voice"). Use the words people search FOR THIS TOPIC (a fitness reel: fitness words; a trading/IGNITE reel:
"forex IB", "introducing broker", "trading community", "gold signals", "how to become an IB"; "passive
income" only if accurate). Hashtags fit the topic, never trading tags on a non-trading reel. Then run the `humanizer` skill on every piece of
copy (embedded mode): no "not X but Y", no "Here's the thing", no dashes, no triads for rhythm, no
"game-changer/unlock/elevate", no emoji bullets.

Sections: hook used + 2 alternates; cover text (2-5 words) + best cover frame; one caption per chosen
platform (Instagram: line 1 works alone in ~125 characters, 3-6 short lines, one CTA (their usual `cta`
from brand.json, or one that fits the video), 3-5 hashtags; TikTok: shorter, keyword-rich, 3-5 hashtags; Facebook: Instagram adapted;
YouTube Shorts: title <= 70 characters with the keyword early, 2-3 line description, 3 hashtags);
pinned comment; variants; the risk line ONLY where the reel promotes trading or the IB programme.

## Compliance (only when the video is about trading, money or the IB programme; UK)

Keep every claim true and checkable: no guaranteed income, no "risk-free", numbers shown as examples, never
imply everyone earns. Add brand.json `risk_line` to captions that promote trading or the IB programme.
Flag anything that worries you; the user owns the final call.

## Hand-off

Tell them: the reel file paths, the hook chosen (and alternates), anything cut they might want back, and
where each POST.md is. A few lines, plain English.
