import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IDraftPick extends Document {
  leagueId: Types.ObjectId;
  playerId: string;
  playerName: string;
  mlbTeam: string;
  positions: string[];
  teamName: string;
  price: number;
  pickNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const DraftPickSchema = new Schema<IDraftPick>(
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
    teamName: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    pickNumber: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const DraftPick: Model<IDraftPick> =
  mongoose.models.DraftPick ||
  mongoose.model<IDraftPick>("DraftPick", DraftPickSchema);
