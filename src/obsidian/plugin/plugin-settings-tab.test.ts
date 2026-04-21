/* eslint-disable obsidianmd/prefer-active-doc -- test file uses jsdom document, not Obsidian's activeDocument */

import type {
  App as AppOriginal,
  Plugin
} from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ValueComponentWithChangeTracking } from '../components/setting-components/value-component-with-change-tracking.ts';
import type { PluginSettingsComponentBase } from './components/plugin-settings-component.ts';

import { noop } from '../../function.ts';
import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import {
  PluginSettingsTabBase,
  SAVE_TO_FILE_CONTEXT
} from './plugin-settings-tab.ts';

vi.mock('../../css-class.ts', () => ({
  CssClass: {
    LibraryName: 'obsidian-dev-utils',
    PluginSettingsTab: 'plugin-settings-tab',
    Tooltip: 'tooltip',
    TooltipArrow: 'tooltip-arrow',
    TooltipValidator: 'tooltip-validator'
  }
}));

vi.mock('./plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

interface EventListenerEntry {
  0: string;
  1: (...args: unknown[]) => unknown;
}

interface MockValueComponentBase {
  onChange: ReturnType<typeof vi.fn>;
  setValue: ReturnType<typeof vi.fn>;
}

interface MockValueComponentWithValidator extends MockValueComponentBase {
  validatorEl: HTMLElement;
}

interface TestSettings {
  enabled: boolean;
  name: string;
}

interface TextBasedMockComponentShape extends MockValueComponentBase {
  empty: ReturnType<typeof vi.fn>;
  isEmpty: ReturnType<typeof vi.fn>;
  setPlaceholderValue: ReturnType<typeof vi.fn>;
}

class TestSettingsTab extends PluginSettingsTabBase<TestSettings> {
  public displayCalled = false;

  public override display(): void {
    super.display();
    this.displayCalled = true;
  }
}

function createMockPlugin(appInstance: AppOriginal): Plugin {
  return strictProxy<Plugin>({
    app: appInstance,
    manifest: { id: 'test-plugin' }
  } as never);
}

function createMockSettingsComponent(): PluginSettingsComponentBase<TestSettings> {
  return strictProxy<PluginSettingsComponentBase<TestSettings>>({
    defaultSettings: { enabled: false, name: 'default' },
    on: vi.fn((_name: string, _callback: (...args: unknown[]) => void) => ({
      asyncEvents: {
        offref: vi.fn()
      }
    })),
    revalidate: vi.fn(() => Promise.resolve({ enabled: '', name: '' })),
    saveToFile: vi.fn(() => Promise.resolve()),
    setProperty: vi.fn(() => Promise.resolve('')),
    settingsState: {
      effectiveValues: { enabled: false, name: 'test' },
      inputValues: { enabled: false, name: 'test' },
      validationMessages: { enabled: '', name: '' }
    }
  } as never);
}

let app: AppOriginal;

beforeEach(() => {
  vi.clearAllMocks();
  app = App.createConfigured__().asOriginalType__();
});

function stubRequestAnimationFrame(): void {
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    cb();
    return 0;
  });
}

