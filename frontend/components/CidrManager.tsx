import React, { useEffect, useMemo, useState } from 'react';
import { GcpProject } from '../types';
import {
  buildCidrInventory,
  detectCidrConflicts,
  suggestNextAvailablePrivateCidr,
} from '../utils/cidrManager';
import { parseCidr } from '../utils/cidr';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
  selectedServiceAccountId: string;
  scanStatus: 'idle' | 'queued' | 'running' | 'partial' | 'success' | 'failed';
  scanId: string;
  scanErrors: { projectId: string; error: string }[];
  lastScannedAt: string;
  onRescanAllProjects: () => Promise<void>;
  onNavigateToIpUsageExplorer: () => void;
}

type SortKey = 'cidr' | 'projectId' | 'vpcName' | 'subnetName' | 'region' | 'totalIps';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'cidr', label: 'CIDR' },
  { key: 'projectId', label: 'Project' },
  { key: 'vpcName', label: 'VPC' },
  { key: 'subnetName', label: 'Subnet' },
  { key: 'region', label: 'Region' },
  { key: 'totalIps', label: 'IPs' },
];

const isSortKey = (value: string): value is SortKey =>
  SORT_OPTIONS.some((option) => option.key === value);

const getPrefixFromCidr = (cidr: string): number => {
  const prefix = Number.parseInt(cidr.split('/')[1] || '', 10);
  return Number.isInteger(prefix) ? prefix : 32;
};

