import { DraftPick } from "@/lib/models/DraftPick";
import { Roster } from "@/lib/models/Roster";
import { League, type ILeague } from "@/lib/models/League";

const VALUATION_API_URL = process.env.VALUATION_API_URL;
const LICENSE_KEY = process.env.LICENSE_KEY;

export type UnifiedPick = {
  _id: unknown;
  leagueId: unknown;
  playerId: string;
  playerName: string;
  mlbTeam: string;
  positions: string[];
  teamId: string;
  teamName: string;
  price: number;
  pickNumber: number;
  isKeeper: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

// Single source of truth for the merged DraftPick + Roster list. Used by both
// the picks GET endpoint and the valuation-session sync helper.
export async function getUnifiedLeaguePicks(league: ILeague): Promise<UnifiedPick[]> {
  const leagueId = league._id;
  const [draftPicks, keepers] = await Promise.all([
    DraftPick.find({ leagueId }).sort({ pickNumber: 1 }).lean(),
    Roster.find({ leagueId }).lean(),
  ]);

  const teamIdByName = new Map(
    (league.teams ?? []).map((t) => [t.name, t.id]),
  );

  const keeperPicks: UnifiedPick[] = keepers.map((r) => ({
    _id: r._id,
    leagueId: r.leagueId,
    playerId: r.playerId,
    playerName: r.playerName,
    mlbTeam: r.mlbTeam,
    positions: r.positions ?? [],
    teamId: teamIdByName.get(r.teamName) ?? "",
    teamName: r.teamName,
    price: r.price,
    pickNumber: 0,
    isKeeper: true,
    createdAt: r.assignedAt ?? (r as { createdAt?: Date }).createdAt,
    updatedAt: (r as { updatedAt?: Date }).updatedAt,
  }));

  const annotatedDraftPicks: UnifiedPick[] = draftPicks.map((p) => ({
    _id: p._id,
    leagueId: p.leagueId,
    playerId: p.playerId,
    playerName: p.playerName,
    mlbTeam: p.mlbTeam,
    positions: p.positions ?? [],
    teamId: p.teamId,
    teamName: p.teamName,
    price: p.price,
    pickNumber: p.pickNumber,
    isKeeper: false,
    createdAt: (p as { createdAt?: Date }).createdAt,
    updatedAt: (p as { updatedAt?: Date }).updatedAt,
  }));

  return [...keeperPicks, ...annotatedDraftPicks];
}

async function valuationFetch(path: string, init: RequestInit): Promise<Response> {
  if (!VALUATION_API_URL || !LICENSE_KEY) {
    throw new Error(
      "Valuation API not configured: set VALUATION_API_URL and LICENSE_KEY",
    );
  }
  const url = `${VALUATION_API_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  return fetch(url, {
    ...init,
    headers: {
      "x-license-key": LICENSE_KEY,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
}

// Returns the sessionId, or null if provisioning failed (caller treats as a
// best-effort no-op — DB writes already succeeded).
export async function ensureValuationSession(league: ILeague): Promise<string | null> {
  if (league.valuationSessionId) return league.valuationSessionId;
  try {
    const body = {
      league: {
        numTeams: league.teamCount,
        budget: league.budget,
        scoring: league.scoringType,
        rosterSlotsPerTeam: league.rosterSlots,
        mlbLeague: league.scope === "AL" || league.scope === "NL" ? league.scope : undefined,
        categories: league.categories,
      },
      draftState: { picks: [] },
    };
    const res = await valuationFetch("sessions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        "ensureValuationSession: create failed",
        res.status,
        await res.text().catch(() => ""),
      );
      return null;
    }
    const data = (await res.json()) as { session_id?: string };
    if (!data.session_id) return null;
    await League.updateOne(
      { _id: league._id },
      { $set: { valuationSessionId: data.session_id } },
    ).exec();
    league.valuationSessionId = data.session_id;
    return data.session_id;
  } catch (e) {
    console.error("ensureValuationSession error:", e);
    return null;
  }
}

// Fire-and-forget. Failures are logged but never thrown — the picks DB is
// authoritative; a missed sync just means stale valuations until the next
// mutation, since PUT is a full replace.
export async function syncValuationSession(league: ILeague): Promise<void> {
  try {
    const sessionId = await ensureValuationSession(league);
    if (!sessionId) return;
    const picks = await getUnifiedLeaguePicks(league);
    const valuationPicks = picks.map((p) => ({
      playerId: p.playerId,
      teamInLeagueId: p.teamId,
      price: p.price,
    }));
    const res = await valuationFetch(
      `sessions/${encodeURIComponent(sessionId)}/draftState`,
      {
        method: "PUT",
        body: JSON.stringify({ picks: valuationPicks }),
      },
    );
    if (!res.ok) {
      console.error(
        "syncValuationSession: PUT failed",
        res.status,
        await res.text().catch(() => ""),
      );
    }
  } catch (e) {
    console.error("syncValuationSession error:", e);
  }
}
