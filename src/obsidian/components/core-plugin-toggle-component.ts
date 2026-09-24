/**
 * @file
 *
 * Contains class {@link CorePluginToggleComponent} that runs a handler each time a core Obsidian plugin is
 * enabled or disabled.
 */

import type { InternalPluginNameType } from '@obsidian-typings/obsidian-public-latest';
import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import { invokeAsyncSafely } from '../../async.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * Parameters for the {@link CorePluginToggleComponent} constructor.
 */
export interface CorePluginToggleComponentConstructorParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The id of the core plugin to watch, e.g. `InternalPluginName.Canvas`.
   */
  readonly corePluginId: InternalPluginNameType;

  /**
   * Runs each time the core plugin goes from enabled to disabled.
   *
   * @returns A {@link Promise} or `void`. A rejection is reported through the library's async error handling.
   */
  readonly onDisable?: () => Promisable<void>;

  /**
   * Runs each time the core plugin goes from disabled to enabled, and once on load when the core plugin is
   * already enabled then.
   *
   * @returns A {@link Promise} or `void`. A rejection is reported through the library's async error handling.
   */
  readonly onEnable?: () => Promisable<void>;

  /**
   * Whether {@link onDisable} also runs when this component unloads while the core plugin is enabled, so every
   * {@link onEnable} is balanced by one {@link onDisable}. Defaults to `false`: the core plugin did not change,
   * so a consumer that republishes transitions must not see one.
   */
  readonly shouldCallOnDisableOnUnload?: boolean;
}

/**
 * Runs {@link CorePluginToggleComponentConstructorParams.onEnable} / {@link CorePluginToggleComponentConstructorParams.onDisable}
 * on the edges of a core plugin's `enabled` flag.
 *
 * @remarks
 * Obsidian raises `change` on `app.internalPlugins` for every core plugin toggle, with no payload naming which
 * one: `InternalPlugin.enable()` sets `enabled` as its first statement and raises `change` as its last, and
 * `disable()` mirrors that. So a handler reading `enabled` sees the post-transition value, but it also runs
 * for every OTHER core plugin's toggle. This component keeps the last observed value and calls a handler only
 * when the flag actually moved, which is the step a hand-written subscription most easily gets wrong.
 *
 * It replaces patching `onUserEnable` / `onUserDisable` on the core plugin's instance prototype, which every
 * vault shares, and it also catches a toggle that was not driven by the user, which neither hook fires for.
 *
 * A core plugin id this Obsidian version does not know registers nothing.
 *
 * Handlers run synchronously when they are synchronous, so a handler observes the state right after the
 * toggle.
 *
 * @example
 * ```ts
 * this.addChild(new CorePluginToggleComponent({
 *   app: this.app,
 *   corePluginId: InternalPluginName.Canvas,
 *   onDisable: () => {
 *     this.stopIndexingCanvases();
 *   },
 *   onEnable: () => {
 *     this.startIndexingCanvases();
 *   },
 *   shouldCallOnDisableOnUnload: true
 * }));
 * ```
 */
export class CorePluginToggleComponent extends ComponentEx {
  /**
   * The Obsidian app instance.
   */
  protected readonly app: App;

  /**
   * The id of the watched core plugin.
   */
  protected readonly corePluginId: InternalPluginNameType;

  private isCorePluginEnabled = false;
  private readonly onDisable: (() => Promisable<void>) | undefined;
  private readonly onEnable: (() => Promisable<void>) | undefined;
  private readonly shouldCallOnDisableOnUnload: boolean;

  /**
   * Creates a new instance of the {@link CorePluginToggleComponent} class.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: CorePluginToggleComponentConstructorParams) {
    super();
    this.app = params.app;
    this.corePluginId = params.corePluginId;
    this.onDisable = params.onDisable;
    this.onEnable = params.onEnable;
    this.shouldCallOnDisableOnUnload = params.shouldCallOnDisableOnUnload ?? false;
  }

  /**
   * Subscribes to core plugin toggles, and runs the enable handler when the core plugin is already enabled.
   */
  public override onload(): void {
    const corePlugin = this.app.internalPlugins.getPluginById(this.corePluginId);
    if (!corePlugin) {
      return;
    }

    this.isCorePluginEnabled = corePlugin.enabled;

    this.registerEvent(this.app.internalPlugins.on('change', () => {
      const isCorePluginEnabled = corePlugin.enabled;
      if (isCorePluginEnabled === this.isCorePluginEnabled) {
        return;
      }
      this.isCorePluginEnabled = isCorePluginEnabled;
      this.invokeHandler(isCorePluginEnabled ? this.onEnable : this.onDisable);
    }));

    this.register(() => {
      if (this.shouldCallOnDisableOnUnload && this.isCorePluginEnabled) {
        this.invokeHandler(this.onDisable);
      }
    });

    if (this.isCorePluginEnabled) {
      this.invokeHandler(this.onEnable);
    }
  }

  private invokeHandler(handler: (() => Promisable<void>) | undefined): void {
    if (handler) {
      invokeAsyncSafely(handler);
    }
  }
}
