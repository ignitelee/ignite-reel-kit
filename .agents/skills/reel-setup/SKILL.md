---
name: reel-setup
description: First-time setup of the IGNITE Reel Kit on the user's Mac or Windows computer - checks and installs the tools (Node, Git, FFmpeg, uv, kit packages, video renderer, speech model), builds their brand kit (logo, colours, defaults) into brand/brand.json, and opens the dashboard. Use when brand/brand.json is missing, when the user says "set up", "install", "it's not working", or after they download the kit.
---

# IGNITE Reel Kit setup

The user is probably not technical and may not read long messages. Talk in plain English, one short step
at a time, and explain why in one line before each install ("this lets the kit cut video").

**Run every command yourself.** The user only clicks **Allow** when Claude Code asks; never bypass
approvals. Never show them a command and expect them to know what to do with it. Before your first command,
tell them: "I'll run each step for you. Claude will pop up asking you to Allow: click Allow. If Windows asks
'Do you want to allow this app to make changes to your device?', click Yes."

Never ask for or type passwords. Only if a command truly needs them at the keyboard (Homebrew on Mac asks
for their Mac password) do they run it themselves, and then give click-by-click steps, e.g.:
- **Mac:** "1. Press Cmd + Space. 2. Type Terminal and press Enter. 3. Click inside the Terminal window.
  4. Paste with Cmd + V and press Enter. 5. When it asks for a password, type your Mac login password
  (nothing appears as you type, that's normal) and press Enter. 6. Come back here and tell me when it's done."
- **Windows:** "1. Press the Windows key. 2. Type PowerShell. 3. Click Windows PowerShell. 4. Right-click
  inside the blue window to paste, then press Enter. 5. Click Yes if Windows asks to allow changes.
  6. Come back here and tell me when it's done." (Never tell them to paste into the Windows search bar.)
Give the command in a code block on its own, after the steps, so it's easy to copy.

Their own Claude account only: the kit runs on the Claude Code login of the person at this computer and
needs no Anthropic API key. Never ask for, store or use an API key or login belonging to anyone else
(e.g. the IB who shared the kit). If `ANTHROPIC_API_KEY` is set in their environment or `.env`, tell them
it bills that key's owner and ask whether it is their own before continuing.

## 1. Check the computer

Run `node scripts/reel-doctor.mjs`. (If `node` itself is missing, start with step 2.) Tell them in one
line what's already fine and what's missing. Then fix only what's missing, in this order.

## 2. Install missing tools

**Windows** (winget is built into Windows 10/11):
| Missing | Command |
| --- | --- |
| Node.js | `winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements` |
| Git | `winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements` |
| FFmpeg | `winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements` |
| uv | `winget install -e --id astral-sh.uv --accept-source-agreements --accept-package-agreements` |
Run these yourself (they click Allow, and Yes if Windows asks to allow changes).

**No restart needed:** after winget installs, the Claude app still has the old PATH, and every command
starts a fresh shell. So start each later command (in PowerShell) with a PATH refresh until the app has
been restarted:
`$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); <command>`
(in Git Bash: run it through `powershell -NoProfile -Command "..."`). Only if a tool still isn't found
after that, tell them exactly: "Close the Claude app completely (right-click its icon at the bottom of the
screen, Close window), open it again, click Code, choose the ignite-reel-kit folder and type: carry on with
setup". (Check `brand/brand.json` is still missing to know where you are.)

**Python folder (Windows):** the Claude desktop app (Microsoft Store version) redirects AppData into its
own private folder, which breaks uv's Python install ("Missing expected target directory for Python minor
version link"). The kit's scripts already work around it, but also set it for their user account, after
asking ("This stops a known Windows problem with the speech tool. OK?"):
`[Environment]::SetEnvironmentVariable('UV_PYTHON_INSTALL_DIR', "$env:USERPROFILE\.uv-python", 'User')`

