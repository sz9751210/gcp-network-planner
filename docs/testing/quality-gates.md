# Quality Gates / 品質門檻

## CI Gates
- Frontend typecheck: `npm run typecheck --workspace=frontend`
- Frontend regression tests: `npm run test --workspace=frontend`
- Frontend build: `npm run build --workspace=frontend`
- Go backend build: `cd go-backend && go build -o bin/server ./cmd/main.go`
- Go backend tests: `cd go-backend && go test ./...`

## Test Coverage Matrix
- Crypto:
  - legacy Node payload decrypt
  - v2 encrypt/decrypt round-trip
  - wrong key / corrupted payload failure handling
- API Contract:
  - `GET /api/v1/inventory` canonical schema checks
  - `/api/gcp/all-data` alias equivalence to v1 inventory
  - `GET /api/v1/scans` list filters + cursor pagination
  - `GET /api/v1/audit-events` metadata object shape + filters
- Integration:
  - scan state transitions (`queued -> running -> partial/success/failed`)
  - running progress visibility
  - fallback inventory stale behavior after failed scan
  - audit retention cleanup (`90d`) behavior
- Smoke E2E:
  - service account create -> start scan -> fetch inventory
  - operations linkage: scan list + audit list traceable to scanId
- Frontend Regression:
  - command palette search + navigation
  - operations view render + audit-to-scan linkage
  - GCE detail modal open path
  - firewall group expand
  - cloud armor policy expand
  - load balancer topology expand

## Local Run Order
1. `npm run typecheck --workspace=frontend`
2. `npm run test --workspace=frontend`
3. `npm run build --workspace=frontend`
4. `cd go-backend && GOCACHE=/tmp/go-build go test ./...`
5. `cd go-backend && GOCACHE=/tmp/go-build go build -o bin/server ./cmd/main.go`
