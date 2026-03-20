import { z } from 'zod';
import { DEFAULT_RETERIES, DEFAULT_TIMEOUT_MS, MAX_STEPS } from '../constants';

// INFO: Schema for a single step inside a workflow definiton
export const WorkflowStepSchema = z.object({
  //INFO: Only allow lowercase letters, numbers, hyphens e.g. "charge-card" is valid, "Charge Card!" is not
  name: z
    .string()
    .min(1, 'Step name cannot be empty')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Step name must be lowercase letters, numbers, and hyphens only'),
  type: z.literal('activity'), // INFO: only 'activity exists in phase 1'

  retries: z.number().int().min(0).max(10).default(DEFAULT_RETERIES),

  timeoutMs: z.number().int().min(100).max(300000).default(DEFAULT_TIMEOUT_MS),

  compensation: z.string().min(1).nullable().default(null),
});

// INFO: Schema for registering a new workflow (POST / Workflows body)
export const CreateWorkFlowSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Workflow name cannot be empty')
      .max(200)
      .regex(/^[a-z0-9-]+$/, 'Workflow name must be lowercase letters, numbers, and hyphens only'),

    steps: z
      .array(WorkflowStepSchema)
      .min(1, 'Workflow must have at least one step')
      .max(MAX_STEPS, `Workflow cannot have more than ${MAX_STEPS} steps`),
  })
  .refine(
    // Custom validation: if a step references a compensation, that compensation
    // name must match another step's name in the same workflow
    (data) => {
      const stepNames = new Set(data.steps.map((s) => s.name));
      for (const step of data.steps) {
        if (step.compensation && !stepNames.has(step.compensation)) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Each compensation must reference a valid step name in the same workflow',
    },
  );

// TypeScript types inferred directly from the schemas
// No need to define these separately — Zod derives them
export type CreateWorkflowInput = z.infer<typeof CreateWorkFlowSchema>;
export type WorkflowStepInput = z.infer<typeof WorkflowStepSchema>;
