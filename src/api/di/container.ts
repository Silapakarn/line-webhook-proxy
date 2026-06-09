import _ from 'lodash';
import { DownstreamAdapter } from '../../infrastructures/adapters/downstream.adapter';
import { WebhookService } from '../../application/webhook/webhook.service';
import { WebhookController } from '../controllers/webhook.controller';
import { ConfigService } from 'src/config/service';

export enum ProviderName {
  CONFIG_SERVICE = 'config',
  WEBHOOK_CONTROLLER = 'controller.webhook',
  WEBHOOK_SERVICE = 'service.webhook',
}

export default class Container {
  constructor(private readonly instances: any) {}

  public static async initialize(): Promise<Container> {
    const instance: any = {};
    const registerInstance = this.register(instance);

    // Config
    const configService = new ConfigService();

    // Adapters — one instance per downstream config entry
    const downstreamAdapters = configService.getDownstreamConfigs().map((c) => new DownstreamAdapter(c));

    // Service
    const webhookService = new WebhookService(downstreamAdapters);

    // Controller
    const webhookController = new WebhookController(webhookService);

    registerInstance(ProviderName.CONFIG_SERVICE, configService);
    registerInstance(ProviderName.WEBHOOK_SERVICE, webhookService);
    registerInstance(ProviderName.WEBHOOK_CONTROLLER, webhookController);

    return new Container(instance);
  }

  private static register(accumInstance: any) {
    return (name: ProviderName, instance: any): void => {
      _.set(accumInstance, name, instance);
    };
  }

  public getInstance(name: ProviderName) {
    const instance = _.get(this.instances, name);

    if (_.isNil(instance)) {
      throw new Error(`instance: ${name} not found, please register the instance first`);
    }

    const bindAll = () => {
      Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
        .filter((method) => method !== 'constructor' && typeof instance[method] === 'function')
        .forEach((method) => (instance[method] = instance[method].bind(instance)));
    };

    bindAll();

    return instance;
  }
}
