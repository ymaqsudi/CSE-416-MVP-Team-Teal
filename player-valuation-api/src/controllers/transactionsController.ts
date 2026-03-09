import { Request, Response } from "express";
import { TransactionModel } from "../models/Transaction.js";

type LeanPlayer = {
  _id: unknown;
  name?: string;
  mlbTeam?: string;
};

type LeanTransaction = {
  _id: unknown;
  playerId?: unknown | LeanPlayer;
  title: string;
  date: Date;
  source?: string;
};

export async function getTransactions(req: Request, res: Response): Promise<void> {
  try {
    const docs = await TransactionModel.find()
      .sort({ date: -1 })
      .limit(50)
      .populate("playerId", "name mlbTeam")
      .lean()
      .exec();

    const transactions = (docs as LeanTransaction[]).map((d) => {
      const player = d.playerId as LeanPlayer | undefined;

      return {
        id: String(d._id),
        playerId: player && player._id ? String(player._id) : undefined,
        playerName: player?.name,
        mlbTeam: player?.mlbTeam,
        title: d.title,
        date: new Date(d.date).toISOString(),
        source: d.source,
      };
    });

    res.json({ transactions });
  } catch (e) {
    console.error("getTransactions", e);
    res.status(500).json({ message: "Internal server error" });
  }
}
