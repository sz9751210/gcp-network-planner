package types

import (
	"encoding/json"
	"net/url"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin/binding"
)

type ServiceAccountKey struct {
	Type                   string `json:"type"`
	ProjectID              string `json:"project_id"`
	PrivateKeyID          string `json:"private_key_id"`
	PrivateKey             string `json:"private_key"`
	ClientEmail           string `json:"client_email"`
	ClientID             string `json:"client_id"`
	AuthURI              string `json:"auth_uri"`
	TokenURI             string `json:"token_uri"`
	AuthProviderX509CertURL string `json:"auth_provider_x509_cert_url"`
	ClientX509CertURL     string `json:"client_x509_cert_url"`
	UniverseDomain        *string `json:"universe_domain,omitempty"`
}

type CreateServiceAccountRequest struct {
	Name              string            `json:"name" binding:"required"`
	ServiceAccountKey ServiceAccountKey `json:"serviceAccountKey" binding:"required"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

type SuccessResponse struct {
	Message string `json:"message"`
}

var urlValidator = regexp.MustCompile(`^https?://`)
var emailValidator = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

func ValidateCreateServiceAccountRequest(req *CreateServiceAccountRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return &ValidationError{Field: "name", Message: "Name is required"}
	}

	sak := req.ServiceAccountKey

	if sak.Type != "service_account" {
		return &ValidationError{Field: "serviceAccountKey.type", Message: "Type must be 'service_account'"}
	}

	if strings.TrimSpace(sak.ProjectID) == "" {
		return &ValidationError{Field: "serviceAccountKey.project_id", Message: "Project ID is required"}
	}

	if strings.TrimSpace(sak.PrivateKeyID) == "" {
		return &ValidationError{Field: "serviceAccountKey.private_key_id", Message: "Private key ID is required"}
	}

	if strings.TrimSpace(sak.PrivateKey) == "" {
		return &ValidationError{Field: "serviceAccountKey.private_key", Message: "Private key is required"}
	}

	if !emailValidator.MatchString(sak.ClientEmail) {
		return &ValidationError{Field: "serviceAccountKey.client_email", Message: "Invalid email format"}
	}

	if strings.TrimSpace(sak.ClientID) == "" {
		return &ValidationError{Field: "serviceAccountKey.client_id", Message: "Client ID is required"}
	}

	if !urlValidator.MatchString(sak.AuthURI) {
		return &ValidationError{Field: "serviceAccountKey.auth_uri", Message: "Invalid auth URI format"}
	}

	if !urlValidator.MatchString(sak.TokenURI) {
		return &ValidationError{Field: "serviceAccountKey.token_uri", Message: "Invalid token URI format"}
	}

	if !urlValidator.MatchString(sak.AuthProviderX509CertURL) {
		return &ValidationError{Field: "serviceAccountKey.auth_provider_x509_cert_url", Message: "Invalid auth provider cert URL format"}
	}

	if !urlValidator.MatchString(sak.ClientX509CertURL) {
		return &ValidationError{Field: "serviceAccountKey.client_x509_cert_url", Message: "Invalid client cert URL format"}
	}

	return nil
}

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}

func CustomJSONValidator() binding.ValidatorFunc {
	return func(fl binding.FieldLevel) bool {
		if fl.Field().String() != "" {
			return true
		}
		return false
	}
}

func ParseServiceAccountKeyJSON(data string) (*ServiceAccountKey, error) {
	var sak ServiceAccountKey
	err := json.Unmarshal([]byte(data), &sak)
	if err != nil {
		return nil, err
	}
	return &sak, nil
}

func ParseURLToName(u string) string {
	if u == "" {
		return ""
	}
	parts := strings.Split(u, "/")
	return parts[len(parts)-1]
}
