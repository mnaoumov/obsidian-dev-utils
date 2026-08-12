// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';
import type {
  ButtonComponent,
  TextComponent
} from 'obsidian-test-mocks/obsidian';
import type { MockInstance } from 'vitest';

import {
  ButtonComponent as ButtonComponentOriginal,
  TextComponent as TextComponentOriginal
} from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../../object-utils.ts';
import { mockImplementation } from '../../test-helpers/mock-implementation.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { prompt } from './prompt.ts';

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

vi.mock('../../async.ts', () => ({
  convertAsyncToSync: vi.fn(($function: () => unknown) => $function),
  invokeAsyncSafely: vi.fn(($function: () => unknown) => {
    $function();
  })
}));

vi.mock('../css-class.ts', () => ({
  CssClass: {
    CancelButton: 'cancel-button',
    OkButton: 'ok-button',
    PromptModal: 'prompt-modal',
    TextBox: 'text-box',
    Untouched: 'untouched'
  }
}));

vi.mock('../../function.ts', () => ({
  noop: vi.fn()
}));

vi.mock('../../obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((selector: unknown) => {
    if (typeof selector === 'function') {
      const proxy: unknown = new Proxy({}, { get: (): unknown => proxy });
      (selector as (root: unknown) => unknown)(proxy);
    }
    return 'mock-translation';
  })
}));

