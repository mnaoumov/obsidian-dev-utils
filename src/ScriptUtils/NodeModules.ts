/**
 * @packageDocumentation
 *
 * Contains utility functions for Node.js modules.
 */

// eslint-disable-next-line import-x/no-nodejs-modules
import process from 'node:process';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export { spawn } from 'node:child_process';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export {
  existsSync,
  readFileSync,
  statSync,
  watch,
  writeFileSync
} from 'node:fs';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export type {
  Dirent,
  FSWatcher,
  ObjectEncodingOptions,
  PathLike,
  Stats,
  WatchEventType
} from 'node:fs';

// eslint-disable-next-line eslint-plugin-tsdoc-required/tsdoc-required
export { process };

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export {
  builtinModules,
  createRequire,
  Module
} from 'node:module';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export {
  arch,
  endianness,
  tmpdir
} from 'node:os';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export { createInterface } from 'node:readline/promises';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export { fileURLToPath } from 'node:url';
