import path from 'path';
import dotenv from 'dotenv';
import _ from 'lodash';

export interface LineConfig {
  channelSecret: string;
  channelAccessToken: string;
}

export interface DownstreamConfig {
  name: string;
  url: string;
  timeoutMs: number;
}

interface Config {
  line: LineConfig;
  downstreams: DownstreamConfig[];
}

enum EnvironmentVariable {
  LINE_CHANNEL_SECRET = 'LINE_CHANNEL_SECRET',
  LINE_CHANNEL_ACCESS_TOKEN = 'LINE_CHANNEL_ACCESS_TOKEN',
  DOWNSTREAM_URL = 'DOWNSTREAM_URL',
  DOWNSTREAM_TIMEOUT_MS = 'DOWNSTREAM_TIMEOUT_MS',
  SERVICE_A_DOWNSTREAM_URL = 'SERVICE_A_DOWNSTREAM_URL',
  SERVICE_A_DOWNSTREAM_TIMEOUT_MS = 'SERVICE_A_DOWNSTREAM_TIMEOUT_MS',
  SERVICE_B_DOWNSTREAM_URL = 'SERVICE_B_DOWNSTREAM_URL',
  SERVICE_B_DOWNSTREAM_TIMEOUT_MS = 'SERVICE_B_DOWNSTREAM_TIMEOUT_MS',
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
      downstreams: [
        {
          name: 'cisco-mock-receiver',
          url: this._getEnv(EnvironmentVariable.DOWNSTREAM_URL) ?? 'http://localhost:3001/webhook',
          timeoutMs: _.toNumber(this._getEnv(EnvironmentVariable.DOWNSTREAM_TIMEOUT_MS)) || 5000,
        },
        {
          name: 'service-a',
          url: this._getEnv(EnvironmentVariable.SERVICE_A_DOWNSTREAM_URL) ?? 'http://localhost:3002/webhook',
          timeoutMs: _.toNumber(this._getEnv(EnvironmentVariable.SERVICE_A_DOWNSTREAM_TIMEOUT_MS)) || 5000,
        },
        {
          name: 'service-b',
          url: this._getEnv(EnvironmentVariable.SERVICE_B_DOWNSTREAM_URL) ?? 'http://localhost:3003/webhook',
          timeoutMs: _.toNumber(this._getEnv(EnvironmentVariable.SERVICE_B_DOWNSTREAM_TIMEOUT_MS)) || 5000,
        },
      ],
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

  public getDownstreamConfigs(): DownstreamConfig[] {
    return this._configuration.downstreams;
  }
}
