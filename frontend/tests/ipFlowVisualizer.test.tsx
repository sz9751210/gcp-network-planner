import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { IpFlowVisualizer } from '../components/IpFlowVisualizer';
import { buildTestProject } from './fixtures';

describe('IpFlowVisualizer', () => {
  it('renders LB summary and shows ordered LB flow chain', () => {
    const project = buildTestProject();
    project.loadBalancers[0].ipAddress = '35.1.1.1';
    project.loadBalancers[0].forwardingRuleName = 'fr-main';
    project.loadBalancers[0].backends = ['backend-a', 'backend-b', 'backend-c', 'backend-d'];
    project.loadBalancers[0].cloudArmorPolicies = ['armor-main', 'armor-secondary'];
    project.loadBalancers[0].securityPolicy = 'armor-main';
    project.loadBalancers[0].backendSecurityPolicies = {
      'backend-a': ['armor-main'],
      'backend-b': ['armor-secondary'],
      'backend-c': ['armor-secondary'],
      'backend-d': [],
    };
    project.armorPolicies = [
      {
        ...project.armorPolicies[0],
        id: 'armor-main',
        name: 'armor-main',
      },
      {
        ...project.armorPolicies[0],
        id: 'armor-secondary',
        name: 'armor-secondary',
      },
    ];

    render(
      <IpFlowVisualizer
        projects={[project]}
        selectedProjectId="all"
        selectedServiceAccountId="sa-1"
        scanStatus="success"
        scanId="scan-1"
        scanErrors={[]}
        lastScannedAt="2026-03-31T00:00:00Z"
        onRescanAllProjects={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('READ ONLY')).toBeInTheDocument();
    expect(screen.getByText(/This view is read-only/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Internal \(10.x.x.x\) or External IP/i), {
      target: { value: '35.1.1.1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Trace IP' }));
    fireEvent.click(screen.getByText('test-lb'));

    const chainCard = screen.getByTestId('lb-flow-chain-card');
    const chainWithin = within(chainCard);
    const hasConsoleLinks = screen
      .getAllByRole('link')
      .some((link) => (link as HTMLAnchorElement).href.includes('console.cloud.google.com'));

    expect(chainWithin.getByText('LB Flow Chain')).toBeInTheDocument();
    expect(chainWithin.getByText('1. Frontend')).toBeInTheDocument();
    expect(chainWithin.getByText('2. Backend Services')).toBeInTheDocument();
    expect(chainWithin.getByText('3. Cloud Armor')).toBeInTheDocument();
    expect(chainWithin.getByText('backends 4')).toBeInTheDocument();
    expect(chainWithin.getByText('policies 2')).toBeInTheDocument();
    expect(chainWithin.getByText('+1 more')).toBeInTheDocument();
    expect(hasConsoleLinks).toBe(true);
    expect(screen.queryByText('allow-ssh')).not.toBeInTheDocument();

    fireEvent.click(chainWithin.getByText('+1 more'));
    expect(chainWithin.getByText('backend-d')).toBeInTheDocument();
  });

  it('shows backend to policy mapping with unattached and unavailable states', () => {
    const project = buildTestProject();
    project.loadBalancers[0].securityPolicy = 'armor-main';
    project.loadBalancers[0].cloudArmorPolicies = ['armor-main', 'missing-policy'];
    project.loadBalancers[0].backends = ['backend-1', 'backend-2'];
    project.loadBalancers[0].backendSecurityPolicies = {
      'backend-1': ['armor-main', 'missing-policy'],
      'backend-2': [],
    };
    project.loadBalancers[0].backendSecurityPolicyUnavailable = {
      'backend-1': false,
      'backend-2': true,
    };
    project.armorPolicies = [
      {
        ...project.armorPolicies[0],
        id: 'armor-main',
        name: 'armor-main',
      },
    ];

    render(
      <IpFlowVisualizer
        projects={[project]}
        selectedProjectId="all"
        selectedServiceAccountId="sa-1"
        scanStatus="success"
        scanId="scan-1"
        scanErrors={[]}
        lastScannedAt="2026-03-31T00:00:00Z"
        onRescanAllProjects={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Internal \(10.x.x.x\) or External IP/i), {
      target: { value: '35.1.1.1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Trace IP' }));
    fireEvent.click(screen.getByText('test-lb'));

    expect(screen.getByText('Cloud Armor (By Backend)')).toBeInTheDocument();
    expect(screen.getAllByText('backend-2').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('missing-policy').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unavailable in inventory/i).length).toBeGreaterThan(0);
  });
});
