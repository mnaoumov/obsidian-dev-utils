export { existsSync } from 'node:fs';
export {
  cp,
  mkdir,
  rm
} from 'node:fs/promises';
export {
  readFile,
  writeFile
} from 'node:fs/promises';
import process from 'node:process';
export { process };
export { spawn } from 'node:child_process';
export type {
  Dirent,
  ObjectEncodingOptions,
  PathLike
} from 'node:fs';
export { readdir } from 'node:fs/promises';
export { createRequire } from 'node:module';
export { createInterface } from 'node:readline/promises';
export { fileURLToPath } from 'node:url';
