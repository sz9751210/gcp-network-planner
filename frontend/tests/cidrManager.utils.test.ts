import {
  buildCidrInventory,
  detectCidrConflicts,
  suggestNextAvailablePrivateCidr,
} from '../utils/cidrManager';
import { buildTestProject } from './fixtures';

describe('cidrManager utils', () => {
  it('builds inventory rows for selected scope', () => {
    const project = buildTestProject();
    const rowsAll = buildCidrInventory([project], 'all');
    const rowsScoped = buildCidrInventory([project], project.projectId);
    const rowsEmpty = buildCidrInventory([project], 'non-existent');

    expect(rowsAll).toHaveLength(1);
    expect(rowsScoped).toHaveLength(1);
    expect(rowsEmpty).toHaveLength(0);
    expect(rowsAll[0].cidr).toBe('10.0.0.0/24');
  });

  it('detects cidr conflicts against subnet inventory', () => {
    const rows = buildCidrInventory([buildTestProject()], 'all');
    const conflict = detectCidrConflicts('10.0.0.0/24', rows);
    const nonConflict = detectCidrConflicts('10.0.2.0/24', rows);

    expect(conflict?.hasConflict).toBe(true);
    expect(conflict?.conflicts).toHaveLength(1);
    expect(nonConflict?.hasConflict).toBe(false);
  });

  it('suggests next available private cidr for a prefix', () => {
    const rows = buildCidrInventory([buildTestProject()], 'all');
    const suggestion = suggestNextAvailablePrivateCidr(24, rows);

    expect(suggestion).not.toBeNull();
    expect(suggestion?.candidateCidr).toBe('10.0.1.0/24');
  });

  it('handles edge prefixes and exhaustion', () => {
    const rows = [
      {
        projectId: 'p1',
        projectName: 'P1',
        vpcName: 'vpc',
        subnetName: 's1',
        region: 'us-central1',
        cidr: '10.0.0.0/8',
        totalIps: 1,
        stale: false,
        lastScannedAt: '2026-03-31T00:00:00Z',
      },
      {
        projectId: 'p2',
        projectName: 'P2',
        vpcName: 'vpc',
        subnetName: 's2',
        region: 'us-central1',
        cidr: '172.16.0.0/12',
        totalIps: 1,
        stale: false,
        lastScannedAt: '2026-03-31T00:00:00Z',
      },
      {
        projectId: 'p3',
        projectName: 'P3',
        vpcName: 'vpc',
        subnetName: 's3',
        region: 'us-central1',
        cidr: '192.168.0.0/16',
        totalIps: 1,
        stale: false,
        lastScannedAt: '2026-03-31T00:00:00Z',
      },
    ];

    expect(suggestNextAvailablePrivateCidr(0, rows)).toBeNull();
    expect(suggestNextAvailablePrivateCidr(33, rows)).toBeNull();
    expect(suggestNextAvailablePrivateCidr(24, rows)).toBeNull();
    expect(suggestNextAvailablePrivateCidr(32, [])?.candidateCidr).toBe('10.0.0.0/32');
  });
});
