/**
 * Bootstrap script: creates an API key for a given org.
 * Run against a live orchestrator:
 *   ORCHESTRATOR_URL=http://localhost:3001 ts-node scripts/generate-token.ts
 *
 * The raw key is printed once — store it somewhere safe.
 */
import axios from 'axios';

const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:3001';
const orgId = process.env.ORG_ID ?? 'default-org';
const userId = process.env.USER_ID ?? 'dev-user-001';
const name = process.env.KEY_NAME ?? 'dev-key';

async function main(): Promise<void> {
  const { data } = await axios.post(`${orchestratorUrl}/internal/api-keys`, {
    orgId,
    userId,
    name,
  });

  console.log(`\nAPI key created for org '${orgId}':`);
  console.log(`  Bearer ${data.key}`);
  console.log(`\nAdd to your requests as: Authorization: Bearer ${data.key}`);
}

main().catch((err) => {
  console.error('Failed to create API key:', err.message);
  process.exit(1);
});
