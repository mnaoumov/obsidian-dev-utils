import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { ButtonComponent } from '../../../__mocks__/obsidian/ButtonComponent.ts';
import { TextComponent } from '../../../__mocks__/obsidian/TextComponent.ts';
import { prompt } from '../../../src/obsidian/Modals/Prompt.ts';
import { ensureNonNullable } from '../../../src/TypeGuards.ts';

vi.mock('../../../src/Async.ts', () => ({
  convertAsyncToSync: vi.fn((fn: () => unknown) => fn),
  invokeAsyncSafely: vi.fn((fn: () => unknown) => {
    fn();
  })
}));

vi.mock('../../../src/CssClass.ts', () => ({
  CssClass: {
    CancelButton: 'cancel-button',
    OkButton: 'ok-button',
    PromptModal: 'prompt-modal',
    TextBox: 'text-box'
  }
}));

vi.mock('../../../src/Function.ts', () => ({
  noop: vi.fn()
}));

vi.mock('../../../src/obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((selector: unknown) => {
    if (typeof selector === 'function') {
      const proxy: unknown = new Proxy({}, { get: (): unknown => proxy });
      (selector as (root: unknown) => unknown)(proxy);
    }
    return 'mock-translation';
  })
}));

vi.mock('../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ButtonComponent.instances = [];
    TextComponent.instances = [];
  });

  it('should resolve null when modal is closed without clicking OK', async () => {
    const result = await prompt({
      app: {} as never
    });
    expect(result).toBeNull();
  });

  it('should resolve value when OK button is clicked', async () => {
    const resultPromise = prompt({
      app: {} as never,
      defaultValue: 'hello'
    });
    queueMicrotask(() => {
      const okButton = ButtonComponent.instances[0];
      okButton?.simulateClick();
    });
    const result = await resultPromise;
    expect(result).toBe('hello');
  });

  it('should resolve value when Enter key is pressed', async () => {
    const resultPromise = prompt({
      app: {} as never,
      defaultValue: 'enter-value'
    });
    queueMicrotask(() => {
      const textComp = TextComponent.instances[0];
      textComp?.simulateEvent('keydown', { key: 'Enter', preventDefault: vi.fn() });
    });
    const result = await resultPromise;
    expect(result).toBe('enter-value');
  });

  it('should close when Escape key is pressed', async () => {
    const resultPromise = prompt({
      app: {} as never,
      defaultValue: 'escape-value'
    });
    queueMicrotask(() => {
      const textComp = TextComponent.instances[0];
      textComp?.simulateEvent('keydown', { key: 'Escape', preventDefault: vi.fn() });
    });
    const result = await resultPromise;
    expect(result).toBeNull();
  });

  it('should ignore non-Enter non-Escape keys', async () => {
    const resultPromise = prompt({
      app: {} as never,
      defaultValue: 'other-key'
    });
    queueMicrotask(() => {
      const textComp = TextComponent.instances[0];
      textComp?.simulateEvent('keydown', { key: 'a', preventDefault: vi.fn() });
    });
    const result = await resultPromise;
    expect(result).toBeNull();
  });

  it('should not submit when input is invalid', async () => {
    const resultPromise = prompt({
      app: {} as never,
      defaultValue: 'invalid'
    });
    queueMicrotask(() => {
      const textComp = ensureNonNullable(TextComponent.instances[0]);
      // Make checkValidity return false
      textComp.inputEl.checkValidity = (): boolean => false;
      const okButton = ensureNonNullable(ButtonComponent.instances[0]);
      okButton.simulateClick();
    });
    const result = await resultPromise;
    // Since checkValidity is false, handleOk returns early - isOkClicked stays false
    // Modal auto-closes via setTimeout, resolving null
    expect(result).toBeNull();
  });

  it('should accept default value and placeholder', async () => {
    const result = await prompt({
      app: {} as never,
      defaultValue: 'test value',
      placeholder: 'Enter text...',
      title: 'Input'
    });
    expect(result).toBeNull();
  });

  it('should accept custom button texts', async () => {
    const result = await prompt({
      app: {} as never,
      cancelButtonText: 'Dismiss',
      okButtonText: 'Submit'
    });
    expect(result).toBeNull();
  });

  it('should accept a value validator', async () => {
    const validator = vi.fn(() => undefined);
    const result = await prompt({
      app: {} as never,
      valueValidator: validator
    });
    expect(result).toBeNull();
  });
});
