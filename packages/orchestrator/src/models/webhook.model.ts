import mongoose, { Schema } from 'mongoose';

export interface WebhookDocument extends mongoose.Document {
  orgId: string;
  url: string;
  events: string[];
  secret: string | null;
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt: Date | null;
  createdAt: Date;
}

const WebhookSchema = new Schema<WebhookDocument>(
  {
    orgId:           { type: String, required: true },
    url:             { type: String, required: true },
    events:          [{ type: String }],
    secret:          { type: String, default: null },
    isActive:        { type: Boolean, default: true },
    failureCount:    { type: Number, default: 0 },
    lastTriggeredAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

WebhookSchema.index({ orgId: 1 });

export const WebhookModel =
  mongoose.models.Webhook ?? mongoose.model<WebhookDocument>('Webhook', WebhookSchema);
