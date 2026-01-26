package database

import (
	"gcp-network-planner-backend/internal/config"
	"gcp-network-planner-backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(cfg *config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector

	if cfg.DatabaseURL == "file:./dev.db" || len(cfg.DatabaseURL) < 20 {
		dialector = sqlite.Open(cfg.DatabaseURL)
	} else {
		dialector = postgres.Open(cfg.DatabaseURL)
	}

	logLevel := logger.Silent
	if cfg.Env == "development" {
		logLevel = logger.Info
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, err
	}

	err = db.AutoMigrate(
		&models.ServiceAccount{},
		&models.GcpProject{},
		&models.GcpVpc{},
		&models.GcpSubnet{},
		&models.GcpVpcPeering{},
		&models.GcpRoute{},
		&models.GcpInstance{},
		&models.GcpFirewallRule{},
	)
	if err != nil {
		return nil, err
	}

	DB = db
	return db, nil
}

func GetDB() *gorm.DB {
	return DB
}
