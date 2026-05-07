import mongoose, { Schema, Model, Document, Types } from "mongoose";
import type { Position, DepthRole, InjuryStatus } from "@/lib/shared/types";

export interface ICustomPlayer extends Document {
  leagueId: Types.ObjectId;
  createdBy: Types.ObjectId;
  name: string;
  mlbTeam?: string;
  positions: Position[];
  bats?: "R" | "L" | "S";
  throws?: "R" | "L";
  depthRole?: DepthRole;
  risk?: "Low" | "Med" | "High";
  age?: number;
  injuryStatus?: InjuryStatus | null;
  injuryNote?: string | null;
  injuryReturn?: string | null;
  isCustom: true;
  createdAt: Date;
  updatedAt: Date;
}

const CustomPlayerSchema = new Schema<ICustomPlayer>(
  {
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: "League",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mlbTeam: {
      type: String,
      trim: true,
      default: "",
    },
    positions: {
      type: [String],
      required: true,
      default: [],
    },
    bats: {
      type: String,
      enum: ["R", "L", "S"],
      default: undefined,
    },
    throws: {
      type: String,
      enum: ["R", "L"],
      default: undefined,
    },
    depthRole: {
      type: String,
      enum: ["Starter", "Backup", "Platoon", "Bench", "Minors", "Unknown"],
      default: "Unknown",
    },
    risk: {
      type: String,
      enum: ["Low", "Med", "High"],
      default: undefined,
    },
    age: {
      type: Number,
      default: undefined,
      min: 0,
    },
    injuryStatus: {
      type: String,
      enum: [
        "Active",
        "Day-to-Day",
        "10-Day IL",
        "15-Day IL",
        "60-Day IL",
        "Out for Season",
        "Suspended",
      ],
      default: null,
    },
    injuryNote: {
      type: String,
      default: null,
    },
    injuryReturn: {
      type: String,
      default: null,
    },
    isCustom: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

CustomPlayerSchema.index({ leagueId: 1, name: 1 });

export const CustomPlayer: Model<ICustomPlayer> =
  mongoose.models.CustomPlayer ||
  mongoose.model<ICustomPlayer>("CustomPlayer", CustomPlayerSchema);