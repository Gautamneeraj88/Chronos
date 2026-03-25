import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from './schema';
import { queryResolvers, mutationResolvers, subscriptionResolvers, GraphQLContext } from './resolvers';
import { IOrchestratorClient } from '../http';

type DateLike = Date | string | null | undefined;

function toISO(v: DateLike): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

// Field resolvers handle two concerns:
// 1. Date → ISO string serialisation (MongoDB returns Date objects)
// 2. Lazy `events` fetch for list queries that don't pre-load them
const fieldResolvers = {
  Workflow: {
    createdAt: (p: { createdAt: DateLike }) => toISO(p.createdAt),
  },
  Execution: {
    startedAt: (p: { startedAt: DateLike }) => toISO(p.startedAt),
    completedAt: (p: { completedAt: DateLike }) => toISO(p.completedAt),
    events: async (
      p: { id: string; events?: unknown[] },
      _: unknown,
      ctx: GraphQLContext,
    ) => {
      if (Array.isArray(p.events)) return p.events;
      return ctx.orchestratorClient.getExecutionEvents(p.id, ctx.orgId);
    },
  },
  ExecutionEvent: {
    occurredAt: (p: { occurredAt: DateLike }) => toISO(p.occurredAt),
  },
};

export function createYogaMiddleware(orchestratorClient: IOrchestratorClient) {
  const schema = createSchema<GraphQLContext>({
    typeDefs,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolvers: [queryResolvers, mutationResolvers, subscriptionResolvers, fieldResolvers] as any,
  });

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  return createYoga<{}, GraphQLContext>({
    schema,
    graphqlEndpoint: '/graphql',
    context: async ({ request }): Promise<GraphQLContext> => {
      const authHeader = request.headers.get('authorization') ?? '';
      const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const auth = rawKey ? await orchestratorClient.validateApiKey(rawKey) : null;
      return {
        orchestratorClient,
        orgId: auth?.orgId ?? '',
        userId: auth?.userId ?? '',
      };
    },
  });
}
