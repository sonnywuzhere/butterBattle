export const SIZZLES = ["😂", "🔥", "🥰", "🧈", "🫠"] as const;
export type SizzleEmoji = (typeof SIZZLES)[number];

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;

export type ContentRating = "mild" | "salted" | "spicy";
export type TimerSpeed = "fast" | "normal" | "relaxed";
export type FinaleFormat = "triple_churn" | "three_spreads" | "hot_pan";
export type FinaleFormatSetting = FinaleFormat | "random";
export type PromptKind = "quip" | "fill_blank" | "caption";
export type RoundKind = "head_to_head" | "everyone_answers";
export type Round2Setting = RoundKind | "random";
export type AwardId = "butteriest" | "crowd_favorite" | "burnt_toast" | "backup_survivor";

export type Phase =
  | "lobby"
  | "prompt_submit"
  | "round_answer"
  | "round_vote"
  | "round_score"
  | "finale_answer"
  | "finale_vote"
  | "finale_score"
  | "game_over";

export type VoteSubphase = "voting" | "reveal";

export interface RoomSettings {
  rating: ContentRating;
  timerSpeed: TimerSpeed;
  promptWriting: boolean;
  finaleFormat: FinaleFormatSetting;
  round2: Round2Setting;
  doubleButter: boolean;
  onARoll: boolean;
  hotOffThePan: boolean;
  underdough: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  rating: "salted",
  timerSpeed: "normal",
  promptWriting: false,
  finaleFormat: "random",
  round2: "random",
  doubleButter: true,
  onARoll: true,
  hotOffThePan: true,
  underdough: true,
};

export const PLAYER_COLORS = [
  "#C45C26",
  "#D4A017",
  "#2F6F4E",
  "#3D5A80",
  "#8B3A62",
  "#6B4F2A",
  "#B85C38",
  "#4A6FA5",
] as const;

export interface Player {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  score: number;
  streak: number;
  joinedAt: number;
  isBot?: boolean;
}

export interface Prompt {
  id: string;
  text: string;
  rating: ContentRating;
  pack: string;
  kind: PromptKind;
  blanks?: number;
  imageUrl?: string;
}

export interface DealtPrompt {
  id: string;
  promptId: string;
  text: string;
  kind: PromptKind;
  imageUrl?: string;
  authorIds: [string, string];
}

export interface KitchenAward {
  id: AwardId;
  title: string;
  subtitle: string;
  playerId: string;
}

export interface Answer {
  promptId: string;
  playerId: string;
  text: string;
  doubleButter: boolean;
  isBackup: boolean;
}

export interface Matchup {
  id: string;
  promptId: string;
  promptText: string;
  kind: PromptKind;
  imageUrl?: string;
  authorA: string;
  authorB: string;
  answerA: string;
  answerB: string;
  backupA: boolean;
  backupB: boolean;
  doubleButterA: boolean;
  doubleButterB: boolean;
  votes: Record<string, "A" | "B">;
  sizzles: number;
}

export interface MatchupResult {
  matchupId: string;
  votesA: number;
  votesB: number;
  eligible: number;
  winner: "A" | "B" | "tie";
  pointsA: number;
  pointsB: number;
  calloutsA: string[];
  calloutsB: string[];
  newStreakA: number;
  newStreakB: number;
}

export interface FinaleEntry {
  playerId: string;
  answers: string[];
  rendered: string;
  isBackup: boolean;
}

export interface ScoreCallout {
  playerId: string;
  text: string;
}

export interface Highlight {
  promptText: string;
  answer: string;
  authorId: string;
  authorName: string;
  margin: number;
  sizzles: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  score: number;
  streak: number;
  isHost: boolean;
  isBot?: boolean;
}

export interface YourPrompt {
  id: string;
  text: string;
  kind: PromptKind;
  imageUrl?: string;
  submitted: boolean;
  doubleButter: boolean;
}

export interface RoomSnapshot {
  code: string;
  youId: string;
  hostId: string;
  phase: Phase;
  voteSubphase?: VoteSubphase;
  settings: RoomSettings;
  players: PublicPlayer[];
  round?: 1 | 2;
  timerEndsAt?: number;
  waitingOn?: string[];
  roundKind?: RoundKind;
  yourPrompts?: YourPrompt[];
  ballot?: {
    promptText: string;
    kind?: PromptKind;
    imageUrl?: string;
    entries: { id: string; rendered: string; answers?: string[] }[];
    youVoted?: string;
  };
  matchup?: {
    id: string;
    promptText: string;
    kind: PromptKind;
    imageUrl?: string;
    answerA: string;
    answerB: string;
    youAreAuthor: boolean;
    yourSide?: "A" | "B";
    youVoted?: "A" | "B";
    index: number;
    total: number;
  };
  reveal?: {
    matchupId: string;
    promptText: string;
    answerA: string;
    answerB: string;
    authorA: PublicPlayer;
    authorB: PublicPlayer;
    votesA: number;
    votesB: number;
    eligible: number;
    winner: "A" | "B" | "tie";
    pointsA: number;
    pointsB: number;
    callouts: ScoreCallout[];
  };
  standings?: { id: string; name: string; color: string; score: number; delta: number }[];
  finale?: {
    format: FinaleFormat;
    promptText: string;
    blanks: number;
    yourAnswers: string[];
    submitted: boolean;
    entries?: { id: string; rendered: string; answers: string[] }[];
    youVoted?: string;
  };
  finaleReveal?: {
    format: FinaleFormat;
    promptText: string;
    results: {
      playerId: string;
      name: string;
      color: string;
      rendered: string;
      answers: string[];
      votes: number;
      points: number;
      callouts: string[];
    }[];
  };
  winnerId?: string;
  awards?: KitchenAward[];
  reel?: Highlight[];
  notice?: string;
}

export type ClientIntent =
  | { type: "room:create"; name: string; color: string; settings?: Partial<RoomSettings> }
  | { type: "room:join"; code: string; name: string; color: string; playerId?: string }
  | { type: "game:start" }
  | { type: "answer:submit"; promptId: string; text: string; doubleButter?: boolean }
  | { type: "finale:submit"; answers: string[] }
  | { type: "vote:cast"; matchupId: string; choice: "A" | "B" | string }
  | { type: "react:send"; emoji: string }
  | { type: "host:advance" }
  | { type: "host:skipPlayer"; playerId: string }
  | { type: "host:fillBots" }
  | { type: "host:updateSettings"; settings: Partial<RoomSettings> }
  | { type: "game:playAgain" };
