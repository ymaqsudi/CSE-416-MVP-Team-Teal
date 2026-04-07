import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface ILeague extends Document {
  userId: Types.ObjectId;
  leagueName: string;
  teamCount: number;
  budget: number;
  scoringType: string;
  categories: string[];
  createdAt: Date;
  updatedAt: Date;
}

const LeagueSchema = new Schema<ILeague>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    leagueName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    teamCount: {
      type: Number,
      required: true,
      min: 2,
    },
    budget: {
      type: Number,
      required: true,
      min: 1,
    },
    scoringType: {
      type: String,
      required: true,
      default: "rotisserie",
    },
    categories: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const League: Model<ILeague> =
  mongoose.models.League || mongoose.model<ILeague>("League", LeagueSchema);

