import mongoose from "mongoose";

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mlbTeam: { type: String, required: true },
    positions: [{ type: String, required: true }],
    bats: { type: String, enum: ["R", "L", "S"], default: null },
    throws: { type: String, enum: ["R", "L"], default: null },
    depthRole: {
      type: String,
      enum: ["Starter", "Backup", "Platoon", "Bench", "Minors", "Unknown"],
      default: "Unknown",
    },
    risk: { type: String, enum: ["Low", "Med", "High"], default: "Med" },
    /** Stored base value for simple MVP valuation logic */
    baseValue: { type: Number, required: true, default: 10 },
    isEligible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PlayerModel = mongoose.model("Player", playerSchema);
