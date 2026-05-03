// Types aligned with Tasfiya's shared/src/types.ts
export type Position =
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "OF"
  | "MI"
  | "CI"
  | "U"
  | "P";
export type Risk = "Low" | "Med" | "High";
export type DepthRole =
  | "Starter"
  | "Backup"
  | "Platoon"
  | "Bench"
  | "Minors"
  | "Unknown";

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

export interface Player {
  id: string;
  name: string;
  mlbTeam?: string;
  positions: Position[];
  bats?: "R" | "L" | "S";
  throws?: "R" | "L";
  depthRole?: DepthRole;
  risk?: Risk;
  age?: number;
  injuryStatus?: InjuryStatus | null;
  injuryNote?: string | null;
  injuryReturn?: string | null;
  prevStats?: HitterStats | PitcherStats;
  projStats?: HitterStats | PitcherStats;
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
  playerName?: string;
  mlbTeam?: string;
  title: string;
  date: string;
  source?: string;
}

export const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Jarren Duran",
    mlbTeam: "BOS",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Low",
    age: 27,
    injuryStatus: "Active",
    prevStats: { games: 157, hr: 21, rbi: 67, r: 91, sb: 26, avg: 0.291 },
    projStats: { hr: 18, rbi: 62, r: 88, sb: 28, avg: 0.286 },
  },
  {
    id: "2",
    name: "Corbin Carroll",
    mlbTeam: "ARI",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Med",
    age: 24,
    injuryStatus: "Active",
    prevStats: { games: 136, hr: 15, rbi: 54, r: 82, sb: 30, avg: 0.241 },
    projStats: { hr: 22, rbi: 72, r: 102, sb: 45, avg: 0.278 },
  },
  {
    id: "3",
    name: "Gunnar Henderson",
    mlbTeam: "BAL",
    positions: ["SS", "3B"],
    depthRole: "Starter",
    risk: "Low",
    age: 23,
    injuryStatus: "Active",
    prevStats: { games: 159, hr: 37, rbi: 99, r: 107, sb: 16, avg: 0.281 },
    projStats: { hr: 28, rbi: 88, r: 98, sb: 22, avg: 0.282 },
  },
  {
    id: "4",
    name: "Francisco Lindor",
    mlbTeam: "NYM",
    positions: ["SS"],
    depthRole: "Starter",
    risk: "Low",
    age: 31,
    injuryStatus: "Active",
    prevStats: { games: 161, hr: 28, rbi: 89, r: 98, sb: 23, avg: 0.273 },
    projStats: { hr: 26, rbi: 82, r: 95, sb: 18, avg: 0.273 },
  },
  {
    id: "5",
    name: "Elly De La Cruz",
    mlbTeam: "CIN",
    positions: ["SS", "3B"],
    depthRole: "Starter",
    risk: "High",
    age: 22,
    injuryStatus: "Day-to-Day",
    injuryNote: "Left hamstring tightness",
    prevStats: { games: 148, hr: 20, rbi: 68, r: 85, sb: 34, avg: 0.255 },
    projStats: { hr: 24, rbi: 76, r: 92, sb: 38, avg: 0.268 },
  },
  {
    id: "6",
    name: "Kyle Tucker",
    mlbTeam: "CHC",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Med",
    age: 28,
    injuryStatus: "Active",
    prevStats: { games: 153, hr: 29, rbi: 98, r: 84, sb: 12, avg: 0.289 },
    projStats: { hr: 27, rbi: 95, r: 88, sb: 14, avg: 0.285 },
  },
  {
    id: "7",
    name: "William Contreras",
    mlbTeam: "MIL",
    positions: ["C"],
    depthRole: "Starter",
    risk: "Low",
    age: 27,
    injuryStatus: "Active",
    prevStats: { games: 138, hr: 22, rbi: 77, r: 72, sb: 3, avg: 0.278 },
    projStats: { hr: 20, rbi: 72, r: 68, sb: 4, avg: 0.276 },
  },
  {
    id: "8",
    name: "Adley Rutschman",
    mlbTeam: "BAL",
    positions: ["C"],
    depthRole: "Starter",
    risk: "Low",
    age: 27,
    injuryStatus: "Active",
    prevStats: { games: 140, hr: 18, rbi: 72, r: 74, sb: 1, avg: 0.267 },
    projStats: { hr: 22, rbi: 78, r: 76, sb: 2, avg: 0.271 },
  },
  {
    id: "9",
    name: "Matt McLain",
    mlbTeam: "CIN",
    positions: ["SS", "MI"],
    depthRole: "Starter",
    risk: "High",
    age: 25,
    injuryStatus: "10-Day IL",
    injuryNote: "Right shoulder inflammation",
    injuryReturn: "2026-05-20T00:00:00.000Z",
    prevStats: { games: 44, hr: 5, rbi: 18, r: 28, sb: 6, avg: 0.244 },
    projStats: { hr: 16, rbi: 52, r: 72, sb: 18, avg: 0.262 },
  },
  {
    id: "10",
    name: "Bobby Witt Jr.",
    mlbTeam: "KCR",
    positions: ["SS", "3B"],
    depthRole: "Starter",
    risk: "Low",
    age: 24,
    injuryStatus: "Active",
    prevStats: { games: 160, hr: 33, rbi: 97, r: 109, sb: 44, avg: 0.293 },
    projStats: { hr: 32, rbi: 92, r: 108, sb: 42, avg: 0.288 },
  },
  {
    id: "11",
    name: "Yordan Alvarez",
    mlbTeam: "HOU",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Med",
    age: 27,
    injuryStatus: "Active",
    prevStats: { games: 134, hr: 35, rbi: 101, r: 82, sb: 1, avg: 0.298 },
    projStats: { hr: 38, rbi: 108, r: 86, sb: 2, avg: 0.295 },
  },
  {
    id: "12",
    name: "José Ramírez",
    mlbTeam: "CLE",
    positions: ["3B"],
    depthRole: "Starter",
    risk: "Low",
    age: 32,
    injuryStatus: "Active",
    prevStats: { games: 158, hr: 28, rbi: 94, r: 88, sb: 21, avg: 0.279 },
    projStats: { hr: 30, rbi: 96, r: 90, sb: 24, avg: 0.284 },
  },
  {
    id: "13",
    name: "Shohei Ohtani",
    mlbTeam: "LAD",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Low",
    age: 31,
    injuryStatus: "Active",
    prevStats: { games: 159, hr: 44, rbi: 110, r: 102, sb: 20, avg: 0.296 },
    projStats: { hr: 42, rbi: 102, r: 98, sb: 18, avg: 0.292 },
  },
  {
    id: "14",
    name: "Mookie Betts",
    mlbTeam: "LAD",
    positions: ["OF", "SS"],
    depthRole: "Starter",
    risk: "Med",
    age: 32,
    injuryStatus: "60-Day IL",
    injuryNote: "Right hand fracture",
    injuryReturn: "2026-06-15T00:00:00.000Z",
    prevStats: { games: 116, hr: 19, rbi: 58, r: 76, sb: 10, avg: 0.261 },
    projStats: { hr: 28, rbi: 78, r: 102, sb: 14, avg: 0.278 },
  },
  {
    id: "15",
    name: "Randy Arozarena",
    mlbTeam: "SEA",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Med",
    age: 29,
    injuryStatus: "Active",
    prevStats: { games: 151, hr: 17, rbi: 66, r: 78, sb: 19, avg: 0.248 },
    projStats: { hr: 20, rbi: 72, r: 82, sb: 18, avg: 0.265 },
  },
  {
    id: "16",
    name: "Zac Gallen",
    mlbTeam: "ARI",
    positions: ["P"],
    depthRole: "Starter",
    risk: "Med",
    age: 29,
    injuryStatus: "Active",
    prevStats: { w: 14, era: 3.47, whip: 1.14, k: 194, sv: 0, ip: 190 },
    projStats: { w: 15, era: 3.35, whip: 1.12, k: 198, sv: 0, ip: 195 },
  },
  {
    id: "17",
    name: "Gerrit Cole",
    mlbTeam: "NYY",
    positions: ["P"],
    depthRole: "Starter",
    risk: "High",
    age: 34,
    injuryStatus: "15-Day IL",
    injuryNote: "Right elbow nerve irritation",
    injuryReturn: "2026-05-10T00:00:00.000Z",
    prevStats: { w: 11, era: 3.41, whip: 1.09, k: 188, sv: 0, ip: 158 },
    projStats: { w: 14, era: 3.55, whip: 1.08, k: 205, sv: 0, ip: 178 },
  },
  {
    id: "18",
    name: "Spencer Strider",
    mlbTeam: "ATL",
    positions: ["P"],
    depthRole: "Starter",
    risk: "High",
    age: 25,
    injuryStatus: "Active",
    prevStats: { w: 9, era: 3.18, whip: 1.08, k: 176, sv: 0, ip: 145 },
    projStats: { w: 12, era: 3.25, whip: 1.15, k: 210, sv: 0, ip: 165 },
  },
  {
    id: "19",
    name: "Emmanuel Clase",
    mlbTeam: "CLE",
    positions: ["P"],
    depthRole: "Starter",
    risk: "Low",
    age: 27,
    injuryStatus: "Active",
    prevStats: { w: 3, era: 2.55, whip: 0.98, k: 68, sv: 44, ip: 71 },
    projStats: { w: 4, era: 2.85, whip: 1.02, k: 72, sv: 38, ip: 68 },
  },
  {
    id: "20",
    name: "Pete Alonso",
    mlbTeam: "NYM",
    positions: ["1B"],
    depthRole: "Starter",
    risk: "Low",
    age: 30,
    injuryStatus: "Active",
    prevStats: { games: 157, hr: 34, rbi: 99, r: 74, sb: 1, avg: 0.245 },
    projStats: { hr: 38, rbi: 102, r: 78, sb: 2, avg: 0.248 },
  },
];

