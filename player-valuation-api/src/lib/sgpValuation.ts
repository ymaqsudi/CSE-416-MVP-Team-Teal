/**
 * Rotisserie SGP → dollar value (Activity 7).
 * Dynamic pool: replacement levels and sums use undrafted players only; budget uses remaining dollars.
 */

import { defaultRosterSlotsPerTeam, totalRosterSlotsPerTeam } from "./rosterDefaults.js";

/** Used when no draft session is supplied (stateless valuation for the draft kit). */
export const DEFAULT_DISPLAY_LEAGUE: LeagueConfig = {
  numTeams: 12,
  budget: 260,
  scoring: "5x5",
};

/** 12-team typical denominators from course materials */
const DENOM = {
  HR: 11,
  RBI: 31,
  R: 29,
  SB: 9,
  AVG: 0.003,
  W: 3,
  ERA: 0.15,
  WHIP: 0.025,
  K: 22,
  SV: 4,
} as const;

const LEAGUE_AVG_BA = 0.275;
const LEAGUE_AVG_ERA = 4.2;
const LEAGUE_AVG_WHIP = 1.28;

export type LeagueConfig = {
  numTeams: number;
  budget: number;
  scoring?: string;
  rosterSlotsPerTeam?: Record<string, number>;
};

export type DraftPickInput = {
  mlbPlayerId?: number;
  /** Fallback when a pick references our DB id (custom / legacy rows). */
  playerId?: string;
  teamInLeagueId: string;
  price: number;
};

export type DraftStateInput = {
  picks: DraftPickInput[];
  budgetsRemaining?: number[];
};

export type PlayerLean = {
  _id: unknown;
  mlbPlayerId?: number | null;
  mlbTeamId?: number | null;
  name: string;
  mlbTeam: string;
  positions: string[];
  bats?: string;
  throws?: string;
  depthRole?: string;
  risk?: string;
  isEligible?: boolean;
  projGames?: number;
  age?: number | null;
  injuryStatus?: string | null;
  injuryNote?: string | null;
  injuryReturn?: Date | null;
  /** Hitter 2026 projections */
  projHR?: number;
  projRBI?: number;
  projR?: number;
  projSB?: number;
  projAVG?: number;
  /** Pitcher 2026 projections */
  projW?: number;
  projERA?: number;
  projWHIP?: number;
  projK?: number;
  projSV?: number;
  projIP?: number;
  /** Hitter 2025 actual stats */
  prevGames?: number;
  prevHR?: number;
  prevRBI?: number;
  prevR?: number;
  prevSB?: number;
  prevAVG?: number;
  /** Pitcher 2025 actual stats */
  prevW?: number;
  prevERA?: number;
  prevWHIP?: number;
  prevK?: number;
  prevSV?: number;
  prevIP?: number;
  /** Baseball Savant Statcast — hitters */
  xba?: number;
  xslg?: number;
  xwoba?: number;
  barrelPct?: number;
  hardHitPct?: number;
  exitVelo?: number;
  kPct?: number;
  bbPct?: number;
  sprintSpeed?: number;
  /** Baseball Savant Statcast — pitchers */
  xera?: number;
  whiffPct?: number;
  barrelPctAgainst?: number;
  hardHitPctAgainst?: number;
  exitVeloAgainst?: number;
};

function isPitcher(p: PlayerLean): boolean {
  return p.positions.includes("P");
}

function availability(p: PlayerLean): number {
  const g = p.projGames ?? 162;
  return Math.min(1, Math.max(0, g / 162));
}

/**
 * Total SGP for the player (hitter or pitcher categories only).
 * Note: depth/role is intentionally NOT applied here — projections already reflect role.
 * Applying depthModifier on top double-counts the haircut.
 */
export function computePlayerSGP(p: PlayerLean): number {
  const avail = availability(p);

  if (isPitcher(p)) {
    const w = (p.projW ?? 0) * avail;
    const k = (p.projK ?? 0) * avail;
    const sv = (p.projSV ?? 0) * avail;
    const era = p.projERA ?? LEAGUE_AVG_ERA;
    const whip = p.projWHIP ?? LEAGUE_AVG_WHIP;
    const sgpW = w / DENOM.W;
    const sgpK = k / DENOM.K;
    const sgpSV = sv / DENOM.SV;
    const sgpERA = (LEAGUE_AVG_ERA - era) / DENOM.ERA;
    const sgpWHIP = (LEAGUE_AVG_WHIP - whip) / DENOM.WHIP;
    return Math.max(0, sgpW + sgpK + sgpSV + sgpERA + sgpWHIP);
  }

  const hr = (p.projHR ?? 0) * avail;
  const rbi = (p.projRBI ?? 0) * avail;
  const r = (p.projR ?? 0) * avail;
  const sb = (p.projSB ?? 0) * avail;
  const avg = p.projAVG ?? LEAGUE_AVG_BA;
  const sgpHR = hr / DENOM.HR;
  const sgpRBI = rbi / DENOM.RBI;
  const sgpR = r / DENOM.R;
  const sgpSB = sb / DENOM.SB;
  const sgpAVG = (avg - LEAGUE_AVG_BA) / DENOM.AVG;
  return Math.max(0, sgpHR + sgpRBI + sgpR + sgpSB + sgpAVG);
}

function rosterSlots(league: LeagueConfig): Record<string, number> {
  return league.rosterSlotsPerTeam ?? defaultRosterSlotsPerTeam();
}

export function totalAuctionBudget(league: LeagueConfig): number {
  const slots = rosterSlots(league);
  const perTeam = totalRosterSlotsPerTeam(slots);
  return Math.max(0, league.numTeams * league.budget - league.numTeams * perTeam);
}

