import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IRoster extends Document {
  leagueId: Types.ObjectId;
  teamName: string;
  playerId: string;
  playerName: string;
  mlbTeam: string;
  positions: string[];
  position: string; // The roster slot position (C, 1B, 2B, etc.)
  price: number;
  assignedAt: Date;
  assignedBy: Types.ObjectId; // User who made the assignment
}

const RosterSchema = new Schema<IRoster>(
  {
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: "League",
      required: true,
    },
    teamName: {
      type: String,
      required: true,
      trim: true,
    },
    playerId: {
      type: String,
      required: true,
    },
    playerName: {
      type: String,
      required: true,
      trim: true,
    },
    mlbTeam: {
      type: String,
      required: true,
    },
    positions: {
      type: [String],
      default: [],
    },
    position: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique player assignments per league/team/position
RosterSchema.index({ leagueId: 1, teamName: 1, position: 1 }, { unique: true });

export const Roster: Model<IRoster> =
  mongoose.models.Roster || mongoose.model<IRoster>("Roster", RosterSchema);