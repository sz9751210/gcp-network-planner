import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CidrManager } from '../components/CidrManager';
import { CidrAllocations } from '../components/CidrAllocations';
import { CidrPlanner } from '../components/CidrPlanner';
import { buildTestProject } from './fixtures';

describe('CIDR manager surfaces', () => {
  it('renders inventory/conflict/planning and supports rescan', async () => {
    const onRescan = vi.fn().mockResolvedValue(undefined);
    const project = { ...buildTestProject(), stale: true };

    render(
      <CidrManager
        projects={[project]}
        selectedProjectId="all"
        selectedServiceAccountId="sa-1"
        scanStatus="partial"
        scanId="scan-123"
        scanErrors={[{ projectId: 'test-project', error: 'permission denied' }]}
        lastScannedAt="2026-03-31T00:00:00Z"
        onRescanAllProjects={onRescan}
      />
    );

    expect(screen.getByText('CIDR Manager')).toBeInTheDocument();
    expect(screen.getByText('CIDR Inventory')).toBeInTheDocument();
    expect(screen.getByText('Conflict Analyzer')).toBeInTheDocument();
    expect(screen.getByText('Planning Assistant')).toBeInTheDocument();
    expect(screen.getByText(/Inventory is not fully fresh/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('10.20.0.0/24'), {
      target: { value: '10.0.0.0/24' },
    });
    expect(screen.getByText(/Conflict with 1 subnet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('24'), {
      target: { value: '24' },
    });
    expect(screen.getByText(/10.0.1.0\/24/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Rescan All Projects'));
    expect(onRescan).toHaveBeenCalledTimes(1);
  });

  it('legacy wrappers redirect to cidr manager', () => {
    const onNavigate = vi.fn();
    const project = buildTestProject();

    render(
      <div>
        <CidrPlanner projects={[project]} onNavigateToManager={onNavigate} />
        <CidrAllocations
          projects={[project]}
          selectedProjectId="all"
          onNavigateToManager={onNavigate}
        />
      </div>
    );

    fireEvent.click(screen.getAllByText('Open CIDR Manager')[0]);
    fireEvent.click(screen.getAllByText('Open CIDR Manager')[1]);
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });
});
