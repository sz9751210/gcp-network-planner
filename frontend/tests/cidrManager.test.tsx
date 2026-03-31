import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CidrManager } from '../components/CidrManager';
import { CidrAllocations } from '../components/CidrAllocations';
import { CidrPlanner } from '../components/CidrPlanner';
import { buildTestProject } from './fixtures';

describe('CIDR manager surfaces', () => {
  it('renders inventory/conflict/planning and supports rescan', async () => {
    const onRescan = vi.fn().mockResolvedValue(undefined);
    const onNavigateToIpUsageExplorer = vi.fn();
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
        onNavigateToIpUsageExplorer={onNavigateToIpUsageExplorer}
      />
    );

    expect(screen.getByText('CIDR Manager')).toBeInTheDocument();
    expect(screen.getByText('CIDR Inventory')).toBeInTheDocument();
    expect(screen.getByText('Conflict Analyzer')).toBeInTheDocument();
    expect(screen.getByText('Planning Assistant')).toBeInTheDocument();
    expect(screen.getByText('IP Usage Explorer')).toBeInTheDocument();
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

  it('supports in-page scope selection and cidr sort direction toggle', () => {
    const primaryProject = buildTestProject();
    const templateProject = buildTestProject();
    const onNavigateToIpUsageExplorer = vi.fn();
    const secondaryProject = {
      ...templateProject,
      projectId: 'alpha-project',
      name: 'Alpha Project',
      vpcs: [
        {
          ...templateProject.vpcs[0],
          name: 'alpha-vpc',
          subnets: [
            {
              ...templateProject.vpcs[0].subnets[0],
              name: 'alpha-subnet',
              ipCidrRange: '10.0.2.0/24',
            },
          ],
        },
      ],
    };

    render(
      <CidrManager
        projects={[primaryProject, secondaryProject]}
        selectedProjectId="all"
        selectedServiceAccountId="sa-1"
        scanStatus="success"
        scanId="scan-123"
        scanErrors={[]}
        lastScannedAt="2026-03-31T00:00:00Z"
        onRescanAllProjects={vi.fn().mockResolvedValue(undefined)}
        onNavigateToIpUsageExplorer={onNavigateToIpUsageExplorer}
      />
    );

    expect(screen.getAllByTestId('cidr-cell')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('CIDR scope selector'), {
      target: { value: 'alpha-project' },
    });

    expect(screen.getByTestId('cidr-scope-value')).toHaveTextContent('alpha-project');
    expect(screen.getAllByTestId('cidr-cell')).toHaveLength(1);
    expect(screen.getAllByTestId('cidr-cell')[0]).toHaveTextContent('10.0.2.0/24');

    fireEvent.change(screen.getByLabelText('CIDR scope selector'), {
      target: { value: 'all' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sort: Asc/i }));

    const cidrCells = screen.getAllByTestId('cidr-cell');
    expect(cidrCells[0]).toHaveTextContent('10.0.2.0/24');
  });

  it('navigates to dedicated ip usage explorer page from entry card', () => {
    const onNavigateToIpUsageExplorer = vi.fn();
    const project = buildTestProject();

    render(
      <CidrManager
        projects={[project]}
        selectedProjectId="all"
        selectedServiceAccountId="sa-1"
        scanStatus="success"
        scanId="scan-123"
        scanErrors={[]}
        lastScannedAt="2026-03-31T00:00:00Z"
        onRescanAllProjects={vi.fn().mockResolvedValue(undefined)}
        onNavigateToIpUsageExplorer={onNavigateToIpUsageExplorer}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open IP Usage Explorer' }));
    expect(onNavigateToIpUsageExplorer).toHaveBeenCalledTimes(1);
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
