import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IDraftPick {
  pickNumber: number;
  round: number;
  teamName: string;
  playerId: string;
  playerName: string;
  mlbTeam: string;
  positions: string[];
  price: number;
  createdAt?: Date;
}

export interface ITeam {
  id: string;
  name: string;
}

export interface ILeague extends Document {
  userId: Types.ObjectId;
  leagueName: string;
  teamCount: number;
  budget: number;
  scoringType: string;
  categories: string[];
  teams: ITeam[];
  myTeamId: string;
  draftPicks: IDraftPick[];
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

const DraftPickSchema = new Schema<IDraftPick>(
  {
    pickNumber: { type: Number, required: true, min: 1 },
    round: { type: Number, required: true, min: 1 },
    teamName: { type: String, required: true, trim: true },
    playerId: { type: String, required: true, trim: true },
    playerName: { type: String, required: true, trim: true },
    mlbTeam: { type: String, default: "", trim: true },
    positions: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
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
    draftPicks: {
      type: [DraftPickSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const League: Model<ILeague> =
  mongoose.models.League || mongoose.model<ILeague>("League", LeagueSchema);
