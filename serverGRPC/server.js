// server.js (ESM)

import "dotenv/config";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import { initKafkaProducer } from "./kafka/kafkaProducer.js";
import { publishChunk } from "./kafka/chunkPublisher.js";
import { splitIntoChunks } from "./utils/chunker.js";

// __dirname equivalente en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.resolve(__dirname, "./protos/storage.proto");

const PROTO_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const packageDefinition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
const storageProto = grpc.loadPackageDefinition(packageDefinition).filestorage;

/* -------------------- UPLOAD FILE LOGIC -------------------- */

async function uploadFile(call, callback) {
  const chunks = [];
  let fileName = null;

  call.on("data", (chunk) => {
    if (!fileName && chunk.fileName) {
      fileName = chunk.fileName;
    }
    if (chunk.fileData) {
      chunks.push(chunk.fileData);
    }
  });

  call.on("end", async () => {
    if (!fileName) {
      return callback(new Error("File name not provided"));
    }

    // Buffer completo del archivo
    const buffer = Buffer.concat(chunks);

    // Se divide en chunks de 16MB
    const fileChunks = splitIntoChunks(buffer);
    const totalChunks = fileChunks.length;

    // ID único del archivo
    const fileId = crypto.randomUUID();

    console.log(`Archivo recibido: ${fileName}`);
    console.log(`Chunks generados: ${totalChunks}`);

    // Enviar cada chunk a Kafka
    for (let i = 0; i < totalChunks; i++) {
      await publishChunk(fileId, i, totalChunks, fileChunks[i]);
    }

    callback(null, {
      message: `Archivo '${fileName}' procesado en ${totalChunks} chunks`,
      fileId,
    });
  });
}

/* -------------------- DOWNLOAD FILE (AÚN NO IMPLEMENTADO) -------------------- */
function downloadFile(call) {
  call.emit("error", new Error("Download no implementado aún"));
}

/* -------------------- MAIN -------------------- */

async function main() {
  await initKafkaProducer();

  const server = new grpc.Server();
  server.addService(storageProto.FileStorage.service, {
    uploadFile,
    downloadFile,
  });

  server.bindAsync(
    "0.0.0.0:5000",
    grpc.ServerCredentials.createInsecure(),
    () => {
      console.log("gRPC server corriendo en puerto 5000");
    }
  );
}

main();
