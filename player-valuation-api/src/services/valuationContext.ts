import { PlayerModel } from "../models/Player.js";
import { SessionModel } from "../models/Session.js";
import { MLB_LEAGUE_BY_TEAM } from "../lib/mlbLeagueMap.js";
import {
  DEFAULT_DISPLAY_LEAGUE,
  valuePool,
  remainingAuctionDollars,
  undraftedPlayers,
  type PlayerLean,
  type LeagueConfig,
  type DraftStateInput,
  type ValuationBreakdown,
} from "../lib/sgpValuation.js";

export function parseMlbLeague(value: unknown): "AL" | "NL" | undefined {
  return value === "AL" || value === "NL" ? value : undefined;
}

const ALL_CATS = new Set(["HR", "RBI", "R", "SB", "AVG", "W", "ERA", "WHIP", "K", "SV"]);
const ALL_SLOTS = new Set(["C", "1B", "2B", "3B", "SS", "CI", "MI", "OF", "UTIL", "P"]);

export function parseRosterSlots(value: unknown): Record<string, number> | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const out: Record<string, number> = {};
  for (const part of value.split(",")) {
    const [rawKey, rawVal] = part.split(":");
    const key = rawKey?.trim().toUpperCase();
    const n = Number(rawVal);
    if (!key || !ALL_SLOTS.has(key)) continue;
    if (!Number.isFinite(n) || n < 0) continue;
    out[key] = Math.floor(n);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseCategories(value: unknown): string[] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parts = value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => ALL_CATS.has(s));
  return parts.length > 0 ? parts : undefined;
}

/** Positive integer in [2, 30]. Anything outside that range gets dropped so we fall back to the default. */
export function parseNumTeams(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 2 || n > 30) return undefined;
  return Math.floor(n);
}

/** Positive integer per team. Used in tandem with numTeams for the auction pool size. */
export function parseBudget(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

export async function leagueDraftFromQuery(
  sessionId: unknown,
  opts: {
    requireSession: boolean;
    mlbLeague?: "AL" | "NL";
    categories?: string[];
    rosterSlotsPerTeam?: Record<string, number>;
    numTeams?: number;
    budget?: number;
  }
): Promise<
  | { ok: true; league: LeagueConfig; draft: DraftStateInput }
  | { ok: false; status: number; message: string }
> {
  const empty =
    sessionId === undefined || sessionId === null || String(sessionId).trim() === "";
  if (empty) {
    if (opts.requireSession) {
      return { ok: false, status: 400, message: "sessionId is required" };
    }
    return {
      ok: true,
      league: {
        ...DEFAULT_DISPLAY_LEAGUE,
        ...(opts.numTeams !== undefined ? { numTeams: opts.numTeams } : {}),
        ...(opts.budget !== undefined ? { budget: opts.budget } : {}),
        mlbLeague: opts.mlbLeague,
        categories: opts.categories,
        rosterSlotsPerTeam: opts.rosterSlotsPerTeam,
      },
      draft: { picks: [] },
    };
  }
  const doc = await SessionModel.findOne({ sessionId: String(sessionId).trim() })
    .lean()
    .exec();
  if (!doc) return { ok: false, status: 404, message: "Session not found" };
  const draft = (doc.draftState ?? { picks: [] }) as DraftStateInput;
  const sessionLeague = doc.league as LeagueConfig;
  return {
    ok: true,
    league: {
      ...sessionLeague,
      mlbLeague: opts.mlbLeague ?? sessionLeague.mlbLeague,
      categories: opts.categories ?? sessionLeague.categories,
      rosterSlotsPerTeam: opts.rosterSlotsPerTeam ?? sessionLeague.rosterSlotsPerTeam,
    },
    draft: {
      picks: draft.picks ?? [],
      budgetsRemaining: draft.budgetsRemaining,
    },
  };
}

export function filterPoolByLeague(players: PlayerLean[], league: LeagueConfig): PlayerLean[] {
  if (!league.mlbLeague) return players;
  return players.filter((p) => MLB_LEAGUE_BY_TEAM[p.mlbTeam] === league.mlbLeague);
}

export async function valuationMapFor(
  league: LeagueConfig,
  draft: DraftStateInput
): Promise<Map<string, ValuationBreakdown>> {
  // STAGE 1 DIAGNOSTIC — remove once perf is validated in deployed env.
  const t0 = Date.now();
  const allRaw = (await PlayerModel.find({}).lean().exec()) as PlayerLean[];
  const all = filterPoolByLeague(allRaw, league);
  const tFind = Date.now();
  const pool = undraftedPlayers(all, draft.picks ?? []);
  const rem = remainingAuctionDollars(league, draft);
  // Pass the full pool so static-par + inflation kicks in once picks have happened.
  const result = valuePool(pool, league, rem, { fullPool: all });
  const tValue = Date.now();
  console.log(
    `[valuationMapFor] n=${all.length} find=${tFind - t0}ms value=${tValue - tFind}ms total=${tValue - t0}ms`,
  );
  return result;
}
