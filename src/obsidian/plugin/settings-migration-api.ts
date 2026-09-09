/**
 * @file
 *
 * The generic half of a settings HANDOVER contract: one plugin offers another the settings it used to own,
 * and the plugin that owns them now decides what to do with the offer.
 *
 * The shape below is deliberately the *envelope* and nothing else. A handover has three parts, and only one
 * of them is generic:
 *
 * - The **envelope** — a `migrateSettings` call, who is proposing, and whether the user applied it. Identical
 *   for every pair of plugins, so it lives here.
 * - The **payload** — which settings are being proposed. Entirely the pair's own business, so it stays a type
 *   parameter and is never named here.
 * - The **provider's identity** — its plugin id and display name. Also the pair's own business, and not
 *   something this library has any standing to own.
 *
 * Why it is declared rather than imported. A provider is typically an Obsidian *plugin* repo, not an npm
 * package, so a consumer has nothing to depend on and hand-writes its own copy of the contract. Five copies
 * of one contract with no compiler link between them means drift is SILENT — every copy still compiles and
 * the handover fails at runtime instead. Declaring the envelope here gives both ends one declaration to
 * compile against; `watchPluginApi` still negotiates the version at runtime, because the two ends ship
 * independently and always will.
 *
 * The provider publishes it:
 *
 * ```ts
 * publishPluginApi<SettingsMigrationApi<MyMigratableSettings>>({
 *   api: this.settingsMigrationApi,
 *   apiVersion: '1.0.0',
 *   contract: { migrateSettings: {} },
 *   plugin: this
 * });
 * ```
 *
 * The consumer reaches it through {@link obsidian/components/settings-migration-component!SettingsMigrationComponent},
 * which owns the whole offer-and-retire dance.
 */

/**
 * Parameters for {@link SettingsMigrationApi.migrateSettings}.
 *
 * @typeParam TMigratableSettings - The settings the proposing plugin may hand over.
 */
export interface MigrateSettingsParams<TMigratableSettings extends object> {
  /**
   * The values the proposing plugin offers.
   *
   * Conventionally every member is optional, so a plugin proposes only what it actually held and a value the
   * provider already owns is never overwritten by a default nobody chose. That convention belongs to the pair,
   * though — this type imposes only the envelope.
   */
  readonly proposedSettings: TMigratableSettings;

  /**
   * The `manifest.id` of the plugin making the proposal, so the provider's dialog can say whose settings
   * these are.
   */
  readonly sourcePluginId: string;
}

/**
 * The outcome of {@link SettingsMigrationApi.migrateSettings}.
 */
export interface MigrateSettingsResult {
  /**
   * Whether the user approved the migration.
   *
   * `false` means they cancelled and nothing was written, so the proposing plugin must NOT record the
   * migration as done — a cancel is not an answer, and the offer has to come back.
   */
  readonly isApplied: boolean;
}

/**
 * The API a plugin publishes when it is willing to receive settings another plugin used to own.
 *
 * @typeParam TMigratableSettings - The settings this provider accepts.
 *
 * @remarks
 * The provider owns the settings, so it owns the dialog: a proposing plugin never writes into another
 * plugin's `data.json`. It proposes, and the user approves, edits or declines.
 */
export interface SettingsMigrationApi<TMigratableSettings extends object> {
  /**
   * Offers the user a set of settings values another plugin proposes, and applies what they approve.
   *
   * Resolves only once the dialog is closed, so the caller learns whether the migration actually happened and
   * can retire — or withhold — its own pending values on that answer.
   *
   * @param params - The proposal.
   * @returns What the user approved.
   */
  migrateSettings(params: MigrateSettingsParams<TMigratableSettings>): Promise<MigrateSettingsResult>;
}
