import { GraphQLContext } from './query.resolvers';

export const mutationResolvers = {
  Mutation: {
    registerWorkflow: async (
      _: unknown,
      { input }: { input: { name: string; steps: unknown[] } },
      ctx: GraphQLContext,
    ) => {
      return ctx.orchestratorClient.createWorkflow(input as any, ctx.orgId);
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
