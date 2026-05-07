import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IPlayerNote extends Document {
  leagueId: Types.ObjectId;
  playerId: string;
  playerName: string;
  note: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerNoteSchema = new Schema<IPlayerNote>(
  {
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: "League",
      required: true,
      index: true,
    },
    playerId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    playerName: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
      default: "",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

PlayerNoteSchema.index({ leagueId: 1, playerId: 1 }, { unique: true });

export const PlayerNote: Model<IPlayerNote> =
  mongoose.models.PlayerNote ||
  mongoose.model<IPlayerNote>("PlayerNote", PlayerNoteSchema);