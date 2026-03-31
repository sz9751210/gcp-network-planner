import React, { useEffect, useMemo, useState } from 'react';
import {
  AuditEventRecord,
  fetchAuditEvents,
  fetchScan,
  fetchScans,
  ScanListItem,
  ScanRecord,
} from '../services/api';

interface Props {
  selectedServiceAccountId: string;
}

const PAGE_LIMIT = 20;

function toRFC3339(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function toInputDateTime(value: string): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function statusBadgeClass(status: string): string {
  if (status === 'success') {
    return 'text-emerald-300 border-emerald-700 bg-emerald-900/20';
  }
  if (status === 'partial') {
    return 'text-amber-300 border-amber-700 bg-amber-900/20';
  }
  if (status === 'failed') {
    return 'text-red-300 border-red-700 bg-red-900/20';
  }
  return 'text-blue-300 border-blue-700 bg-blue-900/20';
}

export const Operations: React.FC<Props> = ({ selectedServiceAccountId }) => {
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [scanCursor, setScanCursor] = useState<string>('');
  const [scanStatusFilter, setScanStatusFilter] = useState<string>('');
  const [scanActorFilter, setScanActorFilter] = useState<string>('');
  const [scanFromFilter, setScanFromFilter] = useState<string>('');
  const [scanToFilter, setScanToFilter] = useState<string>('');
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string>('');

  const [selectedScanId, setSelectedScanId] = useState<string>('');
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const [selectedScanLoading, setSelectedScanLoading] = useState<boolean>(false);

  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [auditCursor, setAuditCursor] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');
  const [auditResultFilter, setAuditResultFilter] = useState<string>('');
  const [auditActorFilter, setAuditActorFilter] = useState<string>('');
  const [auditTargetTypeFilter, setAuditTargetTypeFilter] = useState<string>('');
  const [auditTargetIdFilter, setAuditTargetIdFilter] = useState<string>('');
  const [auditScanIdFilter, setAuditScanIdFilter] = useState<string>('');
  const [auditFromFilter, setAuditFromFilter] = useState<string>('');
  const [auditToFilter, setAuditToFilter] = useState<string>('');
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string>('');

  const [copied, setCopied] = useState<string>('');

  const visibleScans = useMemo(() => {
    if (!scanActorFilter.trim()) {
      return scans;
    }
    const actorNeedle = scanActorFilter.trim().toLowerCase();
    return scans.filter((scan) => scan.actor.toLowerCase().includes(actorNeedle));
  }, [scans, scanActorFilter]);

  const copyValue = async (value: string) => {
    if (!value) {
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      }
      setCopied(value);
      setTimeout(() => setCopied(''), 1200);
    } catch (_error) {
      setCopied('');
    }
  };

  const loadScans = async (reset: boolean) => {
    setScanLoading(true);
    setScanError('');
    try {
      const response = await fetchScans({
        serviceAccountId: selectedServiceAccountId || undefined,
        status: scanStatusFilter ? (scanStatusFilter as 'queued' | 'running' | 'partial' | 'success' | 'failed') : undefined,
        from: toRFC3339(scanFromFilter),
        to: toRFC3339(scanToFilter),
        limit: PAGE_LIMIT,
        cursor: reset ? undefined : scanCursor || undefined,
      });

      setScans((prev) => (reset ? response.items : [...prev, ...response.items]));
      setScanCursor(response.nextCursor || '');

      if (reset) {
        const firstScanId = response.items[0]?.scanId || '';
        setSelectedScanId(firstScanId);
        if (firstScanId) {
          setSelectedScanLoading(true);
          const detail = await fetchScan(firstScanId);
          setSelectedScan(detail);
          setSelectedScanLoading(false);
        } else {
          setSelectedScan(null);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load scans';
      setScanError(message);
    } finally {
      setScanLoading(false);
      setSelectedScanLoading(false);
    }
  };

  const loadAuditEvents = async (reset: boolean) => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const response = await fetchAuditEvents({
        from: toRFC3339(auditFromFilter),
        to: toRFC3339(auditToFilter),
        action: auditActionFilter || undefined,
        result: auditResultFilter || undefined,
        actor: auditActorFilter || undefined,
        targetType: auditTargetTypeFilter || undefined,
        targetId: auditTargetIdFilter || undefined,
        scanId: auditScanIdFilter || undefined,
        limit: PAGE_LIMIT,
        cursor: reset ? undefined : auditCursor || undefined,
      });
      setAuditEvents((prev) => (reset ? response.items : [...prev, ...response.items]));
      setAuditCursor(response.nextCursor || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load audit events';
      setAuditError(message);
    } finally {
      setAuditLoading(false);
    }
  };

  const loadScanDetails = async (scanId: string) => {
    if (!scanId) {
      return;
    }
    setSelectedScanId(scanId);
    setSelectedScanLoading(true);
    try {
      const detail = await fetchScan(scanId);
      setSelectedScan(detail);
    } catch (_error) {
      setSelectedScan(null);
    } finally {
      setSelectedScanLoading(false);
    }
  };

  useEffect(() => {
    void loadScans(true);
    void loadAuditEvents(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceAccountId]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-xl font-bold text-white">Operations</h2>
        <p className="text-sm text-slate-400 mt-1">
          Scan History + Audit Trail for traceable project-level operations.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Scan History</h3>
            <button
              onClick={() => void loadScans(true)}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <select
              value={scanStatusFilter}
              onChange={(event) => setScanStatusFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="">All status</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="partial">partial</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
            </select>
            <input
              type="text"
              value={scanActorFilter}
              placeholder="Actor contains..."
              onChange={(event) => setScanActorFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="datetime-local"
              value={scanFromFilter}
              onChange={(event) => setScanFromFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="datetime-local"
              value={scanToFilter}
              onChange={(event) => setScanToFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
          </div>

          {scanError && <div className="text-sm text-red-300 mb-3">{scanError}</div>}
          {scanLoading && <div className="text-sm text-slate-400 mb-3">Loading scans...</div>}

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {visibleScans.map((scan) => (
              <button
                key={scan.scanId}
                onClick={() => void loadScanDetails(scan.scanId)}
                className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                  selectedScanId === scan.scanId
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded border ${statusBadgeClass(scan.status)}`}>
                    {scan.status}
                  </span>
                  <span className="text-xs text-slate-400">{toInputDateTime(scan.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm text-slate-200 font-mono">{scan.scanId}</div>
                <div className="mt-1 text-xs text-slate-400">
                  actor={scan.actor} errors={scan.errorCount} progress={scan.completedProjects}/{scan.totalProjects}
                </div>
              </button>
            ))}
            {visibleScans.length === 0 && !scanLoading && (
              <div className="text-sm text-slate-500">No scan records found.</div>
            )}
          </div>

          {scanCursor && (
            <button
              onClick={() => void loadScans(false)}
              className="mt-3 w-full px-3 py-2 text-sm bg-slate-700 text-slate-100 rounded-md hover:bg-slate-600 transition-colors"
            >
              Load More
            </button>
          )}

          <div className="mt-4 border-t border-slate-700 pt-4">
            <h4 className="text-sm font-semibold text-white mb-2">Scan Detail</h4>
            {selectedScanLoading && <div className="text-sm text-slate-400">Loading scan detail...</div>}
            {!selectedScanLoading && !selectedScan && (
              <div className="text-sm text-slate-500">Select a scan to inspect per-project errors.</div>
            )}
            {!selectedScanLoading && selectedScan && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">scanId</span>
                  <button
                    onClick={() => void copyValue(selectedScan.scanId)}
                    className="font-mono text-slate-200 hover:text-white"
                  >
                    {selectedScan.scanId}
                  </button>
                  {copied === selectedScan.scanId && <span className="text-xs text-emerald-300">copied</span>}
                </div>
                <div className="text-slate-400">
                  status={selectedScan.status} completed={selectedScan.completedProjects}/{selectedScan.totalProjects}
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedScan.errors.length === 0 && <div className="text-slate-500">No per-project errors.</div>}
                  {selectedScan.errors.map((scanError) => (
                    <div key={`${scanError.projectId}-${scanError.error}`} className="text-xs text-red-300 bg-red-900/20 border border-red-900/30 rounded px-2 py-1">
                      [{scanError.projectId || 'global'}] {scanError.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Audit Trail</h3>
            <button
              onClick={() => void loadAuditEvents(true)}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <input
              type="text"
              value={auditActionFilter}
              placeholder="action..."
              onChange={(event) => setAuditActionFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="text"
              value={auditResultFilter}
              placeholder="result..."
              onChange={(event) => setAuditResultFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="text"
              value={auditActorFilter}
              placeholder="actor..."
              onChange={(event) => setAuditActorFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="text"
              value={auditScanIdFilter}
              placeholder="scanId..."
              onChange={(event) => setAuditScanIdFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="text"
              value={auditTargetTypeFilter}
              placeholder="targetType..."
              onChange={(event) => setAuditTargetTypeFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="text"
              value={auditTargetIdFilter}
              placeholder="targetId..."
              onChange={(event) => setAuditTargetIdFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="datetime-local"
              value={auditFromFilter}
              onChange={(event) => setAuditFromFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="datetime-local"
              value={auditToFilter}
              onChange={(event) => setAuditToFilter(event.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200"
            />
          </div>

          {auditError && <div className="text-sm text-red-300 mb-3">{auditError}</div>}
          {auditLoading && <div className="text-sm text-slate-400 mb-3">Loading audit events...</div>}

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {auditEvents.map((event) => {
              const linkedScanId =
                event.targetType === 'scan'
                  ? event.targetId
                  : typeof event.metadata.scanId === 'string'
                  ? event.metadata.scanId
                  : '';

              return (
                <div key={event.id} className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{toInputDateTime(event.timestamp)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${event.result === 'failed' ? 'text-red-300 border-red-700 bg-red-900/20' : 'text-emerald-300 border-emerald-700 bg-emerald-900/20'}`}>
                      {event.result}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-200">
                    <span className="font-mono">{event.action}</span> by <span className="font-mono">{event.actor}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    target={event.targetType}:{' '}
                    <button onClick={() => void copyValue(event.targetId)} className="font-mono hover:text-slate-200">
                      {event.targetId || '-'}
                    </button>
                    {copied === event.targetId && <span className="ml-2 text-emerald-300">copied</span>}
                  </div>
                  {event.errorSummary && (
                    <div className="mt-1 text-xs text-red-300">{event.errorSummary}</div>
                  )}
                  {linkedScanId && (
                    <button
                      onClick={() => void loadScanDetails(linkedScanId)}
                      className="mt-2 text-xs text-blue-300 hover:text-blue-200 underline"
                    >
                      Open scan {linkedScanId}
                    </button>
                  )}
                </div>
              );
            })}
            {auditEvents.length === 0 && !auditLoading && (
              <div className="text-sm text-slate-500">No audit events found.</div>
            )}
          </div>

          {auditCursor && (
            <button
              onClick={() => void loadAuditEvents(false)}
              className="mt-3 w-full px-3 py-2 text-sm bg-slate-700 text-slate-100 rounded-md hover:bg-slate-600 transition-colors"
            >
              Load More
            </button>
          )}
        </section>
      </div>
    </div>
  );
};
