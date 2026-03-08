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

export interface Player {
  id: string;
  name: string;
  mlbTeam?: string;
  positions: Position[];
  bats?: "R" | "L" | "S";
  throws?: "R" | "L";
  depthRole?: DepthRole;
  risk?: Risk;
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

export const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Jarren Duran",
    mlbTeam: "BOS",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Low",
  },
  {
    id: "2",
    name: "Corbin Carroll",
    mlbTeam: "ARI",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Med",
  },
  {
    id: "3",
    name: "Gunnar Henderson",
    mlbTeam: "BAL",
    positions: ["SS", "3B"],
    depthRole: "Starter",
    risk: "Low",
  },
  {
    id: "4",
    name: "Francisco Lindor",
    mlbTeam: "NYM",
    positions: ["SS"],
    depthRole: "Starter",
    risk: "Low",
  },
  {
    id: "5",
    name: "Elly De La Cruz",
    mlbTeam: "CIN",
    positions: ["SS", "3B"],
    depthRole: "Starter",
    risk: "High",
  },
  {
    id: "6",
    name: "Kyle Tucker",
    mlbTeam: "CHC",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Med",
  },
  {
    id: "7",
    name: "William Contreras",
    mlbTeam: "MIL",
    positions: ["C"],
    depthRole: "Starter",
    risk: "Low",
  },
  {
    id: "8",
    name: "Adley Rutschman",
    mlbTeam: "BAL",
    positions: ["C"],
    depthRole: "Starter",
    risk: "Low",
  },
  {
    id: "9",
    name: "Matt McLain",
    mlbTeam: "CIN",
    positions: ["SS", "MI"],
    depthRole: "Starter",
    risk: "High",
  },
  {
    id: "10",
    name: "Bobby Witt Jr.",
    mlbTeam: "KCR",
    positions: ["SS", "3B"],
    depthRole: "Starter",
    risk: "Low",
  },
  {
    id: "11",
    name: "Yordan Alvarez",
    mlbTeam: "HOU",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Med",
  },
  {
    id: "12",
    name: "José Ramírez",
    mlbTeam: "CLE",
    positions: ["3B"],
    depthRole: "Starter",
    risk: "Low",
  },
  {
    id: "13",
    name: "Shohei Ohtani",
    mlbTeam: "LAD",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Low",
  },
  {
    id: "14",
    name: "Mookie Betts",
    mlbTeam: "LAD",
    positions: ["OF", "SS"],
    depthRole: "Starter",
    risk: "Med",
  },
  {
    id: "15",
    name: "Randy Arozarena",
    mlbTeam: "SEA",
    positions: ["OF"],
    depthRole: "Starter",
    risk: "Med",
  },
  {
    id: "16",
    name: "Zac Gallen",
    mlbTeam: "ARI",
    positions: ["P"],
    depthRole: "Starter",
    risk: "Med",
  },
  {
    id: "17",
    name: "Gerrit Cole",
    mlbTeam: "NYY",
    positions: ["P"],
    depthRole: "Starter",
    risk: "High",
  },
  {
    id: "18",
    name: "Spencer Strider",
    mlbTeam: "ATL",
    positions: ["P"],
    depthRole: "Starter",
    risk: "High",
  },
  {
    id: "19",
    name: "Emmanuel Clase",
    mlbTeam: "CLE",
    positions: ["P"],
    depthRole: "Starter",
    risk: "Low",
  },
  {
    id: "20",
    name: "Pete Alonso",
    mlbTeam: "NYM",
    positions: ["1B"],
    depthRole: "Starter",
    risk: "Low",
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
