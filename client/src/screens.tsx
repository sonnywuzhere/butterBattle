import { PLAYER_COLORS, type RoomSettings, type RoomSnapshot } from "@butter/shared";
import { useState } from "react";
import type { Socket } from "socket.io-client";
import { Avatar, Btn, Field, ScoreStrip, Shell, SIZZLES, Timer, WaitingOn, Wordmark } from "./ui";

export function Landing({
  onCreate,
  onJoin,
}: {
  onCreate: (name: string, color: string) => void;
  onJoin: (code: string, name: string, color: string) => void;
}) {
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState<string>(PLAYER_COLORS[0]);
  return (
    <Shell>
      <Wordmark />
      {mode === "home" && (
        <div className="mt-auto space-y-3">
          <Btn onClick={() => setMode("create")}>Create a Kitchen</Btn>
          <Btn tone="ghost" onClick={() => setMode("join")}>
            Join with a code
          </Btn>
        </div>
      )}
      {mode !== "home" && (
        <div className="space-y-4">
          <Field label="Your name" value={name} onChange={setName} maxLength={18} placeholder="Ada" />
          <p className="text-sm font-bold text-crust/80">Color</p>
          <div className="flex flex-wrap gap-2">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-10 w-10 rounded-full border-4"
                style={{ background: c, borderColor: color === c ? "#2A1C12" : "transparent" }}
              />
            ))}
          </div>
          {mode === "join" && (
            <Field
              label="Kitchen code"
              value={code}
              onChange={(v) => setCode(v.toUpperCase())}
              maxLength={4}
              placeholder="AB7K"
            />
          )}
          <Btn
            disabled={!name.trim() || (mode === "join" && code.trim().length < 4)}
            onClick={() =>
              mode === "create" ? onCreate(name.trim(), color) : onJoin(code.trim(), name.trim(), color)
            }
          >
            {mode === "create" ? "Open the Kitchen" : "Join"}
          </Btn>
          <Btn tone="ghost" onClick={() => setMode("home")}>
            Back
          </Btn>
        </div>
      )}
    </Shell>
  );
}

export function KitchenLobby({
  snap,
  socket,
  youAreHost,
}: {
  snap: RoomSnapshot;
  socket: Socket;
  youAreHost: boolean;
}) {
  const s = snap.settings;
  const canStart = snap.players.filter((p) => p.connected).length >= 4;
  const link = `${window.location.origin}/k/${snap.code}`;
  return (
    <Shell>
      <Wordmark small />
      {youAreHost && (
        <div className="mb-3">
          <Btn disabled={!canStart} onClick={() => socket.emit("game:start")}>
            {canStart ? "Start cooking" : "Need 4 in the Kitchen"}
          </Btn>
        </div>
      )}
      <div className="rounded-3xl bg-white/80 p-4 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-crust/60">Kitchen code</p>
        <p className="font-display text-5xl tracking-[0.2em]">{snap.code}</p>
        <button
          type="button"
          className="mt-2 text-sm font-bold text-burnt underline"
          onClick={() => navigator.clipboard.writeText(link)}
        >
          Copy join link
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {snap.players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2">
            <Avatar player={p} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">
                {p.name} {p.isHost && <span className="text-xs text-gold">host</span>}
                {p.isBot && <span className="text-xs text-crust/50"> pantry</span>}
              </p>
              {!p.connected && <p className="text-xs text-burnt">reconnecting…</p>}
            </div>
          </li>
        ))}
      </ul>
      {youAreHost && (
        <div className="mt-4 space-y-3 rounded-3xl bg-white/70 p-4">
          <Setting
            label="Heat"
            value={s.rating}
            options={[
              ["mild", "Mild"],
              ["salted", "Salted"],
              ["spicy", "Spicy"],
            ]}
            onChange={(rating) => socket.emit("host:updateSettings", { rating })}
          />
          <Setting
            label="Timer"
            value={s.timerSpeed}
            options={[
              ["fast", "Fast"],
              ["normal", "Normal"],
              ["relaxed", "Relaxed"],
            ]}
            onChange={(timerSpeed) => socket.emit("host:updateSettings", { timerSpeed })}
          />
          <Setting
            label="Round 2"
            value={s.round2}
            options={[
              ["random", "Surprise me"],
              ["head_to_head", "Head-to-head"],
              ["everyone_answers", "One Pot"],
            ]}
            onChange={(round2) => socket.emit("host:updateSettings", { round2 })}
          />
          <Setting
            label="Finale"
            value={s.finaleFormat}
            options={[
              ["random", "Random"],
              ["triple_churn", "Triple Churn"],
              ["three_spreads", "Three Spreads"],
              ["hot_pan", "The Hot Pan"],
            ]}
            onChange={(finaleFormat) => socket.emit("host:updateSettings", { finaleFormat })}
          />
          <Btn tone="ghost" onClick={() => socket.emit("host:fillBots")}>
            Invite the pantry (practice friends)
          </Btn>
        </div>
      )}
      <div className="mt-auto space-y-2 pt-4">
        {snap.notice && <p className="text-center text-sm text-burnt">{snap.notice}</p>}
        {youAreHost ? (
          <Btn disabled={!canStart} onClick={() => socket.emit("game:start")}>
            {canStart ? "Start cooking" : "Need 4 in the Kitchen"}
          </Btn>
        ) : (
          <p className="text-center text-sm text-crust/70">Waiting for the host to start…</p>
        )}
      </div>
    </Shell>
  );
}

