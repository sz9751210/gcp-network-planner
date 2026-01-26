package handlers

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/services"
)

type GcpHandler struct {
	gcpDataService *services.GcpDataService
}

func NewGcpHandler(gcpDataService *services.GcpDataService) *GcpHandler {
	return &GcpHandler{
		gcpDataService: gcpDataService,
	}
}

func (h *GcpHandler) GetProjects(c echo.Context) error {
	serviceAccountID := c.QueryParam("serviceAccountId")
	if serviceAccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "serviceAccountId query parameter is required",
		})
	}

	projects, err := h.gcpDataService.FetchProjects(serviceAccountID)
	if err != nil {
		fmt.Printf("Error fetching projects for SA %s: %v\n", serviceAccountID, err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch GCP projects",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, projects)
}

func (h *GcpHandler) GetAllProjectData(c echo.Context) error {
	serviceAccountID := c.QueryParam("serviceAccountId")
	if serviceAccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "serviceAccountId query parameter is required",
		})
	}

	projects, err := h.gcpDataService.FetchProjects(serviceAccountID)
	if err != nil {
		// Log the actual error to console
		fmt.Printf("Error fetching projects for SA %s: %v\n", serviceAccountID, err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch GCP projects",
			"details": err.Error(),
		})
	}

	projectsWithDetails := make([]map[string]interface{}, 0)

	for _, project := range projects {
		projectData := map[string]interface{}{
			"projectId":     project.ProjectID,
			"name":          project.Name,
			"number":        project.Number,
			"vpcs":          []map[string]interface{}{},
			"firewallRules": []map[string]interface{}{},
			"instances":     []map[string]interface{}{},
		}

		vpcs, err := h.gcpDataService.FetchVpcs(serviceAccountID, project.ProjectID)
		if err == nil {
			projectData["vpcs"] = vpcs
		}

		firewallRules, err := h.gcpDataService.FetchFirewallRules(serviceAccountID, project.ProjectID)
		if err == nil {
			projectData["firewallRules"] = firewallRules
		}

		instances, err := h.gcpDataService.FetchInstances(serviceAccountID, project.ProjectID)
		if err == nil {
			projectData["instances"] = instances
		}

		projectsWithDetails = append(projectsWithDetails, projectData)
	}

	return c.JSON(http.StatusOK, projectsWithDetails)
}

func (h *GcpHandler) GetVpcs(c echo.Context) error {
	serviceAccountID := c.QueryParam("serviceAccountId")
	if serviceAccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "serviceAccountId query parameter is required",
		})
	}

	projectID := c.Param("projectId")

	vpcs, err := h.gcpDataService.FetchVpcs(serviceAccountID, projectID)
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

	rules, err := h.gcpDataService.FetchFirewallRules(serviceAccountID, projectID)
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

	instances, err := h.gcpDataService.FetchInstances(serviceAccountID, projectID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch instances",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, instances)
}
