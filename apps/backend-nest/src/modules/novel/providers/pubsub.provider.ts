import { Provider } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

export const PUBSUB_TOKEN = Symbol('PUBSUB_TOKEN');

export const PubSubProvider: Provider = {
  provide: PUBSUB_TOKEN,
  useValue: new PubSub(),
};
