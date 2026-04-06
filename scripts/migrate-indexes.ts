/**
 * One-time migration: sync MongoDB indexes defined in the Mongoose models
 * to the actual database. Safe to run multiple times.
 *
 * Usage: pnpm migrate:indexes
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { ExecutionModel } from '../packages/orchestrator/src/models/execution.model.js';
import { WorkflowModel } from '../packages/orchestrator/src/models/workflow.model.js';

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await ExecutionModel.syncIndexes();
  console.log('ExecutionModel indexes synced');

  await WorkflowModel.syncIndexes();
  console.log('WorkflowModel indexes synced');

  await mongoose.disconnect();
  console.log('Done — indexes synced successfully');
}

run().catch((err) => {
  console.error('migrate-indexes failed:', err);
  process.exit(1);
});
