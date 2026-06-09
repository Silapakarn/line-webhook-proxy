import axios, { AxiosError } from 'axios';
import { IDownstreamAdapter, ForwardHeaders, DownstreamResult } from '../../application/interface/downstream.adapter.interface';
import { DownstreamConfig } from '../../config/service';
import { logger } from '../../helpers/Logger/logger';
import { ErrorCode } from '../../helpers/enum/error-code';
import { InternalError } from '../../helpers/errors/internal-error';

export class DownstreamAdapter implements IDownstreamAdapter {
  readonly name: string;

  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(config: DownstreamConfig) {
    this.name = config.name;
    this.url = config.url;
    this.timeoutMs = config.timeoutMs;
  }

  async forward(rawBody: string, headers: ForwardHeaders): Promise<DownstreamResult> {
    const start = Date.now();

    try {
      const response = await axios.post(this.url, rawBody, {
        headers,
        timeout: this.timeoutMs,
      });

      const latencyMs = Date.now() - start;

      logger.info({
        event: 'downstream.forward.success',
        downstream: this.name,
        url: this.url,
        status: response.status,
        latencyMs,
        requestId: headers['x-request-id'],
      });

      return { status: response.status, latencyMs };
    } catch (error: unknown) {
      const axiosError = error instanceof AxiosError ? error : undefined;
      const latencyMs = Date.now() - start;

      logger.error({
        errorCode: ErrorCode.FORWARDING_FAILED,
        description: `got an error when forwarding to downstream: ${this.name} | Error status: ${axiosError?.response?.status ?? axiosError?.code} | Error message: ${axiosError?.response?.data?.message ?? axiosError?.message}`,
        location: 'downstreamAdapter.forward',
        latencyMs,
      });

      throw new InternalError({
        code: ErrorCode.FORWARDING_FAILED,
        message: `got an error when forwarding to downstream: ${this.name} (${axiosError?.response?.data?.message ?? axiosError?.message})`,
      });
    }
  }
}
