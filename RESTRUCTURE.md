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

## Source of Truth Docs

- `docs/progress/phase2-go-stabilization.md`
- `docs/architecture/current-state.md`
- `docs/testing/quality-gates.md`
