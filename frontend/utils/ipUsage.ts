import {
  GcpLoadBalancer,
  GcpProject,
  IpAddressKind,
  IpCatalogItem,
  IpUsageMatch,
  IpUsageResult,
} from '../types';
import { parseCidr } from './cidr';

const IPV4_SEGMENT_PATTERN = /^\d+$/;
const POLICY_RANK: Record<string, number> = {
  FIREWALL: 0,
  ROUTE: 1,
  CLOUD_ARMOR: 2,
};
const ENDPOINT_RANK: Record<string, number> = {
  INSTANCE_INTERNAL_IP: 0,
  INSTANCE_EXTERNAL_IP: 1,
  LOAD_BALANCER: 2,
};

export type CloudArmorMode = 'all_matches' | 'lb_attached_only';

interface BuildIpUsageOptions {
  cloudArmorMode?: CloudArmorMode;
  includeFirewallRules?: boolean;
  includeLbPolicyReferences?: boolean;
}

export function validateIpv4(input: string): boolean {
  const value = input.trim();
  const segments = value.split('.');
  if (segments.length !== 4) {
    return false;
  }

  return segments.every((segment) => {
    if (!IPV4_SEGMENT_PATTERN.test(segment)) {
      return false;
    }
    if (segment.length > 1 && segment.startsWith('0')) {
      return false;
    }
    const parsed = Number.parseInt(segment, 10);
    return parsed >= 0 && parsed <= 255;
  });
}

export function inferIpAddressKind(ip: string): IpAddressKind {
  return isPrivateIpv4(ip) ? 'INTERNAL' : 'EXTERNAL';
}

export function buildIpCatalog(
  projects: GcpProject[],
  scope: string
): Record<IpAddressKind, IpCatalogItem[]> {
  const scopedProjects = projects.filter((project) => scope === 'all' || project.projectId === scope);
  const catalogMap = new Map<string, IpCatalogItem>();

  const upsertCatalog = (
    projectId: string,
    ip: string,
    kind: IpAddressKind,
    resourceLabel: string
  ) => {
    if (!validateIpv4(ip)) {
      return;
    }

    const key = `${projectId}::${kind}::${ip}`;
    const existing = catalogMap.get(key);
    if (!existing) {
      catalogMap.set(key, {
        ip,
        kind,
        projectId,
        usageCount: 1,
        resources: [resourceLabel],
      });
      return;
    }

    existing.usageCount += 1;
    if (!existing.resources.includes(resourceLabel)) {
      existing.resources.push(resourceLabel);
    }
  };

  scopedProjects.forEach((project) => {
    project.instances.forEach((instance) => {
      if (instance.internalIp) {
        upsertCatalog(project.projectId, instance.internalIp, 'INTERNAL', 'Instance Internal IP');
      }
      if (instance.externalIp) {
        upsertCatalog(project.projectId, instance.externalIp, 'EXTERNAL', 'Instance External IP');
      }
    });

    project.loadBalancers.forEach((loadBalancer) => {
      const kind = inferLoadBalancerIpKind(loadBalancer);
      upsertCatalog(project.projectId, loadBalancer.ipAddress, kind, 'Load Balancer IP');
    });
  });

  const allItems = [...catalogMap.values()];
  const sortItems = (left: IpCatalogItem, right: IpCatalogItem) => {
    if (left.projectId !== right.projectId) {
      return left.projectId.localeCompare(right.projectId);
    }
    const leftNumeric = ipToNumber(left.ip);
    const rightNumeric = ipToNumber(right.ip);
    if (leftNumeric !== null && rightNumeric !== null && leftNumeric !== rightNumeric) {
      return leftNumeric - rightNumeric;
    }
    return left.ip.localeCompare(right.ip);
  };

  return {
    INTERNAL: allItems.filter((item) => item.kind === 'INTERNAL').sort(sortItems),
    EXTERNAL: allItems.filter((item) => item.kind === 'EXTERNAL').sort(sortItems),
  };
}

