/**
 * @file
 *
 * Augments the `obsidian-integration-testing` `Lib` interface with the entire flat
 * `obsidian-dev-utils` surface (the generated `__merged` barrel), so an `evalInObsidian` closure can
 * reach any library helper as `lib.<helper>`. The runtime side is registered by
 * `scripts/integration-test-obsidian-setup.ts` via `registerLibResolver`; this file supplies the
 * matching types.
 */

export {};

declare module 'obsidian-integration-testing' {
  interface Lib extends MergedLib {}
}

type MergedLib = typeof import('../__merged.ts');
