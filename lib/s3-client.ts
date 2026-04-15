import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { GetObjectCommandInput, DeleteObjectCommandInput } from "@aws-sdk/client-s3";
import { PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || "us-east-1";

    if (!endpoint) {
      throw new Error("S3_ENDPOINT environment variable is required for IDrive E2 configuration");
    }

    s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_ACCESS_KEY_SECRET || "",
      },
      forcePathStyle: true,
    });
  }

  return s3Client;
}

export function getS3Bucket(): string {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error("S3_BUCKET_NAME environment variable is required");
  }
  return bucket;
}

export function getS3CDNUrl(): string | null {
  return process.env.S3_CDN_URL || null;
}

export async function generateUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  const bucket = getS3Bucket();

  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  };

  const command = new (await import("@aws-sdk/client-s3")).PutObjectCommand(params);
  return getSignedUrl(client, command, { expiresIn });
}

export async function generateAccessPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  const bucket = getS3Bucket();

  const params: GetObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };

  const command = new GetObjectCommand(params);
  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteS3File(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getS3Bucket();

  const params: DeleteObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };

  const command = new DeleteObjectCommand(params);
  await client.send(command);
}

export function generateAudioKey(
  collection: string,
  itemId: string,
  originalFilename: string
): string {
  const timestamp = Date.now();
  const extension = originalFilename.split(".").pop() || "mp3";
  return `audio/${collection}/${itemId}/${timestamp}.${extension}`;
}

export function isS3Configured(): boolean {
  return !!(
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_ACCESS_KEY_SECRET &&
    process.env.S3_BUCKET_NAME &&
    process.env.S3_ENDPOINT
  );
}
