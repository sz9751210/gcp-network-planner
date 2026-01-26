package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ServiceAccount represents a GCP service account with encrypted credentials
type ServiceAccount struct {
	ID             string         `gorm:"primaryKey;type:varchar(255)" json:"id"`
	Name           string         `gorm:"not null" json:"name"`
	ProjectID      string         `gorm:"index:idx_service_accounts_project_id;not null" json:"projectId"`
	AccountEmail   string         `gorm:"not null" json:"accountEmail"`
	EncryptedKey   string         `gorm:"type:text;not null" json:"-"`
	IsActive       bool           `gorm:"default:true;index" json:"isActive"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	GcpProjects    []GcpProject   `gorm:"foreignKey:ServiceAccountID" json:"gcpProjects,omitempty"`
}

// BeforeCreate hook to generate UUID before creating a service account
func (sa *ServiceAccount) BeforeCreate(tx *gorm.DB) error {
	if sa.ID == "" {
		sa.ID = uuid.New().String()
	}
	return nil
}

// TableName specifies the table name for ServiceAccount model
func (ServiceAccount) TableName() string {
	return "service_accounts"
}
