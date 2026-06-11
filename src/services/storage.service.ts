import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? '',
        secretAccessKey: process.env.S3_SECRET_KEY ?? '',
      },
    });
  }
  return client;
}

function publicBaseUrl(): string {
  return (
    process.env.S3_PUBLIC_BASE_URL ??
    `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`
  );
}

export async function uploadVideo(
  buffer: Buffer,
  mimetype: string,
  orgId: string
): Promise<string> {
  const key = `uploads/${orgId}/${randomUUID()}.mp4`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );

  return `${publicBaseUrl()}/${key}`;
}
