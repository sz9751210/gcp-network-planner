package services

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/models"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/repository"
)

const (
	scanScopeProject       = "project"
	scanTimeout            = 8 * time.Minute
	scanQueueBufferSize    = 128
	scanProjectConcurrency = 4
	scanProjectTimeout     = 20 * time.Second
	inventoryStaleAfter    = 15 * time.Minute
)

type ScanStatus string

const (
	ScanStatusQueued  ScanStatus = "queued"
	ScanStatusRunning ScanStatus = "running"
	ScanStatusPartial ScanStatus = "partial"
	ScanStatusSuccess ScanStatus = "success"
	ScanStatusFailed  ScanStatus = "failed"
)

type ScanRecord struct {
	ScanID            string             `json:"scanId"`
	ServiceAccountID  string             `json:"serviceAccountId"`
	Actor             string             `json:"actor"`
	Scope             string             `json:"scope"`
	Status            ScanStatus         `json:"status"`
	CreatedAt         string             `json:"createdAt"`
	StartedAt         string             `json:"startedAt,omitempty"`
	CompletedAt       string             `json:"completedAt,omitempty"`
	TotalProjects     int                `json:"totalProjects"`
	CompletedProjects int                `json:"completedProjects"`
	Projects          []ProjectGraph     `json:"projects"`
	Errors            []ProjectScanError `json:"errors"`
}

type InventoryBuilder interface {
	BuildInventory(ctx context.Context, serviceAccountID string, options BuildInventoryOptions) ([]ProjectGraph, []ProjectScanError, error)
}

type ScanService struct {
	inventoryBuilder InventoryBuilder
	repo             *repository.Repository
	auditService     *AuditService

	mu                    sync.RWMutex
	jobs                  map[string]*ScanRecord
	latestByAccount       map[string]string
	lastFailedAtByAccount map[string]time.Time
	queue                 chan string
}

func NewScanService(inventoryBuilder InventoryBuilder, repo *repository.Repository, auditService *AuditService) *ScanService {
	service := &ScanService{
		inventoryBuilder:      inventoryBuilder,
		repo:                  repo,
		auditService:          auditService,
		jobs:                  make(map[string]*ScanRecord),
		latestByAccount:       make(map[string]string),
		lastFailedAtByAccount: make(map[string]time.Time),
		queue:                 make(chan string, scanQueueBufferSize),
	}

	service.loadPersistedJobs()
	go service.worker()
	return service
}

func (s *ScanService) CreateScan(serviceAccountID string, scope string, actor string) (*ScanRecord, error) {
	if serviceAccountID == "" {
		return nil, errors.New("serviceAccountId is required")
	}
	if scope == "" {
		scope = scanScopeProject
	}
	if scope != scanScopeProject {
		return nil, fmt.Errorf("unsupported scope: %s", scope)
	}
	if actor == "" {
		actor = "system"
	}

	scanID := generateScanID()
	now := time.Now().UTC().Format(time.RFC3339)

	record := &ScanRecord{
		ScanID:            scanID,
		ServiceAccountID:  serviceAccountID,
		Actor:             actor,
		Scope:             scope,
		Status:            ScanStatusQueued,
		CreatedAt:         now,
		TotalProjects:     0,
		CompletedProjects: 0,
		Projects:          make([]ProjectGraph, 0),
		Errors:            make([]ProjectScanError, 0),
	}

	s.mu.Lock()
	s.jobs[scanID] = record
	s.mu.Unlock()

	select {
	case s.queue <- scanID:
		s.persistRecord(record)
		s.recordAudit(context.Background(), AuditEventInput{
			Actor:      actor,
			Action:     "scan.create",
			TargetType: "scan",
			TargetID:   scanID,
			Result:     "success",
			Metadata: map[string]string{
				"serviceAccountId": serviceAccountID,
				"scope":            scope,
			},
		})
		return cloneScanRecord(record), nil
	default:
		s.mu.Lock()
		delete(s.jobs, scanID)
		s.mu.Unlock()
		return nil, errors.New("scan queue is full")
	}
}

