import mongoose, { Schema } from 'mongoose';

export interface ApiKeyDocument extends mongoose.Document {
  key: string;       // bcrypt hash of the raw key
  orgId: string;
  userId: string;    // owner
  name: string;      // human-readable label
  createdAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
}

const ApiKeySchema = new Schema<ApiKeyDocument>(
  {
    key: { type: String, required: true, unique: true },
    orgId: { type: String, required: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    lastUsedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

ApiKeySchema.index({ orgId: 1 });

export const ApiKeyModel =
  mongoose.models.ApiKey ?? mongoose.model<ApiKeyDocument>('ApiKey', ApiKeySchema);
