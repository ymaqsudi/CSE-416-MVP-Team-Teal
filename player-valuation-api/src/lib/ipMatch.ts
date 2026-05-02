/**
 * Normalize an IP for exact-match comparison.
 * - Strips IPv4-mapped IPv6 prefix (`::ffff:127.0.0.1` -> `127.0.0.1`).
 * - Lowercases IPv6 hex.
 * - Trims whitespace.
 */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  const v4Mapped = trimmed.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4Mapped) return v4Mapped[1];
  return trimmed;
}

/**
 * Returns true when `requestIp` is in `allowed`. Empty allowlist denies all.
 * Comparison is exact after normalization (no CIDR support — out of scope).
 */
export function isIpAllowed(requestIp: string, allowed: string[]): boolean {
  if (!allowed || allowed.length === 0) return false;
  const target = normalizeIp(requestIp);
  for (const entry of allowed) {
    if (normalizeIp(entry) === target) return true;
  }
  return false;
}
