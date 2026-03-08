export type Position = "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "SP" | "RP";
export type RiskLevel = "low" | "medium" | "high";
export type DepthStatus = "starter" | "backup" | "prospect";

export interface Player {
  id: string;
  name: string;
  mlbTeam: string;
  positions: Position[];
  riskLevel: RiskLevel;
  depthStatus: DepthStatus;
  estimatedValue: number;
  isEligible: boolean;
}

export interface Transaction {
  id: number;
  date: string;
  transaction: string;
}

export const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Jarren Duran",
    mlbTeam: "BOS",
    positions: ["OF"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 38,
    isEligible: true,
  },
  {
    id: "2",
    name: "Corbin Carroll",
    mlbTeam: "ARI",
    positions: ["OF"],
    riskLevel: "medium",
    depthStatus: "starter",
    estimatedValue: 32,
    isEligible: true,
  },
  {
    id: "3",
    name: "Gunnar Henderson",
    mlbTeam: "BAL",
    positions: ["SS", "3B"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 45,
    isEligible: true,
  },
  {
    id: "4",
    name: "Francisco Lindor",
    mlbTeam: "NYM",
    positions: ["SS"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 40,
    isEligible: true,
  },
  {
    id: "5",
    name: "Elly De La Cruz",
    mlbTeam: "CIN",
    positions: ["SS", "3B"],
    riskLevel: "high",
    depthStatus: "starter",
    estimatedValue: 36,
    isEligible: true,
  },
  {
    id: "6",
    name: "Kyle Tucker",
    mlbTeam: "CHC",
    positions: ["OF"],
    riskLevel: "medium",
    depthStatus: "starter",
    estimatedValue: 39,
    isEligible: true,
  },
  {
    id: "7",
    name: "William Contreras",
    mlbTeam: "MIL",
    positions: ["C"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 28,
    isEligible: true,
  },
  {
    id: "8",
    name: "Adley Rutschman",
    mlbTeam: "BAL",
    positions: ["C"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 30,
    isEligible: true,
  },
  {
    id: "9",
    name: "Matt McLain",
    mlbTeam: "CIN",
    positions: ["SS", "2B"],
    riskLevel: "high",
    depthStatus: "starter",
    estimatedValue: 18,
    isEligible: true,
  },
  {
    id: "10",
    name: "Witt Jr.",
    mlbTeam: "KCR",
    positions: ["SS", "3B"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 48,
    isEligible: true,
  },
  {
    id: "11",
    name: "Yordan Alvarez",
    mlbTeam: "HOU",
    positions: ["OF"],
    riskLevel: "medium",
    depthStatus: "starter",
    estimatedValue: 42,
    isEligible: true,
  },
  {
    id: "12",
    name: "José Ramírez",
    mlbTeam: "CLE",
    positions: ["3B"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 44,
    isEligible: true,
  },
  {
    id: "13",
    name: "Shohei Ohtani",
    mlbTeam: "LAD",
    positions: ["OF"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 55,
    isEligible: true,
  },
  {
    id: "14",
    name: "Mookie Betts",
    mlbTeam: "LAD",
    positions: ["OF", "SS"],
    riskLevel: "medium",
    depthStatus: "starter",
    estimatedValue: 41,
    isEligible: true,
  },
  {
    id: "15",
    name: "Randy Arozarena",
    mlbTeam: "SEA",
    positions: ["OF"],
    riskLevel: "medium",
    depthStatus: "starter",
    estimatedValue: 25,
    isEligible: true,
  },
  {
    id: "16",
    name: "Zac Gallen",
    mlbTeam: "ARI",
    positions: ["SP"],
    riskLevel: "medium",
    depthStatus: "starter",
    estimatedValue: 22,
    isEligible: true,
  },
  {
    id: "17",
    name: "Gerrit Cole",
    mlbTeam: "NYY",
    positions: ["SP"],
    riskLevel: "high",
    depthStatus: "starter",
    estimatedValue: 20,
    isEligible: true,
  },
  {
    id: "18",
    name: "Spencer Strider",
    mlbTeam: "ATL",
    positions: ["SP"],
    riskLevel: "high",
    depthStatus: "starter",
    estimatedValue: 24,
    isEligible: true,
  },
  {
    id: "19",
    name: "Emmanuel Clase",
    mlbTeam: "CLE",
    positions: ["RP"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 16,
    isEligible: true,
  },
  {
    id: "20",
    name: "Pete Alonso",
    mlbTeam: "NYM",
    positions: ["1B"],
    riskLevel: "low",
    depthStatus: "starter",
    estimatedValue: 29,
    isEligible: true,
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: 1,
    date: "2026-03-08T14:30:00Z",
    transaction: "Shohei Ohtani signed 2-year extension with LAD - $20M/year",
  },
  {
    id: 2,
    date: "2026-03-07T09:15:00Z",
    transaction: "Kyle Tucker traded from CHC to NYY for 3 prospects",
  },
  {
    id: 3,
    date: "2026-03-06T16:45:00Z",
    transaction: "Gunnar Henderson placed on 60-day IL with shoulder injury",
  },
  {
    id: 4,
    date: "2026-03-05T11:20:00Z",
    transaction: "Francisco Lindor re-signed with NYM - 5 years, $115M",
  },
  {
    id: 5,
    date: "2026-03-04T18:00:00Z",
    transaction: "Yordan Alvarez activated from IL, cleared to play",
  },
  {
    id: 6,
    date: "2026-03-03T13:30:00Z",
    transaction: "Randy Arozarena acquired by BOS in trade with SEA",
  },
  {
    id: 7,
    date: "2026-03-02T10:45:00Z",
    transaction: "Gerrit Cole signs 1-year deal with NYY - $15M incentives",
  },
  {
    id: 8,
    date: "2026-03-01T15:20:00Z",
    transaction: "José Ramírez out 4-6 weeks with hamstring strain",
  },
];
