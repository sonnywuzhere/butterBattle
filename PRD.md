# PRD — Butter Battle

**A Quiplash-inspired, phone-first party game where friends join a room by code and battle to write the funniest answers.**

| | |
|---|---|
| **Author** | Mary (mary@kineon.io) |
| **Status** | v0.3 — locked for build |
| **Last updated** | September 18, 2026 |
| **Product type** | Real-time multiplayer web game (browser) |
| **Primary goal** | A fun, simple party game for the author and friends |
| **Name** | Butter Battle (private v1; trademark/domain check before any public launch) |

> **How to read this doc.** Sections 1–4 are the "why and what." Section 5 is the core game design. Section 6 covers the twists. Sections 7–9 are UX, technical architecture, and the build plan. Anything marked **[v1]** is in scope for the first playable version; **[Later]** is explicitly deferred.
>
> **v0.3 changes:** Hot off the Pan (speed bonus) is v1; Upset bonus removed; round-type variety (fill-in-the-blank, image caption, everyone-answers) is v1; Kitchen Awards are v1. v0.2: 4–8 players; Triple Churn rotation; scoring callouts; resilience in M1; unified ratings; guaranteed Backup Spread; AI in M3; crash snapshots; join links.

---

## 1. Summary

Butter Battle is a browser-based party game for **4–8 friends** in the same room or on a video call. One person creates a game and shares a short **room code** or **join link**; everyone else joins from their own phone — no app install, no shared "TV" screen required. Players are dealt comedy prompts, write funny answers, and then **vote head-to-head** on whose answer is funnier. Points pile up over a few fast rounds, and a rotating finale crowns the funniest friend.

It borrows Quiplash's proven core loop (write → vote → laugh → score) but is designed from the ground up for a **phone-only, no-host-screen** experience, with **our own scoring and social twists** and a **three-source prompt engine** (hand-written packs + player-written prompts + AI that riffs on what players wrote). The AI source ships in M3, after the loop is fun.

**What makes it ours, not a clone:**
- Runs entirely on each player's phone — no second screen needed.
- A living prompt pool that learns the group's sense of humor (AI generates new prompts in the style of the ones players write) **[M3]**.
- Scoring twists (wagers, streaks, speed, comebacks) that reward boldness and second chances.
- Live reactions, Kitchen Awards, and a "Butter Reel" of the funniest answers.
- A playful **butter/kitchen theme** — you're "buttering up" the crowd to win their votes.

---

## 2. Goals & non-goals

### Goals **[v1]**
- Deliver a complete, genuinely fun game loop for 4–8 friends that plays start-to-finish in **~10–15 minutes**.
- Zero-friction joining: open a link, type a code, pick a name, play.
- Work reliably on phones on typical home Wi-Fi / cellular, tolerating a player briefly dropping and rejoining.
- Be fun enough that the author *wants* to pull it out at the next gathering.

