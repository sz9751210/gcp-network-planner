import {
  FirewallPort,
  GcpCloudArmorPolicy,
  GcpFirewallRule,
  GcpGkeCluster,
  GcpIamBinding,
  GcpInstance,
  GcpLoadBalancer,
  GcpProject,
  GcpVpc,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type ScanStatus = 'queued' | 'running' | 'partial' | 'success' | 'failed';

interface UnknownRecord {
  [key: string]: unknown;
}

interface ScanError {
  projectId: string;
  error: string;
}

export interface ScanRecord {
  scanId: string;
  serviceAccountId: string;
  scope: string;
  status: ScanStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  totalProjects: number;
  completedProjects: number;
  projects: GcpProject[];
  errors: ScanError[];
}

export interface ScanListItem {
  scanId: string;
  serviceAccountId: string;
  actor: string;
  status: ScanStatus;
  createdAt: string;
  completedAt?: string;
  totalProjects: number;
  completedProjects: number;
  errorCount: number;
}

export interface ScanListResponse {
  items: ScanListItem[];
  nextCursor?: string;
}

export interface AuditEventRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  result: string;
  errorSummary?: string;
  metadata: Record<string, unknown>;
}

export interface AuditEventListResponse {
  items: AuditEventRecord[];
  nextCursor?: string;
}

