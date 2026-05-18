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
 * Counting-stat denominators scale linearly with league size — wider category
 * distributions in deeper leagues mean a larger gap per standings point. Rate-stat
 * denominators scale inversely by sqrt(12/numTeams) — deeper leagues average over
 * more PA/IP per team, which compresses the spread between adjacent standings ranks.
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
  // K and SV were nudged halfway toward the empirical adjacent-team spread surfaced by
  // scripts/auditDenominators.ts (K ~41, SV ~9 across 200 random partitions). The full
  // empirical values likely overshoot a real auction's spread; halving the move is a
  // conservative correction to stop overvaluing strikeout pitchers and closers.
  K: 30,
  SV: 6,
};

function getDenominators(numTeams: number): Denominators {
  const factor = numTeams / 12;
  // Rate-stat spread shrinks in deeper leagues — more PA/IP per team averages out variance.
  // Scale inversely by sqrt(12/numTeams) since standings spread tracks std-dev, not mean.
  // Stays at 1.0 for 12 teams; ~0.89× for 15, ~1.10× for 10 — mild but non-zero correction.
  const rateFactor = Math.sqrt(12 / numTeams);
  return {
    HR: BASE_DENOM_12T.HR * factor,
    RBI: BASE_DENOM_12T.RBI * factor,
    R: BASE_DENOM_12T.R * factor,
    SB: BASE_DENOM_12T.SB * factor,
    AVG: BASE_DENOM_12T.AVG * rateFactor,
    W: BASE_DENOM_12T.W * factor,
    ERA: BASE_DENOM_12T.ERA * rateFactor,
    WHIP: BASE_DENOM_12T.WHIP * rateFactor,
    K: BASE_DENOM_12T.K * factor,
    SV: BASE_DENOM_12T.SV * factor,
  };
}

/**
 * Default rate-stat baselines used when no pool is available (standalone
 * `computePlayerSGP` calls). Within `valuePool` these are replaced with
 * playing-time-weighted means computed from the actual draftable pool, which
 * makes the math scope-aware for AL/NL-only leagues.
 */
const LEAGUE_AVG_BA = 0.250;
const LEAGUE_AVG_ERA = 4.2;
const LEAGUE_AVG_WHIP = 1.28;

export type LeagueRateBaselines = {
  ba: number;
  era: number;
  whip: number;
};

const DEFAULT_BASELINES: LeagueRateBaselines = {
  ba: LEAGUE_AVG_BA,
  era: LEAGUE_AVG_ERA,
  whip: LEAGUE_AVG_WHIP,
};

/**
 * Shared eligibility gate for the valuation pool. Excludes minor-leaguers and
 * 60-day IL players whose presence would bias both the replacement tier and
 * the rate-stat baselines. Players with no `rosterStatus` (tests, legacy
 * fixtures) are included.
 */
function isPoolEligible(p: PlayerLean): boolean {
  if (p.isEligible === false) return false;
  if (p.rosterStatus == null) return true;
  return (
    p.rosterStatus === "ActiveRoster" ||
    p.rosterStatus === "InjuredList" ||
    p.rosterStatus === "Bereavement"
  );
}

/**
 * Playing-time-weighted league averages over the draftable pool.
 * BA is weighted by projected games, ERA/WHIP by projected innings — matching
 * the way these rate stats are mathematically defined.
 * Falls back to the module-level constants when a weight sum is zero so empty
 * or projection-sparse test pools continue to behave as before.
 */
