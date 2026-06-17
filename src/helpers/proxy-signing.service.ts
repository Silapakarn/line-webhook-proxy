import { createHmac, timingSafeEqual } from 'crypto';

/**
 * ProxySigningService
 *
 * Signs the raw webhook body with HMAC-SHA256 using PROXY_SIGNING_KEY.
 * Consumers verify this signature to confirm the message came from the proxy,
 * NOT from LINE directly — they never need LINE_CHANNEL_SECRET.
 *
 * Header format: x-proxy-signature: v1=<base64-HMAC-SHA256>
 */
export class ProxySigningService {
  constructor(private readonly signingKey: string) {
    if (!signingKey) throw new Error('PROXY_SIGNING_KEY is required');
  }

  /**
   * Sign rawBody → "v1=<base64>"
   */
  sign(rawBody: string): string {
    const hmac = createHmac('sha256', this.signingKey)
      .update(rawBody, 'utf8')
      .digest('base64');
    return `v1=${hmac}`;
  }

  /**
   * Verify a signature string (e.g. "v1=abc123==") against rawBody.
   * Uses timingSafeEqual to prevent timing attacks.
   */
  verify(rawBody: string, signature: string): boolean {
    const expected = this.sign(rawBody);
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false; // mismatched lengths
    }
  }
}
