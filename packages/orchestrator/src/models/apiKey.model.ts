import mongoose, { Schema } from 'mongoose';

export interface ApiKeyDocument extends mongoose.Document {
  key: string;       // bcrypt hash of the raw key
  keyPrefix: string; // first 8 chars of the random part — plaintext for fast lookup
  orgId: string;
  userId: string;    // owner
  name: string;      // human-readable label
  createdAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
}

const ApiKeySchema = new Schema<ApiKeyDocument>(
  {
    key:       { type: String, required: true, unique: true },
    keyPrefix: { type: String, required: true },
    orgId:     { type: String, required: true },
    userId:    { type: String, required: true },
    name:      { type: String, required: true },
    lastUsedAt: { type: Date, default: null },
    isActive:  { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

ApiKeySchema.index({ orgId: 1 });
ApiKeySchema.index({ keyPrefix: 1 }); // O(1) prefix filter before bcrypt compare

export const ApiKeyModel =
  mongoose.models.ApiKey ?? mongoose.model<ApiKeyDocument>('ApiKey', ApiKeySchema);
