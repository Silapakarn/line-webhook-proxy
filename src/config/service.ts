import path from 'path';
import dotenv from 'dotenv';

export interface LineConfig {
  channelSecret: string;
  channelAccessToken: string;
}

export interface KafkaTopics {
  message: string;   // LINE message events  → line.message
  postback: string;  // LINE postback events → line.postback
  fallback: string;  // everything else      → line.event
}

export interface KafkaConfig {
  brokers: string[];
  topics: KafkaTopics;
  clientId: string;
}

interface Config {
  line: LineConfig;
  kafka: KafkaConfig;
}

enum EnvironmentVariable {
  LINE_CHANNEL_SECRET = 'LINE_CHANNEL_SECRET',
  LINE_CHANNEL_ACCESS_TOKEN = 'LINE_CHANNEL_ACCESS_TOKEN',

  // Kafka
  KAFKA_BROKERS = 'KAFKA_BROKERS',
  KAFKA_TOPIC_MESSAGE = 'KAFKA_TOPIC_MESSAGE',
  KAFKA_TOPIC_POSTBACK = 'KAFKA_TOPIC_POSTBACK',
  KAFKA_TOPIC_FALLBACK = 'KAFKA_TOPIC_FALLBACK',
  KAFKA_CLIENT_ID = 'KAFKA_CLIENT_ID',
}

export class ConfigService {
  private _configuration: Config;

  constructor() {
    this._preload();

    this._configuration = {
      line: {
        channelSecret: this._getEnv(EnvironmentVariable.LINE_CHANNEL_SECRET),
        channelAccessToken: this._getEnv(EnvironmentVariable.LINE_CHANNEL_ACCESS_TOKEN),
      },
      kafka: {
        brokers: (this._getEnv(EnvironmentVariable.KAFKA_BROKERS)).split(','),
        topics: {
          message:  this._getEnv(EnvironmentVariable.KAFKA_TOPIC_MESSAGE),
          postback: this._getEnv(EnvironmentVariable.KAFKA_TOPIC_POSTBACK),
          fallback: this._getEnv(EnvironmentVariable.KAFKA_TOPIC_FALLBACK),
        },
        clientId: this._getEnv(EnvironmentVariable.KAFKA_CLIENT_ID),
      },
    };
  }

  private _preload() {
    const env = process.env.ENVIRONMENT ?? 'local';
    const isInterestedEnv = ['local', 'integration-test'].includes(env);
    if (isInterestedEnv) {
      dotenv.config({ path: path.resolve(__dirname, `${env}.env`), encoding: 'utf-8' });
    }
  }

  private _getEnv(variable: EnvironmentVariable): any {
    return process.env[variable];
  }

  public getLineConfig(): LineConfig {
    return { ...this._configuration.line };
  }

  public getKafkaConfig(): KafkaConfig {
    return { ...this._configuration.kafka };
  }
}
