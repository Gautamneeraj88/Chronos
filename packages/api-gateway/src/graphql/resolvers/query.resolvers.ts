import { IOrchestratorClient } from "../../http";

export interface GraphQLContext {
  orchestratorClient: IOrchestratorClient;
  orgId: string;
  userId: string;
}

export const queryResolvers = {
  Query: {
    workflow: async (_:unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      return ctx.orchestratorClient.getWorkflow(id, ctx.orgId);
    },

    workflows: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      return ctx.orchestratorClient.listWorkflows(ctx.orgId);
    },

    execution: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const execution = await ctx.orchestratorClient.getExecution(id, ctx.orgId);
      const events = await ctx.orchestratorClient.getExecutionEvents(id, ctx.orgId);
      return { ...execution, events };
    },

    executions: async (
      _: unknown,
      { status }: { status?: string },
      ctx: GraphQLContext,
    ) => {
      const all = await ctx.orchestratorClient.listExecutions(ctx.orgId, status);
      return all;
    },
  },
};
