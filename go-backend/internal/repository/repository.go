package repository

import (
	"errors"
	"time"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/models"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(database *Database) *Repository {
	return &Repository{db: database.DB}
}

func (r *Repository) CreateServiceAccount(sa *models.ServiceAccount) error {
	return r.db.Create(sa).Error
}

func (r *Repository) GetAllServiceAccounts() ([]models.ServiceAccount, error) {
	var accounts []models.ServiceAccount
	err := r.db.Where("is_active = ?", true).
		Select("id, name, project_id, account_email, created_at, updated_at").
		Order("created_at DESC").
		Find(&accounts).Error
	return accounts, err
}

func (r *Repository) GetServiceAccountByID(id string) (*models.ServiceAccount, error) {
	var account models.ServiceAccount
	err := r.db.Where("id = ? AND is_active = ?", id, true).
		Select("id, name, project_id, account_email, created_at, updated_at").
		First(&account).Error
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func (r *Repository) GetServiceAccountWithCredentials(id string) (*models.ServiceAccount, error) {
	var account models.ServiceAccount
	err := r.db.Where("id = ? AND is_active = ?", id, true).First(&account).Error
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func (r *Repository) SoftDeleteServiceAccount(id string) error {
	return r.db.Model(&models.ServiceAccount{}).
		Where("id = ?", id).
		Update("is_active", false).Error
}

func (r *Repository) CreateGcpProject(project *models.GcpProject) error {
	return r.db.Create(project).Error
}

func (r *Repository) GetGcpProjectByProjectID(projectID string) (*models.GcpProject, error) {
	var project models.GcpProject
	err := r.db.Where("project_id = ? AND is_active = ?", projectID, true).First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *Repository) UpdateGcpProjectLastScanned(projectID string) error {
	now := time.Now()
	return r.db.Model(&models.GcpProject{}).
		Where("project_id = ?", projectID).
		Updates(map[string]interface{}{
			"last_scanned_at": &now,
			"updated_at":      time.Now(),
		}).Error
}

func (r *Repository) CreateGcpVpc(vpc *models.GcpVpc) error {
	return r.db.Create(vpc).Error
}

func (r *Repository) GetGcpVpcsByProjectID(projectID string) ([]models.GcpVpc, error) {
	var vpcs []models.GcpVpc
	err := r.db.Where("project_id = ?", projectID).Find(&vpcs).Error
	return vpcs, err
}

func (r *Repository) CreateGcpSubnet(subnet *models.GcpSubnet) error {
	return r.db.Create(subnet).Error
}

func (r *Repository) CreateGcpFirewallRules(rules []models.GcpFirewallRule) error {
	if len(rules) == 0 {
		return nil
	}
	return r.db.Create(&rules).Error
}

func (r *Repository) CreateGcpInstances(instances []models.GcpInstance) error {
	if len(instances) == 0 {
		return nil
	}
	return r.db.Create(&instances).Error
}

func (r *Repository) DeleteGcpFirewallRulesByNetwork(network string) error {
	return r.db.Where("network = ?", network).Delete(&models.GcpFirewallRule{}).Error
}

func (r *Repository) DeleteGcpInstancesByNetwork(network string) error {
	return r.db.Where("network = ?", network).Delete(&models.GcpInstance{}).Error
}

func (r *Repository) UpsertScanJob(job *models.ScanJob) error {
	return r.db.Save(job).Error
}

func (r *Repository) GetScanJobByID(id string) (*models.ScanJob, error) {
	var job models.ScanJob
	err := r.db.Where("id = ?", id).First(&job).Error
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *Repository) ListScanJobs() ([]models.ScanJob, error) {
	var jobs []models.ScanJob
	err := r.db.Order("created_at DESC").Find(&jobs).Error
	return jobs, err
}

func (r *Repository) GetLatestCompletedScanJobByServiceAccount(serviceAccountID string) (*models.ScanJob, error) {
	var job models.ScanJob
	err := r.db.
		Where("service_account_id = ? AND status IN ?", serviceAccountID, []string{"success", "partial"}).
		Order("completed_at DESC").
		First(&job).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &job, nil
}

func (r *Repository) CreateAuditEvent(event *models.AuditEvent) error {
	return r.db.Create(event).Error
}