### Non-goals (explicitly out of scope for v1)
- **3-player games** — lobby cannot start below 4. **[Later]**
- **Audience/spectator mode** — only the people playing are in the room. **[Later]**
- Massive scale / thousands of concurrent games.
- Accounts, logins, persistent profiles, friend lists, matchmaking with strangers.
- Monetization, ads, in-app purchases.
- Native mobile apps (it's a responsive web app).
- Content for public/anonymous play with strangers.
- Image-card export of the Butter Reel (in-game replay is v1; shareable cards are Later).

### Success signals
- A full game completes without anyone getting stuck or having to refresh in confusion.
- Friends laugh out loud and ask to play "one more."
- Nobody ever stares at a blank screen because they ran out of time (Backup Spread always fires).
- The author reaches for this instead of opening Jackbox.

---

## 3. Target players & context of use

**Who:** Groups of 4–8 friends who are comfortable being a little silly. Ages skew adult, but the game supports a **Mild** content rating so it can be played with mixed company.

**Where:**
1. **Same room** — everyone on the couch, phones in hand, reading answers aloud and reacting in person.
2. **Remote / video call** — friends on a Zoom/Discord/FaceTime call, each on their own device. Requires a **public HTTPS join link**.

**Key implication of "everything on each device":** Each phone must clearly present *everything* — the prompt, the two competing answers, the vote, the reveal, and the running scores — with enough drama that the reveal still feels like a shared moment. Sockets keep every device in lockstep.

---

## 4. Core experience principles

1. **Fast and forgiving.** Short timers, no dead air, never a blank submission. Momentum over completeness.
2. **The reveal is the payoff.** Even without a TV, the vote reveal should feel like a little drama — synchronized across phones, with a beat before scores drop, plus a "read it aloud" cue for same-room play.
3. **Everyone stays in it.** Comeback mechanics and per-round scoring mean last place after round 1 can still win.
4. **The group's humor, reflected back.** The prompt system should feel like it *gets* this friend group over time. **[M3]**
5. **Frictionless.** If setup takes longer than a round, we've failed.

### 4.1 Theme & in-game naming (butter/kitchen)

Visual direction: warm golds/creams, a cozy kitchen vibe, and a butter-stick mascot ("the Stick") for loading moments.

| Generic mechanic | Butter Battle name | Why it fits |
|---|---|---|
| The lobby / room | **The Kitchen** | Where everyone gathers before things heat up |
| Winning a matchup | **Buttering them up** | You won the crowd over |
| Sweep bonus (win every eligible vote) | **Butter'd!** | You buttered up the *entire* room |
| Tie (votes split evenly) | **Spread Thin** | The votes got spread too thin to score |
| Safety / auto answer | **Backup Spread** | Your emergency answer from the pantry |
| Double-down wager | **Double Butter** | Spread it on thick and risk it |
| Win streak multiplier | **On a Roll** | Bread-roll pun; you're on a hot streak |
| Speed bonus | **Hot off the Pan** | You served it while it was still sizzling |
| Comeback boost for trailers | **Underdough** | The underdog who's ready to rise |
| Fill-in-the-blank round | **Finish the Batter** | Complete the recipe |
| Image-caption round | **Fridge Pic** | Caption what's on the fridge |
| Everyone-answers mid-round | **One Pot** | The whole kitchen answers the same prompt |
| End-game superlatives | **Kitchen Awards** | Silly titles for how you played |
| Live emoji reactions | **Sizzles** | Reactions that pop like butter in a hot pan |
| Finale rotation | **Triple Churn / Three Spreads / The Hot Pan** | Three finale formats; one picked per game |
| End-game highlight replay | **The Butter Reel** | Curtain call for the tastiest answers |
| The winner | **Bread Winner** | The one who earned their bread |
| Content rating scale | **Mild / Salted / Spicy** | A natural butter-flavor progression |
| Prompt packs | **Sweet Cream / House Blend / Salted / Burnt / Spicy** | Mapped onto the rating scale below |

---

## 5. Core game design

### 5.1 Game shape at a glance

A game is a **lobby → optional prompt-writing → 2 regular rounds → 1 finale → results**. Target total time 10–15 min for 4–6 players. Round 1 is always head-to-head (mixed prompt kinds). Round 2 is head-to-head or **One Pot**.

| Phase | What happens | Rough time |
|---|---|---|
| **The Kitchen** (lobby) | Host creates room, others join by code or link, host sets options | Until host starts |
| **Prompt writing** *(optional, M3)* | Each player writes 1–2 custom prompts to seed the pool | ~60s |
| **Round 1** | Head-to-head (classic quip, fill-in-the-blank, and/or image caption mixed in) | ~3–4 min |
| **Round 2** | Same as R1, or **One Pot** (everyone answers one shared prompt) as a change-up; points worth more | ~3–4 min |
| **Finale** | One of three formats, chosen at random (host may override) | ~2–3 min |
| **Results** | Bread Winner crowned, Butter Reel, play-again | ~1 min |

### 5.2 Roles

- **Host** — created the room. Controls settings and pacing (start, skip a stuck player, advance). Also a normal player. If the host disconnects, host powers transfer to the next-joined **connected** player **[v1]**.
- **Player** — anyone in the room (4–8). Everyone writes and votes.
- ~~Audience~~ — **[Later]**.
- **Minimum start:** 4 connected players. **Maximum:** 8. Late join after the game starts is rejected ("this Kitchen is already cooking").

### 5.3 The answering phase

- Each **head-to-head** round, every player is dealt **2 prompts**. **Every prompt is given to exactly two different players**, so each prompt produces a head-to-head pair.
- **Pairing:** players `0..N-1` in join order. Prompt `i` is answered by player `i` and player `(i+1) % N`. Player `i` therefore writes prompts `(i-1+N)%N` and `i`. Valid for N = 4..8.
- Prompts in a head-to-head deal mix three kinds (see 6.2): classic quip, **Finish the Batter** (fill-in-the-blank), and **Fridge Pic** (caption a curated image). Voting is the same for all three: two answers, side by side.
- A regular round may instead be **One Pot**: one shared prompt, everyone writes one answer, then the room votes among N answers (same voting as The Hot Pan finale). Default: Round 1 is always head-to-head; Round 2 is head-to-head unless the host (or the random mix) picks One Pot.
- **Timer:** default **90s** for the pair of prompts. Host-configurable: Fast 60s / Normal 90s / Relaxed 120s.
- **Backup Spread — never be blank:** if a player runs out of time or is skipped, the game auto-submits a pre-written funny fallback from a curated, rating-tagged pool. Backup Spreads are **not** scored differently. This path is guaranteed; there is no "no answer → opponent takes the pool" rule.
- **Double Butter [v1]:** before writing, a player may secretly wager on **one** of their two prompts.

### 5.4 The voting phase

- Head-to-head matchups are revealed **one at a time**, synchronized across all devices.
- The two competing answers are shown side by side **without author names**. Fridge Pic matchups also show the image. **Everyone except the two authors** votes. Authors see a "this one's yours — sit tight" screen.
- One Pot / finale voting shows **N** anonymized answers (one per player); you cannot vote for yourself.
- **Timer:** default **15s** per matchup (Fast 12s / Relaxed 20s), auto-advancing when all eligible votes are in **or** the timer expires.
- After votes close: a 2–3s synced "look at your phones" beat, then names, vote counts, points, and callouts. A "read it aloud" cue is shown for same-room play.
- Compact running scores stay visible during voting.
- **Sizzles [M2]:** emoji reactions during the reveal that pop across everyone's screens.

### 5.5 Scoring (base model)

| Element | Round 1 | Round 2 | Notes |
|---|---|---|---|
| **Points per matchup pool** | 1,000 | 2,000 | `votes / eligible × pool` |
| **Award formula** | `share_of_eligible × pool` | same | Eligible = N − 2. Uncast votes withhold points from both. |
| **Sweep bonus ("Butter'd!")** | +250 | +500 | Winning *every eligible* vote (not merely every cast vote) |
| **Tie ("Spread Thin")** | 0 / 0 | 0 / 0 | Equal votes (including 0–0). Streaks reset. Nobody scores. |
| **Hot off the Pan** | +100 | +200 | First half of players (rounded up) to fully submit both answers, non-empty and not a Backup Spread. Awarded when answering closes, independent of who wins the matchup. |

**Scoring order (required):**
1. Vote share × pool
2. Spread Thin (even split → 0/0) **or** Butter'd bonus
3. Double Butter (win → double those points; lose → forfeit stake 250 / 500; floor at 0)
4. On a Roll (2 consecutive matchup wins +10%, 3+ +20%; reset on loss or Spread Thin)
5. Hot off the Pan (applied when answering closes, not during matchup math)
6. Underdough applies only to finale totals, last place (ties included)

Every non-obvious point change is a **one-line callout** on the matchup-result screen.

### 5.6 The finale — three rotating formats

At `game:start`, the server picks a finale format at random unless the host overrode it in the Kitchen. All three produce **N votable entries** (one per player). Players cannot vote for themselves. One vote per player (plurality). Runner-up (or tied runner-ups) split 25% of the finale pool. Winner (or tied leaders) split the 2,000-point finale pool. Last place(s) going in get **Underdough 1.25×** on their finale points.

| Format | Writing | Voting |
|---|---|---|
| **Triple Churn** | One 3-blank prompt. Each player fills three blanks that form a single joke. | Vote for the funniest complete line. |
| **Three Spreads** | One prompt. Each player writes three short answers, shown as a set. | Vote for a player's whole trio. |
| **The Hot Pan** | One shared prompt. Each player writes one answer. | Vote for the single funniest answer. Fastest finale. |

Backup Spread fires per blank / per answer so nobody is blank.

### 5.7 Results & wrap

- **Bread Winner** crowned, synced across devices.
- **Kitchen Awards [v1]:** silly superlatives on the results screen (see 6.3). Distinct from the Bread Winner.
- **The Butter Reel [M2]:** in-game replay of answers that won by the biggest margins and/or got the most Sizzles. Image-card export is **[Later]**.
- **Play again** keeps the same Kitchen and players, skips prompt-writing, reshuffles prompts. Host can re-enable writing **[M3]**.

---

## 6. Our twists

### 6.1 Scoring twists **[v1, M4]**

| Twist | What it does |
|---|---|
| **Double Butter** | Secretly wager on one of two prompts. Win → those points doubled. Lose → forfeit stake. |
| **On a Roll** | Consecutive matchup wins: 2 in a row = +10%, 3+ = +20%. |
| **Hot off the Pan** | Small bonus for being among the first to fully submit (non-empty, non-backup). First `ceil(N/2)` finishers: +100 in Round 1, +200 in Round 2. Encourages snappy play. Does not apply to Backup Spreads. |
| **Underdough** | Last place(s) going into the finale get 1.25× on finale points. |

Upset bonuses are **not** in the game.

### 6.2 Round-type variety **[v1]**

The two regular rounds are not only classic quips. The engine treats round kind as data so the deal/vote UI can switch without a new phase machine.

| Round type | Kitchen name | What it is | How it plays |
|---|---|---|---|
| Classic quip | **Classic** | Open-ended prompt, write a funny line | Head-to-head, two authors, everyone else votes |
| Fill-in-the-blank | **Finish the Batter** | Prompt with a blank; funniest completion wins | Same H2H voting; answering UI is a single completion field |
| Image caption | **Fridge Pic** | Caption a curated still image shipped with the game | Same H2H voting; answering UI shows the image + caption field. No player uploads. Small in-repo image pack, rating-tagged. |
| Everyone answers one | **One Pot** | All players answer the same prompt, then pick a favorite | N answers on a phone (one per player). Same pattern as The Hot Pan finale; used as a *mid-game* change-up, typically Round 2. |

**Mix rules [v1]:**
- Default mix: both rounds are head-to-head; the H2H prompt deal is a blend of classic + Finish the Batter + Fridge Pic (at least one of each when the pack allows).
- Host can set Round 2 to **One Pot**, or leave it on **Random** (coin flip at `game:start`).
- Finale stays the Triple Churn / Three Spreads / The Hot Pan rotation (5.6). The Hot Pan (finale) and One Pot (mid-round) share voting math but are named and timed as different moments.
- Image captions are **curated assets only** — no search, no user-upload pipeline.

### 6.3 Social & reaction features

| Feature | When |
|---|---|
| **Sizzles** | **[v1, M2]** |
| **The Butter Reel** (in-game) | **[v1, M2]** |
| **Kitchen Awards** | **[v1]** — results screen, after the Bread Winner, before/with the Butter Reel |
| Save/share image cards | **[Later]** |
| GIF answers | **[Later]** |

**Kitchen Awards [v1]** — computed server-side from the finished game. Skip an award if nobody qualifies. A player may win more than one. Bread Winner is *not* an award; it stays the score title.

| Award | Goes to |
|---|---|
| **Butteriest** | Most head-to-head matchup wins (tie: most votes received) |
| **Crowd Favorite** | Most votes received across all matchups + finale |
| **Burnt Toast** | Most matchup losses (tie: largest combined losing margin) |
| **Backup-Spread Survivor** | Used at least one Backup Spread and still won that matchup. If nobody did, skip. |

### 6.4 The prompt engine **[M3]**

Pool assembled from:

1. **Curated built-in packs** — Sweet Cream (Mild), House Blend + Salted (Salted), Burnt + Spicy (Spicy).
2. **Player-submitted prompts** — optional writing phase.
3. **AI-generated prompts, seeded by player submissions** — SpaceXAI / xAI (`XAI_API_KEY`, `https://api.x.ai/v1`, model confirmed at build time). Server-side only. 8s timeout; start anyway on failure.

**Fallbacks:** prompt-writing off → curated only, no LLM call. Too few surviving player prompts → backfill curated, optionally generate from pack style. All non-curated prompts pass a blocklist + optional LLM moderation gated to the room rating. Rejects are silently dropped and backfilled from curated.

---

## 7. UX & flow

### 7.1 Screen inventory **[v1]**

1. **Landing** — Create game or Join game.
2. **Create (host)** — room code + shareable `/k/:code` link; lands in the Kitchen.
3. **Join** — enter room code (or arrive via link) → display name + color/monogram.
4. **The Kitchen (lobby)** — player list; host settings (timer speed, content rating, finale format, Round 2 = H2H / One Pot / random, twist toggles including Hot off the Pan); Start disabled below 4.
5. **Prompt writing** *(M3, if enabled)*.
6. **Answering** — 2 prompts (or 1 shared One Pot prompt); text inputs; fill-in-the-blank or image+caption when the prompt kind requires it; countdown; Double Butter toggle on one H2H prompt.
7. **Waiting** — who's still writing.
8. **Voting** — current matchup; tap to vote or sit tight; running scores; Sizzles bar **[M2]**.
9. **Matchup result** — synced beat, names, votes, points, callouts.
10. **Round scoreboard** — running totals, movement since last round.
11. **Finale** — format-specific writing, then N-entry voting.
12. **Results** — Bread Winner, Kitchen Awards, Butter Reel **[M2]**, Play again.
13. **Disconnected / reconnecting** — auto-rejoin.

Avatars in v1: **color + 2-letter monogram**. No illustrated set.

### 7.2 Critical UX requirements
- Readable at a glance on a phone, one-handed, 44px tap targets.
- Countdowns everywhere.
- Always show who we're waiting on; host can skip.
- Reveal choreography synced across devices.
- Reconnection restores the exact current phase with name/score intact (`localStorage` keyed by room code, not `sessionStorage`).
- Sufficient contrast; don't rely on color alone.

---

## 8. Technical design

### 8.1 Stack **[v1]**
- **Monorepo:** `client/` (Vite + React + TypeScript + Tailwind), `server/` (Node + Express + Socket.IO + TypeScript), `shared/` (types, pairing, scoring, phase helpers, awards — unit-tested), `packs/` (curated JSON + a small Fridge Pic image set).
- **State:** authoritative on the server, in-memory per room, **snapshotted to local JSON/SQLite on every phase change** and restored on boot. Redis / multi-instance is Later.
- **AI [M3]:** server-side xAI, lobby/setup only.
- **Hosting:** one WebSocket-friendly HTTPS dyno (Fly.io / Railway / Render). Required for iOS join links and remote play.

### 8.2 Room & connection model
- 4-character room codes; alphabet drops 0/O/1/I/L.
- Shareable path `/k/:code`.
- Server-issued player ID stored in `localStorage` under the room code.
- Clients send **intents**; server validates, updates, broadcasts a **per-player snapshot**.

### 8.3 Game state machine

```
LOBBY
  → (PROMPT_SUBMIT)         # optional, M3
  → ROUND_ANSWER            # round 1 (always head-to-head; mixed prompt kinds)
  → ROUND_VOTE              # matchup queue; sub-phase voting | reveal
  → ROUND_SCORE
  → ROUND_ANSWER            # round 2 (H2H or One Pot)
  → ROUND_VOTE              # H2H matchup queue, or N-way One Pot vote
  → ROUND_SCORE
  → FINALE_ANSWER
  → FINALE_VOTE
  → FINALE_SCORE
  → GAME_OVER
```

Round kind is data on the round (`head_to_head` | `everyone_answers`), not a new phase. Each phase: entry logic, server timer, valid intents, completion = all submissions **or** timer expired. If connected players drop below 4 for a grace period, the game pauses then ends with a clear message.

### 8.4 Key algorithms
- Prompt-to-player dealing as in 5.3, tested for N = 4..8.
- Vote eligibility: everyone except the two authors (or except yourself, in the finale). Server rejects illegal votes.
- Scoring computed server-side in the order in 5.5.
- Prompt sourcing **[M3]** as in 6.4.

### 8.5 Socket events

| Direction | Event | Payload |
|---|---|---|
| client→server | `room:create` | host name, color, settings |
| client→server | `room:join` | room code, name, color, playerId? |
| client→server | `game:start` | *(host only)* |
| client→server | `prompt:submit` | text *(M3)* |
| client→server | `answer:submit` | promptId, text, doubleDown? |
| client→server | `finale:submit` | answers[] |
| client→server | `vote:cast` | matchupId or 'finale', choice |
| client→server | `react:send` | emoji *(M2)* |
| client→server | `host:advance` / `host:skipPlayer` | *(host only)* |
| server→clients | `state:update` | per-player snapshot |
| server→clients | `react:broadcast` | emoji + fromPlayer *(M2)* |

### 8.6 Resilience **[v1, M1]**
- Disconnect during answering: Backup Spread on timeout/skip; rejoin into current phase.
- Host disconnect: host role auto-transfers.
- Below 4 connected: pause, then end after a grace period.
- Duplicate/late submissions ignored.
- Reconnect: client re-sends player ID; server restores view.
- Timers enforced server-side.
- Room snapshot on every phase change.

---

## 9. Build plan (milestones)

| Milestone | Scope | Outcome |
|---|---|---|
| **M0 — Kitchen** | Monorepo, shared types, Socket.IO rooms, create/join by code and link, lobby, live player list, host settings shell, host transfer | Friends can gather |
| **M1 — Playable loop** | Prompt dealing (classic + fill-in-the-blank + caption kinds), answering + timer + Backup Spread, H2H voting, One Pot as optional Round 2, base scoring, 2 rounds + random finale format, results, reconnect, skip, waiting-on, crash snapshot | A complete curated game that survives real phones |
| **M2 — Feel** | Reveal choreography, Sizzles, Butter Reel, Kitchen Awards, mobile UX pass | It feels like a party, not a form |
| **M3 — Prompt engine** | Player-submitted prompts, xAI generation, moderation gate, content ratings & blend | Games stop feeling repetitive |
| **M4 — Twists** | Double Butter, On a Roll, Hot off the Pan, Underdough, score-callout UI, playtest tuning | Full personality, readable scores |
| **[Later]** | 3-player, audience, GIF answers, share cards, Redis | Post-v1 |

**Playtest gate after M2:** a 4–6 player game on phones over the public URL must finish without a stuck refresh, never leave someone blank, and make people laugh. If it fails, do not start M3 or M4.

---

## 10. Open questions / resolved

1. **Name.** Keep for private v1. TM + domain before any public launch. *The Butter Battle Book* adjacency is accepted for friends-only use.
2. **AI provider.** SpaceXAI / xAI, server-side, M3. Curated-first until then.
3. **Timers.** Answer 90s default / 60 fast / 120 relaxed. Vote 15s / 12 / 20.
4. **Finale weight.** Pool 2,000 + 500 runner-up; Underdough 1.25×. Tune after playtests.
5. **Rating.** Mild / Salted / Spicy. Packs mapped in 4.1. In-repo blocklist + LLM moderation in M3. Curated packs are pre-rated and skip the live gate.
6. **3-player.** Not in v1.

---

*Appendix — Quiplash reference: 3–8 players + audience; two head-to-head rounds; share-of-vote scoring with a round-2 multiplier and a sweep bonus; a three-answer finale; Safety Quips so no one is left blank. We keep that spine and depart on: phone-only / no shared screen, 4–8 only, a rotating three-format finale that always votes among N entries, the three-source prompt engine (M3), and scoring + social twists.*
