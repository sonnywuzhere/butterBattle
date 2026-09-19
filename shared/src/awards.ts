import type { AwardId, KitchenAward } from "./types.js";

export interface AwardMatchup {
  authorA: string;
  authorB: string;
  winner: "A" | "B" | "tie";
  votesA: number;
  votesB: number;
  backupA: boolean;
  backupB: boolean;
}

export interface AwardFinale {
  playerId: string;
  votes: number;
}

const TITLES: Record<AwardId, { title: string; subtitle: (name: string) => string }> = {
  butteriest: {
    title: "Butteriest",
    subtitle: (name) => `${name} buttered up the most matchups`,
  },
  crowd_favorite: {
    title: "Crowd Favorite",
    subtitle: (name) => `${name} pulled the most votes`,
  },
  burnt_toast: {
    title: "Burnt Toast",
    subtitle: (name) => `${name} took the most losses — still delicious`,
  },
  backup_survivor: {
    title: "Backup-Spread Survivor",
    subtitle: (name) => `${name} won a matchup on pantry leftovers`,
  },
};

function pickByMax(ids: string[], score: (id: string) => number): string | null {
  if (ids.length === 0) return null;
  let best = ids[0];
  let bestScore = score(best);
  for (const id of ids.slice(1)) {
    const s = score(id);
    if (s > bestScore) {
      best = id;
      bestScore = s;
    }
  }
  return best;
}

export function computeKitchenAwards(input: {
  playerIds: string[];
  names: Record<string, string>;
  matchups: AwardMatchup[];
  finale: AwardFinale[];
}): KitchenAward[] {
  const { playerIds, names, matchups, finale } = input;
  const wins = Object.fromEntries(playerIds.map((id) => [id, 0]));
  const losses = Object.fromEntries(playerIds.map((id) => [id, 0]));
  const votes = Object.fromEntries(playerIds.map((id) => [id, 0]));
  const lossMargin = Object.fromEntries(playerIds.map((id) => [id, 0]));
  const backupWins = new Set<string>();

  for (const m of matchups) {
    votes[m.authorA] += m.votesA;
    votes[m.authorB] += m.votesB;
    if (m.winner === "A") {
      wins[m.authorA]++;
      losses[m.authorB]++;
      lossMargin[m.authorB] += m.votesA - m.votesB;
      if (m.backupA) backupWins.add(m.authorA);
    } else if (m.winner === "B") {
      wins[m.authorB]++;
      losses[m.authorA]++;
      lossMargin[m.authorA] += m.votesB - m.votesA;
      if (m.backupB) backupWins.add(m.authorB);
    }
  }
  for (const f of finale) {
    votes[f.playerId] = (votes[f.playerId] ?? 0) + f.votes;
  }

  const awards: KitchenAward[] = [];

  const butteriest = pickByMax(playerIds, (id) => wins[id] * 1000 + votes[id]);
  if (butteriest && (wins[butteriest] ?? 0) > 0) {
    awards.push(make("butteriest", butteriest, names));
  }

  const crowd = pickByMax(playerIds, (id) => votes[id]);
  if (crowd && (votes[crowd] ?? 0) > 0) {
    awards.push(make("crowd_favorite", crowd, names));
  }

  const burnt = pickByMax(playerIds, (id) => losses[id] * 1000 + lossMargin[id]);
  if (burnt && (losses[burnt] ?? 0) > 0) {
    awards.push(make("burnt_toast", burnt, names));
  }

  if (backupWins.size > 0) {
    const survivor = pickByMax([...backupWins], (id) => wins[id]);
    if (survivor) awards.push(make("backup_survivor", survivor, names));
  }

  // Dedupes if the same player swept every title — that's fine; keep all.
  return awards;
}

function make(id: AwardId, playerId: string, names: Record<string, string>): KitchenAward {
  const name = names[playerId] ?? "Someone";
  return {
    id,
    title: TITLES[id].title,
    subtitle: TITLES[id].subtitle(name),
    playerId,
  };
}
