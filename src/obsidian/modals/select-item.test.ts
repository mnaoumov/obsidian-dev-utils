// @vitest-environment jsdom

import type {
  App as AppOriginal,
  FuzzyMatch
} from 'obsidian';

import { FuzzySuggestModal } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { selectItem } from './select-item.ts';

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

vi.mock('../../css-class.ts', () => ({
  CssClass: {
    SelectItemModal: 'select-item-modal'
  }
}));

vi.mock('../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('selectItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve null when modal is closed without selection', async () => {
    const result = await selectItem({
      app,
      items: ['a', 'b', 'c'],
      itemTextFunc: (item: string) => item
    });
    // Modal opens, onOpen is called, then immediately closes (onClose resolves null)
    expect(result).toBeNull();
  });

  it('should accept custom placeholder', async () => {
    const result = await selectItem({
      app,
      items: [1, 2, 3],
      itemTextFunc: (item: number) => String(item),
      placeholder: 'Select a number'
    });
    expect(result).toBeNull();
  });

  it('should accept custom css class', async () => {
    const result = await selectItem({
      app,
      cssClass: 'custom-select',
      items: ['x'],
      itemTextFunc: (item: string) => item
    });
    expect(result).toBeNull();
  });

  it('should resolve with selected item when selectSuggestion is called', async () => {
    vi.useFakeTimers();
    vi.spyOn(FuzzySuggestModal.prototype, 'open').mockImplementation(
      function openOverride(this: FuzzySuggestModal<string>): void {
        this.onOpen();
      }
    );

    const promise = selectItem({
      app,
      items: ['a', 'b', 'c'],
      itemTextFunc: (item: string) => item.toUpperCase()
    });

    const modal = vi.mocked(FuzzySuggestModal.prototype.open).mock.contexts[0] as FuzzySuggestModal<string> | undefined;
    assertNonNullable(modal);
    modal.selectSuggestion(strictProxy<FuzzyMatch<string>>({ item: 'b' }), castTo<MouseEvent>(new Event('click')));

    const result = await promise;
    expect(result).toBe('b');

    vi.mocked(FuzzySuggestModal.prototype.open).mockRestore();
    vi.useRealTimers();
  });

  it('should return items from getItems', async () => {
    vi.useFakeTimers();
    vi.spyOn(FuzzySuggestModal.prototype, 'open').mockImplementation(
      function openOverride(this: FuzzySuggestModal<string>): void {
        this.onOpen();
      }
    );

    const items = ['x', 'y', 'z'];
    const promise = selectItem({
      app,
      items,
      itemTextFunc: (item: string) => item
    });

    const modal = vi.mocked(FuzzySuggestModal.prototype.open).mock.contexts[0] as FuzzySuggestModal<string> | undefined;
    assertNonNullable(modal);
    expect(modal.getItems()).toEqual(['x', 'y', 'z']);
    expect(modal.getItemText('x')).toBe('x');

    // Close the modal to resolve the promise
    modal.close();
    const result = await promise;
    expect(result).toBeNull();

    vi.mocked(FuzzySuggestModal.prototype.open).mockRestore();
    vi.useRealTimers();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
