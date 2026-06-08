export interface LineDeliveryContext {
  isRedelivery: boolean;
}

export interface LineEvent {
  type: string;
  webhookEventId: string;
  deliveryContext: LineDeliveryContext;
}

export interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}
