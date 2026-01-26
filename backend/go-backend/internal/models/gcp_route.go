package models

import (
	"time"

	"github.com/google/uuid"
)

// GcpRoute represents a GCP route
type GcpRoute struct {
	ID          string    `gorm:"primaryKey;type:varchar(255)" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	VpcID       string    `gorm:"not null" json:"vpcId"`
	GcpVpcID    string    `gorm:"index:idx_gcp_routes_gcp_vpc_id;not null" json:"gcpVpcId"`
	DestRange   string    `gorm:"column:destRange;not null" json:"destRange"`
	NextHop     string    `gorm:"not null" json:"nextHop"`
	Priority    int       `gorm:"not null" json:"priority"`
	Description *string   `json:"description,omitempty"`
	Tags        string    `gorm:"type:text" json:"tags"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Vpc         GcpVpc    `gorm:"foreignKey:GcpVpcID;references:ID;constraint:OnDelete:CASCADE" json:"-"`
}

// BeforeCreate hook to generate UUID before creating a route
func (gr *GcpRoute) BeforeCreate(tx *gorm.DB) (err error) {
	if gr.ID == "" {
		gr.ID = uuid.New().String()
	}
	return
}

// TableName specifies the table name for GcpRoute model
func (GcpRoute) TableName() string {
	return "gcp_routes"
}
