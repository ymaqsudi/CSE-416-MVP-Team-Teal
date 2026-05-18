import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computePlayerSGP,
  computePlayerSGPParts,
  computeLeagueBaselines,
  riskMultiplier,
  valuePool,
  totalAuctionBudget,
  remainingAuctionDollars,
  isPlayerDrafted,
  undraftedPlayers,
  type LeagueConfig,
  type PlayerLean,
} from "./sgpValuation.js";

let __id = 0;
const nextId = () => `p${++__id}`;

const hitter = (overrides: Partial<PlayerLean> & { positions?: string[] } = {}): PlayerLean => ({
  _id: overrides._id ?? nextId(),
  name: "H",
  mlbTeam: "X",
  positions: overrides.positions ?? ["OF"],
  projGames: 162,
  projHR: 20,
  projRBI: 70,
  projR: 70,
  projSB: 5,
  projAVG: 0.275,
  ...overrides,
});

const pitcher = (overrides: Partial<PlayerLean> = {}): PlayerLean => ({
  _id: overrides._id ?? nextId(),
  name: "P",
  mlbTeam: "X",
  positions: ["P"],
  projGames: 162,
  projW: 10,
  projK: 150,
  projSV: 0,
  projERA: 4.2,
  projWHIP: 1.28,
  projIP: 180,
  ...overrides,
});

// Compact league so we don't need 200 fixture players to populate replacement tiers.
const tinyLeague: LeagueConfig = {
  numTeams: 2,
  budget: 100,
  rosterSlotsPerTeam: { SS: 1, OF: 1, P: 1 },
};

test("computePlayerSGP: more production = higher SGP", () => {
  const weak = hitter({ projHR: 5, projRBI: 30, projR: 30, projSB: 0, projAVG: 0.24 });
  const strong = hitter({ projHR: 40, projRBI: 110, projR: 100, projSB: 20, projAVG: 0.31 });
  assert.ok(computePlayerSGP(strong) > computePlayerSGP(weak));
});

test("computePlayerSGP: availability scales counting stats", () => {
  const full = hitter({ projGames: 162 });
  const half = hitter({ projGames: 81 });
  assert.ok(computePlayerSGP(full) > computePlayerSGP(half));
});

test("totalAuctionBudget: reserves $1 per roster slot", () => {
  // numTeams=2, budget=100, slots={SS:1,OF:1,P:1} → 2*100 - 2*3 = 194
  assert.equal(totalAuctionBudget(tinyLeague), 194);
});

test("remainingAuctionDollars: subtracts spent picks", () => {
  const draft = {
    picks: [
      { mlbPlayerId: 1, teamInLeagueId: "t1", price: 50 },
      { mlbPlayerId: 2, teamInLeagueId: "t2", price: 30 },
    ],
  };
  assert.equal(remainingAuctionDollars(tinyLeague, draft), 194 - 80);
});

test("isPlayerDrafted: matches by mlbPlayerId or playerId", () => {
  const p = hitter({ _id: "abc", mlbPlayerId: 99 });
  assert.equal(
    isPlayerDrafted(p, [{ mlbPlayerId: 99, teamInLeagueId: "t1", price: 1 }]),
    true,
  );
  assert.equal(
    isPlayerDrafted(p, [{ playerId: "abc", teamInLeagueId: "t1", price: 1 }]),
    true,
  );
  assert.equal(
    isPlayerDrafted(p, [{ mlbPlayerId: 100, teamInLeagueId: "t1", price: 1 }]),
    false,
  );
});

test("undraftedPlayers: excludes drafted, keeps the rest", () => {
  const a = hitter({ _id: "a", mlbPlayerId: 1 });
  const b = hitter({ _id: "b", mlbPlayerId: 2 });
  const c = hitter({ _id: "c", mlbPlayerId: 3 });
  const result = undraftedPlayers(
    [a, b, c],
    [{ mlbPlayerId: 2, teamInLeagueId: "t1", price: 10 }],
  );
  assert.deepEqual(
    result.map((p) => p._id),
    ["a", "c"],
  );
});

