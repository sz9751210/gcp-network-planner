package services

import (
	"context"
	"fmt"
	"strings"

	// "github.com/code-yeongyu/gcp-network-planner/go-backend/internal/repository" // REMOVED: Unused
	cloudresourcemanager "google.golang.org/api/cloudresourcemanager/v3"
	compute "google.golang.org/api/compute/v1"
	"google.golang.org/api/container/v1"
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
	Network             string `json:"network"` // Added for aggregation
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

type GcpNodePoolInfo struct {
	Name        string `json:"name"`
	NodeCount   int    `json:"nodeCount"`
	MachineType string `json:"machineType"`
	Version     string `json:"version"`
}

type GcpGkeClusterInfo struct {
	ID                       string            `json:"id"`
	Name                     string            `json:"name"`
	Location                 string            `json:"location"`
	Status                   string            `json:"status"`
	Endpoint                 string            `json:"endpoint"`
	MasterVersion            string            `json:"masterVersion"`
	Network                  string            `json:"network"`
	Subnetwork               string            `json:"subnetwork"`
	ClusterIpv4Cidr          string            `json:"clusterIpv4Cidr"`
	ServicesIpv4Cidr         string            `json:"servicesIpv4Cidr"`
	MasterIpv4Cidr           string            `json:"masterIpv4Cidr"`
	PrivateCluster           bool              `json:"privateCluster"`
	MasterAuthorizedNetworks []string          `json:"masterAuthorizedNetworks"`
	NodePools                []GcpNodePoolInfo `json:"nodePools"`
	VerticalPodAutoscaling   bool              `json:"verticalPodAutoscaling"`
	WorkloadIdentityConfig   bool              `json:"workloadIdentityConfig"`
}

type GcpLoadBalancerInfo struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Type           string `json:"type"`
	Protocol       string `json:"protocol"`
	Region         string `json:"region"`
	IPAddress      string `json:"ipAddress"`
	PortRange      string `json:"portRange"`
	BackendService string `json:"backendService"`
}

type GcpSecurityPolicyRuleInfo struct {
	Priority    int    `json:"priority"`
	Action      string `json:"action"`
	Preview     bool   `json:"preview"`
	SrcIpRanges string `json:"srcIpRanges"` // JSON string of array
	Description string `json:"description"`
}

type GcpCloudArmorPolicyInfo struct {
	ID          string                      `json:"id"`
	Name        string                      `json:"name"`
	Description string                      `json:"description"`
	Type        string                      `json:"type"`
	Rules       []GcpSecurityPolicyRuleInfo `json:"rules"`
}

type GcpDataService struct {
	credentialService *CredentialService
}

func NewGcpDataService(credentialService *CredentialService) *GcpDataService {
	return &GcpDataService{
		credentialService: credentialService,
	}
}

func (s *GcpDataService) getClientOptions(serviceAccountID string) ([]option.ClientOption, error) {
	if serviceAccountID == ADCCredentialID {
		// Empty options — Google SDK will resolve ADC automatically.
		return []option.ClientOption{}, nil
	}
	credsJSON, err := s.credentialService.GetGoogleCredentials(serviceAccountID)
	if err != nil {
		return nil, err
	}
	return []option.ClientOption{option.WithCredentialsJSON(credsJSON)}, nil
}

