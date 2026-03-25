import { WorkflowDefinition, Execution, createLogger } from '@chronos/shared';
import { Neo4jClient } from '@chronos/neo4j';

const logger = createLogger('orchestrator');

/**
 * WorkflowGraphService — syncs workflow definitions and execution data to Neo4j.
 *
 * Graph model:
 *   (:Workflow { id, name, orgId, version, createdAt })
 *   (:Step     { id, name, activity, retries, timeoutMs })
 *   (:Activity { name })
 *   (:Execution { id, orgId, status, startedAt, completedAt })
 *
 *   (:Workflow)-[:HAS_STEP { order }]->(:Step)
 *   (:Step)-[:RUNS_ACTIVITY]->(:Activity)
 *   (:Step)-[:COMPENSATES_WITH]->(:Step)
 *   (:Execution)-[:RUNS]->(:Workflow)
 *   (:Execution)-[:EXECUTED_STEP { status, attemptNumber, durationMs, occurredAt }]->(:Step)
 *
 * All writes are fire-and-forget — Neo4j is a secondary store.
 * MongoDB is always the source of truth.
 */
export class WorkflowGraphService {
  constructor(private readonly neo4j: Neo4jClient) {}

  /**
   * Upsert a workflow and all its steps/activities into Neo4j.
   * Called on workflow registration. Uses MERGE to stay idempotent.
   */
  async syncWorkflow(workflow: WorkflowDefinition): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.executeWrite(async (tx) => {
        // Upsert Workflow node
        await tx.run(
          `MERGE (w:Workflow { id: $id })
           SET w.name = $name,
               w.orgId = $orgId,
               w.version = $version,
               w.createdAt = $createdAt`,
          {
            id: workflow.id,
            name: workflow.name,
            orgId: workflow.orgId,
            version: workflow.version,
            createdAt: workflow.createdAt.toISOString(),
          },
        );

        // Upsert each Step + Activity and the HAS_STEP relationship
        for (let i = 0; i < workflow.steps.length; i++) {
          const step = workflow.steps[i];
          const stepNodeId = `${workflow.id}:${step.name}`;

          await tx.run(
            `MERGE (s:Step { id: $stepId })
             SET s.name = $stepName,
                 s.activity = $activity,
                 s.retries = $retries,
                 s.timeoutMs = $timeoutMs
             MERGE (a:Activity { name: $activity })
             MERGE (s)-[:RUNS_ACTIVITY]->(a)
             WITH s
             MATCH (w:Workflow { id: $workflowId })
             MERGE (w)-[:HAS_STEP { order: $order }]->(s)`,
            {
              stepId: stepNodeId,
              stepName: step.name,
              activity: step.activity,
              retries: step.retries,
              timeoutMs: step.timeoutMs,
              workflowId: workflow.id,
              order: i,
            },
          );

          // Wire compensation relationship if present
          if (step.compensation) {
            const compNodeId = `${workflow.id}:${step.compensation}`;
            await tx.run(
              `MERGE (comp:Step { id: $compId })
               SET comp.name = $compName,
                   comp.activity = $compName
               WITH comp
               MATCH (s:Step { id: $stepId })
               MERGE (s)-[:COMPENSATES_WITH]->(comp)`,
              {
                compId: compNodeId,
                compName: step.compensation,
                stepId: stepNodeId,
              },
            );
          }
        }
      });

      logger.debug('WorkflowGraphService: workflow synced to Neo4j', {
        workflowId: workflow.id,
        stepCount: workflow.steps.length,
      });
    } catch (err) {
      logger.error('WorkflowGraphService: syncWorkflow failed (non-fatal)', {
        workflowId: workflow.id,
        err,
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Create an Execution node and link it to its Workflow.
   * Called when an execution is first triggered.
   */
  async recordExecutionStarted(execution: Execution): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.executeWrite(async (tx) => {
        await tx.run(
          `MERGE (e:Execution { id: $id })
           SET e.orgId = $orgId,
               e.status = $status,
               e.startedAt = $startedAt
           WITH e
           MATCH (w:Workflow { id: $workflowId })
           MERGE (e)-[:RUNS]->(w)`,
          {
            id: execution.id,
            orgId: execution.orgId,
            status: execution.status,
            startedAt: execution.startedAt.toISOString(),
            workflowId: execution.workflowId,
          },
        );
      });

      logger.debug('WorkflowGraphService: execution started recorded in Neo4j', {
        executionId: execution.id,
      });
    } catch (err) {
      logger.error('WorkflowGraphService: recordExecutionStarted failed (non-fatal)', {
        executionId: execution.id,
        err,
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Write an EXECUTED_STEP relationship from the Execution to the Step node.
   * Called after each step result (success or failure).
   *
   * @param workflowId    — used to look up the correct Step node (id = workflowId:stepName)
   * @param executionId   — the execution that ran the step
   * @param stepName      — the step name
   * @param status        — 'COMPLETED' | 'FAILED'
   * @param attemptNumber — which attempt this was
   * @param durationMs    — how long the step took in milliseconds
   */
  async recordStepExecution(
    workflowId: string,
    executionId: string,
    stepName: string,
    status: 'COMPLETED' | 'FAILED',
    attemptNumber: number,
    durationMs: number,
  ): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      const stepNodeId = `${workflowId}:${stepName}`;
      await session.executeWrite(async (tx) => {
        await tx.run(
          `MATCH (e:Execution { id: $executionId })
           MATCH (s:Step { id: $stepId })
           CREATE (e)-[:EXECUTED_STEP {
             status: $status,
             attemptNumber: $attemptNumber,
             durationMs: $durationMs,
             occurredAt: $occurredAt
           }]->(s)`,
          {
            executionId,
            stepId: stepNodeId,
            status,
            attemptNumber,
            durationMs,
            occurredAt: new Date().toISOString(),
          },
        );
      });

      logger.debug('WorkflowGraphService: step execution recorded in Neo4j', {
        executionId,
        stepName,
        status,
        durationMs,
      });
    } catch (err) {
      logger.error('WorkflowGraphService: recordStepExecution failed (non-fatal)', {
        executionId,
        stepName,
        err,
      });
    } finally {
      await session.close();
    }
  }
}
