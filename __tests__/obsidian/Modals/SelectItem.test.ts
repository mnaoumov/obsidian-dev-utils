import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { selectItem } from '../../../src/obsidian/Modals/SelectItem.ts';

vi.mock('../../../src/CssClass.ts', () => ({
  CssClass: {
    SelectItemModal: 'select-item-modal'
  }
}));

vi.mock('../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('selectItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve null when modal is closed without selection', async () => {
    const result = await selectItem({
      app: {} as never,
      items: ['a', 'b', 'c'],
      itemTextFunc: (item: string) => item
    });
    // Modal opens, onOpen is called, then immediately closes (onClose resolves null)
    expect(result).toBeNull();
  });

  it('should accept custom placeholder', async () => {
    const result = await selectItem({
      app: {} as never,
      items: [1, 2, 3],
      itemTextFunc: (item: number) => String(item),
      placeholder: 'Select a number'
    });
    expect(result).toBeNull();
  });

  it('should accept custom css class', async () => {
    const result = await selectItem({
      app: {} as never,
      cssClass: 'custom-select',
      items: ['x'],
      itemTextFunc: (item: string) => item
    });
    expect(result).toBeNull();
  });
});
