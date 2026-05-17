import { Request, Response } from "express";
import { PlayerModel } from "../models/Player.js";
import { findPlayerByRequestId } from "../lib/resolvePlayer.js";
import { leagueDraftFromQuery, valuationMapFor, parseMlbLeague, parseCategories, parseRosterSlots } from "../services/valuationContext.js";
import { MLB_LEAGUE_BY_TEAM } from "../lib/mlbLeagueMap.js";
import {
  isPlayerDrafted,
  adviceLabel,
  adviceColor,
  type PlayerLean,
} from "../lib/sgpValuation.js";

function isPitcher(doc: PlayerLean): boolean {
  return doc.positions.includes("P");
}

function compactBlock(o: Record<string, number | undefined>): Record<string, number | undefined> | undefined {
  return Object.values(o).every((v) => v === undefined) ? undefined : o;
}

function hitterProjBlock(doc: PlayerLean) {
  return compactBlock({ hr: doc.projHR, rbi: doc.projRBI, r: doc.projR, sb: doc.projSB, avg: doc.projAVG });
}
function pitcherProjBlock(doc: PlayerLean) {
  return compactBlock({ w: doc.projW, era: doc.projERA, whip: doc.projWHIP, k: doc.projK, sv: doc.projSV, ip: doc.projIP });
}
function hitterPrevBlock(doc: PlayerLean) {
  return compactBlock({ games: doc.prevGames, hr: doc.prevHR, rbi: doc.prevRBI, r: doc.prevR, sb: doc.prevSB, avg: doc.prevAVG });
}
function pitcherPrevBlock(doc: PlayerLean) {
  return compactBlock({ w: doc.prevW, era: doc.prevERA, whip: doc.prevWHIP, k: doc.prevK, sv: doc.prevSV, ip: doc.prevIP });
}
function hitterSavantBlock(doc: PlayerLean) {
  return compactBlock({
    xba: doc.xba, xslg: doc.xslg, xwoba: doc.xwoba,
    barrelPct: doc.barrelPct, hardHitPct: doc.hardHitPct,
    exitVelo: doc.exitVelo, kPct: doc.kPct, bbPct: doc.bbPct, sprintSpeed: doc.sprintSpeed,
  });
}
function pitcherSavantBlock(doc: PlayerLean) {
  return compactBlock({
    xera: doc.xera, whiffPct: doc.whiffPct,
    barrelPctAgainst: doc.barrelPctAgainst, hardHitPctAgainst: doc.hardHitPctAgainst,
    exitVeloAgainst: doc.exitVeloAgainst, kPct: doc.kPct, bbPct: doc.bbPct,
  });
}

// `prevStats`/`projStats`/`savantStats` carry the player's primary-role block
// (pitcher if positions include P, else hitter). Two-way players also receive
// the secondary block via `hitter*`/`pitcher*` fields so the UI can render both.
function projStatsBlock(doc: PlayerLean): Record<string, number | undefined> | undefined {
  return isPitcher(doc) ? pitcherProjBlock(doc) : hitterProjBlock(doc);
}
function prevStatsBlock(doc: PlayerLean): Record<string, number | undefined> | undefined {
  return isPitcher(doc) ? pitcherPrevBlock(doc) : hitterPrevBlock(doc);
}
function savantStatsBlock(doc: PlayerLean): Record<string, number | undefined> | undefined {
  return isPitcher(doc) ? pitcherSavantBlock(doc) : hitterSavantBlock(doc);
}

function toPlayer(doc: PlayerLean) {
  const projStats = projStatsBlock(doc);
  const prevStats = prevStatsBlock(doc);
  const savantStats = savantStatsBlock(doc);
  // Two-way players (Ohtani-style): emit the off-role blocks so the UI can show both.
  const hitterProj = hitterProjBlock(doc);
  const pitcherProj = pitcherProjBlock(doc);
  const hitterPrev = hitterPrevBlock(doc);
  const pitcherPrev = pitcherPrevBlock(doc);
  const hitterSavant = hitterSavantBlock(doc);
  const pitcherSavant = pitcherSavantBlock(doc);
  const isTwoWay = hitterProj != null && pitcherProj != null;
  return {
    id: String(doc._id),
    mlbPlayerId: doc.mlbPlayerId ?? undefined,
    mlbTeamId: doc.mlbTeamId ?? undefined,
    name: doc.name,
    mlbTeam: doc.mlbTeam,
    positions: doc.positions,
    ...(doc.bats && { bats: doc.bats as "R" | "L" | "S" }),
    ...(doc.throws && { throws: doc.throws as "R" | "L" }),
    ...(doc.depthRole && { depthRole: doc.depthRole }),
    ...(doc.rosterStatus && { rosterStatus: doc.rosterStatus }),
    ...(doc.risk && { risk: doc.risk as "Low" | "Med" | "High" }),
    ...(doc.age != null && { age: doc.age }),
    ...(doc.injuryStatus != null && { injuryStatus: doc.injuryStatus }),
    ...(doc.injuryNote != null && { injuryNote: doc.injuryNote }),
    ...(doc.injuryReturn != null && { injuryReturn: doc.injuryReturn instanceof Date ? doc.injuryReturn.toISOString() : doc.injuryReturn }),
    projGames: doc.projGames,
    ...(projStats && { projStats }),
    ...(prevStats && { prevStats }),
    ...(savantStats && { savantStats }),
    ...(isTwoWay && hitterProj && { hitterProjStats: hitterProj }),
    ...(isTwoWay && pitcherProj && { pitcherProjStats: pitcherProj }),
    ...(isTwoWay && hitterPrev && { hitterPrevStats: hitterPrev }),
    ...(isTwoWay && pitcherPrev && { pitcherPrevStats: pitcherPrev }),
    ...(isTwoWay && hitterSavant && { hitterSavantStats: hitterSavant }),
    ...(isTwoWay && pitcherSavant && { pitcherSavantStats: pitcherSavant }),
  };
}

