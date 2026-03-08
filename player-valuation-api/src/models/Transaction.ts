import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    title: { type: String, required: true },
    date: { type: Date, required: true },
    source: { type: String, default: null },
  },
  { timestamps: true }
);

export const TransactionModel = mongoose.model("Transaction", transactionSchema);
