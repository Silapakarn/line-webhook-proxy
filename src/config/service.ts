import path from 'path';
import dotenv from 'dotenv';
import _ from 'lodash';

export interface LineConfig {
  channelSecret: string;
  channelAccessToken: string;
}

export interface DownstreamConfig {
  url: string;
  timeoutMs: number;
}

interface Config {
  line: LineConfig;
  downstream: DownstreamConfig;
}

enum EnvironmentVariable {
  LINE_CHANNEL_SECRET = 'LINE_CHANNEL_SECRET',
  LINE_CHANNEL_ACCESS_TOKEN = 'LINE_CHANNEL_ACCESS_TOKEN',
  DOWNSTREAM_URL = 'DOWNSTREAM_URL',
  DOWNSTREAM_TIMEOUT_MS = 'DOWNSTREAM_TIMEOUT_MS',
}

export class ConfigService {
  private _configuration: Config;

  constructor() {
    this._preload();

    this._configuration = (() => {
      return {
        line: {
          channelSecret: this._getEnv(EnvironmentVariable.LINE_CHANNEL_SECRET),
          channelAccessToken: this._getEnv(EnvironmentVariable.LINE_CHANNEL_ACCESS_TOKEN),
        },
        downstream: {
          url: this._getEnv(EnvironmentVariable.DOWNSTREAM_URL) ?? 'http://localhost:3001/webhook',
          timeoutMs: _.toNumber(this._getEnv(EnvironmentVariable.DOWNSTREAM_TIMEOUT_MS)) || 5000,
        },
      };
    })();
  }

  private _preload() {
    const env = process.env.ENVIRONMENT ?? 'local';

    const isInterestedEnv = ['local', 'integration-test'].some((interestedEnv) => interestedEnv === env);
    if (isInterestedEnv) {
      const envFilePath = path.resolve(__dirname, `${env}.env`);
      dotenv.config({ path: envFilePath, encoding: 'utf-8' });
    }
  }

  private _getEnv(variable: EnvironmentVariable): any {
    return process.env[variable];
  }

  public getLineConfig(): LineConfig {
    return {
      channelSecret: this._configuration.line.channelSecret,
      channelAccessToken: this._configuration.line.channelAccessToken,
    };
  }

  public getDownstreamConfig(): DownstreamConfig {
    return {
      url: this._configuration.downstream.url,
      timeoutMs: this._configuration.downstream.timeoutMs,
    };
  }
}
