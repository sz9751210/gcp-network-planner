export interface GcpSubnet {
  name: string;
  region: string;
  ipCidrRange: string;
  gatewayIp: string;
  privateGoogleAccess: boolean;
  selfLink: string;
}

export interface GcpVpcPeering {
  name: string; // Name of the peering connection
  targetNetwork: string; // The full resource link or name of the peer VPC
  state: 'ACTIVE' | 'INACTIVE';
  exportCustomRoutes: boolean;
  importCustomRoutes: boolean;
}

export interface GcpRoute {
  id: string;
  name: string;
  network: string; // VPC Name
  destRange: string; // e.g., 0.0.0.0/0 or 10.1.0.0/16
  nextHop: string; // e.g., "Default Internet Gateway", "VPN Tunnel", or Peering name
  priority: number;
  description?: string;
  tags?: string[]; // Applies to instances with these tags
}

export interface GcpVpc {
  name: string;
  id: string;
  isSharedVpcHost: boolean;
  subnets: GcpSubnet[];
  mtu?: number;
  peerings?: GcpVpcPeering[]; 
  routes?: GcpRoute[]; // Added Routes
}

export interface GcpInstance {
  id: string;
  name: string;
  zone: string;
  machineType: string;
  status: 'RUNNING' | 'STOPPED' | 'PROVISIONING' | 'TERMINATED';
  internalIp: string;
  externalIp?: string;
  network: string; // VPC Name
  subnetwork: string; // Subnet Name
  tags: string[];
  labels: Record<string, string>;
}

export interface FirewallPort {
  IPProtocol: string;
  ports?: string[];
}

export interface GcpFirewallRule {
  id: string;
  name: string;
  network: string; // VPC Name association
  direction: 'INGRESS' | 'EGRESS';
  priority: number;
  action: 'ALLOW' | 'DENY';
  description?: string;
  sourceRanges?: string[];
  sourceTags?: string[];
  targetTags?: string[]; // Empty means all instances in network
  allowed?: FirewallPort[];
  denied?: FirewallPort[];
  disabled?: boolean;
}

// --- NEW TYPES FOR NETWORK SERVICES ---

export interface GcpCloudArmorRule {
  priority: number;
  action: 'allow' | 'deny' | 'throttle' | 'rate_based_ban';
  preview: boolean; // Dry run mode
  description?: string;
  match: string; // Simplified representation of the match condition (e.g., "IP: 1.2.3.4" or "Expr: ...")
  srcIpRanges?: string[];
  expression?: string;
}

export interface GcpCloudArmorPolicy {
  id: string;
  name: string;
  description?: string;
  type: 'CLOUD_ARMOR' | 'CLOUD_ARMOR_EDGE'; // Backend vs Edge
  rulesCount: number;
  adaptiveProtection: boolean; // Managed Protection
  rules?: GcpCloudArmorRule[]; // Detailed rules
}

export interface GcpLoadBalancer {
  id: string;
  name: string;
  type: 'EXTERNAL_HTTPS' | 'INTERNAL_TCP' | 'EXTERNAL_TCP' | 'INTERNAL_HTTP';
  ipAddress: string;
  protocol: string;
  portRange: string;
  region?: string; // 'global' or specific region
  backends: string[]; // Backend Service names
  securityPolicy?: string; // Name of the attached Cloud Armor policy
  forwardingRuleName: string;
}

// --- IAM TYPES ---

export interface GcpIamBinding {
  role: string;
  members: string[]; // e.g., "user:alice@example.com", "serviceAccount:my-sa@project.iam.gserviceaccount.com"
  condition?: {
    title: string;
    description?: string;
    expression: string;
  };
}

// --- GKE TYPES ---

export interface GkeWorkload {
  name: string;
  namespace: string;
  type: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'Job';
  status: 'OK' | 'Warning' | 'Error';
  pods: string; // e.g., "3/3"
  images: string[];
}

export interface GkeService {
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  clusterIp: string;
  externalIp?: string;
  ports: string; // e.g., "80/TCP, 443/TCP"
}

export interface GkeIngress {
  name: string;
  namespace: string;
  loadBalancerIp?: string;
  backends: string[];
}

export interface GkePvc {
  name: string;
  namespace: string;
  status: 'Bound' | 'Pending' | 'Lost';
  volume: string;
  capacity: string;
  storageClass: string;
}

export interface GkeStorageClass {
  name: string;
  provisioner: string;
  reclaimPolicy: 'Delete' | 'Retain';
}

export interface GkeConfigMap {
  name: string;
  namespace: string;
  data: Record<string, string>; // Changed from keys[] to data map
}

export interface GkeSecret {
  name: string;
  namespace: string;
  type: string; // e.g. "Opaque", "kubernetes.io/tls"
  data?: Record<string, string>; // Mock data for display
}

export interface GcpGkeNodePool {
  name: string;
  nodeCount: number;
  machineType: string;
  version: string;
}

export interface GcpGkeCluster {
  id: string;
  name: string;
  location: string; // Region (e.g., us-central1) or Zone (e.g., us-central1-a)
  network: string;
  subnetwork: string;
  status: 'RUNNING' | 'PROVISIONING' | 'STOPPING' | 'ERROR' | 'RECONCILING';
  clusterIpv4Cidr: string; // Pod address range
  servicesIpv4Cidr: string; // Service address range
  masterIpv4Cidr?: string; // Private endpoint range
  privateCluster: boolean;
  masterAuthorizedNetworks?: string[];
  nodePools: GcpGkeNodePool[];
  // Added Details
  endpoint?: string;
  masterVersion?: string;
  labels?: Record<string, string>;
  // New K8s Resources
  workloads?: GkeWorkload[];
  services?: GkeService[];
  ingresses?: GkeIngress[];
  pvcs?: GkePvc[];
  storageClasses?: GkeStorageClass[];
  configMaps?: GkeConfigMap[];
  secrets?: GkeSecret[];
}

export interface GcpProject {
  projectId: string;
  name: string; // Display name
  number: string;
  vpcs: GcpVpc[];
  instances: GcpInstance[];
  firewallRules: GcpFirewallRule[];
  loadBalancers: GcpLoadBalancer[]; // Added LBs
  armorPolicies: GcpCloudArmorPolicy[]; // Added Cloud Armor
  iamPolicy?: GcpIamBinding[]; // Added IAM
  gkeClusters: GcpGkeCluster[]; // Added GKE
  error?: string; // To track permission errors during fetching
}

export interface CidrConflict {
  hasConflict: boolean;
  conflictingSubnets: {
    projectId: string;
    vpcName: string;
    subnetName: string;
    cidr: string;
  }[];
}

// Backend reference types (mocking the Node.js library types)
export interface ComputeNetwork {
  name: string;
  id: string;
  autoCreateSubnetworks: boolean;
  subnetworks?: string[]; // Links to subnets
}