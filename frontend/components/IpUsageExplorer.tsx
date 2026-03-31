import React, { useMemo, useState } from 'react';
import { GcpProject, IpAddressKind, IpCatalogItem, IpUsageMatch, IpUsageStage } from '../types';
import { buildIpCatalog, buildIpUsageResult, inferIpAddressKind, validateIpv4 } from '../utils/ipUsage';

type ScanStatus = 'idle' | 'queued' | 'running' | 'partial' | 'success' | 'failed';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
  selectedServiceAccountId: string;
  scanStatus: ScanStatus;
  scanId: string;
  scanErrors: { projectId: string; error: string }[];
  lastScannedAt: string;
  onRescanAllProjects: () => Promise<void>;
}

const STAGE_ORDER: IpUsageStage[] = ['NETWORK', 'ENDPOINT', 'POLICY'];

const STAGE_LABELS: Record<IpUsageStage, { index: number; title: string; description: string }> = {
  NETWORK: {
    index: 1,
    title: 'Network Containment',
    description: 'Project / VPC / Subnet CIDR that contains the input IP.',
  },
  ENDPOINT: {
    index: 2,
    title: 'Endpoint Ownership',
    description: 'Resources with exact ownership of the input IP.',
  },
  POLICY: {
    index: 3,
    title: 'Policy References',
    description: 'Policy objects where the input IP is referenced by CIDR rules.',
  },
};

const RELATION_LABELS = {
  EXACT: 'Exact Match',
  CIDR_CONTAINS: 'CIDR Contains',
  RULE_REFERENCE: 'Rule Reference',
} as const;

const IP_KIND_LABELS: Record<IpAddressKind, string> = {
  INTERNAL: 'Internal',
  EXTERNAL: 'External',
};

const getScanStatusStyle = (status: ScanStatus): string => {
  switch (status) {
    case 'success':
      return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
    case 'partial':
      return 'bg-amber-500/15 border-amber-500/40 text-amber-300';
    case 'failed':
      return 'bg-red-500/15 border-red-500/40 text-red-300';
    case 'running':
      return 'bg-blue-500/15 border-blue-500/40 text-blue-300';
    case 'queued':
      return 'bg-sky-500/15 border-sky-500/40 text-sky-300';
    default:
      return 'bg-slate-600/20 border-slate-600/40 text-slate-300';
  }
};

const getIpKindBadgeClass = (kind: IpAddressKind): string =>
  kind === 'INTERNAL'
    ? 'border-emerald-700 text-emerald-300 bg-emerald-900/20'
    : 'border-blue-700 text-blue-300 bg-blue-900/20';

const getResourceTypeLabel = (match: IpUsageMatch): string => {
  if (match.resourceType === 'INSTANCE_INTERNAL_IP') {
    return 'Instance (Internal IP)';
  }
  if (match.resourceType === 'INSTANCE_EXTERNAL_IP') {
    return 'Instance (External IP)';
  }
  if (match.resourceType === 'LOAD_BALANCER') {
    return 'Load Balancer';
  }
  if (match.resourceType === 'SUBNET') {
    return 'Subnet';
  }
  if (match.resourceType === 'FIREWALL') {
    return 'Firewall Rule';
  }
  if (match.resourceType === 'ROUTE') {
    return 'Route';
  }
  if (match.resourceType === 'CLOUD_ARMOR') {
    return 'Cloud Armor Rule';
  }
  return match.resourceType;
};