func (s *ScanService) GetScan(scanID string) (*ScanRecord, bool) {
	s.mu.RLock()
	record, ok := s.jobs[scanID]
	s.mu.RUnlock()
	if !ok {
		return nil, false
	}
	return cloneScanRecord(record), true
}

func (s *ScanService) GetLatestCompletedInventory(serviceAccountID string) ([]ProjectGraph, bool) {
	s.mu.RLock()
	latestScanID, ok := s.latestByAccount[serviceAccountID]
	if !ok {
		s.mu.RUnlock()
		return nil, false
	}

	record, ok := s.jobs[latestScanID]
	if !ok {
		s.mu.RUnlock()
		return nil, false
	}
	if record.Status != ScanStatusSuccess && record.Status != ScanStatusPartial {
		s.mu.RUnlock()
		return nil, false
	}

	projects := make([]ProjectGraph, len(record.Projects))
	copy(projects, record.Projects)
	completedAt := parseRFC3339(record.CompletedAt)
	failedAt, hasFailedAt := s.lastFailedAtByAccount[serviceAccountID]
	s.mu.RUnlock()

	forceStale := hasFailedAt && completedAt != nil && failedAt.After(*completedAt)
	return applyProjectStaleness(projects, forceStale), true
}

func (s *ScanService) BuildInventoryNow(ctx context.Context, serviceAccountID string) ([]ProjectGraph, []ProjectScanError, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	scanCtx, cancel := context.WithTimeout(ctx, scanTimeout)
	defer cancel()

	projects, scanErrors, err := s.inventoryBuilder.BuildInventory(scanCtx, serviceAccountID, BuildInventoryOptions{
		ProjectConcurrency: scanProjectConcurrency,
		ProjectTimeout:     scanProjectTimeout,
	})
	if err != nil {
		return nil, nil, err
	}

	return applyProjectStaleness(projects, false), scanErrors, nil
}

func (s *ScanService) worker() {
	for scanID := range s.queue {
		s.runScan(scanID)
	}
}

func (s *ScanService) runScan(scanID string) {
	record, ok := s.GetScan(scanID)
	if !ok {
		return
	}

	startedAt := time.Now().UTC().Format(time.RFC3339)
	s.updateRecord(scanID, func(r *ScanRecord) {
		r.Status = ScanStatusRunning
		r.StartedAt = startedAt
		r.TotalProjects = 0
		r.CompletedProjects = 0
		r.Projects = make([]ProjectGraph, 0)
		r.Errors = make([]ProjectScanError, 0)
	})
	s.recordAudit(context.Background(), AuditEventInput{
		Actor:      record.Actor,
		Action:     "scan.start",
		TargetType: "scan",
		TargetID:   scanID,
		Result:     "success",
		Metadata: map[string]string{
			"serviceAccountId": record.ServiceAccountID,
		},
	})

	ctx, cancel := context.WithTimeout(context.Background(), scanTimeout)
	defer cancel()

	projects, projectErrors, err := s.inventoryBuilder.BuildInventory(ctx, record.ServiceAccountID, BuildInventoryOptions{
		ProjectConcurrency: scanProjectConcurrency,
		ProjectTimeout:     scanProjectTimeout,
		OnProjectsLoaded: func(totalProjects int) {
			s.updateRecord(scanID, func(r *ScanRecord) {
				r.TotalProjects = totalProjects
			})
		},
		OnProjectCompleted: func(projectID string, _ ProjectGraph, projectErr error) {
			s.updateRecord(scanID, func(r *ScanRecord) {
				r.CompletedProjects++
				if projectErr != nil {
					r.Errors = append(r.Errors, ProjectScanError{
						ProjectID: projectID,
						Error:     projectErr.Error(),
					})
				}
			})
		},
	})

	completedAtTime := time.Now().UTC()
	completedAt := completedAtTime.Format(time.RFC3339)

	finalErrors := projectErrors
	finalStatus := ScanStatusSuccess

	if err != nil {
		finalStatus = ScanStatusFailed
		finalErrors = append(finalErrors, ProjectScanError{
			ProjectID: "",
			Error:     err.Error(),
		})
	} else if len(projectErrors) > 0 {
		finalStatus = ScanStatusPartial
	}

	finalProjects := applyProjectStaleness(projects, false)

	s.updateRecord(scanID, func(r *ScanRecord) {
		r.CompletedAt = completedAt
		r.Projects = finalProjects
		r.Errors = finalErrors
		if r.TotalProjects == 0 {
			r.TotalProjects = len(finalProjects)
		}
		if r.CompletedProjects < len(finalProjects) {
			r.CompletedProjects = len(finalProjects)
		}
		r.Status = finalStatus

		if finalStatus == ScanStatusSuccess || finalStatus == ScanStatusPartial {
			s.latestByAccount[r.ServiceAccountID] = scanID
		}
		if finalStatus == ScanStatusFailed {
			s.lastFailedAtByAccount[r.ServiceAccountID] = completedAtTime
		}
	})

	if finalStatus == ScanStatusFailed {
		s.recordAudit(context.Background(), AuditEventInput{
			Actor:        record.Actor,
			Action:       "scan.fail",
			TargetType:   "scan",
			TargetID:     scanID,
			Result:       "failed",
			ErrorSummary: err.Error(),
			Metadata: map[string]string{
				"serviceAccountId": record.ServiceAccountID,
			},
		})
		return
	}

	s.recordAudit(context.Background(), AuditEventInput{
		Actor:      record.Actor,
		Action:     "scan.finish",
		TargetType: "scan",
		TargetID:   scanID,
		Result:     string(finalStatus),
		Metadata: map[string]string{
			"serviceAccountId": record.ServiceAccountID,
			"projects":         fmt.Sprintf("%d", len(finalProjects)),
			"errors":           fmt.Sprintf("%d", len(finalErrors)),
		},
	})
}

