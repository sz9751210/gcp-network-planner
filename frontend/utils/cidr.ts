// Helper to convert IP string to long number
function ipToLong(ip: string): number {
  let parts = ip.split('.');
  if (parts.length !== 4) return 0;
  return ((parseInt(parts[0], 10) << 24) |
          (parseInt(parts[1], 10) << 16) |
          (parseInt(parts[2], 10) << 8) |
           parseInt(parts[3], 10)) >>> 0;
}

interface ParsedCidr {
  ip: number;
  mask: number;
  low: number;
  high: number;
}

export function parseCidr(cidr: string): ParsedCidr | null {
  try {
    const [ipStr, prefixStr] = cidr.split('/');
    if (!ipStr || !prefixStr) return null;

    const ip = ipToLong(ipStr);
    const prefix = parseInt(prefixStr, 10);

    if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

    // Calculate mask
    // FIXED: Use Left Shift (<<) instead of Right Shift (>>>) to generate correct subnet mask.
    // Example /24: 1111... << 8 becomes 11111111 11111111 11111111 00000000 (0xFFFFFF00)
    // Handle /0 special case where shift by 32 in JS results in no shift.
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    
    // Network address (low) = IP & Mask
    const low = (ip & mask) >>> 0;
    
    // Broadcast address (high) = Network | Wildcard Mask (inverse of subnet mask)
    const high = (low | (~mask >>> 0)) >>> 0;

    return { ip, mask, low, high };
  } catch (e) {
    return null;
  }
}

// Check if range A overlaps with range B
export function checkOverlap(cidrA: string, cidrB: string): boolean {
  const a = parseCidr(cidrA);
  const b = parseCidr(cidrB);

  if (!a || !b) return false;

  // Check if ranges intersect
  // Logic: (StartA <= EndB) and (EndA >= StartB)
  // Since our low/high are unsigned 32-bit integers, standard comparison works correctly.
  return (a.low <= b.high) && (a.high >= b.low);
}

export function formatIp(long: number): string {
  return [
    (long >>> 24) & 0xff,
    (long >>> 16) & 0xff,
    (long >>> 8) & 0xff,
    long & 0xff
  ].join('.');
}

export function getTotalIps(cidr: string): number {
  try {
    const prefix = parseInt(cidr.split('/')[1], 10);
    if (isNaN(prefix)) return 0;
    return Math.pow(2, 32 - prefix);
  } catch {
    return 0;
  }
}