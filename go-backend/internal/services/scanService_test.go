package services

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

type inventoryBuildResponse struct {
	projects        []ProjectGraph
	projectErrors   []ProjectScanError
	err             error
	perProjectDelay time.Duration
}

type queuedInventoryBuilder struct {
	mu        sync.Mutex
	responses []inventoryBuildResponse
}

func (b *queuedInventoryBuilder) BuildInventory(ctx context.Context, _ string, options BuildInventoryOptions) ([]ProjectGraph, []ProjectScanError, error) {
	b.mu.Lock()
	if len(b.responses) == 0 {
		b.mu.Unlock()
		return nil, nil, errors.New("no inventory response configured")
	}
	response := b.responses[0]
	b.responses = b.responses[1:]
	b.mu.Unlock()

	if options.OnProjectsLoaded != nil {
		options.OnProjectsLoaded(len(response.projects))
	}

	errorsByProject := map[string]error{}
	for _, projectErr := range response.projectErrors {
		errorsByProject[projectErr.ProjectID] = errors.New(projectErr.Error)
	}

	for _, project := range response.projects {
		if response.perProjectDelay > 0 {
			select {
			case <-ctx.Done():
				return nil, nil, ctx.Err()
			case <-time.After(response.perProjectDelay):
			}
		}

		if options.OnProjectCompleted != nil {
			options.OnProjectCompleted(project.ProjectID, project, errorsByProject[project.ProjectID])
		}
	}

	return response.projects, response.projectErrors, response.err
}

func testProject(id string, scannedAt time.Time) ProjectGraph {
	return ProjectGraph{
		ProjectID:     id,
		Name:          id,
		Number:        "1",
		VPCs:          []ProjectVpc{},
		Instances:     []ProjectInstance{},
		FirewallRules: []ProjectFirewallRule{},
		LoadBalancers: []ProjectLoadBalancer{},
		ArmorPolicies: []ProjectCloudArmorPolicy{},
		IAMPolicy:     []ProjectIAMBinding{},
		GKEClusters:   []ProjectGKECluster{},
		LastScannedAt: scannedAt.UTC().Format(time.RFC3339),
		Stale:         false,
	}
}

func waitForTerminalStatus(t *testing.T, scanService *ScanService, scanID string, timeout time.Duration) *ScanRecord {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		record, ok := scanService.GetScan(scanID)
		if !ok {
			t.Fatalf("scan %s not found", scanID)
		}
		if record.Status == ScanStatusSuccess || record.Status == ScanStatusPartial || record.Status == ScanStatusFailed {
			return record
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for terminal state: %s", scanID)
	return nil
}

func TestScanStateTransitionAndProgress(t *testing.T) {
	builder := &queuedInventoryBuilder{
		responses: []inventoryBuildResponse{
			{
				projects: []ProjectGraph{
					testProject("project-a", time.Now()),
					testProject("project-b", time.Now()),
				},
				projectErrors: []ProjectScanError{
					{ProjectID: "project-b", Error: "permission denied"},
				},
				perProjectDelay: 60 * time.Millisecond,
			},
		},
	}
	scanService := NewScanService(builder, nil, nil)

	record, err := scanService.CreateScan("sa-1", "project", "tester")
	if err != nil {
		t.Fatalf("CreateScan failed: %v", err)
	}
	if record.Status != ScanStatusQueued {
		t.Fatalf("expected queued status, got %s", record.Status)
	}

	progressObserved := false
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		current, ok := scanService.GetScan(record.ScanID)
		if !ok {
			t.Fatalf("scan not found")
		}
		if current.Status == ScanStatusRunning && current.CompletedProjects > 0 {
			progressObserved = true
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if !progressObserved {
		t.Fatalf("expected running progress updates before completion")
	}

	final := waitForTerminalStatus(t, scanService, record.ScanID, 2*time.Second)
	if final.Status != ScanStatusPartial {
		t.Fatalf("expected partial status, got %s", final.Status)
	}
	if final.TotalProjects != 2 || final.CompletedProjects != 2 {
		t.Fatalf("unexpected progress totals: total=%d completed=%d", final.TotalProjects, final.CompletedProjects)
	}
	if len(final.Errors) != 1 || final.Errors[0].ProjectID != "project-b" {
		t.Fatalf("unexpected project errors: %+v", final.Errors)
	}
}

func TestLatestInventoryMarkedStaleAfterFailedScan(t *testing.T) {
	builder := &queuedInventoryBuilder{
		responses: []inventoryBuildResponse{
			{
				projects: []ProjectGraph{
					testProject("project-a", time.Now()),
				},
			},
			{
				err: errors.New("upstream api unavailable"),
			},
		},
	}
	scanService := NewScanService(builder, nil, nil)

	firstScan, err := scanService.CreateScan("sa-2", "project", "tester")
	if err != nil {
		t.Fatalf("CreateScan first failed: %v", err)
	}
	firstFinal := waitForTerminalStatus(t, scanService, firstScan.ScanID, 2*time.Second)
	if firstFinal.Status != ScanStatusSuccess {
		t.Fatalf("expected first scan success, got %s", firstFinal.Status)
	}

	secondScan, err := scanService.CreateScan("sa-2", "project", "tester")
	if err != nil {
		t.Fatalf("CreateScan second failed: %v", err)
	}
	secondFinal := waitForTerminalStatus(t, scanService, secondScan.ScanID, 2*time.Second)
	if secondFinal.Status != ScanStatusFailed {
		t.Fatalf("expected second scan failed, got %s", secondFinal.Status)
	}

	inventory, ok := scanService.GetLatestCompletedInventory("sa-2")
	if !ok {
		t.Fatalf("expected latest completed inventory")
	}
	if len(inventory) != 1 {
		t.Fatalf("expected 1 project in inventory, got %d", len(inventory))
	}
	if !inventory[0].Stale {
		t.Fatalf("expected fallback inventory to be marked stale")
	}
}
