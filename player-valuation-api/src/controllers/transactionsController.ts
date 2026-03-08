import { Request, Response } from "express";
import { TransactionModel } from "../models/Transaction.js";

export async function getTransactions(req: Request, res: Response): Promise<void> {
  try {
    const docs = await TransactionModel.find()
      .sort({ date: -1 })
      .limit(50)
      .lean()
      .exec();
    const transactions = docs.map((d) => ({
      id: String((d as { _id: unknown })._id),
      playerId: (d as { playerId?: unknown }).playerId
        ? String((d as { playerId: { toString: () => string } }).playerId.toString())
        : undefined,
      title: (d as { title: string }).title,
      date: new Date((d as { date: Date }).date).toISOString(),
      source: (d as { source?: string }).source,
    }));
    res.json({ transactions });
  } catch (e) {
    console.error("getTransactions", e);
    res.status(500).json({ message: "Internal server error" });
  }
}
