export type ForwardHeaders = Record<string, string | string[] | undefined>;

export interface KafkaAdapterResult {
  status: number;
  latencyMs: number;
}

export interface IKafkaAdapter {
  readonly name: string;
  forward(rawBody: string, headers: ForwardHeaders): Promise<KafkaAdapterResult>;
}

export interface Topic {
  message: IKafkaAdapter;   // topic: line.message
  postback: IKafkaAdapter;  // topic: line.postback
  fallback: IKafkaAdapter;  // topic: line.event
}
