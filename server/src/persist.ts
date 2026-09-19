import { DEFAULT_SETTINGS, PLAYER_COLORS, type Answer, type Player } from "@butter/shared";
import { Kitchen } from "./room.js";

export interface KitchenState {
  savedAt: number;
  timerRemainingMs: number | null;
  code: string;
  settings: Kitchen["settings"];
  hostId: string;
  originalHostId: string;
  players: Player[];
  phase: Kitchen["phase"];
  voteSubphase: Kitchen["voteSubphase"];
  round: 1 | 2;
  roundKind: Kitchen["roundKind"];
  finaleFormat: Kitchen["finaleFormat"];
  belowMinSince?: number;
  usedPromptIds: string[];
  dealt: Kitchen["dealt"];
  answers: [string, Answer][];
  matchups: Kitchen["matchups"];
  matchupIndex: number;
  lastReveal?: Kitchen["lastReveal"];
  roundDelta: [string, number][];
  submitTimes: [string, { submittedAt: number; usedBackup: boolean }][];
  onePotPrompt?: Kitchen["onePotPrompt"];
  onePotVotes: Record<string, string>;
  finalePrompt?: Kitchen["finalePrompt"];
  finaleAnswers: [string, { answers: string[]; isBackup: boolean }][];
  finaleVotes: Record<string, string>;
  finaleReveal?: Kitchen["finaleReveal"];
  lastPlaceIds: string[];
  ballotIds: string[];
  awards: Kitchen["awards"];
  reel: Kitchen["reel"];
  winnerId?: string;
  notice?: string;
  scoredMatchups: Kitchen["scoredMatchups"];
}

export function expiresAt(phase: KitchenState["phase"], from = Date.now()): number {
  if (phase === "lobby") return from + 6 * 60 * 60 * 1000;
  if (phase === "game_over") return from + 30 * 60 * 1000;
  return from + 3 * 60 * 60 * 1000;
}

export function kitchenToState(k: Kitchen): KitchenState {
  const now = Date.now();
  return {
    savedAt: now,
    timerRemainingMs: k.timerEndsAt ? Math.max(0, k.timerEndsAt - now) : null,
    code: k.code,
    settings: k.settings,
    hostId: k.hostId,
    originalHostId: k.originalHostId,
    players: k.playerList().map((p) => ({
      ...p,
      connected: !!p.isBot,
    })),
    phase: k.phase,
    voteSubphase: k.voteSubphase,
    round: k.round,
    roundKind: k.roundKind,
    finaleFormat: k.finaleFormat,
    belowMinSince: k.belowMinSince,
    usedPromptIds: [...k.usedPromptIds],
    dealt: k.dealt,
    answers: [...k.answers.entries()],
    matchups: k.matchups,
    matchupIndex: k.matchupIndex,
    lastReveal: k.lastReveal,
    roundDelta: [...k.roundDelta.entries()],
    submitTimes: [...k.submitTimes.entries()],
    onePotPrompt: k.onePotPrompt,
    onePotVotes: k.onePotVotes,
    finalePrompt: k.finalePrompt,
    finaleAnswers: [...k.finaleAnswers.entries()],
    finaleVotes: k.finaleVotes,
    finaleReveal: k.finaleReveal,
    lastPlaceIds: k.lastPlaceIds,
    ballotIds: k.ballotIds,
    awards: k.awards,
    reel: k.reel,
    winnerId: k.winnerId,
    notice: k.notice,
    scoredMatchups: k.scoredMatchups,
  };
}

export function kitchenFromState(s: KitchenState): Kitchen {
  const dummy: Player = {
    id: s.originalHostId || "restored",
    name: "restored",
    color: PLAYER_COLORS[0],
    connected: false,
    score: 0,
    streak: 0,
    joinedAt: 0,
  };
  const k = new Kitchen(s.code, dummy, s.settings ?? DEFAULT_SETTINGS);
  k.players.clear();
  for (const p of s.players) {
    k.players.set(p.id, { ...p, connected: !!p.isBot });
  }
  k.hostId = s.hostId;
  k.originalHostId = s.originalHostId;
  k.settings = { ...DEFAULT_SETTINGS, ...s.settings };
  k.phase = s.phase;
  k.voteSubphase = s.voteSubphase;
  k.round = s.round;
  k.roundKind = s.roundKind;
  k.finaleFormat = s.finaleFormat;
  k.timerEndsAt =
    s.timerRemainingMs != null ? Date.now() + s.timerRemainingMs : undefined;
  k.belowMinSince = undefined;
  k.usedPromptIds = new Set(s.usedPromptIds);
  k.dealt = s.dealt ?? [];
  k.answers = new Map(s.answers ?? []);
  k.matchups = s.matchups ?? [];
  k.matchupIndex = s.matchupIndex ?? 0;
  k.lastReveal = s.lastReveal;
  k.roundDelta = new Map(s.roundDelta ?? []);
  k.submitTimes = new Map(s.submitTimes ?? []);
  k.onePotPrompt = s.onePotPrompt;
  k.onePotVotes = s.onePotVotes ?? {};
  k.finalePrompt = s.finalePrompt;
  k.finaleAnswers = new Map(s.finaleAnswers ?? []);
  k.finaleVotes = s.finaleVotes ?? {};
  k.finaleReveal = s.finaleReveal;
  k.lastPlaceIds = s.lastPlaceIds ?? [];
  k.ballotIds = s.ballotIds ?? [];
  k.awards = s.awards ?? [];
  k.reel = s.reel ?? [];
  k.winnerId = s.winnerId;
  k.notice = s.notice;
  k.scoredMatchups = s.scoredMatchups ?? [];
  k.sockets = new Map();
  return k;
}