export async function getPlayers(req: Request, res: Response): Promise<void> {
  try {
    const { q, position, limit } = req.query;
    const mlbLeague = parseMlbLeague(req.query.mlbLeague);
    let query: Record<string, unknown> = {};
    if (mlbLeague) {
      const teamsInLeague = Object.entries(MLB_LEAGUE_BY_TEAM)
        .filter(([, lg]) => lg === mlbLeague)
        .map(([abbr]) => abbr);
      query.mlbTeam = { $in: teamsInLeague };
    }

    if (typeof q === "string" && q.trim()) {
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { mlbTeam: { $regex: escaped, $options: "i" } },
      ];
    }
    if (typeof position === "string" && position.trim()) {
      query.positions = position.trim();
    }

    let qb = PlayerModel.find(query).lean();
    const limitNum = typeof limit === "string" ? parseInt(limit, 10) : Number(limit);
    if (Number.isFinite(limitNum) && limitNum > 0) {
      qb = qb.limit(limitNum);
    }

    const docs = await qb.exec();
    const players = (docs as PlayerLean[]).map((d) => toPlayer(d));
    res.json({ players });
  } catch (e) {
    console.error("getPlayers", e);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getPlayerById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const doc = await findPlayerByRequestId(id);
    if (!doc) {
      res.status(404).json({ message: "Player not found" });
      return;
    }
    res.json({ player: toPlayer(doc as PlayerLean) });
  } catch (e) {
    console.error("getPlayerById", e);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getValuation(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const player = (await findPlayerByRequestId(id)) as PlayerLean | null;
    if (!player) {
      res.status(404).json({ message: "Player not found" });
      return;
    }

    const ctx = await leagueDraftFromQuery(req.query.sessionId, { requireSession: false, mlbLeague: parseMlbLeague(req.query.mlbLeague), categories: parseCategories(req.query.categories), rosterSlotsPerTeam: parseRosterSlots(req.query.rosterSlots) });
    if (!ctx.ok) {
      res.status(ctx.status).json({ message: ctx.message });
      return;
    }

    const currentBidRaw = req.query.currentBid;
    const currentBid =
      currentBidRaw !== undefined && String(currentBidRaw).trim() !== ""
        ? Number(currentBidRaw)
        : undefined;

    const drafted = isPlayerDrafted(player, ctx.draft.picks ?? []);
    if (drafted) {
      res.json({
        valuation: {
          playerId: String(player._id),
          mlbPlayerId: player.mlbPlayerId ?? null,
          name: player.name,
          mlbTeamId: player.mlbTeamId ?? null,
          dollarValue: 0,
          updatedAt: new Date().toISOString(),
          explanation: "Player is already drafted in this session.",
        },
      });
      return;
    }

    const map = await valuationMapFor(ctx.league, ctx.draft);
    const row = map.get(String(player._id));
    const dollarValue = row?.dollarValue ?? 1;
    const explanation =
      row?.explanation ?? "Projected auction value from SGP vs replacement pool.";

    const label = adviceLabel(dollarValue, currentBid);
    const color = adviceColor(label);

    res.json({
      valuation: {
        playerId: String(player._id),
        mlbPlayerId: player.mlbPlayerId ?? null,
        name: player.name,
        mlbTeamId: player.mlbTeamId ?? null,
        dollarValue,
        updatedAt: new Date().toISOString(),
        explanation,
        sgpAboveRep: row?.sgpAboveRep,
        riskFlag: row?.riskFlag,
        ...(label && { adviceLabel: label, adviceColor: color }),
      },
    });
  } catch (e) {
    console.error("getValuation", e);
    res.status(500).json({ message: "Internal server error" });
  }
}
