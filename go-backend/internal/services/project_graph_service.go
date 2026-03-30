package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	defaultProjectConcurrency = 4
	defaultProjectTimeout     = 20 * time.Second
)

type BuildInventoryOptions struct {
	ProjectConcurrency int
	ProjectTimeout     time.Duration
	OnProjectsLoaded   func(totalProjects int)
	OnProjectCompleted func(projectID string, graph ProjectGraph, projectErr error)
}

type ProjectFirewallPort struct {
	IPProtocol string   `json:"IPProtocol"`
	Ports      []string `json:"ports,omitempty"`
}

type ProjectSubnet struct {
	Name                string `json:"name"`
	Region              string `json:"region"`
	IpCidrRange         string `json:"ipCidrRange"`
	GatewayIp           string `json:"gatewayIp"`
	PrivateGoogleAccess bool   `json:"privateGoogleAccess"`
	SelfLink            string `json:"selfLink"`
}

type ProjectVpcPeering struct {
	Name               string `json:"name"`
	TargetNetwork      string `json:"targetNetwork"`
	State              string `json:"state"`
	ExportCustomRoutes bool   `json:"exportCustomRoutes"`
	ImportCustomRoutes bool   `json:"importCustomRoutes"`
}

type ProjectRoute struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Network     string   `json:"network"`
	DestRange   string   `json:"destRange"`
	NextHop     string   `json:"nextHop"`
	Priority    int      `json:"priority"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

type ProjectVpc struct {
	Name            string              `json:"name"`
	ID              string              `json:"id"`
	IsSharedVpcHost bool                `json:"isSharedVpcHost"`
	Subnets         []ProjectSubnet     `json:"subnets"`
	Mtu             *int                `json:"mtu,omitempty"`
	Peerings        []ProjectVpcPeering `json:"peerings,omitempty"`
	Routes          []ProjectRoute      `json:"routes,omitempty"`
}

type ProjectInstance struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Zone        string            `json:"zone"`
	MachineType string            `json:"machineType"`
	Status      string            `json:"status"`
	InternalIP  string            `json:"internalIp"`
	ExternalIP  string            `json:"externalIp,omitempty"`
	Network     string            `json:"network"`
	Subnetwork  string            `json:"subnetwork"`
	Tags        []string          `json:"tags"`
	Labels      map[string]string `json:"labels"`
}

type ProjectFirewallRule struct {
	ID           string                `json:"id"`
	Name         string                `json:"name"`
	Network      string                `json:"network"`
	Direction    string                `json:"direction"`
	Priority     int                   `json:"priority"`
	Action       string                `json:"action"`
	Description  string                `json:"description,omitempty"`
	SourceRanges []string              `json:"sourceRanges,omitempty"`
	SourceTags   []string              `json:"sourceTags,omitempty"`
	TargetTags   []string              `json:"targetTags,omitempty"`
	Allowed      []ProjectFirewallPort `json:"allowed,omitempty"`
	Denied       []ProjectFirewallPort `json:"denied,omitempty"`
	Disabled     bool                  `json:"disabled"`
}

type ProjectCloudArmorRule struct {
	Priority    int      `json:"priority"`
	Action      string   `json:"action"`
	Preview     bool     `json:"preview"`
	Description string   `json:"description,omitempty"`
	Match       string   `json:"match"`
	SrcIPRanges []string `json:"srcIpRanges,omitempty"`
	Expression  string   `json:"expression,omitempty"`
}

type ProjectCloudArmorPolicy struct {
	ID                 string                  `json:"id"`
	Name               string                  `json:"name"`
	Description        string                  `json:"description,omitempty"`
	Type               string                  `json:"type"`
	RulesCount         int                     `json:"rulesCount"`
	AdaptiveProtection bool                    `json:"adaptiveProtection"`
	Rules              []ProjectCloudArmorRule `json:"rules,omitempty"`
}

type ProjectLoadBalancer struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	Type               string   `json:"type"`
	IPAddress          string   `json:"ipAddress"`
	Protocol           string   `json:"protocol"`
	PortRange          string   `json:"portRange"`
	Region             string   `json:"region,omitempty"`
	Backends           []string `json:"backends"`
	SecurityPolicy     string   `json:"securityPolicy,omitempty"`
	ForwardingRuleName string   `json:"forwardingRuleName"`
}

type ProjectIAMBindingCondition struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Expression  string `json:"expression"`
}

type ProjectIAMBinding struct {
	Role      string                      `json:"role"`
	Members   []string                    `json:"members"`
	Condition *ProjectIAMBindingCondition `json:"condition,omitempty"`
}

type ProjectGKENodePool struct {
	Name        string `json:"name"`
	NodeCount   int    `json:"nodeCount"`
	MachineType string `json:"machineType"`
	Version     string `json:"version"`
}

type ProjectGKECluster struct {
	ID                       string               `json:"id"`
	Name                     string               `json:"name"`
	Location                 string               `json:"location"`
	Network                  string               `json:"network"`
	Subnetwork               string               `json:"subnetwork"`
	Status                   string               `json:"status"`
	ClusterIPv4CIDR          string               `json:"clusterIpv4Cidr"`
	ServicesIPv4CIDR         string               `json:"servicesIpv4Cidr"`
	MasterIPv4CIDR           string               `json:"masterIpv4Cidr,omitempty"`
	PrivateCluster           bool                 `json:"privateCluster"`
	MasterAuthorizedNetworks []string             `json:"masterAuthorizedNetworks,omitempty"`
	NodePools                []ProjectGKENodePool `json:"nodePools"`
	Endpoint                 string               `json:"endpoint,omitempty"`
	MasterVersion            string               `json:"masterVersion,omitempty"`
	Labels                   map[string]string    `json:"labels,omitempty"`
}

type ProjectGraph struct {
	ProjectID     string                    `json:"projectId"`
	Name          string                    `json:"name"`
	Number        string                    `json:"number"`
	VPCs          []ProjectVpc              `json:"vpcs"`
	Instances     []ProjectInstance         `json:"instances"`
	FirewallRules []ProjectFirewallRule     `json:"firewallRules"`
	LoadBalancers []ProjectLoadBalancer     `json:"loadBalancers"`
	ArmorPolicies []ProjectCloudArmorPolicy `json:"armorPolicies"`
	IAMPolicy     []ProjectIAMBinding       `json:"iamPolicy"`
	GKEClusters   []ProjectGKECluster       `json:"gkeClusters"`
	LastScannedAt string                    `json:"lastScannedAt,omitempty"`
	Stale         bool                      `json:"stale"`
	Error         string                    `json:"error,omitempty"`
}

type ProjectScanError struct {
	ProjectID string `json:"projectId"`
	Error     string `json:"error"`
}

func (s *GcpDataService) BuildInventory(ctx context.Context, serviceAccountID string, options BuildInventoryOptions) ([]ProjectGraph, []ProjectScanError, error) {
	if options.ProjectConcurrency <= 0 {
		options.ProjectConcurrency = defaultProjectConcurrency
	}
	if options.ProjectTimeout <= 0 {
		options.ProjectTimeout = defaultProjectTimeout
	}

	projects, err := s.FetchProjects(ctx, serviceAccountID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch projects: %w", err)
	}
	if options.OnProjectsLoaded != nil {
		options.OnProjectsLoaded(len(projects))
	}

	results := make([]ProjectGraph, len(projects))
	scanErrors := make([]ProjectScanError, 0)
	var scanErrorsMu sync.Mutex

	sem := make(chan struct{}, options.ProjectConcurrency)
	var wg sync.WaitGroup

	for idx, project := range projects {
		wg.Add(1)
		go func(i int, p GcpProjectInfo) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			projectCtx, cancel := context.WithTimeout(ctx, options.ProjectTimeout)
			defer cancel()

			graph, projectErr := s.BuildProjectGraph(projectCtx, serviceAccountID, p)
			results[i] = graph
			if options.OnProjectCompleted != nil {
				options.OnProjectCompleted(p.ProjectID, graph, projectErr)
			}
			if projectErr != nil {
				scanErrorsMu.Lock()
				scanErrors = append(scanErrors, ProjectScanError{
					ProjectID: p.ProjectID,
					Error:     projectErr.Error(),
				})
				scanErrorsMu.Unlock()
			}
		}(idx, project)
	}

	wg.Wait()

	sort.Slice(results, func(i, j int) bool {
		return results[i].ProjectID < results[j].ProjectID
	})
	sort.Slice(scanErrors, func(i, j int) bool {
		return scanErrors[i].ProjectID < scanErrors[j].ProjectID
	})

	return results, scanErrors, nil
}

func (s *GcpDataService) BuildProjectGraph(ctx context.Context, serviceAccountID string, project GcpProjectInfo) (ProjectGraph, error) {
	scannedAt := time.Now().UTC().Format(time.RFC3339)
	graph := ProjectGraph{
		ProjectID:     project.ProjectID,
		Name:          project.Name,
		Number:        project.Number,
		VPCs:          make([]ProjectVpc, 0),
		Instances:     make([]ProjectInstance, 0),
		FirewallRules: make([]ProjectFirewallRule, 0),
		LoadBalancers: make([]ProjectLoadBalancer, 0),
		ArmorPolicies: make([]ProjectCloudArmorPolicy, 0),
		IAMPolicy:     make([]ProjectIAMBinding, 0),
		GKEClusters:   make([]ProjectGKECluster, 0),
		LastScannedAt: scannedAt,
		Stale:         false,
	}

	projectErrors := make([]string, 0)

	vpcs, err := s.FetchVpcs(ctx, serviceAccountID, project.ProjectID)
	if err != nil {
		projectErrors = append(projectErrors, fmt.Sprintf("vpcs: %v", err))
		vpcs = make([]GcpVpcInfo, 0)
	}

	allSubnets, err := s.FetchSubnets(ctx, serviceAccountID, project.ProjectID, "")
	if err != nil {
		projectErrors = append(projectErrors, fmt.Sprintf("subnets: %v", err))
		allSubnets = make([]GcpSubnetInfo, 0)
	}

	subnetsByVPC := mapSubnetsByVPC(vpcs, allSubnets)
	for _, vpc := range vpcs {
		graph.VPCs = append(graph.VPCs, ProjectVpc{
			Name:            vpc.Name,
			ID:              vpc.ID,
			IsSharedVpcHost: vpc.IsSharedVpcHost,
			Subnets:         subnetsByVPC[vpc.Name],
			Peerings:        make([]ProjectVpcPeering, 0),
			Routes:          make([]ProjectRoute, 0),
		})
	}

	firewallRules, err := s.FetchFirewallRules(ctx, serviceAccountID, project.ProjectID)
	if err != nil {
		projectErrors = append(projectErrors, fmt.Sprintf("firewallRules: %v", err))
		firewallRules = make([]GcpFirewallRuleInfo, 0)
	}

	for _, rule := range firewallRules {
		graph.FirewallRules = append(graph.FirewallRules, ProjectFirewallRule{
			ID:           rule.ID,
			Name:         rule.Name,
			Network:      rule.Network,
			Direction:    rule.Direction,
			Priority:     rule.Priority,
			Action:       rule.Action,
			SourceRanges: parseJSONStringArray(rule.SourceRanges),
			SourceTags:   parseJSONStringArray(rule.SourceTags),
			TargetTags:   parseJSONStringArray(rule.TargetTags),
			Allowed:      parseFirewallPorts(rule.Allowed),
			Denied:       parseFirewallPorts(rule.Denied),
			Disabled:     rule.Disabled,
		})
	}

	instances, err := s.FetchInstances(ctx, serviceAccountID, project.ProjectID)
	if err != nil {
		projectErrors = append(projectErrors, fmt.Sprintf("instances: %v", err))
		instances = make([]GcpInstanceInfo, 0)
	}

	for _, instance := range instances {
		graph.Instances = append(graph.Instances, ProjectInstance{
			ID:          instance.ID,
			Name:        instance.Name,
			Zone:        instance.Zone,
			MachineType: instance.MachineType,
			Status:      instance.Status,
			InternalIP:  instance.InternalIP,
			ExternalIP:  instance.ExternalIP,
			Network:     instance.Network,
			Subnetwork:  instance.Subnetwork,
			Tags:        parseJSONStringArray(instance.Tags),
			Labels:      parseJSONStringMap(instance.Labels),
		})
	}

	gkeClusters, err := s.FetchGkeClusters(ctx, serviceAccountID, project.ProjectID)
	if err != nil {
		projectErrors = append(projectErrors, fmt.Sprintf("gkeClusters: %v", err))
		gkeClusters = make([]GcpGkeClusterInfo, 0)
	}

	for _, cluster := range gkeClusters {
		nodePools := make([]ProjectGKENodePool, 0, len(cluster.NodePools))
		for _, pool := range cluster.NodePools {
			nodePools = append(nodePools, ProjectGKENodePool{
				Name:        pool.Name,
				NodeCount:   pool.NodeCount,
				MachineType: pool.MachineType,
				Version:     pool.Version,
			})
		}

		graph.GKEClusters = append(graph.GKEClusters, ProjectGKECluster{
			ID:                       cluster.ID,
			Name:                     cluster.Name,
			Location:                 cluster.Location,
			Network:                  cluster.Network,
			Subnetwork:               cluster.Subnetwork,
			Status:                   cluster.Status,
			ClusterIPv4CIDR:          cluster.ClusterIpv4Cidr,
			ServicesIPv4CIDR:         cluster.ServicesIpv4Cidr,
			MasterIPv4CIDR:           cluster.MasterIpv4Cidr,
			PrivateCluster:           cluster.PrivateCluster,
			NodePools:                nodePools,
			Endpoint:                 cluster.Endpoint,
			MasterVersion:            cluster.MasterVersion,
			MasterAuthorizedNetworks: cluster.MasterAuthorizedNetworks,
		})
	}

	loadBalancers, err := s.FetchLoadBalancers(ctx, serviceAccountID, project.ProjectID)
	if err != nil {
		projectErrors = append(projectErrors, fmt.Sprintf("loadBalancers: %v", err))
		loadBalancers = make([]GcpLoadBalancerInfo, 0)
	}

	for _, lb := range loadBalancers {
		backends := make([]string, 0)
		if strings.TrimSpace(lb.BackendService) != "" {
			backends = append(backends, lb.BackendService)
		}
		graph.LoadBalancers = append(graph.LoadBalancers, ProjectLoadBalancer{
			ID:                 lb.ID,
			Name:               lb.Name,
			Type:               normalizeLoadBalancerType(lb.Type, lb.Protocol),
			IPAddress:          lb.IPAddress,
			Protocol:           lb.Protocol,
			PortRange:          lb.PortRange,
			Region:             defaultRegion(lb.Region),
			Backends:           backends,
			ForwardingRuleName: lb.Name,
		})
	}

	armorPolicies, err := s.FetchCloudArmorPolicies(ctx, serviceAccountID, project.ProjectID)
	if err != nil {
		projectErrors = append(projectErrors, fmt.Sprintf("armorPolicies: %v", err))
		armorPolicies = make([]GcpCloudArmorPolicyInfo, 0)
	}

	for _, policy := range armorPolicies {
		rules := make([]ProjectCloudArmorRule, 0, len(policy.Rules))
		for _, rule := range policy.Rules {
			match := "Expression"
			if len(parseJSONStringArray(rule.SrcIpRanges)) > 0 {
				match = "IP Range"
			}
			rules = append(rules, ProjectCloudArmorRule{
				Priority:    rule.Priority,
				Action:      rule.Action,
				Preview:     rule.Preview,
				Description: rule.Description,
				Match:       match,
				SrcIPRanges: parseJSONStringArray(rule.SrcIpRanges),
			})
		}

		graph.ArmorPolicies = append(graph.ArmorPolicies, ProjectCloudArmorPolicy{
			ID:                 policy.ID,
			Name:               policy.Name,
			Description:        policy.Description,
			Type:               policy.Type,
			RulesCount:         len(rules),
			AdaptiveProtection: false,
			Rules:              rules,
		})
	}

	if len(projectErrors) > 0 {
		graph.Error = strings.Join(projectErrors, "; ")
		return graph, errors.New(graph.Error)
	}

	return graph, nil
}

func mapSubnetsByVPC(vpcs []GcpVpcInfo, allSubnets []GcpSubnetInfo) map[string][]ProjectSubnet {
	result := make(map[string][]ProjectSubnet, len(vpcs))
	for _, vpc := range vpcs {
		result[vpc.Name] = make([]ProjectSubnet, 0)
	}

	for _, subnet := range allSubnets {
		for _, vpc := range vpcs {
			if matchesVPC(subnet.Network, vpc.Name, vpc.ID) {
				result[vpc.Name] = append(result[vpc.Name], ProjectSubnet{
					Name:                subnet.Name,
					Region:              subnet.Region,
					IpCidrRange:         subnet.IpCidrRange,
					GatewayIp:           subnet.GatewayIp,
					PrivateGoogleAccess: subnet.PrivateGoogleAccess,
					SelfLink:            subnet.SelfLink,
				})
				break
			}
		}
	}
	return result
}

func matchesVPC(network string, vpcName string, vpcID string) bool {
	if network == vpcID {
		return true
	}
	return strings.HasSuffix(network, "/"+vpcName) || strings.HasSuffix(network, vpcName)
}

func parseJSONStringArray(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return make([]string, 0)
	}
	parsed := make([]string, 0)
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return make([]string, 0)
	}
	return parsed
}

func parseJSONStringMap(raw string) map[string]string {
	if strings.TrimSpace(raw) == "" {
		return map[string]string{}
	}
	parsed := map[string]string{}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return map[string]string{}
	}
	return parsed
}

func parseFirewallPorts(raw string) []ProjectFirewallPort {
	if strings.TrimSpace(raw) == "" {
		return make([]ProjectFirewallPort, 0)
	}

	type legacyFirewallPort struct {
		IPProtocol string   `json:"IPProtocol"`
		Ports      []string `json:"ports"`
	}

	legacy := make([]legacyFirewallPort, 0)
	if err := json.Unmarshal([]byte(raw), &legacy); err != nil {
		return make([]ProjectFirewallPort, 0)
	}

	ports := make([]ProjectFirewallPort, 0, len(legacy))
	for _, p := range legacy {
		ports = append(ports, ProjectFirewallPort{
			IPProtocol: p.IPProtocol,
			Ports:      p.Ports,
		})
	}
	return ports
}

func normalizeLoadBalancerType(lbType string, protocol string) string {
	isTCP := strings.EqualFold(protocol, "TCP")
	if strings.EqualFold(lbType, "INTERNAL") {
		if isTCP {
			return "INTERNAL_TCP"
		}
		return "INTERNAL_HTTP"
	}

	if isTCP {
		return "EXTERNAL_TCP"
	}
	return "EXTERNAL_HTTPS"
}

func defaultRegion(region string) string {
	if strings.TrimSpace(region) == "" {
		return "global"
	}
	return region
}