export function buildIpUsageResult(
  projects: GcpProject[],
  scope: string,
  inputIp: string,
  options?: BuildIpUsageOptions
): IpUsageResult {
  const normalizedIp = inputIp.trim();
  const scopedProjects = projects.filter((project) => scope === 'all' || project.projectId === scope);
  const cloudArmorMode = options?.cloudArmorMode ?? 'all_matches';
  const includeFirewallRules = options?.includeFirewallRules ?? true;
  const includeLbPolicyReferences = options?.includeLbPolicyReferences ?? false;
  const lbAttachedPoliciesByProject = cloudArmorMode === 'lb_attached_only'
    ? buildAttachedArmorPolicyNameSet(scopedProjects)
    : new Map<string, Set<string>>();
  const networkMatches: IpUsageMatch[] = [];
  const endpointMatches: IpUsageMatch[] = [];
  const policyMatches: IpUsageMatch[] = [];

  scopedProjects.forEach((project) => {
    project.vpcs.forEach((vpc) => {
      vpc.subnets.forEach((subnet) => {
        if (!cidrContainsIp(subnet.ipCidrRange, normalizedIp)) {
          return;
        }

        networkMatches.push({
          id: `network-${project.projectId}-${vpc.name}-${subnet.name}-${subnet.ipCidrRange}`,
          stage: 'NETWORK',
          relation: 'CIDR_CONTAINS',
          resourceType: 'SUBNET',
          projectId: project.projectId,
          resourceName: `${vpc.name}/${subnet.name}`,
          matchedField: 'ipCidrRange',
          matchedValue: subnet.ipCidrRange,
          metadata: {
            projectName: project.name,
            vpcName: vpc.name,
            subnetName: subnet.name,
            region: subnet.region,
            cidrPrefix: getCidrPrefix(subnet.ipCidrRange),
            gatewayIp: subnet.gatewayIp,
            privateGoogleAccess: subnet.privateGoogleAccess,
            subnetSelfLink: subnet.selfLink,
          },
        });
      });

      vpc.routes.forEach((route) => {
        if (!cidrContainsIp(route.destRange, normalizedIp)) {
          return;
        }

        policyMatches.push({
          id: `route-${project.projectId}-${vpc.name}-${route.id}-${route.destRange}`,
          stage: 'POLICY',
          relation: 'RULE_REFERENCE',
          resourceType: 'ROUTE',
          projectId: project.projectId,
          resourceName: route.name || route.id,
          matchedField: 'destRange',
          matchedValue: route.destRange,
          metadata: {
            vpcName: vpc.name,
            priority: route.priority,
            nextHop: route.nextHop,
            routeId: route.id,
            routeDescription: route.description || '',
            routeTags: summarizeList(route.tags || [], 4),
          },
        });
      });
    });

    project.instances.forEach((instance) => {
      if (instance.internalIp === normalizedIp) {
        endpointMatches.push({
          id: `instance-internal-${project.projectId}-${instance.id}`,
          stage: 'ENDPOINT',
          relation: 'EXACT',
          resourceType: 'INSTANCE_INTERNAL_IP',
          projectId: project.projectId,
          resourceName: instance.name,
          matchedField: 'internalIp',
          matchedValue: instance.internalIp,
          metadata: {
            network: instance.network,
            subnetwork: instance.subnetwork,
            zone: instance.zone,
            ipKind: 'INTERNAL',
            machineType: instance.machineType,
            instanceStatus: instance.status,
            networkTags: summarizeList(instance.tags || [], 5),
          },
        });
      }

      if (instance.externalIp && instance.externalIp === normalizedIp) {
        endpointMatches.push({
          id: `instance-external-${project.projectId}-${instance.id}`,
          stage: 'ENDPOINT',
          relation: 'EXACT',
          resourceType: 'INSTANCE_EXTERNAL_IP',
          projectId: project.projectId,
          resourceName: instance.name,
          matchedField: 'externalIp',
          matchedValue: instance.externalIp,
          metadata: {
            network: instance.network,
            subnetwork: instance.subnetwork,
            zone: instance.zone,
            ipKind: 'EXTERNAL',
            machineType: instance.machineType,
            instanceStatus: instance.status,
            networkTags: summarizeList(instance.tags || [], 5),
          },
        });
      }
    });

    project.loadBalancers.forEach((loadBalancer) => {
      if (loadBalancer.ipAddress !== normalizedIp) {
        return;
      }

      const ipKind = inferLoadBalancerIpKind(loadBalancer);
      endpointMatches.push({
        id: `load-balancer-${project.projectId}-${loadBalancer.id}`,
        stage: 'ENDPOINT',
        relation: 'EXACT',
        resourceType: 'LOAD_BALANCER',
        projectId: project.projectId,
        resourceName: loadBalancer.name,
        matchedField: 'ipAddress',
        matchedValue: loadBalancer.ipAddress,
        metadata: {
          protocol: loadBalancer.protocol,
          portRange: loadBalancer.portRange,
          region: loadBalancer.region,
          ipKind,
          loadBalancerType: loadBalancer.type,
          forwardingRuleName: loadBalancer.forwardingRuleName,
          backendCount: loadBalancer.backends.length,
          backendPreview: summarizeList(loadBalancer.backends || [], 4),
          cloudArmorCount: getLoadBalancerAttachedPolicyNames(loadBalancer).length,
          cloudArmorPolicies: summarizeList(getLoadBalancerAttachedPolicyNames(loadBalancer), 4),
        },
      });

      if (includeLbPolicyReferences) {
        getLoadBalancerAttachedPolicyNames(loadBalancer).forEach((policyName) => {
          policyMatches.push({
            id: `armor-attached-${project.projectId}-${loadBalancer.id}-${policyName}`,
            stage: 'POLICY',
            relation: 'RULE_REFERENCE',
            resourceType: 'CLOUD_ARMOR',
            projectId: project.projectId,
            resourceName: policyName,
            matchedField: 'securityPolicy',
            matchedValue: policyName,
            metadata: {
              policyName,
              policySource: 'LB_ATTACHED',
              loadBalancerName: loadBalancer.name,
              priority: -1,
            },
          });
        });
      }
    });

    if (includeFirewallRules) {
      project.firewallRules.forEach((rule) => {
        const sourceRanges = rule.sourceRanges || [];
        sourceRanges.forEach((sourceRange) => {
          if (!cidrContainsIp(sourceRange, normalizedIp)) {
            return;
          }

          policyMatches.push({
            id: `firewall-${project.projectId}-${rule.id}-${sourceRange}`,
            stage: 'POLICY',
            relation: 'RULE_REFERENCE',
            resourceType: 'FIREWALL',
            projectId: project.projectId,
            resourceName: rule.name,
            matchedField: 'sourceRanges',
            matchedValue: sourceRange,
            metadata: {
              network: rule.network,
              direction: rule.direction,
              action: rule.action,
              priority: rule.priority,
              disabled: rule.disabled,
              targetTags: summarizeList(rule.targetTags || [], 4),
            },
          });
        });
      });
    }

    project.armorPolicies.forEach((policy) => {
      if (cloudArmorMode === 'lb_attached_only') {
        const attachedPolicies = lbAttachedPoliciesByProject.get(project.projectId);
        if (!attachedPolicies || !attachedPolicies.has(policy.name)) {
          return;
        }
      }

      policy.rules.forEach((rule) => {
        (rule.srcIpRanges || []).forEach((sourceRange) => {
          if (!cidrContainsIp(sourceRange, normalizedIp)) {
            return;
          }

          policyMatches.push({
            id: `armor-${project.projectId}-${policy.id}-${rule.priority}-${sourceRange}`,
            stage: 'POLICY',
            relation: 'RULE_REFERENCE',
            resourceType: 'CLOUD_ARMOR',
            projectId: project.projectId,
            resourceName: `${policy.name}#${rule.priority}`,
            matchedField: 'srcIpRanges',
            matchedValue: sourceRange,
            metadata: {
              policyName: policy.name,
              action: rule.action,
              priority: rule.priority,
              policyType: policy.type,
              policyRulesCount: policy.rulesCount,
              preview: rule.preview,
              ruleDescription: rule.description || '',
            },
          });
        });
      });
    });
  });

  const sortedNetwork = sortNetworkMatches(networkMatches);
  const sortedEndpoint = sortEndpointMatches(endpointMatches);
  const sortedPolicy = sortPolicyMatches(policyMatches);
  const allMatches = [...sortedNetwork, ...sortedEndpoint, ...sortedPolicy];
  const projectIds = new Set(allMatches.map((match) => match.projectId));

  return {
    inputIp: normalizedIp,
    scope,
    totals: {
      totalMatches: allMatches.length,
      projectCount: projectIds.size,
      networkCount: sortedNetwork.length,
      endpointCount: sortedEndpoint.length,
      policyCount: sortedPolicy.length,
    },
    itemsByStage: {
      NETWORK: sortedNetwork,
      ENDPOINT: sortedEndpoint,
      POLICY: sortedPolicy,
    },
  };
}

