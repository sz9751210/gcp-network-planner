package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port           string
	Environment    string
	DatabaseURL    string
	EncryptionKey  string
	CORSOrigins    []string
}

func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	environment := os.Getenv("NODE_ENV")
	if environment == "" {
		environment = "development"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "file:./dev.db"
	}

	encryptionKey := os.Getenv("ENCRYPTION_KEY")
	if encryptionKey == "" {
		return nil, fmt.Errorf("ENCRYPTION_KEY environment variable is required")
	}
	if len(encryptionKey) != 64 {
		return nil, fmt.Errorf("ENCRYPTION_KEY must be 64 characters, got %d", len(encryptionKey))
	}

	corsOrigins := os.Getenv("CORS_ORIGINS")
	var origins []string
	if corsOrigins != "" {
		origins = strings.Split(corsOrigins, ",")
	} else {
		origins = []string{"http://localhost:3000"}
	}

	return &Config{
		Port:          port,
		Environment:   environment,
		DatabaseURL:   databaseURL,
		EncryptionKey: encryptionKey,
		CORSOrigins:   origins,
	}, nil
}