export const mockValuations: Record<string, Valuation> = {
  "1": {
    playerId: "1",
    dollarValue: 38,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
  "2": {
    playerId: "2",
    dollarValue: 32,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role.",
  },
  "3": {
    playerId: "3",
    dollarValue: 47,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
  "4": {
    playerId: "4",
    dollarValue: 42,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
  "5": {
    playerId: "5",
    dollarValue: 33,
    updatedAt: new Date().toISOString(),
    explanation:
      "Base value adjusted for starting role, elevated risk discount.",
  },
  "6": {
    playerId: "6",
    dollarValue: 41,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role.",
  },
  "7": {
    playerId: "7",
    dollarValue: 30,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
  "8": {
    playerId: "8",
    dollarValue: 32,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
  "9": {
    playerId: "9",
    dollarValue: 15,
    updatedAt: new Date().toISOString(),
    explanation:
      "Base value adjusted for starting role, elevated risk discount.",
  },
  "10": {
    playerId: "10",
    dollarValue: 50,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
  "11": {
    playerId: "11",
    dollarValue: 44,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role.",
  },
  "12": {
    playerId: "12",
    dollarValue: 46,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
  "13": {
    playerId: "13",
    dollarValue: 57,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
  "14": {
    playerId: "14",
    dollarValue: 43,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role.",
  },
  "15": {
    playerId: "15",
    dollarValue: 27,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role.",
  },
  "16": {
    playerId: "16",
    dollarValue: 24,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role.",
  },
  "17": {
    playerId: "17",
    dollarValue: 17,
    updatedAt: new Date().toISOString(),
    explanation:
      "Base value adjusted for starting role, elevated risk discount.",
  },
  "18": {
    playerId: "18",
    dollarValue: 21,
    updatedAt: new Date().toISOString(),
    explanation:
      "Base value adjusted for starting role, elevated risk discount.",
  },
  "19": {
    playerId: "19",
    dollarValue: 18,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
  "20": {
    playerId: "20",
    dollarValue: 31,
    updatedAt: new Date().toISOString(),
    explanation: "Base value adjusted for starting role, low risk.",
  },
};

export const mockTransactions: Transaction[] = [
  {
    id: "t1",
    title: "Placed on 60-day IL",
    date: new Date("2026-03-01").toISOString(),
    source: "MLB",
  },
  {
    id: "t2",
    title: "Signed to extension",
    date: new Date("2026-02-28").toISOString(),
    source: "MLB",
  },
  {
    id: "t3",
    title: "Traded to new team",
    date: new Date("2026-02-25").toISOString(),
    source: "MLB",
  },
  {
    id: "t4",
    title: "Optioned to minors",
    date: new Date("2026-03-02").toISOString(),
    source: "MLB",
  },
  {
    id: "t5",
    title: "Activated from IL",
    date: new Date("2026-02-20").toISOString(),
    source: "MLB",
  },
  {
    id: "t6",
    title: "Placed on 15-day IL",
    date: new Date("2026-03-03").toISOString(),
    source: "MLB",
  },
  {
    id: "t7",
    title: "Designated for assignment",
    date: new Date("2026-02-22").toISOString(),
    source: "MLB",
  },
  {
    id: "t8",
    title: "Recalled from minors",
    date: new Date("2026-03-04").toISOString(),
    source: "MLB",
  },
];