**Mac**: tools come from Homebrew. If `brew --version` fails, Homebrew needs their Mac password, so ask
them to run this one themselves, with the click-by-click Mac steps above:
`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
On Apple Silicon Macs it ends by printing two `echo ... >> ~/.zprofile` / `eval` lines to run: ask them to
run those too, then close and reopen Claude Code. Then: `brew install node git ffmpeg uv`.

## 3. Kit packages, renderer and speech model (both systems)

1. `npm ci` (installs the kit's own packages; a minute or two).
2. `npx hyperframes browser ensure` (downloads the video renderer once).
3. Speech model, downloaded once (~1.6 GB, a few minutes on normal broadband). Tell them it's a one-off:
   `npm run transcribe -- --prepare` (always use this, not a raw `uv run`: on Windows it keeps Python in
   `~/.uv-python`, because the Claude desktop app's private copy of AppData breaks uv's default Python folder;
   on Windows, set UV_PYTHON_INSTALL_DIR first, see step 2).
4. `npm test` should pass. Run `node scripts/reel-doctor.mjs` again: everything but the brand should be OK.

## 4. Their brand kit (writes brand/brand.json)

Start from `brand/brand.example.json`. Ask, a few at a time, using AskUserQuestion where it helps:
1. Their name (for captions and greetings).
2. **Their logo**: ask them to drag their logo file into the chat (see below). It appears as a small badge in
   the top corner of every reel. No logo yet is fine: they can add one later.
3. **Their brand colour**: the one accent colour used for the spoken word in captions, key words and
   glows. Suggest the main colour from their logo (tell them the hex code and show it in words, e.g.
   "bright orange"); or let them pick from a few options with AskUserQuestion. Default teal #13E6BA.
4. Website or handle (optional, only used in captions or when they ask for it on screen).
5. What they usually ask people to do (optional, e.g. "DM me 'START'"): used in post captions, never as a
   fixed bar on the video.
6. Defaults: platforms (Instagram, TikTok, Facebook, YouTube Shorts), captions on/off, graphics
   none/light/full, music mood (upbeat/inspiring/calm/emotional/none).

**Their logo:** copy it into `brand/user/` and set `"logo": "user/<file>"`. It must have a transparent
background so it sits cleanly on the video. If it's a JPG or has a white/coloured box behind it, make a
transparent PNG (e.g. `ffmpeg -i in.jpg -vf "colorkey=white:0.25:0.05,format=rgba" brand/user/logo.png`),
show them the result and confirm. Keep it under ~1000 px wide.

Write `brand/brand.json`, then read it back to them in 4-5 plain lines.

## 5. Stock footage (optional, 2 minutes)

Ask: "Want free stock video clips (a pub, a beach, a gym...) added to your reels now and then? It needs a
free Pexels account." If yes: they open https://www.pexels.com/api in their browser, sign up (their own
account; you never sign up for them or type their details), and copy "Your API key". Then create `.env` in
the kit folder from `.env.example` if it doesn't exist, open it for them in Notepad / TextEdit, and ask them
to paste the key after `PEXELS_API_KEY=` and save. Test: `npm run broll -- video-projects/demo "beach" --list`
should list clips. Never ask them to paste the key into the chat. If no: fine, reels just won't use stock clips.

## 6. Music (optional)

Explain the kit has no music (licences). They can drop tracks into `brand/music/<mood>/` (see
`brand/music/README.md`): YouTube Audio Library or Pixabay Music are good free sources (check each licence).

## 7. Finish

Run `node scripts/reel-doctor.mjs` (all OK). Then:
1. `npm run shortcut`: puts an **IGNITE Reels** icon on their desktop that opens the dashboard.
2. Start the dashboard in the background (`npm run dashboard`, run it in the background so this chat stays
   free). It opens in their browser at http://localhost:4747.
3. Tell them, in three short lines: they're set up; the dashboard is where they make reels (drop a video,
   pick options, press "Copy my message", paste it back into Claude here, click Allow when asked); next time
   they double-click **IGNITE Reels** on the desktop and leave the small black window open.

If they already filled in their brand in step 4, it's in the dashboard's "My brand" tab too (same file).