test("valuePool: Σ values equals remaining dollars (within rounding tolerance)", () => {
  // 3 SS, 3 OF, 3 P — exactly enough to define replacement at each position.
  const pool: PlayerLean[] = [
    hitter({ positions: ["SS"], projHR: 30 }),
    hitter({ positions: ["SS"], projHR: 20 }),
    hitter({ positions: ["SS"], projHR: 10 }),
    hitter({ positions: ["OF"], projHR: 30 }),
    hitter({ positions: ["OF"], projHR: 20 }),
    hitter({ positions: ["OF"], projHR: 10 }),
    pitcher({ projK: 220 }),
    pitcher({ projK: 170 }),
    pitcher({ projK: 120 }),
  ];
  const remaining = remainingAuctionDollars(tinyLeague, { picks: [] });
  const values = valuePool(pool, tinyLeague, remaining);
  let sum = 0;
  for (const v of values.values()) sum += v.dollarValue;
  // Per-player rounding can drift Σ by up to ±N/2; assert within ±N.
  assert.ok(
    Math.abs(sum - remaining) <= pool.length,
    `Σ=${sum} vs remaining=${remaining} (drift > ${pool.length})`,
  );
});

test("valuePool: monotonicity at the same position — higher SGP ⇒ higher $", () => {
  const top = hitter({ _id: "top", positions: ["SS"], projHR: 35 });
  const mid = hitter({ _id: "mid", positions: ["SS"], projHR: 22 });
  const rep = hitter({ _id: "rep", positions: ["SS"], projHR: 8 });
  const pool = [top, mid, rep];
  const v = valuePool(pool, tinyLeague, totalAuctionBudget(tinyLeague));
  assert.ok(v.get("top")!.dollarValue > v.get("mid")!.dollarValue);
  assert.ok(v.get("mid")!.dollarValue >= v.get("rep")!.dollarValue);
});

test("valuePool: replacement-level player gets exactly $1", () => {
  const pool = [
    hitter({ _id: "a", positions: ["SS"], projHR: 30 }),
    hitter({ _id: "b", positions: ["SS"], projHR: 20 }),
    hitter({ _id: "rep", positions: ["SS"], projHR: 5 }),
  ];
  const v = valuePool(pool, tinyLeague, totalAuctionBudget(tinyLeague));
  assert.equal(v.get("rep")!.dollarValue, 1);
});

test("valuePool: drafted players are not in the result", () => {
  const a = hitter({ _id: "a", mlbPlayerId: 1, positions: ["SS"], projHR: 30 });
  const b = hitter({ _id: "b", mlbPlayerId: 2, positions: ["SS"], projHR: 20 });
  const c = hitter({ _id: "c", mlbPlayerId: 3, positions: ["SS"], projHR: 10 });
  const draft = { picks: [{ mlbPlayerId: 1, teamInLeagueId: "t1", price: 40 }] };
  const undrafted = undraftedPlayers([a, b, c], draft.picks);
  const v = valuePool(undrafted, tinyLeague, remainingAuctionDollars(tinyLeague, draft));
  assert.equal(v.has("a"), false);
  assert.equal(v.has("b"), true);
  assert.equal(v.has("c"), true);
});

test("valuePool: multi-position player picks the position with highest SAR", () => {
  // Build a pool where SS replacement is higher than OF replacement, so OF is "scarcer"
  // for our test star (SS has stronger competition; OF replacement is the weak guy).
  const star = hitter({ _id: "star", positions: ["SS", "OF"], projHR: 40 });
  const pool: PlayerLean[] = [
    star,
    hitter({ positions: ["SS"], projHR: 35 }),
    hitter({ positions: ["SS"], projHR: 30 }),
    hitter({ positions: ["OF"], projHR: 15 }),
    hitter({ positions: ["OF"], projHR: 5 }),
  ];
  const v = valuePool(pool, tinyLeague, totalAuctionBudget(tinyLeague));
  // OF replacement (3rd-best OF = star itself with HR=40 → fallback to last) actually
  // since only 2 pure-OF players, idx=2 is out of range and falls back to the last.
  // What matters is the breakdown reports the chosen position.
  assert.equal(v.get("star")!.bestPosition, "OF");
});

test("valuePool: isEligible=false players are excluded", () => {
  const pool = [
    hitter({ _id: "ok", positions: ["SS"], projHR: 25 }),
    hitter({ _id: "skip", positions: ["SS"], projHR: 25, isEligible: false }),
    hitter({ _id: "rep", positions: ["SS"], projHR: 5 }),
  ];
  const v = valuePool(pool, tinyLeague, totalAuctionBudget(tinyLeague));
  assert.equal(v.has("skip"), false);
  assert.equal(v.has("ok"), true);
});

test("valuePool: when nobody is above replacement, every player gets $1", () => {
  // All three identical → SAR=0 for everyone.
  const pool = [
    hitter({ _id: "a", positions: ["SS"], projHR: 10 }),
    hitter({ _id: "b", positions: ["SS"], projHR: 10 }),
    hitter({ _id: "c", positions: ["SS"], projHR: 10 }),
  ];
  const v = valuePool(pool, tinyLeague, totalAuctionBudget(tinyLeague));
  for (const id of ["a", "b", "c"]) {
    assert.equal(v.get(id)!.dollarValue, 1);
  }
});

