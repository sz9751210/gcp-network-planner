import {
  CidrConflictResult,
  CidrInventoryRow,
  CidrSuggestion,
  GcpProject,
} from '../types';
import { formatIp, getTotalIps, parseCidr } from './cidr';

const PRIVATE_RANGES = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

export function buildCidrInventory(
  projects: GcpProject[],
  selectedProjectId: string
): CidrInventoryRow[] {
  const rows: CidrInventoryRow[] = [];

  projects.forEach((project) => {
    if (selectedProjectId !== 'all' && project.projectId !== selectedProjectId) {
      return;
    }

    project.vpcs.forEach((vpc) => {
      vpc.subnets.forEach((subnet) => {
        rows.push({
          projectId: project.projectId,
          projectName: project.name,
          vpcName: vpc.name,
          subnetName: subnet.name,
          region: subnet.region,
          cidr: subnet.ipCidrRange,
          totalIps: getTotalIps(subnet.ipCidrRange),
          stale: project.stale,
          lastScannedAt: project.lastScannedAt,
        });
      });
    });
  });

  return rows;
}

export function detectCidrConflicts(
  inputCidr: string,
  rows: CidrInventoryRow[]
): CidrConflictResult | null {
  const normalizedInput = inputCidr.trim();
  if (!normalizedInput || !parseCidr(normalizedInput)) {
    return null;
  }

  const inputRange = parseCidr(normalizedInput);
  if (!inputRange) {
    return null;
  }

  const conflicts = rows.filter((row) => {
    const rowRange = parseCidr(row.cidr);
    if (!rowRange) {
      return false;
    }
    return inputRange.low <= rowRange.high && inputRange.high >= rowRange.low;
  });

  return {
    inputCidr: normalizedInput,
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

export function suggestNextAvailablePrivateCidr(
  prefix: number,
  rows: CidrInventoryRow[]
): CidrSuggestion | null {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }
  if (prefix < 8) {
    return null;
  }

  const existingRanges = rows
    .map((row) => parseCidr(row.cidr))
    .filter((range): range is NonNullable<ReturnType<typeof parseCidr>> => Boolean(range))
    .sort((a, b) => a.low - b.low);

  const blockSize = Math.pow(2, 32 - prefix);
  if (!Number.isFinite(blockSize) || blockSize <= 0) {
    return null;
  }

  for (const privateRangeCidr of PRIVATE_RANGES) {
    const privateRange = parseCidr(privateRangeCidr);
    if (!privateRange) {
      continue;
    }

    const privatePrefix = Number(privateRangeCidr.split('/')[1]);
    if (prefix < privatePrefix) {
      continue;
    }

    let candidateLow = privateRange.low;
    while (candidateLow + blockSize - 1 <= privateRange.high) {
      const candidateHigh = candidateLow + blockSize - 1;

      let overlaps = false;
      let nextCandidateLow = candidateLow + blockSize;

      for (const existing of existingRanges) {
        if (existing.high < candidateLow) {
          continue;
        }
        if (existing.low > candidateHigh) {
          break;
        }

        overlaps = true;
        if (existing.high + 1 > nextCandidateLow) {
          nextCandidateLow = existing.high + 1;
        }
      }

      if (!overlaps) {
        return {
          prefix,
          candidateCidr: `${formatIp(candidateLow)}/${prefix}`,
          reason: 'First available non-overlapping private CIDR range.',
          confidence: 0.9,
        };
      }

      const aligned = alignToBlockBoundary(nextCandidateLow, blockSize);
      if (aligned <= candidateLow) {
        break;
      }
      candidateLow = aligned;
    }
  }

  return null;
}

function alignToBlockBoundary(value: number, blockSize: number): number {
  const remainder = value % blockSize;
  if (remainder === 0) {
    return value;
  }
  return value + (blockSize - remainder);
}
