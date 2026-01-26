package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GcpVpc represents a GCP VPC network
type GcpVpc struct {
	ID            string        `gorm:"primaryKey;type:varchar(255)" json:"id"`
	Name          string        `gorm:"not null" json:"name"`
	VpcID         string        `gorm:"not null" json:"vpcId"`
	ProjectID     string        `gorm:"not null" json:"projectId"`
	GcpProjectID  string        `gorm:"index:idx_gcp_vpcs_gcp_project_id;not null" json:"gcpProjectId"`
	IsSharedVpcHost bool         `gorm:"default:false" json:"isSharedVpcHost"`
	Mtu           *int          `json:"mtu,omitempty"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`
	Project       GcpProject    `gorm:"foreignKey:GcpProjectID;references:ID;constraint:OnDelete:CASCADE" json:"-"`
	Subnets       []GcpSubnet   `gorm:"foreignKey:GcpVpcID" json:"subnets,omitempty"`
	Peerings      []GcpVpcPeering `gorm:"foreignKey:GcpVpcID" json:"peerings,omitempty"`
	Routes        []GcpRoute    `gorm:"foreignKey:GcpVpcID" json:"routes,omitempty"`
}

// BeforeCreate hook to generate UUID before creating a VPC
func (gv *GcpVpc) BeforeCreate(tx *gorm.DB) error {
	if gv.ID == "" {
		gv.ID = uuid.New().String()
	}
	return nil
}

// TableName specifies the table name for GcpVpc model
func (GcpVpc) TableName() string {
	return "gcp_vpcs"
}