export function computeLeagueBaselines(pool: PlayerLean[]): LeagueRateBaselines {
  let baNum = 0, baDen = 0;
  let eraNum = 0, eraDen = 0;
  let whipNum = 0, whipDen = 0;
  for (const p of pool) {
    if (!isPoolEligible(p)) continue;
    if (isPitcher(p)) {
      const ip = p.projIP;
      if (ip != null && ip > 0) {
        if (p.projERA != null && Number.isFinite(p.projERA)) {
          eraNum += p.projERA * ip;
          eraDen += ip;
        }
        if (p.projWHIP != null && Number.isFinite(p.projWHIP)) {
          whipNum += p.projWHIP * ip;
          whipDen += ip;
        }
      }
    } else {
      const g = p.projGames;
      if (g != null && g > 0 && p.projAVG != null && Number.isFinite(p.projAVG)) {
        baNum += p.projAVG * g;
        baDen += g;
      }
    }
  }
  return {
    ba: baDen > 0 ? baNum / baDen : LEAGUE_AVG_BA,
    era: eraDen > 0 ? eraNum / eraDen : LEAGUE_AVG_ERA,
    whip: whipDen > 0 ? whipNum / whipDen : LEAGUE_AVG_WHIP,
  };
}

export type LeagueConfig = {
  numTeams: number;
  budget: number;
  scoring?: string;
  rosterSlotsPerTeam?: Record<string, number>;
  mlbLeague?: "AL" | "NL";
  /** Active categories; undefined or empty means all 10 5x5 cats. */
  categories?: string[];
  /**
   * Fraction of the distributable auction budget reserved for hitters.
   * Pitchers receive `1 - hitterBudgetShare`. Defaults to 0.65 — the low end
   * of the 65-70% industry convention, chosen to match NFBC AAV which tends
   * to allocate more dollars to pitching than the midpoint.
   */
  hitterBudgetShare?: number;
  /**
   * Fraction of a player's *second-best slot SAR* added to their effective SAR
   * to reward positional flexibility. Defaults to 0.15. Two-way players (Ohtani)
   * naturally qualify via their off-role slot.
   */
  flexPremium?: number;
  /**
   * Weight applied to the player's recent-history stats when blending into SGP.
   * The "prior" side is a per-season-equivalent combine of the last 3 seasons (see
   * fetchProjections.ts → combineHitterSeasons/combinePitcherSeasons). Defaults to
   * 0.15 (85% projection / 15% prior). Each side (hitter/pitcher) is blended
   * independently and the prior side is skipped if its sample is too thin.
   */
  priorYearWeight?: number;
};

export const DEFAULT_HITTER_BUDGET_SHARE = 0.65;
export const DEFAULT_FLEX_PREMIUM = 0.15;
export const DEFAULT_PRIOR_YEAR_WEIGHT = 0.15;
/**
 * Weight applied to Savant xBA / xERA when regressing the projection's rate stats.
 * Steamer already partially incorporates Statcast, so we keep the pull modest (20%)
 * to nudge the projection toward batted-ball reality without double-counting.
 */
export const SAVANT_REGRESSION_WEIGHT = 0.20;

/** Sample-size gates for blending prior-year SGP. Below these, prev side is ignored. */
const PRIOR_HITTER_GAMES_THRESHOLD = 50;
const PRIOR_PITCHER_IP_THRESHOLD = 30;

/**
 * Real fielding positions that qualify a player's "second best slot" for the
 * flex premium. Compound/flex slots (CI, MI, UTIL) are excluded because they
 * are derived from real positions — counting them would give single-position
 * players phantom bonuses (e.g. a 1B-only player picking up CI + UTIL credit).
 */
const FLEX_PREMIUM_SLOTS = new Set(["C", "1B", "2B", "3B", "SS", "OF", "P"]);

export const SUPPORTED_HITTER_CATS = ["HR", "RBI", "R", "SB", "AVG"] as const;
export const SUPPORTED_PITCHER_CATS = ["W", "ERA", "WHIP", "K", "SV"] as const;
export const SUPPORTED_CATEGORIES = [
  ...SUPPORTED_HITTER_CATS,
  ...SUPPORTED_PITCHER_CATS,
] as const;

export type CategorySet = ReadonlySet<string>;

