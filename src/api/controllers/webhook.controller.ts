import { Router as ExpressRouter, Request, Response } from 'express';
import { WebhookService } from '../../application/webhook/webhook.service';
import { logger } from '../../helpers/Logger/logger';
import { lineSignatureMiddleware } from '../middlewares/line-signature.middleware';
import { webhookRequestValidator } from '../middlewares/validators/webhook.validator';
import { Router } from '../routes';

export class WebhookController implements Router {
  constructor(private readonly webhookService: WebhookService) {}

  public route(): ExpressRouter {
    const router = ExpressRouter();

    router.post('/power', lineSignatureMiddleware, webhookRequestValidator(), this.handle);
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
      bodyLength: req.rawBody?.length ?? 0,
      userId: req.body?.events?.[0]?.source?.userId,
      eventTypes: (req.body?.events ?? []).map((e: { type: string }) => e.type),
    });

    await this.webhookService.forward(req.rawBody!, req.headers);

    res.status(200).json({ success: true });
  }
}
