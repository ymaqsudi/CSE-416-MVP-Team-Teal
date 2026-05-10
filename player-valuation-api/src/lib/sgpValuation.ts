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

/**
 * 12-team baseline denominators (course materials).
 * Counting-stat denominators scale roughly linearly with league size — wider category
 * distributions in deeper leagues mean a larger gap per standings point. Rate-stat
 * denominators are left invariant; their league-size sensitivity is small enough that
 * a fixed value is closer to right than a poorly-estimated scaler.
 */
type Denominators = {
  HR: number;
  RBI: number;
  R: number;
  SB: number;
  AVG: number;
  W: number;
  ERA: number;
  WHIP: number;
  K: number;
  SV: number;
};

const BASE_DENOM_12T: Denominators = {
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
};

function getDenominators(numTeams: number): Denominators {
  const factor = numTeams / 12;
  return {
    HR: BASE_DENOM_12T.HR * factor,
    RBI: BASE_DENOM_12T.RBI * factor,
    R: BASE_DENOM_12T.R * factor,
    SB: BASE_DENOM_12T.SB * factor,
    AVG: BASE_DENOM_12T.AVG,
    W: BASE_DENOM_12T.W * factor,
    ERA: BASE_DENOM_12T.ERA,
    WHIP: BASE_DENOM_12T.WHIP,
    K: BASE_DENOM_12T.K * factor,
    SV: BASE_DENOM_12T.SV * factor,
  };
}

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

/**
 * "Full season" innings baselines used to scale pitcher counting stats.
 * A 200-IP starter and a 65-IP closer are both "full" workloads in their roles —
 * scaling them against 162 games (the hitter baseline) was nonsensical and turned
 * a 32-start ace's 15 wins into 3 effective wins.
 */
const SP_BASELINE_IP = 200;
const RP_BASELINE_IP = 65;

function isReliever(p: PlayerLean): boolean {
  return (p.projSV ?? 0) >= 5;
}

/** Hitter availability: fraction of a 162-game season actually projected. */
function hitterAvailability(p: PlayerLean): number {
  const g = p.projGames ?? 162;
  return Math.min(1, Math.max(0, g / 162));
}

/**
 * Pitcher availability: fraction of a role-appropriate full workload.
 * Returns 1.0 when projIP is missing — trust the projection, don't fabricate a haircut.
 */
function pitcherAvailability(p: PlayerLean): number {
  const ip = p.projIP;
  if (ip == null || ip <= 0) return 1;
  const baseline = isReliever(p) ? RP_BASELINE_IP : SP_BASELINE_IP;
  return Math.min(1, ip / baseline);
}

function availability(p: PlayerLean): number {
  return isPitcher(p) ? pitcherAvailability(p) : hitterAvailability(p);
}

/**
 * Total SGP for the player (hitter or pitcher categories only).
 * Note: depth/role is intentionally NOT applied here — projections already reflect role.
 * Applying depthModifier on top double-counts the haircut.
 */
