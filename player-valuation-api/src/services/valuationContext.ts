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
  const all = (await PlayerModel.find({}).lean().exec()) as PlayerLean[];
  const pool = undraftedPlayers(all, draft.picks ?? []);
  const rem = remainingAuctionDollars(league, draft);
  return valuePool(pool, league, rem);
}
