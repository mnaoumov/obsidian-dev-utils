import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { AsyncEventRef } from '../../async-events.ts';
import type { DataHandler } from '../data-handler.ts';
import type { PluginEventSource } from '../plugin/plugin.ts';

import {
  noop,
  noopAsync
} from '../../function.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { PluginSettingsComponentBase } from './plugin-settings-component.ts';

vi.mock('../../../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

class MockDataHandler implements DataHandler {
  public loadData = vi.fn(() => Promise.resolve(this.data));

  private _data: unknown;

  public saveData = vi.fn((d: unknown) => {
    this._data = d;
    return noopAsync();
  });

  public get data(): unknown {
    return this._data;
  }

  public constructor(data: unknown) {
    this._data = data;
  }
}

class TestSettings {
  public count = 0;
  public name = 'default';
}

function createComponent(dataHandler: MockDataHandler): PluginSettingsComponentBase<TestSettings> {
  return new PluginSettingsComponentBase({
    dataHandler,
    pluginEventSource: createMockPluginEventSource(),
    pluginSettingsClass: TestSettings
  });
}

function createMockPluginEventSource(): PluginEventSource {
  const source: PluginEventSource = strictProxy<PluginEventSource>({
    offref: noop,
    on(name: string, callback: () => void, thisArg?: unknown): AsyncEventRef {
      return { asyncEventSource: source, callback, name, thisArg };
    }
  });
  return source;
}

describe('PluginSettingsComponentBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should bind loadData/saveData to the params object', async () => {
    const dataHandler = new MockDataHandler({ count: 42, name: 'bound' });

    const component = createComponent(dataHandler);
    await component.loadWithPromises();

    expect(component.settings.count).toBe(42);
    expect(component.settings.name).toBe('bound');

    await component.editAndSave((settings) => {
      settings.name = 'updated';
    });

    expect((dataHandler.data as TestSettings).name).toBe('updated');
  });

  it('should have default settings after construction', () => {
    const component = createComponent(new MockDataHandler({}));
    expect(component.defaultSettings).toEqual({ count: 0, name: 'default' });
    expect(component.settings).toEqual({ count: 0, name: 'default' });
  });

  it('should load settings from file on onload', async () => {
    const component = createComponent(new MockDataHandler({ count: 5, name: 'loaded' }));
    await component.loadWithPromises();
    expect(component.settings.count).toBe(5);
    expect(component.settings.name).toBe('loaded');
  });

  it('should handle null data on load', async () => {
    const component = createComponent(new MockDataHandler(null));
    await component.loadWithPromises();
    expect(component.settings).toEqual({ count: 0, name: 'default' });
  });

  it('should handle undefined data on load', async () => {
    const component = createComponent(new MockDataHandler(undefined));
    await component.loadWithPromises();
    expect(component.settings).toEqual({ count: 0, name: 'default' });
  });

  it('should handle non-object data on load', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });
    const component = createComponent(new MockDataHandler('invalid'));
    await component.loadWithPromises();
    expect(component.settings).toEqual({ count: 0, name: 'default' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid settings'));
    consoleSpy.mockRestore();
  });

  it('should set a property and return validation message', async () => {
    const component = createComponent(new MockDataHandler({}));
    await component.loadWithPromises();
    const message = await component.setProperty('name', 'updated');
    expect(message).toBe('');
    expect(component.settingsState.inputValues.name).toBe('updated');
  });

  it('should validate property and use default for invalid values', async () => {
    class ValidatingComponent extends PluginSettingsComponentBase<TestSettings> {
      protected override registerValidators(): void {
        super.registerValidators();
        this.registerValidator('count', (value) => {
          if (value < 0) {
            return 'Count must be non-negative';
          }
          return undefined;
        });
      }
    }

    const component = new ValidatingComponent({
      dataHandler: new MockDataHandler({}),
      pluginEventSource: createMockPluginEventSource(),
      pluginSettingsClass: TestSettings
    });
    await component.loadWithPromises();

    const message = await component.setProperty('count', -1);
    expect(message).toBe('Count must be non-negative');
    expect(component.settingsState.inputValues.count).toBe(-1);
    expect(component.settingsState.effectiveValues.count).toBe(0); // Default
  });

  it('should save to file when settings changed', async () => {
    const dataHandler = new MockDataHandler({});
    const component = createComponent(dataHandler);
    await component.loadWithPromises();

    await component.setProperty('name', 'changed');
    await component.saveToFile();

    expect(dataHandler.saveData).toHaveBeenCalled();
  });

  it('should not save to file when settings unchanged', async () => {
    const dataHandler = new MockDataHandler({ count: 0, name: 'default' });
    const component = createComponent(dataHandler);
    await component.loadWithPromises();

    vi.mocked(dataHandler.saveData).mockClear();
    await component.saveToFile();

    expect(dataHandler.saveData).not.toHaveBeenCalled();
  });

  it('should trigger loadSettings event on load', async () => {
    const component = createComponent(new MockDataHandler({}));
    const callback = vi.fn();
    component.on('loadSettings', callback);
    await component.loadWithPromises();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ inputValues: { count: 0, name: 'default' } }),
      true
    );
  });

  it('should trigger saveSettings event on save', async () => {
    const component = createComponent(new MockDataHandler({}));
    await component.loadWithPromises();

    const callback = vi.fn();
    component.on('saveSettings', callback);

    await component.setProperty('name', 'saved');
    await component.saveToFile('testContext');

    expect(callback).toHaveBeenCalled();
  });

  it('should handle onExternalSettingsChange', async () => {
    const dataHandler = new MockDataHandler({ count: 1, name: 'initial' });
    const component = createComponent(dataHandler);
    await component.loadWithPromises();

    vi.mocked(dataHandler.loadData).mockResolvedValue({ count: 2, name: 'external' });
    await component.onExternalSettingsChange();

    expect(component.settings.count).toBe(2);
    expect(component.settings.name).toBe('external');
  });

  it('should editAndSave', async () => {
    const dataHandler = new MockDataHandler({});
    const component = createComponent(dataHandler);
    await component.loadWithPromises();

    await component.editAndSave((settings) => {
      settings.name = 'edited';
    });

    expect(dataHandler.saveData).toHaveBeenCalled();
    expect(component.settings.name).toBe('edited');
  });

  it('should ensureSafe by replacing invalid values with defaults', async () => {
    class ValidatingComponent extends PluginSettingsComponentBase<TestSettings> {
      protected override registerValidators(): void {
        super.registerValidators();
        this.registerValidator('count', (value) => {
          if (value < 0) {
            return 'Invalid';
          }
          return undefined;
        });
      }
    }

    const component = new ValidatingComponent({
      dataHandler: new MockDataHandler({}),
      pluginEventSource: createMockPluginEventSource(),
      pluginSettingsClass: TestSettings
    });
    await component.loadWithPromises();

    const settings: TestSettings = { count: -5, name: 'test' };
    await component.ensureSafe(settings);
    expect(settings.count).toBe(0); // Replaced with default
    expect(settings.name).toBe('test'); // Kept since valid
  });

  it('should getSafeCopy', async () => {
    class ValidatingComponent extends PluginSettingsComponentBase<TestSettings> {
      protected override registerValidators(): void {
        super.registerValidators();
        this.registerValidator('count', (value) => {
          if (value < 0) {
            return 'Invalid';
          }
          return undefined;
        });
      }
    }

    const component = new ValidatingComponent({
      dataHandler: new MockDataHandler({}),
      pluginEventSource: createMockPluginEventSource(),
      pluginSettingsClass: TestSettings
    });
    await component.loadWithPromises();

    const original: TestSettings = { count: -1, name: 'test' };
    const safe = await component.getSafeCopy(original);
    expect(safe.count).toBe(0);
    expect(safe.name).toBe('test');
    // Original should not be modified
    expect(original.count).toBe(-1);
  });

  it('should revalidate and return validation messages', async () => {
    class ValidatingComponent extends PluginSettingsComponentBase<TestSettings> {
      protected override registerValidators(): void {
        super.registerValidators();
        this.registerValidator('name', (value) => {
          if (value === '') {
            return 'Name required';
          }
          return undefined;
        });
      }
    }

    const component = new ValidatingComponent({
      dataHandler: new MockDataHandler({}),
      pluginEventSource: createMockPluginEventSource(),
      pluginSettingsClass: TestSettings
    });
    await component.loadWithPromises();

    await component.setProperty('name', '');
    const messages = await component.revalidate();
    expect(messages.name).toBe('Name required');
  });

  it('should handle legacy settings converters', async () => {
    class LegacySettings {
      public legacyField = '';
      public oldName = '';
    }

    class LegacyComponent extends PluginSettingsComponentBase<TestSettings> {
      protected override registerLegacySettingsConverters(): void {
        super.registerLegacySettingsConverters();
        this.registerLegacySettingsConverter(
          LegacySettings,
          (legacy) => {
            if (legacy.oldName) {
              legacy.name = legacy.oldName;
              delete legacy.oldName;
            }
          }
        );
      }
    }

    const component = new LegacyComponent({
      dataHandler: new MockDataHandler({ oldName: 'migrated' }),
      pluginEventSource: createMockPluginEventSource(),
      pluginSettingsClass: TestSettings
    });
    await component.loadWithPromises();
    expect(component.settings.name).toBe('migrated');
  });

  it('should delete legacy keys that are not in current settings', async () => {
    class LegacyComponent extends PluginSettingsComponentBase<TestSettings> {
      protected override registerLegacySettingsConverters(): void {
        super.registerLegacySettingsConverters();
        this.registerLegacySettingsConverter(
          class {
            public legacyOnlyField = 'old';
          },
          () => {
            // Converter does nothing, but legacyOnlyField should be cleaned up
          }
        );
      }
    }

    // Data has a legacy key that is in legacySettingsKeys but not in pluginSettingKeys
    const component = new LegacyComponent({
      dataHandler: new MockDataHandler({ count: 1, legacyOnlyField: 'stale', name: 'test' }),
      pluginEventSource: createMockPluginEventSource(),
      pluginSettingsClass: TestSettings
    });
    await component.loadWithPromises();
    expect(component.settings.count).toBe(1);
    expect(component.settings.name).toBe('test');
  });

  it('should skip keys that are neither in plugin settings nor legacy settings', async () => {
    class LegacyComponent extends PluginSettingsComponentBase<TestSettings> {
      protected override registerLegacySettingsConverters(): void {
        super.registerLegacySettingsConverters();
        this.registerLegacySettingsConverter(
          class {
            public legacyField = '';
          },
          () => {
            // No-op converter
          }
        );
      }
    }

    // Data has 'unknownField' which is NOT in pluginSettingKeys and NOT in legacySettingsKeys
    const component = new LegacyComponent({
      dataHandler: new MockDataHandler({ count: 1, name: 'test', unknownField: 'should-stay' }),
      pluginEventSource: createMockPluginEventSource(),
      pluginSettingsClass: TestSettings
    });
    await component.loadWithPromises();
    expect(component.settings.count).toBe(1);
  });

  it('should ignore unknown properties in raw record', async () => {
    const component = createComponent(new MockDataHandler({ count: 1, name: 'test', unknownProp: 'ignored' }));
    await component.loadWithPromises();
    expect(component.settings.count).toBe(1);
  });

  it('should warn about type mismatches in raw record', async () => {
    const component = createComponent(new MockDataHandler({ count: 'not-a-number', name: 'test' }));
    await component.loadWithPromises();
    // Should still load the value but log a debug warning
    expect(component.settings.name).toBe('test');
  });

  it('should save normalized data when loaded record differs from raw', async () => {
    const params = new MockDataHandler({ count: 5, extraField: 'removed', name: 'test' });
    const component = createComponent(params);
    await component.loadWithPromises();
    // SaveData should have been called because the normalized record differs from the raw one
    expect(params.saveData).toHaveBeenCalled();
  });

  it('should validate with empty validators returning no errors', async () => {
    const component = createComponent(new MockDataHandler({}));
    const result = await component.validate({ count: 1, name: 'valid' });
    expect(result).toEqual({});
  });

  it('should return false for non-string property names in isValidPropertyName', () => {
    const component = createComponent(new MockDataHandler({}));
    // Access the private method to test the non-string guard
    const result = component['isValidPropertyName'](123);
    expect(result).toBe(false);
  });

  it('should handle validator returning empty string (no error)', async () => {
    class ValidatingComponent extends PluginSettingsComponentBase<TestSettings> {
      protected override registerValidators(): void {
        super.registerValidators();
        this.registerValidator('count', (value) => {
          if (value < 0) {
            return 'Count must be non-negative';
          }
          return '';
        });
      }
    }

    const component = new ValidatingComponent({
      dataHandler: new MockDataHandler({}),
      pluginEventSource: createMockPluginEventSource(),
      pluginSettingsClass: TestSettings
    });
    await component.loadWithPromises();

    // Valid value - validator returns empty string
    const result = await component.validate({ count: 5, name: 'test' });
    expect(result).toEqual({});
  });

  it('should use input value for effective when no validation error', async () => {
    const component = createComponent(new MockDataHandler({}));
    await component.loadWithPromises();

    // Set a valid property - effective should equal input, not default
    await component.setProperty('name', 'custom');
    expect(component.settingsState.effectiveValues.name).toBe('custom');
    expect(component.settingsState.inputValues.name).toBe('custom');
  });

  it('should load settings with validation error and use defaults for effective values', async () => {
    class ValidatingComponent extends PluginSettingsComponentBase<TestSettings> {
      protected override registerValidators(): void {
        super.registerValidators();
        this.registerValidator('count', (value) => {
          if (value < 0) {
            return 'Must be non-negative';
          }
          return undefined;
        });
      }
    }

    // Load from file with an invalid count
    const component = new ValidatingComponent({
      dataHandler: new MockDataHandler({ count: -5, name: 'test' }),
      pluginEventSource: createMockPluginEventSource(),
      pluginSettingsClass: TestSettings
    });
    await component.loadWithPromises();

    // Input should have the raw value, effective should have the default
    expect(component.settingsState.inputValues.count).toBe(-5);
    expect(component.settingsState.effectiveValues.count).toBe(0);
    expect(component.settingsState.validationMessages.count).toBe('Must be non-negative');
  });
});
