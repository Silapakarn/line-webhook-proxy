import { ErrorCode } from './enum/error-code';
import { BadRequestError } from './errors/bad-request-error';
import { InternalError } from './errors/internal-error';
import { NotFoundError } from './errors/not-found-error';
import { UnauthorizedError } from './errors/unauthorized-error';

export function handleHttpError(error: any) {
  if (error.response) {
    switch (error.response.status) {
      case 400:
        return new BadRequestError({
          code: ErrorCode.INVALID_INPUT,
          message: error.response.data.message,
        });
      case 401:
        return new UnauthorizedError({
          code: ErrorCode.UNAUTHORIZED,
          message: error.response.data.message,
        });
      case 404:
        return new NotFoundError({
          code: ErrorCode.NOT_FOUND,
          message: error.response.data.message,
        });
      case 500:
        return new InternalError({
          code: ErrorCode.INTERNAL_ERROR,
          message: error.response.data.message,
        });
      default:
        return new InternalError({
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
        });
    }
  }
}