export function categorySet(categories: string[] | undefined): CategorySet {
  if (!categories || categories.length === 0) {
    return new Set<string>(SUPPORTED_CATEGORIES);
  }
  return new Set(categories.map((c) => c.toUpperCase()));
}

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
  /** Hitter prior — per-season-equivalent combine of the last 3 seasons (2023–2025). */
  prevGames?: number;
  prevHR?: number;
  prevRBI?: number;
  prevR?: number;
  prevSB?: number;
  prevAVG?: number;
  /** Pitcher prior — per-season-equivalent combine of the last 3 seasons (2023–2025). */
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

  // Age-decline used to compound here, but Steamer's projections already model age
  // curves — applying a second haircut on top double-counted the effect, dropping
  // older players' values disproportionately. The age signal lives in the projection
  // (and in the prior-year blend weight, see priorWeightForAge); not here.

  return mult;
}

function hitterSGP(
  p: PlayerLean,
  denom: Denominators,
  cats: CategorySet,
  baselines: LeagueRateBaselines,
): number {
  const avail = hitterAvailability(p);
  let total = 0;
  if (cats.has("HR")) total += ((p.projHR ?? 0) * avail) / denom.HR;
  if (cats.has("RBI")) total += ((p.projRBI ?? 0) * avail) / denom.RBI;
  if (cats.has("R")) total += ((p.projR ?? 0) * avail) / denom.R;
  if (cats.has("SB")) total += ((p.projSB ?? 0) * avail) / denom.SB;
  if (cats.has("AVG")) {
    const avg = p.projAVG ?? baselines.ba;
    total += ((avg - baselines.ba) / denom.AVG) * avail;
  }
  return Math.max(0, total);
}

function pitcherSGP(
  p: PlayerLean,
  denom: Denominators,
  cats: CategorySet,
  baselines: LeagueRateBaselines,
): number {
  const avail = pitcherAvailability(p);
  let total = 0;
  if (cats.has("W")) total += ((p.projW ?? 0) * avail) / denom.W;
  if (cats.has("K")) total += ((p.projK ?? 0) * avail) / denom.K;
  if (cats.has("SV")) total += ((p.projSV ?? 0) * avail) / denom.SV;
  if (cats.has("ERA")) {
    const era = p.projERA ?? baselines.era;
    total += ((baselines.era - era) / denom.ERA) * avail;
  }
  if (cats.has("WHIP")) {
    const whip = p.projWHIP ?? baselines.whip;
    total += ((baselines.whip - whip) / denom.WHIP) * avail;
  }
  return Math.max(0, total);
}

function hasHitterStats(p: PlayerLean): boolean {
  return p.projHR != null || p.projRBI != null || p.projAVG != null;
}

function hasPitcherStats(p: PlayerLean): boolean {
  return p.projW != null || p.projK != null || p.projIP != null;
}

export type PlayerSGPParts = {
  /** Hitter-side SGP contribution (post risk multiplier). 0 for pure pitchers. */
  hitter: number;
  /** Pitcher-side SGP contribution (post risk multiplier). 0 for pure hitters. */
  pitcher: number;
  /** Sum used everywhere SGP was previously a single number. */
  total: number;
};

/**
 * Age-adjusted scale on the prior-year blend weight. Young players are still developing —
 * projections that model growth are more predictive than their two-season history. Veterans
 * have stabilized — their history carries more signal than a projection's age-based fade.
 * Returns the configured base weight scaled by an age factor; unknown age uses the base.
 */
function priorWeightForAge(age: number | null | undefined, baseWeight: number): number {
  if (age == null || !Number.isFinite(age)) return baseWeight;
  let factor: number;
  if (age <= 24) factor = 0.33;          // ~5% effective at the 15% default
  else if (age >= 32) factor = 1.67;     // ~25% effective at the 15% default
  else factor = 1.0;                     // 25–31: unchanged baseline
  return Math.max(0, Math.min(1, baseWeight * factor));
}

/**
 * Pull the projection's rate stats toward Statcast expected values (xBA, xERA).
 * Applied only to the projection-side SGP — the prior-side path runs through
 * `playerAsPrev` and must not inherit a current-batted-ball regression on top of
 * historical stats. No-op when the xStat is missing.
 */
