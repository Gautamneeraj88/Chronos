import { Request } from 'express';
import { IOrchestratorClient } from '../http';
import { GraphQLContext } from './resolvers/query.resolvers';

export async function buildContext(
  req: Request,
  orchestratorClient: IOrchestratorClient,
): Promise<GraphQLContext> {
  const authHeader = req.headers.authorization ?? '';
  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  const auth = rawKey ? await orchestratorClient.validateApiKey(rawKey) : null;

  return {
    orchestratorClient,
    orgId: auth?.orgId ?? '',
    userId: auth?.userId ?? '',
  };
}
