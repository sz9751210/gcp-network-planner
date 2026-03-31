package repository

import (
	"fmt"
	"time"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Database struct {
	*gorm.DB
}

func NewDatabase(dsn string) (*Database, error) {
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	return &Database{db}, nil
}

func (d *Database) AutoMigrate() error {
	if err := d.DB.AutoMigrate(
		&models.ServiceAccount{},
		&models.GcpProject{},
		&models.GcpVpc{},
		&models.GcpSubnet{},
		&models.GcpVpcPeering{},
		&models.GcpRoute{},
		&models.GcpInstance{},
		&models.GcpFirewallRule{},
		&models.ScanJob{},
		&models.AuditEvent{},
	); err != nil {
		return err
	}

	indexDDL := []string{
		"CREATE INDEX IF NOT EXISTS idx_audit_events_query ON audit_events(timestamp DESC, action, result, target_type, actor)",
		"CREATE INDEX IF NOT EXISTS idx_scan_jobs_query ON scan_jobs(service_account_id, created_at DESC, status)",
	}
	for _, ddl := range indexDDL {
		if err := d.DB.Exec(ddl).Error; err != nil {
			return err
		}
	}
	return nil
}

func (d *Database) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
