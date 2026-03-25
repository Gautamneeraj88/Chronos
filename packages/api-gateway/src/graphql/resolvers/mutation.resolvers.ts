import { CreateWorkflowInput } from '@chronos/shared';
import { GraphQLContext } from './query.resolvers';

export const mutationResolvers = {
  Mutation: {
    registerWorkflow: async (
      _: unknown,
      { input }: { input: { name: string; steps: Record<string, unknown>[] } },
      ctx: GraphQLContext,
    ) => {
      // Inject type: 'activity' — all GraphQL-registered steps are activities;
      // clients don't set this field but the orchestrator schema requires it.
      const normalized: CreateWorkflowInput = {
        name: input.name,
        steps: input.steps.map((s) => ({ ...s, type: 'activity' as const })) as CreateWorkflowInput['steps'],
        orgId: ctx.orgId,
      };
      return ctx.orchestratorClient.createWorkflow(normalized, ctx.orgId);
    },

    triggerExecution: async (
      _: unknown,
      { input }: { input: { workflowId: string; input?: Record<string, unknown> } },
      ctx: GraphQLContext,
    ) => {
      const execution = await ctx.orchestratorClient.triggerExecution(
        input.workflowId,
        input.input ?? {},
        ctx.userId,
        ctx.orgId,
      );
      const events = await ctx.orchestratorClient.getExecutionEvents(execution.id, ctx.orgId);
      return { ...execution, events };
    },
  },
};
