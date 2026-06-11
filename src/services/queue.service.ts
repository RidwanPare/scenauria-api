// Publication de tâches Celery (protocol v2) via Redis — broker du worker Python.
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
  }
  return redis;
}

const CELERY_QUEUE = 'celery';
const TASK_NAME = 'workers.process_capture';

export async function enqueueProcessCapture(
  captureId: string,
  placeId: string,
  videoUrl: string
): Promise<string> {
  const taskId = randomUUID();
  const args = [captureId, placeId, videoUrl];

  const body = Buffer.from(
    JSON.stringify([args, {}, { callbacks: null, errbacks: null, chain: null, chord: null }]),
    'utf-8'
  ).toString('base64');

  const message = {
    body,
    'content-encoding': 'utf-8',
    'content-type': 'application/json',
    headers: {
      lang: 'py',
      task: TASK_NAME,
      id: taskId,
      root_id: taskId,
      parent_id: null,
      group: null,
      argsrepr: JSON.stringify(args),
      kwargsrepr: '{}',
      origin: 'scenauria-api',
      retries: 0,
      timelimit: [null, null],
      expires: null,
      eta: null,
    },
    properties: {
      correlation_id: taskId,
      reply_to: '',
      delivery_mode: 2,
      delivery_info: { exchange: '', routing_key: CELERY_QUEUE },
      priority: 0,
      body_encoding: 'base64',
      delivery_tag: randomUUID(),
    },
  };

  await getRedis().lpush(CELERY_QUEUE, JSON.stringify(message));
  return taskId;
}
