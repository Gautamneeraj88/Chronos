#!/usr/bin/env node
/**
 * Generate the static OpenAPI JSON and write it to docs/openapi.json at the repo root.
 * Usage: node packages/api-gateway/scripts/generate-openapi.js
 * Or via package.json script: pnpm --filter @chronos/api-gateway generate:openapi
 */
const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');
const fs = require('fs');

const definition = {
  openapi: '3.0.0',
  info: {
    title: 'Chronos API',
    version: '0.9.0',
    description:
      'Self-hostable workflow orchestration engine — REST API for managing workflows, executions, API keys, and webhooks.',
    license: { name: 'MIT', url: 'https://github.com/gautamneeraj88/chronos/blob/main/LICENSE' },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://your-domain.com/api', description: 'Production (behind reverse proxy)' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT from POST /auth/login or an API key from the dashboard',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'member'] },
          orgId: { type: 'string' },
        },
      },
      WorkflowStep: {
        type: 'object',
        required: ['name', 'type', 'activity'],
        properties: {
          name: { type: 'string', example: 'charge-card' },
          type: { type: 'string', enum: ['activity'], description: 'Must be "activity"' },
          activity: { type: 'string', example: 'chargeCard' },
          compensation: { type: 'string', nullable: true },
          retries: { type: 'integer', default: 0 },
          timeoutMs: { type: 'integer', default: 30000 },
        },
      },
      CreateWorkflowInput: {
        type: 'object',
        required: ['name', 'steps'],
        properties: {
          name: { type: 'string', example: 'order-processing' },
          steps: { type: 'array', items: { $ref: '#/components/schemas/WorkflowStep' } },
        },
      },
      Workflow: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          version: { type: 'integer' },
          orgId: { type: 'string' },
          steps: { type: 'array', items: { $ref: '#/components/schemas/WorkflowStep' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Execution: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          workflowId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['RUNNING', 'COMPLETED', 'COMPENSATING', 'COMPENSATED', 'COMPENSATION_FAILED'],
          },
          currentStepIndex: { type: 'integer' },
          input: { type: 'object', additionalProperties: true },
          output: { type: 'object', additionalProperties: true, nullable: true },
          triggeredBy: { type: 'string' },
          orgId: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ExecutionEvent: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'EXECUTION_STARTED', 'STEP_STARTED', 'STEP_IN_FLIGHT',
              'STEP_COMPLETED', 'STEP_FAILED', 'EXECUTION_COMPLETED',
              'COMPENSATION_STARTED', 'STEP_COMPENSATED', 'EXECUTION_COMPENSATED',
              'COMPENSATION_FAILED',
            ],
          },
          timestamp: { type: 'string', format: 'date-time' },
          data: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
  tags: [
    { name: 'Auth', description: 'Authentication and user management' },
    { name: 'Workflows', description: 'Workflow definition management' },
    { name: 'Executions', description: 'Execution triggering and status' },
    { name: 'API Keys', description: 'API key management' },
    { name: 'Webhooks', description: 'Webhook registration' },
  ],
};

const apis = [path.join(__dirname, '../src/routes/*.ts')];
const spec = swaggerJSDoc({ definition, apis });

// Write to repo root docs/openapi.json
const outPath = path.join(__dirname, '../../../docs/openapi.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2));

console.log(`OpenAPI spec written to ${outPath}`);
console.log(`Paths: ${Object.keys(spec.paths || {}).length}`);