func (s *ScanService) updateRecord(scanID string, updateFn func(record *ScanRecord)) {
	s.mu.Lock()
	record, ok := s.jobs[scanID]
	if !ok {
		s.mu.Unlock()
		return
	}
	updateFn(record)
	cloned := cloneScanRecord(record)
	s.mu.Unlock()

	s.persistRecord(cloned)
}

func (s *ScanService) loadPersistedJobs() {
	if s.repo == nil {
		return
	}

	persistedJobs, err := s.repo.ListScanJobs()
	if err != nil {
		return
	}

	for i := len(persistedJobs) - 1; i >= 0; i-- {
		job := persistedJobs[i]
		record := scanModelToRecord(job)
		if record == nil {
			continue
		}

		if record.Status == ScanStatusQueued || record.Status == ScanStatusRunning {
			record.Status = ScanStatusFailed
			record.CompletedAt = time.Now().UTC().Format(time.RFC3339)
			record.Errors = append(record.Errors, ProjectScanError{
				ProjectID: "",
				Error:     "scan interrupted by server restart",
			})
			s.persistRecord(record)
		}

		s.jobs[record.ScanID] = record

		completedAt := parseRFC3339(record.CompletedAt)
		if completedAt == nil {
			continue
		}

		if record.Status == ScanStatusSuccess || record.Status == ScanStatusPartial {
			if currentID, ok := s.latestByAccount[record.ServiceAccountID]; !ok {
				s.latestByAccount[record.ServiceAccountID] = record.ScanID
			} else {
				current := s.jobs[currentID]
				currentCompletedAt := parseRFC3339(current.CompletedAt)
				if currentCompletedAt == nil || completedAt.After(*currentCompletedAt) {
					s.latestByAccount[record.ServiceAccountID] = record.ScanID
				}
			}
		}

		if record.Status == ScanStatusFailed {
			failedAt := s.lastFailedAtByAccount[record.ServiceAccountID]
			if completedAt.After(failedAt) {
				s.lastFailedAtByAccount[record.ServiceAccountID] = *completedAt
			}
		}
	}
}

func (s *ScanService) persistRecord(record *ScanRecord) {
	if s.repo == nil || record == nil {
		return
	}
	model, err := scanRecordToModel(record)
	if err != nil {
		return
	}
	_ = s.repo.UpsertScanJob(model)
}

