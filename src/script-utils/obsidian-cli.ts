/**
 * @packageDocumentation
 *
 * This module provides utilities for interacting with the Obsidian CLI.
 */

import type { App } from 'obsidian';
// eslint-disable-next-line  import-x/no-namespace -- We need to reference `obsidian` module.
import type * as obsidian from 'obsidian';
import type { Promisable } from 'type-fest';

import type { GenericObject } from '../type-guards.ts';

import { getFunctionExpressionString } from '../function.ts';
import {
  FunctionHandlingMode,
  toJson
} from '../object-utils.ts';
import { trimStart } from '../string.ts';
import { exec } from './exec.ts';

const NO_OUTPUT = '(no output)';

/**
 * Common arguments automatically provided to every {@link evalObsidianCli} callback.
 */
export interface CommonArgs {
  /**
   * The Obsidian {@link App} instance.
   */
  app: App;

  /**
   * The `obsidian` module, resolved at runtime inside the Obsidian process.
   */
  obsidianModule: typeof obsidian;
}

/**
 * Parameters for {@link evalObsidianCli}.
 */
export interface EvalObsidianCliParams<Args extends GenericObject, Result> {
  /**
   * Additional arguments to pass after `app`. Must be JSON-serializable.
   */
  args?: Args;

  /**
   * The function to evaluate in the Obsidian context.
   */
  fn(args: Args & CommonArgs): Promisable<Result>;

  /**
   * The path to the Obsidian vault.
   */
  vaultPath: string;
}

/**
 * Evaluates a function inside the running Obsidian instance
 * via the Obsidian CLI and returns the parsed result.
 *
 * The function receives an args object that includes `app`, `obsidianModule`,
 * and any additional `args` passed by the caller.
 * It is serialized via `toString()` and invoked as an IIFE.
 * The function must be self-contained — closures over local variables will not work.
 * Pass any needed values as `args` — they are JSON-serialized and deserialized on the Obsidian side.
 *
 * The result is `JSON.stringify`'d on the Obsidian side and parsed back.
 *
 * @param params - The parameters for the function to evaluate.
 * @returns A {@link Promise} that resolves to the return value of `fn`.
 */
export async function evalObsidianCli<Args extends GenericObject, Result>(params: EvalObsidianCliParams<Args, Result>): Promise<Result> {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- `fn` can be unbound.
  const { args, fn, vaultPath } = params;

  const argsJson = args ? toJson(args, { functionHandlingMode: FunctionHandlingMode.Full }) : '{}';
  const fnString = getFunctionExpressionString(fn);
  const SLICE_START = 2;
  const randomSuffix = String(Math.random()).slice(SLICE_START);
  const expression = `(async () => {
  const fn${randomSuffix} = ${fnString};
  const obsidianModule${randomSuffix} = await (async () => {
    ${String(getObsidianModulePluginFn)}
    ${String(getObsidianModule)}
    return getObsidianModule();
  })();
  const args${randomSuffix} = ${argsJson};
  const fullArgs${randomSuffix} = Object.assign(args${randomSuffix}, { app: window.app, obsidianModule: obsidianModule${randomSuffix} });
  return JSON.stringify(await fn${randomSuffix}(fullArgs${randomSuffix}));
})()`;
  const resultStr = await exec(['obsidian', 'eval', `code=${expression}`], { cwd: vaultPath, isQuiet: true });
  const resultJson = trimStart(resultStr, '=> ');
  if (resultJson === NO_OUTPUT) {
    return undefined as Result;
  }

  return JSON.parse(resultJson) as Result;
}

/* v8 ignore start -- Serialized via toString() and executed inside the Obsidian process, not in Node. Covered by integration tests. */

/**
 * Injected into the Obsidian process to resolve the `obsidian` module.
 * Uses a cached value on `app` if available, otherwise installs a temporary
 * plugin that calls `require('obsidian')` and caches the result.
 *
 * Must NOT reference any outer scope — it is serialized via `toString()`.
 * `getObsidianModulePluginFn` must be defined in the same scope
 * (the generated IIFE handles this).
 *
 * @returns The `obsidian` module.
 */
async function getObsidianModule(): Promise<typeof obsidian> {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- We need global `app` variable.
  const app = window.app;
  interface ObsidianModuleHolder {
    obsidianModule: typeof obsidian;
  }
  const obsidianModuleHolder = app as Partial<ObsidianModuleHolder>;
  if (obsidianModuleHolder.obsidianModule) {
    return obsidianModuleHolder.obsidianModule;
  }
  const SLICE_START = 2;
  const randomSuffix = String(Math.random()).slice(SLICE_START);
  const tempModuleName = `get-obsidian-module-${randomSuffix}`;
  const dir = `${app.vault.configDir}/plugins/${tempModuleName}`;
  app.plugins.manifests[tempModuleName] = {
    author: '',
    description: '',
    dir,
    id: tempModuleName,
    isDesktopOnly: true,
    minAppVersion: '',
    name: tempModuleName,
    version: ''
  };
  await app.vault.adapter.mkdir(dir);
  await app.vault.adapter.write(`${dir}/main.js`, `(${String(getObsidianModulePluginFn)})();`);
  await app.plugins.loadPlugin(tempModuleName);
  await app.plugins.uninstallPlugin(tempModuleName);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- It will be initialized within `loadPlugin`.
  if (obsidianModuleHolder.obsidianModule) {
    return obsidianModuleHolder.obsidianModule;
  }
  throw new Error('Failed to load obsidian module');
}

/**
 * The body of the temporary plugin that extracts the `obsidian` module.
 * Serialized via `toString()` and written to `main.js` by {@link getObsidianModule}.
 * Must NOT reference any outer scope.
 */
function getObsidianModulePluginFn(): void {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- We need global `app` variable.
  const app = window.app;
  interface ObsidianModuleHolder {
    obsidianModule: typeof obsidian;
  }
  const obsidianModuleHolder = app as Partial<ObsidianModuleHolder>;

  const pluginRequire = require;
  const pluginExports = exports as {
    default: unknown;
  };

  const obsidianModule = pluginRequire('obsidian') as typeof obsidian;
  obsidianModuleHolder.obsidianModule = obsidianModule;
  pluginExports.default = obsidianModule.Plugin;
}

/* v8 ignore stop */
