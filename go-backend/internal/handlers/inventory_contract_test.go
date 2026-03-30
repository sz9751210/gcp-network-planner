package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/services"
)

type staticInventoryBuilder struct {
	projects []services.ProjectGraph
	errors   []services.ProjectScanError
	err      error
}

func (b *staticInventoryBuilder) BuildInventory(_ context.Context, _ string, options services.BuildInventoryOptions) ([]services.ProjectGraph, []services.ProjectScanError, error) {
	if options.OnProjectsLoaded != nil {
		options.OnProjectsLoaded(len(b.projects))
	}
	for _, project := range b.projects {
		if options.OnProjectCompleted != nil {
			options.OnProjectCompleted(project.ProjectID, project, nil)
		}
	}
	return b.projects, b.errors, b.err
}

func buildContractProject() services.ProjectGraph {
	return services.ProjectGraph{
		ProjectID:     "contract-project",
		Name:          "Contract Project",
		Number:        "123",
		VPCs:          []services.ProjectVpc{},
		Instances:     []services.ProjectInstance{},
		FirewallRules: []services.ProjectFirewallRule{},
		LoadBalancers: []services.ProjectLoadBalancer{},
		ArmorPolicies: []services.ProjectCloudArmorPolicy{},
		IAMPolicy:     []services.ProjectIAMBinding{},
		GKEClusters:   []services.ProjectGKECluster{},
		LastScannedAt: time.Now().UTC().Format(time.RFC3339),
		Stale:         false,
	}
}

func newContractHandler() *GcpHandler {
	builder := &staticInventoryBuilder{
		projects: []services.ProjectGraph{buildContractProject()},
	}
	scanService := services.NewScanService(builder, nil, nil)
	return NewGcpHandler(nil, scanService)
}

func TestInventoryContractSchema(t *testing.T) {
	handler := newContractHandler()
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/inventory?serviceAccountId=sa-contract", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.GetInventory(c); err != nil {
		t.Fatalf("GetInventory returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", rec.Code)
	}

	var projects []services.ProjectGraph
	if err := json.Unmarshal(rec.Body.Bytes(), &projects); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(projects) != 1 {
		t.Fatalf("expected 1 project, got %d", len(projects))
	}

	project := projects[0]
	if project.IAMPolicy == nil || project.GKEClusters == nil || project.LoadBalancers == nil || project.ArmorPolicies == nil {
		t.Fatalf("canonical arrays must not be nil")
	}
	if project.LastScannedAt == "" {
		t.Fatalf("lastScannedAt must be populated")
	}
}

func TestInventoryAliasEquivalent(t *testing.T) {
	handler := newContractHandler()
	e := echo.New()

	reqV1 := httptest.NewRequest(http.MethodGet, "/api/v1/inventory?serviceAccountId=sa-contract", nil)
	recV1 := httptest.NewRecorder()
	if err := handler.GetInventory(e.NewContext(reqV1, recV1)); err != nil {
		t.Fatalf("GetInventory returned error: %v", err)
	}

	reqAlias := httptest.NewRequest(http.MethodGet, "/api/gcp/all-data?serviceAccountId=sa-contract", nil)
	recAlias := httptest.NewRecorder()
	if err := handler.GetAllProjectData(e.NewContext(reqAlias, recAlias)); err != nil {
		t.Fatalf("GetAllProjectData returned error: %v", err)
	}

	var v1Payload []services.ProjectGraph
	var aliasPayload []services.ProjectGraph
	if err := json.Unmarshal(recV1.Body.Bytes(), &v1Payload); err != nil {
		t.Fatalf("failed to decode v1 response: %v", err)
	}
	if err := json.Unmarshal(recAlias.Body.Bytes(), &aliasPayload); err != nil {
		t.Fatalf("failed to decode alias response: %v", err)
	}

	if !reflect.DeepEqual(v1Payload, aliasPayload) {
		t.Fatalf("alias response differs from v1 response")
	}
}