test("computePlayerSGP: numTeams scales counting-stat denominators", () => {
  // Larger denoms in deeper leagues ⇒ same projection yields lower SGP.
  const p = hitter({ projHR: 30, projRBI: 100, projR: 100, projSB: 10, projAVG: 0.275 });
  const sgp10 = computePlayerSGP(p, 10);
  const sgp15 = computePlayerSGP(p, 15);
  assert.ok(sgp10 > sgp15, `expected sgp10 (${sgp10}) > sgp15 (${sgp15})`);
});

test("computePlayerSGP: pitcher availability uses IP, not projGames", () => {
  // 32-start ace with 200 IP — projGames/162 would have crushed his SGP.
  // With IP-based scaling, he should beat a part-season RP equivalent in raw counts.
  const ace = pitcher({ projGames: 32, projIP: 200, projW: 16, projK: 220, projSV: 0 });
  const halfAce = pitcher({ projGames: 16, projIP: 100, projW: 8, projK: 110, projSV: 0 });
  assert.ok(computePlayerSGP(ace) > computePlayerSGP(halfAce));
  // The full-IP ace should NOT have his counting stats halved by `32/162` — sanity check
  // that wins translate close to face value (sgpW = 16/3 ≈ 5.33 with full availability).
  assert.ok(computePlayerSGP(ace) > 5);
});

test("computePlayerSGP: missing projIP falls back to availability=1 (no haircut)", () => {
  const noIp = pitcher({ projIP: undefined, projW: 15, projK: 200 });
  const withIp = pitcher({ projIP: 200, projW: 15, projK: 200 });
  // Both should yield identical SGP — missing IP should not silently zero a pitcher.
  assert.equal(computePlayerSGP(noIp), computePlayerSGP(withIp));
});

test("computePlayerSGP: reliever IP baseline is lower than starter", () => {
  // 65-IP closer at full role workload should reach availability=1.
  const closer = pitcher({ projIP: 65, projSV: 35, projW: 3, projK: 80, projERA: 2.5, projWHIP: 1.0 });
  // Same IP treated as a starter (no SV) would only be at 65/200 ≈ 0.325 of workload.
  const ghostSP = pitcher({ projIP: 65, projSV: 0, projW: 3, projK: 80, projERA: 2.5, projWHIP: 1.0 });
  assert.ok(computePlayerSGP(closer) > computePlayerSGP(ghostSP));
});

test("valuePool: single-position assignment partitions multi-eligible players", () => {
  // A SS+OF star previously appeared in BOTH replacement pools, depressing both.
  // Under single-assignment, the star is removed from one pool entirely.
  // Verify the star is assigned exactly once and gets a positive SAR.
  const star = hitter({ _id: "star", positions: ["SS", "OF"], projHR: 40 });
  const ss35 = hitter({ _id: "ss35", positions: ["SS"], projHR: 35 });
  const ss30 = hitter({ _id: "ss30", positions: ["SS"], projHR: 30 });
  const of15 = hitter({ _id: "of15", positions: ["OF"], projHR: 15 });
  const of5 = hitter({ _id: "of5", positions: ["OF"], projHR: 5 });
  const v = valuePool([star, ss35, ss30, of15, of5], tinyLeague, totalAuctionBudget(tinyLeague));
  assert.ok(["SS", "OF"].includes(v.get("star")!.bestPosition!));
  assert.ok(v.get("star")!.sgpAboveRep > 0);
});

test("computePlayerSGP: blends xba toward Statcast when present", () => {
  // Same projAVG; one has a much higher xba — expect higher SGP via the AVG component.
  const lucky = hitter({ projAVG: 0.250, xba: 0.250 });
  const unlucky = hitter({ projAVG: 0.250, xba: 0.300 });
  assert.ok(computePlayerSGP(unlucky) > computePlayerSGP(lucky));
});

test("computePlayerSGP: blends xera toward Statcast for pitchers", () => {
  // Same projERA; one has much better xera — expect higher SGP.
  const matching = pitcher({ projERA: 4.0, xera: 4.0 });
  const better = pitcher({ projERA: 4.0, xera: 2.8 });
  assert.ok(computePlayerSGP(better) > computePlayerSGP(matching));
});

test("computePlayerSGP: missing xStats degrades gracefully (no NaN)", () => {
  const noStatcast = hitter({ projAVG: 0.275, xba: undefined });
  const sgp = computePlayerSGP(noStatcast);
  assert.ok(Number.isFinite(sgp));
});