vi.mock('../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('prompt', () => {
  const buttonInstances: ButtonComponentOriginal[] = [];
  const textInstances: TextComponentOriginal[] = [];
  let reportValiditySpy: MockInstance;

  // Installed once for the whole file: a per-test `vi.spyOn` would wrap the previous spy every time.
  // `vi.clearAllMocks()` below resets its recorded calls without uninstalling it.
  beforeAll(() => {
    reportValiditySpy = vi.spyOn(HTMLInputElement.prototype, 'reportValidity');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    buttonInstances.length = 0;
    textInstances.length = 0;
    mockImplementation({
      $object: ButtonComponentOriginal.prototype,
      impl: function impl(this: ButtonComponentOriginal, originalImplementation, containerEl: HTMLElement): ButtonComponentOriginal {
        originalImplementation.call(this, containerEl);
        buttonInstances.push(this);
        return this;
      },
      method: 'constructor2__'
    });
    mockImplementation({
      $object: TextComponentOriginal.prototype,
      impl: function impl(this: TextComponentOriginal, originalImplementation, containerEl: HTMLElement): TextComponentOriginal {
        originalImplementation.call(this, containerEl);
        textInstances.push(this);
        return this;
      },
      method: 'constructor4__'
    });
  });

  it('should resolve null when modal is closed without clicking OK', async () => {
    const result = await prompt({
      app
    });
    expect(result).toBeNull();
  });

  it('should resolve value when OK button is clicked', async () => {
    const resultPromise = prompt({
      app,
      defaultValue: 'hello'
    });
    queueMicrotask(() => {
      const okButton = buttonInstances[0];
      castTo<ButtonComponent>(okButton).simulateClick__();
    });
    const result = await resultPromise;
    expect(result).toBe('hello');
  });

  it('should resolve value when Enter key is pressed', async () => {
    const resultPromise = prompt({
      app,
      defaultValue: 'enter-value'
    });
    queueMicrotask(() => {
      const textComp = textInstances[0];
      castTo<TextComponent>(textComp).simulateEvent__('keydown', { key: 'Enter', preventDefault: vi.fn() });
    });
    const result = await resultPromise;
    expect(result).toBe('enter-value');
  });

  it('should close when Escape key is pressed', async () => {
    const resultPromise = prompt({
      app,
      defaultValue: 'escape-value'
    });
    queueMicrotask(() => {
      const textComp = textInstances[0];
      castTo<TextComponent>(textComp).simulateEvent__('keydown', { key: 'Escape', preventDefault: vi.fn() });
    });
    const result = await resultPromise;
    expect(result).toBeNull();
  });

  it('should ignore non-Enter non-Escape keys', async () => {
    const resultPromise = prompt({
      app,
      defaultValue: 'other-key'
    });
    queueMicrotask(() => {
      const textComp = textInstances[0];
      castTo<TextComponent>(textComp).simulateEvent__('keydown', { key: 'a', preventDefault: vi.fn() });
    });
    const result = await resultPromise;
    expect(result).toBeNull();
  });

  it('should not submit when input is invalid', async () => {
    const resultPromise = prompt({
      app,
      defaultValue: 'invalid'
    });
    queueMicrotask(() => {
      const textComp = ensureNonNullable(textInstances[0]);
      // Make checkValidity return false
      textComp.inputEl.checkValidity = (): boolean => false;
      const okButton = ensureNonNullable(buttonInstances[0]);
      castTo<ButtonComponent>(okButton).simulateClick__();
    });
    const result = await resultPromise;
    // Since checkValidity is false, handleOk returns early - isOkClicked stays false
    // Modal auto-closes via setTimeout, resolving null
    expect(result).toBeNull();
  });

  it('should accept default value and placeholder', async () => {
    const result = await prompt({
      app,
      defaultValue: 'test value',
      placeholder: 'Enter text...',
      title: 'Input'
    });
    expect(result).toBeNull();
  });

  it('should accept custom button texts', async () => {
    const result = await prompt({
      app,
      cancelButtonText: 'Dismiss',
      okButtonText: 'Submit'
    });
    expect(result).toBeNull();
  });

  it('should update value when onChange callback fires and resolve the new value', async () => {
    const resultPromise = prompt({
      app,
      defaultValue: 'initial'
    });
    queueMicrotask(() => {
      const textComp = textInstances[0];
      castTo<TextComponent>(textComp).setValue('updated');
      const okButton = buttonInstances[0];
      castTo<ButtonComponent>(okButton).simulateClick__();
    });
    const result = await resultPromise;
    expect(result).toBe('updated');
  });

  it('should accept a value validator', async () => {
    const validator = vi.fn(() => undefined);
    const result = await prompt({
      app,
      valueValidator: validator
    });
    expect(result).toBeNull();
  });

  it('should not report validity on open', async () => {
    const result = await prompt({
      app,
      valueValidator: (value) => value === '' ? 'Value cannot be empty' : undefined
    });
    expect(result).toBeNull();
    expect(reportValiditySpy).not.toHaveBeenCalled();
  });

  it('should report validity once the value is edited', async () => {
    const resultPromise = prompt({
      app,
      valueValidator: (value) => value === '' ? 'Value cannot be empty' : undefined
    });
    queueMicrotask(() => {
      const textComp = ensureNonNullable(textInstances[0]);
      castTo<TextComponent>(textComp).simulateEvent__('input');
    });
    const result = await resultPromise;
    expect(result).toBeNull();
    expect(reportValiditySpy).toHaveBeenCalled();
  });

  it('should not report validity when the input is focused before it is edited', async () => {
    const resultPromise = prompt({
      app,
      valueValidator: (value) => value === '' ? 'Value cannot be empty' : undefined
    });
    queueMicrotask(() => {
      const textComp = ensureNonNullable(textInstances[0]);
      castTo<TextComponent>(textComp).simulateEvent__('focus');
    });
    const result = await resultPromise;
    expect(result).toBeNull();
    expect(reportValiditySpy).not.toHaveBeenCalled();
  });

  it('should report validity when the input is focused after it is edited', async () => {
    const resultPromise = prompt({
      app,
      valueValidator: (value) => value === '' ? 'Value cannot be empty' : undefined
    });
    queueMicrotask(() => {
      const textComp = ensureNonNullable(textInstances[0]);
      castTo<TextComponent>(textComp).simulateEvent__('input');
      castTo<TextComponent>(textComp).simulateEvent__('focus');
    });
    const result = await resultPromise;
    expect(result).toBeNull();
    expect(reportValiditySpy).toHaveBeenCalledTimes(2);
  });

  it('should mark the input as untouched on open', async () => {
    let hasUntouchedClassOnOpen = null as boolean | null;
    const resultPromise = prompt({
      app,
      valueValidator: (value) => value === '' ? 'Value cannot be empty' : undefined
    });
    queueMicrotask(() => {
      const textComp = ensureNonNullable(textInstances[0]);
      hasUntouchedClassOnOpen = textComp.inputEl.classList.contains('untouched');
    });
    const result = await resultPromise;
    expect(result).toBeNull();
    expect(hasUntouchedClassOnOpen).toBe(true);
  });

  it('should stop marking the input as untouched once the value is edited', async () => {
    let hasUntouchedClassAfterInput = null as boolean | null;
    const resultPromise = prompt({
      app,
      valueValidator: (value) => value === '' ? 'Value cannot be empty' : undefined
    });
    queueMicrotask(() => {
      const textComp = ensureNonNullable(textInstances[0]);
      castTo<TextComponent>(textComp).simulateEvent__('input');
      hasUntouchedClassAfterInput = textComp.inputEl.classList.contains('untouched');
    });
    const result = await resultPromise;
    expect(result).toBeNull();
    expect(hasUntouchedClassAfterInput).toBe(false);
  });

  it('should stop marking the input as untouched when OK is clicked with an invalid value', async () => {
    let hasUntouchedClassAfterOk = null as boolean | null;
    const resultPromise = prompt({
      app,
      valueValidator: (value) => value === '' ? 'Value cannot be empty' : undefined
    });
    queueMicrotask(() => {
      const okButton = ensureNonNullable(buttonInstances[0]);
      castTo<ButtonComponent>(okButton).simulateClick__();
      const textComp = ensureNonNullable(textInstances[0]);
      hasUntouchedClassAfterOk = textComp.inputEl.classList.contains('untouched');
    });
    const result = await resultPromise;
    expect(result).toBeNull();
    expect(hasUntouchedClassAfterOk).toBe(false);
  });

  it('should report validity and not submit when OK is clicked with an invalid value', async () => {
    const resultPromise = prompt({
      app,
      valueValidator: (value) => value === '' ? 'Value cannot be empty' : undefined
    });
    queueMicrotask(() => {
      const okButton = ensureNonNullable(buttonInstances[0]);
      castTo<ButtonComponent>(okButton).simulateClick__();
    });
    const result = await resultPromise;
    expect(result).toBeNull();
    expect(reportValiditySpy).toHaveBeenCalled();
  });
});
