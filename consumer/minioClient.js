import { Client } from "minio";
import dotenv from "dotenv";

dotenv.config();

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT.split(":")[0],
  port: parseInt(process.env.MINIO_ENDPOINT.split(":")[1]),
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
  useSSL: false,
});

export const BUCKET = "files";

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`✅ Bucket "${BUCKET}" creado`);
  }
}
