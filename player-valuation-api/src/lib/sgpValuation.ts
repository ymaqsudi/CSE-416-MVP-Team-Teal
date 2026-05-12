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
  rosterStatus?: string;
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
 * Weight given to Baseball Savant xStats when blending against the projection's rate stat.
 * Projections already incorporate Statcast signal upstream, but they're often slow to react
 * to in-season process changes. A 30% pull toward xba/xera regresses noisy outcomes toward
 * underlying contact quality without overriding the projection.
 */
const STATCAST_BLEND = 0.3;

function blendRate(projection: number | undefined, xStat: number | undefined, fallback: number): number {
  const base = projection ?? fallback;
  if (xStat == null || !Number.isFinite(xStat)) return base;
  return (1 - STATCAST_BLEND) * base + STATCAST_BLEND * xStat;
}

/**
 * Expected-value haircut for risk. Replaces the old binary `risk === "High"` flag with a
 * continuous multiplier in [0.4, 1.0] combining injury status, risk tier, and age decline.
 * Returns 1.0 when no risk signals are present so the math is unchanged for the common case.
 */
export function riskMultiplier(p: PlayerLean): number {
  let mult = 1;

  // Injury status — most severe first.
  const status = p.injuryStatus?.toLowerCase() ?? "";
  if (status.includes("60") || status.includes("out for season") || status.includes("season-ending")) {
    mult *= 0.4;
  } else if (status.includes("15-day") || status.includes("10-day") || status.includes("il")) {
    mult *= 0.85;
  } else if (status.includes("dtd") || status.includes("day-to-day")) {
    mult *= 0.95;
  }

  // Risk tier from the data source.
  if (p.risk === "High") mult *= 0.9;
  else if (p.risk === "Med") mult *= 0.97;

  // Age decline: hitters fade after ~32, pitchers a year earlier; cap haircut at 30%.
  if (p.age != null && Number.isFinite(p.age)) {
    const declineStart = isPitcher(p) ? 31 : 32;
    if (p.age > declineStart) {
      mult *= Math.max(0.7, 1 - (p.age - declineStart) * 0.02);
    }
  }

  return mult;
}

function hitterSGP(p: PlayerLean, denom: Denominators): number {
  const avail = hitterAvailability(p);
  const hr = (p.projHR ?? 0) * avail;
  const rbi = (p.projRBI ?? 0) * avail;
  const r = (p.projR ?? 0) * avail;
  const sb = (p.projSB ?? 0) * avail;
  const avg = blendRate(p.projAVG, p.xba, LEAGUE_AVG_BA);
  const sgpHR = hr / denom.HR;
  const sgpRBI = rbi / denom.RBI;
  const sgpR = r / denom.R;
  const sgpSB = sb / denom.SB;
  const sgpAVG = (avg - LEAGUE_AVG_BA) / denom.AVG;
  return Math.max(0, sgpHR + sgpRBI + sgpR + sgpSB + sgpAVG);
}

function pitcherSGP(p: PlayerLean, denom: Denominators): number {
  const avail = pitcherAvailability(p);
  const w = (p.projW ?? 0) * avail;
  const k = (p.projK ?? 0) * avail;
  const sv = (p.projSV ?? 0) * avail;
  const era = blendRate(p.projERA, p.xera, LEAGUE_AVG_ERA);
  const whip = p.projWHIP ?? LEAGUE_AVG_WHIP;
  const sgpW = w / denom.W;
  const sgpK = k / denom.K;
  const sgpSV = sv / denom.SV;
  const sgpERA = (LEAGUE_AVG_ERA - era) / denom.ERA;
  const sgpWHIP = (LEAGUE_AVG_WHIP - whip) / denom.WHIP;
  return Math.max(0, sgpW + sgpK + sgpSV + sgpERA + sgpWHIP);
}

function hasHitterStats(p: PlayerLean): boolean {
  return p.projHR != null || p.projRBI != null || p.projAVG != null;
}

function hasPitcherStats(p: PlayerLean): boolean {
  return p.projW != null || p.projK != null || p.projIP != null;
}

/**
 * Total SGP. Two-way players (e.g. Ohtani — positions: ["P","DH"] with both stat sets)
 * have their hitter and pitcher SGP summed; pure pitchers/hitters get one branch only.
 * Depth/role is intentionally NOT applied — projections already reflect role.
 */
