import { IncomingHttpHeaders } from 'http';
import { logger } from '../../helpers/Logger/logger';
import { IKafkaAdapter, Topic } from 'src/domain/kafka/kafka-model';

export class KafkaService {
  constructor(private readonly topic: Topic) {}

  async publish(eventType: string, rawBody: string, headers: IncomingHttpHeaders): Promise<void> {
    const kafkaAdapter = this._resolveAdapter(eventType);

    try {
      await kafkaAdapter.forward(rawBody, headers);
      logger.info({
        event: 'kafka.published',
        eventType,
        topic: kafkaAdapter.name,
      });
    } catch (err) {
      logger.error({
        event: 'kafka.publish.failed',
        eventType,
        topic: kafkaAdapter.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private _resolveAdapter(eventType: string): IKafkaAdapter {
    switch (eventType) {
      case 'message':  return this.topic.message;
      case 'postback': return this.topic.postback;
      default:         return this.topic.fallback;
    }
  }
}
