import mongoose, { Schema } from 'mongoose';
import { Execution, ExecutionStatus } from '@chronos/shared';

export type ExecutionDocument = mongoose.HydratedDocument<Execution>;

const ExecutionSchema = new Schema<Execution>(
  {
    id: { type: String, required: true, unique: true },
    orgId: { type: String, required: true },
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
        'DLQ',
      ] satisfies ExecutionStatus[],
      default: 'PENDING',
    },
    currentStepIndex: { type: Number, default: 0 },
    input: { type: Schema.Types.Mixed, default: {} },
    output: { type: Schema.Types.Mixed, default: {} },
    error: { type: String, default: null },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    dlqAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: false, // we manage startedAt/completedAt manually
    versionKey: false,
  },
);

// Existing single-field indexes
ExecutionSchema.index({ status: 1 });           // RecoveryEngine — queries by status on startup
ExecutionSchema.index({ workflowId: 1 });       // filter by workflow
ExecutionSchema.index({ orgId: 1 });            // org-scoped queries
// Compound indexes for list queries (Phase 11 — eliminates collection scans)
ExecutionSchema.index({ orgId: 1, createdAt: -1 });   // list by org sorted by date (primary list path)
ExecutionSchema.index({ orgId: 1, status: 1 });       // filter by status within org
ExecutionSchema.index({ workflowId: 1, orgId: 1 });   // filter by workflow within org

export const ExecutionModel =
  mongoose.models.Execution ?? mongoose.model<Execution>('Execution', ExecutionSchema);
