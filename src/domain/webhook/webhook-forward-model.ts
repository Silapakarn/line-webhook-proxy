import { WebhookForwardResult } from './webhook-forward-response';

export class WebhookForwardModel {
  constructor(public readonly results: WebhookForwardResult[]) {}

  get allFailed(): boolean {
    return this.results.every((r) => r.status === 0);
  }

  get hasFailures(): boolean {
    return this.results.some((r) => r.status === 0);
  }

  get failedDownstreams(): string[] {
    return this.results.filter((r) => r.status === 0).map((r) => r.downstream);
  }

  get successDownstreams(): string[] {
    return this.results.filter((r) => r.status !== 0).map((r) => r.downstream);
  }
}
