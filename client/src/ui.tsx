import type { PublicPlayer, RoomSnapshot } from "@butter/shared";
import { monogram } from "@butter/shared";
import { useEffect, useState } from "react";

export function useCountdown(endsAt?: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, (endsAt ?? 0) - Date.now()));
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [endsAt]);
  return Math.ceil(left / 1000);
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      {children}
    </div>
  );
}

export function Wordmark({ small }: { small?: boolean }) {
  return (
    <div className={small ? "text-center" : "py-8 text-center"}>
      <p
        className="font-display text-butter drop-shadow-sm"
        style={{ fontSize: small ? 22 : 44 }}
      >
        Butter Battle
      </p>
      {!small && (
        <p className="mt-1 text-sm text-crust/70">
          butter them up. win the kitchen.
        </p>
      )}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  tone = "butter",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "butter" | "ghost" | "crust";
}) {
  const cls =
    tone === "ghost"
      ? "border-2 border-crust/20 bg-white/70 text-crust"
      : tone === "crust"
        ? "bg-crust text-cream"
        : "bg-butter text-ink shadow-[0_4px_0_#c9a015]";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-12 w-full rounded-2xl px-4 text-base font-extrabold disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-crust/80">
        {label}
      </span>
      <input
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full rounded-2xl border-2 border-crust/15 bg-white px-4 text-base outline-none focus:border-gold"
      />
    </label>
  );
}

export function Avatar({
  player,
  size = 40,
}: {
  player: Pick<PublicPlayer, "name" | "color">;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{
        width: size,
        height: size,
        background: player.color,
        fontSize: size * 0.36,
      }}
    >
      {monogram(player.name)}
    </div>
  );
}

export function Timer({ endsAt, label }: { endsAt?: number; label?: string }) {
  const s = useCountdown(endsAt);
  if (!endsAt) return null;
  return (
    <div className="text-center">
      {label && (
        <p className="text-sm font-bold uppercase tracking-widest text-crust/60">{label}</p>
      )}
      <div className={`font-display text-4xl tabular-nums ${s <= 5 ? "text-burnt" : "text-crust"}`}>
        {s}s
      </div>
    </div>
  );
}

export function WaitingOn({ snap }: { snap: RoomSnapshot }) {
  const names = (snap.waitingOn ?? [])
    .map((id) => snap.players.find((p) => p.id === id)?.name)
    .filter(Boolean);
  if (names.length === 0) return null;
  return (
    <p className="mt-3 text-center text-sm text-crust/70">
      Waiting on {names.join(", ")}
    </p>
  );
}

export function ScoreStrip({ snap }: { snap: RoomSnapshot }) {
  const sorted = [...snap.players].sort((a, b) => b.score - a.score);
  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {sorted.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-xs font-bold"
        >
          <Avatar player={p} size={22} />
          {p.score}
        </div>
      ))}
    </div>
  );
}

export const SIZZLES = ["😂", "🔥", "🥰", "🧈", "🫠"];
