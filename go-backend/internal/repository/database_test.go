package repository

import "testing"

type sqliteIndex struct {
	Name string `gorm:"column:name"`
}

func TestAutoMigrateCreatesQueryIndexes(t *testing.T) {
	db, err := NewDatabase("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}

	indexes := make([]sqliteIndex, 0)
	if err := db.Raw(
		"SELECT name FROM sqlite_master WHERE type='index' AND name IN (?, ?)",
		"idx_audit_events_query",
		"idx_scan_jobs_query",
	).Scan(&indexes).Error; err != nil {
		t.Fatalf("failed to query indexes: %v", err)
	}

	found := map[string]bool{}
	for _, index := range indexes {
		found[index.Name] = true
	}

	if !found["idx_audit_events_query"] {
		t.Fatalf("expected idx_audit_events_query to exist")
	}
	if !found["idx_scan_jobs_query"] {
		t.Fatalf("expected idx_scan_jobs_query to exist")
	}
}
