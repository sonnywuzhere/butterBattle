import { randomUUID } from "node:crypto";
import {
  ANSWER_MS,
  DEFAULT_SETTINGS,
  FINALE_REVEAL_MS,
  GRACE_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  REVEAL_MS,
  SCOREBOARD_MS,
  SPEED_BONUS,
  VOTE_MS,
  computeKitchenAwards,
  dealRound,
  eligibleVoters,
  finaleAnswerMs,
  finaleBlanks,
  generateRoomCode,
  hotOffThePanWinners,
  lastPlaceIds,
  pickColor,
  pickFinaleFormat,
  pickRound2,
  promptsForPlayer,
  renderFinaleAnswer,
  scoreFinale,
  scoreMatchup,
  type Answer,
  type DealtPrompt,
  type FinaleFormat,
  type Highlight,
  type KitchenAward,
  type Matchup,
  type Phase,
  type Player,
  type Prompt,
  type PublicPlayer,
  type RoomSettings,
  type RoomSnapshot,
  type RoundKind,
  type VoteSubphase,
} from "@butter/shared";
import {
  BOT_NAMES,
  nameBlocked,
  pickBackup,
  pickFinale,
  pickH2H,
  pickOnePot,
  shuffle,
} from "./packs.js";

const minPlayers = Math.min(
  MAX_PLAYERS,
  Math.max(2, Number(process.env.BUTTER_MIN_PLAYERS ?? MIN_PLAYERS)),
);

function now() {
  return Date.now();
}

export class Kitchen {
  code: string;
  settings: RoomSettings;
  hostId: string;
  originalHostId: string;
  players = new Map<string, Player>();
  sockets = new Map<string, string>();
  phase: Phase = "lobby";
  voteSubphase: VoteSubphase = "voting";
  round: 1 | 2 = 1;
  roundKind: RoundKind = "head_to_head";
  finaleFormat: FinaleFormat = "hot_pan";
  timerEndsAt?: number;
  belowMinSince?: number;
  usedPromptIds = new Set<string>();
  dealt: DealtPrompt[] = [];
  answers = new Map<string, Answer>();
  matchups: Matchup[] = [];
  matchupIndex = 0;
  lastReveal?: RoomSnapshot["reveal"];
  roundDelta = new Map<string, number>();
  submitTimes = new Map<string, { submittedAt: number; usedBackup: boolean }>();
  onePotPrompt?: Prompt;
  onePotVotes: Record<string, string> = {};
  finalePrompt?: Prompt;
  finaleAnswers = new Map<string, { answers: string[]; isBackup: boolean }>();
  finaleVotes: Record<string, string> = {};
  finaleReveal?: RoomSnapshot["finaleReveal"];
  lastPlaceIds: string[] = [];
  ballotIds: string[] = [];
  awards: KitchenAward[] = [];
  reel: Highlight[] = [];
  winnerId?: string;
  notice?: string;
  scoredMatchups: {
    authorA: string;
    authorB: string;
    winner: "A" | "B" | "tie";
    votesA: number;
    votesB: number;
    backupA: boolean;
    backupB: boolean;
  }[] = [];
  persistHook?: () => void;

  touch() {
    this.persistHook?.();
  }

  constructor(code: string, host: Player, settings: Partial<RoomSettings>) {
    this.code = code;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.hostId = host.id;
    this.originalHostId = host.id;
    this.players.set(host.id, host);
  }

