package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/services"
)

type CredentialHandler struct {
	credentialService *services.CredentialService
}

func NewCredentialHandler(credentialService *services.CredentialService) *CredentialHandler {
	return &CredentialHandler{
		credentialService: credentialService,
	}
}

type CreateServiceAccountRequest struct {
	Name              string                     `json:"name"`
	ServiceAccountKey services.ServiceAccountKey `json:"serviceAccountKey"`
}

func (h *CredentialHandler) CreateServiceAccount(c echo.Context) error {
	var req CreateServiceAccountRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "Name is required",
		})
	}

	input := services.CreateServiceAccountInput{
		Name:              req.Name,
		ServiceAccountKey: req.ServiceAccountKey,
	}

	account, err := h.credentialService.CreateServiceAccount(input)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to create service account",
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":           account.ID,
		"name":         account.Name,
		"projectId":    account.ProjectID,
		"accountEmail": account.AccountEmail,
		"createdAt":    account.CreatedAt,
	})
}

func (h *CredentialHandler) ListServiceAccounts(c echo.Context) error {
	accounts, err := h.credentialService.GetAllServiceAccounts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to fetch service accounts",
		})
	}

	result := make([]map[string]interface{}, 0)
	for _, account := range accounts {
		result = append(result, map[string]interface{}{
			"id":           account.ID,
			"name":         account.Name,
			"projectId":    account.ProjectID,
			"accountEmail": account.AccountEmail,
			"createdAt":    account.CreatedAt,
			"updatedAt":    account.UpdatedAt,
		})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *CredentialHandler) GetServiceAccount(c echo.Context) error {
	id := c.Param("id")

	account, err := h.credentialService.GetServiceAccount(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.JSON(http.StatusNotFound, map[string]interface{}{
				"error": "Service account not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to fetch service account",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"id":           account.ID,
		"name":         account.Name,
		"projectId":    account.ProjectID,
		"accountEmail": account.AccountEmail,
		"createdAt":    account.CreatedAt,
		"updatedAt":    account.UpdatedAt,
	})
}

func (h *CredentialHandler) DeleteServiceAccount(c echo.Context) error {
	id := c.Param("id")

	err := h.credentialService.DeleteServiceAccount(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.JSON(http.StatusNotFound, map[string]interface{}{
				"error": "Service account not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to delete service account",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Service account deleted successfully",
	})
}

func (h *CredentialHandler) TestConnection(c echo.Context) error {
	id := c.Param("id")

	success, msg, err := h.credentialService.TestConnection(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to test connection",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": success,
		"message": msg,
	})
}
