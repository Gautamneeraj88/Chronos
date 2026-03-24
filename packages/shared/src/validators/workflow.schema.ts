import { z } from 'zod';
import { DEFAULT_RETRIES, DEFAULT_TIMEOUT_MS, MAX_STEPS } from '../constants';

export const WorkflowStepSchema = z.object({
  name: z
    .string()
    .min(1, 'Step name cannot be empty')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Step name must be lowercase letters, numbers, and hyphens only'),

  type: z.literal('activity'),

  activity: z.string().min(1, 'Activity name cannot be empty'),

  retries: z.number().int().min(0).max(10).default(DEFAULT_RETRIES),

  timeoutMs: z.number().int().min(100).max(300_000).default(DEFAULT_TIMEOUT_MS),

  compensation: z.string().min(1).nullable().default(null),
});

export const CreateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, 'Workflow name cannot be empty')
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Workflow name must be lowercase letters, numbers, and hyphens only'),

  steps: z
    .array(WorkflowStepSchema)
    .min(1, 'Workflow must have at least one step')
    .max(MAX_STEPS, `Workflow cannot have more than ${MAX_STEPS} steps`),
});

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;
export type WorkflowStepInput = z.infer<typeof WorkflowStepSchema>;
