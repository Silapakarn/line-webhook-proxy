export interface BaseErrorResponse {
  code: string;
  message: string;
}

export abstract class CustomError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number) {
    super();
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }

  abstract getSchema(): BaseErrorResponse;
}
