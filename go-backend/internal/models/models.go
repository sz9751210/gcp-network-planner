package models

import (
	"time"

	"github.com/jaevor/go-nanoid"
	"gorm.io/gorm"
)

// ID generator
var generateID func() string

func init() {
	var err error
	// Use standard length 21 for nanoid
	generateID, err = nanoid.Standard(21)
	if err != nil {
		panic(err)
	}
}

type ServiceAccount struct {
	ID           string       `gorm:"primaryKey;size:21" json:"id"`
	Name         string       `gorm:"size:255;not null" json:"name"`
	ProjectID    string       `gorm:"size:255;not null;index" json:"projectId"`
	AccountEmail string       `gorm:"size:255;not null" json:"accountEmail"`
	EncryptedKey string       `gorm:"size:1024;not null" json:"-"`
	IsActive     bool         `gorm:"default:true" json:"isActive"`
	CreatedAt    time.Time    `json:"createdAt"`
	UpdatedAt    time.Time    `json:"updatedAt"`
	GcpProjects  []GcpProject `gorm:"foreignKey:ServiceAccountID" json:"gcpProjects,omitempty"`
}

type GcpProject struct {
	ID               string          `gorm:"primaryKey;size:21" json:"id"`
	ProjectID        string          `gorm:"uniqueIndex;size:255;not null" json:"projectId"`
	Name             string          `gorm:"size:255;not null" json:"name"`
	Number           string          `gorm:"size:255" json:"number"`
	IsActive         bool            `gorm:"default:true" json:"isActive"`
	LastScannedAt    *time.Time      `json:"lastScannedAt,omitempty"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`
	ServiceAccountID *string         `gorm:"uniqueIndex;size:21" json:"serviceAccountId,omitempty"`
	ServiceAccount   *ServiceAccount `gorm:"foreignKey:ServiceAccountID" json:"serviceAccount,omitempty"`
	Vpcs             []GcpVpc        `gorm:"foreignKey:GcpProjectID" json:"vpcs,omitempty"`
}

type GcpVpc struct {
	ID              string          `gorm:"primaryKey;size:21" json:"id"`
	Name            string          `gorm:"size:255;not null" json:"name"`
	VpcID           string          `gorm:"size:255;not null" json:"vpcId"`
	ProjectID       string          `gorm:"size:255;not null;index" json:"projectId"`
	GcpProjectID    string          `gorm:"size:21;not null;index" json:"gcpProjectId"`
	IsSharedVpcHost bool            `gorm:"default:false" json:"isSharedVpcHost"`
	Mtu             *int            `json:"mtu,omitempty"`
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
	Project         GcpProject      `gorm:"foreignKey:GcpProjectID" json:"project,omitempty"`
	Subnets         []GcpSubnet     `gorm:"foreignKey:GcpVpcID" json:"subnets,omitempty"`
	Peerings        []GcpVpcPeering `gorm:"foreignKey:GcpVpcID" json:"peerings,omitempty"`
	Routes          []GcpRoute      `gorm:"foreignKey:GcpVpcID" json:"routes,omitempty"`
}

type GcpSubnet struct {
	ID                  string    `gorm:"primaryKey;size:21" json:"id"`
	Name                string    `gorm:"size:255;not null" json:"name"`
	Region              string    `gorm:"size:255;not null;index" json:"region"`
	IpCidrRange         string    `gorm:"size:45;not null" json:"ipCidrRange"`
	GatewayIp           string    `gorm:"size:45" json:"gatewayIp"`
	PrivateGoogleAccess bool      `gorm:"default:false" json:"privateGoogleAccess"`
	SelfLink            string    `gorm:"size:512" json:"selfLink"`
	VpcID               string    `gorm:"size:255;not null;index" json:"vpcId"`
	GcpVpcID            string    `gorm:"size:21;not null;index" json:"gcpVpcId"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
	Vpc                 GcpVpc    `gorm:"foreignKey:GcpVpcID" json:"vpc,omitempty"`
}

type GcpVpcPeering struct {
	ID                 string    `gorm:"primaryKey;size:21" json:"id"`
	Name               string    `gorm:"size:255;not null" json:"name"`
	TargetNetwork      string    `gorm:"size:512;not null" json:"targetNetwork"`
	State              string    `gorm:"size:50;not null" json:"state"`
	ExportCustomRoutes bool      `gorm:"default:false" json:"exportCustomRoutes"`
	ImportCustomRoutes bool      `gorm:"default:false" json:"importCustomRoutes"`
	VpcID              string    `gorm:"size:255;not null;index" json:"vpcId"`
	GcpVpcID           string    `gorm:"size:21;not null;index" json:"gcpVpcId"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
	Vpc                GcpVpc    `gorm:"foreignKey:GcpVpcID" json:"vpc,omitempty"`
}

