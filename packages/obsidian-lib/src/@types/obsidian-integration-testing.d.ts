/**
 * @file
 *
 * Augments the `obsidian-integration-testing` `Lib` interface with the entire flat
 * `obsidian-dev-utils` surface (the generated `__merged` barrel), so an `evalInObsidian` closure can
 * reach any library helper as `lib.<helper>`. The runtime side is registered by the published
 * `obsidian-dev-utils/integration-test-setup` endpoint via `registerLibResolver`; this file supplies the
 * matching types.
 *
 * A consumer plugin activates it with a triple-slash reference in a `.d.ts` its `tsconfig.json` already
 * includes:
 *
 * ```ts
 * /// <reference types="obsidian-dev-utils/@types/obsidian-integration-testing" />
 * ```
 *
 * Without that the augmentation is inert there and `lib.<helper>` fails to compile. A
 * `compilerOptions.types` entry naming the same path does NOT work — it resolves without complaint but
 * never brings the augmentation into the program (verified against `moduleResolution: node16`).
 */

export {};

declare module 'obsidian-integration-testing' {
  interface Lib extends MergedLib {}
}

type MergedLib = typeof import('../__merged.ts');
