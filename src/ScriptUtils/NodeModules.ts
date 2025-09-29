/**
 * @packageDocumentation
 *
 * Contains utility functions for Node.js modules.
 */

// eslint-disable-next-line import-x/no-nodejs-modules, import-x/no-namespace -- This is the only file we encapsulate importing Node.js modules.
import * as process from 'node:process';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export {
  createHook,
  executionAsyncId
} from 'node:async_hooks';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export { spawn } from 'node:child_process';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export {
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
  watch,
  writeFileSync
} from 'node:fs';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export type {
  Dirent,
  FSWatcher,
  ObjectEncodingOptions,
  PathLike,
  Stats,
  WatchEventType
} from 'node:fs';

// eslint-disable-next-line eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export { process };

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export {
  builtinModules,
  createRequire,
  Module
} from 'node:module';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export {
  arch,
  endianness,
  tmpdir
} from 'node:os';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export { createInterface } from 'node:readline/promises';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required -- This is the only file we encapsulate importing Node.js modules.
export { fileURLToPath } from 'node:url';
