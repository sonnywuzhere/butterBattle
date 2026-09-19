import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Kitchen } from "./room.js";
import { expiresAt, kitchenFromState, kitchenToState, type KitchenState } from "./persist.js";

const dbPath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "data/butter.db");

let db: DatabaseSync | undefined;

function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rooms_expires ON rooms (expires_at);
  `);
  return db;
}

export function saveRoom(kitchen: Kitchen) {
  try {
    const state = kitchenToState(kitchen);
    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO rooms (code, state_json, updated_at, expires_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           state_json = excluded.state_json,
           updated_at = excluded.updated_at,
           expires_at = excluded.expires_at`,
      )
      .run(kitchen.code, JSON.stringify(state), now, expiresAt(kitchen.phase, now));
  } catch (err) {
    console.error("saveRoom failed", kitchen.code, err);
  }
}

export function deleteRoom(code: string) {
  try {
    getDb().prepare("DELETE FROM rooms WHERE code = ?").run(code);
  } catch (err) {
    console.error("deleteRoom failed", code, err);
  }
}

export function purgeExpired() {
  try {
    getDb().prepare("DELETE FROM rooms WHERE expires_at < ?").run(Date.now());
  } catch (err) {
    console.error("purgeExpired failed", err);
  }
}

export function loadLiveRooms(): Kitchen[] {
  try {
    purgeExpired();
    const rows = getDb()
      .prepare("SELECT code, state_json FROM rooms WHERE expires_at > ?")
      .all(Date.now()) as { code: string; state_json: string }[];
    const rooms: Kitchen[] = [];
    for (const row of rows) {
      try {
        const state = JSON.parse(row.state_json) as KitchenState;
        rooms.push(kitchenFromState(state));
      } catch (err) {
        console.error("skip corrupt room", row.code, err);
      }
    }
    return rooms;
  } catch (err) {
    console.error("loadLiveRooms failed", err);
    return [];
  }
}

export function watchRoom(kitchen: Kitchen) {
  kitchen.persistHook = () => saveRoom(kitchen);
}
