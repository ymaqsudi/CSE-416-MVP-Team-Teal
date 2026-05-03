import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IUsageLog extends Document {
  keyId: Types.ObjectId;
  developerId: Types.ObjectId;
  ip: string;
  path: string;
  status: number;
  ts: Date;
}

const UsageLogSchema = new Schema<IUsageLog>(
  {
    keyId: {
      type: Schema.Types.ObjectId,
      ref: "ApiKey",
      required: true,
      index: true,
    },
    developerId: {
      type: Schema.Types.ObjectId,
      ref: "DeveloperAccount",
      required: true,
      index: true,
    },
    ip: { type: String, required: true },
    path: { type: String, required: true },
    status: { type: Number, required: true },
    ts: { type: Date, default: Date.now, required: true },
  },
  {
    capped: { size: 5_242_880, max: 10_000 },
    versionKey: false,
    timestamps: false,
  }
);

export const UsageLog: Model<IUsageLog> =
  mongoose.models.UsageLog ||
  mongoose.model<IUsageLog>("UsageLog", UsageLogSchema);
