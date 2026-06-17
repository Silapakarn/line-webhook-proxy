import 'source-map-support/register';
import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import correlator from 'express-correlation-id';
import Container, { ProviderName } from './api/di/container';
import { errorHandlerMiddleware } from './api/middlewares/error-handler.middleware';
import router from './api/routes';

const app = express();

const preload = async () => {
  return {
    container: await Container.initialize(),
  };
};

preload().then(({ container }) => {
  app.use(cors());
  app.use(correlator());
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(router(container));
  app.use(errorHandlerMiddleware);

  const port = process.env.PORT ?? 3000;
  app.listen(port, () => {
    console.log(JSON.stringify({ event: 'server.started', port, service: 'line-webhook-proxy' }));
  });

  const shutdown = async () => {
    try {
      const producer = container.getInstance(ProviderName.KAFKA_PRODUCER);
      await producer.disconnect();
    } catch {
      // Kafka not enabled — nothing to disconnect
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
});

export default app;
