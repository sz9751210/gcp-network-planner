package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/config"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/handlers"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/repository"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/services"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/utils"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("Failed to load config: %v", err))
	}

	// Initialize encryption utility
	encryption := utils.NewEncryption(cfg.EncryptionKey)

	// Initialize database
	db, err := repository.NewDatabase(cfg.DatabaseURL)
	if err != nil {
		panic(fmt.Sprintf("Failed to connect to database: %v", err))
	}

	// Auto-migrate database schema
	if err := db.AutoMigrate(); err != nil {
		panic(fmt.Sprintf("Failed to migrate database: %v", err))
	}

	// Initialize repository
	repo := repository.NewRepository(db)

	// Initialize services
	credentialService := services.NewCredentialService(repo, encryption)
	gcpDataService := services.NewGcpDataService(credentialService)
	auditService := services.NewAuditService(repo)
	scanService := services.NewScanService(gcpDataService, repo, auditService)
	retentionCtx, retentionCancel := context.WithCancel(context.Background())
	auditService.StartRetentionWorker(retentionCtx, 6*time.Hour)

	// Initialize handlers
	credentialHandler := handlers.NewCredentialHandler(credentialService, auditService)
	gcpHandler := handlers.NewGcpHandler(gcpDataService, scanService)
	operationsHandler := handlers.NewOperationsHandler(scanService, auditService)

	// Initialize Echo
	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, "X-Actor"},
		AllowCredentials: true,
	}))

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":    "ok",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// API routes
	api := e.Group("/api")
	api.POST("/credentials", credentialHandler.CreateServiceAccount)
	api.GET("/credentials", credentialHandler.ListServiceAccounts)
	api.GET("/credentials/adc/status", credentialHandler.GetADCStatus)
	api.GET("/credentials/:id", credentialHandler.GetServiceAccount)
	api.DELETE("/credentials/:id", credentialHandler.DeleteServiceAccount)
	api.POST("/credentials/:id/test", credentialHandler.TestConnection)

	api.GET("/gcp", gcpHandler.GetProjects)
	api.GET("/gcp/all-data", gcpHandler.GetAllProjectData)
	api.GET("/gcp/:projectId/vpcs", gcpHandler.GetVpcs)
	api.GET("/gcp/:projectId/firewalls", gcpHandler.GetFirewallRules)
	api.GET("/gcp/:projectId/instances", gcpHandler.GetInstances)
	api.POST("/v1/scans", gcpHandler.CreateScan)
	api.GET("/v1/scans", operationsHandler.ListScans)
	api.GET("/v1/scans/:scanId", gcpHandler.GetScan)
	api.GET("/v1/inventory", gcpHandler.GetInventory)
	api.GET("/v1/audit-events", operationsHandler.ListAuditEvents)

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		retentionCancel()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := e.Shutdown(ctx); err != nil {
			fmt.Printf("Error during shutdown: %v\n", err)
		}
	}()

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	fmt.Printf(`
  🚀 GCP Network Planner Backend Server (Go)
  📍 Port: %s
  🌍 Environment: %s
  📡 Health Check: http://localhost%s/health
  `, cfg.Port, cfg.Environment, addr)

	if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
		fmt.Printf("Server error: %v\n", err)
	}
}
