import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Operations } from '../components/Operations';
import {
  fetchAuditEvents,
  fetchScan,
  fetchScans,
} from '../services/api';

vi.mock('../services/api', () => ({
  fetchScans: vi.fn(),
  fetchAuditEvents: vi.fn(),
  fetchScan: vi.fn(),
}));

describe('Operations', () => {
  it('renders scan/audit lists and links audit event to scan details', async () => {
    vi.mocked(fetchScans).mockResolvedValue({
      items: [
        {
          scanId: 'scan-1',
          serviceAccountId: 'sa-1',
          actor: 'proxy-user',
          status: 'success',
          createdAt: '2026-03-31T01:00:00Z',
          completedAt: '2026-03-31T01:01:00Z',
          totalProjects: 2,
          completedProjects: 2,
          errorCount: 1,
        },
      ],
      nextCursor: undefined,
    });

    vi.mocked(fetchAuditEvents).mockResolvedValue({
      items: [
        {
          id: 'event-1',
          timestamp: '2026-03-31T01:02:00Z',
          actor: 'proxy-user',
          action: 'scan.finish',
          targetType: 'scan',
          targetId: 'scan-1',
          result: 'success',
          metadata: { scanId: 'scan-1', durationMs: 1000 },
        },
      ],
      nextCursor: undefined,
    });

    vi.mocked(fetchScan).mockResolvedValue({
      scanId: 'scan-1',
      serviceAccountId: 'sa-1',
      scope: 'project',
      status: 'success',
      createdAt: '2026-03-31T01:00:00Z',
      startedAt: '2026-03-31T01:00:05Z',
      completedAt: '2026-03-31T01:01:00Z',
      totalProjects: 2,
      completedProjects: 2,
      projects: [],
      errors: [{ projectId: 'proj-a', error: 'permission denied' }],
    });

    render(<Operations selectedServiceAccountId="sa-1" />);

    await waitFor(() => {
      expect(fetchScans).toHaveBeenCalled();
      expect(fetchAuditEvents).toHaveBeenCalled();
      expect(fetchScan).toHaveBeenCalledWith('scan-1');
    });

    expect(screen.getByText('Scan History')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('scan.finish')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Open scan scan-1'));

    await waitFor(() => {
      expect(fetchScan).toHaveBeenCalledWith('scan-1');
    });
    expect(screen.getByText(/\[proj-a\] permission denied/i)).toBeInTheDocument();
  });
});
