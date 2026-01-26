package models

import (
	"time"

	"github.com/google/uuid"
)

// GcpInstance represents a GCE instance
type GcpInstance struct {
	ID         string    `gorm:"primaryKey;type:varchar(255)" json:"id"`
	Name       string    `gorm:"uniqueIndex;not null" json:"name"`
	InstanceID string    `gorm:"column:instanceId;not null" json:"instanceId"`
	Zone       string    `gorm:"not null" json:"zone"`
	MachineType string   `gorm:"column:machineType;not null" json:"machineType"`
	Status     string    `gorm:"index:idx_gcp_instances_status;not null" json:"status"`
	InternalIP string    `gorm:"column:internalIp;not null" json:"internalIp"`
	ExternalIP *string   `gorm:"column:externalIp" json:"externalIp,omitempty"`
	Network    string    `gorm:"not null" json:"network"`
	Subnetwork string    `gorm:"not null" json:"subnetwork"`
	Tags       string    `gorm:"type:text" json:"tags"`
	Labels     string    `gorm:"type:text" json:"labels"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// BeforeCreate hook to generate UUID before creating an instance
func (gi *GcpInstance) BeforeCreate(tx *gorm.DB) (err error) {
	if gi.ID == "" {
		gi.ID = uuid.New().String()
	}
	return
}

// TableName specifies the table name for GcpInstance model
func (GcpInstance) TableName() string {
	return "gcp_instances"
}
