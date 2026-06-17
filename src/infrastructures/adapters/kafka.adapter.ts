import { Producer } from 'kafkajs';
import { logger } from '../../helpers/Logger/logger';
import { ErrorCode } from '../../helpers/enum/error-code';
import { InternalError } from '../../helpers/errors/internal-error';
import { ForwardHeaders, IKafkaAdapter, KafkaAdapterResult } from '../../domain/kafka/kafka-model';

export class KafkaAdapter implements IKafkaAdapter {
  constructor(
    private readonly producer: Producer,
    private readonly topic: string,
    readonly name: string,
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
            headers: headers,
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
}
