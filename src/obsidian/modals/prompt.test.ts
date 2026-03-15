// @vitest-environment jsdom

import type {
  ButtonComponent as MockButtonComponent,
  TextComponent as MockTextComponent
} from 'obsidian-test-mocks/obsidian';

import {
  ButtonComponent,
  TextComponent
} from 'obsidian';
import {
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

vi.mock('../../async.ts', () => ({
  convertAsyncToSync: vi.fn((fn: () => unknown) => fn),
  invokeAsyncSafely: vi.fn((fn: () => unknown) => {
    fn();
  })
}));

vi.mock('../../css-class.ts', () => ({
  CssClass: {
    CancelButton: 'cancel-button',
    OkButton: 'ok-button',
    PromptModal: 'prompt-modal',
    TextBox: 'text-box'
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
  const buttonInstances: ButtonComponent[] = [];
  const textInstances: TextComponent[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    buttonInstances.length = 0;
    textInstances.length = 0;
    mockImplementation(
      ButtonComponent.prototype,
      'constructor2__',
      function captureButton(this: ButtonComponent, originalImplementation, containerEl: HTMLElement): ButtonComponent {
        originalImplementation.call(this, containerEl);
        buttonInstances.push(this);
        return this;
      }
    );
    mockImplementation(
      TextComponent.prototype,
      'constructor4__',
      function captureText(this: TextComponent, originalImplementation, containerEl: HTMLElement): TextComponent {
        originalImplementation.call(this, containerEl);
        textInstances.push(this);
        return this;
      }
    );
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
      const okButton = buttonInstances[0];
      castTo<MockButtonComponent>(okButton).simulateClick__();
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
      const textComp = textInstances[0];
      castTo<MockTextComponent>(textComp).simulateEvent__('keydown', { key: 'Enter', preventDefault: vi.fn() });
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
      const textComp = textInstances[0];
      castTo<MockTextComponent>(textComp).simulateEvent__('keydown', { key: 'Escape', preventDefault: vi.fn() });
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
      const textComp = textInstances[0];
      castTo<MockTextComponent>(textComp).simulateEvent__('keydown', { key: 'a', preventDefault: vi.fn() });
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
      const textComp = ensureNonNullable(textInstances[0]);
      // Make checkValidity return false
      textComp.inputEl.checkValidity = (): boolean => false;
      const okButton = ensureNonNullable(buttonInstances[0]);
      castTo<MockButtonComponent>(okButton).simulateClick__();
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
