import { NetworksClient, SubnetworksClient, FirewallsClient, InstancesClient } from '@google-cloud/compute';
import { ProjectsClient } from '@google-cloud/resource-manager';
import { GoogleAuth } from 'google-auth-library';
import credentialService from './credentialService';

export class GcpDataService {
  async getGoogleAuth(serviceAccountId: string) {
    return await credentialService.getAuthClient(serviceAccountId);
  }

  async fetchProjects(serviceAccountId: string) {
    const auth = await this.getGoogleAuth(serviceAccountId);
    const client = new ProjectsClient({ auth });

    const [projects] = await client.searchProjects({
      query: 'state:ACTIVE',
    });

    return projects
      .filter((project) => project.projectId)
      .map((project) => ({
        projectId: project.projectId || '',
        name: project.displayName || '',
        number: project.name || '',
      }));
  }

  async fetchVpcs(serviceAccountId: string, projectId: string) {
    const auth = await this.getGoogleAuth(serviceAccountId);
    const networksClient = new NetworksClient({ auth });

    const [networks] = await networksClient.list({ project: projectId });

    return networks.map((network) => ({
      name: network.name,
      id: network.id,
      isSharedVpcHost: false,
      subnets: [] as any[],
    }));
  }

  async fetchSubnets(serviceAccountId: string, projectId: string, vpcSelfLink: string) {
    const auth = await this.getGoogleAuth(serviceAccountId);
    const subnetsClient = new SubnetworksClient({ auth });

    const aggList = await subnetsClient.aggregatedListAsync({
      project: projectId,
    });

    const subnets: any[] = [];

    for (const [region, list] of Object.entries(aggList)) {
      if (!list.items || !list.items.subnetworks) continue;

      for (const subnet of list.items.subnetworks) {
        if (subnet.network === vpcSelfLink) {
          subnets.push({
            name: subnet.name,
            region: region.replace('regions/', ''),
            ipCidrRange: subnet.ipCidrRange,
            gatewayIp: subnet.gatewayAddress,
            privateGoogleAccess: subnet.privateIpGoogleAccess || false,
            selfLink: subnet.selfLink,
          });
        }
      }
    }

    return subnets;
  }

  async fetchFirewallRules(serviceAccountId: string, projectId: string) {
    const auth = await this.getGoogleAuth(serviceAccountId);
    const firewallsClient = new FirewallsClient({ auth });

    const [firewalls] = await firewallsClient.list({ project: projectId });

    return (firewalls || []).map((firewall: any) => ({
      id: firewall.id,
      name: firewall.name,
      network: this.extractNetworkName(firewall.network),
      direction: firewall.direction,
      priority: firewall.priority,
      action: firewall.allowed ? 'ALLOW' : 'DENY',
      sourceRanges: JSON.stringify(firewall.sourceRanges || []),
      sourceTags: JSON.stringify(firewall.sourceTags || []),
      targetTags: JSON.stringify(firewall.targetTags || []),
      allowed: JSON.stringify(firewall.allowed || []),
      denied: JSON.stringify(firewall.denied || []),
      disabled: firewall.disabled || false,
    }));
  }

  async fetchInstances(serviceAccountId: string, projectId: string) {
    const auth = await this.getGoogleAuth(serviceAccountId);
    const instancesClient = new InstancesClient({ auth });

    const instanceLists = await instancesClient.aggregatedListAsync({
      project: projectId,
      returnPartialSuccess: false,
    });

    const instances: any[] = [];

    for (const [zone, list] of Object.entries(instanceLists)) {
      if (!list.items || !list.items.instances) continue;

      for (const instance of list.items.instances) {
        const networkInterface = instance.networkInterfaces?.[0];

        instances.push({
          id: instance.id,
          name: instance.name,
          zone: zone.replace('zones/', ''),
          machineType: instance.machineType?.split('/').pop(),
          status: instance.status,
          internalIp: networkInterface?.networkIP || '',
          externalIp: networkInterface?.accessConfigs?.[0]?.natIP || '',
          network: this.extractNetworkName(networkInterface?.network),
          subnetwork: networkInterface?.subnetwork?.split('/').pop() || '',
          tags: JSON.stringify(instance.tags?.items || []),
          labels: JSON.stringify(instance.labels || {}),
        });
      }
    }

    return instances;
  }

  async fetchAllProjectData(serviceAccountId: string) {
    const projects = await this.fetchProjects(serviceAccountId);

    const projectsWithDetails = [] as any[];

    for (const project of projects) {
      try {
        const vpcs = await this.fetchVpcs(serviceAccountId, project.projectId);
        const firewallRules = await this.fetchFirewallRules(serviceAccountId, project.projectId);
        const instances = await this.fetchInstances(serviceAccountId, project.projectId);

        for (const vpc of vpcs) {
          const vpcSelfLink = `projects/${project.projectId}/global/networks/${vpc.name}`;
          vpc.subnets = await this.fetchSubnets(serviceAccountId, project.projectId, vpcSelfLink);
        }

        projectsWithDetails.push({
          projectId: project.projectId,
          name: project.name,
          number: project.number,
          vpcs,
          firewallRules,
          instances,
        });
      } catch (error) {
        console.error(`Failed to fetch data for project ${project.projectId}:`, error);
        projectsWithDetails.push({
          projectId: project.projectId,
          name: project.name,
          number: project.number,
          vpcs: [],
          firewallRules: [],
          instances: [],
          error: 'Failed to fetch project data',
        });
      }
    }

    return projectsWithDetails;
  }

  private extractNetworkName(networkUrl: string | null | undefined): string {
    if (!networkUrl) return '';

    const parts = networkUrl.split('/');
    return parts[parts.length - 1] || '';
  }
}

export default new GcpDataService();
