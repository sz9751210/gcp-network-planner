import React, { useMemo, useState, useCallback } from 'react';
import { GcpProject, GcpInstance, GcpLoadBalancer, GcpCloudArmorPolicy, IpAddressKind, IpUsageMatch, IpUsageResult, IpUsageStage } from '../types';
import { buildIpUsageResult, inferIpAddressKind, validateIpv4 } from '../utils/ipUsage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
  selectedServiceAccountId: string;
  scanStatus: 'idle' | 'queued' | 'running' | 'partial' | 'success' | 'failed';
  scanId: string;
  scanErrors: { projectId: string; error: string }[];
  lastScannedAt: string;
  onRescanAllProjects: () => Promise<void>;
}

interface NodeDetail {
  match: IpUsageMatch;
  stage: IpUsageStage;
  resolvedInstance?: GcpInstance;
  resolvedLb?: GcpLoadBalancer;
  projectId?: string; // for armor policy lookup
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<
  IpUsageStage,
  { label: string; description: string; color: string; borderColor: string; badgeColor: string; glowColor: string; stepIndex: number }
> = {
  NETWORK: {
    label: 'Network Containment',
    description: 'VPC / Subnet that contains this IP',
    color: 'bg-blue-950/60',
    borderColor: 'border-blue-500/50',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    glowColor: 'shadow-blue-500/10',
    stepIndex: 1,
  },
  ENDPOINT: {
    label: 'Endpoint Ownership',
    description: 'GCE instance or Load Balancer assigned this IP',
    color: 'bg-emerald-950/60',
    borderColor: 'border-emerald-500/50',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    glowColor: 'shadow-emerald-500/10',
    stepIndex: 2,
  },
  POLICY: {
    label: 'Policy References',
    description: 'Routes or Load Balancer-attached Cloud Armor policies',
    color: 'bg-amber-950/60',
    borderColor: 'border-amber-500/50',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    glowColor: 'shadow-amber-500/10',
    stepIndex: 3,
  },
};

const RESOURCE_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; borderColor: string; icon: React.ReactElement }
> = {
  SUBNET: {
    label: 'Subnet',
    color: 'bg-blue-900/40',
    borderColor: 'border-blue-400/60',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  INSTANCE_INTERNAL_IP: {
    label: 'GCE Instance',
    color: 'bg-emerald-900/40',
    borderColor: 'border-emerald-400/60',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
  },
  INSTANCE_EXTERNAL_IP: {
    label: 'GCE Instance',
    color: 'bg-cyan-900/40',
    borderColor: 'border-cyan-400/60',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  LOAD_BALANCER: {
    label: 'Load Balancer',
    color: 'bg-teal-900/40',
    borderColor: 'border-teal-400/60',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  FIREWALL: {
    label: 'Firewall Rule',
    color: 'bg-amber-900/40',
    borderColor: 'border-amber-400/60',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  ROUTE: {
    label: 'Route',
    color: 'bg-violet-900/40',
    borderColor: 'border-violet-400/60',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  CLOUD_ARMOR: {
    label: 'Cloud Armor',
    color: 'bg-red-900/40',
    borderColor: 'border-red-400/60',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
};

const STAGE_ORDER: IpUsageStage[] = ['NETWORK', 'ENDPOINT', 'POLICY'];
const MAX_VISIBLE_NODES = 6;
const LB_BACKEND_PREVIEW_LIMIT = 3;
const GCP_CONSOLE_BASE_URL = 'https://console.cloud.google.com';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveInstance(projects: GcpProject[], projectId: string, name: string): GcpInstance | undefined {
  const project = projects.find((p) => p.projectId === projectId);
  return project?.instances.find((i) => i.name === name);
}

function resolveLb(projects: GcpProject[], projectId: string, name: string): GcpLoadBalancer | undefined {
  const project = projects.find((p) => p.projectId === projectId);
  return project?.loadBalancers.find((lb) => lb.name === name);
}

function resolveArmorPolicy(projects: GcpProject[], projectId: string, policyName: string) {
  const project = projects.find((p) => p.projectId === projectId);
  return project?.armorPolicies.find((ap) => ap.name === policyName);
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ''))];
}

function getLbPolicyNames(lb: GcpLoadBalancer): string[] {
  return uniqueNonEmpty([
    ...(lb.cloudArmorPolicies || []),
    ...(lb.securityPolicy ? [lb.securityPolicy] : []),
  ]);
}

function buildSubnetConsoleUrl(projectId: string, region: string, subnetName: string): string {
  return `${GCP_CONSOLE_BASE_URL}/networking/subnets/details/${encodeURIComponent(region)}/${encodeURIComponent(subnetName)}?project=${encodeURIComponent(projectId)}`;
}

function buildInstanceConsoleUrl(projectId: string, zone: string, instanceName: string): string {
  return `${GCP_CONSOLE_BASE_URL}/compute/instancesDetail/zones/${encodeURIComponent(zone)}/instances/${encodeURIComponent(instanceName)}?project=${encodeURIComponent(projectId)}`;
}

function buildLoadBalancerConsoleUrl(projectId: string): string {
  return `${GCP_CONSOLE_BASE_URL}/net-services/loadbalancing/list/loadBalancers?project=${encodeURIComponent(projectId)}`;
}

function buildCloudArmorConsoleUrl(projectId: string): string {
  return `${GCP_CONSOLE_BASE_URL}/security/cloud-armor/policies?project=${encodeURIComponent(projectId)}`;
}

function buildFirewallConsoleUrl(projectId: string, firewallName: string): string {
  return `${GCP_CONSOLE_BASE_URL}/networking/firewalls/details/${encodeURIComponent(firewallName)}?project=${encodeURIComponent(projectId)}`;
}

function buildRouteConsoleUrl(projectId: string): string {
  return `${GCP_CONSOLE_BASE_URL}/networking/routes/list?project=${encodeURIComponent(projectId)}`;
}

function buildConsoleUrlForMatch(match: IpUsageMatch): string {
  if (match.resourceType === 'SUBNET') {
    const region = String(match.metadata.region ?? '');
    const subnetName = String(match.metadata.subnetName ?? match.resourceName.split('/').at(-1) ?? '');
    if (region && subnetName) {
      return buildSubnetConsoleUrl(match.projectId, region, subnetName);
    }
    return `${GCP_CONSOLE_BASE_URL}/networking/subnets/list?project=${encodeURIComponent(match.projectId)}`;
  }

  if (match.resourceType === 'INSTANCE_INTERNAL_IP' || match.resourceType === 'INSTANCE_EXTERNAL_IP') {
    const zone = String(match.metadata.zone ?? '');
    if (zone) {
      return buildInstanceConsoleUrl(match.projectId, zone, match.resourceName);
    }
    return `${GCP_CONSOLE_BASE_URL}/compute/instances?project=${encodeURIComponent(match.projectId)}`;
  }

  if (match.resourceType === 'LOAD_BALANCER') {
    return buildLoadBalancerConsoleUrl(match.projectId);
  }

  if (match.resourceType === 'CLOUD_ARMOR') {
    return buildCloudArmorConsoleUrl(match.projectId);
  }

  if (match.resourceType === 'FIREWALL') {
    return buildFirewallConsoleUrl(match.projectId, match.resourceName);
  }

  if (match.resourceType === 'ROUTE') {
    return buildRouteConsoleUrl(match.projectId);
  }

  return `${GCP_CONSOLE_BASE_URL}/home/dashboard?project=${encodeURIComponent(match.projectId)}`;
}

const ConsoleExternalLink: React.FC<{ href: string; title: string; text?: string; className?: string }> = ({
  href,
  title,
  text,
  className = '',
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    title={title}
    className={`inline-flex items-center gap-1.5 text-[11px] text-blue-300 hover:text-blue-200 transition-colors ${className}`}
  >
    {text && <span>{text}</span>}
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5h5M5 5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" />
    </svg>
  </a>
);

// ─── Shared UI primitives ──────────────────────────────────────────────────────

const IpKindBadge: React.FC<{ kind: IpAddressKind }> = ({ kind }) => (
  <span
    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
      kind === 'INTERNAL'
        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
        : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${kind === 'INTERNAL' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
    {kind === 'INTERNAL' ? 'Internal' : 'External'}
  </span>
);

const InstanceStatusBadge: React.FC<{ status: GcpInstance['status'] }> = ({ status }) => {
  const colors: Record<GcpInstance['status'], string> = {
    RUNNING: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    STOPPED: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
    PROVISIONING: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    TERMINATED: 'bg-red-500/20 text-red-400 border-red-500/40',
  };
  return (
    <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 uppercase tracking-wide ${colors[status]}`}>
      {status}
    </span>
  );
};

const DetailRow: React.FC<{ label: string; value: string; mono?: boolean; highlight?: boolean; full?: boolean }> = ({
  label, value, mono = false, highlight = false, full = false,
}) => (
  <div className={`flex items-start gap-3 py-2 border-b border-slate-800/80 ${full ? 'flex-col' : 'justify-between'}`}>
    <span className="text-xs text-slate-500 capitalize shrink-0 pt-0.5">{label}</span>
    <span className={`text-xs break-all ${full ? '' : 'text-right'} ${mono ? 'font-mono' : ''} ${highlight ? 'text-white font-semibold' : 'text-slate-300'}`}>
      {value}
    </span>
  </div>
);

// ─── GCE Detail Panel ─────────────────────────────────────────────────────────

const GceDetailPanel: React.FC<{ instance: GcpInstance; projectId: string }> = ({ instance, projectId }) => {
  const labelEntries = Object.entries(instance.labels ?? {});
  const instanceConsoleUrl = buildInstanceConsoleUrl(projectId, instance.zone, instance.name);
  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            GCE Instance
          </h4>
          <ConsoleExternalLink href={instanceConsoleUrl} title="Open VM in GCP Console" text="Open" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-bold text-white">{instance.name}</span>
          <InstanceStatusBadge status={instance.status} />
        </div>
        <div className="space-y-0">
          <DetailRow label="Instance ID" value={instance.id} mono />
          <DetailRow label="Zone" value={instance.zone} />
          <DetailRow label="Machine Type" value={instance.machineType} />
          <DetailRow label="Internal IP" value={instance.internalIp} mono highlight />
          {instance.externalIp && <DetailRow label="External IP" value={instance.externalIp} mono highlight />}
          <DetailRow label="VPC Network" value={instance.network} />
          <DetailRow label="Subnetwork" value={instance.subnetwork} />
        </div>
      </section>

      {instance.tags.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Network Tags</h4>
          <div className="flex flex-wrap gap-1.5">
            {instance.tags.map((tag) => (
              <span key={tag} className="text-[11px] font-mono bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {labelEntries.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Labels</h4>
          <div className="space-y-0">
            {labelEntries.map(([k, v]) => (
              <DetailRow key={k} label={k} value={v} mono />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ─── Load Balancer Detail Panel ────────────────────────────────────────────────

const LbTypeLabel: Record<string, string> = {
  EXTERNAL_HTTPS: 'External HTTPS (Global)',
  INTERNAL_TCP: 'Internal TCP',
  EXTERNAL_TCP: 'External TCP',
  INTERNAL_HTTP: 'Internal HTTP',
};

const ArmorActionBadge: React.FC<{ action: string; preview?: boolean }> = ({ action, preview }) => {
  const colors: Record<string, string> = {
    allow: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/40',
    deny: 'bg-red-900/40 text-red-300 border-red-500/40',
    throttle: 'bg-amber-900/40 text-amber-300 border-amber-500/40',
    rate_based_ban: 'bg-orange-900/40 text-orange-300 border-orange-500/40',
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 uppercase tracking-wide ${colors[action] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
        {action.replace('_', ' ')}
      </span>
      {preview && (
        <span className="text-[9px] border border-slate-600 text-slate-500 rounded px-1 py-0.5">preview</span>
      )}
    </span>
  );
};

const LbDetailPanel: React.FC<{ lb: GcpLoadBalancer; projectId: string; projects: GcpProject[] }> = ({ lb, projectId, projects }) => {
  const loadBalancerConsoleUrl = buildLoadBalancerConsoleUrl(projectId);
  const cloudArmorConsoleUrl = buildCloudArmorConsoleUrl(projectId);
  const policyMap = useMemo(() => {
    const map = new Map<string, GcpCloudArmorPolicy>();
    projects.forEach((project) => {
      project.armorPolicies.forEach((policy) => {
        map.set(policy.name, policy);
      });
    });
    return map;
  }, [projects]);

  const policyNames = useMemo(() => getLbPolicyNames(lb), [lb]);
  const backendRows = useMemo(
    () => lb.backends.map((backend) => ({
      backend,
      policies: uniqueNonEmpty(lb.backendSecurityPolicies?.[backend] ?? []),
      unavailable: Boolean(lb.backendSecurityPolicyUnavailable?.[backend]),
    })),
    [lb]
  );
  const hasUnavailablePolicies = useMemo(
    () => backendRows.some((row) => row.unavailable),
    [backendRows]
  );
  const mappedPolicyNames = useMemo(
    () => uniqueNonEmpty(backendRows.flatMap((row) => row.policies)),
    [backendRows]
  );
  const unmappedPolicies = useMemo(
    () => policyNames.filter((policyName) => !mappedPolicyNames.includes(policyName)),
    [policyNames, mappedPolicyNames]
  );

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-teal-900/60 border border-teal-700/40 text-[10px] font-bold text-teal-300 flex items-center justify-center">1</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Load Balancer Frontend
          </h4>
          <ConsoleExternalLink href={loadBalancerConsoleUrl} title="Open Load Balancer in GCP Console" text="Open" />
        </div>
        <div className="space-y-0">
          <DetailRow label="Name" value={lb.name} highlight />
          <DetailRow label="LB ID" value={lb.id} mono />
          <DetailRow label="Type" value={LbTypeLabel[lb.type] ?? lb.type} />
          <DetailRow label="IP Address" value={lb.ipAddress} mono highlight />
          <DetailRow label="Protocol" value={lb.protocol} />
          <DetailRow label="Port Range" value={lb.portRange || '—'} mono />
          <DetailRow label="Region" value={lb.region || 'global'} />
          <DetailRow label="Forwarding Rule" value={lb.forwardingRuleName} mono />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 flex items-center justify-center">2</span>
          Backend Services
          <span className="text-slate-500 font-normal normal-case tracking-normal">({lb.backends.length})</span>
        </h4>
        {lb.backends.length > 0 ? (
          <div className="space-y-2">
            {backendRows.map((row, idx) => (
              <div key={row.backend} className="bg-slate-800/50 border border-slate-700/80 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                  <span className="text-xs font-mono text-slate-100 break-all">{row.backend}</span>
                  <ConsoleExternalLink href={loadBalancerConsoleUrl} title="Open backend service in GCP Console" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {row.policies.length > 0
                    ? `${row.policies.length} attached Cloud Armor policy${row.policies.length > 1 ? 'ies' : ''}`
                    : row.unavailable ? 'Cloud Armor lookup unavailable' : 'Not attached to Cloud Armor'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-800/30 border border-dashed border-slate-700/60 rounded-xl p-4 text-xs text-slate-500">
            No backend services attached to this load balancer.
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-red-900/40 border border-red-700/40 text-[10px] font-bold text-red-300 flex items-center justify-center">3</span>
          Cloud Armor (By Backend)
          <span className="text-red-300/70 font-normal normal-case tracking-normal">({policyNames.length})</span>
        </h4>

        {policyNames.length === 0 && !hasUnavailablePolicies ? (
          <div className="bg-slate-800/30 border border-dashed border-slate-700/60 rounded-xl p-4 text-xs text-slate-500">
            Not attached.
          </div>
        ) : (
          <div className="space-y-3">
            {backendRows.map((row) => (
              <div key={`backend-policy-${row.backend}`} className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
                <div className="text-[11px] text-slate-400 mb-2">
                  Backend <span className="font-mono text-slate-200">{row.backend}</span>
                </div>
                {row.policies.length === 0 ? (
                  row.unavailable
                    ? <p className="text-xs text-amber-300">Unavailable.</p>
                    : <p className="text-xs text-slate-500">Not attached.</p>
                ) : (
                  <div className="space-y-2">
                    {row.policies.map((policyName) => {
                      const policy = policyMap.get(policyName);
                      const displayAction = policy?.rules.find((rule) => rule.priority !== 2147483647)?.action;
                      return (
                        <div key={`${row.backend}-${policyName}`} className="bg-slate-800/70 border border-red-900/30 rounded-lg px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-slate-100 break-all">{policyName}</span>
                            <div className="flex items-center gap-2">
                              {displayAction && <ArmorActionBadge action={displayAction} />}
                              <ConsoleExternalLink href={cloudArmorConsoleUrl} title="Open Cloud Armor policy in GCP Console" />
                            </div>
                          </div>
                          {policy ? (
                            <p className="text-[10px] text-slate-500 mt-1">
                              {policy.type} • {policy.rulesCount} rule{policy.rulesCount !== 1 ? 's' : ''}
                            </p>
                          ) : (
                            <p className="text-[10px] text-amber-300 mt-1">Unavailable in inventory (re-scan may be required).</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {unmappedPolicies.length > 0 && (
              <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-3 space-y-2">
                <p className="text-xs text-slate-400">Policies detected but backend mapping unavailable</p>
                <div className="flex flex-wrap gap-1.5">
                  {unmappedPolicies.map((policyName) => (
                    <div key={`unmapped-${policyName}`} className="inline-flex items-center gap-1.5 text-[10px] font-mono bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-300">
                      <span>{policyName}</span>
                      <ConsoleExternalLink href={cloudArmorConsoleUrl} title="Open Cloud Armor policies in GCP Console" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

// ─── Generic / Fallback Detail Panel ──────────────────────────────────────────

const GenericDetailPanel: React.FC<{ match: IpUsageMatch }> = ({ match }) => {
  const metaEntries = Object.entries(match.metadata).filter(([, v]) => v !== undefined && v !== null && v !== '');
  const consoleUrl = buildConsoleUrlForMatch(match);
  return (
    <div className="space-y-4">
      <section className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400">Read-only in Network Planner. Manage changes in GCP Console.</p>
        <ConsoleExternalLink href={consoleUrl} title="Open resource in GCP Console" text="Open" />
      </section>
      <section>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Match Details</h4>
        <div className="space-y-0">
          <DetailRow label="Project" value={match.projectId} mono />
          <DetailRow label="Relation" value={match.relation} />
          <DetailRow label="Matched Field" value={match.matchedField} mono />
          <DetailRow label="Matched Value" value={match.matchedValue} mono highlight />
        </div>
      </section>
      {metaEntries.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resource Details</h4>
          <div className="space-y-0">
            {metaEntries.map(([key, value]) => (
              <DetailRow
                key={key}
                label={key.replace(/([A-Z])/g, ' $1').trim()}
                value={String(value)}
                mono={key.toLowerCase().includes('ip') || key.toLowerCase().includes('cidr')}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ─── Detail Drawer ─────────────────────────────────────────────────────────────

interface DetailDrawerProps {
  detail: NodeDetail | null;
  projects: GcpProject[];
  onClose: () => void;
}

const DetailDrawer: React.FC<DetailDrawerProps> = ({ detail, projects, onClose }) => {
  if (!detail) return null;
  const { match, stage, resolvedInstance, resolvedLb } = detail;
  const stageConfig = STAGE_CONFIG[stage];
  const typeConfig = RESOURCE_TYPE_CONFIG[match.resourceType];
  const consoleUrl = buildConsoleUrlForMatch(match);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] z-50 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className={`p-5 border-b border-slate-700/80 ${stageConfig.color}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stageConfig.badgeColor}`}>
                {typeConfig?.icon}
              </div>
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider">{stageConfig.label}</p>
                <h3 className="text-sm font-bold text-white mt-0.5 break-all">{match.resourceName}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{match.projectId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ConsoleExternalLink href={consoleUrl} title="Open in GCP Console" />
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-5">
          {resolvedInstance && <GceDetailPanel instance={resolvedInstance} projectId={match.projectId} />}
          {resolvedLb && <LbDetailPanel lb={resolvedLb} projectId={match.projectId} projects={projects} />}
          {!resolvedInstance && !resolvedLb && <GenericDetailPanel match={match} />}
        </div>
      </div>
    </>
  );
};

// ─── Flow Node Card ────────────────────────────────────────────────────────────

interface FlowNodeProps {
  match: IpUsageMatch;
  stage: IpUsageStage;
  isSelected: boolean;
  projects: GcpProject[];
  onClick: (detail: NodeDetail) => void;
}

const FlowNode: React.FC<FlowNodeProps> = ({ match, stage, isSelected, projects, onClick }) => {
  const typeConfig = RESOURCE_TYPE_CONFIG[match.resourceType] ?? {
    label: match.resourceType,
    color: 'bg-slate-800',
    borderColor: 'border-slate-600',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth={2} /></svg>,
  };

  // Inline summary for specific resource types
  const inlineSummary = useMemo(() => {
    if (match.resourceType === 'INSTANCE_INTERNAL_IP' || match.resourceType === 'INSTANCE_EXTERNAL_IP') {
      const inst = resolveInstance(projects, match.projectId, match.resourceName);
      if (!inst) return null;
      return (
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <InstanceStatusBadge status={inst.status} />
          <span className="text-[10px] text-slate-400">{inst.machineType}</span>
          <span className="text-[10px] text-slate-500">{inst.zone}</span>
        </div>
      );
    }
    if (match.resourceType === 'LOAD_BALANCER') {
      const lb = resolveLb(projects, match.projectId, match.resourceName);
      if (!lb) return null;
      const policyNames = getLbPolicyNames(lb);
      const unavailablePolicyBackends = lb.backends.filter((backend) => lb.backendSecurityPolicyUnavailable?.[backend]).length;
      const visibleBackends = lb.backends.slice(0, LB_BACKEND_PREVIEW_LIMIT);
      const hiddenBackendCount = lb.backends.length - visibleBackends.length;
      return (
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] bg-teal-900/40 text-teal-300 border border-teal-500/30 rounded px-1.5 py-0.5">
              {LbTypeLabel[lb.type] ?? lb.type}
            </span>
            {lb.region && <span className="text-[10px] text-slate-500">{lb.region}</span>}
            <span className="text-[10px] text-slate-400">FR: {lb.forwardingRuleName}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              backends {lb.backends.length}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              cloud-armor {policyNames.length}
            </span>
            {unavailablePolicyBackends > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/50 text-amber-200">
                unavailable {unavailablePolicyBackends}
              </span>
            )}
          </div>
          {visibleBackends.length > 0 && (
            <div className="text-[10px] text-slate-400 break-all">
              {visibleBackends.join(', ')}
              {hiddenBackendCount > 0 ? ` +${hiddenBackendCount}` : ''}
            </div>
          )}
        </div>
      );
    }
    if (match.resourceType === 'SUBNET') {
      return (
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400">
            <span className="font-mono">{match.metadata.region as string ?? ''}</span>
            <span>VPC: {match.metadata.vpcName as string ?? ''}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">{match.matchedValue}</div>
        </div>
      );
    }
    if (match.resourceType === 'FIREWALL') {
      const action = match.metadata.action as string;
      const direction = match.metadata.direction as string;
      return (
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] border rounded px-1.5 py-0.5 font-semibold ${action === 'ALLOW' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30' : 'bg-red-900/30 text-red-300 border-red-500/30'}`}>
            {action}
          </span>
          <span className="text-[10px] text-slate-500">{direction}</span>
        </div>
      );
    }
    if (match.resourceType === 'ROUTE') {
      return (
        <div className="mt-1 space-y-1">
          <span className="text-[10px] text-slate-400 font-mono">→ {match.metadata.nextHop as string ?? ''}</span>
          <span className="text-[10px] text-slate-500">priority {String(match.metadata.priority ?? '')}</span>
        </div>
      );
    }
    if (match.resourceType === 'CLOUD_ARMOR') {
      return (
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] border rounded px-1.5 py-0.5 font-semibold bg-red-900/30 text-red-300 border-red-500/30">
            {String(match.metadata.action ?? 'rule').toUpperCase()}
          </span>
          <span className="text-[10px] text-slate-500">priority {String(match.metadata.priority ?? '')}</span>
        </div>
      );
    }
    return null;
  }, [match, projects]);

  const handleClick = useCallback(() => {
    const inst =
      match.resourceType === 'INSTANCE_INTERNAL_IP' || match.resourceType === 'INSTANCE_EXTERNAL_IP'
        ? resolveInstance(projects, match.projectId, match.resourceName)
        : undefined;
    const lb =
      match.resourceType === 'LOAD_BALANCER'
        ? resolveLb(projects, match.projectId, match.resourceName)
        : undefined;
    onClick({ match, stage, resolvedInstance: inst, resolvedLb: lb });
  }, [match, stage, projects, onClick]);

  return (
    <button
      type="button"
      id={`flow-node-${match.id}`}
      onClick={handleClick}
      className={`group relative flex flex-col gap-1.5 p-3 rounded-xl border cursor-pointer transition-all duration-200 text-left min-w-[200px] max-w-[260px] hover:scale-[1.03] hover:shadow-lg ${typeConfig.color} ${typeConfig.borderColor} ${isSelected ? 'ring-2 ring-white/25 scale-[1.03]' : ''}`}
    >
      {/* Type row */}
      <div className="flex items-center gap-2">
        <div className="text-slate-300 shrink-0">{typeConfig.icon}</div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">{typeConfig.label}</span>
        {isSelected && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
        )}
      </div>

      {/* Resource name */}
      <div className="font-semibold text-sm text-white leading-tight truncate" title={match.resourceName}>
        {match.resourceName}
      </div>

      {/* Inline summary */}
      {inlineSummary}

      {/* Matched value */}
      <div className="font-mono text-[11px] text-slate-400 truncate mt-0.5" title={match.matchedValue}>
        {match.matchedField}: <span className="text-slate-200">{match.matchedValue}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-1 mt-1">
        <span className="text-[10px] text-slate-500 truncate max-w-[140px]" title={match.projectId}>{match.projectId}</span>
        <span className="text-[9px] text-slate-600 shrink-0 flex items-center gap-1">
          Details
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>

      <div className="absolute inset-0 rounded-xl ring-1 ring-white/0 group-hover:ring-white/8 transition-all duration-200" />
    </button>
  );
};

