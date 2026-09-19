import type { DealtPrompt, Prompt, PromptKind } from "./types.js";

/**
 * Round-robin deal: prompt i is answered by player i and player (i+1) % N.
 * Each player writes exactly 2 prompts; each prompt has exactly 2 authors.
 */
export function dealRound(playerIds: string[], prompts: Prompt[] | string[]): DealtPrompt[] {
  const n = playerIds.length;
  if (n < 2) throw new Error("Need at least 2 players to deal");
  if (prompts.length < n) {
    throw new Error(`Need at least ${n} prompts, got ${prompts.length}`);
  }
  const dealt: DealtPrompt[] = [];
  for (let i = 0; i < n; i++) {
    const a = playerIds[i];
    const b = playerIds[(i + 1) % n];
    const raw = prompts[i];
    const text = typeof raw === "string" ? raw : raw.text;
    const kind: PromptKind = typeof raw === "string" ? "quip" : raw.kind;
    const promptId = typeof raw === "string" ? `p-${i}` : raw.id;
    const imageUrl = typeof raw === "string" ? undefined : raw.imageUrl;
    dealt.push({
      id: `d-${i}`,
      promptId,
      text,
      kind,
      imageUrl,
      authorIds: [a, b],
    });
  }
  return dealt;
}

export function promptsForPlayer(dealt: DealtPrompt[], playerId: string): DealtPrompt[] {
  return dealt.filter((d) => d.authorIds.includes(playerId));
}

export function matchupAuthors(dealt: DealtPrompt): [string, string] {
  return dealt.authorIds;
}

export function eligibleVoters(playerIds: string[], authorA: string, authorB: string): string[] {
  return playerIds.filter((id) => id !== authorA && id !== authorB);
}

export function finaleEligibleVoters(playerIds: string[], authorId: string): string[] {
  return playerIds.filter((id) => id !== authorId);
}

export function validateDeal(playerIds: string[], dealt: DealtPrompt[]): string[] {
  const errors: string[] = [];
  const n = playerIds.length;
  if (dealt.length !== n) errors.push(`expected ${n} prompts, got ${dealt.length}`);
  const counts = new Map<string, number>();
  for (const id of playerIds) counts.set(id, 0);
  const seenPairs = new Set<string>();
  for (const d of dealt) {
    if (d.authorIds[0] === d.authorIds[1]) {
      errors.push(`prompt ${d.id} has the same author twice`);
    }
    for (const a of d.authorIds) {
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    const pair = [...d.authorIds].sort().join(":");
    if (seenPairs.has(pair)) errors.push(`duplicate author pair ${pair}`);
    seenPairs.add(pair);
  }
  for (const id of playerIds) {
    if (counts.get(id) !== 2) {
      errors.push(`player ${id} has ${counts.get(id)} prompts, expected 2`);
    }
  }
  return errors;
}
