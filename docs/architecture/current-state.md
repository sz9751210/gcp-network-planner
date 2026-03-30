# Current Architecture (Go-First) / 當前架構（Go 主軸）

## Deployment Model
- Environment: trusted internal network, single tenant.
- Scope: project-level GCP inventory scans only.
- Backend default: Go (Echo + GORM + SQLite).
- Node backend: deprecated fallback only, feature-frozen.

## Runtime Components
- Frontend (React + Vite): expert-first dense UI, scan status + error traceability + inventory exploration.
- Go API:
  - Credentials: create/list/delete/test.
  - Scan engine: async queue, status machine (`queued/running/partial/success/failed`).
  - Inventory: canonical `ProjectGraph[]` via `/api/v1/inventory` and `/api/gcp/all-data` alias.
- Storage:
  - `service_accounts` for encrypted keys.
  - `scan_jobs` for persisted scan state/results.
  - `audit_events` for operational trace logs.

## Data/Control Flow
1. User uploads service account key.
2. Credential encrypted and stored.
3. User triggers scan (`POST /api/v1/scans`).
4. Scan worker runs project-level fetch with context deadline + per-project timeout.
5. Running progress updates are persisted (`totalProjects` / `completedProjects` / per-project errors).
6. Final project graphs are stored and exposed via scan status and inventory endpoints.
7. Audit events are recorded for credential and scan operations.

## Reliability Policies
- Scan concurrency default: `4`.
- Per-project timeout default: `20s`.
- Whole scan deadline default: `8m`.
- Freshness policy: stale if older than `15m`; fallback inventory after failed scan is forced stale.
- Restart behavior: queued/running jobs from previous process are marked failed (`interrupted by server restart`), while completed scans remain queryable.
