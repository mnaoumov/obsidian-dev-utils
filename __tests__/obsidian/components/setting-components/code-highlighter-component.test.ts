// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { CodeHighlighterComponent } from '../../../../src/obsidian/components/setting-components/code-highlighter-component.ts';
import { assertNonNullable } from '../../../../src/type-guards.ts';

vi.mock('../../../../src/async.ts', () => ({
  convertAsyncToSync: vi.fn((fn: () => unknown) => fn),
  invokeAsyncSafely: vi.fn((fn: () => unknown) => {
    fn();
  })
}));

vi.mock('../../../../src/css-class.ts', () => ({
  CssClass: {
    CodeHighlighterComponent: 'code-highlighter-component',
    IsPlaceholder: 'is-placeholder',
    SettingComponentWrapper: 'setting-component-wrapper'
  }
}));

vi.mock('../../../../src/html-element.ts', () => ({
  toPx: vi.fn((n: number) => `${String(n)}px`)
}));

vi.mock('../../../../src/obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

vi.mock('obsidian-typings/implementations', () => ({
  loadPrism: vi.fn(() =>
    Promise.resolve({
      highlightElement: vi.fn()
    })
  )
}));

describe('CodeHighlighterComponent', () => {
  function createComponent(): CodeHighlighterComponent {
    const container = document.createElement('div');
    return new CodeHighlighterComponent(container);
  }

  it('should create with a textarea input element', () => {
    const comp = createComponent();
    expect(comp.inputEl).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('should return inputEl as validatorEl', () => {
    const comp = createComponent();
    expect(comp.validatorEl).toBe(comp.inputEl);
  });

  it('should set and get value', () => {
    const comp = createComponent();
    comp.setValue('console.log("hello")');
    expect(comp.getValue()).toBe('console.log("hello")');
  });

  it('should check isEmpty', () => {
    const comp = createComponent();
    expect(comp.isEmpty()).toBe(true);
    comp.setValue('code');
    expect(comp.isEmpty()).toBe(false);
  });

  it('should empty the component', () => {
    const comp = createComponent();
    comp.setValue('some code');
    comp.empty();
    expect(comp.getValue()).toBe('');
  });

  it('should set placeholder', () => {
    const comp = createComponent();
    comp.setPlaceholder('Enter code...');
  });

  it('should set placeholder value', () => {
    const comp = createComponent();
    comp.setPlaceholderValue('hint');
  });

  it('should set language', () => {
    const comp = createComponent();
    comp.setLanguage('javascript');
    comp.setLanguage('typescript');
  });

  it('should set tab size', () => {
    const comp = createComponent();
    comp.setTabSize(4);
  });

  it('should register onChange callback and forward current value', () => {
    const comp = createComponent();
    comp.setValue('test code');
    const callback = vi.fn();
    comp.onChange(callback);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- simulateChange is intended for test use.
    comp.simulateChange();
    expect(callback).toHaveBeenCalledWith('test code');
  });

  it('should set disabled state', () => {
    const comp = createComponent();
    comp.setDisabled(true);
    expect(comp.disabled).toBe(true);
  });

  it('should handle Tab key to insert spaces', () => {
    const comp = createComponent();
    comp.setValue('hello');
    comp.inputEl.selectionStart = 5;
    comp.inputEl.selectionEnd = 5;
    const event = new KeyboardEvent('keydown', { key: 'Tab' });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    comp.inputEl.dispatchEvent(event);
    expect(comp.getValue()).toBe('hello  ');
  });

  it('should handle Shift+Tab to remove spaces', () => {
    const comp = createComponent();
    comp.setValue('  hello');
    comp.inputEl.selectionStart = 2;
    comp.inputEl.selectionEnd = 2;
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    comp.inputEl.dispatchEvent(event);
    expect(comp.getValue()).toBe('hello');
  });

  it('should handle Shift+Tab when no spaces to remove', () => {
    const comp = createComponent();
    comp.setValue('hello');
    comp.inputEl.selectionStart = 0;
    comp.inputEl.selectionEnd = 0;
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    comp.inputEl.dispatchEvent(event);
    expect(comp.getValue()).toBe('hello');
  });

  it('should ignore non-Tab keys in handleKeyDown', () => {
    const comp = createComponent();
    comp.setValue('hello');
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    comp.inputEl.dispatchEvent(event);
    expect(comp.getValue()).toBe('hello');
  });

  it('should handle scroll sync', () => {
    const comp = createComponent();
    comp.inputEl.dispatchEvent(new Event('scroll'));
  });

  it('should handle Ctrl+Tab to focus next control', () => {
    const comp = createComponent();
    comp.setValue('hello');
    const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'Tab' });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    comp.inputEl.dispatchEvent(event);
  });

  it('should handle Ctrl+Shift+Tab to focus previous control', () => {
    const comp = createComponent();
    comp.setValue('hello');
    const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'Tab', shiftKey: true });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    comp.inputEl.dispatchEvent(event);
  });

  it('should remove existing language class and skip non-language classes', () => {
    const container = document.createElement('div');
    const comp = new CodeHighlighterComponent(container);
    comp.setLanguage('javascript');
    // Add a non-language class via DOM to trigger the false branch of startsWith check
    const preEl = container.querySelector('pre');
    assertNonNullable(preEl);
    preEl.classList.add('custom-class');
    comp.setLanguage('typescript');
    // Custom-class should remain, language-javascript should be replaced by language-typescript
    expect(preEl.classList.contains('custom-class')).toBe(true);
    expect(preEl.classList.contains('language-typescript')).toBe(true);
    expect(preEl.classList.contains('language-javascript')).toBe(false);
  });
});
