import { buildTestProject } from './fixtures';
import {
  buildIpCatalog,
  buildIpUsageResult,
  inferIpAddressKind,
  validateIpv4,
} from '../utils/ipUsage';

describe('ipUsage utils', () => {
  it('validates ipv4 input strictly', () => {
    expect(validateIpv4('10.0.0.10')).toBe(true);
    expect(validateIpv4('255.255.255.255')).toBe(true);
    expect(validateIpv4('256.0.0.1')).toBe(false);
    expect(validateIpv4('10.0.0')).toBe(false);
    expect(validateIpv4('10.0.0.01')).toBe(false);
    expect(validateIpv4('10.0.0.1/24')).toBe(false);
    expect(validateIpv4('abc')).toBe(false);
  });

  it('builds core usage matches for network, endpoint and policy', () => {
    const project = buildTestProject();
    const result = buildIpUsageResult([project], 'all', '10.0.0.10');

    expect(result.totals.totalMatches).toBe(4);
    expect(result.totals.networkCount).toBe(1);
    expect(result.totals.endpointCount).toBe(1);
    expect(result.totals.policyCount).toBe(2);

    expect(result.itemsByStage.NETWORK[0].resourceType).toBe('SUBNET');
    expect(result.itemsByStage.ENDPOINT[0].resourceType).toBe('INSTANCE_INTERNAL_IP');
    expect(result.itemsByStage.ENDPOINT[0].metadata.ipKind).toBe('INTERNAL');
    expect(result.itemsByStage.POLICY.map((item) => item.resourceType)).toEqual([
      'FIREWALL',
      'CLOUD_ARMOR',
    ]);
  });

  it('supports lb_attached_only cloud armor mode', () => {
    const project = buildTestProject();
    project.loadBalancers[0].securityPolicy = 'armor-policy';
    project.loadBalancers[0].cloudArmorPolicies = ['armor-policy'];
    project.loadBalancers[0].backendSecurityPolicies = {
      'backend-1': ['armor-policy'],
    };
    project.armorPolicies.push({
      ...project.armorPolicies[0],
      id: 'armor-2',
      name: 'unattached-policy',
    });

    const defaultResult = buildIpUsageResult([project], 'all', '10.0.0.10');
    const attachedOnlyResult = buildIpUsageResult([project], 'all', '10.0.0.10', {
      cloudArmorMode: 'lb_attached_only',
    });

    const defaultArmor = defaultResult.itemsByStage.POLICY.filter((item) => item.resourceType === 'CLOUD_ARMOR');
    const attachedArmor = attachedOnlyResult.itemsByStage.POLICY.filter((item) => item.resourceType === 'CLOUD_ARMOR');

    expect(defaultArmor).toHaveLength(2);
    expect(attachedArmor).toHaveLength(1);
    expect(attachedArmor[0].metadata.policyName).toBe('armor-policy');
  });

  it('supports hiding firewall matches from policy stage', () => {
    const project = buildTestProject();
    const result = buildIpUsageResult([project], 'all', '10.0.0.10', {
      includeFirewallRules: false,
    });

    expect(result.itemsByStage.POLICY.some((item) => item.resourceType === 'FIREWALL')).toBe(false);
    expect(result.itemsByStage.POLICY.some((item) => item.resourceType === 'CLOUD_ARMOR')).toBe(true);
  });

  it('adds LB security policy references without requiring srcIpRanges match', () => {
    const project = buildTestProject();
    project.loadBalancers[0].securityPolicy = 'armor-policy';
    project.loadBalancers[0].cloudArmorPolicies = ['armor-policy'];
    project.loadBalancers[0].backendSecurityPolicies = {
      'backend-1': ['armor-policy'],
    };

    const result = buildIpUsageResult([project], 'all', '35.1.1.1', {
      cloudArmorMode: 'lb_attached_only',
      includeFirewallRules: false,
      includeLbPolicyReferences: true,
    });

    const attachedPolicyRef = result.itemsByStage.POLICY.find(
      (item) => item.resourceType === 'CLOUD_ARMOR' && item.matchedField === 'securityPolicy'
    );
    expect(attachedPolicyRef?.matchedValue).toBe('armor-policy');
  });

  it('orders network by project and cidr specificity, endpoint and policy by fixed rank', () => {
    const project = buildTestProject();
    project.vpcs[0].subnets.push({
      name: 'broad-subnet',
      region: 'us-central1',
      ipCidrRange: '10.0.0.0/16',
      gatewayIp: '10.0.0.1',
      privateGoogleAccess: true,
      selfLink: 'projects/test-project/regions/us-central1/subnetworks/broad-subnet',
    });
    project.instances[0].externalIp = '10.0.0.10';
    project.loadBalancers[0].ipAddress = '10.0.0.10';
    project.vpcs[0].routes.push({
      id: 'route-1',
      name: 'private-route',
      network: project.vpcs[0].name,
      destRange: '10.0.0.0/8',
      nextHop: 'Default Internet Gateway',
      priority: 200,
    });
    project.vpcs[0].routes.push({
      id: 'route-2',
      name: 'specific-route',
      network: project.vpcs[0].name,
      destRange: '10.0.0.0/24',
      nextHop: 'VPN Tunnel',
      priority: 100,
    });

    const otherProject = {
      ...buildTestProject(),
      projectId: 'alpha-project',
      name: 'Alpha Project',
      vpcs: [
        {
          ...buildTestProject().vpcs[0],
          name: 'alpha-vpc',
          subnets: [
            {
              ...buildTestProject().vpcs[0].subnets[0],
              name: 'alpha-subnet',
              ipCidrRange: '10.0.0.0/24',
            },
          ],
          routes: [],
        },
      ],
      instances: [],
      loadBalancers: [],
      firewallRules: [],
      armorPolicies: [],
    };

    const result = buildIpUsageResult([project, otherProject], 'all', '10.0.0.10');

    expect(result.itemsByStage.NETWORK.map((item) => item.projectId)).toEqual([
      'alpha-project',
      'test-project',
      'test-project',
    ]);
    expect(result.itemsByStage.NETWORK[1].matchedValue).toBe('10.0.0.0/24');
    expect(result.itemsByStage.NETWORK[2].matchedValue).toBe('10.0.0.0/16');

    expect(result.itemsByStage.ENDPOINT.map((item) => item.resourceType)).toEqual([
      'INSTANCE_INTERNAL_IP',
      'INSTANCE_EXTERNAL_IP',
      'LOAD_BALANCER',
    ]);

    expect(result.itemsByStage.POLICY.map((item) => item.resourceType)).toEqual([
      'FIREWALL',
      'ROUTE',
      'ROUTE',
      'CLOUD_ARMOR',
    ]);
    expect(result.itemsByStage.POLICY[1].resourceName).toBe('specific-route');
    expect(result.itemsByStage.POLICY[2].resourceName).toBe('private-route');
  });

  it('applies scope filtering', () => {
    const project = buildTestProject();
    project.firewallRules = [];
    project.armorPolicies = [];
    const another = {
      ...buildTestProject(),
      projectId: 'another-project',
      name: 'Another Project',
      instances: [
        {
          ...buildTestProject().instances[0],
          id: 'inst-2',
          name: 'inst-2',
          internalIp: '10.2.0.10',
          externalIp: '34.2.2.2',
        },
      ],
    };

    const scoped = buildIpUsageResult([project, another], project.projectId, '10.2.0.10');
    const all = buildIpUsageResult([project, another], 'all', '10.2.0.10');

    expect(scoped.totals.totalMatches).toBe(0);
    expect(all.totals.totalMatches).toBeGreaterThan(0);
  });

  it('builds internal/external ip catalog with aggregation and lb fallback classification', () => {
    const project = buildTestProject();
    project.instances.push({
      ...buildTestProject().instances[0],
      id: 'inst-dup',
      name: 'inst-dup',
      internalIp: project.instances[0].internalIp,
      externalIp: project.instances[0].externalIp,
    });
    project.loadBalancers.push({
      ...buildTestProject().loadBalancers[0],
      id: 'lb-internal',
      name: 'lb-internal',
      type: 'INTERNAL_TCP',
      ipAddress: '10.5.0.5',
    });
    project.loadBalancers.push({
      ...buildTestProject().loadBalancers[0],
      id: 'lb-fallback-private',
      name: 'lb-fallback-private',
      type: 'INTERNAL_HTTP',
      ipAddress: '192.168.1.10',
    });
    project.loadBalancers.push({
      ...buildTestProject().loadBalancers[0],
      id: 'lb-public',
      name: 'lb-public',
      type: 'EXTERNAL_TCP',
      ipAddress: '34.120.50.10',
    });

    const catalog = buildIpCatalog([project], 'all');

    const internalPrimary = catalog.INTERNAL.find((item) => item.ip === '10.0.0.10');
    expect(internalPrimary?.usageCount).toBe(2);
    expect(internalPrimary?.resources).toContain('Instance Internal IP');
    expect(catalog.INTERNAL.some((item) => item.ip === '10.5.0.5')).toBe(true);
    expect(catalog.INTERNAL.some((item) => item.ip === '192.168.1.10')).toBe(true);

    const externalPrimary = catalog.EXTERNAL.find((item) => item.ip === '34.1.1.1');
    expect(externalPrimary?.usageCount).toBe(2);
    expect(catalog.EXTERNAL.some((item) => item.ip === '35.1.1.1')).toBe(true);
    expect(catalog.EXTERNAL.some((item) => item.ip === '34.120.50.10')).toBe(true);
  });

  it('infers ip kind by rfc1918 ranges', () => {
    expect(inferIpAddressKind('10.0.0.1')).toBe('INTERNAL');
    expect(inferIpAddressKind('172.16.1.1')).toBe('INTERNAL');
    expect(inferIpAddressKind('192.168.10.10')).toBe('INTERNAL');
    expect(inferIpAddressKind('8.8.8.8')).toBe('EXTERNAL');
    expect(inferIpAddressKind('34.120.50.10')).toBe('EXTERNAL');
  });
});
