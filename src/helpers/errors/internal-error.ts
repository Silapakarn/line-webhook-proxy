import HttpStatusCode from 'http-status-codes';
import { ErrorCode } from '../enum/error-code';
import { BaseErrorResponse, CustomError } from './custom-error';

export interface InternalErrorMap {
  code: ErrorCode;
  message?: string;
}

export class InternalError extends CustomError {
  private _code: ErrorCode;
  private _message: string;

  constructor(errorMap: InternalErrorMap) {
    super(HttpStatusCode.INTERNAL_SERVER_ERROR);
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