func (s *ScanService) recordAudit(ctx context.Context, input AuditEventInput) {
	if s.auditService == nil {
		return
	}
	s.auditService.Record(ctx, input)
}

func generateScanID() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("scan_%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("scan_%d_%s", time.Now().UnixNano(), base64.RawURLEncoding.EncodeToString(buf))
}

func cloneScanRecord(record *ScanRecord) *ScanRecord {
	if record == nil {
		return nil
	}
	cloned := *record

	if record.Projects != nil {
		cloned.Projects = make([]ProjectGraph, len(record.Projects))
		copy(cloned.Projects, record.Projects)
	}
	if record.Errors != nil {
		cloned.Errors = make([]ProjectScanError, len(record.Errors))
		copy(cloned.Errors, record.Errors)
	}
	return &cloned
}

func applyProjectStaleness(projects []ProjectGraph, forceStale bool) []ProjectGraph {
	result := make([]ProjectGraph, len(projects))
	for i, project := range projects {
		cloned := project
		cloned.Stale = forceStale || isProjectStale(cloned.LastScannedAt)
		result[i] = cloned
	}
	return result
}

func isProjectStale(lastScannedAt string) bool {
	if lastScannedAt == "" {
		return true
	}
	scannedAt := parseRFC3339(lastScannedAt)
	if scannedAt == nil {
		return true
	}
	return time.Since(*scannedAt) > inventoryStaleAfter
}

func parseRFC3339(raw string) *time.Time {
	if raw == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return nil
	}
	return &parsed
}

func scanRecordToModel(record *ScanRecord) (*models.ScanJob, error) {
	projectsJSON, err := json.Marshal(record.Projects)
	if err != nil {
		return nil, err
	}
	errorsJSON, err := json.Marshal(record.Errors)
	if err != nil {
		return nil, err
	}

	createdAt := parseRFC3339(record.CreatedAt)
	if createdAt == nil {
		now := time.Now().UTC()
		createdAt = &now
	}

	return &models.ScanJob{
		ID:                record.ScanID,
		ServiceAccountID:  record.ServiceAccountID,
		Actor:             record.Actor,
		Scope:             record.Scope,
		Status:            string(record.Status),
		CreatedAt:         *createdAt,
		StartedAt:         parseRFC3339(record.StartedAt),
		CompletedAt:       parseRFC3339(record.CompletedAt),
		TotalProjects:     record.TotalProjects,
		CompletedProjects: record.CompletedProjects,
		ProjectsJSON:      string(projectsJSON),
		ErrorsJSON:        string(errorsJSON),
	}, nil
}

func scanModelToRecord(model models.ScanJob) *ScanRecord {
	projects := make([]ProjectGraph, 0)
	errorsList := make([]ProjectScanError, 0)

	if model.ProjectsJSON != "" {
		if err := json.Unmarshal([]byte(model.ProjectsJSON), &projects); err != nil {
			projects = make([]ProjectGraph, 0)
		}
	}
	if model.ErrorsJSON != "" {
		if err := json.Unmarshal([]byte(model.ErrorsJSON), &errorsList); err != nil {
			errorsList = make([]ProjectScanError, 0)
		}
	}

	record := &ScanRecord{
		ScanID:            model.ID,
		ServiceAccountID:  model.ServiceAccountID,
		Actor:             model.Actor,
		Scope:             model.Scope,
		Status:            ScanStatus(model.Status),
		CreatedAt:         model.CreatedAt.UTC().Format(time.RFC3339),
		StartedAt:         "",
		CompletedAt:       "",
		TotalProjects:     model.TotalProjects,
		CompletedProjects: model.CompletedProjects,
		Projects:          projects,
		Errors:            errorsList,
	}
	if model.StartedAt != nil {
		record.StartedAt = model.StartedAt.UTC().Format(time.RFC3339)
	}
	if model.CompletedAt != nil {
		record.CompletedAt = model.CompletedAt.UTC().Format(time.RFC3339)
	}
	return record
}
