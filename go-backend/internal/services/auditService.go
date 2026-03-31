package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/models"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/repository"
)

type AuditEventInput struct {
	Actor        string
	Action       string
	TargetType   string
	TargetID     string
	Result       string
	ErrorSummary string
	Metadata     map[string]any
}

type AuditEventRecord struct {
	ID           string         `json:"id"`
	Timestamp    string         `json:"timestamp"`
	Actor        string         `json:"actor"`
	Action       string         `json:"action"`
	TargetType   string         `json:"targetType"`
	TargetID     string         `json:"targetId"`
	Result       string         `json:"result"`
	ErrorSummary string         `json:"errorSummary,omitempty"`
	Metadata     map[string]any `json:"metadata"`
}

type AuditEventListFilters struct {
	From       *time.Time
	To         *time.Time
	Action     string
	Result     string
	TargetType string
	TargetID   string
	Actor      string
	ScanID     string
	Limit      int
	Cursor     string
}

type AuditEventListResponse struct {
	Items      []AuditEventRecord `json:"items"`
	NextCursor string             `json:"nextCursor,omitempty"`
}

type AuditService struct {
	repo *repository.Repository
}

const (
	defaultAuditListLimit = 20
	maxAuditListLimit     = 100
	auditRetentionPeriod  = 90 * 24 * time.Hour
)

func NewAuditService(repo *repository.Repository) *AuditService {
	return &AuditService{repo: repo}
}

func (s *AuditService) Record(_ context.Context, input AuditEventInput) {
	if s == nil || s.repo == nil {
		return
	}

	actor := input.Actor
	if actor == "" {
		actor = "system"
	}

	metadataJSON := "{}"
	if len(input.Metadata) > 0 {
		raw, err := json.Marshal(input.Metadata)
		if err != nil {
			fmt.Printf("audit metadata marshal failed: %v\n", err)
		} else {
			metadataJSON = string(raw)
		}
	}

	event := &models.AuditEvent{
		Timestamp:    time.Now().UTC(),
		Actor:        actor,
		Action:       input.Action,
		TargetType:   input.TargetType,
		TargetID:     input.TargetID,
		Result:       input.Result,
		ErrorSummary: input.ErrorSummary,
		MetadataJSON: metadataJSON,
	}

	if err := s.repo.CreateAuditEvent(event); err != nil {
		fmt.Printf("failed to persist audit event: %v\n", err)
	}
}

func (s *AuditService) ListEvents(_ context.Context, filters AuditEventListFilters) (AuditEventListResponse, error) {
	response := AuditEventListResponse{
		Items: make([]AuditEventRecord, 0),
	}
	if s == nil || s.repo == nil {
		return response, nil
	}

	cursorTimestamp, cursorID, err := decodeCursor(filters.Cursor)
	if err != nil {
		return response, err
	}

	limit := normalizeAuditLimit(filters.Limit)
	events, err := s.repo.ListAuditEventsFiltered(repository.AuditEventListFilter{
		From:            filters.From,
		To:              filters.To,
		Action:          filters.Action,
		Result:          filters.Result,
		TargetType:      filters.TargetType,
		TargetID:        filters.TargetID,
		Actor:           filters.Actor,
		ScanID:          filters.ScanID,
		CursorTimestamp: cursorTimestamp,
		CursorID:        cursorID,
		Limit:           limit + 1,
	})
	if err != nil {
		return response, err
	}

	if len(events) > limit {
		last := events[limit-1]
		response.NextCursor = encodeCursor(last.Timestamp, last.ID)
		events = events[:limit]
	}

	response.Items = make([]AuditEventRecord, 0, len(events))
	for _, event := range events {
		response.Items = append(response.Items, AuditEventRecord{
			ID:           event.ID,
			Timestamp:    event.Timestamp.UTC().Format(time.RFC3339),
			Actor:        event.Actor,
			Action:       event.Action,
			TargetType:   event.TargetType,
			TargetID:     event.TargetID,
			Result:       event.Result,
			ErrorSummary: event.ErrorSummary,
			Metadata:     parseAuditMetadataJSON(event.MetadataJSON),
		})
	}

	return response, nil
}

func (s *AuditService) CleanupExpired(_ context.Context) (int64, error) {
	if s == nil || s.repo == nil {
		return 0, nil
	}
	cutoff := time.Now().UTC().Add(-auditRetentionPeriod)
	return s.repo.DeleteAuditEventsBefore(cutoff)
}

func (s *AuditService) StartRetentionWorker(ctx context.Context, interval time.Duration) {
	if s == nil || s.repo == nil {
		return
	}
	if interval <= 0 {
		interval = 6 * time.Hour
	}

	if _, err := s.CleanupExpired(ctx); err != nil {
		fmt.Printf("audit retention startup cleanup failed: %v\n", err)
	}

	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if _, err := s.CleanupExpired(ctx); err != nil {
					fmt.Printf("audit retention cleanup failed: %v\n", err)
				}
			}
		}
	}()
}

func normalizeAuditLimit(limit int) int {
	if limit <= 0 {
		return defaultAuditListLimit
	}
	if limit > maxAuditListLimit {
		return maxAuditListLimit
	}
	return limit
}

func parseAuditMetadataJSON(raw string) map[string]any {
	if raw == "" {
		return map[string]any{}
	}
	var metadata map[string]any
	if err := json.Unmarshal([]byte(raw), &metadata); err != nil {
		return map[string]any{}
	}
	if metadata == nil {
		return map[string]any{}
	}
	return metadata
}