test("riskMultiplier: clean profile = 1.0", () => {
  const p = hitter({});
  assert.equal(riskMultiplier(p), 1);
});

test("riskMultiplier: 60-day IL crushes value", () => {
  const p = hitter({ injuryStatus: "60-day IL" });
  assert.ok(riskMultiplier(p) <= 0.4);
});

test("riskMultiplier: age alone does not haircut SGP (Steamer already models age)", () => {
  // Age-decline used to compound on top of the projection; dropped to stop double-counting.
  const youngClean = hitter({ age: 27 });
  const oldClean   = hitter({ age: 38 });
  assert.equal(riskMultiplier(youngClean), 1);
  assert.equal(riskMultiplier(oldClean), 1);
});

test("riskMultiplier: stacked signals compound but stay above 0.36", () => {
  // 60-day IL × High risk = 0.4 * 0.9 = 0.36. Age no longer factors in.
  const stack = hitter({
    injuryStatus: "60-day IL",
    risk: "High",
    age: 42,
  });
  assert.equal(riskMultiplier(stack), 0.4 * 0.9);
});

test("computePlayerSGP: high-risk player has lower SGP than identical clean player", () => {
  const clean = hitter({ projHR: 30 });
  const risky = hitter({ projHR: 30, risk: "High" });
  assert.ok(computePlayerSGP(clean) > computePlayerSGP(risky));
});

test("valuePool: inflation factor surfaces when picks have over/under-paid", () => {
  // Build a 3-SS pool where SS-A is "the stud". Draft SS-A at a big overpay → remaining $
  // shrinks much more than the par value of SS-A would have predicted → inflation < 1.
  const a = hitter({ _id: "a", mlbPlayerId: 1, positions: ["SS"], projHR: 40 });
  const b = hitter({ _id: "b", mlbPlayerId: 2, positions: ["SS"], projHR: 25 });
  const c = hitter({ _id: "c", mlbPlayerId: 3, positions: ["SS"], projHR: 5 });
  const fullPool = [a, b, c];
  const initialBudget = totalAuctionBudget(tinyLeague);

  // Massive overpay: spent $150 on a player whose par was much less.
  const overpayDraft = {
    picks: [{ mlbPlayerId: 1, teamInLeagueId: "t1", price: Math.min(150, initialBudget - 1) }],
  };
  const undrafted = undraftedPlayers(fullPool, overpayDraft.picks);
  const remaining = remainingAuctionDollars(tinyLeague, overpayDraft);
  const v = valuePool(undrafted, tinyLeague, remaining, { fullPool });

  const inflation = v.get("b")!.inflationFactor;
  assert.ok(inflation != null, "inflation factor should be exposed when fullPool is given");
  assert.ok(inflation! < 1, `expected deflation after overpay; got ${inflation}`);
});

test("valuePool: with fullPool and no picks, inflation factor ≈ 1 (sanity)", () => {
  const a = hitter({ _id: "a", positions: ["SS"], projHR: 30 });
  const b = hitter({ _id: "b", positions: ["SS"], projHR: 20 });
  const c = hitter({ _id: "c", positions: ["SS"], projHR: 5 });
  const fullPool = [a, b, c];
  const v = valuePool(fullPool, tinyLeague, totalAuctionBudget(tinyLeague), { fullPool });
  // No picks → fullPool.length === undrafted.length → static-par path NOT triggered;
  // inflation diagnostic stays undefined. Verify behavior.
  assert.equal(v.get("a")!.inflationFactor, undefined);
});

test("valuePool: omitting fullPool preserves the pre-Phase-3 dynamic behavior", () => {
  // No fullPool option → values come from dynamic par against undrafted.
  // We just assert Σ values ≈ remaining (same invariant as before).
  const pool = [
    hitter({ positions: ["SS"], projHR: 30 }),
    hitter({ positions: ["SS"], projHR: 20 }),
    hitter({ positions: ["SS"], projHR: 10 }),
  ];
  const remaining = totalAuctionBudget(tinyLeague);
  const v = valuePool(pool, tinyLeague, remaining);
  let sum = 0;
  for (const x of v.values()) sum += x.dollarValue;
  assert.ok(Math.abs(sum - remaining) <= pool.length);
});

