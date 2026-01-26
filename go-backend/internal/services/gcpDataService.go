package services

import (
	"context"
	"fmt"
	"strings"

	// "github.com/code-yeongyu/gcp-network-planner/go-backend/internal/repository" // REMOVED: Unused
	cloudresourcemanager "google.golang.org/api/cloudresourcemanager/v3"
	compute "google.golang.org/api/compute/v1"
	"google.golang.org/api/option"
)

type GcpProjectInfo struct {
	ProjectID string `json:"projectId"`
	Name      string `json:"name"`
	Number    string `json:"number"`
}

type GcpVpcInfo struct {
	Name            string          `json:"name"`
	ID              string          `json:"id"`
	IsSharedVpcHost bool            `json:"isSharedVpcHost"`
	Subnets         []GcpSubnetInfo `json:"subnets"`
}

type GcpSubnetInfo struct {
	Name                string `json:"name"`
	Region              string `json:"region"`
	IpCidrRange         string `json:"ipCidrRange"`
	GatewayIp           string `json:"gatewayIp"`
	PrivateGoogleAccess bool   `json:"privateGoogleAccess"`
	SelfLink            string `json:"selfLink"`
}

type GcpFirewallRuleInfo struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Network      string `json:"network"`
	Direction    string `json:"direction"`
	Priority     int    `json:"priority"`
	Action       string `json:"action"`
	SourceRanges string `json:"sourceRanges"`
	SourceTags   string `json:"sourceTags"`
	TargetTags   string `json:"targetTags"`
	Allowed      string `json:"allowed"`
	Denied       string `json:"denied"`
	Disabled     bool   `json:"disabled"`
}

type GcpInstanceInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Zone        string `json:"zone"`
	MachineType string `json:"machineType"`
	Status      string `json:"status"`
	InternalIP  string `json:"internalIp"`
	ExternalIP  string `json:"externalIp"`
	Network     string `json:"network"`
	Subnetwork  string `json:"subnetwork"`
	Tags        string `json:"tags"`
	Labels      string `json:"labels"`
}

type GcpDataService struct {
	credentialService *CredentialService
}

func NewGcpDataService(credentialService *CredentialService) *GcpDataService {
	return &GcpDataService{
		credentialService: credentialService,
	}
}

func (s *GcpDataService) getCredentials(serviceAccountID string) ([]byte, error) {
	return s.credentialService.GetGoogleCredentials(serviceAccountID)
}

