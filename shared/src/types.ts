// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  team: string;                 // MLB team abbreviation e.g. "NYY"
  positions: Position[];        // all eligible positions
  status: PlayerStatus;
  injuryNote?: string;
}

export interface Valuation {
  playerId: string;
  dollarValue: number;          // estimated auction dollar value
  explanation: string;          // e.g. "High OBP + elite power + thin position"
  riskFlag: boolean;
  riskNote?: string;
}

export interface DraftPick {
  id: string;
  playerId: string;
  teamName: string;
  price: number;
  round: number;
  timestamp: string;            // ISO 8601
}

export interface Team {
  id: string;
  name: string;
  budget: number;
  remainingBudget: number;
  roster: RosterSlot[];
}

export interface RosterSlot {
  position: Position;
  playerId?: string;            // undefined = empty slot
  isLocked: boolean;
}

// ─── Enums / Unions ───────────────────────────────────────────────────────────

export type Position = "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "SP" | "RP" | "P" | "UTIL" | "BN";

export type PlayerStatus = "active" | "injured" | "minors" | "ineligible";

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface PlayersResponse {
  players: Player[];
  total: number;
}

export interface ValuationResponse {
  valuation: Valuation;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ─── API Client Params ────────────────────────────────────────────────────────

export interface GetPlayersParams {
  q?: string;                   // name search
  position?: Position;
  limit?: number;
}
