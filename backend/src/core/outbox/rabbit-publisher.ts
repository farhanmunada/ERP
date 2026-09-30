import amqp from 'amqplib';
import type { ChannelModel, Channel } from 'amqplib';

import { env } from '../config/env.ts';

export const EVENTS_EXCHANGE = 'erp.events';

// Channel singleton: creating a channel per request races under concurrency (BUG-20260929-02).
let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let connecting: Promise<Channel> | null = null;

async function createChannel(): Promise<Channel> {
  connection = await amqp.connect(env.RABBITMQ_URL);
  connection.on('error', () => {
    channel = null;
    connection = null;
    connecting = null;
  });
  const created = await connection.createChannel();
  await created.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
  channel = created;
  return created;
}

export async function getPublisherChannel(): Promise<Channel> {
  if (channel) return channel;
  if (!connecting) connecting = createChannel();
  return connecting;
}

export async function publishEvent(routingKey: string, payload: unknown): Promise<void> {
  const active = await getPublisherChannel();
  active.publish(EVENTS_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
  });
}

export async function closePublisher(): Promise<void> {
  await channel?.close();
  await connection?.close();
  channel = null;
  connection = null;
  connecting = null;
}
