import mongoose, { Schema } from 'mongoose';
import { DomainEvent, DomainEventType } from '@chronos/shared';

export type EventDocument = mongoose.HydratedDocument<DomainEvent>;

const EventSchema = new Schema<DomainEvent>(
  {
    id: { type: String, required: true, unique: true },
    executionId: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'EXECUTION_STARTED',
        'EXECUTION_COMPLETED',
        'EXECUTION_FAILED',
        'STEP_STARTED',
        'STEP_COMPLETED',
        'STEP_FAILED',
        'COMPENSATION_STARTED',
        'COMPENSATION_COMPLETED',
      ] satisfies DomainEventType[],
      required: true,
    },
    stepName: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true },
  },
  {
    // No timestamps — occurredAt is our timestamp, set explicitly
    // This matters for event replay — we control the ordering
    timestamps: false,
    versionKey: false,
  },
);

// This is the most important index in the whole database
// RecoveryEngine and SagaEngine both query by executionId sorted by occurredAt
// Without this index, event replay gets slower as the log grows
EventSchema.index({ executionId: 1, occurredAt: 1 });

export const EventModel =
  mongoose.models.Event ?? mongoose.model<DomainEvent>('Event', EventSchema);
