import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IpUsageExplorer } from '../components/IpUsageExplorer';
import { buildTestProject } from './fixtures';

describe('IpUsageExplorer', () => {
  it('defaults to external tab and supports quick search from external list', () => {
    const project = buildTestProject();
    project.loadBalancers[0].ipAddress = '34.120.50.10';

    render(
      <IpUsageExplorer
        projects={[project]}
        selectedProjectId="all"
        selectedServiceAccountId="sa-1"
        scanStatus="success"
        scanId="scan-123"
        scanErrors={[]}
        lastScannedAt="2026-03-31T00:00:00Z"
        onRescanAllProjects={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('34.120.50.10')).toBeInTheDocument();

    fireEvent.click(screen.getByText('34.120.50.10'));

    expect(screen.getByDisplayValue('34.120.50.10')).toBeInTheDocument();
    expect(screen.getByText('Endpoint Ownership')).toBeInTheDocument();
    expect(screen.getByText('ipAddress: 34.120.50.10')).toBeInTheDocument();
  });

  it('supports scope mode switching and renders timeline with freshness warning', () => {
    const project = buildTestProject();
    project.firewallRules = [];
    project.armorPolicies = [];
    const secondProject = {
      ...buildTestProject(),
      projectId: 'alpha-project',
      name: 'Alpha Project',
      instances: [
        {
          ...buildTestProject().instances[0],
          id: 'inst-2',
          name: 'alpha-instance',
          internalIp: '10.2.0.10',
          externalIp: '34.2.2.2',
        },
      ],
      firewallRules: [],
      loadBalancers: [],
      armorPolicies: [],
    };

    render(
      <IpUsageExplorer
        projects={[project, secondProject]}
        selectedProjectId={project.projectId}
        selectedServiceAccountId="sa-1"
        scanStatus="partial"
        scanId="scan-123"
        scanErrors={[{ projectId: project.projectId, error: 'permission denied' }]}
        lastScannedAt="2026-03-31T00:00:00Z"
        onRescanAllProjects={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.change(screen.getByLabelText('IP usage search input'), {
      target: { value: '10.2.0.10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      screen.getByText((content) => content.includes('No resources found using IP'))
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('IP usage scope mode'), {
      target: { value: 'all' },
    });

    expect(screen.getByText('Network Containment')).toBeInTheDocument();
    expect(screen.getByText('Endpoint Ownership')).toBeInTheDocument();
    expect(screen.getByText('Policy References')).toBeInTheDocument();
    expect(screen.getByText('alpha-instance')).toBeInTheDocument();
    expect(screen.getByText(/total matches:/i)).toBeInTheDocument();
    expect(screen.getByText(/results may be incomplete/i)).toBeInTheDocument();
  });

  it('shows validation and non-blocking tab mismatch warning', () => {
    const project = buildTestProject();

    render(
      <IpUsageExplorer
        projects={[project]}
        selectedProjectId="all"
        selectedServiceAccountId="sa-1"
        scanStatus="success"
        scanId="scan-123"
        scanErrors={[]}
        lastScannedAt="2026-03-31T00:00:00Z"
        onRescanAllProjects={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.change(screen.getByLabelText('IP usage search input'), {
      target: { value: '10.2.0.999' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByText(/Please enter a valid IPv4 address/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('IP usage search input'), {
      target: { value: '34.1.1.1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(screen.getByRole('button', { name: /Internal IPs/i }));
    expect(screen.getByText(/appears to be external/i)).toBeInTheDocument();
  });
});