  playerList(): Player[] {
    return [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  ids(): string[] {
    return this.playerList().map((p) => p.id);
  }

  connectedCount(): number {
    return this.playerList().filter((p) => p.connected || p.isBot).length;
  }

  publicPlayer(p: Player): PublicPlayer {
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      connected: p.connected || !!p.isBot,
      score: p.score,
      streak: p.streak,
      isHost: p.id === this.hostId,
      isBot: p.isBot,
    };
  }

  snapshotFor(youId: string): RoomSnapshot {
    this.ensureHumanHost();
    const you = this.players.get(youId);
    const players = this.playerList().map((p) => this.publicPlayer(p));
    const base: RoomSnapshot = {
      code: this.code,
      youId,
      hostId: this.hostId,
      phase: this.phase,
      settings: this.settings,
      players,
      round: this.phase === "lobby" ? undefined : this.round,
      roundKind: this.phase === "lobby" ? undefined : this.roundKind,
      timerEndsAt: this.timerEndsAt,
      notice: this.notice,
    };

    if (this.phase === "round_answer") {
      base.waitingOn = this.waitingOnAnswer();
      if (this.roundKind === "everyone_answers" && this.onePotPrompt) {
        const key = ansKey(youId, this.onePotPrompt.id);
        const submitted = this.answers.has(key);
        base.yourPrompts = [
          {
            id: this.onePotPrompt.id,
            text: this.onePotPrompt.text,
            kind: this.onePotPrompt.kind,
            imageUrl: this.onePotPrompt.imageUrl,
            submitted,
            doubleButter: this.answers.get(key)?.doubleButter ?? false,
          },
        ];
      } else {
        const mine = promptsForPlayer(this.dealt, youId);
        base.yourPrompts = mine.map((d) => {
          const a = this.answers.get(ansKey(youId, d.promptId));
          return {
            id: d.promptId,
            text: d.text,
            kind: d.kind,
            imageUrl: d.imageUrl,
            submitted: !!a,
            doubleButter: a?.doubleButter ?? false,
          };
        });
      }
    }

    if (this.phase === "round_vote" && this.roundKind === "head_to_head") {
      const m = this.matchups[this.matchupIndex];
      if (m && this.voteSubphase === "voting") {
        base.voteSubphase = "voting";
        const youAreAuthor = youId === m.authorA || youId === m.authorB;
        base.matchup = {
          id: m.id,
          promptText: m.promptText,
          kind: m.kind,
          imageUrl: m.imageUrl,
          answerA: m.answerA,
          answerB: m.answerB,
          youAreAuthor,
          yourSide: youId === m.authorA ? "A" : youId === m.authorB ? "B" : undefined,
          youVoted: m.votes[youId],
          index: this.matchupIndex,
          total: this.matchups.length,
        };
        base.waitingOn = eligibleVoters(this.ids(), m.authorA, m.authorB).filter((id) => !m.votes[id]);
      }
      if (this.voteSubphase === "reveal") {
        base.voteSubphase = "reveal";
        base.reveal = this.lastReveal;
      }
    }

    if (
      (this.phase === "round_vote" && this.roundKind === "everyone_answers") ||
      this.phase === "finale_vote"
    ) {
      if (this.voteSubphase === "voting") {
        base.voteSubphase = "voting";
        const prompt = this.phase === "finale_vote" ? this.finalePrompt : this.onePotPrompt;
        const votes = this.phase === "finale_vote" ? this.finaleVotes : this.onePotVotes;
        base.ballot = {
          promptText: prompt?.text ?? "",
          kind: prompt?.kind,
          imageUrl: prompt?.imageUrl,
          entries: this.ballotEntries(),
          youVoted: votes[youId],
        };
        base.waitingOn = this.ids().filter((id) => !votes[id]);
      }
      if (this.voteSubphase === "reveal" && this.phase === "finale_vote") {
        base.voteSubphase = "reveal";
        base.finaleReveal = this.finaleReveal;
      }
      if (this.voteSubphase === "reveal" && this.phase === "round_vote") {
        base.voteSubphase = "reveal";
        base.finaleReveal = this.finaleReveal;
      }
    }

    if (this.phase === "finale_answer" && this.finalePrompt) {
      const blanks = finaleBlanks(this.finaleFormat);
      const have = this.finaleAnswers.get(youId);
      base.waitingOn = this.ids().filter((id) => !this.finaleAnswers.has(id));
      base.finale = {
        format: this.finaleFormat,
        promptText: this.finalePrompt.text,
        blanks,
        yourAnswers: have?.answers ?? Array.from({ length: blanks }, () => ""),
        submitted: !!have,
      };
    }

    if (this.phase === "round_score" || this.phase === "finale_score" || this.phase === "game_over") {
      const before = new Map(this.roundDelta);
      base.standings = this.playerList()
        .map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          score: p.score,
          delta: before.get(p.id) ?? 0,
        }))
        .sort((a, b) => b.score - a.score);
    }

    if (this.phase === "game_over") {
      base.winnerId = this.winnerId;
      base.awards = this.awards;
      base.reel = this.reel;
    }

    void you;
    return base;
  }

  ballotEntries() {
    const order = this.ballotIds.length ? this.ballotIds : this.ids();
    if (this.phase === "finale_vote") {
      return order.map((id) => {
        const a = this.finaleAnswers.get(id);
        return {
          id,
          rendered: a
            ? renderFinaleAnswer(this.finaleFormat, this.finalePrompt?.text ?? "", a.answers)
            : "",
          answers: a?.answers,
        };
      });
    }
    return order.map((id) => {
      const a = this.onePotPrompt ? this.answers.get(ansKey(id, this.onePotPrompt.id)) : undefined;
      return { id, rendered: a?.text ?? "", answers: a ? [a.text] : [] };
    });
  }

  waitingOnAnswer(): string[] {
    if (this.roundKind === "everyone_answers" && this.onePotPrompt) {
      return this.ids().filter((id) => !this.answers.has(ansKey(id, this.onePotPrompt!.id)));
    }
    return this.ids().filter((id) => {
      const mine = promptsForPlayer(this.dealt, id);
      return mine.some((d) => !this.answers.has(ansKey(id, d.promptId)));
    });
  }

  addPlayer(name: string, color: string, isBot = false): Player | { error: string } {
    if (this.phase !== "lobby") return { error: "this Kitchen is already cooking" };
    if (this.players.size >= MAX_PLAYERS) return { error: "this Kitchen is full (8)" };
    if (nameBlocked(name, this.settings.rating)) return { error: "try a milder name" };
    const trimmed = name.trim().slice(0, 18) || (isBot ? "Bot" : "Friend");
    const used = [...this.players.values()].map((p) => p.color);
    const player: Player = {
      id: randomUUID(),
      name: trimmed,
      color: color && PLAYER_COLORS.includes(color as (typeof PLAYER_COLORS)[number]) ? color : pickColor(used),
      connected: !isBot,
      score: 0,
      streak: 0,
      joinedAt: now(),
      isBot,
    };
    this.players.set(player.id, player);
    this.touch();
    return player;
  }

  attach(playerId: string, socketId: string) {
    const p = this.players.get(playerId);
    if (!p) return;
    for (const [pid, sid] of [...this.sockets]) {
      if (sid === socketId && pid !== playerId) this.sockets.delete(pid);
    }
    p.connected = true;
    this.sockets.set(playerId, socketId);
    this.belowMinSince = undefined;
    this.ensureHumanHost(playerId);
  }

  detach(socketId: string): string | undefined {
    for (const [pid, sid] of this.sockets) {
      if (sid === socketId) {
        this.sockets.delete(pid);
        const p = this.players.get(pid);
        if (p && !p.isBot) p.connected = false;
        if (pid === this.hostId) this.ensureHumanHost();
        if (this.phase !== "lobby" && this.connectedCount() < minPlayers) {
          this.belowMinSince = now();
        }
        return pid;
      }
    }
    return undefined;
  }

  playerIdForSocket(socketId: string): string | undefined {
    for (const [pid, sid] of this.sockets) {
      if (sid === socketId) return pid;
    }
    return undefined;
  }

  /** Host is always a connected human when one exists. Never a pantry bot. */
  ensureHumanHost(preferred?: string) {
    const original = this.players.get(this.originalHostId);
    if (original && !original.isBot && original.connected) {
      this.hostId = this.originalHostId;
      return;
    }
    const host = this.players.get(this.hostId);
    const hostOk = !!(host && !host.isBot && host.connected);
    if (hostOk) return;
    if (preferred) {
      const p = this.players.get(preferred);
      if (p && !p.isBot && p.connected) {
        this.hostId = preferred;
        return;
      }
    }
    const human = this.playerList().find((p) => !p.isBot && p.connected);
    if (human) this.hostId = human.id;
  }

  fillBots(by?: string): string | undefined {
    if (by) this.ensureHumanHost(by);
    if (this.phase !== "lobby") return "game already started";
    const usedNames = new Set([...this.players.values()].map((p) => p.name));
    let i = 0;
    while (this.players.size < minPlayers && i < BOT_NAMES.length) {
      const name = BOT_NAMES[i++]!;
      if (usedNames.has(name)) continue;
      this.addPlayer(name, pickColor([...this.players.values()].map((p) => p.color)), true);
    }
    this.touch();
    return undefined;
  }

  updateSettings(partial: Partial<RoomSettings>, by: string): string | undefined {
    this.ensureHumanHost(by);
    if (by !== this.hostId) return "only the host can tinker";
    if (this.phase !== "lobby") return "too late to change the recipe";
    this.settings = { ...this.settings, ...partial };
    this.touch();
    return undefined;
  }

  start(by: string): string | undefined {
    this.ensureHumanHost(by);
    if (by !== this.hostId) return "only the host can start";
    if (this.phase !== "lobby") return "already cooking";
    if (this.connectedCount() < minPlayers) {
      return `need at least ${minPlayers} in the Kitchen`;
    }
    this.finaleFormat = pickFinaleFormat(this.settings.finaleFormat);
    this.round = 1;
    this.beginRound(1);
    return undefined;
  }

  beginRound(n: 1 | 2) {
    this.round = n;
    this.roundDelta = new Map(this.ids().map((id) => [id, 0]));
    this.submitTimes.clear();
    this.answers.clear();
    this.dealt = [];
    this.matchups = [];
    this.matchupIndex = 0;
    this.onePotVotes = {};
    this.onePotPrompt = undefined;
    const kind: RoundKind = n === 1 ? "head_to_head" : pickRound2(this.settings.round2);
    this.roundKind = kind;
    if (kind === "everyone_answers") {
      this.onePotPrompt = pickOnePot(this.settings.rating, this.usedPromptIds);
      this.usedPromptIds.add(this.onePotPrompt.id);
      this.enter("round_answer", ANSWER_MS[this.settings.timerSpeed]);
      return;
    }
    const prompts = pickH2H(this.settings.rating, this.ids().length, this.usedPromptIds);
    for (const p of prompts) this.usedPromptIds.add(p.id);
    this.dealt = dealRound(this.ids(), prompts);
    this.enter("round_answer", ANSWER_MS[this.settings.timerSpeed]);
  }

  enter(phase: Phase, ms?: number) {
    this.phase = phase;
    this.timerEndsAt = ms ? now() + ms : undefined;
    this.voteSubphase = "voting";
    this.touch();
  }

  submitAnswer(playerId: string, promptId: string, text: string, doubleButter?: boolean): string | undefined {
    if (this.phase !== "round_answer") return "not answering right now";
    const trimmed = text.trim().slice(0, 140);
    if (!trimmed) return "write something (or wait for a Backup Spread)";
    if (this.roundKind === "everyone_answers") {
      if (!this.onePotPrompt || promptId !== this.onePotPrompt.id) return "wrong prompt";
      this.answers.set(ansKey(playerId, promptId), {
        promptId,
        playerId,
        text: trimmed,
        doubleButter: !!doubleButter && this.settings.doubleButter,
        isBackup: false,
      });
    } else {
      const mine = promptsForPlayer(this.dealt, playerId);
      if (!mine.some((d) => d.promptId === promptId)) return "not your prompt";
      if (doubleButter && this.settings.doubleButter) {
        for (const d of mine) {
          const existing = this.answers.get(ansKey(playerId, d.promptId));
          if (existing) existing.doubleButter = false;
        }
      }
      this.answers.set(ansKey(playerId, promptId), {
        promptId,
        playerId,
        text: trimmed,
        doubleButter: !!doubleButter && this.settings.doubleButter,
        isBackup: false,
      });
    }
    if (this.waitingOnAnswer().length === 0) this.closeAnswering();
    else this.maybeMarkSubmit(playerId);
    return undefined;
  }

  maybeMarkSubmit(playerId: string) {
    if (this.waitingOnAnswer().includes(playerId)) return;
    if (this.submitTimes.has(playerId)) return;
    const usedBackup = [...this.answers.values()].some((a) => a.playerId === playerId && a.isBackup);
    this.submitTimes.set(playerId, { submittedAt: now(), usedBackup });
  }

  skipPlayer(by: string, targetId: string): string | undefined {
    if (by !== this.hostId) return "only the host can skip";
    if (this.phase !== "round_answer" && this.phase !== "finale_answer") return "nothing to skip";
    this.fillBackupsFor(targetId);
    if (this.phase === "round_answer" && this.waitingOnAnswer().length === 0) this.closeAnswering();
    if (this.phase === "finale_answer" && this.ids().every((id) => this.finaleAnswers.has(id))) {
      this.closeFinaleAnswer();
    }
    return undefined;
  }

  fillBackupsFor(playerId: string) {
    if (this.phase === "finale_answer" && this.finalePrompt) {
      if (this.finaleAnswers.has(playerId)) return;
      const n = finaleBlanks(this.finaleFormat);
      this.finaleAnswers.set(playerId, {
        answers: Array.from({ length: n }, () => pickBackup(this.settings.rating)),
        isBackup: true,
      });
      return;
    }
    if (this.roundKind === "everyone_answers" && this.onePotPrompt) {
      const key = ansKey(playerId, this.onePotPrompt.id);
      if (!this.answers.has(key)) {
        this.answers.set(key, {
          promptId: this.onePotPrompt.id,
          playerId,
          text: pickBackup(this.settings.rating),
          doubleButter: false,
          isBackup: true,
        });
      }
    } else {
      for (const d of promptsForPlayer(this.dealt, playerId)) {
        const key = ansKey(playerId, d.promptId);
        if (!this.answers.has(key)) {
          this.answers.set(key, {
            promptId: d.promptId,
            playerId,
            text: pickBackup(this.settings.rating),
            doubleButter: false,
            isBackup: true,
          });
        }
      }
    }
    this.maybeMarkSubmit(playerId);
  }

  closeAnswering() {
    for (const id of this.ids()) this.fillBackupsFor(id);
    for (const id of this.ids()) this.maybeMarkSubmit(id);
    if (this.settings.hotOffThePan) {
      const winners = hotOffThePanWinners(
        [...this.submitTimes.entries()].map(([playerId, v]) => ({ playerId, ...v })),
        this.ids().length,
      );
      const bonus = SPEED_BONUS[this.round];
      for (const id of winners) {
        const p = this.players.get(id);
        if (!p) continue;
        p.score += bonus;
        this.roundDelta.set(id, (this.roundDelta.get(id) ?? 0) + bonus);
      }
    }
    if (this.roundKind === "everyone_answers") {
      this.onePotVotes = {};
      this.ballotIds = shuffle(this.ids());
      this.enter("round_vote", VOTE_MS[this.settings.timerSpeed] + 4000);
      this.voteSubphase = "voting";
      this.timerEndsAt = now() + VOTE_MS[this.settings.timerSpeed];
      return;
    }
    this.matchups = this.dealt.map((d, i) => {
      const [a, b] = d.authorIds;
      const ansA = this.answers.get(ansKey(a, d.promptId))!;
      const ansB = this.answers.get(ansKey(b, d.promptId))!;
      return {
        id: `m-${this.round}-${i}`,
        promptId: d.promptId,
        promptText: d.text,
        kind: d.kind,
        imageUrl: d.imageUrl,
        authorA: a,
        authorB: b,
        answerA: ansA.text,
        answerB: ansB.text,
        backupA: ansA.isBackup,
        backupB: ansB.isBackup,
        doubleButterA: ansA.doubleButter,
        doubleButterB: ansB.doubleButter,
        votes: {},
        sizzles: 0,
      };
    });
    this.matchups = shuffle(this.matchups);
    this.matchupIndex = 0;
    this.enterVote();
  }

  enterVote() {
    this.phase = "round_vote";
    this.voteSubphase = "voting";
    this.timerEndsAt = now() + VOTE_MS[this.settings.timerSpeed];
    this.touch();
  }

  castVote(playerId: string, matchupId: string, choice: string): string | undefined {
    if (this.phase === "round_vote" && this.roundKind === "head_to_head" && this.voteSubphase === "voting") {
      const m = this.matchups[this.matchupIndex];
      if (!m || m.id !== matchupId) return "wrong matchup";
      if (playerId === m.authorA || playerId === m.authorB) return "sit tight — this one's yours";
      if (choice !== "A" && choice !== "B") return "pick a side";
      m.votes[playerId] = choice;
      const need = eligibleVoters(this.ids(), m.authorA, m.authorB);
      if (need.every((id) => m.votes[id])) this.closeMatchup();
      return undefined;
    }
    if (this.voteSubphase !== "voting") return "voting is closed";
    if (choice === playerId) return "can't vote for yourself";
    if (!this.ids().includes(choice) && choice !== "A" && choice !== "B") return "who?";
    if (this.phase === "round_vote" && this.roundKind === "everyone_answers") {
      this.onePotVotes[playerId] = choice;
      if (this.ids().every((id) => this.onePotVotes[id])) this.closeNWay("round");
      return undefined;
    }
    if (this.phase === "finale_vote") {
      this.finaleVotes[playerId] = choice;
      if (this.ids().every((id) => this.finaleVotes[id])) this.closeNWay("finale");
      return undefined;
    }
    return "not voting right now";
  }

  sizzle() {
    const m = this.matchups[this.matchupIndex];
    if (m && this.phase === "round_vote") m.sizzles += 1;
  }

  closeMatchup() {
    const m = this.matchups[this.matchupIndex];
    if (!m) return;
    const eligible = eligibleVoters(this.ids(), m.authorA, m.authorB);
    const votesA = eligible.filter((id) => m.votes[id] === "A").length;
    const votesB = eligible.filter((id) => m.votes[id] === "B").length;
    const pa = this.players.get(m.authorA)!;
    const pb = this.players.get(m.authorB)!;
    const result = scoreMatchup({
      votesA,
      votesB,
      eligible: eligible.length,
      round: this.round,
      doubleButterA: m.doubleButterA,
      doubleButterB: m.doubleButterB,
      streakA: pa.streak,
      streakB: pb.streak,
      doubleButterEnabled: this.settings.doubleButter,
      onARollEnabled: this.settings.onARoll,
    });
    pa.score += result.pointsA;
    pb.score += result.pointsB;
    pa.streak = result.newStreakA;
    pb.streak = result.newStreakB;
    this.roundDelta.set(m.authorA, (this.roundDelta.get(m.authorA) ?? 0) + result.pointsA);
    this.roundDelta.set(m.authorB, (this.roundDelta.get(m.authorB) ?? 0) + result.pointsB);
    this.scoredMatchups.push({
      authorA: m.authorA,
      authorB: m.authorB,
      winner: result.winner,
      votesA,
      votesB,
      backupA: m.backupA,
      backupB: m.backupB,
    });
    const margin = Math.abs(votesA - votesB);
    this.reel.push({
      promptText: m.promptText,
      answer: result.winner === "B" ? m.answerB : m.answerA,
      authorId: result.winner === "B" ? m.authorB : m.authorA,
      authorName: result.winner === "B" ? pb.name : pa.name,
      margin,
      sizzles: m.sizzles,
    });
    this.lastReveal = {
      matchupId: m.id,
      promptText: m.promptText,
      answerA: m.answerA,
      answerB: m.answerB,
      authorA: this.publicPlayer(pa),
      authorB: this.publicPlayer(pb),
      votesA,
      votesB,
      eligible: eligible.length,
      winner: result.winner,
      pointsA: result.pointsA,
      pointsB: result.pointsB,
      callouts: [
        ...result.calloutsA.map((text) => ({ playerId: m.authorA, text })),
        ...result.calloutsB.map((text) => ({ playerId: m.authorB, text })),
      ],
    };
    this.voteSubphase = "reveal";
    this.timerEndsAt = now() + REVEAL_MS;
    this.touch();
  }

  closeNWay(kind: "round" | "finale") {
    const votes = kind === "finale" ? this.finaleVotes : this.onePotVotes;
    const tally = Object.fromEntries(this.ids().map((id) => [id, 0]));
    for (const [voter, choice] of Object.entries(votes)) {
      if (choice === voter) continue;
      if (tally[choice] !== undefined) tally[choice]++;
    }
    const entries = this.ids().map((playerId) => ({ playerId, votes: tally[playerId] ?? 0 }));
    const last =
      kind === "finale" ? this.lastPlaceIds : lastPlaceIds(this.playerList().map((p) => ({ id: p.id, score: p.score })));
    const rows = scoreFinale({
      entries,
      lastPlaceIds: last,
      comebackBoost: kind === "finale" && this.settings.underdough,
    });
    for (const row of rows) {
      const p = this.players.get(row.playerId);
      if (!p) continue;
      p.score += row.points;
      this.roundDelta.set(row.playerId, (this.roundDelta.get(row.playerId) ?? 0) + row.points);
    }
    this.finaleReveal = {
      format: kind === "finale" ? this.finaleFormat : "hot_pan",
      promptText:
        kind === "finale" ? (this.finalePrompt?.text ?? "") : (this.onePotPrompt?.text ?? ""),
      results: rows
        .map((row) => {
          const p = this.players.get(row.playerId)!;
          const rendered =
            kind === "finale"
              ? renderFinaleAnswer(
                  this.finaleFormat,
                  this.finalePrompt?.text ?? "",
                  this.finaleAnswers.get(row.playerId)?.answers ?? [],
                )
              : this.answers.get(ansKey(row.playerId, this.onePotPrompt!.id))?.text ?? "";
          return {
            playerId: row.playerId,
            name: p.name,
            color: p.color,
            rendered,
            answers:
              kind === "finale"
                ? (this.finaleAnswers.get(row.playerId)?.answers ?? [])
                : [this.answers.get(ansKey(row.playerId, this.onePotPrompt!.id))?.text ?? ""],
            votes: row.votes,
            points: row.points,
            callouts: row.callouts,
          };
        })
        .sort((a, b) => b.votes - a.votes || b.points - a.points),
    };
    this.voteSubphase = "reveal";
    this.timerEndsAt = now() + (kind === "finale" ? FINALE_REVEAL_MS : REVEAL_MS + 2000);
    this.touch();
  }

  submitFinale(playerId: string, answers: string[]): string | undefined {
    if (this.phase !== "finale_answer") return "not the finale";
    const n = finaleBlanks(this.finaleFormat);
    const cleaned = answers.map((a) => a.trim().slice(0, 80)).slice(0, n);
    while (cleaned.length < n) cleaned.push("");
    if (cleaned.some((a) => !a)) return "fill every blank (or wait for a Backup Spread)";
    this.finaleAnswers.set(playerId, { answers: cleaned, isBackup: false });
    if (this.ids().every((id) => this.finaleAnswers.has(id))) this.closeFinaleAnswer();
    return undefined;
  }

  closeFinaleAnswer() {
    for (const id of this.ids()) this.fillBackupsFor(id);
    this.finaleVotes = {};
    this.ballotIds = shuffle(this.ids());
    this.phase = "finale_vote";
    this.voteSubphase = "voting";
    this.timerEndsAt = now() + VOTE_MS[this.settings.timerSpeed] + 5000;
    this.touch();
  }

  beginFinale() {
    this.lastPlaceIds = lastPlaceIds(this.playerList().map((p) => ({ id: p.id, score: p.score })));
    this.finalePrompt = pickFinale(this.finaleFormat, this.settings.rating, this.usedPromptIds);
    this.usedPromptIds.add(this.finalePrompt.id);
    this.finaleAnswers.clear();
    this.finaleVotes = {};
    this.enter("finale_answer", finaleAnswerMs(this.finaleFormat, this.settings.timerSpeed));
  }

  finishGame() {
    const ranked = this.playerList().sort((a, b) => b.score - a.score);
    this.winnerId = ranked[0]?.id;
    const names = Object.fromEntries(this.playerList().map((p) => [p.id, p.name]));
    this.awards = computeKitchenAwards({
      playerIds: this.ids(),
      names,
      matchups: this.scoredMatchups,
      finale: this.ids().map((id) => ({
        playerId: id,
        votes: Object.values(this.finaleVotes).filter((v) => v === id).length,
      })),
    });
    this.reel = [...this.reel].sort((a, b) => b.margin - a.margin || b.sizzles - a.sizzles).slice(0, 6);
    this.enter("game_over");
  }

  playAgain(by: string): string | undefined {
    if (by !== this.hostId) return "only the host";
    if (this.phase !== "game_over") return "finish this one first";
    for (const p of this.players.values()) {
      p.score = 0;
      p.streak = 0;
    }
    this.phase = "lobby";
    this.timerEndsAt = undefined;
    this.dealt = [];
    this.answers.clear();
    this.matchups = [];
    this.scoredMatchups = [];
    this.reel = [];
    this.awards = [];
    this.winnerId = undefined;
    this.finaleAnswers.clear();
    this.notice = "same Kitchen, fresh butter";
    this.touch();
    return undefined;
  }

  hostAdvance(by: string): string | undefined {
    if (by !== this.hostId) return "only the host";
    this.advance();
    return undefined;
  }

  tick() {
    this.nudgeBots();
    if (this.belowMinSince && now() - this.belowMinSince > GRACE_MS) {
      this.notice = "too many cooks left — this Kitchen closed";
      this.enter("game_over");
      this.belowMinSince = undefined;
      return;
    }
    if (this.timerEndsAt && now() >= this.timerEndsAt) this.advance();
  }

  advance() {
    if (this.phase === "round_answer") {
      this.closeAnswering();
      return;
    }
    if (this.phase === "round_vote" && this.roundKind === "head_to_head") {
      if (this.voteSubphase === "voting") {
        this.closeMatchup();
        return;
      }
      this.matchupIndex += 1;
      if (this.matchupIndex >= this.matchups.length) {
        this.enter("round_score", SCOREBOARD_MS);
        return;
      }
      this.enterVote();
      return;
    }
    if (this.phase === "round_vote" && this.roundKind === "everyone_answers") {
      if (this.voteSubphase === "voting") {
        this.closeNWay("round");
        return;
      }
      this.enter("round_score", SCOREBOARD_MS);
      return;
    }
    if (this.phase === "round_score") {
      if (this.round === 1) this.beginRound(2);
      else this.beginFinale();
      return;
    }
    if (this.phase === "finale_answer") {
      this.closeFinaleAnswer();
      return;
    }
    if (this.phase === "finale_vote") {
      if (this.voteSubphase === "voting") {
        this.closeNWay("finale");
        return;
      }
      this.enter("finale_score", SCOREBOARD_MS);
      return;
    }
    if (this.phase === "finale_score") {
      this.finishGame();
    }
  }

  nudgeBots() {
    const bots = this.playerList().filter((p) => p.isBot);
    if (bots.length === 0) return;
    if (this.phase === "round_answer") {
      for (const bot of bots) {
        if (Math.random() > 0.08) continue;
        if (this.roundKind === "everyone_answers" && this.onePotPrompt) {
          if (!this.answers.has(ansKey(bot.id, this.onePotPrompt.id))) {
            this.submitAnswer(bot.id, this.onePotPrompt.id, pickBackup(this.settings.rating));
          }
        } else {
          for (const d of promptsForPlayer(this.dealt, bot.id)) {
            if (!this.answers.has(ansKey(bot.id, d.promptId))) {
              this.submitAnswer(bot.id, d.promptId, pickBackup(this.settings.rating));
              break;
            }
          }
        }
      }
    }
    if (this.phase === "finale_answer" && this.finalePrompt) {
      for (const bot of bots) {
        if (this.finaleAnswers.has(bot.id)) continue;
        if (Math.random() > 0.08) continue;
        const n = finaleBlanks(this.finaleFormat);
        this.submitFinale(
          bot.id,
          Array.from({ length: n }, () => pickBackup(this.settings.rating)),
        );
      }
    }
    if (this.phase === "round_vote" && this.voteSubphase === "voting" && this.roundKind === "head_to_head") {
      const m = this.matchups[this.matchupIndex];
      if (!m) return;
      for (const bot of bots) {
        if (bot.id === m.authorA || bot.id === m.authorB) continue;
        if (m.votes[bot.id]) continue;
        if (Math.random() > 0.12) continue;
        this.castVote(bot.id, m.id, Math.random() < 0.5 ? "A" : "B");
      }
    }
    if (
      this.voteSubphase === "voting" &&
      ((this.phase === "round_vote" && this.roundKind === "everyone_answers") || this.phase === "finale_vote")
    ) {
      const votes = this.phase === "finale_vote" ? this.finaleVotes : this.onePotVotes;
      for (const bot of bots) {
        if (votes[bot.id]) continue;
        if (Math.random() > 0.12) continue;
        const options = this.ids().filter((id) => id !== bot.id);
        const pick = options[Math.floor(Math.random() * options.length)];
        if (pick) this.castVote(bot.id, "ballot", pick);
      }
    }
  }
}

