/**
 * @file
 *
 * The lifecycle broadcast every {@link PluginBase} makes: `obsidian-dev-utils:plugin-loaded` when it has
 * finished loading and `obsidian-dev-utils:plugin-unloaded` when it goes away.
 *
 * Obsidian gives a plugin no way to learn that ANOTHER plugin was enabled or disabled — there is no such
 * event on `app.plugins`, and a plugin's own `Events` source cannot help a listener that does not yet hold
 * the instance. So the broadcast goes through `app.workspace`, which is one object every plugin in the
 * vault can reach. Deliberately NOT the `globalThis.__obsidianDevUtils` bag the rest of the library shares
 * its state through: a listener there needs its own copy of this library, and these events are meant to be
 * consumable by any plugin at all.
 *
 * The names are past tense because a broadcast states something that has already happened. `loaded` in
 * particular carries a guarantee: it is triggered only after every API the plugin declares has been
 * published, so a listener may call them immediately.
 *
 * Both the event names and {@link PluginLifecycleEventPayload} are a CROSS-VERSION CONTRACT. Copies of
 * this library at different versions publish and consume them side by side in one vault, so neither may
 * change incompatibly: plain data only, and new payload fields only ever added.
 *
 * That contract is also PUBLISHED, as of the `Plugin API protocol` guide: third-party plugins that will
 * never install this library are told to hardcode these two strings and this payload shape. Publishing it
 * added no new constraint — the cross-copy one above already forbade every change an outsider could
 * notice — but it does mean a rename is now doubly unavailable. The `obsidian-dev-utils:` prefix names the
 * library rather than the subject, which is a wart, and a permanent one: a neutral alias would not retire
 * the old name (already-released plugins emit only it), so it would leave every correct consumer listening
 * for both, forever.
 */

import type { App } from 'obsidian';

/**
 * The name of either lifecycle event.
 */
export type PluginLifecycleEventName = typeof PLUGIN_LOADED_EVENT_NAME | typeof PLUGIN_UNLOADED_EVENT_NAME;

/**
 * The payload of {@link PLUGIN_LOADED_EVENT_NAME} and {@link PLUGIN_UNLOADED_EVENT_NAME}.
 *
 * Plain data by design — no class instances and no types owned by this library — because it crosses
 * between independently bundled copies of it, and between plugins that do not use it at all.
 */
export interface PluginLifecycleEventPayload {
  /**
   * The contract versions the plugin published, empty when it publishes no API.
   *
   * An array rather than a single version because a provider may publish several contract versions side by
   * side, so consumers pinned to an older range keep working across a breaking change.
   *
   * The API objects themselves are deliberately NOT here. A handle delivered by a one-shot event is a
   * probe: it answers "now" and never says when "now" changed, and one that outlives the provider is
   * exactly the stale handle the plugin-api registry's revocable handles exist to prevent. Reach the API
   * through `watchPluginApi` instead, whose reference stays correct across unload and re-enable.
   */
  readonly apiVersions: readonly string[];

  /**
   * The ids of the plugins this one declares as mandatory dependencies, empty when it declares none.
   *
   * Present so the relationship can be read from the OTHER end: a provider has no way to ask who depends
   * on it — the registry only answers consumer-to-provider — and "which installed plugins need this one"
   * is what lets a provider's settings tab tell the user why it is in their vault at all.
   */
  readonly dependencyPluginIds: readonly string[];

  /**
   * The plugin's `manifest.id`.
   */
  readonly pluginId: string;

  /**
   * The plugin's `manifest.name`, for display.
   */
  readonly pluginName: string;

  /**
   * The plugin's `manifest.version`.
   */
  readonly pluginVersion: string;
}

/**
 * Parameters for {@link triggerPluginLifecycleEvent}.
 */
export interface TriggerPluginLifecycleEventParams {
  /**
   * The Obsidian app instance whose workspace carries the broadcast.
   */
  readonly app: App;

  /**
   * The event to trigger.
   */
  readonly name: PluginLifecycleEventName;

  /**
   * The payload describing the plugin.
   */
  readonly payload: PluginLifecycleEventPayload;
}

/**
 * Triggered once a plugin has finished loading AND published every API it declares, so a listener may call
 * those APIs immediately.
 *
 * Namespaced by the package name rather than by an abbreviation of it: the event is global to the vault
 * and aimed at plugin authors who have never heard of this library, so the prefix has to identify itself.
 */
export const PLUGIN_LOADED_EVENT_NAME = 'obsidian-dev-utils:plugin-loaded';

/**
 * Triggered as a plugin unloads — whether the user disabled it, uninstalled it, or Obsidian is shutting
 * down. Its APIs are revoked by the time a listener runs.
 */
export const PLUGIN_UNLOADED_EVENT_NAME = 'obsidian-dev-utils:plugin-unloaded';

declare module 'obsidian' {
  interface Workspace {
    /**
     * Subscribes to a plugin finishing its load, or to one unloading.
     *
     * @param name - Should be {@link PLUGIN_LOADED_EVENT_NAME} or {@link PLUGIN_UNLOADED_EVENT_NAME}.
     * @param callback - The callback receiving the plugin's payload.
     * @param context - The context passed as `this` to the `callback` function.
     * @returns The event reference.
     */
    on(name: PluginLifecycleEventName, callback: (payload: PluginLifecycleEventPayload) => unknown, context?: unknown): EventRef;
  }
}

/**
 * Triggers one of the two lifecycle events on the app's workspace.
 *
 * A thin typed wrapper over `Workspace.trigger`, which accepts any event name and any arguments, so that
 * the one place a payload is constructed is checked against {@link PluginLifecycleEventPayload}.
 *
 * @param params - The {@link TriggerPluginLifecycleEventParams}.
 */
export function triggerPluginLifecycleEvent(params: TriggerPluginLifecycleEventParams): void {
  params.app.workspace.trigger(params.name, params.payload);
}
