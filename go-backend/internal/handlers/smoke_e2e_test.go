package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/repository"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/services"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/utils"
)

type smokeInventoryBuilder struct{}

func (b *smokeInventoryBuilder) BuildInventory(_ context.Context, _ string, options services.BuildInventoryOptions) ([]services.ProjectGraph, []services.ProjectScanError, error) {
	project := services.ProjectGraph{
		ProjectID:     "smoke-project",
		Name:          "Smoke Project",
		Number:        "999",
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

	if options.OnProjectsLoaded != nil {
		options.OnProjectsLoaded(1)
	}
	if options.OnProjectCompleted != nil {
		options.OnProjectCompleted(project.ProjectID, project, nil)
	}

	return []services.ProjectGraph{project}, nil, nil
}

func TestSmokeServiceAccountScanInventory(t *testing.T) {
	db, err := repository.NewDatabase("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}
	repo := repository.NewRepository(db)

	encryption := utils.NewEncryption("936f2425316f73a12b9870492aef6733b9504147ef113a902065a59de4b0e946")
	credentialService := services.NewCredentialService(repo, encryption)
	auditService := services.NewAuditService(repo)
	credentialHandler := NewCredentialHandler(credentialService, auditService)
	scanService := services.NewScanService(&smokeInventoryBuilder{}, repo, auditService)
	gcpHandler := NewGcpHandler(nil, scanService)

	e := echo.New()
	e.POST("/api/credentials", credentialHandler.CreateServiceAccount)
	e.POST("/api/v1/scans", gcpHandler.CreateScan)
	e.GET("/api/v1/scans/:scanId", gcpHandler.GetScan)
	e.GET("/api/v1/inventory", gcpHandler.GetInventory)

	createPayload := map[string]any{
		"name": "smoke-sa",
		"serviceAccountKey": map[string]string{
			"type":                        "service_account",
			"project_id":                  "smoke-proj",
			"private_key_id":              "key-id",
			"private_key":                 "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
			"client_email":                "smoke@example.iam.gserviceaccount.com",
			"client_id":                   "1234",
			"auth_uri":                    "https://accounts.google.com/o/oauth2/auth",
			"token_uri":                   "https://oauth2.googleapis.com/token",
			"auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
			"client_x509_cert_url":        "https://www.googleapis.com/robot/v1/metadata/x509/smoke",
		},
	}

	createRec := performJSONRequest(t, e, http.MethodPost, "/api/credentials", createPayload, nil)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("unexpected create status: %d body=%s", createRec.Code, createRec.Body.String())
	}

	var created map[string]any
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("failed to decode create response: %v", err)
	}
	serviceAccountID, _ := created["id"].(string)
	if serviceAccountID == "" {
		t.Fatalf("expected created service account id")
	}

	scanRec := performJSONRequest(t, e, http.MethodPost, "/api/v1/scans", map[string]string{
		"serviceAccountId": serviceAccountID,
		"scope":            "project",
	}, map[string]string{
		"X-Actor": "smoke-test",
	})
	if scanRec.Code != http.StatusAccepted {
		t.Fatalf("unexpected scan create status: %d body=%s", scanRec.Code, scanRec.Body.String())
	}

	var scan map[string]any
	if err := json.Unmarshal(scanRec.Body.Bytes(), &scan); err != nil {
		t.Fatalf("failed to decode scan response: %v", err)
	}
	scanID, _ := scan["scanId"].(string)
	if scanID == "" {
		t.Fatalf("expected scan id")
	}

	deadline := time.Now().Add(2 * time.Second)
	var terminal map[string]any
	for time.Now().Before(deadline) {
		statusRec := performJSONRequest(t, e, http.MethodGet, "/api/v1/scans/"+scanID, nil, nil)
		if statusRec.Code != http.StatusOK {
			t.Fatalf("unexpected scan status code: %d", statusRec.Code)
		}
		if err := json.Unmarshal(statusRec.Body.Bytes(), &terminal); err != nil {
			t.Fatalf("failed to decode scan status: %v", err)
		}
		status, _ := terminal["status"].(string)
		if status == "success" || status == "partial" || status == "failed" {
			break
		}
		time.Sleep(30 * time.Millisecond)
	}

	inventoryRec := performJSONRequest(t, e, http.MethodGet, "/api/v1/inventory?serviceAccountId="+serviceAccountID, nil, nil)
	if inventoryRec.Code != http.StatusOK {
		t.Fatalf("unexpected inventory status: %d body=%s", inventoryRec.Code, inventoryRec.Body.String())
	}

	var projects []services.ProjectGraph
	if err := json.Unmarshal(inventoryRec.Body.Bytes(), &projects); err != nil {
		t.Fatalf("failed to decode inventory response: %v", err)
	}
	if len(projects) == 0 {
		t.Fatalf("expected non-empty inventory")
	}
}

func performJSONRequest(t *testing.T, e *echo.Echo, method string, path string, payload any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()

	var body []byte
	var err error
	if payload != nil {
		body, err = json.Marshal(payload)
		if err != nil {
			t.Fatalf("failed to marshal payload: %v", err)
		}
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	if payload != nil {
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}