function sortNetworkMatches(matches: IpUsageMatch[]): IpUsageMatch[] {
  return [...matches].sort((left, right) => {
    if (left.projectId !== right.projectId) {
      return left.projectId.localeCompare(right.projectId);
    }

    const leftPrefix = toNumber(left.metadata.cidrPrefix, 0);
    const rightPrefix = toNumber(right.metadata.cidrPrefix, 0);
    if (leftPrefix !== rightPrefix) {
      return rightPrefix - leftPrefix;
    }

    if (left.matchedValue !== right.matchedValue) {
      return left.matchedValue.localeCompare(right.matchedValue);
    }

    return left.resourceName.localeCompare(right.resourceName);
  });
}

function sortEndpointMatches(matches: IpUsageMatch[]): IpUsageMatch[] {
  return [...matches].sort((left, right) => {
    const leftRank = ENDPOINT_RANK[left.resourceType] ?? 99;
    const rightRank = ENDPOINT_RANK[right.resourceType] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    if (left.projectId !== right.projectId) {
      return left.projectId.localeCompare(right.projectId);
    }
    return left.resourceName.localeCompare(right.resourceName);
  });
}

function sortPolicyMatches(matches: IpUsageMatch[]): IpUsageMatch[] {
  return [...matches].sort((left, right) => {
    const leftRank = POLICY_RANK[left.resourceType] ?? 99;
    const rightRank = POLICY_RANK[right.resourceType] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftPriority = toNumber(left.metadata.priority, Number.MAX_SAFE_INTEGER);
    const rightPriority = toNumber(right.metadata.priority, Number.MAX_SAFE_INTEGER);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    if (left.projectId !== right.projectId) {
      return left.projectId.localeCompare(right.projectId);
    }

    return left.resourceName.localeCompare(right.resourceName);
  });
}

