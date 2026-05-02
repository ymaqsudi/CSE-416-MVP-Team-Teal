import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IApiKey extends Document {
  developerId: Types.ObjectId;
  prefix: string;
  keyHash: string;
  label: string;
  allowedIps: string[];
  rateLimit: {
    windowSec: number;
    max: number;
  };
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    developerId: {
      type: Schema.Types.ObjectId,
      ref: "DeveloperAccount",
      required: true,
      index: true,
    },
    prefix: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    keyHash: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    allowedIps: {
      type: [String],
      default: [],
    },
    rateLimit: {
      windowSec: { type: Number, required: true, default: 60 },
      max: { type: Number, required: true, default: 60 },
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const ApiKey: Model<IApiKey> =
  mongoose.models.ApiKey || mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
