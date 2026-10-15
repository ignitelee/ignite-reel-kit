---
name: ignite-carousel
description: IGNITE Reel Kit Carousel Builder. Turn the user's pictures and brief into branded Instagram carousels (1080x1350 slides) plus the post caption, written with human-speak, as a draft.json the user checks and edits on the dashboard before they make the images. Use when a dashboard message says "make my carousels" / points to a CAROUSEL.md, or the user asks for a carousel, slides or a photo post.
---

# IGNITE carousels

The dashboard's **Carousel Builder** collects the brief (Ignite or personal, pictures, topic, audience, tone, how
many topics, filter, logos, colour, last slide) and writes `dashboard/carousels/<id>/CAROUSEL.md`. It works in two
parts, to save the user's Claude plan; CAROUSEL.md says which part to do now:

1. **Three short options** per topic in `options.json`: a different angle each, a cover hook and 5-8 slide
   headlines. No full slides, no caption, no picture choices yet. The user chooses ONE per topic on the dashboard.
2. **The chosen option(s) in full** in `draft.json`: slides, pictures, caption (below). Nothing for the others.

You never make the final images: the user reads every slide on the dashboard, edits words (live preview), then
presses **Make my images** (seconds, no Claude).

### Part 1: options.json

```json
{"topics": [{"topic": "A normal working day",
  "options": [
    {"angle": "A story: one day, start to finish", "hook": "What a normal day looks like for me", "slides": ["6am: ...", "...", "Full breakdown in the caption"]},
    {"angle": "A how-to list", "hook": "...", "slides": ["..."]},
    {"angle": "Myth vs the truth", "hook": "...", "slides": ["..."]}]}],
 "message": "one short line for them"}
```
Make the 3 options genuinely different (angle, hook, order), not three wordings of one idea. Headlines short
(human-speak). Check with `node scripts/carousel.mjs options <id>`.

Read CAROUSEL.md and `brand/brand.json` first. Write every word with the **human-speak** skill (Draft mode, then its
evaluation check; clean copy only).

## draft.json

```json
{
  "carousels": [
    {
      "title": "IB partnership explained",
      "slides": [
        {"layout": "cover", "image": "dashboard/carousels/<id>/images/123-me.jpg", "focus": "50% 30%",
         "kicker": "Ignite partner", "title": "How I get paid when my *clients* trade", "body": "A plain look at the IB model."},
        {"layout": "photo", "image": "...", "kicker": "Step 1", "title": "They open a *broker* account", "body": "..."},
        {"layout": "phone", "image": "library/hub/stills/dashboard.jpg", "kicker": "The Hub", "title": "Every trade in _one place_", "body": "..."},
        {"layout": "list", "kicker": "Inside Ignite", "title": "What you get", "items": ["...", "...", "..."]},
        {"layout": "stat", "kicker": "Example", "stat": "$3", "title": "per lot traded", "body": "An example rate. Yours could differ."},
        {"layout": "quote", "quote": "...", "by": "Lee Markham"},
        {"layout": "statement", "title": "You earn on the *spread*, not on their losses"},
        {"layout": "end", "title": "Full breakdown in the *caption*", "body": "Save this for later."}
      ],
      "caption": "the post caption: hook line, the detail, call to action, 3-8 hashtags"
    }
  ],
  "message": "one or two short friendly sentences for the user (shown above the editor)"
}
```

- Image paths are kit-relative, exactly as CAROUSEL.md lists them. Any slide can have an `image` (or none: a designed
  dark background). `focus` = CSS object-position to keep a face or subject in frame (`"50% 25%"` = upper middle).
- Markup in any text: `*word*` = brand colour (1-3 key words per slide, not whole sentences), `_word_` = serif italic
  accent (sparingly), `\n` = line break. No emoji, no long dashes.
- Don't set `look` (filter / logos / accent): the user chose it on the dashboard and can change it per carousel.

### Layouts

