/**
 * @file
 *
 * Tests for {@link SettingsMigrationComponent}.
 */

import type {
  App,
  Plugin,
  PluginManifest
} from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { AsyncEventRef } from '../../async-events.ts';
import type { DataHandler } from '../data-handler.ts';
import type {
  PluginApiContract,
  PublishPluginApiParams
} from '../plugin/plugin-api.ts';
import type { PluginEventSource } from '../plugin/plugin-event-source.ts';
import type {
  MigrateSettingsParams,
  MigrateSettingsResult,
  SettingsMigrationApi
} from '../plugin/settings-migration-api.ts';
import type { SettingsMigrationComponentConstructorParams } from './settings-migration-component.ts';

import { waitForAllAsyncOperations } from '../../async.ts';
import {
  noop,
  noopAsync
} from '../../function.ts';
import {
  castTo,
  normalizeOptionalProperties
} from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { publishPluginApi } from '../plugin/plugin-api.ts';
import { PluginSettingsComponentBase } from './plugin-settings-component.ts';
import { SettingsMigrationComponent } from './settings-migration-component.ts';

const PROVIDER_PLUGIN_ID = 'provider-plugin';
const SOURCE_PLUGIN_ID = 'source-plugin';

// `compare-versions` rejects a bare `*`, so "any version" is spelled as an open lower bound.
const ANY_VERSION_RANGE = '>=0.0.0';

interface CreateHarnessOptions {
  /**
   * The contract the CONSUMER declares, which wins over the provider's when supplied.
   */
  readonly contract?: PluginApiContract;

  /**
   * What the consumer's `data.json` holds, i.e. whether a migration is pending on this vault.
   */
  readonly storedProposedValue?: boolean | null;
}

interface Harness {
  readonly migrateSettings: MigrateSettingsMock;
  readonly migrationComponent: SettingsMigrationComponent<TestMigratableSettings>;
  /**
   * Publishes the provider's API, as enabling that plugin would.
   */
  publish(api?: object): void;
  readonly settingsComponent: PluginSettingsComponentBase<TestSettings>;
  /**
   * The consumer's `data.json`, so a test can assert the retirement was PERSISTED rather than only edited in
   * memory.
   */
  storedData(): unknown;
}

type MigrateSettingsMock = ReturnType<typeof vi.fn<(params: MigrateSettingsParams<TestMigratableSettings>) => Promise<MigrateSettingsResult>>>;

/**
 * The payload this fake consumer hands over — the shape of the real ones, narrowed to what the tests assert.
 */
interface TestMigratableSettings {
  readonly shouldHandleRenames?: boolean;
}

class MockDataHandler implements DataHandler {
  public loadData = vi.fn(() => Promise.resolve(this.data));

  private _data: unknown;

  public saveData = vi.fn((data: unknown) => {
    this._data = data;
    return noopAsync();
  });

  public get data(): unknown {
    return this._data;
  }

  public constructor(data: unknown) {
    this._data = data;
  }
}

/**
 * The consumer's settings, in the shape the real consumers use: one nullable property parks the value the
 * plugin no longer acts on itself, and `null` means there is nothing left to offer.
 */
class TestSettings {
  public proposedShouldHandleRenames: boolean | null = null;
}

