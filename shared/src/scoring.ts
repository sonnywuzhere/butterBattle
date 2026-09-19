import type { FinaleFormat } from "./types.js";

export const ROUND_POOL = { 1: 1000, 2: 2000 } as const;
export const SWEEP_BONUS = { 1: 250, 2: 500 } as const;
export const DOUBLE_BUTTER_STAKE = { 1: 250, 2: 500 } as const;
export const FINALE_POOL = 2000;
export const FINALE_RUNNER_UP = 500;
export const UNDERDOUGH_MULT = 1.25;
export const SPEED_BONUS = { 1: 100, 2: 200 } as const;

export type Side = "A" | "B";

export interface MatchupScoreInput {
  votesA: number;
  votesB: number;
  eligible: number;
  round: 1 | 2;
  doubleButterA: boolean;
  doubleButterB: boolean;
  streakA: number;
  streakB: number;
  doubleButterEnabled: boolean;
  onARollEnabled: boolean;
}

export interface MatchupScoreOutput {
  votesA: number;
  votesB: number;
  eligible: number;
  winner: "A" | "B" | "tie";
  pointsA: number;
  pointsB: number;
  calloutsA: string[];
  calloutsB: string[];
  newStreakA: number;
  newStreakB: number;
}

function streakMult(winsBefore: number): number {
  const after = winsBefore + 1;
  if (after >= 3) return 1.2;
  if (after >= 2) return 1.1;
  return 1;
}

function applyFloor(n: number): number {
  return Math.max(0, Math.round(n));
}

export function scoreMatchup(input: MatchupScoreInput): MatchupScoreOutput {
  const { votesA, votesB, eligible, round } = input;
  const pool = ROUND_POOL[round];
  const sweep = SWEEP_BONUS[round];
  const stake = DOUBLE_BUTTER_STAKE[round];

  const calloutsA: string[] = [];
  const calloutsB: string[] = [];

  if (votesA === votesB) {
    return {
      votesA,
      votesB,
      eligible,
      winner: "tie",
      pointsA: 0,
      pointsB: 0,
      calloutsA: ["Spread Thin — nobody scores"],
      calloutsB: ["Spread Thin — nobody scores"],
      newStreakA: 0,
      newStreakB: 0,
    };
  }

  const winner: Side = votesA > votesB ? "A" : "B";
  let pointsA = eligible > 0 ? (votesA / eligible) * pool : 0;
  let pointsB = eligible > 0 ? (votesB / eligible) * pool : 0;

  if (winner === "A" && votesA === eligible && eligible > 0) {
    pointsA += sweep;
    calloutsA.push("Butter'd!");
  }
  if (winner === "B" && votesB === eligible && eligible > 0) {
    pointsB += sweep;
    calloutsB.push("Butter'd!");
  }

  if (input.doubleButterEnabled) {
    if (input.doubleButterA) {
      if (winner === "A") {
        pointsA *= 2;
        calloutsA.push("Double Butter paid off");
      } else {
        pointsA -= stake;
        calloutsA.push("Double Butter burned");
      }
    }
    if (input.doubleButterB) {
      if (winner === "B") {
        pointsB *= 2;
        calloutsB.push("Double Butter paid off");
      } else {
        pointsB -= stake;
        calloutsB.push("Double Butter burned");
      }
    }
  }

  let newStreakA = winner === "A" ? input.streakA + 1 : 0;
  let newStreakB = winner === "B" ? input.streakB + 1 : 0;

  if (input.onARollEnabled) {
    if (winner === "A" && newStreakA >= 2) {
      const m = streakMult(input.streakA);
      pointsA *= m;
      calloutsA.push(m >= 1.2 ? "On a Roll ×1.2" : "On a Roll ×1.1");
    }
    if (winner === "B" && newStreakB >= 2) {
      const m = streakMult(input.streakB);
      pointsB *= m;
      calloutsB.push(m >= 1.2 ? "On a Roll ×1.2" : "On a Roll ×1.1");
    }
  }

  return {
    votesA,
    votesB,
    eligible,
    winner,
    pointsA: applyFloor(pointsA),
    pointsB: applyFloor(pointsB),
    calloutsA,
    calloutsB,
    newStreakA,
    newStreakB,
  };
}

