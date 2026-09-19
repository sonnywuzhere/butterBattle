import type { FinaleFormat, TimerSpeed } from "./types.js";

export const ANSWER_MS: Record<TimerSpeed, number> = {
  fast: 60_000,
  normal: 90_000,
  relaxed: 120_000,
};

export const VOTE_MS: Record<TimerSpeed, number> = {
  fast: 12_000,
  normal: 15_000,
  relaxed: 20_000,
};

export const REVEAL_MS = 5_000;
export const SCOREBOARD_MS = 8_000;
export const FINALE_REVEAL_MS = 10_000;
export const GRACE_MS = 30_000;

export function finaleAnswerMs(format: FinaleFormat, speed: TimerSpeed): number {
  const base = ANSWER_MS[speed];
  if (format === "hot_pan") return Math.round(base * 0.7);
  if (format === "three_spreads") return Math.round(base * 1.15);
  return base;
}

export function finaleBlanks(format: FinaleFormat): number {
  if (format === "hot_pan") return 1;
  if (format === "three_spreads") return 3;
  return 3;
}
