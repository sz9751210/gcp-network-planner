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

## Phase 3.1 CIDR Manager Progress

| Item | Status | Notes |
|---|---|---|
| CIDR Manager unified tab | Completed | Added single consolidated page for inventory/conflict/planning workflows. |
| Legacy CIDR pages compatibility | Completed | `CIDR Planner` and `IP Allocations` converted to thin wrappers with redirect hint. |
| All-project subnet CIDR inventory | Completed | Aggregates canonical `GcpProject.vpcs[].subnets[].ipCidrRange` only. |
| Planning assistant (local algorithm) | Completed | Added next available RFC1918 CIDR suggestion by target prefix. |
| Scan/freshness integration | Completed | Reuses existing scan job flow and shows stale/scan traceability context. |
| CIDR manager test baseline | Completed | Added frontend regression + utility edge-case tests. |

## Phase 3.2 IP Usage Explorer Progress

| Item | Status | Notes |
|---|---|---|
| IPv4 usage matcher utility | Completed | Added strict IPv4 validator + stage-based matcher (`NETWORK/ENDPOINT/POLICY`) over canonical inventory. |
| Core resource coverage | Completed | Included subnet CIDR, GCE internal/external IP, LB IP, route destRange, firewall sourceRanges, Cloud Armor srcIpRanges. |
| CIDR Manager integration | Completed | Added IP search box, scope mode (follow current/all-projects), and read-only usage analysis flow. |
| Layered sequence timeline | Completed | Added ordered stage timeline: Network containment -> Endpoint ownership -> Policy references. |
| Freshness/partial trust hint | Completed | Preserves partial/stale warning semantics for IP usage results. |
| Regression + unit coverage | Completed | Added `ipUsage` utility tests and CIDR manager component timeline/scope/validation tests. |

## Phase 3.2A IP Catalog Tabbing Progress

| Item | Status | Notes |
|---|---|---|
| Internal/External IP list tabs | Completed | Added tabbed catalog split by `INTERNAL` / `EXTERNAL` in IP Usage Explorer. |
| External IP search support | Completed | External IPv4 is now first-class in manual search and list-driven quick search. |
| Catalog aggregation (`IP + project`) | Completed | Dedupe by key and expose `usageCount` + `resources` summary. |
| Endpoint `ipKind` semantics | Completed | Endpoint matches now include `ipKind` metadata and UI badge rendering. |
| Cross-tab mismatch hint | Completed | Non-blocking hint when searched IP kind differs from active tab. |

## Phase 3.3 IA Noise Reduction Progress

| Item | Status | Notes |
|---|---|---|
| Dedicated `IP Usage Explorer` page | Completed | Added standalone sidebar route to separate IP search workflow from CIDR planning workflow. |
| CIDR Manager responsibility split | Completed | CIDR Manager now focuses on inventory/conflict/planning and keeps a single entry card for IP usage navigation. |
| External-first behavior | Completed | New page defaults to `External IPs` tab on every open without restoring prior tab/filter state. |
| Navigation and discoverability | Completed | Added sidebar + Command Palette navigation for `IP Usage Explorer`. |
| Regression alignment | Completed | Split component tests: CIDR Manager validates entry-card routing; IP usage behavior validated in dedicated page tests. |

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
- Added CIDR Manager tab and consolidated all-project subnet CIDR planning workflow.
- Added IP Usage Explorer in CIDR Manager with IPv4 search, all-project/current-scope analysis, and staged resource sequence timeline.
- Added Internal/External IP catalog tabs with quick-pick search flow and endpoint IP-kind visibility.
- Split IP Usage Explorer into a dedicated page and kept CIDR Manager as streamlined planning surface with an explicit navigation entry card.
