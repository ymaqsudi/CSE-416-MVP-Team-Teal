import mongoose from "mongoose";

const pickSchema = new mongoose.Schema(
  {
    mlbPlayerId: { type: Number, required: false },
    playerId: { type: String, required: false },
    teamInLeagueId: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    league: {
      numTeams: { type: Number, required: true },
      budget: { type: Number, required: true },
      scoring: { type: String, default: "5x5" },
      rosterSlotsPerTeam: { type: mongoose.Schema.Types.Mixed, default: undefined },
    },
    draftState: {
      picks: { type: [pickSchema], default: [] },
      budgetsRemaining: { type: [Number], default: [] },
    },
  },
  { timestamps: true }
);

export const SessionModel = mongoose.model("Session", sessionSchema);
