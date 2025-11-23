// utils/chunker.js
export const CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB

export function splitIntoChunks(buffer) {
  const chunks = [];
  let offset = 0;

  while (offset < buffer.length) {
    const end = Math.min(offset + CHUNK_SIZE, buffer.length);
    chunks.push(buffer.slice(offset, end));
    offset = end;
  }

  return chunks;
}
