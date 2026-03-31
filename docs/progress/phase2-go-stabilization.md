# Phase 2 Progress - Go Stabilization / Go 主軸穩定化進度

Last Updated: 2026-03-31
Owner: Platform Team

## Goal
在 Go-first 架構下完成可靠性先行收斂：可預測（progress/stale）、可驗證（typecheck/contract/regression/smoke）、可追溯（audit events + persisted scan jobs）。

## Milestone Checklist

| Item | Status | Notes |
|---|---|---|
| Canonical type alignment (`GcpProject`) | Completed | `iamPolicy` required array, `lastScannedAt`/`stale` surfaced to frontend. |
| Frontend typecheck baseline | Completed | Added `vite-env.d.ts`, fixed unsafe predicates and key `any` hotspots. |
| Scan context propagation | Completed | GCP fetch path now receives and propagates `context.Context`. |
| Scan progress observability | Completed | Running scan now updates `totalProjects`/`completedProjects` incrementally. |
| Stale policy (`15m`) | Completed | Stale calculated on inventory read; fallback after failed scan is forced stale. |
| Scan persistence | Completed | Scan job state/results persisted in `scan_jobs`; reloaded after restart. |
| Audit events | Completed | Added `audit_events` for credential and scan operations. |
| API contract tests | Completed | Added inventory schema and alias equivalence tests. |
| Smoke E2E path | Completed | Added service account -> scan -> inventory path test. |
| Frontend regression tests | Completed | Added CommandPalette, GCE, Firewall, CloudArmor, LB interaction tests. |
| CI quality gates upgrade | Completed | Added frontend typecheck/test/build + go build/test. |
| Docs consistency cleanup | Completed | README/DEVELOPMENT/DOCKER/RESTRUCTURE aligned to Go-first + Node fallback boundary. |
| Build artifact hygiene | Completed | CI/local build commands standardized to `-o bin/server`; ignored accidental `go-backend/main`. |
| Audit actor propagation readiness | Completed | CORS allowlist now includes `X-Actor` header. |

## Phase 3 Operations-first Progress

| Item | Status | Notes |
|---|---|---|
| `GET /api/v1/scans` list API | Completed | Added filter + cursor pagination response (`items`, `nextCursor`). |
| `GET /api/v1/audit-events` list API | Completed | Added filter + cursor pagination with canonical metadata object output. |
| Scan audit traceability metadata | Completed | `scan.finish/fail` now emit `scanId/serviceAccountId/projects/errors/durationMs`. |
| Audit retention policy (`90d`) | Completed | Startup cleanup + 6-hour background cleanup worker. |
| DB query indexes | Completed | Added indexes for `audit_events` and `scan_jobs` query paths. |
| Operations frontend view | Completed | Added Scan History + Audit Trail with filter, copy, and audit-to-scan linkage. |
| Node sunset preparation | Completed | Root/frontend scripts now Go-first by default; Node kept as legacy manual path. |

## Change Log

### 2026-03-31
- Added scan progress updates and persisted scan records.
- Added stale indicator policy and fallback stale behavior.
- Added audit event persistence for credential + scan actions.
- Added contract/integration/smoke tests and frontend regression suite.
- Added CI gates for typecheck/test/build across frontend and Go backend.
- Hardened build artifact hygiene and `X-Actor` transport compatibility.
- Added operations APIs (`/api/v1/scans`, `/api/v1/audit-events`) with cursor pagination and filters.
- Added audit retention worker (90-day policy) and DB query indexes.
- Added Operations page with scan/audit traceability and copy-to-clipboard utilities.
