import { NextFunction, Request, Response } from 'express';
import { logger } from '../../../helpers/Logger/logger';
import { ErrorCode } from '../../../helpers/enum/error-code';
import { BadRequestError } from '../../../helpers/errors/bad-request-error';

export const webhookRequestValidator = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { body } = req;

    if (!body) {
      logger.warn({
        errorCode: ErrorCode.INVALID_INPUT,
        description: 'body is required.',
        location: 'webhookValidator.webhookRequestValidator',
      });

      throw new BadRequestError({
        code: ErrorCode.INVALID_INPUT,
        message: 'body is required.',
      });
    }

    if (!body.destination) {
      logger.warn({
        errorCode: ErrorCode.INVALID_INPUT,
        description: 'destination is required.',
        location: 'webhookValidator.webhookRequestValidator',
      });

      throw new BadRequestError({
        code: ErrorCode.INVALID_INPUT,
        message: 'destination is required.',
      });
    }

    if (!Array.isArray(body.events)) {
      logger.warn({
        errorCode: ErrorCode.INVALID_INPUT,
        description: 'events must be an array.',
        location: 'webhookValidator.webhookRequestValidator',
      });

      throw new BadRequestError({
        code: ErrorCode.INVALID_INPUT,
        message: 'events must be an array.',
      });
    }

    next();
  };
};