func (s *GcpDataService) FetchProjects(ctx context.Context, serviceAccountID string) ([]GcpProjectInfo, error) {
	opts, err := s.getClientOptions(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := cloudresourcemanager.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}

	// Use SearchProjects (v3) instead of List (v1).
	// Querying "state:ACTIVE" causes 400 Bad Request in some contexts, so filter in memory.
	req := service.Projects.Search()

	var projects []GcpProjectInfo

	if err := req.Pages(ctx, func(page *cloudresourcemanager.SearchProjectsResponse) error {
		for _, project := range page.Projects {
			if project.ProjectId == "" || project.State != "ACTIVE" {
				continue
			}
			projects = append(projects, GcpProjectInfo{
				ProjectID: project.ProjectId,
				Name:      project.DisplayName,           // Changed from Name to DisplayName for v3
				Number:    extractLastPart(project.Name), // Extract number from "projects/12345"
			})
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return projects, nil
}

func (s *GcpDataService) FetchVpcs(ctx context.Context, serviceAccountID string, projectID string) ([]GcpVpcInfo, error) {
	opts, err := s.getClientOptions(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}

	networkList, err := service.Networks.List(projectID).Context(ctx).Do()
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

func (s *GcpDataService) FetchSubnets(ctx context.Context, serviceAccountID string, projectID string, vpcSelfLink string) ([]GcpSubnetInfo, error) {
	opts, err := s.getClientOptions(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}

	var allSubnets []GcpSubnetInfo

	// FIXED: Removed loop over regions. AggregatedList fetches all regions at once.
	aggList, err := service.Subnetworks.AggregatedList(projectID).Context(ctx).Do()
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
				Network:             subnet.Network, // Populate Network
			}

			allSubnets = append(allSubnets, subnetInfo)
		}
	}

	return allSubnets, nil
}

func (s *GcpDataService) FetchFirewallRules(ctx context.Context, serviceAccountID string, projectID string) ([]GcpFirewallRuleInfo, error) {
	opts, err := s.getClientOptions(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}

	firewallList, err := service.Firewalls.List(projectID).Context(ctx).Do()
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

func (s *GcpDataService) FetchInstances(ctx context.Context, serviceAccountID string, projectID string) ([]GcpInstanceInfo, error) {
	opts, err := s.getClientOptions(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}

	var allInstances []GcpInstanceInfo

	// FIXED: Used AggregatedList instead of looping through hardcoded zones
	aggList, err := service.Instances.AggregatedList(projectID).Context(ctx).Do()
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
	if len(m) == 0 {
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

func (s *GcpDataService) FetchGkeClusters(ctx context.Context, serviceAccountID string, projectID string) ([]GcpGkeClusterInfo, error) {
	opts, err := s.getClientOptions(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := container.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}

	parent := fmt.Sprintf("projects/%s/locations/-", projectID)
	response, err := service.Projects.Locations.Clusters.List(parent).Context(ctx).Do()
	if err != nil {
		// Log error but allow empty return if API is not enabled or permission denied,
		// though ideally we should handle it better. For now, nil is fine.
		return nil, err
	}

	var clusters []GcpGkeClusterInfo
	for _, cluster := range response.Clusters {
		var nodePools []GcpNodePoolInfo
		for _, pool := range cluster.NodePools {
			machineType := ""
			if pool.Config != nil {
				machineType = pool.Config.MachineType
			}
			nodePools = append(nodePools, GcpNodePoolInfo{
				Name:        pool.Name,
				NodeCount:   int(pool.InitialNodeCount), // This is per zone, might need better calc
				MachineType: machineType,
				Version:     pool.Version,
			})
		}

		masterAuthorizedNetworks := make([]string, 0)
		if cluster.MasterAuthorizedNetworksConfig != nil {
			for _, cidr := range cluster.MasterAuthorizedNetworksConfig.CidrBlocks {
				if cidr == nil {
					continue
				}
				masterAuthorizedNetworks = append(masterAuthorizedNetworks, cidr.CidrBlock)
			}
		}

		privateCluster := false
		masterCIDR := ""
		if cluster.PrivateClusterConfig != nil {
			privateCluster = cluster.PrivateClusterConfig.EnablePrivateNodes || cluster.PrivateClusterConfig.EnablePrivateEndpoint
			masterCIDR = cluster.PrivateClusterConfig.MasterIpv4CidrBlock
		}

		clusters = append(clusters, GcpGkeClusterInfo{
			ID:                       cluster.Name, // Using Name as ID for simplicity
			Name:                     cluster.Name,
			Location:                 cluster.Location,
			Status:                   cluster.Status,
			Endpoint:                 cluster.Endpoint,
			MasterVersion:            cluster.CurrentMasterVersion,
			Network:                  extractNetworkName(cluster.Network),
			Subnetwork:               extractLastPart(cluster.Subnetwork),
			ClusterIpv4Cidr:          cluster.ClusterIpv4Cidr,
			ServicesIpv4Cidr:         cluster.ServicesIpv4Cidr,
			MasterIpv4Cidr:           masterCIDR,
			PrivateCluster:           privateCluster,
			MasterAuthorizedNetworks: masterAuthorizedNetworks,
			NodePools:                nodePools,
			VerticalPodAutoscaling:   cluster.VerticalPodAutoscaling != nil && cluster.VerticalPodAutoscaling.Enabled,
			WorkloadIdentityConfig:   cluster.WorkloadIdentityConfig != nil && cluster.WorkloadIdentityConfig.WorkloadPool != "",
		})
	}

	return clusters, nil
}

func (s *GcpDataService) FetchLoadBalancers(ctx context.Context, serviceAccountID string, projectID string) ([]GcpLoadBalancerInfo, error) {
	opts, err := s.getClientOptions(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}

	var lbs []GcpLoadBalancerInfo

	// 1. Forwarding Rules (Entry points)
	aggList, err := service.ForwardingRules.AggregatedList(projectID).Context(ctx).Do()
	if err != nil {
		return nil, err
	}

	for key, item := range aggList.Items {
		if item.ForwardingRules == nil {
			continue
		}
		region := strings.ReplaceAll(key, "regions/", "")

		for _, fr := range item.ForwardingRules {
			lbType := "INTERNAL" // simplified inference
			if fr.LoadBalancingScheme == "EXTERNAL" {
				lbType = "EXTERNAL"
			}

			// Detect protocol
			protocol := fr.IPProtocol

			lbs = append(lbs, GcpLoadBalancerInfo{
				ID:             fmt.Sprintf("%d", fr.Id),
				Name:           fr.Name,
				Type:           lbType,
				Protocol:       protocol,
				Region:         region,
				IPAddress:      fr.IPAddress,
				PortRange:      fr.PortRange,
				BackendService: extractLastPart(fr.BackendService),
			})
		}
	}

	return lbs, nil
}

func (s *GcpDataService) FetchCloudArmorPolicies(ctx context.Context, serviceAccountID string, projectID string) ([]GcpCloudArmorPolicyInfo, error) {
	opts, err := s.getClientOptions(serviceAccountID)
	if err != nil {
		return nil, err
	}

	service, err := compute.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}

	// Security Policies are global usually
	list, err := service.SecurityPolicies.List(projectID).Context(ctx).Do()
	if err != nil {
		return nil, err
	}

	var policies []GcpCloudArmorPolicyInfo
	for _, sp := range list.Items {
		var rules []GcpSecurityPolicyRuleInfo
		for _, r := range sp.Rules {
			action := "allow"
			if r.Action == "deny(403)" || r.Action == "deny(404)" || r.Action == "deny(502)" {
				action = "deny"
			}

			preview := false
			if r.Preview {
				preview = true
			}

			var srcIpRanges []string
			if r.Match != nil && r.Match.Config != nil {
				srcIpRanges = r.Match.Config.SrcIpRanges
			} else if r.Match != nil && r.Match.Expr != nil {
				// Handle expression matched rules if needed, or just set description
				// For now, simpler handling to avoid panic
			}

			rules = append(rules, GcpSecurityPolicyRuleInfo{
				Priority:    int(r.Priority),
				Action:      action,
				Preview:     preview,
				SrcIpRanges: sliceToJSON(srcIpRanges),
				Description: r.Description,
			})
		}

		policies = append(policies, GcpCloudArmorPolicyInfo{
			ID:          fmt.Sprintf("%d", sp.Id),
			Name:        sp.Name,
			Description: sp.Description,
			Type:        sp.Type, // CLOUD_ARMOR or CLOUD_ARMOR_EDGE
			Rules:       rules,
		})
	}

	return policies, nil
}
