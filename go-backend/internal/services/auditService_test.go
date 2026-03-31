package services

import (
	"context"
	"testing"
	"time"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/models"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/repository"
)

func TestCleanupExpiredRemovesOnlyEventsOlderThanNinetyDays(t *testing.T) {
	db, err := repository.NewDatabase("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}
	repo := repository.NewRepository(db)
	service := NewAuditService(repo)

	oldTimestamp := time.Now().UTC().Add(-(auditRetentionPeriod + 24*time.Hour))
	newTimestamp := time.Now().UTC().Add(-48 * time.Hour)

	if err := repo.CreateAuditEvent(&models.AuditEvent{
		Timestamp:    oldTimestamp,
		Actor:        "old-actor",
		Action:       "scan.finish",
		TargetType:   "scan",
		TargetID:     "old-scan",
		Result:       "success",
		MetadataJSON: `{"scanId":"old-scan"}`,
	}); err != nil {
		t.Fatalf("failed to seed old event: %v", err)
	}
	if err := repo.CreateAuditEvent(&models.AuditEvent{
		Timestamp:    newTimestamp,
		Actor:        "new-actor",
		Action:       "scan.finish",
		TargetType:   "scan",
		TargetID:     "new-scan",
		Result:       "success",
		MetadataJSON: `{"scanId":"new-scan"}`,
	}); err != nil {
		t.Fatalf("failed to seed new event: %v", err)
	}

	deleted, err := service.CleanupExpired(context.Background())
	if err != nil {
		t.Fatalf("cleanup failed: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("expected 1 deleted event, got %d", deleted)
	}

	list, err := service.ListEvents(context.Background(), AuditEventListFilters{Limit: 10})
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("expected 1 remaining event, got %d", len(list.Items))
	}
	if list.Items[0].TargetID != "new-scan" {
		t.Fatalf("unexpected remaining event target: %s", list.Items[0].TargetID)
	}
}