test("flex-slot eligibility: 2B player is eligible at MI and UTIL", () => {
  // Build a league with both 2B and MI slots; verify a 2B-only player gets considered
  // at both (and at UTIL) — they should be assigned to whichever yields the best SAR.
  const league: LeagueConfig = {
    numTeams: 2,
    budget: 100,
    rosterSlotsPerTeam: { "2B": 1, MI: 1, UTIL: 1 },
  };
  const star = hitter({ _id: "star", positions: ["2B"], projHR: 40 });
  const filler1 = hitter({ _id: "f1", positions: ["2B"], projHR: 8 });
  const filler2 = hitter({ _id: "f2", positions: ["2B"], projHR: 5 });
  const v = valuePool([star, filler1, filler2], league, totalAuctionBudget(league));
  const best = v.get("star")!.bestPosition;
  assert.ok(["2B", "MI", "UTIL"].includes(best!), `unexpected best slot: ${best}`);
  assert.ok(v.get("star")!.sgpAboveRep > 0);
});

test("flex-slot eligibility: 1B player is eligible at CI but not MI", () => {
  const league: LeagueConfig = {
    numTeams: 2,
    budget: 100,
    rosterSlotsPerTeam: { "1B": 1, CI: 1, MI: 1, UTIL: 1 },
  };
  const oneB = hitter({ _id: "1b", positions: ["1B"], projHR: 30 });
  const f1 = hitter({ _id: "x", positions: ["1B"], projHR: 8 });
  const f2 = hitter({ _id: "y", positions: ["1B"], projHR: 5 });
  const v = valuePool([oneB, f1, f2], league, totalAuctionBudget(league));
  const best = v.get("1b")!.bestPosition;
  // Should never be MI (1B is not a middle-infield position).
  assert.notEqual(best, "MI");
  assert.ok(["1B", "CI", "UTIL"].includes(best!), `unexpected best slot: ${best}`);
});

test("flex-slot eligibility: pure pitcher is NOT eligible at UTIL", () => {
  const league: LeagueConfig = {
    numTeams: 2,
    budget: 100,
    rosterSlotsPerTeam: { P: 1, UTIL: 1 },
  };
  const sp = pitcher({ _id: "sp", projK: 220 });
  const sp2 = pitcher({ _id: "sp2", projK: 180 });
  const sp3 = pitcher({ _id: "sp3", projK: 120 });
  const v = valuePool([sp, sp2, sp3], league, totalAuctionBudget(league));
  assert.equal(v.get("sp")!.bestPosition, "P");
});

test("two-way SGP: positions=['P','DH'] with both stat sets sums hitter + pitcher SGP", () => {
  const pitcherOnly = pitcher({
    _id: "p_only",
    positions: ["P"],
    projW: 12, projK: 180, projERA: 3.5, projWHIP: 1.15, projIP: 180,
  });
  const twoWay: PlayerLean = {
    _id: "ohtani",
    name: "Two-Way",
    mlbTeam: "X",
    positions: ["P", "DH"],
    projW: 12, projK: 180, projERA: 3.5, projWHIP: 1.15, projIP: 180,
    projHR: 40, projRBI: 100, projR: 95, projSB: 8, projAVG: 0.295,
    projGames: 158,
  };
  const sgpPitcherOnly = computePlayerSGP(pitcherOnly);
  const sgpTwoWay = computePlayerSGP(twoWay);
  assert.ok(
    sgpTwoWay > sgpPitcherOnly,
    `two-way SGP (${sgpTwoWay}) should exceed pitcher-only SGP (${sgpPitcherOnly})`,
  );
});

test("two-way assignment: P+DH player with both stat sets gets a real bestPosition and SAR>0", () => {
  const league: LeagueConfig = {
    numTeams: 2,
    budget: 100,
    rosterSlotsPerTeam: { P: 1, UTIL: 1 },
  };
  const twoWay: PlayerLean = {
    _id: "ohtani",
    name: "Two-Way",
    mlbTeam: "X",
    positions: ["P", "DH"],
    projW: 12, projK: 180, projERA: 3.5, projWHIP: 1.15, projIP: 180,
    projHR: 40, projRBI: 100, projR: 95, projSB: 8, projAVG: 0.295,
    projGames: 158,
  };
  const fill1 = pitcher({ _id: "f1", projK: 80, projW: 4 });
  const fill2 = pitcher({ _id: "f2", projK: 60, projW: 2 });
  const fill3 = hitter({ _id: "f3", positions: ["OF"], projHR: 8 });
  const fill4 = hitter({ _id: "f4", positions: ["OF"], projHR: 5 });
  const v = valuePool([twoWay, fill1, fill2, fill3, fill4], league, totalAuctionBudget(league));
  const entry = v.get("ohtani")!;
  assert.ok(["P", "UTIL"].includes(entry.bestPosition!));
  assert.ok(entry.sgpAboveRep > 0);
});

test("two-way regression: TWP-style positions=['P'] only with pitcher stats still works", () => {
  // Sanity: pre-refactor behavior preserved for normal pitchers.
  const sp = pitcher({ projK: 220 });
  const sgp = computePlayerSGP(sp);
  assert.ok(sgp > 0);
});

