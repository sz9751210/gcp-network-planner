package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/models"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/repository"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/services"
)

type noopInventoryBuilder struct{}

func (b *noopInventoryBuilder) BuildInventory(_ context.Context, _ string, _ services.BuildInventoryOptions) ([]services.ProjectGraph, []services.ProjectScanError, error) {
	return []services.ProjectGraph{}, []services.ProjectScanError{}, nil
}

func TestListScansSupportsFiltersAndCursor(t *testing.T) {
	db, err := repository.NewDatabase("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}
	repo := repository.NewRepository(db)

	now := time.Now().UTC()
	errPayload := `[{"projectId":"proj-a","error":"permission denied"}]`
	if err := repo.UpsertScanJob(&models.ScanJob{
		ID:                "scan-new-success",
		ServiceAccountID:  "sa-1",
		Actor:             "alice",
		Scope:             "project",
		Status:            "success",
		CreatedAt:         now.Add(-1 * time.Minute),
		CompletedAt:       ptrTime(now.Add(-30 * time.Second)),
		TotalProjects:     2,
		CompletedProjects: 2,
		ProjectsJSON:      "[]",
		ErrorsJSON:        errPayload,
	}); err != nil {
		t.Fatalf("failed to seed scan job: %v", err)
	}
	if err := repo.UpsertScanJob(&models.ScanJob{
		ID:                "scan-old-success",
		ServiceAccountID:  "sa-1",
		Actor:             "bob",
		Scope:             "project",
		Status:            "success",
		CreatedAt:         now.Add(-2 * time.Minute),
		CompletedAt:       ptrTime(now.Add(-90 * time.Second)),
		TotalProjects:     1,
		CompletedProjects: 1,
		ProjectsJSON:      "[]",
		ErrorsJSON:        "[]",
	}); err != nil {
		t.Fatalf("failed to seed scan job: %v", err)
	}
	if err := repo.UpsertScanJob(&models.ScanJob{
		ID:                "scan-other-failed",
		ServiceAccountID:  "sa-2",
		Actor:             "eve",
		Scope:             "project",
		Status:            "failed",
		CreatedAt:         now.Add(-3 * time.Minute),
		CompletedAt:       ptrTime(now.Add(-2 * time.Minute)),
		TotalProjects:     1,
		CompletedProjects: 0,
		ProjectsJSON:      "[]",
		ErrorsJSON:        errPayload,
	}); err != nil {
		t.Fatalf("failed to seed scan job: %v", err)
	}

	scanService := services.NewScanService(&noopInventoryBuilder{}, repo, nil)
	opsHandler := NewOperationsHandler(scanService, services.NewAuditService(repo))
	e := echo.New()
	e.GET("/api/v1/scans", opsHandler.ListScans)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/scans?serviceAccountId=sa-1&status=success&limit=1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}

	var firstPage services.ScanListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &firstPage); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(firstPage.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(firstPage.Items))
	}
	if firstPage.Items[0].ScanID != "scan-new-success" {
		t.Fatalf("unexpected first scan id: %s", firstPage.Items[0].ScanID)
	}
	if firstPage.Items[0].ErrorCount != 1 {
		t.Fatalf("unexpected error count: %d", firstPage.Items[0].ErrorCount)
	}
	if firstPage.NextCursor == "" {
		t.Fatalf("expected nextCursor for paginated response")
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/scans?serviceAccountId=sa-1&status=success&limit=1&cursor="+firstPage.NextCursor, nil)
	rec2 := httptest.NewRecorder()
	e.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("unexpected status for second page: %d body=%s", rec2.Code, rec2.Body.String())
	}

	var secondPage services.ScanListResponse
	if err := json.Unmarshal(rec2.Body.Bytes(), &secondPage); err != nil {
		t.Fatalf("failed to decode second page response: %v", err)
	}
	if len(secondPage.Items) != 1 || secondPage.Items[0].ScanID != "scan-old-success" {
		t.Fatalf("unexpected second page payload: %+v", secondPage.Items)
	}
}

func TestListAuditEventsSupportsFiltersAndMetadataObject(t *testing.T) {
	db, err := repository.NewDatabase("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}
	repo := repository.NewRepository(db)

	if err := repo.CreateAuditEvent(&models.AuditEvent{
		Timestamp:    time.Now().UTC().Add(-1 * time.Minute),
		Actor:        "alice",
		Action:       "scan.finish",
		TargetType:   "scan",
		TargetID:     "scan-1",
		Result:       "success",
		MetadataJSON: `{"scanId":"scan-1","durationMs":1234,"errors":0}`,
	}); err != nil {
		t.Fatalf("failed to seed audit event: %v", err)
	}
	if err := repo.CreateAuditEvent(&models.AuditEvent{
		Timestamp:    time.Now().UTC().Add(-2 * time.Minute),
		Actor:        "system",
		Action:       "credential.test",
		TargetType:   "service_account",
		TargetID:     "sa-1",
		Result:       "failed",
		ErrorSummary: "forbidden",
		MetadataJSON: `{"message":"forbidden"}`,
	}); err != nil {
		t.Fatalf("failed to seed audit event: %v", err)
	}

	scanService := services.NewScanService(&noopInventoryBuilder{}, repo, nil)
	auditService := services.NewAuditService(repo)
	opsHandler := NewOperationsHandler(scanService, auditService)
	e := echo.New()
	e.GET("/api/v1/audit-events", opsHandler.ListAuditEvents)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit-events?action=scan.finish&result=success&scanId=scan-1&limit=10", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}

	var response services.AuditEventListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(response.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(response.Items))
	}
	event := response.Items[0]
	if event.TargetID != "scan-1" {
		t.Fatalf("unexpected target id: %s", event.TargetID)
	}
	if gotScanID, ok := event.Metadata["scanId"].(string); !ok || gotScanID != "scan-1" {
		t.Fatalf("expected metadata.scanId to equal scan-1, got %#v", event.Metadata["scanId"])
	}
}

func ptrTime(t time.Time) *time.Time {
	tt := t.UTC()
	return &tt
}
