package models

import (
	"time"

	"github.com/google/uuid"
)

// GcpFirewallRule represents a GCP firewall rule
type GcpFirewallRule struct {
	ID           string    `gorm:"primaryKey;type:varchar(255)" json:"id"`
	Name         string    `gorm:"uniqueIndex;not null" json:"name"`
	Network      string    `gorm:"index:idx_gcp_firewall_rules_network;not null" json:"network"`
	Direction    string    `gorm:"not null" json:"direction"`
	Priority     int       `gorm:"not null" json:"priority"`
	Action       string    `gorm:"not null" json:"action"`
	Description  *string   `json:"description,omitempty"`
	SourceRanges string    `gorm:"column:sourceRanges;type:text" json:"sourceRanges"`
	SourceTags   string    `gorm:"column:sourceTags;type:text" json:"sourceTags"`
	TargetTags   string    `gorm:"column:targetTags;type:text" json:"targetTags"`
	Allowed      string    `gorm:"type:text" json:"allowed"`
	Denied       string    `gorm:"type:text" json:"denied"`
	Disabled     bool      `gorm:"default:false" json:"disabled"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// BeforeCreate hook to generate UUID before creating a firewall rule
func (gfr *GcpFirewallRule) BeforeCreate(tx *gorm.DB) (err error) {
	if gfr.ID == "" {
		gfr.ID = uuid.New().String()
	}
	return
}

// TableName specifies the table name for GcpFirewallRule model
func (GcpFirewallRule) TableName() string {
	return "gcp_firewall_rules"
}