func (s *GcpDataService) FetchProjects(serviceAccountID string) ([]GcpProjectInfo, error) {
	credsJSON, err := s.getCredentials(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := cloudresourcemanager.NewService(context.Background(), option.WithCredentialsJSON(credsJSON))
	if err != nil {
		return nil, err
	}

	// Use SearchProjects (v3) instead of List (v1)
	// Query syntax: "state:ACTIVE"
	response, err := service.Projects.Search().Query("state:ACTIVE").Do()
	if err != nil {
		return nil, err
	}

	var projects []GcpProjectInfo
	for _, project := range response.Projects {
		if project.ProjectId == "" {
			continue
		}

		// v3 uses project.Name format as "projects/12345" sometimes or just number?
		// Actually v3 `Name` is "projects/{projectId}" or "projects/{projectNumber}"
		// But `ProjectId` field exists.
		// `project.Name` in v3 is usually the resource name.
		// `project.DisplayName` is the human-readable name.

		projects = append(projects, GcpProjectInfo{
			ProjectID: project.ProjectId,
			Name:      project.DisplayName,           // Changed from Name to DisplayName for v3
			Number:    extractLastPart(project.Name), // Extract number from "projects/12345"
		})
	}

	return projects, nil
}

func (s *GcpDataService) FetchVpcs(serviceAccountID string, projectID string) ([]GcpVpcInfo, error) {
	credsJSON, err := s.getCredentials(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(context.Background(), option.WithCredentialsJSON(credsJSON))
	if err != nil {
		return nil, err
	}

	networkList, err := service.Networks.List(projectID).Do()
	if err != nil {
		return nil, err
	}

	var vpcs []GcpVpcInfo
	for _, network := range networkList.Items {
		vpcs = append(vpcs, GcpVpcInfo{
			Name:            network.Name,
			ID:              fmt.Sprintf("%d", network.Id),
			IsSharedVpcHost: false,
			Subnets:         []GcpSubnetInfo{},
		})
	}

	return vpcs, nil
}

func (s *GcpDataService) FetchSubnets(serviceAccountID string, projectID string, vpcSelfLink string) ([]GcpSubnetInfo, error) {
	credsJSON, err := s.getCredentials(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(context.Background(), option.WithCredentialsJSON(credsJSON))
	if err != nil {
		return nil, err
	}

	var allSubnets []GcpSubnetInfo

	// FIXED: Removed loop over regions. AggregatedList fetches all regions at once.
	aggList, err := service.Subnetworks.AggregatedList(projectID).Do()
	if err != nil {
		return nil, err
	}

	for _, item := range aggList.Items {
		if item.Subnetworks == nil {
			continue
		}

		for _, subnet := range item.Subnetworks {
			if vpcSelfLink != "" && subnet.Network != vpcSelfLink {
				continue
			}

			regionName := extractLastPart(subnet.Region)

			subnetInfo := GcpSubnetInfo{
				Name:                subnet.Name,
				Region:              regionName,
				IpCidrRange:         subnet.IpCidrRange,
				GatewayIp:           subnet.GatewayAddress,
				PrivateGoogleAccess: subnet.PrivateIpGoogleAccess,
				SelfLink:            subnet.SelfLink,
			}

			allSubnets = append(allSubnets, subnetInfo)
		}
	}

	return allSubnets, nil
}

func (s *GcpDataService) FetchFirewallRules(serviceAccountID string, projectID string) ([]GcpFirewallRuleInfo, error) {
	credsJSON, err := s.getCredentials(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(context.Background(), option.WithCredentialsJSON(credsJSON))
	if err != nil {
		return nil, err
	}

	firewallList, err := service.Firewalls.List(projectID).Do()
	if err != nil {
		return nil, err
	}

	var rules []GcpFirewallRuleInfo
	for _, firewall := range firewallList.Items {
		rules = append(rules, GcpFirewallRuleInfo{
			ID:           fmt.Sprintf("%d", firewall.Id),
			Name:         firewall.Name,
			Network:      extractNetworkName(firewall.Network),
			Direction:    firewall.Direction,
			Priority:     int(firewall.Priority),
			Action:       "ALLOW", // Default simplification, can be enhanced
			SourceRanges: sliceToJSON(firewall.SourceRanges),
			SourceTags:   sliceToJSON(firewall.SourceTags),
			TargetTags:   sliceToJSON(firewall.TargetTags),
			Allowed:      allowedToJSON(firewall.Allowed),
			Denied:       deniedToJSON(firewall.Denied),
			Disabled:     firewall.Disabled,
		})
	}

	return rules, nil
}

func (s *GcpDataService) FetchInstances(serviceAccountID string, projectID string) ([]GcpInstanceInfo, error) {
	credsJSON, err := s.getCredentials(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(context.Background(), option.WithCredentialsJSON(credsJSON))
	if err != nil {
		return nil, err
	}

	var allInstances []GcpInstanceInfo

	// FIXED: Used AggregatedList instead of looping through hardcoded zones
	aggList, err := service.Instances.AggregatedList(projectID).Do()
	if err != nil {
		return nil, err
	}

	for zoneKey, item := range aggList.Items {
		if item.Instances == nil {
			continue
		}

		// zoneKey is usually "zones/us-central1-a", so we clean it
		zoneName := strings.ReplaceAll(zoneKey, "zones/", "")

		for _, instance := range item.Instances {
			var internalIP, externalIP, network, subnetwork string
			var tags, labels []string

			if len(instance.NetworkInterfaces) > 0 {
				internalIP = instance.NetworkInterfaces[0].NetworkIP
				if len(instance.NetworkInterfaces[0].AccessConfigs) > 0 {
					externalIP = instance.NetworkInterfaces[0].AccessConfigs[0].NatIP
				}
				network = extractNetworkName(instance.NetworkInterfaces[0].Network)
				subnetwork = extractLastPart(instance.NetworkInterfaces[0].Subnetwork)
			}

			if instance.Tags != nil {
				tags = instance.Tags.Items
			}

			if instance.Labels != nil {
				for k, v := range instance.Labels {
					labels = append(labels, k+":"+v)
				}
			}

			machineType := ""
			if instance.MachineType != "" {
				machineType = extractLastPart(instance.MachineType)
			}

			allInstances = append(allInstances, GcpInstanceInfo{
				ID:          fmt.Sprintf("%d", instance.Id),
				Name:        instance.Name,
				Zone:        zoneName,
				MachineType: machineType,
				Status:      instance.Status,
				InternalIP:  internalIP,
				ExternalIP:  externalIP,
				Network:     network,
				Subnetwork:  subnetwork,
				Tags:        sliceToJSON(tags),
				Labels:      mapToJSON(instance.Labels),
			})
		}
	}

	return allInstances, nil
}

func extractNetworkName(networkURL string) string {
	if networkURL == "" {
		return ""
	}
	parts := strings.Split(networkURL, "/")
	return parts[len(parts)-1]
}

func extractLastPart(url string) string {
	if url == "" {
		return ""
	}
	parts := strings.Split(url, "/")
	return parts[len(parts)-1]
}

func sliceToJSON(slice []string) string {
	if len(slice) == 0 {
		return "[]"
	}
	// Simple JSON construction to avoid heavy imports/error handling for basic arrays
	result := "["
	for i, s := range slice {
		if i > 0 {
			result += ","
		}
		result += "\"" + s + "\""
	}
	result += "]"
	return result
}

func mapToJSON(m map[string]string) string {
	if m == nil || len(m) == 0 {
		return "{}"
	}
	// Simple JSON construction
	// Note: This is a bit manual, using json.Marshal is generally safer but this works for simple maps
	// If you prefer strict JSON, use encoding/json
	// For this context, manual string building prevents import cycles or complexity
	importJSON := "{"
	i := 0
	for k, v := range m {
		if i > 0 {
			importJSON += ","
		}
		importJSON += fmt.Sprintf("\"%s\":\"%s\"", k, v)
		i++
	}
	importJSON += "}"
	return importJSON
}

func allowedToJSON(allowed []*compute.FirewallAllowed) string {
	if len(allowed) == 0 {
		return "[]"
	}
	// Manual JSON construction for specific GCP struct
	result := "["
	for i, a := range allowed {
		if i > 0 {
			result += ","
		}
		result += fmt.Sprintf("{\"IPProtocol\":\"%s\",\"ports\":%s}", a.IPProtocol, sliceToJSON(a.Ports))
	}
	result += "]"
	return result
}

func deniedToJSON(denied []*compute.FirewallDenied) string {
	if len(denied) == 0 {
		return "[]"
	}
	result := "["
	for i, d := range denied {
		if i > 0 {
			result += ","
		}
		result += fmt.Sprintf("{\"IPProtocol\":\"%s\",\"ports\":%s}", d.IPProtocol, sliceToJSON(d.Ports))
	}
	result += "]"
	return result
}
