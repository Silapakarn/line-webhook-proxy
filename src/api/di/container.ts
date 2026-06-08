import _ from 'lodash';
import { CiscoDownstreamAdapter } from '../../infrastructures/adapters/cisco-downstream.adapter';
import { ServiceADownstreamAdapter } from '../../infrastructures/adapters/service-a-downstream.adapter';
import { WebhookService } from '../../application/webhook/webhook.service';
import { WebhookController } from '../controllers/webhook.controller';
import { ConfigService } from 'src/config/service';

export enum ProviderName {
  // Config
  CONFIG_SERVICE = 'config',

  // Controller
  WEBHOOK_CONTROLLER = 'controller.webhook',

  // Service
  WEBHOOK_SERVICE = 'service.webhook',

  // Adapter
  CISCO_DOWNSTREAM_ADAPTER = 'adapter.ciscoDownstream',
  SERVICE_A_DOWNSTREAM_ADAPTER = 'adapter.serviceADownstream',
}

export default class Container {
  constructor(private readonly instances: any) {}

  public static async initialize(): Promise<Container> {
    const instance: any = {};
    const registerInstance = this.register(instance);

    // Config
    const configService = new ConfigService();

    // Adapter
    const ciscoAdapter = new CiscoDownstreamAdapter(configService.getDownstreamConfig());
    const serviceAAdapter = new ServiceADownstreamAdapter(configService.getServiceADownstreamConfig());

    // Service
    const webhookService = new WebhookService([ciscoAdapter, serviceAAdapter]);

    // Controller
    const webhookController = new WebhookController(webhookService);

    registerInstance(ProviderName.CONFIG_SERVICE, configService);
    registerInstance(ProviderName.CISCO_DOWNSTREAM_ADAPTER, ciscoAdapter);
    registerInstance(ProviderName.SERVICE_A_DOWNSTREAM_ADAPTER, serviceAAdapter);
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
