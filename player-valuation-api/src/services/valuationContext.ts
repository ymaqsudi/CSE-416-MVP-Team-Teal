import { PlayerModel } from "../models/Player.js";
import { SessionModel } from "../models/Session.js";
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

export async function leagueDraftFromQuery(
  sessionId: unknown,
  opts: { requireSession: boolean }
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
    return { ok: true, league: DEFAULT_DISPLAY_LEAGUE, draft: { picks: [] } };
  }
  const doc = await SessionModel.findOne({ sessionId: String(sessionId).trim() })
    .lean()
    .exec();
  if (!doc) return { ok: false, status: 404, message: "Session not found" };
  const draft = (doc.draftState ?? { picks: [] }) as DraftStateInput;
  return {
    ok: true,
    league: doc.league as LeagueConfig,
    draft: {
      picks: draft.picks ?? [],
      budgetsRemaining: draft.budgetsRemaining,
    },
  };
}

export async function valuationMapFor(
  league: LeagueConfig,
  draft: DraftStateInput
): Promise<Map<string, ValuationBreakdown>> {
  // STAGE 1 DIAGNOSTIC — remove once perf is validated in deployed env.
  const t0 = Date.now();
  const all = (await PlayerModel.find({}).lean().exec()) as PlayerLean[];
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