export interface ListScansParams {
  serviceAccountId?: string;
  status?: ScanStatus;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface ListAuditEventsParams {
  from?: string;
  to?: string;
  action?: string;
  result?: string;
  targetType?: string;
  targetId?: string;
  actor?: string;
  scanId?: string;
  limit?: number;
  cursor?: string;
}

export interface ServiceAccount {
  id: string;
  name: string;
  projectId: string;
  accountEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceAccountKey {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export interface GcpProjectResponse {
  projectId: string;
  name: string;
  number: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toBooleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function parseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function toArrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseJSON(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }
  return [];
}

function toStringArray(value: unknown): string[] {
  return toArrayValue(value).map((item) => toStringValue(item)).filter((item) => item !== '');
}

function toRecordStringMap(value: unknown): Record<string, string> {
  const source = typeof value === 'string' ? parseJSON(value) : value;
  if (!isRecord(source)) {
    return {};
  }

  const result: Record<string, string> = {};
  Object.entries(source).forEach(([key, val]) => {
    result[key] = toStringValue(val);
  });
  return result;
}

function normalizeFirewallPorts(value: unknown): FirewallPort[] {
  const result: FirewallPort[] = [];
  toArrayValue(value).forEach((item) => {
    if (!isRecord(item)) {
      return;
    }
    const protocol = toStringValue(item.IPProtocol);
    if (!protocol) {
      return;
    }
    const ports = toStringArray(item.ports);
    if (ports.length > 0) {
      result.push({ IPProtocol: protocol, ports });
      return;
    }
    result.push({ IPProtocol: protocol });
  });
  return result;
}

function normalizeProject(project: unknown): GcpProject {
  const record = isRecord(project) ? project : {};

  const vpcs: GcpVpc[] = toArrayValue(record.vpcs).map((vpc) => {
    const vpcRecord = isRecord(vpc) ? vpc : {};
    return {
      name: toStringValue(vpcRecord.name),
      id: toStringValue(vpcRecord.id),
      isSharedVpcHost: toBooleanValue(vpcRecord.isSharedVpcHost),
      mtu: typeof vpcRecord.mtu === 'number' ? vpcRecord.mtu : undefined,
      subnets: toArrayValue(vpcRecord.subnets).map((subnet) => {
        const subnetRecord = isRecord(subnet) ? subnet : {};
        return {
          name: toStringValue(subnetRecord.name),
          region: toStringValue(subnetRecord.region),
          ipCidrRange: toStringValue(subnetRecord.ipCidrRange),
          gatewayIp: toStringValue(subnetRecord.gatewayIp),
          privateGoogleAccess: toBooleanValue(subnetRecord.privateGoogleAccess),
          selfLink: toStringValue(subnetRecord.selfLink),
        };
      }),
      peerings: toArrayValue(vpcRecord.peerings).map((peering) => {
        const peeringRecord = isRecord(peering) ? peering : {};
        return {
          name: toStringValue(peeringRecord.name),
          targetNetwork: toStringValue(peeringRecord.targetNetwork),
          state: toStringValue(peeringRecord.state) === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
          exportCustomRoutes: toBooleanValue(peeringRecord.exportCustomRoutes),
          importCustomRoutes: toBooleanValue(peeringRecord.importCustomRoutes),
        };
      }),
      routes: toArrayValue(vpcRecord.routes).map((route) => {
        const routeRecord = isRecord(route) ? route : {};
        return {
          id: toStringValue(routeRecord.id),
          name: toStringValue(routeRecord.name),
          network: toStringValue(routeRecord.network),
          destRange: toStringValue(routeRecord.destRange),
          nextHop: toStringValue(routeRecord.nextHop),
          priority: toNumberValue(routeRecord.priority),
          description: toStringValue(routeRecord.description) || undefined,
          tags: toStringArray(routeRecord.tags),
        };
      }),
    };
  });

  const instances: GcpInstance[] = toArrayValue(record.instances).map((instance) => {
    const instanceRecord = isRecord(instance) ? instance : {};
    return {
      id: toStringValue(instanceRecord.id),
      name: toStringValue(instanceRecord.name),
      zone: toStringValue(instanceRecord.zone),
      machineType: toStringValue(instanceRecord.machineType),
      status: toStringValue(instanceRecord.status) as 'RUNNING' | 'STOPPED' | 'PROVISIONING' | 'TERMINATED',
      internalIp: toStringValue(instanceRecord.internalIp),
      externalIp: toStringValue(instanceRecord.externalIp) || undefined,
      network: toStringValue(instanceRecord.network),
      subnetwork: toStringValue(instanceRecord.subnetwork),
      tags: toStringArray(instanceRecord.tags),
      labels: toRecordStringMap(instanceRecord.labels),
    };
  });

  const firewallRules: GcpFirewallRule[] = toArrayValue(record.firewallRules).map((rule) => {
    const ruleRecord = isRecord(rule) ? rule : {};
    return {
      id: toStringValue(ruleRecord.id),
      name: toStringValue(ruleRecord.name),
      network: toStringValue(ruleRecord.network),
      direction: toStringValue(ruleRecord.direction) as 'INGRESS' | 'EGRESS',
      priority: toNumberValue(ruleRecord.priority),
      action: toStringValue(ruleRecord.action) as 'ALLOW' | 'DENY',
      description: toStringValue(ruleRecord.description) || undefined,
      sourceRanges: toStringArray(ruleRecord.sourceRanges),
      sourceTags: toStringArray(ruleRecord.sourceTags),
      targetTags: toStringArray(ruleRecord.targetTags),
      allowed: normalizeFirewallPorts(ruleRecord.allowed),
      denied: normalizeFirewallPorts(ruleRecord.denied),
      disabled: toBooleanValue(ruleRecord.disabled),
    };
  });

  const loadBalancers: GcpLoadBalancer[] = toArrayValue(record.loadBalancers).map((lb) => {
    const lbRecord = isRecord(lb) ? lb : {};
    const backends = toStringArray(lbRecord.backends);
    const legacyBackend = toStringValue(lbRecord.backendService);
    if (backends.length === 0 && legacyBackend) {
      backends.push(legacyBackend);
    }
    return {
      id: toStringValue(lbRecord.id),
      name: toStringValue(lbRecord.name),
      type: toStringValue(lbRecord.type) as 'EXTERNAL_HTTPS' | 'INTERNAL_TCP' | 'EXTERNAL_TCP' | 'INTERNAL_HTTP',
      ipAddress: toStringValue(lbRecord.ipAddress),
      protocol: toStringValue(lbRecord.protocol),
      portRange: toStringValue(lbRecord.portRange),
      region: toStringValue(lbRecord.region) || undefined,
      backends,
      securityPolicy: toStringValue(lbRecord.securityPolicy) || undefined,
      forwardingRuleName: toStringValue(lbRecord.forwardingRuleName) || toStringValue(lbRecord.name),
    };
  });

  const armorPolicies: GcpCloudArmorPolicy[] = toArrayValue(record.armorPolicies).map((policy) => {
    const policyRecord = isRecord(policy) ? policy : {};
    const rules = toArrayValue(policyRecord.rules).map((rule) => {
      const ruleRecord = isRecord(rule) ? rule : {};
      return {
        priority: toNumberValue(ruleRecord.priority),
        action: toStringValue(ruleRecord.action) as 'allow' | 'deny' | 'throttle' | 'rate_based_ban',
        preview: toBooleanValue(ruleRecord.preview),
        description: toStringValue(ruleRecord.description) || undefined,
        match: toStringValue(ruleRecord.match),
        srcIpRanges: toStringArray(ruleRecord.srcIpRanges),
        expression: toStringValue(ruleRecord.expression) || undefined,
      };
    });

    return {
      id: toStringValue(policyRecord.id),
      name: toStringValue(policyRecord.name),
      description: toStringValue(policyRecord.description) || undefined,
      type: toStringValue(policyRecord.type) as 'CLOUD_ARMOR' | 'CLOUD_ARMOR_EDGE',
      rulesCount: toNumberValue(policyRecord.rulesCount, rules.length),
      adaptiveProtection: toBooleanValue(policyRecord.adaptiveProtection),
      rules,
    };
  });

  const iamPolicy: GcpIamBinding[] = toArrayValue(record.iamPolicy).map((binding) => {
    const bindingRecord = isRecord(binding) ? binding : {};
    return {
      role: toStringValue(bindingRecord.role),
      members: toStringArray(bindingRecord.members),
      condition: isRecord(bindingRecord.condition)
        ? {
            title: toStringValue(bindingRecord.condition.title),
            description: toStringValue(bindingRecord.condition.description) || undefined,
            expression: toStringValue(bindingRecord.condition.expression),
          }
        : undefined,
    };
  });

  const gkeClusters: GcpGkeCluster[] = toArrayValue(record.gkeClusters).map((cluster) => {
    const clusterRecord = isRecord(cluster) ? cluster : {};
    return {
      id: toStringValue(clusterRecord.id),
      name: toStringValue(clusterRecord.name),
      location: toStringValue(clusterRecord.location),
      network: toStringValue(clusterRecord.network),
      subnetwork: toStringValue(clusterRecord.subnetwork),
      status: toStringValue(clusterRecord.status) as 'RUNNING' | 'PROVISIONING' | 'STOPPING' | 'ERROR' | 'RECONCILING',
      clusterIpv4Cidr: toStringValue(clusterRecord.clusterIpv4Cidr),
      servicesIpv4Cidr: toStringValue(clusterRecord.servicesIpv4Cidr),
      masterIpv4Cidr: toStringValue(clusterRecord.masterIpv4Cidr) || undefined,
      privateCluster: toBooleanValue(clusterRecord.privateCluster),
      masterAuthorizedNetworks: toStringArray(clusterRecord.masterAuthorizedNetworks),
      nodePools: toArrayValue(clusterRecord.nodePools).map((pool) => {
        const poolRecord = isRecord(pool) ? pool : {};
        return {
          name: toStringValue(poolRecord.name),
          nodeCount: toNumberValue(poolRecord.nodeCount),
          machineType: toStringValue(poolRecord.machineType),
          version: toStringValue(poolRecord.version),
        };
      }),
      endpoint: toStringValue(clusterRecord.endpoint) || undefined,
      masterVersion: toStringValue(clusterRecord.masterVersion) || undefined,
      labels: toRecordStringMap(clusterRecord.labels),
      workloads: [],
      services: [],
      ingresses: [],
      pvcs: [],
      storageClasses: [],
      configMaps: [],
      secrets: [],
    };
  });

  return {
    projectId: toStringValue(record.projectId),
    name: toStringValue(record.name),
    number: toStringValue(record.number),
    vpcs,
    instances,
    firewallRules,
    loadBalancers,
    armorPolicies,
    iamPolicy,
    gkeClusters,
    lastScannedAt: toStringValue(record.lastScannedAt),
    stale: toBooleanValue(record.stale),
    error: toStringValue(record.error) || undefined,
  };
}

function normalizeProjects(payload: unknown): GcpProject[] {
  return toArrayValue(payload).map((project) => normalizeProject(project));
}

function normalizeScanRecord(payload: unknown): ScanRecord {
  const record = isRecord(payload) ? payload : {};

  const errors = toArrayValue(record.errors).map((item) => {
    const errorRecord = isRecord(item) ? item : {};
    return {
      projectId: toStringValue(errorRecord.projectId),
      error: toStringValue(errorRecord.error),
    };
  });

  return {
    scanId: toStringValue(record.scanId),
    serviceAccountId: toStringValue(record.serviceAccountId),
    scope: toStringValue(record.scope),
    status: toStringValue(record.status) as ScanStatus,
    createdAt: toStringValue(record.createdAt),
    startedAt: toStringValue(record.startedAt) || undefined,
    completedAt: toStringValue(record.completedAt) || undefined,
    totalProjects: toNumberValue(record.totalProjects),
    completedProjects: toNumberValue(record.completedProjects),
    projects: normalizeProjects(record.projects),
    errors,
  };
}

function normalizeScanListResponse(payload: unknown): ScanListResponse {
  const record = isRecord(payload) ? payload : {};

  const items = toArrayValue(record.items).map((item) => {
    const itemRecord = isRecord(item) ? item : {};
    return {
      scanId: toStringValue(itemRecord.scanId),
      serviceAccountId: toStringValue(itemRecord.serviceAccountId),
      actor: toStringValue(itemRecord.actor),
      status: toStringValue(itemRecord.status) as ScanStatus,
      createdAt: toStringValue(itemRecord.createdAt),
      completedAt: toStringValue(itemRecord.completedAt) || undefined,
      totalProjects: toNumberValue(itemRecord.totalProjects),
      completedProjects: toNumberValue(itemRecord.completedProjects),
      errorCount: toNumberValue(itemRecord.errorCount),
    };
  });

  return {
    items,
    nextCursor: toStringValue(record.nextCursor) || undefined,
  };
}

function normalizeAuditEventListResponse(payload: unknown): AuditEventListResponse {
  const record = isRecord(payload) ? payload : {};
  const items = toArrayValue(record.items).map((item) => {
    const itemRecord = isRecord(item) ? item : {};
    const metadata = isRecord(itemRecord.metadata) ? (itemRecord.metadata as Record<string, unknown>) : {};

    return {
      id: toStringValue(itemRecord.id),
      timestamp: toStringValue(itemRecord.timestamp),
      actor: toStringValue(itemRecord.actor),
      action: toStringValue(itemRecord.action),
      targetType: toStringValue(itemRecord.targetType),
      targetId: toStringValue(itemRecord.targetId),
      result: toStringValue(itemRecord.result),
      errorSummary: toStringValue(itemRecord.errorSummary) || undefined,
      metadata,
    };
  });

  return {
    items,
    nextCursor: toStringValue(record.nextCursor) || undefined,
  };
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }
    query.set(key, String(value));
  });
  return query.toString();
}