export const IpUsageExplorer: React.FC<Props> = ({
  projects,
  selectedProjectId,
  selectedServiceAccountId,
  scanStatus,
  scanId,
  scanErrors,
  lastScannedAt,
  onRescanAllProjects,
}) => {
  const [ipInput, setIpInput] = useState('');
  const [ipSearchTarget, setIpSearchTarget] = useState('');
  const [ipInputError, setIpInputError] = useState('');
  const [ipScopeMode, setIpScopeMode] = useState<'current' | 'all'>('current');
  const [ipListTab, setIpListTab] = useState<IpAddressKind>('EXTERNAL');
  const [ipListFilter, setIpListFilter] = useState('');
  const [isRescanning, setIsRescanning] = useState(false);

  const currentScopeProjectId = selectedProjectId || 'all';
  const scopeDisplay = currentScopeProjectId === 'all' ? 'All Loaded Projects' : currentScopeProjectId;

  const scopedProjects = useMemo(
    () => projects.filter((project) => currentScopeProjectId === 'all' || project.projectId === currentScopeProjectId),
    [projects, currentScopeProjectId]
  );

  const staleCount = useMemo(
    () => scopedProjects.filter((project) => project.stale).length,
    [scopedProjects]
  );

  const effectiveIpScope = ipScopeMode === 'all' ? 'all' : currentScopeProjectId;
  const effectiveIpScopeLabel = effectiveIpScope === 'all' ? 'All Loaded Projects' : effectiveIpScope;

  const hasFreshnessRisk = scanStatus === 'partial' || scanStatus === 'failed' || staleCount > 0;

  const ipCatalog = useMemo(
    () => buildIpCatalog(projects, effectiveIpScope),
    [projects, effectiveIpScope]
  );

  const activeCatalogItems = useMemo(() => {
    const filterKeyword = ipListFilter.trim().toLowerCase();
    const source = ipCatalog[ipListTab];
    if (!filterKeyword) {
      return source;
    }

    return source.filter((item) => {
      const resourceText = item.resources.join(' ').toLowerCase();
      return (
        item.ip.includes(filterKeyword) ||
        item.projectId.toLowerCase().includes(filterKeyword) ||
        resourceText.includes(filterKeyword)
      );
    });
  }, [ipCatalog, ipListFilter, ipListTab]);

  const ipUsageResult = useMemo(() => {
    if (!ipSearchTarget) {
      return null;
    }
    return buildIpUsageResult(projects, effectiveIpScope, ipSearchTarget);
  }, [projects, effectiveIpScope, ipSearchTarget]);

  const searchTargetKind = useMemo(
    () => (ipSearchTarget && validateIpv4(ipSearchTarget) ? inferIpAddressKind(ipSearchTarget) : null),
    [ipSearchTarget]
  );

  const hasTabMismatch = Boolean(searchTargetKind && searchTargetKind !== ipListTab);

  const runIpSearch = () => {
    const normalized = ipInput.trim();
    if (!normalized) {
      setIpInputError('');
      setIpSearchTarget('');
      return;
    }

    if (!validateIpv4(normalized)) {
      setIpInputError('Please enter a valid IPv4 address (example: 10.0.0.10).');
      setIpSearchTarget('');
      return;
    }

    setIpInputError('');
    setIpSearchTarget(normalized);
  };

  const runCatalogSelection = (item: IpCatalogItem) => {
    setIpInput(item.ip);
    setIpInputError('');
    setIpSearchTarget(item.ip);
  };

  const runRescan = async () => {
    if (!selectedServiceAccountId || isRescanning) {
      return;
    }

    setIsRescanning(true);
    try {
      await onRescanAllProjects();
    } finally {
      setIsRescanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">IP Usage Explorer</h2>
            <p className="text-sm text-slate-400 mt-1">
              Search a single IPv4 and inspect network containment, endpoint ownership, and policy references.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runRescan}
              disabled={!selectedServiceAccountId || isRescanning || scanStatus === 'queued' || scanStatus === 'running'}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRescanning ? 'Rescanning...' : 'Rescan All Projects'}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            <div className="text-slate-500 uppercase tracking-wide">Project Scope</div>
            <div className="mt-1 text-slate-100 text-sm">{scopeDisplay}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            <div className="text-slate-500 uppercase tracking-wide">Scan Status</div>
            <div className="mt-1">
              <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${getScanStatusStyle(scanStatus)}`}>
                {scanStatus}
              </span>
            </div>
            <div className="mt-2 text-slate-500 uppercase tracking-wide">Scan ID</div>
            <div className="mt-1 font-mono text-[11px] text-slate-300 break-all">{scanId || 'N/A'}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            <div className="text-slate-500 uppercase tracking-wide">Last Scanned At</div>
            <div className="mt-1 text-slate-100 text-sm break-all">{lastScannedAt || 'N/A'}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            <div className="text-slate-500 uppercase tracking-wide">Data Quality</div>
            <div className="mt-1 text-slate-100 text-sm">stale projects: {staleCount}</div>
            <div className="mt-1 text-slate-100 text-sm">scan errors: {scanErrors.length}</div>
          </div>
        </div>

        {hasFreshnessRisk && (
          <div className="mt-3 text-xs text-amber-300 bg-amber-900/20 border border-amber-800 rounded px-3 py-2">
            Inventory is not fully fresh. Review scan status and per-project errors before finalizing IP usage analysis.
          </div>
        )}
      </div>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center gap-2">
          <input
            value={ipInput}
            onChange={(event) => setIpInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                runIpSearch();
              }
            }}
            placeholder="Search IPv4 (example: 10.0.0.10)"
            aria-label="IP usage search input"
            className="xl:flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={ipScopeMode}
            onChange={(event) => setIpScopeMode(event.target.value === 'all' ? 'all' : 'current')}
            aria-label="IP usage scope mode"
            className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 min-w-56"
          >
            <option value="current">Follow Current Scope ({scopeDisplay})</option>
            <option value="all">All Loaded Projects</option>
          </select>
          <button
            type="button"
            onClick={runIpSearch}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
          >
            Search
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIpListTab('EXTERNAL')}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                ipListTab === 'EXTERNAL'
                  ? 'bg-blue-900/30 border-blue-700 text-blue-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              External IPs ({ipCatalog.EXTERNAL.length})
            </button>
            <button
              type="button"
              onClick={() => setIpListTab('INTERNAL')}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                ipListTab === 'INTERNAL'
                  ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Internal IPs ({ipCatalog.INTERNAL.length})
            </button>
          </div>

          <input
            value={ipListFilter}
            onChange={(event) => setIpListFilter(event.target.value)}
            placeholder="Filter IP list by ip/project/resource..."
            aria-label="IP catalog filter input"
            className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-100"
          />

          <div className="border border-slate-700 rounded overflow-x-auto max-h-60">
            <table className="w-full text-xs">
              <thead className="text-slate-400 uppercase border-b border-slate-700 bg-slate-900/70">
                <tr>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="text-left px-3 py-2">Project</th>
                  <th className="text-right px-3 py-2">Usage</th>
                  <th className="text-left px-3 py-2">Primary Resources</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {activeCatalogItems.map((item) => (
                  <tr
                    key={`${item.projectId}-${item.kind}-${item.ip}`}
                    onClick={() => runCatalogSelection(item)}
                    className="cursor-pointer hover:bg-slate-700/30"
                  >
                    <td className="px-3 py-2 font-mono text-slate-100">{item.ip}</td>
                    <td className="px-3 py-2 text-slate-300">{item.projectId}</td>
                    <td className="px-3 py-2 text-slate-300 text-right">{item.usageCount}</td>
                    <td className="px-3 py-2 text-slate-400">{item.resources.slice(0, 2).join(', ')}</td>
                  </tr>
                ))}
                {activeCatalogItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                      No {IP_KIND_LABELS[ipListTab].toLowerCase()} IP records in current scope/filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-slate-900/70 border border-slate-700 rounded px-2 py-1 text-slate-300">
            effective scope: <span className="text-slate-100">{effectiveIpScopeLabel}</span>
          </span>
          {ipUsageResult && (
            <>
              <span className="bg-slate-900/70 border border-slate-700 rounded px-2 py-1 text-slate-300">
                total matches: <span className="text-slate-100">{ipUsageResult.totals.totalMatches}</span>
              </span>
              <span className="bg-slate-900/70 border border-slate-700 rounded px-2 py-1 text-slate-300">
                projects: <span className="text-slate-100">{ipUsageResult.totals.projectCount}</span>
              </span>
              <span className="bg-slate-900/70 border border-slate-700 rounded px-2 py-1 text-slate-300">
                network: <span className="text-slate-100">{ipUsageResult.totals.networkCount}</span>
              </span>
              <span className="bg-slate-900/70 border border-slate-700 rounded px-2 py-1 text-slate-300">
                endpoint: <span className="text-slate-100">{ipUsageResult.totals.endpointCount}</span>
              </span>
              <span className="bg-slate-900/70 border border-slate-700 rounded px-2 py-1 text-slate-300">
                policy: <span className="text-slate-100">{ipUsageResult.totals.policyCount}</span>
              </span>
            </>
          )}
        </div>

        {ipInputError && (
          <div className="text-xs text-red-300 bg-red-900/20 border border-red-800 rounded px-3 py-2">
            {ipInputError}
          </div>
        )}

        {ipSearchTarget && hasFreshnessRisk && (
          <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800 rounded px-3 py-2">
            IP usage results may be incomplete due to partial/failed scan or stale inventory.
          </div>
        )}

        {hasTabMismatch && searchTargetKind && (
          <div className="text-xs text-sky-300 bg-sky-900/20 border border-sky-800 rounded px-3 py-2">
            Current list tab is {IP_KIND_LABELS[ipListTab].toLowerCase()}, but searched IP appears to be{' '}
            {IP_KIND_LABELS[searchTargetKind].toLowerCase()} by RFC1918 classification.
          </div>
        )}

        {!ipSearchTarget && !ipInputError && (
          <div className="text-xs text-slate-400 bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            Enter an IPv4 address and run search to render the resource sequence timeline.
          </div>
        )}

        {ipUsageResult && ipUsageResult.totals.totalMatches === 0 && (
          <div className="text-xs text-slate-300 bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            No resources found using IP <span className="font-mono">{ipUsageResult.inputIp}</span> in scope{' '}
            <span className="font-mono">{effectiveIpScopeLabel}</span>.
          </div>
        )}

        {ipUsageResult && ipUsageResult.totals.totalMatches > 0 && (
          <div className="space-y-3">
            {STAGE_ORDER.map((stage) => {
              const stageInfo = STAGE_LABELS[stage];
              const items = ipUsageResult.itemsByStage[stage];
              return (
                <div key={stage} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-slate-700 text-[11px] text-slate-100 font-semibold">
                      {stageInfo.index}
                    </span>
                    <h4 className="text-sm font-semibold text-white">{stageInfo.title}</h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{stageInfo.description}</p>
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-500 mt-2">No matches in this stage.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="text-xs border border-slate-700 rounded px-3 py-2 bg-slate-800/70">
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="font-semibold text-slate-100">{item.resourceName}</span>
                            <span className="text-[10px] border border-slate-600 rounded px-1.5 py-0.5 text-slate-300">
                              {getResourceTypeLabel(item)}
                            </span>
                            <span className="text-[10px] border border-slate-600 rounded px-1.5 py-0.5 text-slate-400">
                              {RELATION_LABELS[item.relation]}
                            </span>
                            <span className="text-[10px] border border-slate-600 rounded px-1.5 py-0.5 text-slate-400">
                              {item.projectId}
                            </span>
                            {item.stage === 'ENDPOINT' && item.metadata.ipKind && (
                              <span className={`text-[10px] border rounded px-1.5 py-0.5 ${getIpKindBadgeClass(item.metadata.ipKind)}`}>
                                {item.metadata.ipKind}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-slate-400 font-mono">
                            {item.matchedField}: {item.matchedValue}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
