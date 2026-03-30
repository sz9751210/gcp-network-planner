package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/services"
)

type GcpHandler struct {
	gcpDataService *services.GcpDataService
	scanService    *services.ScanService
}

func NewGcpHandler(gcpDataService *services.GcpDataService, scanService *services.ScanService) *GcpHandler {
	return &GcpHandler{
		gcpDataService: gcpDataService,
		scanService:    scanService,
	}
}

func (h *GcpHandler) GetProjects(c echo.Context) error {
	serviceAccountID := c.QueryParam("serviceAccountId")
	if serviceAccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "serviceAccountId query parameter is required",
		})
	}

	projects, err := h.gcpDataService.FetchProjects(c.Request().Context(), serviceAccountID)
	if err != nil {
		fmt.Printf("Error fetching projects for SA %s: %v\n", serviceAccountID, err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch GCP projects",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, projects)
}

type createScanRequest struct {
	ServiceAccountID string `json:"serviceAccountId"`
	Scope            string `json:"scope"`
}

func (h *GcpHandler) CreateScan(c echo.Context) error {
	var req createScanRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
	}

	record, err := h.scanService.CreateScan(req.ServiceAccountID, req.Scope, actorFromRequest(c))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusAccepted, record)
}

func (h *GcpHandler) GetScan(c echo.Context) error {
	scanID := c.Param("scanId")
	if scanID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "scanId is required",
		})
	}

	record, ok := h.scanService.GetScan(scanID)
	if !ok {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"error": "scan not found",
		})
	}

	return c.JSON(http.StatusOK, record)
}

func (h *GcpHandler) GetInventory(c echo.Context) error {
	serviceAccountID := c.QueryParam("serviceAccountId")
	if serviceAccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "serviceAccountId query parameter is required",
		})
	}

	inventory, scanErrors, err := h.resolveInventory(c.Request().Context(), serviceAccountID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch GCP inventory",
			"details": err.Error(),
		})
	}

	if len(scanErrors) > 0 {
		c.Response().Header().Set("X-Inventory-Partial", "true")
		c.Response().Header().Set("X-Inventory-Error-Count", fmt.Sprintf("%d", len(scanErrors)))
	}

	return c.JSON(http.StatusOK, inventory)
}

func (h *GcpHandler) GetAllProjectData(c echo.Context) error {
	serviceAccountID := c.QueryParam("serviceAccountId")
	if serviceAccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "serviceAccountId query parameter is required",
		})
	}

	inventory, _, err := h.resolveInventory(c.Request().Context(), serviceAccountID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch GCP project data",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, inventory)
}

func (h *GcpHandler) GetVpcs(c echo.Context) error {
	serviceAccountID := c.QueryParam("serviceAccountId")
	if serviceAccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "serviceAccountId query parameter is required",
		})
	}

	projectID := c.Param("projectId")

	vpcs, err := h.gcpDataService.FetchVpcs(c.Request().Context(), serviceAccountID, projectID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch VPCs",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, vpcs)
}

func (h *GcpHandler) GetFirewallRules(c echo.Context) error {
	serviceAccountID := c.QueryParam("serviceAccountId")
	if serviceAccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "serviceAccountId query parameter is required",
		})
	}

	projectID := c.Param("projectId")

	rules, err := h.gcpDataService.FetchFirewallRules(c.Request().Context(), serviceAccountID, projectID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch firewall rules",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, rules)
}

func (h *GcpHandler) GetInstances(c echo.Context) error {
	serviceAccountID := c.QueryParam("serviceAccountId")
	if serviceAccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "serviceAccountId query parameter is required",
		})
	}

	projectID := c.Param("projectId")

	instances, err := h.gcpDataService.FetchInstances(c.Request().Context(), serviceAccountID, projectID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch instances",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, instances)
}

func (h *GcpHandler) resolveInventory(ctx context.Context, serviceAccountID string) ([]services.ProjectGraph, []services.ProjectScanError, error) {
	if inventory, ok := h.scanService.GetLatestCompletedInventory(serviceAccountID); ok {
		return inventory, make([]services.ProjectScanError, 0), nil
	}

	return h.scanService.BuildInventoryNow(ctx, serviceAccountID)
}

func actorFromRequest(c echo.Context) string {
	actor := strings.TrimSpace(c.Request().Header.Get("X-Actor"))
	if actor == "" {
		return "system"
	}
	return actor
}
