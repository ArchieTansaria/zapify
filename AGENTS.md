# Automara Agent Instructions

## Read First

Before making changes, read:

- SPEC.md

The assignment in SPEC.md is the source of truth.

## Development Philosophy

Build the smallest system that satisfies the assignment.

Priorities:

1. Security
2. Correct workflow execution
3. Final end-to-end scenario
4. Hasura correctness
5. Reliability
6. Frontend
7. UI polish

## Architecture

Required stack:

- Next.js
- TypeScript
- Nhost
- Hasura
- PostgreSQL
- GraphQL

Prefer Nhost/Hasura/PostgreSQL primitives.

Do not introduce:

- Redis
- Kafka
- RabbitMQ
- BullMQ
- Kubernetes
- microservices

unless explicitly required.

## Security

Never trust the frontend for authorization.

Organization access must be enforced using Hasura permissions
and org_members.

Never expose Hasura admin credentials or service secrets
to the browser.

Never authorize a request using a client-provided role.

Approval authorization must be checked inside the backend
approveStep Action.

## Workflow Execution

Workflow execution state must be persisted in PostgreSQL.

Every execution creates a workflow_run.

Every executed step creates a step_run.

Approval gates must persist a paused state.

Never implement approval using an in-memory wait or sleep.

## Agent Behavior

Before coding:

1. Inspect the existing repository.
2. Read SPEC.md.
3. Understand existing implementation.
4. Plan the change.

While coding:

- stay within the requested task
- don't rewrite unrelated code
- don't introduce unnecessary infrastructure

After coding:

1. run tests
2. run typecheck
3. run lint/build where applicable
4. inspect the diff
5. report exactly what was changed
6. report anything that remains broken

Never claim something works unless it was verified.