function applySavantRegression(p: PlayerLean): PlayerLean {
  const w = SAVANT_REGRESSION_WEIGHT;
  let out: PlayerLean = p;
  if (p.projAVG != null && p.xba != null && Number.isFinite(p.xba)) {
    out = { ...out, projAVG: (1 - w) * p.projAVG + w * p.xba };
  }
  if (p.projERA != null && p.xera != null && Number.isFinite(p.xera)) {
    out = { ...out, projERA: (1 - w) * p.projERA + w * p.xera };
  }
  return out;
}

/**
 * Synthetic view of a player with last year's stats slotted into the `proj*` fields
 * so the standard hitterSGP/pitcherSGP formulas can be reused without forking.
 * `projGames` ← `prevGames` and `projIP` ← `prevIP` preserve the availability haircut
 * relative to a full season, matching how the formula treats projections.
 */
function playerAsPrev(p: PlayerLean): PlayerLean {
  return {
    ...p,
    projGames: p.prevGames,
    projHR: p.prevHR,
    projRBI: p.prevRBI,
    projR: p.prevR,
    projSB: p.prevSB,
    projAVG: p.prevAVG,
    projW: p.prevW,
    projERA: p.prevERA,
    projWHIP: p.prevWHIP,
    projK: p.prevK,
    projSV: p.prevSV,
    projIP: p.prevIP,
  };
}

function hasPriorHitterSample(p: PlayerLean): boolean {
  return (p.prevGames ?? 0) >= PRIOR_HITTER_GAMES_THRESHOLD;
}

function hasPriorPitcherSample(p: PlayerLean): boolean {
  return (p.prevIP ?? 0) >= PRIOR_PITCHER_IP_THRESHOLD;
}

/**
 * Per-side SGP breakdown. Two-way players (e.g. Ohtani — positions ["P","DH"] with
 * both stat sets) get both branches; pure pitchers/hitters get one. The riskMultiplier
 * is applied uniformly so callers can route players by larger-side contribution.
 *
 * Optional `priorYearWeight` (0..1) blends prior-year SGP into each side independently.
 * Prior side is skipped when its sample falls below the threshold (rookies, partial
 * seasons), so a thin prior year never drags a strong projection down.
 */
export function computePlayerSGPParts(
  p: PlayerLean,
  numTeams = 12,
  categories?: string[],
  baselines: LeagueRateBaselines = DEFAULT_BASELINES,
  priorYearWeight = 0,
): PlayerSGPParts {
  const denom = getDenominators(numTeams);
  const cats = categorySet(categories);
  // Projection-side: pull rate stats toward Statcast xBA / xERA. Prior-side calls below
  // use playerAsPrev(p) and must stay on the un-regressed object.
  const proj = applySavantRegression(p);
  let hitter = 0;
  let pitcher = 0;
  if (isPitcher(p) && hasPitcherStats(p)) pitcher = pitcherSGP(proj, denom, cats, baselines);
  if (p.positions.some((x) => x !== "P") && hasHitterStats(p)) hitter = hitterSGP(proj, denom, cats, baselines);
  // Fallback: positions array is pitcher-only but no pitcher stats present → treat as hitter
  // if hitter stats exist, else 0. Keeps legacy single-position synthetic fixtures working.
  if (hitter === 0 && pitcher === 0) {
    if (hasHitterStats(p)) hitter = hitterSGP(proj, denom, cats, baselines);
    else if (hasPitcherStats(p)) pitcher = pitcherSGP(proj, denom, cats, baselines);
  }
  if (priorYearWeight > 0) {
    const prev = playerAsPrev(p);
    const w = priorWeightForAge(p.age, priorYearWeight);
    if (hasPriorHitterSample(p) && hitter > 0) {
      hitter = (1 - w) * hitter + w * hitterSGP(prev, denom, cats, baselines);
    }
    if (hasPriorPitcherSample(p) && pitcher > 0) {
      pitcher = (1 - w) * pitcher + w * pitcherSGP(prev, denom, cats, baselines);
    }
  }
  const mult = riskMultiplier(p);
  return { hitter: hitter * mult, pitcher: pitcher * mult, total: (hitter + pitcher) * mult };
}

