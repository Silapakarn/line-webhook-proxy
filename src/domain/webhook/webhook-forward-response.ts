export interface WebhookForwardResult {
  downstream: string;
  status: number;
  latencyMs: number;
}