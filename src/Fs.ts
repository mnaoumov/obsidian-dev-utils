import type {
  Dirent,
  ObjectEncodingOptions,
  PathLike
} from "node:fs";
import { readdir } from "node:fs/promises";
import { toPosixBuffer, toPosixPath } from "./Path.ts";

type StringResultOptions = undefined | ObjectEncodingOptions & {
  withFileTypes?: false;
  recursive?: boolean;
};

type BufferResultOptions = "buffer" | {
  encoding: "buffer";
  withFileTypes?: false;
  recursive?: boolean;
};

type DirentResultOptions = ObjectEncodingOptions & {
  withFileTypes: true;
  recursive?: boolean;
};

type CommonOptions = {
  encoding?: BufferEncoding | "buffer";
  withFileTypes?: boolean;
}

export async function readdirPosix(path: PathLike, options?: StringResultOptions): Promise<string[]>;
export async function readdirPosix(path: PathLike, options: BufferResultOptions): Promise<Buffer[]>;
export async function readdirPosix(path: PathLike, options: DirentResultOptions): Promise<Dirent[]>;
export async function readdirPosix(
  path: PathLike,
  options: StringResultOptions | BufferResultOptions | DirentResultOptions = {}
): Promise<string[] | Buffer[] | Dirent[]> {
  if (isStringResultOptions(options)) {
    const paths = await readdir(path, options)
    return paths.map(toPosixPath);
  }

  if (isBufferResultOptions(options)) {
    const buffers = await readdir(path, options);
    return buffers.map(toPosixBuffer);
  }

  const dirents = await readdir(path, options);
  for (const dirent of dirents) {
    dirent.name = toPosixPath(dirent.name);
    dirent.parentPath = toPosixPath(dirent.parentPath);
  }

  return dirents;
}

function isStringResultOptions(options: StringResultOptions | BufferResultOptions | DirentResultOptions): options is StringResultOptions {
  if (options === undefined) {
    return true;
  }

  if (options === "buffer") {
    return false;
  }

  const commonOptions = options as CommonOptions;

  if (commonOptions.encoding === "buffer") {
    return false;
  }

  if (commonOptions.withFileTypes === true) {
    return false;
  }

  return true;
}

function isBufferResultOptions(options: StringResultOptions | BufferResultOptions | DirentResultOptions): options is BufferResultOptions {
  if (options === undefined) {
    return false;
  }

  if (options === "buffer") {
    return true;
  }

  const commonOptions = options as CommonOptions;

  if (commonOptions.withFileTypes === true) {
    return false;
  }

  if (commonOptions.encoding !== "buffer") {
    return false;
  }

  return true;
}
