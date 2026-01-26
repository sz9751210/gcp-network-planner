package models

import (
	"time"

	"github.com/google/uuid"
)

// GcpSubnet represents a GCP subnet
type GcpSubnet struct {
	ID                    string   `gorm:"primaryKey;type:varchar(255)" json:"id"`
	Name                  string   `gorm:"not null" json:"name"`
	Region                string   `gorm:"index:idx_gcp_subnets_region;not null" json:"region"`
	IpCidrRange           string   `gorm:"column:ipCidrRange;not null" json:"ipCidrRange"`
	GatewayIp             string   `gorm:"column:gatewayIp;not null" json:"gatewayIp"`
	PrivateGoogleAccess   bool     `gorm:"column:privateGoogleAccess;default:false" json:"privateGoogleAccess"`
	SelfLink              string   `gorm:"not null" json:"selfLink"`
	VpcID                 string   `gorm:"not null" json:"vpcId"`
	GcpVpcID              string   `gorm:"index:idx_gcp_subnets_gcp_vpc_id;not null" json:"gcpVpcId"`
	CreatedAt             time.Time `json:"createdAt"`
	UpdatedAt             time.Time `json:"updatedAt"`
	Vpc                   GcpVpc   `gorm:"foreignKey:GcpVpcID;references:ID;constraint:OnDelete:CASCADE" json:"-"`
}

// BeforeCreate hook to generate UUID before creating a subnet
func (gs *GcpSubnet) BeforeCreate(tx *gorm.DB) (err error) {
	if gs.ID == "" {
		gs.ID = uuid.New().String()
	}
	return
}

// TableName specifies the table name for GcpSubnet model
func (GcpSubnet) TableName() string {
	return "gcp_subnets"
}
