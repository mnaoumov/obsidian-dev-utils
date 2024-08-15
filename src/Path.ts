import { dirname } from "node:path/posix";
import { fileURLToPath } from "node:url";

export function toPosixPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function toPosixBuffer(buffer: Buffer): Buffer {
  return Buffer.from(toPosixPath(buffer.toString()));
}

export function getFilename(importMetaUrl: string): string {
  return fileURLToPath(importMetaUrl);
}

export function getDirname(importMetaUrl: string): string {
  return dirname(getFilename(importMetaUrl));
}