function Setting<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-bold text-crust/80">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1 min-h-11 w-full rounded-xl border-2 border-crust/10 bg-white px-3 font-bold"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AnswerScreen({ snap, socket }: { snap: RoomSnapshot; socket: Socket }) {
  const prompts = snap.yourPrompts ?? [];
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [wager, setWager] = useState<string | null>(null);
  const remaining = prompts.filter((p) => !p.submitted);
  return (
    <Shell>
      <Header snap={snap} title={snap.roundKind === "everyone_answers" ? "One Pot" : `Round ${snap.round}`} />
      <RulesCard text={answerRules(snap)} />
      <Timer endsAt={snap.timerEndsAt} />
      <div className="mt-4 space-y-5">
        {prompts.map((p) => (
          <div key={p.id} className="rounded-3xl bg-white/80 p-4">
            {p.imageUrl && <img src={p.imageUrl} alt="" className="mb-3 w-full rounded-2xl" />}
            <p className="font-display text-xl">{p.text}</p>
            {p.submitted ? (
              <p className="mt-3 text-sm font-bold text-gold">In the pan.</p>
            ) : (
              <>
                <textarea
                  value={texts[p.id] ?? ""}
                  maxLength={140}
                  rows={3}
                  onChange={(e) => setTexts({ ...texts, [p.id]: e.target.value })}
                  className="mt-3 min-h-[88px] w-full rounded-2xl border-2 border-crust/10 bg-cream p-3 outline-none focus:border-gold"
                  placeholder={p.kind === "fill_blank" ? "finish it…" : "butter them up…"}
                />
                {snap.settings.doubleButter && remaining.length > 0 && snap.roundKind !== "everyone_answers" && (
                  <label className="mt-2 flex items-center gap-2 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={wager === p.id}
                      onChange={() => setWager(wager === p.id ? null : p.id)}
                    />
                    Double Butter this one
                  </label>
                )}
                <div className="mt-3">
                  <Btn
                    disabled={!(texts[p.id] ?? "").trim()}
                    onClick={() =>
                      socket.emit("answer:submit", {
                        promptId: p.id,
                        text: texts[p.id],
                        doubleButter: wager === p.id,
                      })
                    }
                  >
                    Serve
                  </Btn>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <WaitingOn snap={snap} />
      {snap.players.find((p) => p.id === snap.youId)?.isHost && (snap.waitingOn ?? []).length > 0 && (
        <div className="mt-4 space-y-2">
          {(snap.waitingOn ?? []).map((id) => (
            <Btn key={id} tone="ghost" onClick={() => socket.emit("host:skipPlayer", id)}>
              Skip {snap.players.find((p) => p.id === id)?.name}
            </Btn>
          ))}
        </div>
      )}
    </Shell>
  );
}

export function VoteScreen({ snap, socket }: { snap: RoomSnapshot; socket: Socket }) {
  const m = snap.matchup;
  if (!m) return null;
  return (
    <Shell>
      <Header snap={snap} title={`Matchup ${m.index + 1} / ${m.total}`} />
      <RulesCard text={voteRules(snap)} />
      <ScoreStrip snap={snap} />
      <Timer endsAt={snap.timerEndsAt} />
      <p className="mt-2 text-center font-display text-lg">{m.promptText}</p>
      {m.imageUrl && <img src={m.imageUrl} alt="" className="mx-auto mt-2 max-h-40 rounded-2xl" />}
      {m.youAreAuthor ? (
        <p className="mt-8 text-center font-display text-2xl">This one's yours — sit tight.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {(["A", "B"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => socket.emit("vote:cast", { matchupId: m.id, choice: side })}
              className={`min-h-24 rounded-3xl p-4 text-left text-lg font-bold ${
                m.youVoted === side ? "bg-butter" : "bg-white/80"
              }`}
            >
              {side === "A" ? m.answerA : m.answerB}
            </button>
          ))}
        </div>
      )}
      <SizzleBar socket={socket} />
    </Shell>
  );
}

export function BallotScreen({ snap, socket }: { snap: RoomSnapshot; socket: Socket }) {
  const b = snap.ballot;
  if (!b) return null;
  return (
    <Shell>
      <Header snap={snap} title={snap.phase === "finale_vote" ? finaleTitle(snap) : "One Pot"} />
      <RulesCard text={voteRules(snap)} />
      <Timer endsAt={snap.timerEndsAt} />
      <p className="mt-2 font-display text-xl">{b.promptText}</p>
      <div className="mt-4 space-y-2">
        {b.entries
          .filter((e) => e.id !== snap.youId)
          .map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => socket.emit("vote:cast", { matchupId: "ballot", choice: e.id })}
              className={`min-h-16 w-full rounded-3xl p-4 text-left font-bold ${
                b.youVoted === e.id ? "bg-butter" : "bg-white/80"
              }`}
            >
              {e.rendered}
            </button>
          ))}
      </div>
      <SizzleBar socket={socket} />
    </Shell>
  );
}

