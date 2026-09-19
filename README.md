# Butter Battle

A phone-first party game. One person opens a Kitchen, friends join by code or link, and you battle to write the funniest answers.

## Run locally

```bash
npm install
npm test
npm run dev
```

Then open the Vite URL (printed in the terminal, usually `http://localhost:5173`) on your phone or laptop.

- **Create a Kitchen**, share the 4-letter code or `/k/CODE` link.
- Need 4 players to start. The host can tap **Invite the pantry** to add practice bots.
- Server: `http://localhost:3001` (Socket.IO). Vite proxies `/socket.io` in dev.

## Stack

- `shared/` — types, pairing, scoring, awards (Vitest)
- `server/` — Express + Socket.IO, authoritative game state
- `client/` — Vite + React, mobile-first
- `packs/` — curated prompts

See `PRD.md` for the full game design.

## Production (one process)

```bash
npm run build    # Vite client → client/dist
PORT=3001 npm start
```

Open `http://localhost:3001` (not the Vite port). Live rooms are snapshotted to SQLite (`server/data/butter.db` locally, `/data/butter.db` on Fly).

## Deploy to Fly.io

Needs a Fly account (`fly auth login`). This is a few dollars/month for a tiny always-on VM + 1 GB disk — not a second free Railway/Render app.

```bash
fly launch --no-deploy --copy-config --name butter-battle
fly volumes create butter_data --size 1 --region sjc
fly deploy
```

Then open `https://butter-battle.fly.dev` on a phone that is **not** on your Wi-Fi.

- One machine only (`min_machines_running = 1`). Do not scale out — rooms live in that process’s memory, with SQLite as a crash cushion.
- iOS join links require HTTPS (Fly provides it).
