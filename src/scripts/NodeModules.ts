// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export { spawn } from 'node:child_process';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export { existsSync } from 'node:fs';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export type {
  Dirent,
  ObjectEncodingOptions,
  PathLike
} from 'node:fs';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export { createRequire } from 'node:module';

// eslint-disable-next-line import-x/no-nodejs-modules
import process from 'node:process';

// eslint-disable-next-line eslint-plugin-tsdoc-required/tsdoc-required
export { process };

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export { createInterface } from 'node:readline/promises';

// eslint-disable-next-line import-x/no-nodejs-modules, eslint-plugin-tsdoc-required/tsdoc-required
export { fileURLToPath } from 'node:url';
