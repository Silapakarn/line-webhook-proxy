import { Producer } from 'kafkajs';
import { logger } from '../../helpers/Logger/logger';
import { ErrorCode } from '../../helpers/enum/error-code';
import { InternalError } from '../../helpers/errors/internal-error';
import { ForwardHeaders, IKafkaAdapter, KafkaAdapterResult } from '../../domain/kafka/kafka-model';
import { ProxySigningService } from '../../helpers/proxy-signing.service';

export class KafkaAdapter implements IKafkaAdapter {
  constructor(
    private readonly producer: Producer,
    private readonly topic: string,
    readonly name: string,
    private readonly signingService: ProxySigningService,
  ) {}

  async forward(rawBody: string, headers: ForwardHeaders): Promise<KafkaAdapterResult> {
    const start = Date.now();

    try {
      await this.producer.send({
        topic: this.topic,
        // acks=1 — leader broker must confirm write before this resolves
        acks: 1,
        messages: [
          {
            value: rawBody,
            headers: this._buildHeaders(rawBody, headers),
          },
        ],
      });

      const latencyMs = Date.now() - start;

      logger.info({
        event: 'kafka.produce.success',
        topic: this.topic,
        latencyMs,
        requestId: headers['x-request-id'],
      });

      return { status: 200, latencyMs };
    } catch (error: unknown) {
      const latencyMs = Date.now() - start;

      logger.error({
        errorCode: ErrorCode.FORWARDING_FAILED,
        description: `failed to produce to topic: ${this.topic} | ${error instanceof Error ? error.message : String(error)}`,
        location: 'KafkaAdapter.forward',
        latencyMs,
      });

      throw new InternalError({
        code: ErrorCode.FORWARDING_FAILED,
        message: `failed to produce to topic: ${this.topic} (${error instanceof Error ? error.message : String(error)})`,
      });
    }
  }

  /**
   * Preserve all original LINE headers so consumers receive exactly what LINE sent.
   * Add x-proxy-signature so consumers verify origin is the proxy, not LINE directly.
   * This means consumers NEVER need LINE_CHANNEL_SECRET.
   */
  private _buildHeaders(rawBody: string, headers: ForwardHeaders): Record<string, string> {
    const result: Record<string, string> = {};

    // Preserve all original headers from LINE
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      result[key] = Array.isArray(value) ? value[0] : value;
    }

    // Inject proxy signature — consumers use this to validate the message came from us
    result['x-proxy-signature'] = this.signingService.sign(rawBody);

    return result;
  }
}
