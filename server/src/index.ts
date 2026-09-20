import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import express from "express";
import { Server } from "socket.io";
import { parseRoomCode, SIZZLES, type RoomSettings } from "@butter/shared";
import { loadLiveRooms, purgeExpired, watchRoom } from "./db.js";
import { Lobby } from "./room.js";

const PORT = Number(process.env.PORT ?? 3001);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const clientDist = path.join(root, "client/dist");

const app = express();
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: true, credentials: true },
});

const lobby = new Lobby();
for (const room of loadLiveRooms()) {
  watchRoom(room);
  lobby.rooms.set(room.code, room);
  console.log(`restored Kitchen ${room.code} (${room.phase})`);
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/socket.io")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

function broadcast(code: string) {
  const room = lobby.rooms.get(code);
  if (!room) return;
  for (const p of room.playerList()) {
    const sid = room.sockets.get(p.id);
    if (sid) io.to(sid).emit("state:update", room.snapshotFor(p.id));
  }
}

io.on("connection", (socket) => {
  socket.on(
    "room:create",
    (
      payload: { name: string; color: string; settings?: Partial<RoomSettings> },
      ack?: (r: { ok: true; playerId: string; code: string } | { ok: false; error: string }) => void,
    ) => {
      const { room, player } = lobby.create(payload.name, payload.color, payload.settings);
      watchRoom(room);
      room.touch();
      room.attach(player.id, socket.id);
      socket.join(room.code);
      ack?.({ ok: true, playerId: player.id, code: room.code });
      broadcast(room.code);
    },
  );

  socket.on(
    "room:join",
    (
      payload: { code: string; name: string; color: string; playerId?: string },
      ack?: (r: { ok: true; playerId: string; code: string } | { ok: false; error: string }) => void,
    ) => {
      const code = parseRoomCode(payload.code);
      const already = roomFor(socket.id);
      if (already && already.code === code) {
        const pid = already.playerIdForSocket(socket.id) ?? payload.playerId;
        if (pid && already.players.has(pid)) {
          already.attach(pid, socket.id);
          ack?.({ ok: true, playerId: pid, code: already.code });
          broadcast(already.code);
          return;
        }
      }
      if (already && already.code !== code) {
        already.detach(socket.id);
        socket.leave(already.code);
      }
      const result = lobby.join(code, payload.name, payload.color, payload.playerId);
      if ("error" in result) {
        ack?.({ ok: false, error: result.error });
        return;
      }
      watchRoom(result.room);
      result.room.attach(result.player.id, socket.id);
      result.room.touch();
      socket.join(result.room.code);
      ack?.({ ok: true, playerId: result.player.id, code: result.room.code });
      broadcast(result.room.code);
    },
  );

  socket.on("game:start", () => {
    const room = roomFor(socket.id);
    if (!room) return;
    const playerId = playerFor(socket.id, room);
    const err = room.start(playerId);
    if (err) room.notice = err;
    broadcast(room.code);
  });

  socket.on("host:updateSettings", (settings: Partial<RoomSettings>) => {
    const room = roomFor(socket.id);
    if (!room) return;
    const err = room.updateSettings(settings, playerFor(socket.id, room));
    if (err) room.notice = err;
    broadcast(room.code);
  });

  socket.on("host:fillBots", () => {
    const room = roomFor(socket.id);
    if (!room) return;
    const playerId = playerFor(socket.id, room);
    room.ensureHumanHost(playerId);
    if (playerId !== room.hostId) return;
    room.fillBots(playerId);
    broadcast(room.code);
  });

  socket.on("host:skipPlayer", (playerId: string) => {
    const room = roomFor(socket.id);
    if (!room) return;
    room.skipPlayer(playerFor(socket.id, room), playerId);
    broadcast(room.code);
  });

  socket.on("host:advance", () => {
    const room = roomFor(socket.id);
    if (!room) return;
    room.hostAdvance(playerFor(socket.id, room));
    broadcast(room.code);
  });

  socket.on(
    "answer:submit",
    (payload: { promptId: string; text: string; doubleButter?: boolean }) => {
      const room = roomFor(socket.id);
      if (!room) return;
      const err = room.submitAnswer(
        playerFor(socket.id, room),
        payload.promptId,
        payload.text,
        payload.doubleButter,
      );
      if (err) room.notice = err;
      broadcast(room.code);
    },
  );

  socket.on("finale:submit", (payload: { answers: string[] }) => {
    const room = roomFor(socket.id);
    if (!room) return;
    const err = room.submitFinale(playerFor(socket.id, room), payload.answers);
    if (err) room.notice = err;
    broadcast(room.code);
  });

  socket.on("vote:cast", (payload: { matchupId: string; choice: string }) => {
    const room = roomFor(socket.id);
    if (!room) return;
    const err = room.castVote(playerFor(socket.id, room), payload.matchupId, payload.choice);
    if (err) room.notice = err;
    broadcast(room.code);
  });

  socket.on("react:send", (payload: { emoji: string }) => {
    const room = roomFor(socket.id);
    if (!room) return;
    const emoji = payload?.emoji;
    if (!SIZZLES.includes(emoji as (typeof SIZZLES)[number])) return;
    room.sizzle();
    const packet = { emoji, fromPlayer: playerFor(socket.id, room) };
    const seen = new Set<string>();
    for (const sid of room.sockets.values()) {
      if (seen.has(sid)) continue;
      seen.add(sid);
      io.to(sid).emit("react:broadcast", packet);
    }
  });

  socket.on("game:playAgain", () => {
    const room = roomFor(socket.id);
    if (!room) return;
    room.playAgain(playerFor(socket.id, room));
    broadcast(room.code);
  });

  socket.on("disconnect", () => {
    for (const room of lobby.rooms.values()) {
      const pid = room.detach(socket.id);
      if (pid) broadcast(room.code);
    }
  });
});

function roomFor(socketId: string) {
  for (const room of lobby.rooms.values()) {
    for (const sid of room.sockets.values()) {
      if (sid === socketId) return room;
    }
  }
  return undefined;
}

function playerFor(socketId: string, room: { sockets: Map<string, string> }) {
  for (const [pid, sid] of room.sockets) {
    if (sid === socketId) return pid;
  }
  return "";
}

setInterval(() => {
  for (const room of lobby.rooms.values()) {
    const before = room.phase + String(room.timerEndsAt) + room.voteSubphase + room.matchupIndex;
    room.tick();
    const after = room.phase + String(room.timerEndsAt) + room.voteSubphase + room.matchupIndex;
    if (before !== after) broadcast(room.code);
    else if (room.phase === "round_answer" || room.phase === "finale_answer" || room.phase === "round_vote") {
      // bots may have submitted without phase change
      const waiting = room.waitingOnAnswer?.() ?? [];
      void waiting;
    }
  }
}, 250);

// Re-broadcast when bots act even if phase didn't change
setInterval(() => {
  for (const room of lobby.rooms.values()) {
    if (room.playerList().some((p) => p.isBot) && room.phase !== "lobby" && room.phase !== "game_over") {
      broadcast(room.code);
    }
  }
}, 1000);

setInterval(() => purgeExpired(), 5 * 60 * 1000);

http.listen(PORT, () => {
  console.log(`Butter Battle kitchen on http://localhost:${PORT}`);
});
