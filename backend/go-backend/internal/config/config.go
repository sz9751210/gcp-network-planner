package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL     string
	EncryptionKey   string
	Port           string
	Host           string
	Env            string
	CorsOrigins    string
}

var AppConfig *Config

func Load() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found, using environment variables: %v", err)
	}

	cfg := &Config{
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		EncryptionKey:   os.Getenv("ENCRYPTION_KEY"),
		Port:           os.Getenv("PORT"),
		Host:           os.Getenv("HOST"),
		Env:            os.Getenv("ENV"),
		CorsOrigins:    os.Getenv("CORS_ORIGINS"),
	}

	if cfg.Port == "" {
		cfg.Port = "3001"
	}

	if cfg.Host == "" {
		cfg.Host = "0.0.0.0"
	}

	if cfg.Env == "" {
		cfg.Env = "development"
	}

	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = "file:./dev.db"
	}

	if cfg.EncryptionKey == "" {
		return nil, &ConfigError{Field: "ENCRYPTION_KEY", Message: "ENCRYPTION_KEY environment variable is required"}
	}

	if len(cfg.EncryptionKey) != 64 {
		return nil, &ConfigError{Field: "ENCRYPTION_KEY", Message: "ENCRYPTION_KEY must be 64-character hex string"}
	}

	if cfg.CorsOrigins == "" {
		cfg.CorsOrigins = "http://localhost:3000"
	}

	AppConfig = cfg
	return cfg, nil
}

type ConfigError struct {
	Field   string
	Message string
}

func (e *ConfigError) Error() string {
	return strings.Join([]string{e.Field, e.Message}, ": ")
}

func GetCorsOrigins() []string {
	if AppConfig == nil {
		return []string{"http://localhost:3000"}
	}
	return strings.Split(AppConfig.CorsOrigins, ",")
}