function ansKey(playerId: string, promptId: string) {
  return `${playerId}:${promptId}`;
}

export class Lobby {
  rooms = new Map<string, Kitchen>();

  create(name: string, color: string, settings?: Partial<RoomSettings>): { room: Kitchen; player: Player } {
    const code = generateRoomCode(new Set(this.rooms.keys()));
    const host: Player = {
      id: randomUUID(),
      name: name.trim().slice(0, 18) || "Host",
      color: color || PLAYER_COLORS[0],
      connected: true,
      score: 0,
      streak: 0,
      joinedAt: now(),
    };
    const room = new Kitchen(code, host, settings ?? {});
    this.rooms.set(code, room);
    return { room, player: host };
  }

  join(
    code: string,
    name: string,
    color: string,
    playerId?: string,
  ): { room: Kitchen; player: Player } | { error: string } {
    const room = this.rooms.get(code);
    if (!room) return { error: "no Kitchen with that code" };
    if (playerId && room.players.has(playerId)) {
      const player = room.players.get(playerId)!;
      player.connected = true;
      if (name.trim()) player.name = name.trim().slice(0, 18);
      return { room, player };
    }
    const added = room.addPlayer(name, color);
    if ("error" in added) return added;
    return { room, player: added };
  }
}

export { minPlayers };
