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
  rosterSlots: Record<string, number>;
  taxiSlots: number;
  taxiDraftOrder: string[];
  valuationSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SUPPORTED_ROSTER_SLOTS = [
  "C", "1B", "2B", "3B", "SS", "CI", "MI", "OF", "UTIL", "P",
] as const;

export function defaultRosterSlots(): Record<string, number> {
  return {
    C: 2, "1B": 1, "2B": 1, "3B": 1, SS: 1,
    CI: 1, MI: 1, OF: 5, UTIL: 1, P: 9,
  };
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
    rosterSlots: {
      type: Schema.Types.Mixed,
      default: () => defaultRosterSlots(),
    },
    taxiSlots: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxiDraftOrder: {
      type: [String],
      default: [],
    },
    valuationSessionId: {
      type: String,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

LeagueSchema.pre("save", function (next) {
  const slots = (this.rosterSlots ?? {}) as Record<string, number>;
  const total = Object.values(slots).reduce(
    (sum, n) => sum + (Number.isFinite(Number(n)) ? Number(n) : 0),
    0,
  );
  if (total > 0) this.mainRosterSlots = total;
  next();
});

export const League: Model<ILeague> =
  mongoose.models.League || mongoose.model<ILeague>("League", LeagueSchema);
