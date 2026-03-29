# Contributing to Chronos

## Ways to contribute

- Report bugs via GitHub Issues
- Submit fixes as Pull Requests
- Improve documentation
- Add new activity types to the worker
- Build integrations (webhooks, Slack notifications, etc.)

## Development setup

See [docs/development.md](docs/development.md).

## Pull Request process

1. Fork the repo and create a branch: `git checkout -b fix/my-fix`
2. Make your changes with tests
3. Run the full test suite: `turbo run test && turbo run lint`
4. Commit using Conventional Commits: `feat(scope): description`
5. Push and open a PR against `main`
6. CI must pass before merge

## Commit message format

```
type(scope): short description

Types: feat, fix, docs, test, refactor, chore
Scopes: shared, gateway, orchestrator, worker, notifier, dashboard,
        kafka, rabbitmq, neo4j, docker, ci, docs, infra
```

Examples:

```
feat(gateway): add rate limiting per API key
fix(orchestrator): prevent double-compensation on crash recovery
docs: update quickstart with Podman instructions
test(worker): add idempotency guard integration test
```

## Reporting bugs

Include in your issue:

- Chronos version (`git log --oneline -1` or image tag from `docker images | grep chronos`)
- Steps to reproduce
- Expected vs actual behaviour
- Relevant logs (`bash scripts/dev.sh logs orchestrator`)

## Code style

- TypeScript strict mode (`"strict": true` in tsconfig)
- ESLint enforced — run `turbo run lint` before pushing
- No `console.log` in source — use the Winston logger from `@chronos/shared`
- Tests required for new features — unit tests at minimum, integration tests for persistence logic

## Adding a new activity type

Activities live in `packages/worker/src/activities/`. Each activity is a plain async function:

```typescript
// packages/worker/src/activities/myActivity.ts
export async function myActivity(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // do the work
  return { result: 'ok' };
}
```

Register it in `packages/worker/src/activities/index.ts` and add a unit test.

## Project decisions

- **Why pnpm workspaces?** — consistent lockfile, fast installs, workspace protocol for local deps
- **Why Kafka for step execution?** — durable delivery, consumer groups for horizontal scaling, replayable for crash recovery
- **Why RabbitMQ for notifications?** — topic exchange fanout is a better fit for fire-and-forget notifications than Kafka
- **Why Neo4j for graph queries?** — Cypher is purpose-built for graph traversals (failure paths, bottleneck analysis) that would be expensive in MongoDB
- **Why event sourcing?** — crash recovery is trivial when state is derived from an append-only log; no mutable state to get out of sync
