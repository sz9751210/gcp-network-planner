# GCP Network Planner - Architecture Restructure Status

## Current Decision

- Primary backend: **Go (Echo + GORM)**.
- Deployment target: **single-tenant internal network**.
- Inventory scope: **project-level only**.
- Node backend: **deprecated compatibility fallback** (feature-frozen).

## What Was Stabilized in Phase 2

1. Canonical API and type alignment:
   - `ProjectGraph` contract enforced.
   - Frontend normalized parsing and strict typecheck baseline.

2. Scan reliability:
   - Async scan progress is observable during `running`.
   - Scan jobs are persisted in `scan_jobs`.
   - Freshness policy (`stale`) is applied consistently.

3. Auditability:
   - Credential and scan operations are persisted in `audit_events`.

4. Quality gates:
   - Frontend typecheck/test/build
   - Go build/test
   - API contract + smoke E2E in Go tests

## Phase 3 Operations-First Additions

1. Observability APIs:
   - `GET /api/v1/scans` supports filter + cursor pagination.
   - `GET /api/v1/audit-events` supports filter + cursor pagination.
   - Response contract uses `{ items, nextCursor }`.

2. Audit traceability and governance:
   - Scan audit metadata includes `scanId/serviceAccountId/projects/errors/durationMs`.
   - Audit retention is fixed at 90 days with startup + periodic cleanup.
   - Query indexes are created for scan/audit list paths.

3. Product UX:
   - New Operations view in frontend: Scan History + Audit Trail + traceable linkage.

4. Node sunset preparation:
   - Root/frontend defaults are Go-first.
   - Node path is legacy manual fallback only (`npm run legacy:backend:node`).
   - Removal target remains next release cycle.

## Source of Truth Docs

- `docs/progress/phase2-go-stabilization.md`
- `docs/architecture/current-state.md`
- `docs/testing/quality-gates.md`
