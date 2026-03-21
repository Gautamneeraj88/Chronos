import mongoose, { Schema } from 'mongoose';
import { WorkflowDefinition, WorkflowStep } from '@chronos/shared';

// Modern Mongoose 6+ pattern: HydratedDocument adds Document methods without type conflicts
export type WorkflowDocument = mongoose.HydratedDocument<WorkflowDefinition>;

const WorkflowStepSchema = new Schema<WorkflowStep>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['activity'], default: 'activity' },
    retries: { type: Number, default: 3 },
    timeoutMs: { type: Number, default: 5000 },
    compensation: { type: String, default: null },
  },
  {
    _id: false, // steps don't need their own _id
  },
);

const WorkflowSchema = new Schema<WorkflowDefinition>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    version: { type: Number, default: 1 },
    steps: { type: [WorkflowStepSchema], required: true },
  },
  {
    timestamps: true, //auto-manages createdAt + updatedAt
    versionKey: false,
  },
);

// INFO: Prevent model re-registration error when tests hot-reload
export const WorkflowModel =
  mongoose.models.Workflow ?? mongoose.model<WorkflowDefinition>('Workflow', WorkflowSchema);
