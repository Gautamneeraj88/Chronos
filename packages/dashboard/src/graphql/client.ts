import { GraphQLClient } from 'graphql-request';
import { getStoredSession } from '../api/client';

const GQL_ENDPOINT = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/graphql';

export function getGqlClient(): GraphQLClient {
  const session = getStoredSession();
  return new GraphQLClient(GQL_ENDPOINT, {
    headers: session?.token
      ? { Authorization: `Bearer ${session.token}` }
      : {},
  });
}
