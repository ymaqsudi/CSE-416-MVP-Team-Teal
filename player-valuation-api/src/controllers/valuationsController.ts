import { Request, Response } from "express";
import { leagueDraftFromQuery, valuationMapFor } from "../services/valuationContext.js";
import {
  undraftedPlayers,
  playerIdString,
  type PlayerLean,
} from "../lib/sgpValuation.js";
import { PlayerModel } from "../models/Player.js";
import { parsePlayerRef, findPlayerByParsedRef } from "../lib/resolvePlayer.js";

export async function postValuationsBatch(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await leagueDraftFromQuery(req.query.sessionId, { requireSession: true });
    if (!ctx.ok) {
      res.status(ctx.status).json({ message: ctx.message });
      return;
    }

    const playerIds = req.body?.playerIds;
    if (!Array.isArray(playerIds)) {
      res.status(400).json({ message: "Body must include playerIds: string[]" });
      return;
    }

    const map = await valuationMapFor(ctx.league, ctx.draft);
    const valuations: unknown[] = [];

    for (const ref of playerIds) {
      const internalId = String(ref);
      const parsed = parsePlayerRef(internalId);

      if (parsed.kind === "custom") {
        valuations.push({
          internalId,
          mlbPlayerId: null,
          name: internalId.replace(/^MiLB-/i, "").replace(/-/g, " ") || "Custom player",
          mlbTeamId: null,
          dollarValue: 8,
        });
        continue;
      }

      const doc = await findPlayerByParsedRef(parsed);
      if (!doc) {
        valuations.push({
          internalId,
          mlbPlayerId: parsed.kind === "mlb" ? parsed.id : null,
          name: "Unknown player",
          mlbTeamId: null,
          dollarValue: 1,
        });
        continue;
      }

      const lean = doc as PlayerLean;
      const idStr = playerIdString(lean);
      const row = map.get(idStr);
      const dollarValue = row?.dollarValue ?? 1;

      valuations.push({
        internalId,
        mlbPlayerId: lean.mlbPlayerId ?? null,
        name: lean.name,
        mlbTeamId: lean.mlbTeamId ?? null,
        dollarValue,
      });
    }

    res.json({ valuations });
  } catch (e) {
    console.error("postValuationsBatch", e);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getValuationsAll(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await leagueDraftFromQuery(req.query.sessionId, { requireSession: true });
    if (!ctx.ok) {
      res.status(ctx.status).json({ message: ctx.message });
      return;
    }

    const position =
      typeof req.query.position === "string" && req.query.position.trim()
        ? req.query.position.trim()
        : undefined;
    const minValue =
      req.query.minValue !== undefined && req.query.minValue !== ""
        ? Number(req.query.minValue)
        : undefined;

    const all = (await PlayerModel.find({}).lean().exec()) as PlayerLean[];
    const pool = undraftedPlayers(all, ctx.draft.picks ?? []);
    const map = await valuationMapFor(ctx.league, ctx.draft);

    const valuations: unknown[] = [];
    for (const p of pool) {
      if (p.isEligible === false) continue;
      if (position && !p.positions.includes(position)) continue;

      const idStr = playerIdString(p);
      const row = map.get(idStr);
      if (!row) continue;
      if (minValue !== undefined && Number.isFinite(minValue) && row.dollarValue < minValue) {
        continue;
      }

      valuations.push({
        mlbPlayerId: p.mlbPlayerId ?? null,
        name: p.name,
        mlbTeamId: p.mlbTeamId ?? null,
        position: p.positions[0],
        positions: p.positions,
        mlbTeam: p.mlbTeam,
        dollarValue: row.dollarValue,
      });
    }

    res.json({
      eligibleCount: valuations.length,
      valuations,
    });
  } catch (e) {
    console.error("getValuationsAll", e);
    res.status(500).json({ message: "Internal server error" });
  }
}
