import { Consumer, Kafka, EachMessagePayload } from 'kafkajs';
import axios, { AxiosError } from 'axios';
import { logger } from '../helpers/Logger/logger';

export interface ConsumerConfig {
  groupId: string
  brokers: string[]
  topics: string[]          // subscribe to one or more topics
  clientId: string
  downstreamUrl: string
  downstreamName: string
  downstreamTimeoutMs: number
  maxRetries: number
}

const RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000, 60_000]

export class WebhookConsumer {
  private readonly kafka: Kafka
  private readonly consumer: Consumer
  private readonly dlqProducer

  constructor(private readonly config: ConsumerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      retry: { initialRetryTime: 300, retries: 8 },
    })
    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
    })
    this.dlqProducer = this.kafka.producer()
  }

  async start(): Promise<void> {
    await this.dlqProducer.connect()
    await this.consumer.connect()

    // Subscribe to all configured topics in one call
    await this.consumer.subscribe({
      topics: this.config.topics,
      fromBeginning: false,
    })

    logger.info({
      event: 'consumer.started',
      groupId: this.config.groupId,
      topics: this.config.topics,
      downstream: this.config.downstreamName,
      downstreamUrl: this.config.downstreamUrl,
    })

    await this.consumer.run({
      // Process one message at a time — guarantees ordering per partition
      eachMessage: async (payload: EachMessagePayload) => {
        await this._handleWithRetry(payload)
      },
    })
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect()
    await this.dlqProducer.disconnect()
    logger.info({ event: 'consumer.stopped', groupId: this.config.groupId })
  }

  private async _handleWithRetry(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload
    const rawBody = message.value?.toString() ?? ''
    const envelopeId = message.headers?.['x-envelope-id']?.toString() ?? 'unknown'

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this._deliver(rawBody, envelopeId)
        logger.info({
          event: 'consumer.delivered',
          groupId: this.config.groupId,
          downstream: this.config.downstreamName,
          envelopeId,
          topic,
          partition,
          offset: message.offset,
          attempt,
        })
        return
      } catch (err) {
        const isLastAttempt = attempt === this.config.maxRetries
        if (isLastAttempt) {
          logger.error({
            event: 'consumer.delivery.failed.max-retries',
            groupId: this.config.groupId,
            downstream: this.config.downstreamName,
            envelopeId,
            error: err instanceof Error ? err.message : String(err),
          })
          // DLQ topic = source topic + '-dlq'  (e.g. line.message → line.message-dlq)
          await this._publishToDlq(rawBody, message.headers, envelopeId, `${topic}-dlq`)
          return
        }

        const delayMs = RETRY_DELAYS_MS[attempt] ?? 60_000
        logger.warn({
          event: 'consumer.delivery.retry',
          groupId: this.config.groupId,
          downstream: this.config.downstreamName,
          envelopeId,
          attempt,
          nextRetryMs: delayMs,
          error: err instanceof Error ? err.message : String(err),
        })
        await this._sleep(delayMs)
      }
    }
  }

  private async _deliver(rawBody: string, envelopeId: string): Promise<void> {
    await axios.post(this.config.downstreamUrl, rawBody, {
      timeout: this.config.downstreamTimeoutMs,
      headers: {
        'content-type': 'application/json',
        'x-envelope-id': envelopeId,
        'x-forwarded-from': 'line-webhook-proxy',
      },
    })
  }

  private async _publishToDlq(
    rawBody: string,
    originalHeaders: EachMessagePayload['message']['headers'],
    envelopeId: string,
    dlqTopic: string,
  ): Promise<void> {
    try {
      await this.dlqProducer.send({
        topic: dlqTopic,
        messages: [{
          value: rawBody,
          headers: {
            ...originalHeaders,
            'x-dlq-group': this.config.groupId,
            'x-dlq-downstream': this.config.downstreamName,
            'x-dlq-envelope-id': envelopeId,
            'x-dlq-timestamp': new Date().toISOString(),
          },
        }],
      })
      logger.info({ event: 'consumer.dlq.published', dlqTopic, envelopeId })
    } catch (err) {
      logger.error({
        event: 'consumer.dlq.failed',
        dlqTopic,
        envelopeId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
