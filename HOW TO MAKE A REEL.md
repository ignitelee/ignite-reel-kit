# How to make a reel

Everything runs on your own computer. Transcription is free, and nothing is posted anywhere for you.

## The easy way: the dashboard

1. Double-click **IGNITE Reels** on your desktop. Your browser opens the dashboard (leave the small black
   window open while you use it).
2. **Add your video**: drag it into the box.
3. **Choose what you want**: how many reels, where you'll post, captions, graphics, music. Not sure? Leave
   the defaults. Every option has an (i) that explains it.
4. Press **Copy my message**. Open the **Claude app**, click **Code**, check the folder says
   **ignite-reel-kit**, paste the message and press Enter.
5. **Claude will ask you to "Allow" things.** That's normal: it's asking your permission to use the kit's
   tools on your computer. Click Allow.
6. Go back to the dashboard. The progress bar fills in, then your reels appear with **Download** and
   **Copy caption** buttons. It takes 10 to 40 minutes.

## The chat way

Open Claude Code in the **ignite-reel-kit** folder (in your Documents). In the Claude desktop app: Code tab,
new session, choose that folder.

### Drop in your video and say what you want

Drag your video into the chat, then say something like:

> /ignite-reel Make 3 reels from this for Instagram and TikTok. The point is: [one sentence].

Add any of these if you like:
- "Also make the full-length version."
- "No music" or "upbeat music" (or inspiring, calm, emotional).
- "No graphics, just captions."
- "Make 3 trial reel versions of the best one" (same reel, different openings to test).

### What you get back

1. **A draft** to check, plus the hooks Claude chose between. Give notes in plain English
   ("bigger captions", "cut the bit about X", "use hook 2").
2. **The finished reels**: `ignite-reel-kit/video-projects/<name>/renders/<name>.mp4`.
3. **POST.md** next to each reel: captions for each platform, hashtags, a pinned comment and cover text,
   written to sound like you.

## Filming tips (they make better reels)

- Start each point with a strong first sentence. The first 2 seconds decide if people keep watching.
- After a mistake, pause for 2 seconds and restart the whole sentence.
- Keep each idea to 20-60 seconds.
- Face a window or a light, and keep the phone at eye level.
- Phone footage: filming vertical gives the most room for text.

## If something goes wrong

- Claude doesn't know `/ignite-reel`: you're not in the ignite-reel-kit folder (step 1).
- Run `npm run doctor` (or ask Claude "check my reel kit") to see what's missing, then `/reel-setup`.
- Renders are slow: close other big apps. Older laptops take longer but still work.