export interface FinaleScoreInput {
  entries: { playerId: string; votes: number }[];
  lastPlaceIds: string[];
  comebackBoost: boolean;
}

export interface FinaleScoreRow {
  playerId: string;
  votes: number;
  points: number;
  callouts: string[];
}

export function scoreFinale(input: FinaleScoreInput): FinaleScoreRow[] {
  const boostLastPlace = input.comebackBoost;
  const sorted = [...input.entries].sort((a, b) => b.votes - a.votes);
  const topVotes = sorted[0]?.votes ?? 0;
  const winners = sorted.filter((e) => e.votes === topVotes);
  const rest = sorted.filter((e) => e.votes !== topVotes);
  const secondVotes = rest[0]?.votes ?? -1;
  const runners = secondVotes >= 0 ? rest.filter((e) => e.votes === secondVotes) : [];

  const winnerShare = winners.length > 0 ? FINALE_POOL / winners.length : 0;
  const runnerShare = runners.length > 0 ? FINALE_RUNNER_UP / runners.length : 0;

  const last = new Set(input.lastPlaceIds);

  return input.entries.map((e) => {
    const callouts: string[] = [];
    let points = 0;
    if (winners.some((w) => w.playerId === e.playerId)) {
      points = winnerShare;
      callouts.push(winners.length > 1 ? "Split the churn" : "Bread Winner material");
    } else if (runners.some((w) => w.playerId === e.playerId)) {
      points = runnerShare;
      callouts.push("Silver spread");
    }
    if (boostLastPlace && last.has(e.playerId) && points > 0) {
      points *= UNDERDOUGH_MULT;
      callouts.push("Underdough ×1.25");
    }
    return {
      playerId: e.playerId,
      votes: e.votes,
      points: applyFloor(points),
      callouts,
    };
  });
}

export function lastPlaceIds(scores: { id: string; score: number }[]): string[] {
  if (scores.length === 0) return [];
  const min = Math.min(...scores.map((s) => s.score));
  return scores.filter((s) => s.score === min).map((s) => s.id);
}

export function renderFinaleAnswer(format: FinaleFormat, promptText: string, answers: string[]): string {
  const filled = answers.map((a) => a.trim()).filter(Boolean);
  if (format === "hot_pan") return filled[0] ?? "";
  if (format === "three_spreads") return filled.join(" · ");
  // Triple Churn: replace blanks in the prompt, or stitch if the prompt has no ____.
  if (promptText.includes("____")) {
    let i = 0;
    return promptText.replace(/____/g, () => filled[i++] ?? "____");
  }
  if (filled.length === 3) return `${filled[0]}, ${filled[1]}, and ${filled[2]}`;
  return filled.join(", ");
}

export function pickFinaleFormat(setting: FinaleFormat | "random", rng = Math.random): FinaleFormat {
  if (setting !== "random") return setting;
  const all: FinaleFormat[] = ["triple_churn", "three_spreads", "hot_pan"];
  return all[Math.floor(rng() * all.length)]!;
}

export function pickRound2(
  setting: "head_to_head" | "everyone_answers" | "random",
  rng = Math.random,
): "head_to_head" | "everyone_answers" {
  if (setting !== "random") return setting;
  return rng() < 0.5 ? "head_to_head" : "everyone_answers";
}

/** First ceil(N/2) players who fully submitted without a backup. */
export function hotOffThePanWinners(
  submissions: { playerId: string; submittedAt: number; usedBackup: boolean }[],
  playerCount: number,
): string[] {
  const eligible = submissions
    .filter((s) => !s.usedBackup)
    .sort((a, b) => a.submittedAt - b.submittedAt);
  const cap = Math.max(1, Math.ceil(playerCount / 2));
  return eligible.slice(0, cap).map((s) => s.playerId);
}