describe('SettingsMigrationComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not propose while the provider is unavailable', async () => {
    const harness = createHarness({ storedProposedValue: true });
    await harness.settingsComponent.loadWithPromises();
    harness.migrationComponent.load();
    await waitForAllAsyncOperations();

    expect(harness.migrateSettings).not.toHaveBeenCalled();
  });

  it('should not propose when nothing is pending', async () => {
    const harness = createHarness({ storedProposedValue: null });
    harness.publish();
    await harness.settingsComponent.loadWithPromises();
    harness.migrationComponent.load();
    await waitForAllAsyncOperations();

    expect(harness.migrateSettings).not.toHaveBeenCalled();
  });

  it('should propose the pending values and retire them once applied', async () => {
    const harness = createHarness({ storedProposedValue: true });
    harness.publish();
    await harness.settingsComponent.loadWithPromises();
    harness.migrationComponent.load();
    await waitForAllAsyncOperations();

    expect(harness.migrateSettings).toHaveBeenCalledTimes(1);
    expect(harness.migrateSettings).toHaveBeenCalledWith({
      proposedSettings: { shouldHandleRenames: true },
      sourcePluginId: SOURCE_PLUGIN_ID
    });

    expect(harness.settingsComponent.settings.proposedShouldHandleRenames).toBeNull();
    // Retired through `editAndSave`, so the answer survives a reload. `setProperty` would leave `data.json`
    // untouched and the offer would come back forever.
    expect(harness.storedData()).toEqual({ proposedShouldHandleRenames: null });
  });

  it('should keep the pending values when the user cancels', async () => {
    const harness = createHarness({ storedProposedValue: true });
    harness.migrateSettings.mockResolvedValue({ isApplied: false });
    harness.publish();
    await harness.settingsComponent.loadWithPromises();
    harness.migrationComponent.load();
    await waitForAllAsyncOperations();

    expect(harness.migrateSettings).toHaveBeenCalledTimes(1);
    expect(harness.settingsComponent.settings.proposedShouldHandleRenames).toBe(true);
  });

  it('should propose once the provider appears later', async () => {
    const harness = createHarness({ storedProposedValue: true });
    await harness.settingsComponent.loadWithPromises();
    harness.migrationComponent.load();
    await waitForAllAsyncOperations();
    expect(harness.migrateSettings).not.toHaveBeenCalled();

    harness.publish();
    await waitForAllAsyncOperations();

    expect(harness.migrateSettings).toHaveBeenCalledTimes(1);
  });

  it('should propose once the settings arrive from disk later', async () => {
    const harness = createHarness({ storedProposedValue: true });
    harness.publish();
    // The real ordering on a cold start: this component's `onload` runs while its settings sibling is still
    // reading `data.json`, so the pending value is not visible yet.
    harness.migrationComponent.load();
    await waitForAllAsyncOperations();
    expect(harness.migrateSettings).not.toHaveBeenCalled();

    await harness.settingsComponent.loadWithPromises();
    await waitForAllAsyncOperations();

    expect(harness.migrateSettings).toHaveBeenCalledTimes(1);
  });

  it('should not raise a second proposal while one is in flight', async () => {
    const harness = createHarness({ storedProposedValue: true });
    let resolveMigration = noop;
    harness.migrateSettings.mockReturnValue(
      new Promise<MigrateSettingsResult>((resolve) => {
        resolveMigration = (): void => {
          resolve({ isApplied: true });
        };
      })
    );

    harness.publish();
    await harness.settingsComponent.loadWithPromises();
    harness.migrationComponent.load();

    // A second edge while the provider's dialog is still open.
    await harness.settingsComponent.loadFromFile(false);
    resolveMigration();
    await waitForAllAsyncOperations();

    expect(harness.migrateSettings).toHaveBeenCalledTimes(1);
  });

  it('should stop watching once unloaded', async () => {
    const harness = createHarness({ storedProposedValue: true });
    await harness.settingsComponent.loadWithPromises();
    harness.migrationComponent.load();
    await waitForAllAsyncOperations();

    harness.migrationComponent.unload();
    harness.publish();
    await waitForAllAsyncOperations();

    expect(harness.migrateSettings).not.toHaveBeenCalled();
  });

  it('should honor the consumer contract over the provider published one', async () => {
    // The provider publishes no contract at all, so a shape check made against ITS contract would accept
    // anything and the migration WOULD be offered. Only the consumer's own contract can refuse a provider
    // whose shipped shape is older than the one this plugin compiled against.
    const harness = createHarness({
      contract: {
        getSettings: {},
        migrateSettings: {}
      },
      storedProposedValue: true
    });
    harness.publish({ migrateSettings: harness.migrateSettings });
    await harness.settingsComponent.loadWithPromises();
    harness.migrationComponent.load();
    await waitForAllAsyncOperations();

    expect(harness.migrateSettings).not.toHaveBeenCalled();
  });
});