/**
 * Total SGP. Two-way players have hitter+pitcher summed; pure players get one branch.
 * Depth/role is intentionally NOT applied — projections already reflect role.
 */
export function computePlayerSGP(
  p: PlayerLean,
  numTeams = 12,
  categories?: string[],
  baselines: LeagueRateBaselines = DEFAULT_BASELINES,
): number {
  return computePlayerSGPParts(p, numTeams, categories, baselines).total;
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
  /** SAR added for multi-position / two-way flexibility. Diagnostic. */
  flexBonus?: number;
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
  /** SAR bonus applied for multi-position eligibility / two-way flexibility. */
  flexBonus: number;
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
  const eligible = pool.filter(isPoolEligible);

  // Pool-derived rate-stat baselines — scope-aware when `pool` is AL/NL-filtered
  // upstream by filterPoolByLeague.
  const baselines = computeLeagueBaselines(eligible);

  // Precompute SGP per player once — replaces ~n² calls to computePlayerSGP across the
  // assignment + replacement loops. Parts (hitter/pitcher breakdown) are kept so two-way
  // players can be routed by their larger contribution side.
  const priorYearWeight = league.priorYearWeight ?? DEFAULT_PRIOR_YEAR_WEIGHT;
  const sgpPartsByPlayer = new Map<string, PlayerSGPParts>();
  const sgpByPlayer = new Map<string, number>();
  for (const p of eligible) {
    const parts = computePlayerSGPParts(p, numTeams, league.categories, baselines, priorYearWeight);
    sgpPartsByPlayer.set(String(p._id), parts);
    sgpByPlayer.set(String(p._id), parts.total);
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
  // Also tracks the SAR at the player's second-best real-position slot — used in Pass 3
  // to apply a flex premium that rewards multi-position eligibility and two-way players.
  const assignments = new Map<string, {
    p: PlayerLean;
    sgp: number;
    bestPosition?: string;
    secondBestSar: number;
  }>();
  const partitioned: Record<string, PlayerLean[]> = {};
  // Two-way recognition: positions list includes P AND at least one non-P slot.
  // For these players, UTIL is a real "other role" rather than a phantom catch-all,
  // so we let it count toward the flex premium below.
  const isTwoWay = (p: PlayerLean) =>
    p.positions.includes("P") && p.positions.some((x) => x !== "P");
  for (const p of eligible) {
    const parts = sgpPartsByPlayer.get(String(p._id)) ?? { hitter: 0, pitcher: 0, total: 0 };
    const sgp = parts.total;
    const twoWay = isTwoWay(p);
    // For two-way players, force the primary slot to the dominant side. Without this,
    // bestPosition picks the slot with lowest replacement (typically P, since pitcher
    // pools are deeper than UTIL pools) — which routes Ohtani-style hitters to the
    // pitcher budget pot and compresses their dollar value. Hit-dominant two-way
    // players exclude P from candidates; pitch-dominant exclude all non-P.
    const hitterDominant = twoWay && parts.hitter >= parts.pitcher;
    const pitcherDominant = twoWay && parts.pitcher > parts.hitter;
    let bestSar = -Infinity;
    let bestPosition: string | undefined;
    let bestPremiumSar = -Infinity;
    let secondBestPremiumSar = -Infinity;
    for (const [slot] of slotEntries) {
      if (!eligibleAt(p, slot)) continue;
      const rep = preReplacementBySlot.get(slot) ?? 0;
      const sar = sgp - rep;
      const restrictedFromPrimary =
        (hitterDominant && slot === "P") || (pitcherDominant && slot !== "P");
      if (!restrictedFromPrimary && sar > bestSar) {
        bestSar = sar;
        bestPosition = slot;
      }
      // Track best/second-best among slots that count toward the flex premium.
      // Pure hitters use real positions only (UTIL/CI/MI excluded to avoid
      // phantom bonuses). Two-way players also let UTIL count so an Ohtani
      // listed as P/DH still gets credit for his hitter eligibility.
      const counts = FLEX_PREMIUM_SLOTS.has(slot) || (twoWay && slot === "UTIL");
      if (counts) {
        if (sar > bestPremiumSar) {
          secondBestPremiumSar = bestPremiumSar;
          bestPremiumSar = sar;
        } else if (sar > secondBestPremiumSar) {
          secondBestPremiumSar = sar;
        }
      }
    }
    const secondBestSar = Math.max(
      0,
      secondBestPremiumSar === -Infinity ? 0 : secondBestPremiumSar,
    );
    assignments.set(String(p._id), { p, sgp, bestPosition, secondBestSar });
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

  // Pass 3: SAR. Sum SAR separately for hitters and pitchers so the budget split
  // can route each pot independently. Two-way players are routed by their
  // assigned slot — bestPosition === "P" → pitcher pot, else hitter pot — which
  // matches the roster spot they actually consume.
  const result = new Map<string, ParEntry>();
  let sumAboveHitters = 0;
  let sumAbovePitchers = 0;
  const flexPremium = league.flexPremium ?? DEFAULT_FLEX_PREMIUM;
  for (const [id, { p, sgp, bestPosition, secondBestSar }] of assignments) {
    const rep = bestPosition ? (replacementByPos.get(bestPosition) ?? 0) : 0;
    const twoWay = isTwoWay(p);
    let baseSar: number;
    let flexBonus: number;
    if (twoWay) {
      // Two-way players (Ohtani) fill one roster slot but produce both stat lines.
      // Their true SAR is what they contribute beyond replacement at *both* slots —
      // i.e. they also save the cost of drafting a marginal pitcher (or hitter).
      // This replaces the flex bonus, which would otherwise double-count their
      // off-role stats (already included in `sgp`).
      const offRoleRep =
        bestPosition === "P"
          ? (replacementByPos.get("UTIL") ?? 0)
          : (replacementByPos.get("P") ?? 0);
      baseSar = Math.max(0, sgp - rep - offRoleRep);
      flexBonus = 0;
    } else {
      baseSar = Math.max(0, sgp - rep);
      // Flex premium only fires when both the primary and secondary slots are
      // value-positive; it cannot rescue a sub-replacement player.
      flexBonus = baseSar > 0 && secondBestSar > 0 ? flexPremium * secondBestSar : 0;
    }
    const above = baseSar + flexBonus;
    if (bestPosition === "P") sumAbovePitchers += above;
    else sumAboveHitters += above;
    result.set(id, { p, sgp, above, bestPosition, par: 0, flexBonus });
  }

  // Pass 4: par dollars. Industry-standard auction model — only the players who
  // actually get drafted (above replacement) reserve a $1 floor. Sub-replacement
  // players go undrafted and receive $0. `budget` was pre-netted of the auctioned
  // floor in totalAuctionBudget, so the floor here matches that pre-netting.
  const totalSlots = slotEntries.reduce((sum, [, c]) => sum + c, 0);
  const auctionedCount = numTeams * totalSlots;
  const distributable = Math.max(0, budget - auctionedCount);
  const hitterShare = league.hitterBudgetShare ?? DEFAULT_HITTER_BUDGET_SHARE;
  const distributableHitters = distributable * hitterShare;
  const distributablePitchers = distributable * (1 - hitterShare);
  for (const entry of result.values()) {
    if (entry.above > 0) {
      const isP = entry.bestPosition === "P";
      const pot = isP ? distributablePitchers : distributableHitters;
      const sumSide = isP ? sumAbovePitchers : sumAboveHitters;
      const share = sumSide > 0 ? (entry.above / sumSide) * pot : 0;
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
    const twoWay =
      entry.p.positions.includes("P") && entry.p.positions.some((x) => x !== "P");
    if (twoWay) {
      parts.push("two-way player (credit for both stat lines, less off-role replacement)");
    } else if (entry.flexBonus > 0) {
      parts.push("multi-position flex premium");
    }
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
      flexBonus: entry.flexBonus > 0 ? Math.round(entry.flexBonus * 100) / 100 : undefined,
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
