import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { logger } from '../../helpers/Logger/logger';
import { UnauthorizedError } from '../../helpers/errors/unauthorized-error';
import { ErrorCode } from '../../helpers/enum/error-code';

export function lineSignatureMiddleware(req: Request, _res: Response, next: NextFunction): void {

  if (process.env.NODE_ENV !== 'production') {
    logger.warn({ event: 'signature.skipped', reason: 'dev mode' });
    return next();
  }

  const signature = req.headers['x-line-signature'] as string;

  if (!signature) {
    logger.warn({
      event: 'signature.missing',
      errorCode: ErrorCode.SIGNATURE_INVALID,
      description: 'Missing x-line-signature header',
      location: 'lineSignatureMiddleware',
    });
    return next(new UnauthorizedError({ code: ErrorCode.SIGNATURE_INVALID, message: 'Missing x-line-signature header' }));
  }

  next();
}
