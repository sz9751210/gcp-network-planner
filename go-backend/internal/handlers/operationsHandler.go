package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/services"
)

type OperationsHandler struct {
	scanService  *services.ScanService
	auditService *services.AuditService
}

func NewOperationsHandler(scanService *services.ScanService, auditService *services.AuditService) *OperationsHandler {
	return &OperationsHandler{
		scanService:  scanService,
		auditService: auditService,
	}
}

func (h *OperationsHandler) ListScans(c echo.Context) error {
	status := strings.TrimSpace(c.QueryParam("status"))
	if status != "" {
		switch services.ScanStatus(status) {
		case services.ScanStatusQueued, services.ScanStatusRunning, services.ScanStatusPartial, services.ScanStatusSuccess, services.ScanStatusFailed:
		default:
			return c.JSON(http.StatusBadRequest, map[string]any{
				"error": "invalid status filter",
			})
		}
	}

	from, err := parseOptionalRFC3339(c.QueryParam("from"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": "invalid from time (RFC3339 required)",
		})
	}
	to, err := parseOptionalRFC3339(c.QueryParam("to"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": "invalid to time (RFC3339 required)",
		})
	}
	limit, err := parseOptionalLimit(c.QueryParam("limit"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": "invalid limit",
		})
	}

	result, err := h.scanService.ListScans(services.ScanListFilters{
		ServiceAccountID: strings.TrimSpace(c.QueryParam("serviceAccountId")),
		Status:           status,
		From:             from,
		To:               to,
		Limit:            limit,
		Cursor:           strings.TrimSpace(c.QueryParam("cursor")),
	})
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": err.Error(),
		})
	}
	return c.JSON(http.StatusOK, result)
}

func (h *OperationsHandler) ListAuditEvents(c echo.Context) error {
	from, err := parseOptionalRFC3339(c.QueryParam("from"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": "invalid from time (RFC3339 required)",
		})
	}
	to, err := parseOptionalRFC3339(c.QueryParam("to"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": "invalid to time (RFC3339 required)",
		})
	}
	limit, err := parseOptionalLimit(c.QueryParam("limit"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": "invalid limit",
		})
	}

	result, err := h.auditService.ListEvents(c.Request().Context(), services.AuditEventListFilters{
		From:       from,
		To:         to,
		Action:     strings.TrimSpace(c.QueryParam("action")),
		Result:     strings.TrimSpace(c.QueryParam("result")),
		TargetType: strings.TrimSpace(c.QueryParam("targetType")),
		TargetID:   strings.TrimSpace(c.QueryParam("targetId")),
		Actor:      strings.TrimSpace(c.QueryParam("actor")),
		ScanID:     strings.TrimSpace(c.QueryParam("scanId")),
		Limit:      limit,
		Cursor:     strings.TrimSpace(c.QueryParam("cursor")),
	})
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": err.Error(),
		})
	}
	return c.JSON(http.StatusOK, result)
}

func parseOptionalRFC3339(raw string) (*time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, err
	}
	utc := parsed.UTC()
	return &utc, nil
}

func parseOptionalLimit(raw string) (int, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid limit")
	}
	return parsed, nil
}
