import mongoose, { Schema, Model, Document } from "mongoose";

export interface IDeveloperAccount extends Document {
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeveloperAccountSchema = new Schema<IDeveloperAccount>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export const DeveloperAccount: Model<IDeveloperAccount> =
  mongoose.models.DeveloperAccount ||
  mongoose.model<IDeveloperAccount>("DeveloperAccount", DeveloperAccountSchema);
