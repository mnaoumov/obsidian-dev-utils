/**
 * @file
 *
 * Component that offers settings this plugin used to own to the plugin that owns them now, once, through
 * that plugin's public API.
 *
 * This is the other half of {@link obsidian/components/plugin-suggestion-component!PluginSuggestionComponent}.
 * The suggestion asks the user to install the plugin that took a feature over; this carries the settings they
 * had configured for it across, so taking the suggestion does not mean re-entering everything by hand.
 *
 * A proposing plugin never writes into another plugin's `data.json`. It PROPOSES: the other plugin owns the
 * settings, so it owns the dialog, and the user approves, edits or declines. Only an applied migration retires
 * the pending values.
 *
 * The offer is made whenever it CAN succeed, which needs two independent things to have happened — the
 * provider's API being available, and this plugin's own settings having arrived from disk. Either can land
 * first, so both edges are wired and each re-reads the current state rather than assuming the other has
 * already happened.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import type {
  PluginApiContract,
  PluginApiRef,
  WatchPluginApiParams
} from '../plugin/plugin-api.ts';
import type { SettingsMigrationApi } from '../plugin/settings-migration-api.ts';
import type { PluginSettingsComponentBase } from './plugin-settings-component.ts';

import { invokeAsyncSafely } from '../../async.ts';
import { normalizeOptionalProperties } from '../../object-utils.ts';
import { watchPluginApi } from '../plugin/plugin-api.ts';
import { registerAsyncEvent } from './async-events-component.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * Parameters for the {@link SettingsMigrationComponent} constructor.
 *
 * @typeParam TMigratableSettings - The settings this plugin may hand over.
 */
export interface SettingsMigrationComponentConstructorParams<TMigratableSettings extends object> {
  /**
   * The semver range of contract versions this plugin compiled against, e.g. `'^1'`.
   *
   * @remarks
   * Evaluated by `compare-versions`, which does NOT accept a bare `*`. Spell "any version" as `'>=0.0.0'`.
   */
  readonly apiVersionRange: string;

  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The contract this plugin expects of the provider, which wins over the provider's own when supplied.
   *
   * Worth supplying, and worth keeping NARROW. A migration usually needs one method that has existed since the
   * provider's first contract version, while the same plugin may read other parts of that API through a much
   * newer one. Declaring the wider expectation here would refuse to offer the migration to a user on an older
   * provider — which is precisely the user who still has settings to migrate.
   */
  readonly contract?: PluginApiContract;

  /**
   * Reads the values currently waiting to be handed over.
   *
   * Called afresh on every edge rather than once, so an implementation simply reads its plugin's settings.
   * Return `null` when there is nothing pending — after a migration has been applied, or on a vault that never
   * had these settings configured.
   *
   * @returns The values to propose, or `null` when there is nothing to offer.
   */
  getProposedSettings(this: void): null | TMigratableSettings;

  /**
   * The settings component of the plugin making the proposal.
   *
   * Taken as a whole component rather than as a bare "ready" flag so the host cannot forget to wire the wait:
   * whatever {@link getProposedSettings} reads is meaningless until this component has read `data.json`.
   */
  readonly pluginSettingsComponent: PluginSettingsComponentBase<object>;

  /**
   * The `manifest.id` of the plugin that owns these settings now, as listed in Obsidian's community plugin
   * registry.
   */
  readonly providerPluginId: string;

  /**
   * Records that the pending values have been handed over, so the offer is not made again.
   *
   * Called ONLY when the user actually applied the migration.
   *
   * @returns A {@link Promise} that resolves once the retirement is persisted.
   *
   * @remarks
   * An implementation must PERSIST the retirement — `pluginSettingsComponent.editAndSave(…)`, not
   * `setProperty(…)`. The latter only edits the in-memory state, so the retirement is forgotten on the next
   * reload and the migration is offered again forever.
   */
  retireProposedSettings(this: void): Promisable<void>;

  /**
   * The `manifest.id` of the plugin making the proposal, so the provider's dialog can say whose settings these
   * are.
   */
  readonly sourcePluginId: string;
}

/**
 * Offers settings this plugin used to own to the plugin that owns them now.
 *
 * @typeParam TMigratableSettings - The settings this plugin may hand over.
 */
export class SettingsMigrationComponent<TMigratableSettings extends object> extends ComponentEx {
  private readonly apiVersionRange: string;
  private readonly app: App;
  private readonly contract: PluginApiContract | undefined;
  private readonly getProposedSettings: () => null | TMigratableSettings;
  private isProposing = false;
  private readonly pluginSettingsComponent: PluginSettingsComponentBase<object>;
  private readonly providerPluginId: string;
  private readonly retireProposedSettings: () => Promisable<void>;
  private readonly sourcePluginId: string;

  /**
   * Creates an instance of {@link SettingsMigrationComponent}.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: SettingsMigrationComponentConstructorParams<TMigratableSettings>) {
    super();
    this.apiVersionRange = params.apiVersionRange;
    this.app = params.app;
    this.contract = params.contract;
    this.getProposedSettings = params.getProposedSettings;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.providerPluginId = params.providerPluginId;
    this.retireProposedSettings = params.retireProposedSettings;
    this.sourcePluginId = params.sourcePluginId;
  }

  /**
   * Loads the component, wiring both edges that can make an offer possible.
   */
  public override onload(): void {
    // Nothing is gated on the pending values HERE. The settings component is a sibling whose own load is still
    // In flight at this point, so it still holds the DEFAULTS — reading the pending values now would see
    // Nothing on exactly the vaults that have something, register no watch, and lose the migration for good.
    // Both edges are wired instead, and `propose` re-reads the values each time it runs.
    const ref = watchPluginApi<SettingsMigrationApi<TMigratableSettings>>(normalizeOptionalProperties<WatchPluginApiParams>({
      apiVersionRange: this.apiVersionRange,
      app: this.app,
      component: this,
      contract: this.contract,
      pluginId: this.providerPluginId
    }));

    // Driven by the ref's own event rather than by `whenAvailable()`, deliberately. That wait blocks for ten
    // Seconds and then throws when the provider is simply not installed, which would stall this plugin's load
    // For every user who declines the suggestion. Watching costs nothing while the provider is absent and
    // Offers the migration the moment it appears — including right after the user installs it from the
    // Suggestion banner.
    registerAsyncEvent(
      this,
      ref.on('change', () => {
        this.handleChange(ref);
      })
    );

    // The second edge: this plugin's own settings arriving from disk. It may fire before or after the first.
    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('loadSettings', () => {
        this.handleChange(ref);
      })
    );

    this.handleChange(ref);
  }

  private handleChange(ref: PluginApiRef<SettingsMigrationApi<TMigratableSettings>>): void {
    invokeAsyncSafely(async () => {
      await this.propose(ref.value);
    });
  }

  private async propose(api: null | SettingsMigrationApi<TMigratableSettings>): Promise<void> {
    const proposedSettings = this.getProposedSettings();
    if (!api || this.isProposing || proposedSettings === null) {
      return;
    }

    // Both edges can fire while the provider's dialog is open, and each would raise a second one.
    this.isProposing = true;
    try {
      const result = await api.migrateSettings({
        proposedSettings,
        sourcePluginId: this.sourcePluginId
      });

      // A cancel is not an answer, so the values stay pending and the offer comes back — on the next load, or
      // As soon as the provider reloads. Only an applied migration retires them.
      if (result.isApplied) {
        await this.retireProposedSettings();
      }
    } finally {
      this.isProposing = false;
    }
  }
}
