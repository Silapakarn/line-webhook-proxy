import { IncomingHttpHeaders } from 'http';
import { KafkaService } from '../kafka/kafka.service';
import { logger } from '../../helpers/Logger/logger';

export class WebhookService {
  constructor(private readonly kafkaService: KafkaService) {}

  async forward(rawBody: string, headers: IncomingHttpHeaders): Promise<void> {
    const events = this._parseEvents(rawBody);
 
    const results = await Promise.allSettled(
      events.map((event) => this.kafkaService.publish(event.type, rawBody, headers)),
    );

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error({
        event: 'webhook.publish.partial-failure',
        total: results.length,
        failed: failures.length,
        reasons: failures.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason))),
      });
    }
  }

  private _parseEvents(rawBody: string): { type: string }[] | null {
    try {
      const parsed: { events?: { type: string }[] } = JSON.parse(rawBody);
      return parsed.events ?? [];
    } catch {
      logger.warn({ event: 'webhook.parse.failed', reason: 'invalid JSON body' });
      return null;
    }
  }
}
