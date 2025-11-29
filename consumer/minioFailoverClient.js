// minioFailoverClient.js
import { Client } from "minio";
import dotenv from "dotenv";
import { PassThrough } from "stream";

dotenv.config();

function parseHostPort(env) {
  const [host, port] = env.split(":");
  return { host, port: parseInt(port, 10) };
}

const primaryCfg = parseHostPort(process.env.MINIO_PRIMARY);
const replicaCfg = parseHostPort(process.env.MINIO_REPLICA);

export const primary = new Client({
  endPoint: primaryCfg.host,
  port: primaryCfg.port,
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
  useSSL: false,
});

export const replica = new Client({
  endPoint: replicaCfg.host,
  port: replicaCfg.port,
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
  useSSL: false,
});

export const BUCKET = process.env.MINIO_BUCKET || "files";

let isPrimaryHealthy = false;
let isReplicaHealthy = false;
let previousPrimaryHealthy = false;

async function minioAlive(client) {
  try {
    // listBuckets será suficiente como healthcheck ligero
    await client.listBuckets();
    return true;
  } catch (err) {
    return false;
  }
}

export function isStorageAvailable() {
  return isPrimaryHealthy || isReplicaHealthy;
}

/**
 * putWithFailover(objectName, bufferOrStream)
 * Intenta escribir en primary, si falla intenta en replica.
 * Devuelve { used: "primary"|"replica" } o lanza error si ninguno disponible.
 */
export async function putWithFailover(objectName, bufferOrStream) {
  // PRIMARIO (si disponible)
  if (isPrimaryHealthy) {
    try {
      // `putObject` acepta Buffer/Stream
      await primary.putObject(BUCKET, objectName, bufferOrStream);
      return { used: "primary" };
    } catch (err) {
      console.log("❌ PRIMARY putObject fallo, marcando como no disponible:", err.message);
      isPrimaryHealthy = false;
    }
  }

  // RÉPLICA (si disponible)
  if (isReplicaHealthy) {
    try {
      // Si bufferOrStream es stream reutilizable, puede que ya esté consumido.
      // Para seguridad, si nos pasan un stream, lo convertimos en Buffer.
      let payload = bufferOrStream;
      if (isReadableStream(bufferOrStream)) {
        payload = await streamToBuffer(bufferOrStream);
      }
      await replica.putObject(BUCKET, objectName, payload);
      return { used: "replica" };
    } catch (err) {
      console.log("❌ REPLICA putObject fallo, marcando como no disponible:", err.message);
      isReplicaHealthy = false;
    }
  }

  throw new Error("❌ Ningún MinIO disponible.");
}

function isReadableStream(obj) {
  return obj && typeof obj.pipe === "function";
}

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Ensure bucket exists in both storages (tries both).
 */
export async function ensureBucketBoth() {
  try {
    const existsPrimary = await primary.bucketExists(BUCKET).catch(() => false);
    if (!existsPrimary && isPrimaryHealthy) {
      await primary.makeBucket(BUCKET);
      console.log(`✅ Bucket ${BUCKET} creado en primary`);
    }
  } catch (err) {
    // swallow
  }

  try {
    const existsReplica = await replica.bucketExists(BUCKET).catch(() => false);
    if (!existsReplica && isReplicaHealthy) {
      await replica.makeBucket(BUCKET);
      console.log(`✅ Bucket ${BUCKET} creado en replica`);
    }
  } catch (err) {
    // swallow
  }
}

/**
 * Sincroniza objetos de replica -> primary cuando primary vuelve a estar OK.
 * Solo copia objetos que no existan en primary.
 */
async function replicateFromReplicaToPrimary() {
  if (!isReplicaHealthy || !isPrimaryHealthy) return;

  console.log("🔁 Iniciando sincronización: replica -> primary");

  const list = replica.listObjectsV2(BUCKET, "", true);

  const missing = [];

  // recolectar lista de objetos en replica
  for await (const obj of streamAsyncIterator(list)) {
    const objectName = obj.name;
    try {
      // verificar si existe en primary
      const exists = await primary.statObject(BUCKET, objectName).then(() => true).catch(() => false);
      if (!exists) missing.push(objectName);
    } catch (err) {
      // ignore
    }
  }

  if (missing.length === 0) {
    console.log("✅ No hay objetos nuevos en réplica para sincronizar.");
    return;
  }

  console.log(`🔁 Copiando ${missing.length} objetos desde replica hacia primary...`);

  for (const name of missing) {
    try {
      // obtener stream desde replica
      const objectStream = await replica.getObject(BUCKET, name);
      // convertir a buffer para reintento seguro
      const buf = await streamToBuffer(objectStream);

      await primary.putObject(BUCKET, name, buf);
      console.log(`✅ Copiado ${name} -> primary`);
    } catch (err) {
      console.log(`⚠️ Error copiando ${name}:`, err.message);
      // continuar con otros objetos
    }
  }

  console.log("🔁 Sincronización finalizada.");
}

/* Helper para iterar streams event-based (MinIO listObjectsV2) */
function streamAsyncIterator(stream) {
  // stream is event emitter that emits 'data' objects and 'end'
  const q = [];
  let ended = false;
  let error = null;

  stream.on("data", (d) => q.push({ type: "data", val: d }));
  stream.on("end", () => {
    ended = true;
  });
  stream.on("error", (err) => {
    error = err;
  });

  return (async function* () {
    while (!ended || q.length) {
      if (error) throw error;
      if (q.length) {
        const item = q.shift();
        yield item.val;
      } else {
        // wait briefly
        await new Promise((res) => setTimeout(res, 50));
      }
    }
  })();
}

/* --- Health-check loop --- */
async function runHealthChecks() {
  try {
    const primaryOk = await minioAlive(primary);
    const replicaOk = await minioAlive(replica);

    previousPrimaryHealthy = isPrimaryHealthy;
    isPrimaryHealthy = primaryOk;
    isReplicaHealthy = replicaOk;

    if (primaryOk || replicaOk) {
      console.log("📦 Al menos un MinIO está disponible", {
        primary: primaryOk,
        replica: replicaOk,
      });
    } else {
      console.log("🚫 Ambos MinIO caídos");
    }

    // Si primary vuelve de false -> true, iniciar sincronización
    if (!previousPrimaryHealthy && isPrimaryHealthy) {
      // Give a short delay to allow service to fully settle
      setTimeout(() => {
        replicateFromReplicaToPrimary().catch((err) => {
          console.log("⚠️ Error en sincronización inicial:", err.message);
        });
      }, 1000);
    }
  } catch (err) {
    console.log("⚠️ Error en health-check global:", err.message);
  }
}

// correr inmediatamente y cada 5s
runHealthChecks();
setInterval(runHealthChecks, parseInt(process.env.MINIO_HEALTH_INTERVAL_MS || "5000", 10));

export { isPrimaryHealthy, isReplicaHealthy };
