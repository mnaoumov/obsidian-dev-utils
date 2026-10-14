/**
 * @file
 *
 * The debuggers of `@mnaoumov/obsidian-lib`'s own modules.
 */

import { getDebugger } from '@mnaoumov/typescript-lib/debug';
import { Library } from '@mnaoumov/typescript-lib/library';

import { OBSIDIAN_LIBRARY_NAME } from './library.ts';

/**
 * Returns a debugger for one of this library's own modules.
 *
 * The namespace is always under {@link OBSIDIAN_LIBRARY_NAME}, whether or not `initPluginContext` has run yet, so
 * a namespace a guide tells users to enable (`obsidian-dev-utils:PluginApi`) means the same thing in a test, in a
 * script and in a plugin. The generic modules of `@mnaoumov/typescript-lib` log under the namespace
 * `initPluginContext` injects into the generic `Library`, which is the same one once a plugin is up.
 *
 * @param namespace - The namespace within the library's.
 * @returns The debugger.
 */
export function getObsidianLibDebugger(namespace: string): ReturnType<typeof getDebugger> {
  return getDebugger(`${Library.debugPrefixNamespace}${OBSIDIAN_LIBRARY_NAME}:${namespace}`);
}
