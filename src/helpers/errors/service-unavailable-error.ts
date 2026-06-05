import HttpStatusCode from 'http-status-codes';
import { ErrorCode } from '../enum/error-code';
import { BaseErrorResponse, CustomError } from './custom-error';

export interface ServiceUnavailableErrorMap {
  code: ErrorCode;
  message?: string;
}

export class ServiceUnavailableError extends CustomError {
  private _code: ErrorCode;
  private _message: string;

  constructor(errorMap: ServiceUnavailableErrorMap) {
    super(HttpStatusCode.SERVICE_UNAVAILABLE);
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
