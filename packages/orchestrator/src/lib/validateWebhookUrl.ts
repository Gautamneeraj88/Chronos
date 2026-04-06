import * as dns from 'dns/promises';
import * as net from 'net';

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// RFC 1918 private, loopback, link-local, shared (RFC 6598), and reserved ranges
const PRIVATE_RANGES: RegExp[] = [
  /^127\./,                                          // loopback
  /^10\./,                                           // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,                     // RFC 1918
  /^192\.168\./,                                     // RFC 1918
  /^169\.254\./,                                     // link-local
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,      // shared RFC 6598
  /^0\./,                                            // "this" network
  /^::1$/,                                           // IPv6 loopback
  /^f[cd]/i,                                         // IPv6 ULA fc00::/7
  /^fe80/i,                                          // IPv6 link-local
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(ip));
}

/**
 * Validates that a webhook URL is safe to store and dispatch to.
 * Rejects private/loopback/link-local addresses (including DNS rebinding attacks).
 * Throws with a descriptive message on failure — callers let it bubble to error middleware.
 */
export async function validateWebhookUrl(raw: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid webhook URL: ${raw}`);
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(
      `Webhook URL must use http or https. Got: ${parsed.protocol}`,
    );
  }

  const hostname = parsed.hostname;

  // Direct IP — check immediately without DNS
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`Webhook URL targets a private or reserved address: ${raw}`);
    }
    return;
  }

  // Hostname — resolve all A/AAAA records and check each
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    // Fail-closed: unresolvable host is rejected
    throw new Error(`Could not resolve webhook URL hostname: ${hostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(`Webhook URL resolves to a private or reserved address: ${raw}`);
    }
  }
}
