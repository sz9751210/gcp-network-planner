# Current Architecture (Go-First) / 當前架構（Go 主軸）

## Deployment Model
- Environment: trusted internal network, single tenant.
- Scope: project-level GCP inventory scans only.
- Backend default: Go (Echo + GORM + SQLite).
- Node backend: deprecated fallback only, feature-frozen.

## Runtime Components
- Frontend (React + Vite): expert-first dense UI, scan status + error traceability + inventory exploration.
- CIDR Manager: consolidated subnet CIDR inventory + conflict analyzer + planning assistant across loaded projects.
- IP Usage Explorer (standalone page): IPv4 lookup over canonical inventory with staged sequence view (`NETWORK -> ENDPOINT -> POLICY`) and scope mode (`current/all-projects`).
- IP Catalog tabs (inside IP Usage Explorer): external-first default tab with internal/external endpoint IP lists, quick-select search, and usage aggregation (`IP + project`).
- Go API:
  - Credentials: create/list/delete/test.
  - Scan engine: async queue, status machine (`queued/running/partial/success/failed`).
  - Inventory: canonical `ProjectGraph[]` via `/api/v1/inventory` and `/api/gcp/all-data` alias.
  - Operations: list scans (`GET /api/v1/scans`) and audit trail (`GET /api/v1/audit-events`) with cursor pagination.
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
8. Operations UI queries scan/audit list endpoints and links audit events back to scan details.
9. CIDR Manager links users to standalone IP Usage Explorer when they need point-IP traceability.
10. IP Usage Explorer derives usage matches from loaded inventory only (no extra backend call), then renders staged sequence timeline for operator traceability.
11. IP Catalog classifier derives endpoint IP kind (`INTERNAL/EXTERNAL`) from instance fields and load-balancer type/fallback RFC1918 checks, then drives tabbed list UX.

## Reliability Policies
- Scan concurrency default: `4`.
- Per-project timeout default: `20s`.
- Whole scan deadline default: `8m`.
- Freshness policy: stale if older than `15m`; fallback inventory after failed scan is forced stale.
- Restart behavior: queued/running jobs from previous process are marked failed (`interrupted by server restart`), while completed scans remain queryable.
- Audit retention: `90d`; startup cleanup + every 6 hours background cleanup.
