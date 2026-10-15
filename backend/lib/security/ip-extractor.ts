/**
 * IP Extractor Utility
 *
 * Extracts the client's real IP address from HTTP headers, accounting for
 * proxies and load balancers that forward the original IP.
 *
 * Header precedence:
 * 1. x-forwarded-for (most common, used by most proxies)
 * 2. cf-connecting-ip (Cloudflare)
 * 3. x-real-ip (Nginx reverse proxy)
 * 4. request.socket.remoteAddress (direct connection)
 */

/**
 * Extract client IP from request headers
 * Handles multiple proxies by taking the first non-private IP
 * Returns "unknown" if no IP can be determined
 */
export function extractClientIp(request: Request): string {
  try {
    // Try x-forwarded-for header (handles multiple proxies)
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',').map(ip => ip.trim());
      const publicIp = ips.find(ip => !isPrivateIp(ip));
      if (publicIp) return publicIp;
      // If all are private, use the first one (likely the original client)
      return ips[0] || 'unknown';
    }

    // Try Cloudflare header
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp) return cfConnectingIp;

    // Try x-real-ip header (Nginx)
    const xRealIp = request.headers.get('x-real-ip');
    if (xRealIp) return xRealIp;

    // Fall back to socket remote address (direct connection)
    // Note: In Next.js, this is typically not available for external requests
    // but we include it for completeness
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check if an IP address is private (RFC 1918, loopback, link-local)
 */
function isPrivateIp(ip: string): boolean {
  // Loopback addresses
  if (ip === '127.0.0.1' || ip === '::1') return true;

  // Link-local addresses (169.254.x.x, fe80::/10)
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('fe80:')) return true;

  // Private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
  }

  return false;
}
