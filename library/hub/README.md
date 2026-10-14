# IGNITE Hub B-roll library

Phone-screen clips of the IGNITE members Hub and the IGNITE Edge tool (800x1600 unless noted, 30 fps, silent): a short hold, a smooth scroll,
the Hub's top bar fixed like the real app. Captured on a demo account with the account number and member
name hidden. The dashboard and trades figures are demo data, set to look like a typical account: they show
what the Hub tracks, not anyone's real results.

| File | Shows | Use when they talk about |
| --- | --- | --- |
| `education.mp4` (9 s) | Ignite Academy: How to trade the signals, Trading Essentials, Smart Money Concepts, the book library, Steve's training, trading room recordings | courses, learning, beginners, education, training |
| `sparkie-review.mp4` (14 s) | Sparkie, the AI coach, reviewing the day's trades: "Can you analyse my trades from today?", a table of the trades, then his feedback (sizing, laddered entries, stops, no take-profit set, a question about an early exit) | the AI coach, trade feedback, reviewing your trades, learning from losses |
| `sparkie.mp4` (14 s) | Sparkie answering a question: "What is a pip?" is asked (0-3 s), then the answer scrolls by (forex pips, Ignite's gold pip, lot-size table, the MT5 points tip) | asking questions, help any time, learning the basics |
| `dashboard.mp4` (36 s) | the whole member dashboard, top to bottom: balance, win rate, P&L, drawdown, best/worst day (0-6 s); trade sources, balance chart, symbol (6-12 s); daily P&L, quick stats, risk (12-17 s); performance, account growth, growth chart (17-24 s); today/week/month, trading calendar, advanced stats (24-30 s); monthly analytics, symbols, day/hour charts, trade duration (30-36 s) | tracking your trading, stats, everything in one place |
| `trades.mp4` (20 s) | every trade listed with entry, exit, SL/TP, P&L (wins and losses) and the desk signal it came from (MAIN, SCALPER) | trade tracking, signals, seeing every trade |
| `edge-panel.mp4` (20 s, tall) | the IGNITE Edge panel in MetaTrader 5 managing three open trades: layer buy/sell buttons, strategy (Manual / NY-LON / Scalpers), positions with live P&L, TP/SL, 25% / 50% / close, trail on, break even, daily P&L and target | Edge, the trading tool, managing trades, layering, trailing stops, break even |
| `edge-chart.mp4` (20 s, wide 1280x720) | the gold chart (XAUUSD, 1 minute) with Edge's entry and stop-loss lines as price moves | Edge on the chart, entries and stops, trading gold live (use as a `clip`, or in a laptop frame) |
| `onboarding.mp4` (24 s) | "Unlock the Ignite Ecosystem": the 6 joining steps (country, PU Prime account check, open broker account, create a Standard STP account, fund your account with the Intro £300+ / Pro £750+ / Elite £1,000+ tiers and the deposit bonus), ending on "You're approved, welcome in!" with the welcome video | how to join, getting started, signing up, how easy it is, the tiers |
| `calendar.mp4` (6 s) | the month's live sessions: training with Steve, trading rooms, discovery calls | live calls, weekly sessions, events, community |

Use in a reel: copy the clip into the project's `assets/` and show it with a `phone` graphic on a card, e.g.
`{"type": "phone", "pos": "card", "src": "assets/education.mp4", "at": "our education", "until": "...", "label": "IGNITE Academy", "icon": "school"}`.
The long clips (dashboard, trades) are meant to be used in parts: add `"media_start": 12` (seconds) to start
the phone video at the section that matches the words, e.g. the daily P&L chart.

Rebuild (for maintainers): page captures live in `_captures/<topic>/` (not shared); run
`node scripts/hub-clips.mjs`. A topic's `manifest.json` can set `duration`, `"ease": "linear"` (steady scroll
for long pages), `zoom` (e.g. 1.1) and `intro` (still frames shown first, e.g. a question being asked).