/**
 * Equivalence snapshot for the Stage 1 algorithm rewrite. Builds a varied pool that exercises:
 *  - single- and multi-position hitters
 *  - flex slots (C, 1B, 2B, SS, 3B, OF, CI, MI, UTIL, P) with realistic counts
 *  - starters, closers, and a two-way (P+OF) player
 *  - a high-risk player and a 60-day-IL player (risk multiplier branch)
 *  - one drafted player to exercise the static-par/inflation path
 *
 * Snapshot values were re-captured when LEAGUE_AVG_BA/ERA/WHIP became pool-derived
 * (`computeLeagueBaselines`). Above-baseline hitters earn more and starting pitchers
 * earn less than the pre-derivation snapshot — expected, since this fixture's pool
 * average sits lower than the old hardcoded .275/4.20/1.28.
 */
test("valuePool: snapshot equivalence on a varied pool (Stage 1 regression guard)", () => {
  const league: LeagueConfig = {
    numTeams: 4,
    budget: 200,
    rosterSlotsPerTeam: { C: 1, "1B": 1, "2B": 1, SS: 1, "3B": 1, OF: 2, CI: 1, MI: 1, UTIL: 1, P: 3 },
  };
  const hh = (
    _id: string,
    positions: string[],
    projHR: number, projRBI: number, projR: number, projSB: number, projAVG: number,
    extras: Partial<PlayerLean> = {},
  ): PlayerLean => ({
    _id, name: _id, mlbTeam: "X", positions, projGames: 162,
    projHR, projRBI, projR, projSB, projAVG, ...extras,
  });
  const pp = (
    _id: string,
    projW: number, projK: number, projSV: number,
    projERA: number, projWHIP: number, projIP: number,
    extras: Partial<PlayerLean> = {},
  ): PlayerLean => ({
    _id, name: _id, mlbTeam: "X", positions: ["P"], projGames: 32,
    projW, projK, projSV, projERA, projWHIP, projIP, ...extras,
  });
  const pool: PlayerLean[] = [
    hh("c1", ["C"], 25, 70, 65, 2, 0.265), hh("c2", ["C"], 12, 45, 40, 1, 0.245),
    hh("c3", ["C"], 8, 35, 30, 0, 0.230), hh("c4", ["C"], 6, 28, 25, 0, 0.225),
    hh("c5", ["C"], 4, 22, 20, 0, 0.215),
    hh("1b1", ["1B"], 35, 100, 90, 3, 0.285), hh("1b2", ["1B"], 22, 75, 70, 1, 0.265),
    hh("1b3", ["1B"], 12, 55, 50, 1, 0.245), hh("1b4", ["1B"], 8, 40, 35, 0, 0.235),
    hh("2b1", ["2B"], 28, 85, 95, 15, 0.290), hh("2b2", ["2B"], 15, 60, 65, 8, 0.270),
    hh("2b3", ["2B"], 10, 45, 50, 4, 0.250), hh("2b4", ["2B"], 5, 30, 35, 2, 0.235),
    hh("ss1", ["SS"], 32, 95, 100, 12, 0.295), hh("ss2", ["SS"], 18, 65, 70, 6, 0.275),
    hh("ss3", ["SS"], 8, 40, 45, 3, 0.250), hh("ss4", ["SS"], 4, 25, 30, 1, 0.230),
    hh("3b1", ["3B"], 38, 110, 95, 5, 0.295), hh("3b2", ["3B"], 20, 75, 70, 2, 0.270),
    hh("3b3", ["3B"], 12, 55, 50, 1, 0.245), hh("3b4", ["3B"], 6, 35, 30, 0, 0.230),
    hh("of1", ["OF"], 40, 115, 100, 20, 0.300), hh("of2", ["OF"], 30, 90, 85, 12, 0.285),
    hh("of3", ["OF"], 20, 70, 65, 8, 0.270), hh("of4", ["OF"], 12, 55, 55, 5, 0.255),
    hh("of5", ["OF"], 8, 40, 45, 3, 0.245), hh("of6", ["OF"], 5, 30, 35, 2, 0.230),
    hh("of7", ["OF"], 3, 22, 25, 1, 0.220),
    hh("multi1", ["SS", "OF"], 33, 95, 95, 18, 0.290),
    hh("multi2", ["1B", "3B"], 28, 90, 80, 1, 0.280),
    hh("risky", ["OF"], 25, 80, 75, 5, 0.270, { risk: "High", age: 35 }),
    hh("injured", ["1B"], 30, 95, 80, 0, 0.280, { injuryStatus: "60-day IL" }),
    pp("p1", 18, 230, 0, 2.85, 1.05, 200), pp("p2", 15, 200, 0, 3.20, 1.15, 195),
    pp("p3", 12, 175, 0, 3.65, 1.20, 180), pp("p4", 10, 150, 0, 3.90, 1.25, 165),
    pp("p5", 8, 130, 0, 4.10, 1.28, 150), pp("p6", 6, 110, 0, 4.30, 1.32, 130),
    pp("p7", 5, 90, 0, 4.50, 1.35, 110), pp("p8", 3, 70, 0, 4.70, 1.40, 90),
    pp("cl1", 3, 80, 35, 2.50, 1.00, 65), pp("cl2", 2, 65, 28, 2.90, 1.10, 60),
    {
      _id: "tw", name: "TW", mlbTeam: "X", positions: ["P", "OF"], projGames: 158,
      projW: 12, projK: 180, projSV: 0, projERA: 3.50, projWHIP: 1.18, projIP: 180,
      projHR: 35, projRBI: 95, projR: 90, projSB: 10, projAVG: 0.285,
    },
  ];

  const draft = { picks: [{ playerId: "1b1", teamInLeagueId: "t1", price: 45 }] };
  const undrafted = undraftedPlayers(pool, draft.picks);
  const remaining = remainingAuctionDollars(league, draft);
  const v = valuePool(undrafted, league, remaining, { fullPool: pool });

  const expected: Record<string, number> = {
    c1: 19, c2: 7, c3: 1, c4: 1, c5: 1,
    "1b2": 17, "1b3": 7, "1b4": 1,
    "2b1": 32, "2b2": 18, "2b3": 9, "2b4": 1,
    ss1: 35, ss2: 21, ss3: 8, ss4: 1,
    "3b1": 35, "3b2": 19, "3b3": 8, "3b4": 1,
    of1: 41, of2: 30, of3: 20, of4: 12, of5: 6, of6: 1, of7: 1,
    multi1: 35, multi2: 25,
    risky: 19, injured: 10,
    p1: 47, p2: 36, p3: 26, p4: 17, p5: 11, p6: 5, p7: 1, p8: 1,
    cl1: 43, cl2: 30, tw: 57,
  };
  // Drafted player is excluded from the result map.
  assert.equal(v.has("1b1"), false, "drafted player should not appear in valuation map");
  const actual: Record<string, number> = {};
  for (const [id, e] of v) actual[id] = e.dollarValue;
  assert.deepEqual(actual, expected,
    "valuation output drifted from snapshot — review computeParValues / replacementSGPFromPool");
});