export function RevealScreen({
  snap,
  socket,
  youAreHost,
}: {
  snap: RoomSnapshot;
  socket?: Socket;
  youAreHost?: boolean;
}) {
  const r = snap.reveal;
  if (!r) return <NWayReveal snap={snap} socket={socket} youAreHost={youAreHost} />;
  return (
    <Shell>
      <Header snap={snap} title="Look at your phones" />
      <Timer endsAt={snap.timerEndsAt} label="Next in" />
      <p className="text-center text-sm font-bold text-crust/60">read it aloud</p>
      <p className="mt-3 text-center font-display text-lg">{r.promptText}</p>
      <div className="mt-4 space-y-3">
        <RevealCard
          player={r.authorA}
          answer={r.answerA}
          votes={r.votesA}
          points={r.pointsA}
          win={r.winner === "A"}
        />
        <RevealCard
          player={r.authorB}
          answer={r.answerB}
          votes={r.votesB}
          points={r.pointsB}
          win={r.winner === "B"}
        />
      </div>
      {r.winner === "tie" && (
        <p className="mt-4 text-center font-display text-2xl">Spread Thin — nobody scores</p>
      )}
      <ul className="mt-4 space-y-1 text-center text-sm font-bold text-burnt">
        {r.callouts.map((c, i) => (
          <li key={i}>{c.text}</li>
        ))}
      </ul>
      <SkipWait socket={socket} youAreHost={youAreHost} />
    </Shell>
  );
}

function NWayReveal({
  snap,
  socket,
  youAreHost,
}: {
  snap: RoomSnapshot;
  socket?: Socket;
  youAreHost?: boolean;
}) {
  const r = snap.finaleReveal;
  if (!r) return null;
  return (
    <Shell>
      <Header snap={snap} title="The crowd has spoken" />
      <Timer endsAt={snap.timerEndsAt} label="Next in" />
      <p className="font-display text-lg">{r.promptText}</p>
      <ul className="mt-4 space-y-2">
        {r.results.map((row) => (
          <li key={row.playerId} className="rounded-2xl bg-white/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold">{row.name}</span>
              <span className="text-sm">
                {row.votes} votes · +{row.points}
              </span>
            </div>
            <p className="mt-1">{row.rendered}</p>
            {row.callouts.map((c) => (
              <p key={c} className="text-xs font-bold text-burnt">
                {c}
              </p>
            ))}
          </li>
        ))}
      </ul>
      <SkipWait socket={socket} youAreHost={youAreHost} />
    </Shell>
  );
}

