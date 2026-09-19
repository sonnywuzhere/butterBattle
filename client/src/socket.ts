import { io } from "socket.io-client";

export const socket = io({ autoConnect: true });

export function storePlayer(code: string, playerId: string) {
  localStorage.setItem(`butter:${code}`, playerId);
}

export function loadPlayer(code: string): string | null {
  return localStorage.getItem(`butter:${code}`);
}
