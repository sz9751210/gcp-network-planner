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
	Metadata     map[string]string
}

type AuditService struct {
	repo *repository.Repository
}

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
