import { Client } from "minio";
import dotenv from "dotenv";

dotenv.config();

const primary = new Client({
  endPoint: process.env.MINIO_PRIMARY.split(":")[0],
  port: parseInt(process.env.MINIO_PRIMARY.split(":")[1]),
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
  useSSL: false,
});

const replica = new Client({
  endPoint: process.env.MINIO_REPLICA.split(":")[0],
  port: parseInt(process.env.MINIO_REPLICA.split(":")[1]),
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
  useSSL: false,
});

export const BUCKET = "files";

let isPrimaryHealthy = true;
let isReplicaHealthy = true;

// Health-check de MinIO
async function minioAlive(client) {
  try {
    await client.listBuckets();
    return true;
  } catch {
    return false;
  }
}

// Esto lo consulta el consumer
export function isStorageAvailable() {
  return isPrimaryHealthy || isReplicaHealthy;
}

// Intento de escribir con failover
export async function putWithFailover(objectName, buffer) {
  // PRIMARIO
  if (isPrimaryHealthy) {
    try {
      await primary.putObject(BUCKET, objectName, buffer);
      return { used: "primary" };
    } catch {
      console.log("❌ PRIMARY cayó.");
      isPrimaryHealthy = false;
    }
  }

  // RÉPLICA
  if (isReplicaHealthy) {
    try {
      await replica.putObject(BUCKET, objectName, buffer);
      return { used: "replica" };
    } catch {
      console.log("❌ REPLICA cayó.");
      isReplicaHealthy = false;
    }
  }

  // Sin almacenamiento
  throw new Error("❌ Ningún MinIO disponible.");
}

// Revisión cada 5 segundos
setInterval(async () => {
  const primaryOk = await minioAlive(primary);
  const replicaOk = await minioAlive(replica);

  isPrimaryHealthy = primaryOk;
  isReplicaHealthy = replicaOk;

  if (primaryOk || replicaOk) {
    console.log("📦 Al menos un MinIO está disponible");
  } else {
    console.log("🚫 Ambos MinIO caídos");
  }
}, 5000);