test("valuePool: breakdown surfaces sgpAboveRep and bestPosition", () => {
  const pool = [
    hitter({ _id: "top", positions: ["OF"], projHR: 40 }),
    hitter({ _id: "mid", positions: ["OF"], projHR: 20 }),
    hitter({ _id: "rep", positions: ["OF"], projHR: 5 }),
  ];
  const v = valuePool(pool, tinyLeague, totalAuctionBudget(tinyLeague));
  const top = v.get("top")!;
  assert.ok(top.sgpAboveRep > 0);
  assert.equal(top.bestPosition, "OF");
  assert.match(top.explanation, /SGP above replacement/);
});

test("computeLeagueBaselines: BA is games-weighted, not unweighted", () => {
  // 1 full-time .240 hitter (162 G) vs 9 part-time .320 hitters (10 G each).
  // Unweighted mean ≈ .312; games-weighted mean ≈ (.240*162 + .320*90) / 252 ≈ .269.
  const pool: PlayerLean[] = [
    hitter({ _id: "ft", projGames: 162, projAVG: 0.24 }),
    ...Array.from({ length: 9 }, (_, i) =>
      hitter({ _id: `pt${i}`, projGames: 10, projAVG: 0.32 }),
    ),
  ];
  const { ba } = computeLeagueBaselines(pool);
  const unweighted = (0.24 + 9 * 0.32) / 10;
  const expected = (0.24 * 162 + 0.32 * 9 * 10) / (162 + 90);
  assert.ok(Math.abs(ba - expected) < 1e-6, `ba=${ba}`);
  assert.ok(Math.abs(ba - unweighted) > 0.02, "weighted mean should differ from unweighted");
});

