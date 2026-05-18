/**
 * One-off diagnostic: empirically audit the hardcoded denominators in sgpValuation.ts
 * against the seeded player pool. Simulates a 12-team draft by taking the top hitters
 * and pitchers by SGP, round-robin-distributing them, computing each team's category
 * totals, then measuring the mean gap between adjacent team rankings — i.e. the
 * empirical "1 standings point" for each category. Prints a comparison table.
 *
 * Read-only. Never modifies the database or any source constants.
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { PlayerModel } from "../models/Player.js";
import { computePlayerSGP, type PlayerLean } from "../lib/sgpValuation.js";
import { defaultRosterSlotsPerTeam } from "../lib/rosterDefaults.js";

const NUM_TEAMS = 12;

// Mirrors isPoolEligible() in sgpValuation.ts (not exported there).
function isPoolEligible(p: PlayerLean): boolean {
  if (p.isEligible === false) return false;
  if (p.rosterStatus == null) return true;
  return (
    p.rosterStatus === "ActiveRoster" ||
    p.rosterStatus === "InjuredList" ||
    p.rosterStatus === "Bereavement"
  );
}

function isPitcher(p: PlayerLean): boolean {
  return p.positions.includes("P");
}

function hasMeaningfulHitterProj(p: PlayerLean): boolean {
  return (p.projHR ?? 0) > 0 || (p.projAVG ?? 0) > 0;
}

function hasMeaningfulPitcherProj(p: PlayerLean): boolean {
  return (p.projIP ?? 0) > 0 || (p.projK ?? 0) > 0;
}

type TeamTotals = {
  // counting
  HR: number; RBI: number; R: number; SB: number;
  W: number; K: number; SV: number;
  // weights for rate stats
  totalGamesAVG: number; weightedAVG: number;
  totalIP: number; eraNum: number; whipNum: number; // eraNum = sum(ERA * IP); same for WHIP
};

function emptyTotals(): TeamTotals {
  return {
    HR: 0, RBI: 0, R: 0, SB: 0,
    W: 0, K: 0, SV: 0,
    totalGamesAVG: 0, weightedAVG: 0,
    totalIP: 0, eraNum: 0, whipNum: 0,
  };
}

function addHitter(t: TeamTotals, p: PlayerLean): void {
  t.HR  += p.projHR  ?? 0;
  t.RBI += p.projRBI ?? 0;
  t.R   += p.projR   ?? 0;
  t.SB  += p.projSB  ?? 0;
  const g = p.projGames ?? 162;
  if (p.projAVG != null && g > 0) {
    t.weightedAVG   += p.projAVG * g;
    t.totalGamesAVG += g;
  }
}

function addPitcher(t: TeamTotals, p: PlayerLean): void {
  t.W  += p.projW  ?? 0;
  t.K  += p.projK  ?? 0;
  t.SV += p.projSV ?? 0;
  const ip = p.projIP ?? 0;
  if (ip > 0) {
    t.totalIP += ip;
    if (p.projERA  != null) t.eraNum  += p.projERA  * ip;
    if (p.projWHIP != null) t.whipNum += p.projWHIP * ip;
  }
}

/** Mean gap between adjacent ranks in a sorted-descending series. */
function meanAdjacentGap(values: number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  let sum = 0;
  for (let i = 0; i < sorted.length - 1; i++) sum += sorted[i] - sorted[i + 1];
  return sum / (sorted.length - 1);
}

