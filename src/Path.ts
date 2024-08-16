import { posix } from "@jinder/path";
import { fileURLToPath } from "node:url";
import { ensureStartsWith } from "./String.ts";

const {
  basename,
  dirname,
  extname,
  join,
  relative,
} = posix;

export {
  basename,
  dirname,
  extname,
  join,
  relative,
};

export function resolve(...paths: string[]): string {
  let path = posix.resolve(...paths);
  path = toPosixPath(path);
  const match = path.match(/.:[^:]*$/);
  return match?.[0] ?? path;
}

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

export function normalizeIfRelative (path: string): string {
  if (path[0] === "/" || path.includes(":")) {
    return path;
  }

  return ensureStartsWith(path, "./");
}
