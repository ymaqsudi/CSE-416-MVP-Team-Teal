// shared/src/types.ts

export type Position =
  | "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "MI" | "CI" | "U"
  | "P";

export type DepthRole = "Starter" | "Backup" | "Platoon" | "Bench" | "Minors" | "Unknown";

export interface Player {
  id: string;              // stable unique id
  name: string;
  mlbTeam?: string;        // e.g. "NYY"
  positions: Position[];   // eligible positions
  bats?: "R" | "L" | "S";
  throws?: "R" | "L";
  depthRole?: DepthRole;   // MVP: can be "Unknown"
  risk?: "Low" | "Med" | "High";
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