const getScanStatusStyle = (
  status: 'idle' | 'queued' | 'running' | 'partial' | 'success' | 'failed'
): string => {
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

export const CidrManager: React.FC<Props> = ({
  projects,
  selectedProjectId,
  selectedServiceAccountId,
  scanStatus,
  scanId,
  scanErrors,
  lastScannedAt,
  onRescanAllProjects,
  onNavigateToIpUsageExplorer,
}) => {
  const [search, setSearch] = useState('');
  const [scopeProjectId, setScopeProjectId] = useState<string>(selectedProjectId || 'all');
  const [sortKey, setSortKey] = useState<SortKey>('cidr');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [inputCidr, setInputCidr] = useState('');
  const [planningPrefix, setPlanningPrefix] = useState('24');
  const [isRescanning, setIsRescanning] = useState(false);
  const scopeDisplay = scopeProjectId === 'all' ? 'All Loaded Projects' : scopeProjectId;

  useEffect(() => {
    setScopeProjectId(selectedProjectId || 'all');
  }, [selectedProjectId]);

  const sortedProjects = useMemo(
    () => [...projects].sort((left, right) => left.projectId.localeCompare(right.projectId)),
    [projects]
  );

  const rows = useMemo(
    () => buildCidrInventory(projects, scopeProjectId),
    [projects, scopeProjectId]
  );

  const staleCount = useMemo(
    () => rows.filter((row) => row.stale).length,
    [rows]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return rows;
    }
    return rows.filter((row) =>
      [
        row.projectId,
        row.projectName,
        row.vpcName,
        row.subnetName,
        row.region,
        row.cidr,
      ].some((value) => value.toLowerCase().includes(keyword))
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((left, right) => {
      if (sortKey === 'cidr') {
        const leftParsed = parseCidr(left.cidr);
        const rightParsed = parseCidr(right.cidr);
        if (!leftParsed && !rightParsed) {
          return left.cidr.localeCompare(right.cidr);
        }
        if (!leftParsed) {
          return 1;
        }
        if (!rightParsed) {
          return -1;
        }
        if (leftParsed.low !== rightParsed.low) {
          return leftParsed.low - rightParsed.low;
        }
        const prefixDiff = getPrefixFromCidr(left.cidr) - getPrefixFromCidr(right.cidr);
        if (prefixDiff !== 0) {
          return prefixDiff;
        }
        return left.cidr.localeCompare(right.cidr);
      }

      if (sortKey === 'totalIps') {
        return left.totalIps - right.totalIps;
      }

      return left[sortKey].localeCompare(right[sortKey]);
    });

    if (sortDirection === 'desc') {
      list.reverse();
    }
    return list;
  }, [filteredRows, sortDirection, sortKey]);

  const hasFreshnessRisk = scanStatus === 'partial' || scanStatus === 'failed' || staleCount > 0;

  const conflictResult = useMemo(
    () => detectCidrConflicts(inputCidr, rows),
    [inputCidr, rows]
  );

  const prefixNumber = Number.parseInt(planningPrefix, 10);
  const suggestion = useMemo(() => {
    if (!Number.isInteger(prefixNumber)) {
      return null;
    }
    return suggestNextAvailablePrivateCidr(prefixNumber, rows);
  }, [prefixNumber, rows]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return '↕';
    }
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleExportCsv = () => {
    const headers = [
      'projectId',
      'projectName',
      'vpcName',
      'subnetName',
      'region',
      'cidr',
      'totalIps',
      'stale',
      'lastScannedAt',
    ];
    const body = sortedRows.map((row) => [
      row.projectId,
      row.projectName,
      row.vpcName,
      row.subnetName,
      row.region,
      row.cidr,
      String(row.totalIps),
      String(row.stale),
      row.lastScannedAt,
    ]);
    const csv = [headers.join(','), ...body.map((line) => line.join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', 'cidr_manager_inventory.csv');
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
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
            <h2 className="text-xl font-bold text-white">CIDR Manager</h2>
            <p className="text-sm text-slate-400 mt-1">
              Consolidated project-level subnet CIDR management for planning and overlap validation.
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
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 text-sm bg-slate-700 text-slate-100 rounded-md hover:bg-slate-600 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            <div className="text-slate-500 uppercase tracking-wide">Project Scope</div>
            <div className="mt-1 text-slate-100 text-sm" data-testid="cidr-scope-value">
              {scopeDisplay}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            <div className="text-slate-500 uppercase tracking-wide">Scan Status</div>
            <div className="mt-1">
              <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${getScanStatusStyle(scanStatus)}`}>
                {scanStatus}
              </span>
            </div>
            <div className="mt-2 text-slate-500 uppercase tracking-wide">Scan ID</div>
            <div className="mt-1 font-mono text-[11px] text-slate-300 break-all">
              {scanId || 'N/A'}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            <div className="text-slate-500 uppercase tracking-wide">Last Scanned At</div>
            <div className="mt-1 text-slate-100 text-sm break-all">
              {lastScannedAt || 'N/A'}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded px-3 py-2">
            <div className="text-slate-500 uppercase tracking-wide">Data Quality</div>
            <div className="mt-1 text-slate-100 text-sm">stale rows: {staleCount}</div>
            <div className="mt-1 text-slate-100 text-sm">scan errors: {scanErrors.length}</div>
          </div>
        </div>

        {hasFreshnessRisk && (
          <div className="mt-3 text-xs text-amber-300 bg-amber-900/20 border border-amber-800 rounded px-3 py-2">
            Inventory is not fully fresh. Review scan status and per-project errors before finalizing CIDR plans.
          </div>
        )}
      </div>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">IP Usage Explorer</h3>
            <p className="text-xs text-slate-400 mt-1">
              IP search and resource sequence analysis has moved into a dedicated page to reduce workflow noise.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToIpUsageExplorer}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-500 transition-colors"
          >
            Open IP Usage Explorer
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        <section className="2xl:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-white mb-3">CIDR Inventory</h3>
          <div className="flex flex-col xl:flex-row xl:items-center gap-2 mb-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by project/vpc/subnet/region/cidr..."
              className="xl:flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
            />
            <select
              value={scopeProjectId}
              onChange={(event) => setScopeProjectId(event.target.value)}
              aria-label="CIDR scope selector"
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 min-w-56"
            >
              <option value="all">All Loaded Projects</option>
              {sortedProjects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.projectId}
                </option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={(event) => {
                const nextSortKey = event.target.value;
                if (isSortKey(nextSortKey)) {
                  handleSort(nextSortKey);
                }
              }}
              aria-label="CIDR sort key"
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 min-w-36"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
              className="px-3 py-2 text-sm bg-slate-700 text-slate-100 rounded-md hover:bg-slate-600 transition-colors"
            >
              Sort: {sortDirection === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('cidr')}>
                      CIDR <span className="text-slate-500">{getSortIndicator('cidr')}</span>
                    </button>
                  </th>
                  <th className="py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('projectId')}>
                      Project <span className="text-slate-500">{getSortIndicator('projectId')}</span>
                    </button>
                  </th>
                  <th className="py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('vpcName')}>
                      VPC <span className="text-slate-500">{getSortIndicator('vpcName')}</span>
                    </button>
                  </th>
                  <th className="py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('subnetName')}>
                      Subnet <span className="text-slate-500">{getSortIndicator('subnetName')}</span>
                    </button>
                  </th>
                  <th className="py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('region')}>
                      Region <span className="text-slate-500">{getSortIndicator('region')}</span>
                    </button>
                  </th>
                  <th className="py-2 text-right">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('totalIps')}>
                      IPs <span className="text-slate-500">{getSortIndicator('totalIps')}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {sortedRows.map((row) => (
                  <tr key={`${row.projectId}-${row.vpcName}-${row.subnetName}-${row.cidr}`} className="hover:bg-slate-700/30">
                    <td className="py-2 font-mono text-emerald-300" data-testid="cidr-cell">{row.cidr}</td>
                    <td className="py-2 text-slate-200">{row.projectId}</td>
                    <td className="py-2 text-slate-300">{row.vpcName}</td>
                    <td className="py-2 text-slate-300">{row.subnetName}</td>
                    <td className="py-2 text-slate-400">{row.region}</td>
                    <td className="py-2 text-right text-slate-400">{row.totalIps.toLocaleString()}</td>
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No subnet CIDR entries found for current scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-lg font-semibold text-white mb-3">Conflict Analyzer</h3>
            <input
              value={inputCidr}
              onChange={(event) => setInputCidr(event.target.value)}
              placeholder="10.20.0.0/24"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
            />
            {inputCidr && !parseCidr(inputCidr) && (
              <p className="text-xs text-red-300 mt-2">Invalid CIDR format.</p>
            )}

            {conflictResult && (
              <div className="mt-3">
                <p className={`text-xs ${conflictResult.hasConflict ? 'text-red-300' : 'text-emerald-300'}`}>
                  {conflictResult.hasConflict
                    ? `Conflict with ${conflictResult.conflicts.length} subnet(s).`
                    : 'No overlap found in current project scope.'}
                </p>
                {conflictResult.hasConflict && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {conflictResult.conflicts.map((row) => (
                      <div
                        key={`${row.projectId}-${row.subnetName}-${row.cidr}`}
                        className="text-xs text-red-200 bg-red-900/20 border border-red-900/40 rounded px-2 py-1"
                      >
                        [{row.projectId}] {row.vpcName}/{row.subnetName} {row.cidr}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-lg font-semibold text-white mb-3">Planning Assistant</h3>
            <label className="text-xs text-slate-400 block mb-1">Target Prefix</label>
            <input
              value={planningPrefix}
              onChange={(event) => setPlanningPrefix(event.target.value)}
              placeholder="24"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
            />
            <div className="mt-3 text-xs">
              {!Number.isInteger(prefixNumber) && (
                <span className="text-red-300">Prefix must be an integer between 0 and 32.</span>
              )}
              {Number.isInteger(prefixNumber) && !suggestion && (
                <span className="text-amber-300">
                  No available RFC1918 block found for /{prefixNumber}. Try a smaller allocation size.
                </span>
              )}
              {suggestion && (
                <div className="text-emerald-300 bg-emerald-900/20 border border-emerald-900/40 rounded px-2 py-2">
                  Suggestion: <span className="font-mono">{suggestion.candidateCidr}</span>
                  <div className="text-slate-400 mt-1">{suggestion.reason}</div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
