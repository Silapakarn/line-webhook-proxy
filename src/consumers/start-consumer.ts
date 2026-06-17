import { WebhookConsumer } from './webhook-consumer'
import { logger } from '../helpers/Logger/logger'

// KAFKA_TOPICS is comma-separated — e.g. "line.message,line.postback"
const rawTopics = process.env.KAFKA_TOPICS ?? process.env.KAFKA_TOPIC ?? 'line.message'
const topics = rawTopics.split(',').map((t) => t.trim()).filter(Boolean)

const config = {
  groupId:              process.env.KAFKA_GROUP_ID        ?? 'default-consumer',
  brokers:             (process.env.KAFKA_BROKERS         ?? 'localhost:9092').split(','),
  topics,
  clientId:             process.env.KAFKA_CLIENT_ID       ?? 'webhook-consumer',
  downstreamUrl:        process.env.DOWNSTREAM_URL        ?? 'http://localhost:3001/webhook',
  downstreamName:       process.env.DOWNSTREAM_NAME       ?? 'unknown',
  downstreamTimeoutMs: Number(process.env.DOWNSTREAM_TIMEOUT_MS ?? '5000'),
  maxRetries:          Number(process.env.CONSUMER_MAX_RETRIES  ?? '5'),
}

const consumer = new WebhookConsumer(config)

const shutdown = async (signal: string) => {
  logger.info({ event: 'consumer.shutdown', signal })
  await consumer.stop()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

consumer.start().catch((err) => {
  logger.error({ event: 'consumer.fatal', error: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