function RevealCard({
  player,
  answer,
  votes,
  points,
  win,
}: {
  player: { name: string; color: string };
  answer: string;
  votes: number;
  points: number;
  win: boolean;
}) {
  return (
    <div className={`rounded-3xl p-4 ${win ? "bg-butter" : "bg-white/80"}`}>
      <div className="mb-2 flex items-center gap-2">
        <Avatar player={player} size={32} />
        <span className="font-extrabold">{player.name}</span>
      </div>
      <p className="text-lg font-bold">{answer}</p>
      <p className="mt-2 text-sm font-bold">
        {votes} votes · {points > 0 ? `+${points}` : points}
      </p>
    </div>
  );
}

export function Scoreboard({
  snap,
  nested,
  socket,
  youAreHost,
}: {
  snap: RoomSnapshot;
  nested?: boolean;
  socket?: Socket;
  youAreHost?: boolean;
}) {
  const body = (
    <>
      {!nested && <Header snap={snap} title={snap.phase === "finale_score" ? "Finale" : `Round ${snap.round}`} />}
      {!nested && <Timer endsAt={snap.timerEndsAt} label={scoreboardLabel(snap)} />}
      <ul className={nested ? "space-y-2" : "mt-4 space-y-2"}>
        {(snap.standings ?? []).map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-3">
            <span className="w-6 font-display text-xl">{i + 1}</span>
            <Avatar player={p} />
            <span className="flex-1 font-extrabold">{p.name}</span>
            <span className="text-right">
              <b>{p.score}</b>
              <span className="block text-xs text-gold">+{p.delta}</span>
            </span>
          </li>
        ))}
      </ul>
      {!nested && <SkipWait socket={socket} youAreHost={youAreHost} />}
    </>
  );
  return nested ? body : <Shell>{body}</Shell>;
}

export function FinaleAnswer({ snap, socket }: { snap: RoomSnapshot; socket: Socket }) {
  const f = snap.finale;
  const [answers, setAnswers] = useState<string[]>(f?.yourAnswers ?? [""]);
  if (!f) return null;
  const labels =
    f.format === "triple_churn"
      ? Array.from({ length: f.blanks }, (_, i) => `Blank ${i + 1}`)
      : f.format === "three_spreads"
        ? ["Spread 1", "Spread 2", "Spread 3"]
        : ["Your line"];
  return (
    <Shell>
      <Header snap={snap} title={finaleTitle(snap)} />
      <RulesCard text={answerRules(snap)} />
      <Timer endsAt={snap.timerEndsAt} />
      <p className="mt-3 font-display text-xl">{f.promptText}</p>
      {f.submitted ? (
        <p className="mt-6 text-center font-bold text-gold">Churned.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {labels.map((label, i) => (
            <Field
              key={label}
              label={label}
              value={answers[i] ?? ""}
              onChange={(v) => {
                const next = [...answers];
                next[i] = v;
                setAnswers(next);
              }}
              maxLength={80}
            />
          ))}
          <Btn onClick={() => socket.emit("finale:submit", { answers })}>Serve the finale</Btn>
        </div>
      )}
      <WaitingOn snap={snap} />
    </Shell>
  );
}

