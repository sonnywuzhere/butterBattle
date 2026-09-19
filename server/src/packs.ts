import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentRating, FinaleFormat, Prompt, PromptKind } from "@butter/shared";

interface RawPrompt {
  id: string;
  kind: PromptKind;
  rating: ContentRating;
  pack: string;
  text: string;
  blanks?: number;
  imageUrl?: string;
}

interface PackFile {
  h2h: RawPrompt[];
  onePot: RawPrompt[];
  triple_churn: RawPrompt[];
  three_spreads: RawPrompt[];
  hot_pan: RawPrompt[];
  backups: { id: string; rating: ContentRating; text: string }[];
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../packs");
const file = JSON.parse(readFileSync(path.join(root, "prompts.json"), "utf8")) as PackFile;
const blocklist = JSON.parse(readFileSync(path.join(root, "blocklist.json"), "utf8")) as string[];

const RANK: Record<ContentRating, number> = { mild: 0, salted: 1, spicy: 2 };

export function ratingOk(promptRating: ContentRating, room: ContentRating): boolean {
  return RANK[promptRating] <= RANK[room];
}

export function shuffle<T>(arr: T[], rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toPrompt(raw: RawPrompt): Prompt {
  return { ...raw };
}

export function pickH2H(room: ContentRating, n: number, used: Set<string>): Prompt[] {
  const pool = shuffle(file.h2h.filter((p) => ratingOk(p.rating, room) && !used.has(p.id))).map(toPrompt);
  // Prefer a mix of kinds when possible
  const byKind: Record<PromptKind, Prompt[]> = { quip: [], fill_blank: [], caption: [] };
  for (const p of pool) byKind[p.kind].push(p);
  const picked: Prompt[] = [];
  for (const kind of ["quip", "fill_blank", "caption"] as PromptKind[]) {
    const next = byKind[kind].shift();
    if (next) picked.push(next);
  }
  for (const p of pool) {
    if (picked.length >= n) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return shuffle(picked).slice(0, n);
}

export function pickOne(list: RawPrompt[], room: ContentRating, used: Set<string>): Prompt {
  const pool = shuffle(list.filter((p) => ratingOk(p.rating, room) && !used.has(p.id)));
  const chosen = pool[0] ?? shuffle(list.filter((p) => ratingOk(p.rating, room)))[0];
  if (!chosen) throw new Error("Prompt pack is empty for this rating");
  return toPrompt(chosen);
}

export function pickFinale(format: FinaleFormat, room: ContentRating, used: Set<string>): Prompt {
  return pickOne(file[format], room, used);
}

export function pickOnePot(room: ContentRating, used: Set<string>): Prompt {
  return pickOne(file.onePot, room, used);
}

export function pickBackup(room: ContentRating): string {
  const pool = file.backups.filter((b) => ratingOk(b.rating, room));
  const src = pool.length ? pool : file.backups;
  return src[Math.floor(Math.random() * src.length)]!.text;
}

export function nameBlocked(name: string, rating: ContentRating): boolean {
  if (rating !== "mild") return false;
  const lower = name.toLowerCase();
  return blocklist.some((w) => lower.includes(w));
}

export const BOT_NAMES = ["Stick", "Patty", "Roux", "Crumb", "Nub", "Whip"];