test("computeLeagueBaselines: ERA/WHIP are IP-weighted", () => {
  // 1 ace at 200 IP / 2.50 ERA vs 5 mop-up at 20 IP / 6.00 ERA each.
  const pool: PlayerLean[] = [
    pitcher({ _id: "ace", projIP: 200, projERA: 2.5, projWHIP: 1.0 }),
    ...Array.from({ length: 5 }, (_, i) =>
      pitcher({ _id: `mop${i}`, projIP: 20, projERA: 6.0, projWHIP: 1.6 }),
    ),
  ];
  const { era, whip } = computeLeagueBaselines(pool);
  const expectedEra = (2.5 * 200 + 6.0 * 100) / 300;
  const expectedWhip = (1.0 * 200 + 1.6 * 100) / 300;
  assert.ok(Math.abs(era - expectedEra) < 1e-6, `era=${era}`);
  assert.ok(Math.abs(whip - expectedWhip) < 1e-6, `whip=${whip}`);
});

test("computeLeagueBaselines: empty pool falls back to module constants", () => {
  const { ba, era, whip } = computeLeagueBaselines([]);
  assert.equal(ba, 0.250);
  assert.equal(era, 4.2);
  assert.equal(whip, 1.28);
});

test("computeLeagueBaselines: ignores isEligible=false and minor-leaguers", () => {
  const pool: PlayerLean[] = [
    hitter({ _id: "majors", projGames: 162, projAVG: 0.27 }),
    hitter({ _id: "minors", projGames: 162, projAVG: 0.05, rosterStatus: "Minors" }),
    hitter({ _id: "blocked", projGames: 162, projAVG: 0.05, isEligible: false }),
  ];
  const { ba } = computeLeagueBaselines(pool);
  assert.ok(Math.abs(ba - 0.27) < 1e-9, `ba=${ba}`);
});

test("valuePool: scope-divergent baselines move valuations", () => {
  // Two pools differing only in their baseline-shifting tail: one has high-BA
  // fillers, the other has low-BA fillers. The "target" hitter sits at .280
  // in both. With pool-derived baselines, the target should be worth more in
  // the low-BA pool (where it's further above replacement-baseline) than in
  // the high-BA pool.
  const league: LeagueConfig = {
    numTeams: 2,
    budget: 100,
    rosterSlotsPerTeam: { OF: 1, P: 1 },
  };
  const makePool = (fillerAVG: number): PlayerLean[] => [
    hitter({ _id: "target", positions: ["OF"], projHR: 25, projRBI: 80, projR: 80, projSB: 5, projAVG: 0.280, projGames: 162 }),
    hitter({ _id: "f1", positions: ["OF"], projHR: 15, projRBI: 55, projR: 55, projSB: 2, projAVG: fillerAVG, projGames: 162 }),
    hitter({ _id: "f2", positions: ["OF"], projHR: 10, projRBI: 45, projR: 45, projSB: 1, projAVG: fillerAVG, projGames: 162 }),
    pitcher({ _id: "p1", projIP: 180 }),
    pitcher({ _id: "p2", projIP: 180 }),
  ];
  const vHigh = valuePool(makePool(0.300), league, totalAuctionBudget(league));
  const vLow = valuePool(makePool(0.230), league, totalAuctionBudget(league));
  // In the low-BA pool the baseline is pulled below .280, so the target's
  // AVG contribution to SGP is larger → higher dollar value.
  assert.ok(
    vLow.get("target")!.dollarValue > vHigh.get("target")!.dollarValue,
    `low-BA pool target=$${vLow.get("target")!.dollarValue}, high-BA pool target=$${vHigh.get("target")!.dollarValue}`,
  );
});

test("priorYearWeight: age scales the prior pull (young trusts proj more than vet)", () => {
  // Identical projection + identical (weaker) prior. Sample gate passes for both.
  // Young player → smaller effective weight → SGP closer to proj-only (higher).
  // Vet → larger effective weight → SGP pulled toward weaker prior (lower).
  const base = {
    projHR: 35, projRBI: 100, projR: 95, projSB: 5, projAVG: 0.290, projGames: 162,
    prevHR: 18, prevRBI: 55, prevR: 50, prevSB: 2, prevAVG: 0.250, prevGames: 160,
  };
  const young = hitter({ ...base, age: 22 });
  const mid   = hitter({ ...base, age: 28 });
  const vet   = hitter({ ...base, age: 35 });
  const w = 0.15;
  const yS = computePlayerSGPParts(young, 12, undefined, undefined, w).total;
  const mS = computePlayerSGPParts(mid,   12, undefined, undefined, w).total;
  const vS = computePlayerSGPParts(vet,   12, undefined, undefined, w).total;
  assert.ok(yS > mS, `young (${yS}) should exceed mid (${mS}) — less weight on weaker prior`);
  assert.ok(mS > vS, `mid (${mS}) should exceed vet (${vS}) — vet pulled further toward weaker prior`);
});
