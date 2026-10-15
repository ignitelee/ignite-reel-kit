# IGNITE Reel Kit

Turn your talking-head videos into finished, branded reels with Claude Code, on your own computer.
Drop in a video and get back reels with your logo and colours, captions that highlight each word as you say it,
graphics that match what you're saying, calm zooms, music, and ready-to-post captions for Instagram,
TikTok, Facebook and YouTube Shorts that don't sound like AI.

Made for IGNITE IBs. Works on Mac and Windows.

## What you need

- A computer (Mac or Windows) with about 5 GB free space.
- The **Claude desktop app** (free download from claude.com/download), signed in to **your own** paid Claude
  plan. Pro is fine to start; if you make lots of reels you may need Max. You make reels in its **Code** tab.
- Nothing else: setup installs the rest for you (you approve each step).

## Your own Claude account (important)

Everything runs on **your** computer and **your own** Claude subscription: you sign in to Claude Code
with your own account, and any usage counts against your plan, nobody else's. The kit contains no API
keys and never asks for anyone else's. Don't share your Claude login or API keys with other IBs, and
don't paste anyone else's key into the kit. (The optional extras in `.env.example` are your own keys
too, kept in a `.env` file that is never uploaded. You don't need any of them to make reels.)

## Install (one message)

Open the Claude app, click **Code**, and paste this:

> Please set up the IGNITE Reel Kit for me from https://github.com/ignitelee/ignite-reel-kit
> I'm new to this, so keep your messages short and simple, and run every step yourself: I'll just click Allow.
> If git isn't installed, install it first. If Windows can't find a tool you've just installed, refresh the
> PATH yourself instead of asking me to restart. Download the kit into my Documents folder (or update it if
> it's already there), then open `.claude/skills/reel-setup/SKILL.md` inside it and follow it step by step.
> If anything needs my password, tell me exactly where to type it, click by click.

New to all this? Read [START HERE](START%20HERE.md) first: it walks you through everything with pictures.

Claude runs each step for you (you click **Allow**), installs the tools, downloads the speech model (about 1.6 GB, once), and asks for your logo and
your brand colour.

## Making reels

**The easy way:** double-click **IGNITE Reels** on your desktop (setup puts it there) or run `npm run dashboard`.
Drop in your video, tick what you want, press **Copy my message** and paste it into Claude Code. Claude asks
you to **Allow** each step it runs on your computer: that's normal, click Allow. Your reels appear in the
dashboard with download and copy-caption buttons.

**The chat way:** open Claude Code in the `ignite-reel-kit` folder, drag your video in, and say what you want, e.g.

> /ignite-reel Make 5 reels from this for Instagram and TikTok, with captions and calm music.

You get each reel as an MP4 plus a `POST.md` with the captions, hashtags and a cover-text idea.
See [HOW TO MAKE A REEL.md](HOW%20TO%20MAKE%20A%20REEL.md) for tips.

## Making carousels

Open the dashboard and click **Carousel Builder**. Set up your logo and colour in **My brand** first (the page
asks you to). Choose **Promoting Ignite** (Ignite logo and teal built in, Hub screens, a risk line on the last
slide) or **My own content**, drop in your pictures, say what it's about, pick a filter (Luxury is the suggested
one) and press **Copy my message**. Claude writes every slide and the post caption. You then read and change
any words on the page, with a live preview, and press **Make my images**: 1080x1350 PNG slides plus the
caption, as a zip. Making the images takes seconds and doesn't use your Claude plan, so you can change words
and remake them as often as you like.

## Updating

Say "update my IGNITE Reel Kit" in Claude Code (it runs `git pull` and `npm ci`). Your logo, settings
and music are never touched by updates.

## Credits and licences

- Built on Nate Herk's **HyperFrames Student Kit** (MIT): https://github.com/nateherkai/hyperframes-student-kit.
  His original README is in [docs/HYPERFRAMES-KIT-README.md](docs/HYPERFRAMES-KIT-README.md); licences in
  `LICENSE`, `licenses/` and `THIRD_PARTY_NOTICES.md`.
- **HyperFrames** by HeyGen (Apache-2.0), **GSAP**, **faster-whisper** (MIT).
- Extra brand logos in `library/logos/` (CapCut, MetaTrader 5, PU Prime, Premier Markets): each brand's own logo,
  sources in `library/logos/logos.json` (CapCut icon: Wikimedia Commons, public domain). Same rule as below.
- Brand logos from **Simple Icons** (CC0): https://simpleicons.org. Logos are trademarks of their owners:
  show them only when you mention the brand, never in a way that suggests they endorse you.
- **Human Speak** skill by Nate Herk (MIT): https://github.com/nateherkai/human-speak, in
  `.claude/skills/human-speak/`. It adapts ideas from **No AI Slop** by Peter Yang (MIT):
  https://github.com/petergyang/no-ai-slop.
- Fonts: Anton, Inter, Playfair Display (SIL Open Font Licence), Material Icons (Apache-2.0); licence
  texts in `brand/fonts/licenses/`.
- The IGNITE Hub footage in `library/hub/` and the pictures and fact sheet in `library/ignite/` are IGNITE's,
  for IGNITE IBs talking about Ignite.
- No music is included: add your own (see `brand/music/README.md`).

You're responsible for what you post. Trading involves risk: keep claims honest and include a risk
warning where your content promotes trading.
