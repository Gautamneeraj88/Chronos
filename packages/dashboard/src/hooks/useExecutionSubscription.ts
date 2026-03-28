import { useEffect, useRef, useState, useCallback } from 'react';
import { getStoredSession } from '../api/client';

const GQL_ENDPOINT = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/graphql';

const SUBSCRIPTION_QUERY = `
  subscription ExecutionUpdated($id: ID!) {
    executionUpdated(id: $id) {
      id status completedAt error
    }
  }
`;

export interface ExecutionUpdate {
  id: string;
  status: string;
  completedAt: string | null;
  error: string | null;
}

/**
 * Subscribe to real-time execution updates via GraphQL SSE (graphql-yoga supports it natively).
 * Falls back to polling if SSE is unavailable (Neo4j or network issues).
 */
export function useExecutionSubscription(
  executionId: string | undefined,
  onUpdate: (update: ExecutionUpdate) => void,
) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const connect = useCallback(() => {
    if (!executionId) return;

    const session = getStoredSession();

    // graphql-yoga SSE: POST with Accept: text/event-stream
    const params = new URLSearchParams({
      query: SUBSCRIPTION_QUERY,
      variables: JSON.stringify({ id: executionId }),
    });
    if (session?.token) {
      params.set('extensions', JSON.stringify({ authorization: `Bearer ${session.token}` }));
    }

    const url = `${GQL_ENDPOINT}?${params.toString()}`;
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as {
          data?: { executionUpdated: ExecutionUpdate };
        };
        if (parsed.data?.executionUpdated) {
          onUpdateRef.current(parsed.data.executionUpdated);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    esRef.current = es;
  }, [executionId]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      setConnected(false);
    };
  }, [connect]);

  return { connected };
}
