import { Router as ExpressRouter, Request, Response } from 'express';
import { WebhookService } from '../../application/webhook/webhook.service';
import { logger } from '../../helpers/Logger/logger';
import { ErrorCode } from '../../helpers/enum/error-code';
import { InternalError } from '../../helpers/errors/internal-error';
import { lineSignatureMiddleware } from '../middlewares/line-signature.middleware';
import { webhookRequestValidator } from '../middlewares/validators/webhook.validator';
import { Router } from '../routes';

const TEST_SCENARIO: string = 'crash'; // 'delay' | 'crash' | undefined
const TEST_DELAY_MS: number = 10000; // 10 seconds, adjust as needed to trigger timeout
  
export class WebhookController implements Router {
  constructor(private readonly webhookService: WebhookService) {}

  public route(): ExpressRouter {
    const router = ExpressRouter();

    router.post('/power', lineSignatureMiddleware, webhookRequestValidator(), this.handle);
    router.post('/chatshop', lineSignatureMiddleware, webhookRequestValidator(), this.handleTEST);

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
      userId: req.body?.events?.[0]?.source?.userId,
    });

    // if (TEST_SCENARIO === 'delay') {
    //   await new Promise<void>((resolve) => setTimeout(resolve, TEST_DELAY_MS));
    //   res.status(200).json({ success: true, scenario: TEST_SCENARIO });
    //   logger.info({ event: 'webhook.test.delay', delayMs: TEST_DELAY_MS });
    //   return;
    // }

    // if (TEST_SCENARIO === 'crash') {
    //   logger.warn({ event: 'webhook.test.error', errorCode: ErrorCode.INTERNAL_ERROR, location: 'WebhookController.handle' });
    //   throw new InternalError({ code: ErrorCode.INTERNAL_ERROR, message: 'Simulated error for testing' });
    // }

    const forwardModel = await this.webhookService.forward(req.body, req.headers);

    logger.info({
      event: 'webhook.completed',
      allFailed: forwardModel.allFailed,
      failedDownstreams: forwardModel.failedDownstreams,
      successDownstreams: forwardModel.successDownstreams,
    });

    res.status(200).json({ success: true });
  }


   public async handleTEST(req: Request, res: Response): Promise<void> {
    logger.info({
      event: 'webhook.received',
      headers: {
        'content-type': req.headers['content-type'],
        'x-line-signature': req.headers['x-line-signature'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
      bodyLength: req.body.length,
      userId: req.body?.events?.[0]?.source?.userId,
    });

    const forwardModel = await this.webhookService.forward(req.body, req.headers);

    logger.info({
      event: 'webhook.completed',
      allFailed: forwardModel.allFailed,
      failedDownstreams: forwardModel.failedDownstreams,
      successDownstreams: forwardModel.successDownstreams,
    });

    res.status(200).json({ success: true });
  }
}