// ─── Stage Row ────────────────────────────────────────────────────────────────

interface StageRowProps {
  stage: IpUsageStage;
  items: IpUsageMatch[];
  selectedNodeId: string | null;
  projects: GcpProject[];
  onNodeClick: (detail: NodeDetail) => void;
}

const StageRow: React.FC<StageRowProps> = ({ stage, items, selectedNodeId, projects, onNodeClick }) => {
  const [expanded, setExpanded] = useState(false);
  const config = STAGE_CONFIG[stage];

  if (items.length === 0) return null;

  const visibleItems = expanded ? items : items.slice(0, MAX_VISIBLE_NODES);
  const hiddenCount = items.length - MAX_VISIBLE_NODES;

  return (
    <div className={`rounded-2xl border p-5 ${config.color} ${config.borderColor} shadow-lg ${config.glowColor}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${config.badgeColor}`}>
          {config.stepIndex}
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">{config.label}</h3>
          <p className="text-xs text-slate-400">{config.description}</p>
        </div>
        <span className={`ml-auto text-xs border rounded-full px-2.5 py-0.5 font-semibold ${config.badgeColor}`}>
          {items.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {visibleItems.map((item) => (
          <FlowNode
            key={item.id}
            match={item}
            stage={stage}
            isSelected={selectedNodeId === item.id}
            projects={projects}
            onClick={onNodeClick}
          />
        ))}
        {hiddenCount > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors text-sm min-w-[100px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            +{hiddenCount}
          </button>
        )}
        {expanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors text-sm min-w-[100px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
            Collapse
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Selected LB Chain ────────────────────────────────────────────────────────

const SelectedLbChainCard: React.FC<{ lb: GcpLoadBalancer; projectId: string; projects: GcpProject[] }> = ({ lb, projectId, projects }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleBackends = expanded ? lb.backends : lb.backends.slice(0, LB_BACKEND_PREVIEW_LIMIT);
  const hasHiddenBackends = lb.backends.length > LB_BACKEND_PREVIEW_LIMIT;
  const hiddenBackendCount = lb.backends.length - visibleBackends.length;
  const policyNames = getLbPolicyNames(lb);
  const unavailablePolicyBackends = lb.backends.filter((backend) => lb.backendSecurityPolicyUnavailable?.[backend]).length;
  const loadBalancerConsoleUrl = buildLoadBalancerConsoleUrl(projectId);
  const cloudArmorConsoleUrl = buildCloudArmorConsoleUrl(projectId);
  const policyLookup = useMemo(() => {
    const lookup = new Map<string, GcpCloudArmorPolicy>();
    projects.forEach((project) => {
      project.armorPolicies.forEach((policy) => {
        lookup.set(policy.name, policy);
      });
    });
    return lookup;
  }, [projects]);

  return (
    <div data-testid="lb-flow-chain-card" className="rounded-2xl border border-teal-600/40 bg-slate-900/70 p-5 shadow-xl shadow-teal-900/20 mt-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-teal-300">LB Flow Chain</h3>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full border border-teal-700/60 bg-teal-900/40 text-teal-200">
            backends {lb.backends.length}
          </span>
          <span className="px-2 py-0.5 rounded-full border border-red-700/60 bg-red-900/30 text-red-200">
            policies {policyNames.length}
          </span>
          {unavailablePolicyBackends > 0 && (
            <span className="px-2 py-0.5 rounded-full border border-amber-700/60 bg-amber-900/30 text-amber-200">
              unavailable {unavailablePolicyBackends}
            </span>
          )}
          <ConsoleExternalLink href={loadBalancerConsoleUrl} title="Open Load Balancer in GCP Console" text="Open" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">1. Frontend</p>
          <p className="text-xs font-semibold text-slate-100 break-all">{lb.forwardingRuleName}</p>
          <p className="text-[11px] text-slate-400 font-mono mt-1">{lb.ipAddress}:{lb.portRange || 'all'}</p>
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">2. Backend Services</p>
          {visibleBackends.length > 0 ? (
            <div className="space-y-1.5">
              {visibleBackends.map((backend) => (
                <div key={`chain-backend-${backend}`} className="flex items-center gap-1.5 text-[11px] font-mono text-slate-200 break-all">
                  <span>{backend}</span>
                  <ConsoleExternalLink href={loadBalancerConsoleUrl} title="Open backend services in GCP Console" />
                </div>
              ))}
              {hasHiddenBackends && (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="text-[10px] text-blue-300 hover:text-blue-200 transition-colors"
                >
                  {expanded ? 'Show less' : `+${hiddenBackendCount} more`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Not attached.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">3. Cloud Armor</p>
          {visibleBackends.length > 0 ? (
            <div className="space-y-1.5">
              {visibleBackends.map((backendName) => {
                const attachedPolicies = uniqueNonEmpty(lb.backendSecurityPolicies?.[backendName] ?? []);
                const lookupUnavailable = Boolean(lb.backendSecurityPolicyUnavailable?.[backendName]);
                return (
                  <div key={`chain-policy-${backendName}`} className="text-[11px] text-slate-200 break-all">
                    <span className="text-slate-400">{backendName}:</span>{' '}
                    {attachedPolicies.length > 0 ? attachedPolicies.map((policyName, idx) => {
                      const policy = policyLookup.get(policyName);
                      return (
                        <span key={`${backendName}-${policyName}`}>
                          <span className="font-mono">{policyName}</span>
                          <ConsoleExternalLink href={cloudArmorConsoleUrl} title="Open Cloud Armor policies in GCP Console" className="inline-flex ml-1" />
                          {!policy && <span className="text-amber-300 ml-1">(Unavailable)</span>}
                          {idx < attachedPolicies.length - 1 ? ', ' : ''}
                        </span>
                      );
                    }) : lookupUnavailable ? <span className="text-amber-300">Unavailable</span> : <span className="text-slate-500">Not attached</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Not attached.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Flow Arrow ───────────────────────────────────────────────────────────────

const FlowArrow: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center gap-1 py-2">
    <div className="w-px h-6 bg-gradient-to-b from-slate-600 to-slate-500" />
    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{label}</span>
    <svg className="w-4 h-4 text-slate-500" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 12l-5-5h10l-5 5z" />
    </svg>
  </div>
);

// ─── Source Node ──────────────────────────────────────────────────────────────

const SourceNode: React.FC<{ ipKind: IpAddressKind | null; ip: string }> = ({ ipKind, ip }) => (
  <div className="flex justify-center">
    <div className={`relative flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-lg ${
      ipKind === 'EXTERNAL' ? 'bg-blue-950/80 border-blue-400/50 shadow-blue-500/20'
      : ipKind === 'INTERNAL' ? 'bg-emerald-950/80 border-emerald-400/50 shadow-emerald-500/20'
      : 'bg-slate-800 border-slate-600'
    }`}>
      <div className={`p-2.5 rounded-xl ${
        ipKind === 'EXTERNAL' ? 'bg-blue-500/20 text-blue-300'
        : ipKind === 'INTERNAL' ? 'bg-emerald-500/20 text-emerald-300'
        : 'bg-slate-700 text-slate-400'
      }`}>
        {ipKind === 'EXTERNAL' ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        )}
      </div>
      <div>
        <div className="text-xs text-slate-400 font-medium">
          {ipKind === 'EXTERNAL' ? 'External IP' : ipKind === 'INTERNAL' ? 'Internal IP' : 'IP Address'}
        </div>
        <div className="font-mono text-base font-bold text-white tracking-wide">{ip}</div>
      </div>
      {ipKind && <div className="ml-2"><IpKindBadge kind={ipKind} /></div>}
      <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ipKind === 'EXTERNAL' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
        <span className={`relative inline-flex rounded-full h-3 w-3 ${ipKind === 'EXTERNAL' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
      </span>
    </div>
  </div>
);

// ─── Empty States ─────────────────────────────────────────────────────────────

const EmptySearchState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 gap-5 text-slate-500">
    <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60">
      <svg className="w-14 h-14 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
    <div className="text-center space-y-1">
      <p className="text-sm font-medium text-slate-400">Enter an IP to trace its flow</p>
      <p className="text-xs text-slate-600">Supports internal (10.x / 172.16.x / 192.168.x) and external IPs</p>
    </div>
  </div>
);

const NoMatchState: React.FC<{ ip: string }> = ({ ip }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-5 text-slate-500">
    <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60">
      <svg className="w-14 h-14 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <div className="text-center space-y-1">
      <p className="text-sm font-medium text-slate-400">
        No resources found for <span className="font-mono text-white">{ip}</span>
      </p>
      <p className="text-xs text-slate-600">This IP is not referenced in any loaded project's inventory</p>
    </div>
  </div>
);

// ─── Summary Pills ────────────────────────────────────────────────────────────

const SummaryBar: React.FC<{ result: IpUsageResult; ipKind: IpAddressKind | null }> = ({ result, ipKind }) => (
  <div className="flex flex-wrap items-center gap-2">
    {ipKind && <IpKindBadge kind={ipKind} />}
    {[
      { label: 'Projects', value: result.totals.projectCount, color: 'text-slate-300' },
      { label: 'Network', value: result.totals.networkCount, color: 'text-blue-300' },
      { label: 'Endpoint', value: result.totals.endpointCount, color: 'text-emerald-300' },
      { label: 'Policy', value: result.totals.policyCount, color: 'text-amber-300' },
    ].filter(({ value }) => value > 0).map(({ label, value, color }) => (
      <span key={label} className="inline-flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-full px-3 py-1 text-xs">
        <span className="text-slate-500">{label}</span>
        <span className={`font-bold ${color}`}>{value}</span>
      </span>
    ))}
    <span className="text-xs text-slate-600 ml-auto">
      {result.totals.totalMatches} match{result.totals.totalMatches !== 1 ? 'es' : ''}
    </span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const IpFlowVisualizer: React.FC<Props> = ({
  projects,
  selectedProjectId,
  selectedServiceAccountId,
  scanStatus,
  onRescanAllProjects,
}) => {
  const [ipInput, setIpInput] = useState('');
  const [searchTarget, setSearchTarget] = useState('');
  const [ipError, setIpError] = useState('');
  const [scopeMode, setScopeMode] = useState<'current' | 'all'>('current');
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [isRescanning, setIsRescanning] = useState(false);

  const currentProjectId = selectedProjectId || 'all';
  const effectiveScope = scopeMode === 'all' ? 'all' : currentProjectId;
  const scopeLabel = effectiveScope === 'all' ? 'All Projects' : effectiveScope;

  const ipUsageResult = useMemo<IpUsageResult | null>(() => {
    if (!searchTarget) return null;
    return buildIpUsageResult(projects, effectiveScope, searchTarget, {
      cloudArmorMode: 'lb_attached_only',
      includeFirewallRules: false,
      includeLbPolicyReferences: true,
    });
  }, [projects, effectiveScope, searchTarget]);

  const searchTargetKind = useMemo<IpAddressKind | null>(
    () => (searchTarget && validateIpv4(searchTarget) ? inferIpAddressKind(searchTarget) : null),
    [searchTarget]
  );

  const activeStages = useMemo<IpUsageStage[]>(() => {
    if (!ipUsageResult) return [];
    return STAGE_ORDER.filter((s) => ipUsageResult.itemsByStage[s].length > 0);
  }, [ipUsageResult]);

  const handleSearch = useCallback(() => {
    const normalized = ipInput.trim();
    if (!normalized) { setIpError(''); setSearchTarget(''); return; }
    if (!validateIpv4(normalized)) {
      setIpError('Please enter a valid IPv4 address (e.g. 10.0.0.10 or 34.102.3.5).');
      setSearchTarget('');
      return;
    }
    setIpError('');
    setSearchTarget(normalized);
    setSelectedNode(null);
  }, [ipInput]);

  const handleRescan = useCallback(async () => {
    if (!selectedServiceAccountId || isRescanning) return;
    setIsRescanning(true);
    try { await onRescanAllProjects(); } finally { setIsRescanning(false); }
  }, [selectedServiceAccountId, isRescanning, onRescanAllProjects]);

  const isScanning = scanStatus === 'queued' || scanStatus === 'running';
  const hasWarning = scanStatus === 'partial' || scanStatus === 'failed';

  const arrowLabels: Record<IpUsageStage, string> = {
    NETWORK: 'routed to',
    ENDPOINT: 'assigned to',
    POLICY: 'governed by',
  };

  return (
    <div className="flex flex-col gap-6 pb-8 relative">
      {/* ── Header ── */}
      <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-900/40">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">IP Flow Visualizer</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Trace how an IP is used across GCP — network, endpoint & policy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs border rounded-full px-3 py-1 bg-sky-500/15 border-sky-500/40 text-sky-300">
              READ ONLY
            </span>
            <span className={`text-xs border rounded-full px-3 py-1 ${
              isScanning ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
              : hasWarning ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : scanStatus === 'success' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-700/50 border-slate-600 text-slate-400'
            }`}>
              {isScanning ? '⏳ Scanning…' : scanStatus}
            </span>
            <button
              type="button"
              id="ip-flow-rescan-btn"
              onClick={handleRescan}
              disabled={!selectedServiceAccountId || isRescanning || isScanning}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isRescanning ? 'Rescanning…' : 'Rescan'}
            </button>
          </div>
        </div>
        <div className="mt-4 text-xs text-sky-300 bg-sky-950/40 border border-sky-900 rounded-lg px-3 py-2">
          This view is read-only. For any resource edits, use the external-link icons to continue in GCP Console.
        </div>
        {hasWarning && (
          <div className="mt-4 text-xs text-amber-300 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
            ⚠ Inventory may be incomplete — scan ended with errors or partial data.
          </div>
        )}
      </div>

      {/* ── Search Bar ── */}
      <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="11" cy="11" r="8" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <input
              id="ip-flow-search-input"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              placeholder="Internal (10.x.x.x) or External IP (e.g. 34.102.3.5)"
              className={`w-full bg-slate-900 border rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
                ipError ? 'border-red-500/60 focus:border-red-400' : 'border-slate-700 focus:border-blue-500'
              }`}
            />
          </div>
          <select
            id="ip-flow-scope-select"
            value={scopeMode}
            onChange={(e) => setScopeMode(e.target.value === 'all' ? 'all' : 'current')}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 min-w-48"
          >
            <option value="current">Scope: {scopeLabel}</option>
            <option value="all">All Loaded Projects</option>
          </select>
          <button
            id="ip-flow-search-btn"
            type="button"
            onClick={handleSearch}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition-all duration-200 shrink-0"
          >
            Trace IP
          </button>
        </div>

        {ipError && (
          <div className="flex items-center gap-2 text-xs text-red-300 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {ipError}
          </div>
        )}

        {searchTarget && ipUsageResult && <SummaryBar result={ipUsageResult} ipKind={searchTargetKind} />}
      </div>

      {/* ── Flow Diagram ── */}
      {!searchTarget && <EmptySearchState />}
      {searchTarget && ipUsageResult?.totals.totalMatches === 0 && <NoMatchState ip={searchTarget} />}
      {searchTarget && ipUsageResult && ipUsageResult.totals.totalMatches > 0 && (
        <div className="space-y-0">
          <SourceNode ipKind={searchTargetKind} ip={searchTarget} />
          {activeStages.map((stage) => (
            <div key={stage}>
              <FlowArrow label={arrowLabels[stage]} />
              <StageRow
                stage={stage}
                items={ipUsageResult.itemsByStage[stage]}
                selectedNodeId={selectedNode?.match.id ?? null}
                projects={projects}
                onNodeClick={setSelectedNode}
              />
            </div>
          ))}
          {selectedNode?.resolvedLb && (
            <SelectedLbChainCard lb={selectedNode.resolvedLb} projectId={selectedNode.match.projectId} projects={projects} />
          )}
          <div className="flex flex-col items-center pt-3">
            <div className="w-px h-4 bg-slate-700" />
            <div className="text-xs text-slate-600 border border-slate-700 rounded-full px-3 py-1 bg-slate-900">
              end of trace
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Drawer ── */}
      <DetailDrawer detail={selectedNode} projects={projects} onClose={() => setSelectedNode(null)} />
    </div>
  );
};
