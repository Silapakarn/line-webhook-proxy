import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../../helpers/errors/custom-error';
import { ErrorCode } from '../../helpers/enum/error-code';
import { logger } from '../../helpers/Logger/logger';

export function errorHandlerMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof CustomError) {
    const schema = error.getSchema();
    logger.error({
      event: 'request.failed',
      errorCode: schema.code,
      description: schema.message,
      location: 'errorHandlerMiddleware',
    });
    res.status(error.statusCode).json(schema);
    return;
  }

  const description = error instanceof Error ? error.message : 'Unexpected error';
  logger.error({ event: 'request.failed', errorCode: ErrorCode.INTERNAL_ERROR, description });
  res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: 'An unexpected error occurred' });
}
