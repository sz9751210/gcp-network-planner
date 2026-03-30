package services

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"sync"
	"time"
)

const (
	scanScopeProject       = "project"
	scanTimeout            = 8 * time.Minute
	scanQueueBufferSize    = 128
	scanProjectConcurrency = 4
	scanProjectTimeout     = 20 * time.Second
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

type ScanService struct {
	gcpDataService *GcpDataService

	mu              sync.RWMutex
	jobs            map[string]*ScanRecord
	latestByAccount map[string]string
	queue           chan string
}

func NewScanService(gcpDataService *GcpDataService) *ScanService {
	service := &ScanService{
		gcpDataService:  gcpDataService,
		jobs:            make(map[string]*ScanRecord),
		latestByAccount: make(map[string]string),
		queue:           make(chan string, scanQueueBufferSize),
	}

	go service.worker()
	return service
}

func (s *ScanService) CreateScan(serviceAccountID string, scope string) (*ScanRecord, error) {
	if serviceAccountID == "" {
		return nil, errors.New("serviceAccountId is required")
	}

	if scope == "" {
		scope = scanScopeProject
	}
	if scope != scanScopeProject {
		return nil, fmt.Errorf("unsupported scope: %s", scope)
	}

	scanID := generateScanID()
	now := time.Now().UTC().Format(time.RFC3339)

	record := &ScanRecord{
		ScanID:            scanID,
		ServiceAccountID:  serviceAccountID,
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
	s.mu.RUnlock()
	return projects, true
}

func (s *ScanService) BuildInventoryNow(serviceAccountID string) ([]ProjectGraph, []ProjectScanError, error) {
	ctx, cancel := context.WithTimeout(context.Background(), scanTimeout)
	defer cancel()

	return s.gcpDataService.BuildInventory(ctx, serviceAccountID, BuildInventoryOptions{
		ProjectConcurrency: scanProjectConcurrency,
		ProjectTimeout:     scanProjectTimeout,
	})
}

func (s *ScanService) worker() {
	for scanID := range s.queue {
		s.runScan(scanID)
	}
}

func (s *ScanService) runScan(scanID string) {
	s.mu.Lock()
	record, ok := s.jobs[scanID]
	if !ok {
		s.mu.Unlock()
		return
	}
	record.Status = ScanStatusRunning
	record.StartedAt = time.Now().UTC().Format(time.RFC3339)
	s.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), scanTimeout)
	defer cancel()

	projects, projectErrors, err := s.gcpDataService.BuildInventory(ctx, record.ServiceAccountID, BuildInventoryOptions{
		ProjectConcurrency: scanProjectConcurrency,
		ProjectTimeout:     scanProjectTimeout,
	})

	s.mu.Lock()
	defer s.mu.Unlock()

	record.CompletedAt = time.Now().UTC().Format(time.RFC3339)
	record.Projects = projects
	record.Errors = projectErrors
	record.TotalProjects = len(projects)
	record.CompletedProjects = len(projects)

	if err != nil {
		record.Status = ScanStatusFailed
		record.Errors = append(record.Errors, ProjectScanError{
			ProjectID: "",
			Error:     err.Error(),
		})
		return
	}

	if len(projectErrors) > 0 {
		record.Status = ScanStatusPartial
	} else {
		record.Status = ScanStatusSuccess
	}

	s.latestByAccount[record.ServiceAccountID] = scanID
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
