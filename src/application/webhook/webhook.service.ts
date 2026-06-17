import { IncomingHttpHeaders } from 'http';
import { KafkaService } from '../kafka/kafka.service';
import { logger } from '../../helpers/Logger/logger';

interface LineEvent {
  type: string;
}

interface LineWebhookBody {
  events?: LineEvent[];
}

export class WebhookService {
  constructor(private readonly kafkaService: KafkaService) {}

  async forward(rawBody: string, headers: IncomingHttpHeaders): Promise<void> {
    const events = this._parseLineEvents(rawBody);

    const results = await Promise.allSettled(
      events.map((event) => this.kafkaService.publish(event.type, rawBody, headers)),
    );

    this._logFailures(results);
  }

  private _parseLineEvents(rawBody: string): LineEvent[] {
    try {
      const body = JSON.parse(rawBody) as LineWebhookBody;
      return body.events ?? [];
    } catch {
      logger.warn({ event: 'webhook.parse.failed', reason: 'invalid JSON body' });
      return [];
    }
  }

  private _logFailures(results: PromiseSettledResult<void>[]): void {
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length === 0) return;

    logger.error({
      event: 'webhook.publish.partial-failure',
      total: results.length,
      failed: failures.length,
      reasons: failures.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason))),
    });
  }
}
