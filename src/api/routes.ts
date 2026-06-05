import { Router as ExpressRouter } from 'express';
import Container, { ProviderName } from './di/container';
import { WebhookController } from './controllers/webhook.controller';

export interface Router {
  route(): ExpressRouter;
}

export default function router(container: Container): ExpressRouter {
  const app = ExpressRouter();

  const webhookController = container.getInstance(ProviderName.WEBHOOK_CONTROLLER) as WebhookController;

  app.use('/webhook', webhookController.route());

  return app;
}
