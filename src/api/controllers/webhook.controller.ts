import { Router as ExpressRouter, Request, Response } from 'express';
import correlator from 'express-correlation-id';
import { WebhookService } from '../../application/webhook/webhook.service';
import { logger } from '../../helpers/Logger/logger';
import { lineSignatureMiddleware } from '../middlewares/line-signature.middleware';
import { webhookRequestValidator } from '../middlewares/validators/webhook.validator';
import { Router } from '../routes';

export class WebhookController implements Router {
  constructor(private readonly webhookService: WebhookService) {}

  public route(): ExpressRouter {
    const router = ExpressRouter();

    router.post(
      '/', 
      lineSignatureMiddleware, 
      webhookRequestValidator(), 
      this.handle
    );

    return router;
  }

  public async handle(req: Request, res: Response): Promise<void> {

    logger.info({
      event: 'webhook.received',
      headers: {
        'content-type': req.headers['content-type'],
        'x-line-signature': req.headers['x-line-signature'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
      bodyLength: req.body.length,
    });

    const result = await this.webhookService.forward(req.body, req.headers);

    logger.info({
      event: 'webhook.completed',
      downstream: result.downstream,
      downstreamStatus: result.status,
      latencyMs: result.latencyMs,
    });

    res.status(200).json({ success: true });
  }
}