export function Results({ snap, socket, youAreHost }: { snap: RoomSnapshot; socket: Socket; youAreHost: boolean }) {
  const winner = snap.players.find((p) => p.id === snap.winnerId);
  return (
    <Shell>
      <p className="text-center text-sm font-bold uppercase tracking-widest text-crust/60">Bread Winner</p>
      {winner && (
        <div className="mt-2 flex flex-col items-center">
          <Avatar player={winner} size={72} />
          <p className="mt-2 font-display text-3xl">{winner.name}</p>
          <p className="font-bold">{winner.score} pts</p>
        </div>
      )}
      {(snap.awards ?? []).length > 0 && (
        <div className="mt-6">
          <p className="mb-2 font-display text-xl">Kitchen Awards</p>
          <ul className="space-y-2">
            {snap.awards!.map((a) => (
              <li key={a.id} className="rounded-2xl bg-white/80 p-3">
                <p className="font-extrabold">{a.title}</p>
                <p className="text-sm text-crust/70">{a.subtitle}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(snap.reel ?? []).length > 0 && (
        <div className="mt-6">
          <p className="mb-2 font-display text-xl">The Butter Reel</p>
          <ul className="space-y-2">
            {snap.reel!.map((h, i) => (
              <li key={i} className="rounded-2xl bg-white/80 p-3">
                <p className="text-xs text-crust/60">{h.promptText}</p>
                <p className="font-bold">{h.answer}</p>
                <p className="text-xs">{h.authorName}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6">
        <p className="mb-2 font-display text-xl">Standings</p>
        <Scoreboard snap={snap} nested />
      </div>
      {youAreHost && (
        <div className="mt-4">
          <Btn onClick={() => socket.emit("game:playAgain")}>Play again</Btn>
        </div>
      )}
    </Shell>
  );
}

function Header({ snap, title }: { snap: RoomSnapshot; title: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p className="font-display text-xl">{title}</p>
      <p className="text-xs font-bold tracking-widest text-crust/50">{snap.code}</p>
    </div>
  );
}

function RulesCard({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="mb-2 rounded-2xl bg-white/80 px-3 py-2 text-sm leading-snug text-crust/80">{text}</p>
  );
}

function answerRules(snap: RoomSnapshot): string {
  const wager = snap.settings.doubleButter
    ? " You can Double Butter one prompt: win doubles those points, lose costs a stake."
    : "";
  if (snap.phase === "finale_answer") {
    const format = snap.finale?.format;
    if (format === "three_spreads") {
      return "Write 3 short answers to one prompt. They stay together as your set. Then the room votes for a whole trio — not yours.";
    }
    if (format === "hot_pan") {
      return "1 prompt, 1 answer. Fast. Then pick your favorite — not your own.";
    }
    return "Fill 3 blanks to make one joke. Everyone writes their own. Then vote for the funniest complete line — not yours.";
  }
  if (snap.roundKind === "everyone_answers") {
    return "Everyone answers the same 1 prompt. Then the room picks a favorite (not your own). Points are worth more this round.";
  }
  if (snap.round === 2) {
    return `Same deal: 2 answers, each a head-to-head. Points are worth more this round.${wager}`;
  }
  return `Write 2 answers. Each prompt is a head-to-head: someone else is writing the same one, then the room votes.${wager} Some prompts are fill-in-the-blank or a fridge pic.`;
}

function voteRules(snap: RoomSnapshot): string {
  if (snap.phase === "finale_vote" || snap.roundKind === "everyone_answers") {
    const format = snap.finale?.format ?? snap.finaleReveal?.format;
    if (snap.phase === "finale_vote" && format === "three_spreads") {
      return "Pick a whole trio. You can't vote for yourself.";
    }
    if (snap.phase === "finale_vote" && format === "triple_churn") {
      return "Pick the funniest complete line. You can't vote for yourself.";
    }
    return "Pick one favorite. You can't vote for yourself.";
  }
  if (snap.matchup?.youAreAuthor) {
    return "This one's yours — you don't vote. Watch the room pick.";
  }
  return "Two anonymous answers. Everyone except the two writers picks the funnier one.";
}

function scoreboardLabel(snap: RoomSnapshot) {
  if (snap.phase === "finale_score") return "Results in";
  if (snap.round === 2) return "Finale in";
  return "Next round in";
}

function SkipWait({ socket, youAreHost }: { socket?: Socket; youAreHost?: boolean }) {
  if (!youAreHost || !socket) return null;
  return (
    <div className="mt-6">
      <Btn tone="ghost" onClick={() => socket.emit("host:advance")}>
        Skip wait
      </Btn>
    </div>
  );
}

function SizzleBar({ socket }: { socket: Socket }) {
  return (
    <div className="mt-auto flex justify-center gap-2 pt-6">
      {SIZZLES.map((e) => (
        <button
          key={e}
          type="button"
          className="h-12 w-12 rounded-full bg-white text-xl shadow-sm"
          onClick={() => socket.emit("react:send", { emoji: e })}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function finaleTitle(snap: RoomSnapshot) {
  const f = snap.finale?.format ?? snap.finaleReveal?.format;
  if (f === "three_spreads") return "Three Spreads";
  if (f === "hot_pan") return "The Hot Pan";
  return "Triple Churn";
}

export type { RoomSettings };
