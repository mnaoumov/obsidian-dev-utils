/**
 * @file
 *
 * Fails the build when a bundled Obsidian plugin cannot even be LOADED on Obsidian mobile.
 *
 * The failure this guards against is invisible on desktop and reads as a mystery on a phone: a module
 * reached while the bundle initializes evaluates a platform-only API, so the plugin dies before any of
 * its code runs. The integration-test harness plugin died exactly that way on Android — the generated
 * barrels imported `desktop-demo-vault-opener.ts`, whose `adm-zip` dependency opens with a top-level
 * `const { randomFillSync } = require('crypto')`, and mobile's `require` hands back `undefined`.
 *
 * The check evaluates the emitted bundle in a `node:vm` context shaped like Obsidian mobile: `require`
 * returns `undefined` for every Node builtin and a permissive stub for the externals the app itself
 * provides (`obsidian`, `electron`, the CodeMirror packages), and `process` is present and
 * renderer-shaped, which is what keeps a runtime-branching dependency such as `debug` on its browser
 * branch there. Loading the bundle that shipped the Android failure reproduces that exact error in
 * milliseconds, so this is a faithful model rather than a proxy for one.
 *
 * It asserts only that module INITIALIZATION survives — nothing is called, so a helper that reaches a
 * Node builtin from inside a function (rule L6's call-time dynamic `import()`) passes, which is the
 * whole point: platform-only work is allowed, evaluating it at load time is not.
 */

import { builtinModules } from 'node:module';
import {
  createContext,
  runInContext
} from 'node:vm';

import { noop } from '../../src/function.ts';

/**
 * Parameters for {@link assertMobileLoadableBundle}.
 */
export interface AssertMobileLoadableBundleParams {
  /**
   * The bundle's path, used to name it in the failure message and as the `filename` of the evaluated
   * script, so the reported stack frames point at real line numbers.
   */
  readonly bundlePath: string;

  /**
   * The bundle's JavaScript source.
   */
  readonly bundleSource: string;
}

/**
 * The `process` shape a webview renderer exposes, which is all a load-time branch ever reads.
 */
interface MobileProcess {
  readonly env: object;
  readonly type: string;
}

/**
 * The globals the stand-in Obsidian mobile context exposes to a loading bundle.
 */
interface MobileSandbox {
  readonly activeDocument: unknown;
  readonly activeWindow: unknown;
  readonly clearInterval: typeof clearInterval;
  readonly clearTimeout: typeof clearTimeout;
  readonly console: Console;
  readonly document: unknown;
  readonly exports: object;
  global: unknown;
  globalThis: unknown;
  readonly module: MobileSandboxModule;
  readonly navigator: unknown;
  readonly process: MobileProcess;
  readonly queueMicrotask: typeof queueMicrotask;
  require(moduleId: string): unknown;
  self: unknown;
  readonly setInterval: typeof setInterval;
  readonly setTimeout: typeof setTimeout;
  window: unknown;
}

/**
 * The CommonJS `module` object a bundle assigns its exports to.
 */
interface MobileSandboxModule {
  exports: object;
}

const NODE_BUILTIN_MODULE_IDS = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleId) => `node:${moduleId}`)
]);

const REPORTED_STACK_FRAME_COUNT = 4;

/**
 * Asserts that the bundle's top level survives on Obsidian mobile.
 *
 * @param params - The {@link AssertMobileLoadableBundleParams}.
 * @throws An {@link Error} naming the bundle and the underlying failure when initialization throws.
 */
export function assertMobileLoadableBundle(params: AssertMobileLoadableBundleParams): void {
  const { bundlePath, bundleSource } = params;

  try {
    runInContext(bundleSource, createMobileContext(), { filename: bundlePath });
  } catch (error) {
    throw new Error(
      `The bundle \`${bundlePath}\` cannot load on Obsidian mobile.\n\n`
        + 'Its top level threw while every Node builtin `require(…)` returned `undefined`, which is what '
        + 'Obsidian mobile hands back:\n'
        + `${formatMobileLoadFailure(error)}\n\n`
        + 'Something reached at bundle-init time evaluates a platform-only API. Every module the generated '
        + 'barrels re-export has to survive being IMPORTED on either platform (rule L5), so defer the '
        + 'offending dependency to a call-time dynamic `import()` — the way `desktop-demo-vault-opener.ts` '
        + 'loads `adm-zip` — and keep the platform-restricted work inside the function that needs it.',
      { cause: error }
    );
  }
}

/**
 * Builds the `node:vm` context that stands in for Obsidian mobile.
 *
 * @returns The `node:vm` context standing in for a phone.
 */
function createMobileContext(): object {
  const sandbox: MobileSandbox = {
    activeDocument: createMobileStub(),
    activeWindow: createMobileStub(),
    clearInterval,
    clearTimeout,
    console,
    document: createMobileStub(),
    exports: {},
    global: null,
    globalThis: null,
    module: { exports: {} },
    navigator: createMobileStub(),
    // Obsidian mobile runs in a webview, so a dependency that branches on `process` at load time (such
    // As `debug`) must take the same branch a renderer does. Leaving `process` out instead sends those
    // Dependencies down their Node path and reports a failure no phone would ever see.
    process: {
      env: {},
      type: 'renderer'
    },
    queueMicrotask,
    require: requireLikeMobile,
    self: null,
    setInterval,
    setTimeout,
    window: null
  };

  // The four aliases every browser global goes by all point back at the sandbox, so they can only be
  // Filled in once it exists.
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window = sandbox;

  return createContext(sandbox);
}

/**
 * Builds a permissive stand-in for a module (or global) the app provides but this check does not model.
 *
 * Every property access, call and construction yields another stand-in, so a bundle may reach as deep
 * into it as it likes at load time without the check inventing a failure the app would not produce.
 *
 * @returns The stand-in.
 */
function createMobileStub(): unknown {
  return new Proxy(noop, {
    apply: (): unknown => createMobileStub(),
    construct: (): object => createMobileStub() as object,
    // `then` must stay `undefined`: a stand-in that answers it looks like a thenable, so awaiting one
    // Would hang instead of resolving.
    get: (_target, property): unknown => property === 'then' ? undefined : createMobileStub(),
    has: (): boolean => true
  });
}

/**
 * Renders the underlying failure, keeping enough stack to name the module that threw.
 *
 * @param error - The value thrown while the bundle initialized.
 * @returns The indented message and its leading stack frames.
 */
function formatMobileLoadFailure(error: unknown): string {
  const stack = error instanceof Error ? error.stack ?? error.message : String(error);
  return stack
    .split('\n')
    .slice(0, REPORTED_STACK_FRAME_COUNT)
    .map((line) => `  ${line.trim()}`)
    .join('\n');
}

/**
 * Resolves a module id the way Obsidian mobile does.
 *
 * @param moduleId - The requested module id.
 * @returns `undefined` for a Node builtin (mobile has none), a permissive stand-in otherwise.
 */
function requireLikeMobile(moduleId: string): unknown {
  return NODE_BUILTIN_MODULE_IDS.has(moduleId) ? undefined : createMobileStub();
}
