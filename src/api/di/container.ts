import _ from 'lodash';
import { Kafka, Producer } from 'kafkajs';
import { KafkaAdapter } from '../../infrastructures/adapters/kafka.adapter';
import { KafkaService } from '../../application/kafka/kafka.service';
import { WebhookService } from '../../application/webhook/webhook.service';
import { WebhookController } from '../controllers/webhook.controller';
import { ConfigService } from '../../config/service';

export enum ProviderName {
  CONFIG_SERVICE = 'config',
  WEBHOOK_CONTROLLER = 'controller.webhook',
  WEBHOOK_SERVICE = 'service.webhook',
  KAFKA_PRODUCER = 'kafka.producer',
}

export default class Container {
  constructor(private readonly instances: any) {}

  public static async initialize(): Promise<Container> {
    const instance: any = {};
    const registerInstance = this.register(instance);

    const configService = new ConfigService();
    const kafkaConfig = configService.getKafkaConfig();

    const kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
      retry: { initialRetryTime: 300, retries: 8 },
    });

    const producer: Producer = kafka.producer();
    await producer.connect();

    // One KafkaAdapter per topic — adapter.name is used for logging
    const adapters = {
      message:  new KafkaAdapter(producer, kafkaConfig.topics.message,  kafkaConfig.topics.message),
      postback: new KafkaAdapter(producer, kafkaConfig.topics.postback, kafkaConfig.topics.postback),
      fallback: new KafkaAdapter(producer, kafkaConfig.topics.fallback, kafkaConfig.topics.fallback),
    };

    const kafkaService = new KafkaService(adapters);
    const webhookService = new WebhookService(kafkaService);
    const webhookController = new WebhookController(webhookService);

    registerInstance(ProviderName.CONFIG_SERVICE, configService);
    registerInstance(ProviderName.KAFKA_PRODUCER, producer);
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
