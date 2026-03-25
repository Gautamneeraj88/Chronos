import { createLogger } from '@chronos/shared';
import { Neo4jClient, toNumber } from '@chronos/neo4j';

const logger = createLogger('orchestrator');

export interface WorkflowMatch {
  id: string;
  name: string;
  orgId: string;
}

export interface StepFailureStat {
  step: string;
  activity: string;
  failureCount: number;
}

export interface StepBottleneck {
  step: string;
  activity: string;
  avgDurationMs: number;
  maxDurationMs: number;
  executionCount: number;
}

export interface StepExecutionRecord {
  step: string;
  status: string;
  attemptNumber: number;
  durationMs: number;
  occurredAt: string;
}

export interface ActivityImpact {
  workflowName: string;
  step: string;
  compensatedBy: string;
}

/**
 * GraphQueryService — run analytical Cypher queries against the Neo4j graph.
 *
 * Each method returns plain JS objects (no Neo4j Integer types exposed).
 * Sessions are always closed in a finally block.
 */
export class GraphQueryService {
  constructor(private readonly neo4j: Neo4jClient) {}

  /** Workflows that share a given activity name. */
  async workflowsByActivity(activityName: string): Promise<WorkflowMatch[]> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `MATCH (w:Workflow)-[:HAS_STEP]->(s:Step)-[:RUNS_ACTIVITY]->(a:Activity { name: $activityName })
         RETURN DISTINCT w.id AS id, w.name AS name, w.orgId AS orgId`,
        { activityName },
      );
      return result.records.map((r) => ({
        id: r.get('id') as string,
        name: r.get('name') as string,
        orgId: r.get('orgId') as string,
      }));
    } catch (err) {
      logger.error('GraphQueryService: workflowsByActivity failed', { activityName, err });
      return [];
    } finally {
      await session.close();
    }
  }

  /** Most common failure paths for an org (top 10 failed steps). */
  async failurePaths(orgId: string): Promise<StepFailureStat[]> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `MATCH (e:Execution { orgId: $orgId })-[r:EXECUTED_STEP { status: 'FAILED' }]->(s:Step)
         RETURN s.name AS step, s.activity AS activity, count(r) AS failureCount
         ORDER BY failureCount DESC
         LIMIT 10`,
        { orgId },
      );
      return result.records.map((r) => ({
        step: r.get('step') as string,
        activity: r.get('activity') as string,
        failureCount: toNumber(r.get('failureCount')),
      }));
    } catch (err) {
      logger.error('GraphQueryService: failurePaths failed', { orgId, err });
      return [];
    } finally {
      await session.close();
    }
  }

  /** Slowest steps by average duration for an org (top 10). */
  async bottlenecks(orgId: string): Promise<StepBottleneck[]> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `MATCH (e:Execution { orgId: $orgId })-[r:EXECUTED_STEP { status: 'COMPLETED' }]->(s:Step)
         RETURN s.name AS step, s.activity AS activity,
                avg(r.durationMs) AS avgDurationMs,
                max(r.durationMs) AS maxDurationMs,
                count(r) AS executionCount
         ORDER BY avgDurationMs DESC
         LIMIT 10`,
        { orgId },
      );
      return result.records.map((r) => ({
        step: r.get('step') as string,
        activity: r.get('activity') as string,
        avgDurationMs: (r.get('avgDurationMs') as number) ?? 0,
        maxDurationMs: toNumber(r.get('maxDurationMs')),
        executionCount: toNumber(r.get('executionCount')),
      }));
    } catch (err) {
      logger.error('GraphQueryService: bottlenecks failed', { orgId, err });
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Which workflows and steps are affected if an activity fails —
   * specifically showing which steps compensate for steps that run that activity.
   */
  async activityDependencyImpact(activityName: string): Promise<ActivityImpact[]> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `MATCH (w:Workflow)-[:HAS_STEP]->(s:Step)-[:RUNS_ACTIVITY]->(a:Activity { name: $activityName })
         MATCH (s2:Step)-[:COMPENSATES_WITH]->(s)
         RETURN w.name AS workflowName, s.name AS step, s2.name AS compensatedBy`,
        { activityName },
      );
      return result.records.map((r) => ({
        workflowName: r.get('workflowName') as string,
        step: r.get('step') as string,
        compensatedBy: r.get('compensatedBy') as string,
      }));
    } catch (err) {
      logger.error('GraphQueryService: activityDependencyImpact failed', { activityName, err });
      return [];
    } finally {
      await session.close();
    }
  }

  /** All steps executed in a specific execution, ordered by time. */
  async executionGraph(executionId: string): Promise<StepExecutionRecord[]> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `MATCH (e:Execution { id: $executionId })-[r:EXECUTED_STEP]->(s:Step)
         RETURN s.name AS step,
                r.status AS status,
                r.attemptNumber AS attemptNumber,
                r.durationMs AS durationMs,
                r.occurredAt AS occurredAt
         ORDER BY r.occurredAt`,
        { executionId },
      );
      return result.records.map((r) => ({
        step: r.get('step') as string,
        status: r.get('status') as string,
        attemptNumber: toNumber(r.get('attemptNumber')),
        durationMs: toNumber(r.get('durationMs')),
        occurredAt: r.get('occurredAt') as string,
      }));
    } catch (err) {
      logger.error('GraphQueryService: executionGraph failed', { executionId, err });
      return [];
    } finally {
      await session.close();
    }
  }
}
