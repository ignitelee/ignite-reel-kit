# HyperFrames Student Kit: workspace guide

Turn a talking-head recording into an intentional edit using local HyperFrames
rendering, transcript-driven cuts, and reusable motion graphics.

## Runtime routing

`AGENTS.md` and `CLAUDE.md` contain the same standing guide. Keep them synchronized.
Claude Code uses `.claude/skills/`. Codex uses the generated `.agents/skills/`.
Edit canonical skills in `.claude/skills/`, then run `npm run sync:skills`.
Use `$edit-video` in Codex, `/edit-video` in Claude Code, or natural language.
Model and permission choices belong to the user; `.codex/config.toml` only adds
document loading defaults. Work locally unless the user requests subagents.

## Start and route

Read `README.md` for installation and `docs/WORKFLOW.md` for a complete edit.
Use `edit-video` to coordinate transcription, cuts, design, and verification.
For one stage, load the matching local skill:

| Need | Skill |
| --- | --- |
| Reels, Shorts, and short advertisements | `short-form-edit` |
| Motion-design showreels and brand reels cut to music | `motion-showreel` |
| Existing May Shorts example maintenance | `short-form-video` |
| New motion-graphics video from a brief | `make-a-video` |
| Website-inspired compositions | `website-to-hyperframes` |
| Full raw-video edit | `edit-video` |
| Silence removal | `cut-silences` |
| Retakes, false starts, or stutters | `cut-mistakes` |
| Narrative arc, persistent world, and visual callbacks | `video-storytelling` |
| Overlay beats, paper takeovers, and glass cards | `hyperframes-video-beats` |
| Select or extend styles and templates | `style-library` |
| HTML compositions and media timing | `hyperframes` |
| Preview, lint, and rendering | `hyperframes-cli` |
| Timeline animation | `gsap` |
| Install HyperFrames catalog blocks | `hyperframes-registry` |

Before a creative session read `MOTION_PHILOSOPHY.md` and the project's DESIGN.md.
The philosophy's fast sizzle pacing is a style reference. Give educational speech
room to breathe. The project brief controls pacing, palette, and typography.
Framework skill contracts override historical code recipes in the style guide.

## Workspace

Create a project with `npm run new-video -- my-video`. Keep source media, EDLs,
transcripts, compositions, and renders together under `video-projects/<slug>/`.
Run HyperFrames from that project's directory. The root `scripts/` utilities
accept paths from the working directory. `style-library/registry.json` indexes
cards; each style has a DESIGN.md, CSS tokens, and named text slots.
See `style-templates/README.md` for whole-scene templates.

Preserve raw files. Use a new output filename for each editing stage. Archive
obsolete work. Video projects, personal footage, transcripts, credentials, and
renders are gitignored. The 12 already-published projects are retained as teaching examples; new private
projects stay ignored. Do not treat existing public examples as permission to add
new personal footage. Never print secrets or copy private media into library examples.

## Editing and timing

Before choosing a transcription, asset-generation, or voiceover service, read
`docs/TOOLS-AND-API-KEYS.md` and check the user's provider choice and local setup.
ElevenLabs Scribe is Nate's default; honor requests for OpenAI Whisper, local
Whisper, or another provider. Normalize verified word timestamps for the cutting
tools. The included transcription script is ElevenLabs-only. Kie.ai is optional
and needs a configured integration and credits. Reuse existing transcripts and
assets; make any unapproved uploads or paid calls concrete before asking.

Cut silences first; use its edited video AND retimed transcript for cut-mistakes.
Review each mistake in context. Intentional repetition is not a mistake. Record
the reviewed decisions before applying them. If no cuts are needed, preserve the
input or use an empty cuts list. Never mix original timestamps with edited footage.

Load the relevant skills before changing HTML. Root compositions use a visible
div with id, data-composition-id, data-start, duration, width, and height. Timed
elements carry data-start, data-duration, and data-track-index; same-track clips
must not overlap. Visible timed divs use class="clip"; videos do not.
Mute videos and use sibling audio for the mix. Animate a non-timed video wrapper.
Register one synchronous paused GSAP timeline per composition in window.__timelines
using its exact composition ID. Keep finite timelines and explicit durations.
HyperFrames owns media playback. Use deterministic animation and local assets.

## Verification and approvals

Run `node scripts/preflight.mjs <project>` and HyperFrames lint. For anchored
sub-compositions, run `node scripts/validate-beat-sync.mjs <project>`; each beat
needs data-anchor with an exact transcript phrase. Enter between 0.2 seconds after
and 1.8 seconds before that word. Inline timelines require manual timing review.

Review Studio before draft rendering. Review the encoded draft, extract and
inspect hero frames and transition boundaries, and listen to the audio joins.
Check cropped faces, overflow, black flashes, readable labels, clipping, and A/V
sync. Resolve problems before the final render. Save evidence in VERIFY.md.
Use a Range-capable preview server for MP4 scrubbing (for example `npx serve`).

Honor approvals already provided. When review approval is missing, prepare the
concrete preview or cut proposal first. Never claim a lint result proves visual
quality. Only publish or upload a finished video when the user authorizes it.
Automated browser checks must be headless, with Pointer Lock and cursor capture
disabled; synthetic input must remain inside the virtual browser.

For short-form edits, read `docs/SHORT-FORM.md` and use the plan and footage
validators. Structural checks supplement rendered video and audio review.

## IGNITE Reel Kit (overrides the kit defaults above)

This copy is the IGNITE Reel Kit: Nate Herk's HyperFrames student kit (MIT, credit kept in LICENSE and
README) plus IGNITE's reel workflow, shared with IGNITE IBs. The person using it is an IB making reels of
their own videos. They may be new to Claude Code: plain English, short messages, never assume they code.

- First time (no `brand/brand.json`): run the `reel-setup` skill. It checks/installs the tools and
  builds their brand kit. Never skip it.
- Every reel request: follow the `ignite-reel` skill (it covers cutting, captions, graphics, music, the
  social captions run through the `human-speak` skill, and trial-reel variants).
- Every carousel request (the dashboard's Carousel Builder, `dashboard/carousels/<id>/CAROUSEL.md`): follow
  the `ignite-carousel` skill. You write `draft.json` (slides + caption, with `human-speak`); the user edits
  the words on the dashboard and makes the images there (`scripts/carousel.mjs`).
- Anything said about Ignite (reels, carousels, captions): facts ONLY from `library/ignite/IGNITE.md` (Lee keeps
  it up to date; skip [CHECK] items). Ignite's pictures: `library/ignite/images.json`.
- Their settings live in `brand/brand.json` (name, logo, accent colour, website, usual CTA,
  voice, defaults). No header bar and no IGNITE branding unless the user asks: their logo is a small
  corner badge and their accent colour runs through the styling. Use them; don't ask again for things already saved there.
- Free and local only: transcription is faster-whisper on their computer (`npm run transcribe`). Don't
  use paid services (ElevenLabs, OpenAI, Kie.ai) unless the user asks. B-roll: the IGNITE Hub library
  (`library/hub/`) or free Pexels clips.
- Works on Mac and Windows. Use node scripts (not bash-only tricks) and quote paths with spaces.
- Compliance: trading content. No income promises, examples marked as examples, and a risk line in
  captions that promote trading or the IB programme (`brand.json` "risk_line").
- Never post anything online for them. Hand them the files and captions.
