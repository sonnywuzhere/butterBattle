import type { RoomSnapshot } from "@butter/shared";
import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AnswerScreen,
  BallotScreen,
  FinaleAnswer,
  KitchenLobby,
  Landing,
  Results,
  RevealScreen,
  Scoreboard,
  VoteScreen,
} from "./screens";
import { loadPlayer, socket, storePlayer } from "./socket";
import { Shell, SizzleLayer, Wordmark, type SizzleBurst } from "./ui";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/k/:code" element={<KitchenPage />} />
    </Routes>
  );
}

function Home() {
  const nav = useNavigate();
  const create = (name: string, color: string) => {
    socket.emit("room:create", { name, color }, (r: { ok: boolean; playerId?: string; code?: string; error?: string }) => {
      if (!r.ok || !r.code || !r.playerId) return alert(r.error ?? "could not create");
      storePlayer(r.code, r.playerId);
      nav(`/k/${r.code}`, { state: { playerId: r.playerId, name } });
    });
  };
  const join = (code: string, name: string, color: string) => {
    socket.emit(
      "room:join",
      { code, name, color, playerId: loadPlayer(code) ?? undefined },
      (r: { ok: boolean; playerId?: string; code?: string; error?: string }) => {
        if (!r.ok || !r.code || !r.playerId) return alert(r.error ?? "could not join");
        storePlayer(r.code, r.playerId);
        nav(`/k/${r.code}`, { state: { playerId: r.playerId, name } });
      },
    );
  };
  return <Landing onCreate={create} onJoin={join} />;
}

function KitchenPage() {
  const { code = "" } = useParams();
  const location = useLocation();
  const locState = location.state as { playerId?: string; name?: string } | null;
  const [snap, setSnap] = useState<RoomSnapshot | null>(null);
  const [name, setName] = useState(locState?.name ?? "");
  const [needName, setNeedName] = useState(false);
  const [sizzles, setSizzles] = useState<SizzleBurst[]>([]);

  useEffect(() => {
    const join = () => {
      const playerId = loadPlayer(code) ?? locState?.playerId;
      if (playerId) {
        socket.emit(
          "room:join",
          { code, name: locState?.name ?? "", color: "", playerId },
          (r: { ok: boolean; playerId?: string; error?: string }) => {
            if (!r.ok) setNeedName(true);
            else if (r.playerId) storePlayer(code, r.playerId);
          },
        );
      } else {
        setNeedName(true);
      }
    };
    const onState = (s: RoomSnapshot) => {
      setSnap(s);
      if (s.youId) storePlayer(s.code, s.youId);
    };
    const onSizzle = (payload: { emoji?: string }) => {
      const emoji = payload?.emoji;
      if (!emoji) return;
      const id = Date.now() + Math.random();
      const burst: SizzleBurst = { id, emoji, x: 8 + Math.random() * 78 };
      setSizzles((cur) => [...cur.slice(-24), burst]);
      window.setTimeout(() => {
        setSizzles((cur) => cur.filter((b) => b.id !== id));
      }, 1300);
    };
    socket.on("state:update", onState);
    socket.on("react:broadcast", onSizzle);
    socket.on("connect", join);
    if (socket.connected) join();
    else socket.connect();
    return () => {
      socket.off("state:update", onState);
      socket.off("react:broadcast", onSizzle);
      socket.off("connect", join);
    };
  }, [code, locState?.playerId, locState?.name]);

  if (needName && !snap) {
    return (
      <Shell>
        <Wordmark small />
        <p className="mb-3 text-center text-sm">Joining kitchen {code}</p>
        <input
          className="min-h-12 w-full rounded-2xl border-2 border-crust/15 bg-white px-4"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className="mt-3 min-h-12 w-full rounded-2xl bg-butter font-extrabold"
          onClick={() => {
            socket.emit(
              "room:join",
              { code, name, color: "", playerId: loadPlayer(code) ?? undefined },
              (r: { ok: boolean; playerId?: string; error?: string }) => {
                if (!r.ok || !r.playerId) return alert(r.error ?? "could not join");
                storePlayer(code, r.playerId);
                setNeedName(false);
              },
            );
          }}
        >
          Join
        </button>
      </Shell>
    );
  }

  if (!snap) {
    return (
      <Shell>
        <Wordmark small />
        <p className="text-center">Stirring the pot…</p>
      </Shell>
    );
  }

  const youAreHost =
    snap.youId === snap.hostId || !!snap.players.find((p) => p.id === snap.youId)?.isHost;
  let screen = (
    <Shell>
      <p>Unknown phase: {snap.phase}</p>
    </Shell>
  );
  if (snap.phase === "lobby") screen = <KitchenLobby snap={snap} socket={socket} youAreHost={youAreHost} />;
  else if (snap.phase === "round_answer") screen = <AnswerScreen snap={snap} socket={socket} />;
  else if (snap.phase === "round_vote" && snap.voteSubphase === "reveal") {
    screen = <RevealScreen snap={snap} socket={socket} youAreHost={youAreHost} />;
  } else if (snap.phase === "round_vote" && snap.roundKind === "everyone_answers") {
    screen = <BallotScreen snap={snap} socket={socket} />;
  } else if (snap.phase === "round_vote") screen = <VoteScreen snap={snap} socket={socket} />;
  else if (snap.phase === "round_score" || snap.phase === "finale_score") {
    screen = <Scoreboard snap={snap} socket={socket} youAreHost={youAreHost} />;
  } else if (snap.phase === "finale_answer") screen = <FinaleAnswer snap={snap} socket={socket} />;
  else if (snap.phase === "finale_vote" && snap.voteSubphase === "reveal") {
    screen = <RevealScreen snap={snap} socket={socket} youAreHost={youAreHost} />;
  } else if (snap.phase === "finale_vote") screen = <BallotScreen snap={snap} socket={socket} />;
  else if (snap.phase === "game_over") screen = <Results snap={snap} socket={socket} youAreHost={youAreHost} />;
  return (
    <>
      <SizzleLayer bursts={sizzles} />
      {screen}
    </>
  );
}