export function computePlayerSGP(p: PlayerLean, numTeams = 12): number {
  const denom = getDenominators(numTeams);
  const avail = availability(p);

  if (isPitcher(p)) {
    const w = (p.projW ?? 0) * avail;
    const k = (p.projK ?? 0) * avail;
    const sv = (p.projSV ?? 0) * avail;
    const era = p.projERA ?? LEAGUE_AVG_ERA;
    const whip = p.projWHIP ?? LEAGUE_AVG_WHIP;
    const sgpW = w / denom.W;
    const sgpK = k / denom.K;
    const sgpSV = sv / denom.SV;
    const sgpERA = (LEAGUE_AVG_ERA - era) / denom.ERA;
    const sgpWHIP = (LEAGUE_AVG_WHIP - whip) / denom.WHIP;
    return Math.max(0, sgpW + sgpK + sgpSV + sgpERA + sgpWHIP);
  }

  const hr = (p.projHR ?? 0) * avail;
  const rbi = (p.projRBI ?? 0) * avail;
  const r = (p.projR ?? 0) * avail;
  const sb = (p.projSB ?? 0) * avail;
  const avg = p.projAVG ?? LEAGUE_AVG_BA;
  const sgpHR = hr / denom.HR;
  const sgpRBI = rbi / denom.RBI;
  const sgpR = r / denom.R;
  const sgpSB = sb / denom.SB;
  const sgpAVG = (avg - LEAGUE_AVG_BA) / denom.AVG;
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
 * `pool` should already be filtered to players eligible at `pos` (caller's responsibility).
 */
function replacementSGPFromPool(
  poolAtPos: PlayerLean[],
  numTeams: number,
  slotsAtPos: number
): number {
  if (poolAtPos.length === 0) return 0;
  const ranked = [...poolAtPos].sort(
    (a, b) => computePlayerSGP(b, numTeams) - computePlayerSGP(a, numTeams),
  );
  const idx = numTeams * slotsAtPos; // 0-based → (idx) is the replacement-tier player
  if (idx >= ranked.length) return computePlayerSGP(ranked[ranked.length - 1], numTeams);
  return computePlayerSGP(ranked[idx], numTeams);
}

/**
 * Pick the position (from those the player is eligible for AND that the league has slots for)
 * where this player has the highest SAR against the *full* eligibility pool. This is the
 * preferred-assignment heuristic used to partition multi-position players into a single pool.
 */
function preferredAssignment(
  player: PlayerLean,
  fullPool: PlayerLean[],
  league: LeagueConfig
): { bestPosition?: string; sgp: number } {
  const slots = rosterSlots(league);
  const { numTeams } = league;
  const sgp = computePlayerSGP(player, numTeams);
  let best = -Infinity;
  let bestPosition: string | undefined;
  for (const pos of player.positions) {
    const slotCount = slots[pos];
    if (slotCount === undefined) continue;
    const eligible = fullPool.filter((p) => eligibleAt(p, pos));
    const rep = replacementSGPFromPool(eligible, numTeams, slotCount);
    const sar = sgp - rep;
    if (sar > best) {
      best = sar;
      bestPosition = pos;
    }
  }
  return { bestPosition, sgp };
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
  const slots = rosterSlots(league);
  const { numTeams } = league;

  // ---- Pass 1: assign each eligible player to a single preferred position. ----
  // Multi-position players were previously double-counted in every replacement
  // pool they qualified for, depressing replacement SGP and inflating $ values.
  // Greedy single-assignment partitions the pool so each player contributes to
  // exactly one position's replacement tier.
  const eligiblePlayers = undrafted.filter((p) => p.isEligible !== false);
  const assignments = new Map<
    string,
    { p: PlayerLean; sgp: number; bestPosition?: string }
  >();
  const partitionedPool: Record<string, PlayerLean[]> = {};

  for (const p of eligiblePlayers) {
    const { bestPosition, sgp } = preferredAssignment(p, eligiblePlayers, league);
    assignments.set(String(p._id), { p, sgp, bestPosition });
    if (bestPosition) {
      (partitionedPool[bestPosition] ??= []).push(p);
    }
  }

  // ---- Pass 2: replacement SGP per position from the partitioned pool. ----
  const replacementByPos = new Map<string, number>();
  for (const [pos, slotCount] of Object.entries(slots)) {
    const pool = partitionedPool[pos] ?? [];
    replacementByPos.set(pos, replacementSGPFromPool(pool, numTeams, slotCount));
  }

  // ---- Pass 3: SAR + dollar split. ----
  const sgpList: {
    id: string;
    above: number;
    bestPosition?: string;
    p: PlayerLean;
  }[] = [];
  let sumAbove = 0;

  for (const [id, { p, sgp, bestPosition }] of assignments) {
    const rep = bestPosition ? (replacementByPos.get(bestPosition) ?? 0) : 0;
    const above = Math.max(0, sgp - rep);
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
