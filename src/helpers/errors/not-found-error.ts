import HttpStatusCode from 'http-status-codes';
import { ErrorCode } from '../enum/error-code';
import { BaseErrorResponse, CustomError } from './custom-error';

export interface NotFoundErrorMap {
  code: ErrorCode;
  message?: string;
}

export class NotFoundError extends CustomError {
  private _code: ErrorCode;
  private _message: string;

  constructor(errorMap: NotFoundErrorMap) {
    super(HttpStatusCode.NOT_FOUND);
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
