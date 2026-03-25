import neo4j from 'neo4j-driver';

/** Convert a Neo4j Integer (or plain number) to a JS number. */
export function toNumber(value: unknown): number {
  if (neo4j.isInt(value)) {
    return neo4j.integer.toNumber(value as Parameters<typeof neo4j.integer.toNumber>[0]);
  }
  return (value as number) ?? 0;
}
