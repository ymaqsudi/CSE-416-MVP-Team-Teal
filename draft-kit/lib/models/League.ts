import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface ITeam {
  id: string;
  name: string;
}

export interface ILeague extends Document {
  userId: Types.ObjectId;
  leagueName: string;
  teamCount: number;
  budget: number;
  mainRosterSlots: number;
  scoringType: string;
  categories: string[];
  teams: ITeam[];
  myTeamId: string;
  scope: "MLB" | "AL" | "NL";
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { _id: false }
);

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
    mainRosterSlots: {
      type: Number,
      required: true,
      min: 1,
      default: 23,
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
    teams: {
      type: [TeamSchema],
      default: [],
    },
    myTeamId: {
      type: String,
      default: "",
    },
    scope: {
      type: String,
      enum: ["MLB", "AL", "NL"],
      default: "MLB",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const League: Model<ILeague> =
  mongoose.models.League || mongoose.model<ILeague>("League", LeagueSchema);
