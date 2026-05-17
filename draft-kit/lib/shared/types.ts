// shared/src/types.ts

export type Position =
  | "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "MI" | "CI" | "U"
  | "P";

export type DepthRole = "Starter" | "Backup" | "Platoon" | "Bench" | "Minors" | "Unknown";

export type InjuryStatus =
  | "Active" | "Day-to-Day"
  | "10-Day IL" | "15-Day IL" | "60-Day IL"
  | "Out for Season" | "Suspended";

export interface HitterStats {
  games?: number;
  hr?: number;
  rbi?: number;
  r?: number;
  sb?: number;
  avg?: number;
}

export interface PitcherStats {
  w?: number;
  era?: number;
  whip?: number;
  k?: number;
  sv?: number;
  ip?: number;
}

export interface HitterSavantStats {
  xba?: number;
  xslg?: number;
  xwoba?: number;
  barrelPct?: number;
  hardHitPct?: number;
  exitVelo?: number;
  kPct?: number;
  bbPct?: number;
  sprintSpeed?: number;
}

export interface PitcherSavantStats {
  xera?: number;
  whiffPct?: number;
  barrelPctAgainst?: number;
  hardHitPctAgainst?: number;
  exitVeloAgainst?: number;
  kPct?: number;
  bbPct?: number;
}

export interface Player {
  id: string;              // stable unique id
  name: string;
  mlbTeam?: string;        // e.g. "NYY"
  positions: Position[];   // eligible positions
  bats?: "R" | "L" | "S";
  throws?: "R" | "L";
  depthRole?: DepthRole;   // MVP: can be "Unknown"
  risk?: "Low" | "Med" | "High";
  age?: number;
  injuryStatus?: InjuryStatus | null;
  injuryNote?: string | null;
  injuryReturn?: string | null;       // ISO date string
  prevStats?: HitterStats | PitcherStats;
  projStats?: HitterStats | PitcherStats;
  savantStats?: HitterSavantStats | PitcherSavantStats;
  // Populated for two-way players (e.g. Ohtani) so the UI can render both sides.
  hitterPrevStats?: HitterStats;
  pitcherPrevStats?: PitcherStats;
  hitterProjStats?: HitterStats;
  pitcherProjStats?: PitcherStats;
  hitterSavantStats?: HitterSavantStats;
  pitcherSavantStats?: PitcherSavantStats;
}

export interface Valuation {
  playerId: string;
  dollarValue: number;     // projected value
  updatedAt: string;       // ISO date string
  explanation?: string;    // short text
}

export interface Transaction {
  id: string;
  playerId?: string;
  playerName?: string;
  mlbTeam?: string;
  title: string;           // e.g. "Placed on 60-day IL"
  date: string;            // ISO date
  source?: string;         // optional
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export interface PlayersResponse {
  players: Player[];
}

export interface PlayerDetailResponse {
  player: Player;
}

export interface ValuationResponse {
  valuation: Valuation;
}

export interface TransactionsResponse {
  transactions: Transaction[];
}


export interface LeagueSettings {
  leagueName: string;
  numTeams: number;
  budget: number;
  // keep very flexible for MVP
  rosterSlots?: string[];
  categories?: string[];
}

export interface Team {
  id: string;
  name: string;
  budgetRemaining?: number;
  maxBid?: number;
}

export interface RosterSlot {
  position: string;     // keep as string for MVP to avoid UTIL/SP/RP issues
  playerId?: string | null;
  price?: number | null;
}

export interface DraftPick {
  id: string;
  timestamp: string;    // ISO
  teamId: string;
  playerId: string;
  price: number;
  position?: string;
  note?: string;
}
