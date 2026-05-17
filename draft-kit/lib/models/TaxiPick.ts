import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface ITaxiPick extends Document {
  leagueId: Types.ObjectId;
  playerId: string;
  playerName: string;
  mlbTeam: string;
  positions: string[];
  teamId: string;
  teamName: string;
  slotIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const TaxiPickSchema = new Schema<ITaxiPick>(
  {
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: "League",
      required: true,
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
    teamId: {
      type: String,
      required: true,
      trim: true,
    },
    teamName: {
      type: String,
      required: true,
      trim: true,
    },
    slotIndex: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

TaxiPickSchema.index({ leagueId: 1, playerId: 1 }, { unique: true });
TaxiPickSchema.index({ leagueId: 1, teamId: 1, slotIndex: 1 }, { unique: true });

export const TaxiPick: Model<ITaxiPick> =
  mongoose.models.TaxiPick ||
  mongoose.model<ITaxiPick>("TaxiPick", TaxiPickSchema);
