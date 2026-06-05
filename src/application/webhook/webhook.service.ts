import { IncomingHttpHeaders } from 'http';
import { IDownstreamAdapter, ForwardHeaders } from '../interface/downstream.adapter.interface';
import { logger } from '../../helpers/Logger/logger';
import { WebhookForwardResult } from 'src/domain/webhook';

export class WebhookService {
  constructor(private readonly downstreamAdapter: IDownstreamAdapter) {}

  async forward(rawBody: string, originalHeaders: IncomingHttpHeaders): Promise<WebhookForwardResult> {
    const headers: ForwardHeaders = {
      ...originalHeaders,
      'x-forwarded-by': 'line-webhook-proxy',
    };

    logger.info({
      event: 'webhook.forward.start',
      downstream: this.downstreamAdapter.name,
    });

    const result = await this.downstreamAdapter.forward(rawBody, headers);

    return {
      downstream: this.downstreamAdapter.name,
      status: result.status,
      latencyMs: result.latencyMs,
    };
  }
}
