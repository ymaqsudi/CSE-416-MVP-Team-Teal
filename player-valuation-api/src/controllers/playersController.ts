import { Request, Response } from "express";
import { PlayerModel } from "../models/Player.js";
import { computeValuation } from "../lib/valuation.js";

function toPlayer(doc: { _id: unknown; name: string; mlbTeam: string; positions: string[]; bats?: string; throws?: string; depthRole?: string; risk?: string }) {
  return {
    id: String(doc._id),
    name: doc.name,
    mlbTeam: doc.mlbTeam,
    positions: doc.positions,
    ...(doc.bats && { bats: doc.bats as "R" | "L" | "S" }),
    ...(doc.throws && { throws: doc.throws as "R" | "L" }),
    ...(doc.depthRole && { depthRole: doc.depthRole }),
    ...(doc.risk && { risk: doc.risk as "Low" | "Med" | "High" }),
  };
}

export async function getPlayers(req: Request, res: Response): Promise<void> {
  try {
    const { q, position, limit } = req.query;
    let query: Record<string, unknown> = {};

    if (typeof q === "string" && q.trim()) {
      query.$or = [
        { name: { $regex: q.trim(), $options: "i" } },
        { mlbTeam: { $regex: q.trim(), $options: "i" } },
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
    const players = docs.map((d) => toPlayer(d as Parameters<typeof toPlayer>[0]));
    res.json({ players });
  } catch (e) {
    console.error("getPlayers", e);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getPlayerById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const doc = await PlayerModel.findById(id).lean().exec();
    if (!doc) {
      res.status(404).json({ message: "Player not found" });
      return;
    }
    res.json({ player: toPlayer(doc as Parameters<typeof toPlayer>[0]) });
  } catch (e) {
    console.error("getPlayerById", e);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getValuation(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const player = await PlayerModel.findById(id).lean().exec();
    if (!player) {
      res.status(404).json({ message: "Player not found" });
      return;
    }
    const { dollarValue, explanation } = await computeValuation(id);
    res.json({
      valuation: {
        playerId: id,
        dollarValue,
        updatedAt: new Date().toISOString(),
        explanation,
      },
    });
  } catch (e) {
    console.error("getValuation", e);
    res.status(500).json({ message: "Internal server error" });
  }
}