export function isPlayerDrafted(p: PlayerLean, picks: DraftPickInput[]): boolean {
  const id = String(p._id);
  for (const pick of picks) {
    if (pick.mlbPlayerId != null && p.mlbPlayerId === pick.mlbPlayerId) return true;
    if (pick.playerId && pick.playerId === id) return true;
  }
  return false;
}

export function undraftedPlayers(all: PlayerLean[], picks: DraftPickInput[]): PlayerLean[] {
  return all.filter((p) => !isPlayerDrafted(p, picks));
}

export function remainingAuctionDollars(
  league: LeagueConfig,
  draft: DraftStateInput | undefined
): number {
  const initial = totalAuctionBudget(league);
  if (!draft?.picks?.length) {
    if (draft?.budgetsRemaining?.length) {
      const s = draft.budgetsRemaining.reduce((a, b) => a + b, 0);
      if (s > 0) return s;
    }
    return initial;
  }
  const spent = draft.picks.reduce((a, p) => a + p.price, 0);
  if (draft.budgetsRemaining?.length === league.numTeams) {
    const sum = draft.budgetsRemaining.reduce((a, b) => a + b, 0);
    if (sum > 0) return sum;
  }
  return Math.max(0, initial - spent);
}

/** Eligible at position if any position matches (exact). */
function eligibleAt(p: PlayerLean, pos: string): boolean {
  return p.positions.some((x) => x === pos);
}

/**
 * Replacement SGP at one position: SGP of the (N_teams * slots + 1)th best among `pool`, descending.
 */
function replacementSGPAtPosition(
  pool: PlayerLean[],
  pos: string,
  numTeams: number,
  slotsAtPos: number
): number {
  const eligible = pool.filter((p) => eligibleAt(p, pos));
  const ranked = [...eligible].sort((a, b) => computePlayerSGP(b) - computePlayerSGP(a));
  const idx = numTeams * slotsAtPos; // 0-based → (idx) is the replacement-tier player
  if (ranked.length === 0) return 0;
  if (idx >= ranked.length) return computePlayerSGP(ranked[ranked.length - 1]);
  return computePlayerSGP(ranked[idx]);
}

function sgpAboveReplacement(
  player: PlayerLean,
  pool: PlayerLean[],
  league: LeagueConfig
): { above: number; bestPosition?: string } {
  const slots = rosterSlots(league);
  const { numTeams } = league;
  const sgp = computePlayerSGP(player);
  let best = 0;
  let bestPosition: string | undefined;
  for (const pos of player.positions) {
    const slotCount = slots[pos];
    if (slotCount === undefined) continue;
    const rep = replacementSGPAtPosition(pool, pos, numTeams, slotCount);
    const sar = sgp - rep;
    if (sar > best) {
      best = sar;
      bestPosition = pos;
    }
  }
  return { above: Math.max(0, best), bestPosition };
}

export type ValuationBreakdown = {
  dollarValue: number;
  explanation: string;
  sgpAboveRep: number;
  bestPosition?: string;
  riskFlag?: string;
};

function riskNote(p: PlayerLean): string | undefined {
  if (availability(p) < 0.8) return "Availability below 80% of season.";
  if (p.risk === "High") return "Elevated injury/performance risk.";
  return undefined;
}

export function valuePool(
  undrafted: PlayerLean[],
  league: LeagueConfig,
  remainingDollars: number
): Map<string, ValuationBreakdown> {
  const byId = new Map<string, ValuationBreakdown>();
  let sumAbove = 0;
  const sgpList: {
    id: string;
    above: number;
    bestPosition?: string;
    p: PlayerLean;
  }[] = [];

  for (const p of undrafted) {
    if (p.isEligible === false) continue;
    const id = String(p._id);
    const { above, bestPosition } = sgpAboveReplacement(p, undrafted, league);
    sgpList.push({ id, above, bestPosition, p });
    sumAbove += above;
  }

  // $1/player floor is reserved up front so the proportional split distributes
  // only the leftover dollars. This keeps Σ(values) ≈ remainingDollars instead
  // of overshooting by ~N (the previous `+ 1` inside Math.round).
  const minDollarsReserved = sgpList.length;
  const distributable = Math.max(0, remainingDollars - minDollarsReserved);

  for (const { id, above, bestPosition, p } of sgpList) {
    const share = sumAbove > 0 ? (above / sumAbove) * distributable : 0;
    const dollarValue = Math.max(1, Math.round(1 + share));

    const parts: string[] = [];
    if (above > 0) parts.push("SGP above replacement");
    else parts.push("At or below replacement");
    if (p.depthRole === "Starter") parts.push("starting role");
    if (riskNote(p)) parts.push(riskNote(p)!);

    byId.set(id, {
      dollarValue,
      explanation: parts.join("; ") + ".",
      sgpAboveRep: Math.round(above * 100) / 100,
      bestPosition,
      riskFlag: riskNote(p),
    });
  }

  return byId;
}

export function adviceLabel(
  dollarValue: number,
  currentBid: number | undefined
): "Undervalued" | "Fair market value" | "Overpay risk" | undefined {
  if (currentBid === undefined || !Number.isFinite(currentBid)) return undefined;
  if (currentBid < dollarValue * 0.92) return "Undervalued";
  if (currentBid > dollarValue * 1.08) return "Overpay risk";
  return "Fair market value";
}

export function adviceColor(
  label: ReturnType<typeof adviceLabel>
): "green" | "yellow" | "red" | undefined {
  if (label === "Undervalued") return "green";
  if (label === "Fair market value") return "yellow";
  if (label === "Overpay risk") return "red";
  return undefined;
}

/** Resolve Mongo id string from hydrated or lean doc */
export function playerIdString(doc: { _id: unknown }): string {
  return String(doc._id);
}
