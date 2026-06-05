export type ForwardHeaders = Record<string, string | string[] | undefined>;

export interface DownstreamResult {
  status: number;
  latencyMs: number;
}

export interface IDownstreamAdapter {
  readonly name: string;
  forward(rawBody: string, headers: ForwardHeaders): Promise<DownstreamResult>;
}