describe('PluginSettingsTabBase', () => {
  it('should create with correct params', () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    expect(tab).toBeDefined();
    expect(tab.isOpen).toBe(false);
  });

  it('should set isOpen to true on display', () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });

    tab.display();

    expect(tab.isOpen).toBe(true);
    expect(tab.displayCalled).toBe(true);
  });

  it('should set isOpen to false on hide', () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });

    tab.display();
    expect(tab.isOpen).toBe(true);

    tab.hide();
    expect(tab.isOpen).toBe(false);
  });

  it('should save settings on hideAsync', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });

    await tab.hideAsync();

    expect(pluginSettingsComponent.saveToFile).toHaveBeenCalledWith(SAVE_TO_FILE_CONTEXT);
  });

  it('should open settings tab via show()', () => {
    const openTab = vi.fn();
    const appWithSetting = strictProxy<AppOriginal>({
      setting: { openTab }
    });
    const plugin = createMockPlugin(appWithSetting);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });

    tab.show();

    expect(openTab).toHaveBeenCalledWith(tab);
  });

  it('should bind a value component to a setting', () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    const onChange = vi.fn();
    const setValue = vi.fn();
    const mockComponent: ValueComponentWithChangeTracking<string> = {
      onChange: vi.fn((cb: (...args: unknown[]) => unknown) => {
        onChange.mockImplementation(cb);
        return mockComponent;
      }),
      setValue
    } as never;

    const result = tab.bind(mockComponent, 'name' as never);
    expect(result).toBe(mockComponent);
    expect(setValue).toHaveBeenCalledWith('test');
  });

  it('should call onChanged callback when value changes', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    let changeCallback: ((value: string) => Promise<void>) | undefined;
    const setValue = vi.fn();
    const mockComponent: ValueComponentWithChangeTracking<string> = {
      onChange: vi.fn((cb: (value: string) => Promise<void>) => {
        changeCallback = cb;
        return mockComponent;
      }),
      setValue
    } as never;

    const onChangedSpy = vi.fn();
    tab.bind(mockComponent, 'name' as never, { onChanged: onChangedSpy });

    if (changeCallback) {
      await changeCallback('newValue');
    }

    expect(pluginSettingsComponent.setProperty).toHaveBeenCalledWith('name', 'newValue');
  });

  it('should register loadSettings and saveSettings event handlers on display', () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });

    tab.display();

    expect(pluginSettingsComponent.on).toHaveBeenCalledWith('loadSettings', expect.any(Function));
    expect(pluginSettingsComponent.on).toHaveBeenCalledWith('saveSettings', expect.any(Function));
  });

  it('should revalidate settings', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    await tab['revalidate']();

    expect(pluginSettingsComponent.revalidate).toHaveBeenCalled();
  });

  it('should use placeholder for default values with text-based component', () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    // When value equals default, text-based component should be emptied
    (pluginSettingsComponent.settingsState.inputValues as TestSettings).name = 'default';

    const mockComponent = createTextBasedMockComponent();

    tab.bind(mockComponent, 'name' as never);
    expect(mockComponent.setPlaceholderValue).toHaveBeenCalledWith('default');
  });

  it('should handle onChange with value converter returning validation message', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    let changeCallback: ((value: string) => Promise<void>) | undefined;
    const mockComponent: ValueComponentWithChangeTracking<string> = {
      onChange: vi.fn((cb: (value: string) => Promise<void>) => {
        changeCallback = cb;
        return mockComponent;
      }),
      setValue: vi.fn()
    } as never;

    tab.bind(mockComponent, 'name' as never, {
      componentToPluginSettingsValueConverter: () => ({
        validationMessage: 'Invalid value'
      }),
      pluginSettingsToComponentValueConverter: (v: unknown) => String(v)
    } as never);

    if (changeCallback) {
      await changeCallback('badValue');
    }

    // SetProperty should NOT have been called since validation failed
    expect(pluginSettingsComponent.setProperty).not.toHaveBeenCalled();
  });

  it('should handle onChange with text-based component that resets to default when empty', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    let changeCallback: ((value: string) => Promise<void>) | undefined;
    const mockComponent = createTextBasedMockComponent();
    mockComponent.onChange = vi.fn((cb: (value: string) => Promise<void>) => {
      changeCallback = cb;
      return mockComponent;
    }) as never;
    mockComponent.isEmpty = vi.fn(() => true) as never;

    tab.bind(mockComponent, 'name' as never);

    if (changeCallback) {
      await changeCallback('');
    }

    expect(pluginSettingsComponent.setProperty).toHaveBeenCalledWith('name', 'default');
  });

  it('should handle onChange with skipOnChange flag', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    let changeCallback: ((value: string) => Promise<void>) | undefined;
    const mockComponent: ValueComponentWithChangeTracking<string> = {
      onChange: vi.fn((cb: (value: string) => Promise<void>) => {
        changeCallback = cb;
        return mockComponent;
      }),
      setValue: vi.fn()
    } as never;

    tab.bind(mockComponent, 'name' as never);

    // First call sets things up
    if (changeCallback) {
      await changeCallback('value1');
      expect(pluginSettingsComponent.setProperty).toHaveBeenCalledTimes(1);
    }
  });

  it('should handle bind with validatorEl', () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    const parentEl = document.createElement('div');
    const validatorEl = document.createElement('input');
    parentEl.appendChild(validatorEl);
    validatorEl.isActiveElement = vi.fn(() => false);

    const mockComponent: MockValueComponentWithValidator & ValueComponentWithChangeTracking<string> = {
      onChange: vi.fn(() => mockComponent),
      setValue: vi.fn(),
      validatorEl
    } as never;

    const result = tab.bind(mockComponent, 'name' as never);
    expect(result).toBe(mockComponent);
  });

  it('should handle bind with shouldShowValidationMessage=false', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    const parentEl = document.createElement('div');
    const validatorEl = document.createElement('input');
    parentEl.appendChild(validatorEl);
    validatorEl.isActiveElement = vi.fn(() => false);

    let changeCallback: ((value: string) => Promise<void>) | undefined;
    const mockComponent: MockValueComponentWithValidator & ValueComponentWithChangeTracking<string> = {
      onChange: vi.fn((cb: (value: string) => Promise<void>) => {
        changeCallback = cb;
        return mockComponent;
      }),
      setValue: vi.fn(),
      validatorEl
    } as never;

    vi.mocked(pluginSettingsComponent.setProperty).mockResolvedValue('Some error');

    tab.bind(mockComponent, 'name' as never, { shouldShowValidationMessage: false });

    if (changeCallback) {
      await changeCallback('value');
    }
  });

  it('should handle onSaveSettings with SAVE_TO_FILE_CONTEXT', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    // Get the saveSettings callback
    const onCalls: EventListenerEntry[] = vi.mocked(pluginSettingsComponent.on).mock.calls as never;
    const onCall = onCalls.find((call) => call[0] === 'saveSettings');
    const saveSettingsCallback = onCall?.[1] as (
      newState: unknown,
      oldState: unknown,
      context: unknown
    ) => Promise<void>;

    // Call with SAVE_TO_FILE_CONTEXT
    const state = {
      validationMessages: { enabled: '', name: 'error' }
    };
    await saveSettingsCallback(state, state, SAVE_TO_FILE_CONTEXT);
  });

  it('should call display when onSaveSettings is called with non-tab context', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();
    tab.displayCalled = false;

    const onCalls: EventListenerEntry[] = vi.mocked(pluginSettingsComponent.on).mock.calls as never;
    const onCall = onCalls.find((call) => call[0] === 'saveSettings');
    const saveSettingsCallback = onCall?.[1] as (
      newState: unknown,
      oldState: unknown,
      context: unknown
    ) => Promise<void>;

    const state = {
      validationMessages: { enabled: '', name: '' }
    };
    await saveSettingsCallback(state, state, 'someOtherContext');
    expect(tab.displayCalled).toBe(true);
  });

  it('should call display when onLoadSettings is triggered', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();
    tab.displayCalled = false;

    const onCalls: EventListenerEntry[] = vi.mocked(pluginSettingsComponent.on).mock.calls as never;
    const onCall = onCalls.find((call) => call[0] === 'loadSettings');
    const loadSettingsCallback = onCall?.[1] as (
      loadedState: unknown,
      isInitialLoad: boolean
    ) => Promise<void>;

    await loadSettingsCallback({}, false);
    expect(tab.displayCalled).toBe(true);
  });

  it('should handle bind with text component and shouldEmptyOnBlur', async () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    let changeCallback: ((value: string) => Promise<void>) | undefined;
    const mockComponent = createTextBasedMockComponent();
    mockComponent.onChange = vi.fn((cb: (value: string) => Promise<void>) => {
      changeCallback = cb;
      return mockComponent;
    }) as never;
    mockComponent.isEmpty = vi.fn(() => false) as never;

    tab.bind(mockComponent, 'name' as never);

    // Trigger onChange with value equal to default to set shouldEmptyOnBlur
    if (changeCallback) {
      await changeCallback('default');
    }
  });

  it('should handle saveSettingsDebounceTimeoutInMilliseconds getter', () => {
    const plugin = createMockPlugin(app);
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    const timeout = tab['saveSettingsDebounceTimeoutInMilliseconds'];
    const EXPECTED_DEFAULT = 2_000;
    expect(timeout).toBe(EXPECTED_DEFAULT);
  });

  it('should handle full bind with validatorEl and onChange triggering updateValidatorEl', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      const parentEl = document.createElement('div');
      const validatorEl = document.createElement('input');
      parentEl.appendChild(validatorEl);
      validatorEl.isActiveElement = vi.fn(() => false);

      let changeCallback: ((value: string) => Promise<void>) | undefined;
      const mockComponent: MockValueComponentWithValidator & ValueComponentWithChangeTracking<string> = {
        onChange: vi.fn((cb: (value: string) => Promise<void>) => {
          changeCallback = cb;
          return mockComponent;
        }),
        setValue: vi.fn(),
        validatorEl
      } as never;

      tab.bind(mockComponent, 'name' as never);

      // Trigger the initial debounced updateValidatorEl
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      if (changeCallback) {
        await changeCallback('newValue');
        // Advance debounce timer and run requestAnimationFrame
        vi.advanceTimersByTime(200);
        await vi.runAllTimersAsync();
      }
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle validatorEl focus, blur and click events', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      const parentEl = document.createElement('div');
      const validatorEl = document.createElement('input');
      parentEl.appendChild(validatorEl);
      validatorEl.isActiveElement = vi.fn(() => false);

      const mockComponent: MockValueComponentWithValidator & ValueComponentWithChangeTracking<string> = {
        onChange: vi.fn(() => mockComponent),
        setValue: vi.fn(),
        validatorEl
      } as never;

      tab.bind(mockComponent, 'name' as never);

      // Trigger focus, blur, click events on validatorEl
      validatorEl.dispatchEvent(new Event('focus'));
      validatorEl.dispatchEvent(new Event('blur'));
      validatorEl.dispatchEvent(new Event('click'));

      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle updateValidatorEl with empty validation and shouldShowValidationMessage=false', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      const parentEl = document.createElement('div');
      const validatorEl = document.createElement('input');
      parentEl.appendChild(validatorEl);
      validatorEl.isActiveElement = vi.fn(() => false);

      let changeCallback: ((value: string) => Promise<void>) | undefined;
      const mockComponent: MockValueComponentWithValidator & ValueComponentWithChangeTracking<string> = {
        onChange: vi.fn((cb: (value: string) => Promise<void>) => {
          changeCallback = cb;
          return mockComponent;
        }),
        setValue: vi.fn(),
        validatorEl
      } as never;

      vi.mocked(pluginSettingsComponent.setProperty).mockResolvedValue('Validation error');

      tab.bind(mockComponent, 'name' as never, { shouldShowValidationMessage: false });

      if (changeCallback) {
        await changeCallback('badValue');
        vi.advanceTimersByTime(200);
        await vi.runAllTimersAsync();
      }
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle updateValidatorEl with shouldEmptyOnBlur and trigger shouldSkipOnChange', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      let changeCallback: ((value: string) => Promise<void>) | undefined;
      const mockComponent = createTextBasedMockComponent();

      // Track onChange registrations
      mockComponent.onChange = vi.fn((cb: (value: string) => Promise<void>) => {
        changeCallback = cb;
        return mockComponent;
      }) as never;

      // IsEmpty returns false so that the empty-on-blur path triggers
      mockComponent.isEmpty = vi.fn(() => false) as never;

      // When empty() is called (inside updateValidatorEl), it should trigger onChange
      // Which should hit the shouldSkipOnChange early return
      mockComponent.empty = vi.fn(() => {
        // Simulate that empty() triggers onChange callback
        changeCallback?.('').catch(() => {
          noop();
        });
      }) as never;

      tab.bind(mockComponent, 'name' as never);

      // Trigger onChange with value equal to default to set shouldEmptyOnBlur=true
      if (changeCallback) {
        await changeCallback('default');
        // Advance timers to trigger debounced updateValidatorEl
        // UpdateValidatorEl will see shouldEmptyOnBlur=true, call textBasedComponent.empty()
        // Which triggers onChange with shouldSkipOnChange=true (lines 299-300)
        vi.advanceTimersByTime(200);
        await vi.runAllTimersAsync();
      }

      expect(mockComponent.empty).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle updateValidatorEl with shouldRevertToDefaultValueOnBlur and empty text', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      let changeCallback: ((value: string) => Promise<void>) | undefined;
      const mockComponent = createTextBasedMockComponent();
      mockComponent.onChange = vi.fn((cb: (value: string) => Promise<void>) => {
        changeCallback = cb;
        return mockComponent;
      }) as never;

      // IsEmpty returns true during onChange (triggers shouldRevertToDefaultValueOnBlur)
      mockComponent.isEmpty = vi.fn(() => true) as never;

      tab.bind(mockComponent, 'name' as never);

      if (changeCallback) {
        await changeCallback('');
        // Advance timers to trigger debounced updateValidatorEl
        vi.advanceTimersByTime(200);
        await vi.runAllTimersAsync();

        // At this point updateValidatorEl should have been called with shouldRevertToDefaultValueOnBlur=true
        // And textBasedComponent.isEmpty() returns true, so it should call setValue with default
        expect(mockComponent.setValue).toHaveBeenCalled();
      }
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle shouldRevertToDefaultValueOnBlur where isEmpty returns false in updateValidatorEl', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      let changeCallback: ((value: string) => Promise<void>) | undefined;
      const mockComponent = createTextBasedMockComponent();
      mockComponent.onChange = vi.fn((cb: (value: string) => Promise<void>) => {
        changeCallback = cb;
        return mockComponent;
      }) as never;
      // During onChange: isEmpty=true at line 308 (triggers shouldRevertToDefaultValueOnBlur=true)
      // During updateValidatorEl: isEmpty=false at line 365 (user has typed something, skip setValue)
      let isInUpdateValidator = false;
      mockComponent.isEmpty = vi.fn(() => {
        return !isInUpdateValidator;
      }) as never;

      tab.bind(mockComponent, 'name' as never);

      if (changeCallback) {
        await changeCallback('');
        isInUpdateValidator = true;
        vi.advanceTimersByTime(200);
      }
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle updateValidatorEl with validationMessage and shouldShowValidationMessage=true with tooltipEl', async () => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame to execute callback synchronously
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      const parentEl = document.createElement('div');
      const validatorEl = document.createElement('input');
      parentEl.appendChild(validatorEl);
      validatorEl.isActiveElement = vi.fn(() => false);

      let changeCallback: ((value: string) => Promise<void>) | undefined;
      const mockComponent: MockValueComponentWithValidator & ValueComponentWithChangeTracking<string> = {
        onChange: vi.fn((cb: (value: string) => Promise<void>) => {
          changeCallback = cb;
          return mockComponent;
        }),
        setValue: vi.fn(),
        validatorEl
      } as never;

      vi.mocked(pluginSettingsComponent.setProperty).mockResolvedValue('Error message');

      // ShouldShowValidationMessage defaults to true
      tab.bind(mockComponent, 'name' as never);

      if (changeCallback) {
        await changeCallback('badValue');
        vi.advanceTimersByTime(200);
      }
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle updateValidatorEl when validatorEl is active (isActiveElement=true)', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      const parentEl = document.createElement('div');
      const validatorEl = document.createElement('input');
      parentEl.appendChild(validatorEl);
      // IsActiveElement returns true - should NOT trigger empty/revert logic
      validatorEl.isActiveElement = vi.fn(() => true);

      let changeCallback: ((value: string) => Promise<void>) | undefined;
      const mockComponent: MockValueComponentWithValidator & ValueComponentWithChangeTracking<string> = {
        onChange: vi.fn((cb: (value: string) => Promise<void>) => {
          changeCallback = cb;
          return mockComponent;
        }),
        setValue: vi.fn(),
        validatorEl
      } as never;

      tab.bind(mockComponent, 'name' as never);

      if (changeCallback) {
        await changeCallback('value');
        vi.advanceTimersByTime(200);
      }
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle shouldEmptyOnBlur when text IS already empty', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      let changeCallback: ((value: string) => Promise<void>) | undefined;
      const mockComponent = createTextBasedMockComponent();
      mockComponent.onChange = vi.fn((cb: (value: string) => Promise<void>) => {
        changeCallback = cb;
        return mockComponent;
      }) as never;
      // During onChange: isEmpty=false at lines 308 and 323
      // (shouldRevertToDefaultValueOnBlur=false, and shouldEmptyOnBlur gets set to true)
      // During updateValidatorEl: isEmpty=true at line 358
      // (text IS already empty, so skip calling empty())
      let isInUpdateValidator = false;
      mockComponent.isEmpty = vi.fn(() => {
        // In updateValidatorEl context, return true (already empty)
        // In onChange context, return false (not empty)
        return isInUpdateValidator;
      }) as never;

      tab.bind(mockComponent, 'name' as never);

      if (changeCallback) {
        // Trigger with default value to set shouldEmptyOnBlur
        await changeCallback('default');
        // Before the debounced callback runs, mark that we're in updateValidator
        isInUpdateValidator = true;
        vi.advanceTimersByTime(200);
      }
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle shouldShowValidationMessage=false with no validation message', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      const parentEl = document.createElement('div');
      const validatorEl = document.createElement('input');
      parentEl.appendChild(validatorEl);
      validatorEl.isActiveElement = vi.fn(() => false);

      let changeCallback: ((value: string) => Promise<void>) | undefined;
      const mockComponent: MockValueComponentWithValidator & ValueComponentWithChangeTracking<string> = {
        onChange: vi.fn((cb: (value: string) => Promise<void>) => {
          changeCallback = cb;
          return mockComponent;
        }),
        setValue: vi.fn(),
        validatorEl
      } as never;

      // No validation error
      vi.mocked(pluginSettingsComponent.setProperty).mockResolvedValue('');

      tab.bind(mockComponent, 'name' as never, { shouldShowValidationMessage: false });

      if (changeCallback) {
        await changeCallback('validValue');
        vi.advanceTimersByTime(200);
      }
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('should handle missing validation message in settingsState (null coalescing)', () => {
    const plugin = createMockPlugin(app);
    // Create a special settings component where validationMessages has no 'name' key
    const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    const pluginSettingsComponent = {
      defaultSettings: { enabled: false, name: 'default' },
      on: vi.fn((name: string, callback: (...args: unknown[]) => void) => {
        const existing = listeners.get(name) ?? [];
        existing.push(callback);
        listeners.set(name, existing);
        return { asyncEvents: { offref: vi.fn() } };
      }),
      revalidate: vi.fn(() => Promise.resolve({ enabled: '', name: '' })),
      saveToFile: vi.fn(() => Promise.resolve()),
      setProperty: vi.fn(() => Promise.resolve('')),
      settingsState: {
        effectiveValues: { enabled: false, name: 'test' },
        inputValues: { enabled: false, name: 'test' },
        // Plain object without 'name' key to trigger the ?? '' fallback
        validationMessages: { enabled: '' } as Record<string, string>
      }
    } as never;

    const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
    tab.display();

    const mockComponent: ValueComponentWithChangeTracking<string> = {
      onChange: vi.fn(() => mockComponent),
      setValue: vi.fn()
    } as never;

    tab.bind(mockComponent, 'name' as never);
  });

  it('should handle validationMessageChanged event in bind', async () => {
    vi.useFakeTimers();
    stubRequestAnimationFrame();
    try {
      const plugin = createMockPlugin(app);
      const pluginSettingsComponent = createMockSettingsComponent();
      const tab = new TestSettingsTab({ plugin, pluginSettingsComponent });
      tab.display();

      const parentEl = document.createElement('div');
      const validatorEl = document.createElement('input');
      parentEl.appendChild(validatorEl);
      validatorEl.isActiveElement = vi.fn(() => false);

      const mockComponent: MockValueComponentWithValidator & ValueComponentWithChangeTracking<string> = {
        onChange: vi.fn(() => mockComponent),
        setValue: vi.fn(),
        validatorEl
      } as never;

      tab.bind(mockComponent, 'name' as never);

      // Trigger the validationMessageChanged event through updateValidations
      const saveSettingsCall = vi.mocked(pluginSettingsComponent.on).mock.calls.find(
        (call: unknown[]) => call[0] === 'saveSettings'
      );
      const saveSettingsCallback = saveSettingsCall?.[1] as (
        newState: unknown,
        oldState: unknown,
        context: unknown
      ) => Promise<void>;

      await saveSettingsCallback(
        { validationMessages: { enabled: '', name: 'Name is required' } },
        {},
        SAVE_TO_FILE_CONTEXT
      );

      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

function createTextBasedMockComponent(): TextBasedMockComponentShape & ValueComponentWithChangeTracking<string> {
  const mockComponent = {
    empty: vi.fn(),
    isEmpty: vi.fn(() => false),
    onChange: vi.fn(() => mockComponent),
    setPlaceholderValue: vi.fn(() => mockComponent),
    setValue: vi.fn()
  };
  return mockComponent as never;
}
/* eslint-enable obsidianmd/prefer-active-doc -- re-enable after file-level disable */
