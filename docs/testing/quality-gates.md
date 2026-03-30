# Quality Gates / 品質門檻

## CI Gates
- Frontend typecheck: `npm run typecheck --workspace=frontend`
- Frontend regression tests: `npm run test --workspace=frontend`
- Frontend build: `npm run build --workspace=frontend`
- Go backend build: `cd go-backend && go build ./cmd/main.go`
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
- Integration:
  - scan state transitions (`queued -> running -> partial/success/failed`)
  - running progress visibility
  - fallback inventory stale behavior after failed scan
- Smoke E2E:
  - service account create -> start scan -> fetch inventory
- Frontend Regression:
  - command palette search + navigation
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
