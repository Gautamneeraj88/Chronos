import { GraphQLContext } from './query.resolvers';

export const subscriptionResolvers = {
  Subscription: {
    executionUpdated: {
      subscribe: async function* (
        _: unknown,
        { executionId }: { executionId: string },
        ctx: GraphQLContext,
      ) {
        let lastStatus: string | null = null;

        while (true) {
          const execution = await ctx.orchestratorClient.getExecution(executionId, ctx.orgId);
          const events = await ctx.orchestratorClient.getExecutionEvents(executionId, ctx.orgId);
          const full = { ...execution, events };

          if (execution.status !== lastStatus) {
            lastStatus = execution.status;
            yield { executionUpdated: full };
          }

          if (['COMPLETED', 'FAILED'].includes(execution.status)) break;

          await new Promise(r => setTimeout(r, 500));
        }
      },
    },
  },
};