function inferLoadBalancerIpKind(loadBalancer: GcpLoadBalancer): IpAddressKind {
  if (loadBalancer.type.startsWith('INTERNAL_')) {
    return 'INTERNAL';
  }
  if (loadBalancer.type.startsWith('EXTERNAL_')) {
    return 'EXTERNAL';
  }
  return inferIpAddressKind(loadBalancer.ipAddress);
}

function buildAttachedArmorPolicyNameSet(projects: GcpProject[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  projects.forEach((project) => {
    const names = new Set<string>();
    project.loadBalancers.forEach((lb) => {
      getLoadBalancerAttachedPolicyNames(lb).forEach((policyName) => {
        if (policyName) {
          names.add(policyName);
        }
      });
    });
    map.set(project.projectId, names);
  });
  return map;
}

function getLoadBalancerAttachedPolicyNames(loadBalancer: GcpLoadBalancer): string[] {
  return [...new Set([
    ...(loadBalancer.cloudArmorPolicies || []),
    ...(loadBalancer.securityPolicy ? [loadBalancer.securityPolicy] : []),
  ].filter((value) => value !== ''))];
}

function isPrivateIpv4(ip: string): boolean {
  const numeric = ipToNumber(ip);
  if (numeric === null) {
    return false;
  }

  return (
    (numeric >= ipToNumber('10.0.0.0')! && numeric <= ipToNumber('10.255.255.255')!) ||
    (numeric >= ipToNumber('172.16.0.0')! && numeric <= ipToNumber('172.31.255.255')!) ||
    (numeric >= ipToNumber('192.168.0.0')! && numeric <= ipToNumber('192.168.255.255')!)
  );
}

function getCidrPrefix(cidr: string): number {
  const prefix = Number.parseInt(cidr.split('/')[1] || '', 10);
  return Number.isInteger(prefix) ? prefix : 0;
}

function cidrContainsIp(cidr: string, ip: string): boolean {
  const parsedCidr = parseCidr(cidr);
  const parsedIp = ipToNumber(ip);
  if (!parsedCidr || parsedIp === null) {
    return false;
  }
  return parsedIp >= parsedCidr.low && parsedIp <= parsedCidr.high;
}

function ipToNumber(ip: string): number | null {
  if (!validateIpv4(ip)) {
    return null;
  }
  const segments = ip.split('.').map((part) => Number.parseInt(part, 10));
  return (
    ((segments[0] << 24) | (segments[1] << 16) | (segments[2] << 8) | segments[3]) >>> 0
  );
}

function toNumber(value: string | number | boolean | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function summarizeList(values: string[], limit: number): string {
  const nonEmptyValues = values
    .map((value) => value.trim())
    .filter((value) => value !== '');

  if (nonEmptyValues.length === 0) {
    return '';
  }

  if (nonEmptyValues.length <= limit) {
    return nonEmptyValues.join(', ');
  }

  const visible = nonEmptyValues.slice(0, limit).join(', ');
  return `${visible} +${nonEmptyValues.length - limit}`;
}
