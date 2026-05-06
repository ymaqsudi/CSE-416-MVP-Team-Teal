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
    /** Age */
    age: { type: Number },
    /** Injury */
    injuryStatus: {
      type: String,
      enum: ["Active", "Day-to-Day", "10-Day IL", "15-Day IL", "60-Day IL", "Out for Season", "Suspended"],
      default: null,
    },
    injuryNote:   { type: String, default: null },
    injuryReturn: { type: Date,   default: null },
    /** 2025 actual stats — hitters */
    prevGames: { type: Number },
    prevHR:    { type: Number },
    prevRBI:   { type: Number },
    prevR:     { type: Number },
    prevSB:    { type: Number },
    prevAVG:   { type: Number },
    /** 2025 actual stats — pitchers */
    prevW:    { type: Number },
    prevERA:  { type: Number },
    prevWHIP: { type: Number },
    prevK:    { type: Number },
    prevSV:   { type: Number },
    prevIP:   { type: Number },
    /** Baseball Savant Statcast — hitters (2025) */
    xba:           { type: Number },
    xslg:          { type: Number },
    xwoba:         { type: Number },
    barrelPct:     { type: Number },
    hardHitPct:    { type: Number },
    exitVelo:      { type: Number },
    kPct:          { type: Number },
    bbPct:         { type: Number },
    sprintSpeed:   { type: Number },
    /** Baseball Savant Statcast — pitchers (2025) */
    xera:              { type: Number },
    whiffPct:          { type: Number },
    barrelPctAgainst:  { type: Number },
    hardHitPctAgainst: { type: Number },
    exitVeloAgainst:   { type: Number },
  },
  { timestamps: true }
);

export const PlayerModel = mongoose.model("Player", playerSchema);
