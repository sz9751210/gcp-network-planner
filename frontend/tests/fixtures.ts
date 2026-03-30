import { GcpProject } from '../types';

export const buildTestProject = (): GcpProject => ({
	projectId: 'test-project',
	name: 'Test Project',
	number: '123456789',
	lastScannedAt: '2026-03-31T00:00:00Z',
	stale: false,
	vpcs: [
		{
			name: 'test-vpc',
			id: 'vpc-1',
			isSharedVpcHost: false,
			subnets: [
				{
					name: 'test-subnet',
					region: 'us-central1',
					ipCidrRange: '10.0.0.0/24',
					gatewayIp: '10.0.0.1',
					privateGoogleAccess: true,
					selfLink: 'projects/test-project/regions/us-central1/subnetworks/test-subnet',
				},
			],
			peerings: [],
			routes: [],
		},
	],
	instances: [
		{
			id: 'inst-1',
			name: 'test-instance',
			zone: 'us-central1-a',
			machineType: 'e2-medium',
			status: 'RUNNING',
			internalIp: '10.0.0.10',
			externalIp: '34.1.1.1',
			network: 'test-vpc',
			subnetwork: 'test-subnet',
			tags: ['web'],
			labels: { env: 'test' },
		},
	],
	firewallRules: [
		{
			id: 'fw-1',
			name: 'allow-ssh',
			network: 'test-vpc',
			direction: 'INGRESS',
			priority: 1000,
			action: 'ALLOW',
			sourceRanges: ['0.0.0.0/0'],
			allowed: [{ IPProtocol: 'tcp', ports: ['22'] }],
			denied: [],
			disabled: false,
		},
	],
	loadBalancers: [
		{
			id: 'lb-1',
			name: 'test-lb',
			type: 'EXTERNAL_HTTPS',
			ipAddress: '35.1.1.1',
			protocol: 'HTTPS',
			portRange: '443',
			region: 'global',
			backends: ['backend-1'],
			securityPolicy: 'armor-1',
			forwardingRuleName: 'fr-1',
		},
	],
	armorPolicies: [
		{
			id: 'armor-1',
			name: 'armor-policy',
			type: 'CLOUD_ARMOR',
			rulesCount: 1,
			adaptiveProtection: true,
			rules: [
				{
					priority: 1000,
					action: 'allow',
					preview: false,
					match: 'IP Range',
					srcIpRanges: ['10.0.0.0/8'],
				},
			],
		},
	],
	iamPolicy: [
		{
			role: 'roles/viewer',
			members: ['user:test@example.com'],
		},
	],
	gkeClusters: [
		{
			id: 'gke-1',
			name: 'test-cluster',
			location: 'us-central1',
			network: 'test-vpc',
			subnetwork: 'test-subnet',
			status: 'RUNNING',
			clusterIpv4Cidr: '10.4.0.0/14',
			servicesIpv4Cidr: '10.8.0.0/20',
			privateCluster: true,
			masterAuthorizedNetworks: ['10.0.0.0/8'],
			nodePools: [
				{
					name: 'pool-1',
					nodeCount: 1,
					machineType: 'e2-standard-4',
					version: '1.29',
				},
			],
			services: [
				{
					name: 'svc-1',
					namespace: 'default',
					type: 'ClusterIP',
					clusterIp: '10.8.0.5',
					ports: '80/TCP',
				},
			],
			ingresses: [
				{
					name: 'ing-1',
					namespace: 'default',
					loadBalancerIp: '35.2.2.2',
					backends: ['svc-1:80'],
				},
			],
		},
	],
});
