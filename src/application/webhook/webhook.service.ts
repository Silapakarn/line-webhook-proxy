import { IncomingHttpHeaders } from 'http';
import { IDownstreamAdapter } from '../interface/downstream.adapter.interface';
import { logger } from '../../helpers/Logger/logger';
import { WebhookStatus, WebhookForwardModel } from 'src/domain/webhook';

export class WebhookService {
  private readonly adapterNames: string[];

  constructor(private readonly downstreamAdapters: IDownstreamAdapter[]) {
    this.adapterNames = downstreamAdapters.map((a) => a.name);
  }

  async forward(rawBody: string, originalHeaders: IncomingHttpHeaders): Promise<WebhookForwardModel> {

    // in production grade we use Kafka/RabbitMQ to forward the webhook
    const results = await Promise.allSettled(
      this.downstreamAdapters.map((adapter) => adapter.forward(rawBody, originalHeaders)),
    );

    const forwardResults = results.map((result, i) => {
      const adapterName = this.adapterNames[i];

      if (result.status === WebhookStatus.FULFILLED) {
        return { downstream: adapterName, status: result.value.status, latencyMs: result.value.latencyMs };
      }

      logger.error({
        event: 'webhook.forward.failed',
        downstream: adapterName,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });

      return { downstream: adapterName, status: 0, latencyMs: 0 };
    });

    return new WebhookForwardModel(forwardResults);
  }
}
