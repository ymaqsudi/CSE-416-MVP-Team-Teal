export type Position = "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "MI" | "CI" | "U" | "P";
export type DepthRole = "Starter" | "Backup" | "Platoon" | "Bench" | "Minors" | "Unknown";
export interface Player {
    id: string;
    name: string;
    mlbTeam?: string;
    positions: Position[];
    bats?: "R" | "L" | "S";
    throws?: "R" | "L";
    depthRole?: DepthRole;
    risk?: "Low" | "Med" | "High";
}
export interface Valuation {
    playerId: string;
    dollarValue: number;
    updatedAt: string;
    explanation?: string;
}
export interface Transaction {
    id: string;
    playerId?: string;
    title: string;
    date: string;
    source?: string;
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
//# sourceMappingURL=types.d.ts.map