| layout | use for | text |
| --- | --- | --- |
| `cover` | slide 1 (always): full-bleed photo, the hook | kicker, title (the hook, aim <= 8 words), body (optional, one line) |
| `photo` | a picture that shows the point (photo top, words below) | kicker, title, body |
| `phone` | tall screenshots and Ignite Hub screens, inside a phone | kicker, title, body (short) |
| `screen` | WIDE screenshots (laptop, desktop), in a framed card | kicker, title, body (short) |
| `poster` | a ready-made poster, logo or photo shown whole (nothing cropped, no filter) | title, body (both optional, under it) |
| `statement` | one strong line, photo blurred behind | kicker, title |
| `list` | 3-5 short points | kicker, title, items (each <= 60 letters) |
| `stat` | one number that matters (labelled honestly) | kicker, stat (<= 6 chars), title, body |
| `quote` | their own words, a client's words (real ones only) | quote, by |
| `end` | the last slide (always): logos, call to action, arrow | title, body (optional) |

The slides shrink text to fit, but past the limits in `checkDraft` it gets too small on a phone: keep titles
under ~60 letters and body under ~180. One idea per slide.

## Writing it (part 2: the chosen option)

Follow the chosen option's hook and slide order (CAROUSEL.md lists it); you may tighten wording.

1. **Look at every picture** (open each file). Note what each shows, where faces are, which are strongest. Use their
   best photo of themselves on the cover when there is one. Don't put a face under text: pick `photo`/`focus`.
2. **Plan**: 5-8 slides (10 max). Cover = the hook; then one point per slide in a clear order; end slide last.
   If CAROUSEL.md says "you decide" how many: usually 1; split into more only when the pictures cover different topics.
3. **Cover hook**: specific and true, says what they'll get by swiping. No clickbait, no "Nobody talks about this",
   no "Here's the thing" (human-speak).
4. **Last slide** (as CAROUSEL.md says):
   - "caption" (default): title `Full breakdown in the *caption*`, and the caption carries the full detail: write it as
     short paragraphs that expand each slide, worth reading on its own.
   - "usual": their brand.json `cta` as the title. "save": e.g. `Save this for *later*`. Own words: use them as given.
5. **Caption**: first line = a hook that works without the image; then the detail (short paragraphs, blank lines
   between); the call to action; 3-8 hashtags that match the topic (trading tags only on trading topics). Under 2,200
   characters. Their voice from brand.json.
6. **Ignite carousels**: read `library/ignite/IGNITE.md` first: it is the ONLY source of facts about Ignite
   (what it is, how it's free, tiers, signal groups, Hub, Sparkie, Edge, Mirror, live calls, the IB side, words
   to always / never use). Skip anything marked **[CHECK]**. If the brief asks for a fact that isn't in it, keep
   it general and say so in the draft "message". Never promise income or results, never invent rates or numbers;
   label examples as examples. Ignite's own pictures: `library/ignite/images.json` (what each shows, which
   layout; the posters are 4:5 and work as a whole `poster` slide). The risk line is added to the
   last slide automatically. Hub screens show demo data: fine to show, never claim they're real results.
   Use `phone` for Hub screens (`library/hub/stills/*.jpg`: dashboard, trades, calendar, education, sparkie,
   sparkie-review, edge-panel, onboarding). The phone shows the TOP of a screen; `focus` moves it (`"50% 60%"`).
   `sparkie-review.jpg` shows a losing day's trades being reviewed: fine for "learning from losses", wrong for a
   promotional slide; use `sparkie.jpg` (Sparkie answering a question) to show Sparkie in general.
7. **Personal carousels**: their life, their business, their lessons. Their logo, their colour. Mention Ignite only
   if their brief does.

## Check, look, hand back

1. `node scripts/carousel.mjs check <id>`: fix every ERROR; fix WARNINGs unless there's a reason.
2. `node scripts/carousel.mjs render <id> --check`, then open each `dashboard/carousels/<id>/out/_check/*/sheet.jpg`
   (all slides side by side). Check: words readable and not cut off, no face under text, the order flows, the cover
   would make you swipe. Fix and re-check. (Open single slides in `out/_check/*/slide-NN.png` to look closer.)
3. Keep `dashboard/carousels/<id>/status.json` updated: `{"step", "detail", "percent"}` (steps in CAROUSEL.md).
   Finish on `"step": "Ready to check", "percent": 100`, and tell the user in one line to go back to the Carousel
   Builder, read the slides, change any words, then press **Make my images**.

## Change messages

"Carousel job <id>: please change the words: ..." = edit the existing `draft.json`: keep the user's own edits
(they edit on the dashboard) except where the note asks otherwise, check + look again, set status "Ready to check".
"Carousel job <id>: please give me 3 new options: ..." = rewrite `options.json` (part 1) with their note in mind,
check it, set status "Pick your option".