type GcpRoute struct {
	ID          string    `gorm:"primaryKey;size:21" json:"id"`
	Name        string    `gorm:"size:255;not null" json:"name"`
	VpcID       string    `gorm:"size:255;not null;index" json:"vpcId"`
	GcpVpcID    string    `gorm:"size:21;not null;index" json:"gcpVpcId"`
	DestRange   string    `gorm:"size:45;not null" json:"destRange"`
	NextHop     string    `gorm:"size:512" json:"nextHop"`
	Priority    int       `json:"priority"`
	Description string    `gorm:"size:512" json:"description,omitempty"`
	Tags        string    `gorm:"size:512" json:"tags"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Vpc         GcpVpc    `gorm:"foreignKey:GcpVpcID" json:"vpc,omitempty"`
}

type GcpInstance struct {
	ID          string    `gorm:"primaryKey;size:21" json:"id"`
	Name        string    `gorm:"uniqueIndex;size:255;not null" json:"name"`
	InstanceID  string    `gorm:"size:255" json:"instanceId"`
	Zone        string    `gorm:"size:255;not null;index" json:"zone"`
	MachineType string    `gorm:"size:255" json:"machineType"`
	Status      string    `gorm:"size:50;not null;index" json:"status"`
	InternalIP  string    `gorm:"size:45" json:"internalIp"`
	ExternalIP  string    `gorm:"size:45" json:"externalIp,omitempty"`
	Network     string    `gorm:"size:255" json:"network"`
	Subnetwork  string    `gorm:"size:255" json:"subnetwork"`
	Tags        string    `gorm:"size:512" json:"tags"`
	Labels      string    `gorm:"size:1024" json:"labels"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type GcpFirewallRule struct {
	ID           string    `gorm:"primaryKey;size:21" json:"id"`
	Name         string    `gorm:"uniqueIndex;size:255;not null" json:"name"`
	Network      string    `gorm:"size:255;not null;index" json:"network"`
	Direction    string    `gorm:"size:50;not null" json:"direction"`
	Priority     int       `json:"priority"`
	Action       string    `gorm:"size:50;not null" json:"action"`
	Description  string    `gorm:"size:512" json:"description,omitempty"`
	SourceRanges string    `gorm:"size:1024" json:"sourceRanges"`
	SourceTags   string    `gorm:"size:512" json:"sourceTags"`
	TargetTags   string    `gorm:"size:512" json:"targetTags"`
	Allowed      string    `gorm:"size:1024" json:"allowed"`
	Denied       string    `gorm:"size:1024" json:"denied"`
	Disabled     bool      `gorm:"default:false" json:"disabled"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// TableName overrides the default table name for ServiceAccount
func (ServiceAccount) TableName() string {
	return "service_accounts"
}

// TableName overrides the default table name for GcpProject
func (GcpProject) TableName() string {
	return "gcp_projects"
}

// TableName overrides the default table name for GcpVpc
func (GcpVpc) TableName() string {
	return "gcp_vpcs"
}

// TableName overrides the default table name for GcpSubnet
func (GcpSubnet) TableName() string {
	return "gcp_subnets"
}

// default table name for GcpVpcPeering
func (GcpVpcPeering) TableName() string {
	return "gcp_vpc_peerings"
}

// TableName overrides the default table name for GcpRoute
func (GcpRoute) TableName() string {
	return "gcp_routes"
}

// TableName overrides the default table name for GcpInstance
func (GcpInstance) TableName() string {
	return "gcp_instances"
}

// TableName overrides the default table name for GcpFirewallRule
func (GcpFirewallRule) TableName() string {
	return "gcp_firewall_rules"
}

// BeforeCreate hooks for ID generation
func (sa *ServiceAccount) BeforeCreate(tx *gorm.DB) (err error) {
	if sa.ID == "" {
		sa.ID = generateID()
	}
	return nil
}

func (gp *GcpProject) BeforeCreate(tx *gorm.DB) (err error) {
	if gp.ID == "" {
		gp.ID = generateID()
	}
	return nil
}

func (vpc *GcpVpc) BeforeCreate(tx *gorm.DB) (err error) {
	if vpc.ID == "" {
		vpc.ID = generateID()
	}
	return nil
}

func (s *GcpSubnet) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == "" {
		s.ID = generateID()
	}
	return nil
}

func (p *GcpVpcPeering) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == "" {
		p.ID = generateID()
	}
	return nil
}

func (r *GcpRoute) BeforeCreate(tx *gorm.DB) (err error) {
	if r.ID == "" {
		r.ID = generateID()
	}
	return nil
}

func (i *GcpInstance) BeforeCreate(tx *gorm.DB) (err error) {
	if i.ID == "" {
		i.ID = generateID()
	}
	return nil
}

func (f *GcpFirewallRule) BeforeCreate(tx *gorm.DB) (err error) {
	if f.ID == "" {
		f.ID = generateID()
	}
	return nil
}

// BeforeDelete soft delete by updating isActive flag
func (sa *ServiceAccount) BeforeDelete(tx *gorm.DB) error {
	return tx.Model(sa).Update("is_active", false).Error
}

// BeforeDelete soft delete by updating isActive flag
func (gp *GcpProject) BeforeDelete(tx *gorm.DB) error {
	return tx.Model(gp).Update("is_active", false).Error
}