/** Same as meanAdjacentGap but for rate stats where lower is better (ERA/WHIP). */
function meanAdjacentGapAscending(values: number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < sorted.length - 1; i++) sum += sorted[i + 1] - sorted[i];
  return sum / (sorted.length - 1);
}

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI in player-valuation-api/.env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const players = (await PlayerModel.find({}).lean()) as unknown as PlayerLean[];
  console.log(`Loaded ${players.length} players from Mongo.`);

  const eligible = players.filter(isPoolEligible);
  console.log(`${eligible.length} eligible after rosterStatus filter.`);

  const sgpOf = new Map<unknown, number>();
  for (const p of eligible) sgpOf.set(p._id, computePlayerSGP(p, NUM_TEAMS));

  const hitters = eligible
    .filter((p) => !isPitcher(p) && hasMeaningfulHitterProj(p))
    .sort((a, b) => (sgpOf.get(b._id) ?? 0) - (sgpOf.get(a._id) ?? 0));
  const pitchers = eligible
    .filter((p) => isPitcher(p) && hasMeaningfulPitcherProj(p))
    .sort((a, b) => (sgpOf.get(b._id) ?? 0) - (sgpOf.get(a._id) ?? 0));

  const slots = defaultRosterSlotsPerTeam();
  const hitterSlotsPerTeam =
    slots.C + slots["1B"] + slots["2B"] + slots["3B"] + slots.SS +
    slots.OF + slots.CI + slots.MI + slots.UTIL;
  const pitcherSlotsPerTeam = slots.P;
  const nHitters = NUM_TEAMS * hitterSlotsPerTeam;
  const nPitchers = NUM_TEAMS * pitcherSlotsPerTeam;

  console.log(
    `Drafting top ${nHitters} hitters (${hitterSlotsPerTeam}/team) and ` +
    `${nPitchers} pitchers (${pitcherSlotsPerTeam}/team) into ${NUM_TEAMS} teams.`,
  );

  // This is a rotisserie *auction* league, not a snake draft. Teams differ by bidding
  // strategy and which players they target — they don't get sequential picks. A snake or
  // round-robin allocation systematically biases team 1 and exaggerates category spreads.
  // The closest defensible model: many random partitions of the draftable pool into 12
  // equal-sized rosters, averaging the adjacent-rank gap across trials. This represents
  // "12 equally-skilled owners with random target overlap" — the auction-league analog.
  const NUM_TRIALS = 200;
  const RNG_SEED = 42;

  function mkRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleInPlace<T>(arr: T[], rng: () => number): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  const rng = mkRng(RNG_SEED);
  const gapAcc: Record<string, number> = {
    HR: 0, RBI: 0, R: 0, SB: 0, AVG: 0, W: 0, ERA: 0, WHIP: 0, K: 0, SV: 0,
  };

  const usableHitters = hitters.slice(0, nHitters);
  const usablePitchers = pitchers.slice(0, nPitchers);
  const hitterIdx = usableHitters.map((_, i) => i);
  const pitcherIdx = usablePitchers.map((_, i) => i);

  for (let trial = 0; trial < NUM_TRIALS; trial++) {
    shuffleInPlace(hitterIdx, rng);
    shuffleInPlace(pitcherIdx, rng);
    const teams: TeamTotals[] = Array.from({ length: NUM_TEAMS }, () => emptyTotals());
    for (let i = 0; i < hitterIdx.length; i++) addHitter(teams[i % NUM_TEAMS], usableHitters[hitterIdx[i]]);
    for (let i = 0; i < pitcherIdx.length; i++) addPitcher(teams[i % NUM_TEAMS], usablePitchers[pitcherIdx[i]]);

    const teamAVG = teams.map((t) => (t.totalGamesAVG > 0 ? t.weightedAVG / t.totalGamesAVG : 0));
    const teamERA = teams.map((t) => (t.totalIP > 0 ? t.eraNum / t.totalIP : 0));
    const teamWHIP = teams.map((t) => (t.totalIP > 0 ? t.whipNum / t.totalIP : 0));

    gapAcc.HR   += meanAdjacentGap(teams.map((t) => t.HR));
    gapAcc.RBI  += meanAdjacentGap(teams.map((t) => t.RBI));
    gapAcc.R    += meanAdjacentGap(teams.map((t) => t.R));
    gapAcc.SB   += meanAdjacentGap(teams.map((t) => t.SB));
    gapAcc.AVG  += meanAdjacentGap(teamAVG);
    gapAcc.W    += meanAdjacentGap(teams.map((t) => t.W));
    gapAcc.K    += meanAdjacentGap(teams.map((t) => t.K));
    gapAcc.SV   += meanAdjacentGap(teams.map((t) => t.SV));
    gapAcc.ERA  += meanAdjacentGapAscending(teamERA);
    gapAcc.WHIP += meanAdjacentGapAscending(teamWHIP);
  }

  console.log(`Averaged across ${NUM_TRIALS} random partitions (seed ${RNG_SEED}).`);

  // Hardcoded BASE_DENOM_12T from sgpValuation.ts — kept here as a literal reference.
  const hardcoded = {
    HR: 11, RBI: 31, R: 29, SB: 9, AVG: 0.003,
    W: 3, ERA: 0.15, WHIP: 0.025, K: 22, SV: 4,
  };

  const empirical: Record<keyof typeof hardcoded, number> = {
    HR:   gapAcc.HR   / NUM_TRIALS,
    RBI:  gapAcc.RBI  / NUM_TRIALS,
    R:    gapAcc.R    / NUM_TRIALS,
    SB:   gapAcc.SB   / NUM_TRIALS,
    AVG:  gapAcc.AVG  / NUM_TRIALS,
    W:    gapAcc.W    / NUM_TRIALS,
    ERA:  gapAcc.ERA  / NUM_TRIALS,
    WHIP: gapAcc.WHIP / NUM_TRIALS,
    K:    gapAcc.K    / NUM_TRIALS,
    SV:   gapAcc.SV   / NUM_TRIALS,
  };

  console.log("");
  console.log("Cat   Hardcoded   Empirical   Ratio (emp/hc)   Flag");
  console.log("----  ---------   ---------   --------------   ----");
  for (const cat of Object.keys(hardcoded) as (keyof typeof hardcoded)[]) {
    const hc = hardcoded[cat];
    const emp = empirical[cat];
    const ratio = emp / hc;
    const flag = ratio < 0.85 || ratio > 1.15 ? "  ⚠" : "";
    const hcStr  = (cat === "AVG" || cat === "ERA" || cat === "WHIP") ? hc.toFixed(3)  : hc.toFixed(1).padStart(6);
    const empStr = (cat === "AVG" || cat === "ERA" || cat === "WHIP") ? emp.toFixed(4) : emp.toFixed(1).padStart(6);
    console.log(
      `${cat.padEnd(5)} ${hcStr.padStart(9)}   ${empStr.padStart(9)}   ${ratio.toFixed(2).padStart(14)}${flag}`,
    );
  }
  console.log("");
  console.log("Ratios in [0.85, 1.15] are fine. Flagged rows are candidates for recalibration.");
  console.log("No constants were modified by this script.");

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