export function computePlayerSGP(p: PlayerLean, numTeams = 12): number {
  const denom = getDenominators(numTeams);
  let total = 0;
  if (isPitcher(p) && hasPitcherStats(p)) total += pitcherSGP(p, denom);
  if (p.positions.some((x) => x !== "P") && hasHitterStats(p)) total += hitterSGP(p, denom);
  // Fallback: positions array is pitcher-only but no pitcher stats present → treat as hitter
  // if hitter stats exist, else 0. Keeps legacy single-position synthetic fixtures working.
  if (total === 0) {
    if (hasHitterStats(p)) total = hitterSGP(p, denom);
    else if (hasPitcherStats(p)) total = pitcherSGP(p, denom);
  }
  return total * riskMultiplier(p);
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

/**
 * Slot-eligibility rules for compound/flex slots. Player.positions stays as literal
 * positions; flex slots are derived. CI = 1B|3B, MI = 2B|SS, UTIL = any non-pitcher position.
 */
const FLEX_SLOT_RULES: Record<string, (p: PlayerLean) => boolean> = {
  CI: (p) => p.positions.includes("1B") || p.positions.includes("3B"),
  MI: (p) => p.positions.includes("2B") || p.positions.includes("SS"),
  UTIL: (p) => p.positions.some((x) => x !== "P"),
};

function eligibleAt(p: PlayerLean, slot: string): boolean {
  const rule = FLEX_SLOT_RULES[slot];
  if (rule) return rule(p);
  return p.positions.includes(slot);
}

/**
 * Replacement SGP at one position: SGP of the (N_teams * slots + 1)th best among `pool`, descending.
 * `pool` should already be filtered to players eligible at `pos` (caller's responsibility).
 * `sgpByPlayer` must contain an entry for every player in `poolAtPos`.
 */
function replacementSGPFromPool(
  poolAtPos: PlayerLean[],
  sgpByPlayer: Map<string, number>,
  numTeams: number,
  slotsAtPos: number,
): number {
  if (poolAtPos.length === 0) return 0;
  const sgpOf = (p: PlayerLean) => sgpByPlayer.get(String(p._id)) ?? 0;
  const ranked = [...poolAtPos].sort((a, b) => sgpOf(b) - sgpOf(a));
  const idx = numTeams * slotsAtPos; // 0-based → (idx) is the replacement-tier player
  if (idx >= ranked.length) return sgpOf(ranked[ranked.length - 1]);
  return sgpOf(ranked[idx]);
}

export type ValuationBreakdown = {
  dollarValue: number;
  explanation: string;
  sgpAboveRep: number;
  bestPosition?: string;
  riskFlag?: string;
  /** EV haircut applied to SGP (1.0 = no risk discount). Diagnostic. */
  riskMultiplier?: number;
  /** Active inflation factor for this valuation (1.0 = on par). Diagnostic. */
  inflationFactor?: number;
};

function riskNote(p: PlayerLean): string | undefined {
  const mult = riskMultiplier(p);
  if (mult < 0.95) {
    if (p.injuryStatus) return `Injury status: ${p.injuryStatus}.`;
    if (p.risk === "High") return "Elevated injury/performance risk.";
    if (p.age != null && p.age > (isPitcher(p) ? 31 : 32)) {
      return `Age decline (${p.age}) factored in.`;
    }
    return "Risk haircut applied.";
  }
  if (availability(p) < 0.8) return "Availability below 80% of full workload.";
  return undefined;
}

type ParEntry = {
  p: PlayerLean;
  sgp: number;
  above: number;
  bestPosition?: string;
  par: number;
};

/**
 * Compute par values (proportional to SGP-above-replacement) for a pool against a fixed
 * dollar budget. Pure function of the pool and budget — no inflation, no rounding to $.
 *
 * Used both for live valuation (pool = undrafted, budget = remaining) and as the base
 * for static-par + inflation-factor scaling (pool = full eligible, budget = initial).
 */
function computeParValues(
  pool: PlayerLean[],
  league: LeagueConfig,
  budget: number,
): Map<string, ParEntry> {
  const slots = rosterSlots(league);
  const slotEntries = Object.entries(slots);
  const { numTeams } = league;
  // Gate the valuation pool to MLB-roster players. Minor-leaguers and 60-day IL
  // players inflate `eligible.length`, which drives the $1/player floor in Pass 4
  // and shrinks the distributable budget that flows to SAR-positive starters.
  // Players with no `rosterStatus` set (tests, legacy fixtures) are included.
  const eligible = pool.filter((p) => {
    if (p.isEligible === false) return false;
    if (p.rosterStatus == null) return true;
    return (
      p.rosterStatus === "ActiveRoster" ||
      p.rosterStatus === "InjuredList" ||
      p.rosterStatus === "Bereavement"
    );
  });

  // Precompute SGP per player once — replaces ~n² calls to computePlayerSGP across the
  // assignment + replacement loops.
  const sgpByPlayer = new Map<string, number>();
  for (const p of eligible) {
    sgpByPlayer.set(String(p._id), computePlayerSGP(p, numTeams));
  }

  // Precompute the pre-assignment replacement level for each slot, once. Each slot's pool
  // is the full eligible set filtered by slot eligibility — the same view the old per-player
  // preferredAssignment recomputed for every player.
  const preReplacementBySlot = new Map<string, number>();
  for (const [slot, slotCount] of slotEntries) {
    const poolAtSlot = eligible.filter((p) => eligibleAt(p, slot));
    preReplacementBySlot.set(
      slot,
      replacementSGPFromPool(poolAtSlot, sgpByPlayer, numTeams, slotCount),
    );
  }

  // Pass 1: greedy single-position assignment. Per-player work is now O(slots), not O(n·log n).
  const assignments = new Map<string, { p: PlayerLean; sgp: number; bestPosition?: string }>();
  const partitioned: Record<string, PlayerLean[]> = {};
  for (const p of eligible) {
    const sgp = sgpByPlayer.get(String(p._id)) ?? 0;
    let bestSar = -Infinity;
    let bestPosition: string | undefined;
    for (const [slot] of slotEntries) {
      if (!eligibleAt(p, slot)) continue;
      const rep = preReplacementBySlot.get(slot) ?? 0;
      const sar = sgp - rep;
      if (sar > bestSar) {
        bestSar = sar;
        bestPosition = slot;
      }
    }
    assignments.set(String(p._id), { p, sgp, bestPosition });
    if (bestPosition) (partitioned[bestPosition] ??= []).push(p);
  }

  // Pass 2: replacement per position from the partitioned (post-assignment) pool.
  const replacementByPos = new Map<string, number>();
  for (const [pos, slotCount] of slotEntries) {
    replacementByPos.set(
      pos,
      replacementSGPFromPool(partitioned[pos] ?? [], sgpByPlayer, numTeams, slotCount),
    );
  }

  // Pass 3: SAR.
  const result = new Map<string, ParEntry>();
  let sumAbove = 0;
  for (const [id, { p, sgp, bestPosition }] of assignments) {
    const rep = bestPosition ? (replacementByPos.get(bestPosition) ?? 0) : 0;
    const above = Math.max(0, sgp - rep);
    sumAbove += above;
    result.set(id, { p, sgp, above, bestPosition, par: 0 });
  }

  // Pass 4: par dollars. Industry-standard auction model — only the players who
  // actually get drafted (above replacement) reserve a $1 floor. Sub-replacement
  // players go undrafted and receive $0. `budget` was pre-netted of the auctioned
  // floor in totalAuctionBudget, so the floor here matches that pre-netting.
  const totalSlots = slotEntries.reduce((sum, [, c]) => sum + c, 0);
  const auctionedCount = numTeams * totalSlots;
  const distributable = Math.max(0, budget - auctionedCount);
  for (const entry of result.values()) {
    if (entry.above > 0) {
      const share = sumAbove > 0 ? (entry.above / sumAbove) * distributable : 0;
      entry.par = 1 + share;
    } else {
      entry.par = 0;
    }
  }

  return result;
}

/**
 * Convert par valuations to dollar values for the undrafted pool.
 *
 * If `options.fullPool` is provided AND larger than `undrafted` (i.e. some picks have
 * happened), par is computed *once* against the FULL eligible pool and the INITIAL budget
 * (see Phase 3.3 of the valuation rewrite). The undrafted players' static par values are
 * then scaled by an inflation factor `remainingDollars / Σ(par_undrafted)` — the standard
 * rotisserie auction adjustment for hot/cold price runs.
 *
 * If `fullPool` is omitted (or equals undrafted), par is computed dynamically against the
 * undrafted pool with the remaining-dollar budget — equivalent to the pre-Phase-3 behavior.
 */
export function valuePool(
  undrafted: PlayerLean[],
  league: LeagueConfig,
  remainingDollars: number,
  options?: { fullPool?: PlayerLean[] },
): Map<string, ValuationBreakdown> {
  const byId = new Map<string, ValuationBreakdown>();
  const fullPool = options?.fullPool;
  const useStaticPar = fullPool != null && fullPool.length > undrafted.length;

  let parMap: Map<string, ParEntry>;
  let inflation: number;

  if (useStaticPar) {
    parMap = computeParValues(fullPool, league, totalAuctionBudget(league));
    let parUndraftedSum = 0;
    for (const p of undrafted) {
      const entry = parMap.get(String(p._id));
      if (entry) parUndraftedSum += entry.par;
    }
    inflation = parUndraftedSum > 0 ? remainingDollars / parUndraftedSum : 1;
  } else {
    parMap = computeParValues(undrafted, league, remainingDollars);
    inflation = 1;
  }

  for (const p of undrafted) {
    if (p.isEligible === false) continue;
    const id = String(p._id);
    const entry = parMap.get(id);
    if (!entry) continue;

    const dollarValue = Math.max(1, Math.round(entry.par * inflation));

    const parts: string[] = [];
    if (entry.above > 0) parts.push("SGP above replacement");
    else parts.push("At or below replacement");
    if (entry.p.depthRole === "Starter") parts.push("starting role");
    const note = riskNote(entry.p);
    if (note) parts.push(note);
    if (useStaticPar && Math.abs(inflation - 1) > 0.05) {
      parts.push(`Inflation ${(inflation * 100).toFixed(0)}%`);
    }

    const mult = riskMultiplier(entry.p);
    byId.set(id, {
      dollarValue,
      explanation: parts.join("; ") + ".",
      sgpAboveRep: Math.round(entry.above * 100) / 100,
      bestPosition: entry.bestPosition,
      riskFlag: note,
      riskMultiplier: mult < 1 ? Math.round(mult * 1000) / 1000 : undefined,
      inflationFactor: useStaticPar ? Math.round(inflation * 1000) / 1000 : undefined,
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