function createHarness(options: CreateHarnessOptions = {}): Harness {
  const app = strictProxy<App>({
    plugins: strictProxy<App['plugins']>({
      enabledPlugins: new Set<string>([PROVIDER_PLUGIN_ID]),
      manifests: { [PROVIDER_PLUGIN_ID]: strictProxy<PluginManifest>({ id: PROVIDER_PLUGIN_ID }) }
    })
  });

  const dataHandler = new MockDataHandler({ proposedShouldHandleRenames: options.storedProposedValue ?? null });
  const settingsComponent = new PluginSettingsComponentBase<TestSettings>({
    dataHandler,
    pluginEventSource: createMockPluginEventSource(),
    pluginSettingsClass: TestSettings
  });

  const migrateSettings: MigrateSettingsMock = vi
    .fn<(params: MigrateSettingsParams<TestMigratableSettings>) => Promise<MigrateSettingsResult>>()
    .mockResolvedValue({ isApplied: true });

  const migrationComponent = new SettingsMigrationComponent<TestMigratableSettings>(
    normalizeOptionalProperties<SettingsMigrationComponentConstructorParams<TestMigratableSettings>>({
      apiVersionRange: ANY_VERSION_RANGE,
      app,
      contract: options.contract,
      getProposedSettings: (): null | TestMigratableSettings => {
        const proposedShouldHandleRenames = settingsComponent.settings.proposedShouldHandleRenames;
        return proposedShouldHandleRenames === null ? null : { shouldHandleRenames: proposedShouldHandleRenames };
      },
      // `PluginSettingsComponentBase` is INVARIANT in its settings type, and this repo's own
      // `test-helpers/mocks/obsidian-typings` augmentation exposes the `constructor__` pseudo-method, which
      // makes the private `propertyNames` structurally visible and turns that invariance into a hard TS2322.
      // A consuming plugin has no such augmentation and passes its concrete settings component with no cast —
      // which is exactly what the five consumers already do against `PluginSuggestionComponent`, whose
      // parameter is declared identically. So the cast is an artifact of testing HERE, not a rough edge in the
      // public surface.
      pluginSettingsComponent: castTo<PluginSettingsComponentBase<object>>(settingsComponent),
      providerPluginId: PROVIDER_PLUGIN_ID,
      retireProposedSettings: async (): Promise<void> => {
        await settingsComponent.editAndSave((settings) => {
          settings.proposedShouldHandleRenames = null;
        });
      },
      sourcePluginId: SOURCE_PLUGIN_ID
    })
  );

  return {
    migrateSettings,
    migrationComponent,
    publish: (api?: object): void => {
      publishPluginApi(normalizeOptionalProperties<PublishPluginApiParams<object>>({
        api: api ?? ({ migrateSettings } satisfies SettingsMigrationApi<TestMigratableSettings>),
        apiVersion: '1.0.0',
        plugin: strictProxy<Plugin>({
          manifest: strictProxy<PluginManifest>({ id: PROVIDER_PLUGIN_ID }),
          register: noop
        })
      }));
    },
    settingsComponent,
    storedData: (): unknown => dataHandler.data
  };
}

function createMockPluginEventSource(): PluginEventSource {
  const source: PluginEventSource = strictProxy<PluginEventSource>({
    offref: noop,
    on(name: string, callback: () => void, thisArgument?: unknown): AsyncEventRef {
      return {
        asyncEventSource: source,
        callback,
        name,
        thisArgument
      };
    }
  });
  return source;
}
