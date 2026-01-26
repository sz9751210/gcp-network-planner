package models

import (
	"time"

	"github.com/google/uuid"
)

// GcpVpcPeering represents a GCP VPC peering connection
type GcpVpcPeering struct {
	ID                 string   `gorm:"primaryKey;type:varchar(255)" json:"id"`
	Name               string   `gorm:"not null" json:"name"`
	TargetNetwork      string   `gorm:"column:targetNetwork;not null" json:"targetNetwork"`
	State              string   `gorm:"not null" json:"state"`
	ExportCustomRoutes bool     `gorm:"column:exportCustomRoutes;default:false" json:"exportCustomRoutes"`
	ImportCustomRoutes bool     `gorm:"column:importCustomRoutes;default:false" json:"importCustomRoutes"`
	VpcID              string   `gorm:"not null" json:"vpcId"`
	GcpVpcID           string   `gorm:"index:idx_gcp_vpc_peerings_gcp_vpc_id;not null" json:"gcpVpcId"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
	Vpc                GcpVpc   `gorm:"foreignKey:GcpVpcID;references:ID;constraint:OnDelete:CASCADE" json:"-"`
}

// BeforeCreate hook to generate UUID before creating a VPC peering
func (gvp *GcpVpcPeering) BeforeCreate(tx *gorm.DB) (err error) {
	if gvp.ID == "" {
		gvp.ID = uuid.New().String()
	}
	return
}

// TableName specifies the table name for GcpVpcPeering model
func (GcpVpcPeering) TableName() string {
	return "gcp_vpc_peerings"
}
