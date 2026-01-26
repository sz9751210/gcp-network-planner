package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GcpProject represents a GCP project
type GcpProject struct {
	ID                string     `gorm:"primaryKey;type:varchar(255)" json:"id"`
	ProjectID         string     `gorm:"uniqueIndex;not null" json:"projectId"`
	Name              string     `gorm:"not null" json:"name"`
	Number            string     `gorm:"not null" json:"number"`
	IsActive          bool       `gorm:"default:true" json:"isActive"`
	LastScannedAt     *time.Time `json:"lastScannedAt,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
	ServiceAccountID  *string    `gorm:"uniqueIndex" json:"serviceAccountId,omitempty"`
	ServiceAccount    *ServiceAccount `gorm:"foreignKey:ServiceAccountID" json:"serviceAccount,omitempty"`
	Vpcs              []GcpVpc   `gorm:"foreignKey:GcpProjectID" json:"vpcs,omitempty"`
}

// BeforeCreate hook to generate UUID before creating a GCP project
func (gp *GcpProject) BeforeCreate(tx *gorm.DB) error {
	if gp.ID == "" {
		gp.ID = uuid.New().String()
	}
	return nil
}

// TableName specifies the table name for GcpProject model
func (GcpProject) TableName() string {
	return "gcp_projects"
}
