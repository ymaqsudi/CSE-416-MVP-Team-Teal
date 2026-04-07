import mongoose from "mongoose";

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    /** MLB Advanced Media player id (external key). */
    mlbPlayerId: { type: Number, sparse: true, unique: true },
    /** MLB Stats API team id */
    mlbTeamId: { type: Number },
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
    /** @deprecated SGP engine uses projections; kept for backward compatibility */
    baseValue: { type: Number, default: 10 },
    isEligible: { type: Boolean, default: true },
    projGames: { type: Number, default: 162 },
    /** Hitter 5×5 projections */
    projHR: { type: Number },
    projRBI: { type: Number },
    projR: { type: Number },
    projSB: { type: Number },
    projAVG: { type: Number },
    /** Pitcher 5×5 projections */
    projW: { type: Number },
    projERA: { type: Number },
    projWHIP: { type: Number },
    projK: { type: Number },
    projSV: { type: Number },
    projIP: { type: Number },
  },
  { timestamps: true }
);

export const PlayerModel = mongoose.model("Player", playerSchema);
