package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/models"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/repository"
	"github.com/code-yeongyu/gcp-network-planner/go-backend/internal/utils"
	cloudresourcemanager "google.golang.org/api/cloudresourcemanager/v3"
	"google.golang.org/api/option"
)

// ADCCredentialID is the special sentinel ID used to represent
// Application Default Credentials (ADC). When this ID is used,
// the backend will not look up a service account key in the
// database; instead it will let the Google SDK automatically
// resolve credentials via ADC (gcloud auth application-default
// login, GOOGLE_APPLICATION_CREDENTIALS env var, etc.).
const ADCCredentialID = "__adc__"

type ServiceAccountKey struct {
	Type                    string `json:"type"`
	ProjectID               string `json:"project_id"`
	PrivateKeyID            string `json:"private_key_id"`
	PrivateKey              string `json:"private_key"`
	ClientEmail             string `json:"client_email"`
	ClientID                string `json:"client_id"`
	AuthURI                 string `json:"auth_uri"`
	TokenURI                string `json:"token_uri"`
	AuthProviderX509CertURL string `json:"auth_provider_x509_cert_url"`
	ClientX509CertURL       string `json:"client_x509_cert_url"`
	UniverseDomain          string `json:"universe_domain,omitempty"`
}

type CreateServiceAccountInput struct {
	Name              string            `json:"name" validate:"required"`
	ServiceAccountKey ServiceAccountKey `json:"serviceAccountKey" validate:"required"`
}

type CredentialService struct {
	repo       *repository.Repository
	encryption *utils.Encryption
}

func NewCredentialService(repo *repository.Repository, encryption *utils.Encryption) *CredentialService {
	return &CredentialService{
		repo:       repo,
		encryption: encryption,
	}
}

func (s *CredentialService) CreateServiceAccount(input CreateServiceAccountInput) (*models.ServiceAccount, error) {
	if input.Name == "" {
		return nil, errors.New("name is required")
	}

	keyJSON, err := json.Marshal(input.ServiceAccountKey)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal service account key: %w", err)
	}

	encryptedKey, err := s.encryption.Encrypt(string(keyJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt credentials: %w", err)
	}

	serviceAccount := &models.ServiceAccount{
		Name:         input.Name,
		ProjectID:    input.ServiceAccountKey.ProjectID,
		AccountEmail: input.ServiceAccountKey.ClientEmail,
		EncryptedKey: encryptedKey,
		IsActive:     true,
	}

	if err := s.repo.CreateServiceAccount(serviceAccount); err != nil {
		return nil, fmt.Errorf("failed to create service account: %w", err)
	}

	return serviceAccount, nil
}

func (s *CredentialService) GetAllServiceAccounts() ([]models.ServiceAccount, error) {
	return s.repo.GetAllServiceAccounts()
}

func (s *CredentialService) GetServiceAccount(id string) (*models.ServiceAccount, error) {
	return s.repo.GetServiceAccountByID(id)
}

func (s *CredentialService) GetDecryptedCredentials(id string) (*ServiceAccountKey, error) {
	serviceAccount, err := s.repo.GetServiceAccountWithCredentials(id)
	if err != nil {
		return nil, errors.New("service account not found")
	}

	decrypted, err := s.encryption.Decrypt(serviceAccount.EncryptedKey)
	if err != nil {
		return nil, errors.New("failed to decrypt credentials")
	}

	var key ServiceAccountKey
	if err := json.Unmarshal([]byte(decrypted), &key); err != nil {
		return nil, errors.New("failed to parse decrypted credentials")
	}

	return &key, nil
}

// GetGoogleCredentials returns the raw service account JSON bytes suitable
// for option.WithCredentialsJSON. Returns nil, nil for ADC (sentinel ID).
func (s *CredentialService) GetGoogleCredentials(id string) ([]byte, error) {
	if id == ADCCredentialID {
		return nil, nil
	}

	key, err := s.GetDecryptedCredentials(id)
	if err != nil {
		return nil, err
	}

	return json.Marshal(map[string]interface{}{
		"type":                        "service_account",
		"project_id":                  key.ProjectID,
		"private_key_id":              key.PrivateKeyID,
		"private_key":                 key.PrivateKey,
		"client_email":                key.ClientEmail,
		"client_id":                   key.ClientID,
		"auth_uri":                    key.AuthURI,
		"token_uri":                   key.TokenURI,
		"auth_provider_x509_cert_url": key.AuthProviderX509CertURL,
		"client_x509_cert_url":        key.ClientX509CertURL,
		"universe_domain":             key.UniverseDomain,
	})
}

func (s *CredentialService) DeleteServiceAccount(id string) error {
	serviceAccount, err := s.repo.GetServiceAccountByID(id)
	if err != nil {
		return errors.New("service account not found")
	}

	return s.repo.SoftDeleteServiceAccount(serviceAccount.ID)
}

func (s *CredentialService) TestConnection(id string) (bool, string, error) {
	var opts []option.ClientOption

	if id == ADCCredentialID {
		// Use Application Default Credentials — no explicit key needed.
	} else {
		credsJSON, err := s.GetGoogleCredentials(id)
		if err != nil {
			return false, "", err
		}
		opts = append(opts, option.WithCredentialsJSON(credsJSON))
	}

	service, err := cloudresourcemanager.NewService(context.Background(), opts...)
	if err != nil {
		return false, fmt.Sprintf("Failed to create client: %v", err), nil
	}

	// Use Search() with v3 API
	req := service.Projects.Search()
	// Only fetch one page to test connection
	req.PageSize(1)
	_, err = req.Do()
	if err != nil {
		return false, fmt.Sprintf("API Call Failed: %v", err), nil
	}

	return true, "Connection successful", nil
}
