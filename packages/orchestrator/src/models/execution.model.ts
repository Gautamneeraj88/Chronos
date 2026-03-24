import mongoose, { Schema } from 'mongoose';
import { Execution, ExecutionStatus } from '@chronos/shared';

export type ExecutionDocument = mongoose.HydratedDocument<Execution>;

const ExecutionSchema = new Schema<Execution>(
  {
    id: { type: String, required: true, unique: true },
    workflowId: { type: String, required: true },
    workflowVersion: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: [
        'PENDING',
        'RUNNING',
        'COMPLETED',
        'COMPENSATING',
        'FAILED',
      ] satisfies ExecutionStatus[],
      default: 'PENDING',
    },
    currentStepIndex: { type: Number, default: 0 },
    input: { type: Schema.Types.Mixed, default: {} },
    output: { type: Schema.Types.Mixed, default: {} },
    error: { type: String, default: null },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: false, // we manage startedAt/completedAt manually
    versionKey: false,
  },
);

// Index for RecoveryEngine — it queries by status on startup
ExecutionSchema.index({ status: 1 });
// Index for filtering by workflow
ExecutionSchema.index({ workflowId: 1 });

export const ExecutionModel =
  mongoose.models.Execution ?? mongoose.model<Execution>('Execution', ExecutionSchema);
