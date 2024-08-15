import { posix } from "@jinder/path";
import { fileURLToPath } from "node:url";

const {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve
} = posix;

export {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve
};

export function toPosixPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function toPosixBuffer(buffer: Buffer): Buffer {
  return Buffer.from(toPosixPath(buffer.toString()));
}

export function getFilename(importMetaUrl: string): string {
  return toPosixPath(fileURLToPath(importMetaUrl));
}

export function getDirname(importMetaUrl: string): string {
  return dirname(getFilename(importMetaUrl));
}