export async function fetchServiceAccounts(): Promise<ServiceAccount[]> {
  const response = await fetch(`${API_BASE_URL}/api/credentials`);

  if (!response.ok) {
    throw new Error('Failed to fetch service accounts');
  }

  return response.json();
}

export async function createServiceAccount(
  name: string,
  serviceAccountKey: ServiceAccountKey
): Promise<ServiceAccount> {
  const response = await fetch(`${API_BASE_URL}/api/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, serviceAccountKey }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create service account');
  }

  return response.json();
}

export async function deleteServiceAccount(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/credentials/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete service account');
  }
}

export async function testServiceAccount(id: string): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/credentials/${id}/test`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to test service account');
  }

  return response.json();
}

export async function fetchGcpProjects(
  serviceAccountId: string
): Promise<GcpProjectResponse[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/gcp?serviceAccountId=${serviceAccountId}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch GCP projects');
  }

  return response.json();
}

export async function startScan(serviceAccountId: string, scope = 'project'): Promise<ScanRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/scans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ serviceAccountId, scope }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start scan');
  }

  return normalizeScanRecord(await response.json());
}

export async function fetchScan(scanId: string): Promise<ScanRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/scans/${scanId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scan status');
  }

  return normalizeScanRecord(await response.json());
}

export async function fetchScans(params: ListScansParams = {}): Promise<ScanListResponse> {
  const query = toQueryString({
    serviceAccountId: params.serviceAccountId,
    status: params.status,
    from: params.from,
    to: params.to,
    limit: params.limit,
    cursor: params.cursor,
  });
  const response = await fetch(`${API_BASE_URL}/api/v1/scans${query ? `?${query}` : ''}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scans');
  }

  return normalizeScanListResponse(await response.json());
}

export async function fetchAuditEvents(params: ListAuditEventsParams = {}): Promise<AuditEventListResponse> {
  const query = toQueryString({
    from: params.from,
    to: params.to,
    action: params.action,
    result: params.result,
    targetType: params.targetType,
    targetId: params.targetId,
    actor: params.actor,
    scanId: params.scanId,
    limit: params.limit,
    cursor: params.cursor,
  });
  const response = await fetch(`${API_BASE_URL}/api/v1/audit-events${query ? `?${query}` : ''}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch audit events');
  }

  return normalizeAuditEventListResponse(await response.json());
}

export async function fetchInventory(serviceAccountId: string): Promise<GcpProject[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory?serviceAccountId=${serviceAccountId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch inventory');
  }

  return normalizeProjects(await response.json());
}

export async function fetchAllGcpData(
  serviceAccountId: string
): Promise<GcpProject[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/gcp/all-data?serviceAccountId=${serviceAccountId}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch GCP data');
  }

  return normalizeProjects(await response.json());
}

export async function exportData(
  serviceAccountId: string,
  format: 'json' | 'csv' = 'json'
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/api/gcp/export?serviceAccountId=${serviceAccountId}&format=${format}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to export data');
  }

  return response.blob();
}
