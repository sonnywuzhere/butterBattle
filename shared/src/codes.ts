import { PLAYER_COLORS } from "./types.js";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(existing: Set<string>, length = 4): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < length; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  throw new Error("Could not generate a unique room code");
}

/** Uppercase and keep only characters we actually emit. */
export function parseRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, "").slice(0, 4);
}

export function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function pickColor(used: string[]): string {
  const next = PLAYER_COLORS.find((c) => !used.includes(c));
  return next ?? PLAYER_COLORS[used.length % PLAYER_COLORS.length];
}
