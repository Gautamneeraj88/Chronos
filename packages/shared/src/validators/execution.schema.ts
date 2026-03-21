import { z } from 'zod';

// Schema for triggering an execution (POST /workflows/:id/execution body)
export const TriggerExecutionSchema = z.object({
  //Input is arbitrary JSON the workflow steps can read
  //Record<string, unknown> = any object, but not primitives/arrays at top level
  input: z.record(z.unknown()).default({}),
});

export type TriggerExecutionInput = z.infer<typeof TriggerExecutionSchema>;
