import HttpStatusCode from 'http-status-codes';
import { ErrorCode } from '../enum/error-code';
import { BaseErrorResponse, CustomError } from './custom-error';

export interface UnauthorizedErrorMap {
  code: ErrorCode;
  message?: string;
}

export class UnauthorizedError extends CustomError {
  private _code: ErrorCode;
  private _message: string;

  constructor(errorMap: UnauthorizedErrorMap) {
    super(HttpStatusCode.UNAUTHORIZED);
    this._code = errorMap.code;
    this._message = errorMap.message || '';
  }

  public getSchema(): BaseErrorResponse {
    return {
      code: this._code,
      message: this._message,
    };
  }
}
