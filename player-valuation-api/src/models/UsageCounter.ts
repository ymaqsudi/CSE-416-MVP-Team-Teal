import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IUsageCounter extends Document {
  keyId: Types.ObjectId;
  windowStart: Date;
  count: number;
  expiresAt: Date;
}

const UsageCounterSchema = new Schema<IUsageCounter>(
  {
    keyId: {
      type: Schema.Types.ObjectId,
      ref: "ApiKey",
      required: true,
    },
    windowStart: {
      type: Date,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

UsageCounterSchema.index({ keyId: 1, windowStart: 1 }, { unique: true });
UsageCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UsageCounter: Model<IUsageCounter> =
  mongoose.models.UsageCounter ||
  mongoose.model<IUsageCounter>("UsageCounter", UsageCounterSchema);
