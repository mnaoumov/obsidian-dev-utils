// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';
import type { ButtonComponent } from 'obsidian-test-mocks/obsidian';

import { ButtonComponent as ButtonComponentOriginal } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../../object-utils.ts';
import { mockImplementation } from '../../test-helpers/mock-implementation.ts';
import { selectOption } from './select-option.ts';

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

vi.mock('../css-class.ts', () => ({
  CssClass: {
    SelectOptionModal: 'select-option-modal'
  }
}));

vi.mock('../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('selectOption', () => {
  const buttonInstances: ButtonComponentOriginal[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    buttonInstances.length = 0;
    mockImplementation({
      impl: function impl(this: ButtonComponentOriginal, originalImplementation, containerEl: HTMLElement): ButtonComponentOriginal {
        originalImplementation.call(this, containerEl);
        buttonInstances.push(this);
        return this;
      },
      method: 'constructor2__',
      obj: ButtonComponentOriginal.prototype
    });
  });

  it('should resolve null when the modal is dismissed without a choice', async () => {
    const result = await selectOption<string>({
      app,
      options: [
        { text: 'A', value: 'a' },
        { text: 'B', value: 'b' }
      ]
    });
    expect(result).toBeNull();
  });

  it('should render one button per option', async () => {
    const resultPromise = selectOption<string>({
      app,
      options: [
        { text: 'A', value: 'a' },
        { isCta: true, text: 'B', value: 'b' },
        { text: 'C', value: 'c' }
      ]
    });
    // OnOpen has run synchronously - buttons are created.
    expect(buttonInstances).toHaveLength(3);
    queueMicrotask(() => {
      castTo<ButtonComponent>(buttonInstances[0]).simulateClick__();
    });
    await resultPromise;
  });

  it('should resolve the chosen option value when its button is clicked', async () => {
    const resultPromise = selectOption<string>({
      app,
      message: 'Pick one',
      options: [
        { text: 'A', value: 'a' },
        { isCta: true, text: 'B', value: 'b' }
      ],
      title: 'Choose'
    });
    queueMicrotask(() => {
      castTo<ButtonComponent>(buttonInstances[1]).simulateClick__();
    });
    const result = await resultPromise;
    expect(result).toBe('b');
  });

  it('should accept a custom css class', async () => {
    const resultPromise = selectOption<number>({
      app,
      cssClasses: ['custom-select-option'],
      options: [{ text: 'One', value: 1 }]
    });
    queueMicrotask(() => {
      castTo<ButtonComponent>(buttonInstances[0]).simulateClick__();
    });
    const result = await resultPromise;
    expect(result).toBe(1);
  });
});
