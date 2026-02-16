import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noop } from '../../src/Function.ts';
import { SettingEx } from '../../src/obsidian/SettingEx.ts';

const mocks = vi.hoisted(() => {
  class MockComponentClass {
    public disabled = false;
    public constructor(_containerEl: HTMLElement) {
      noop();
    }

    public setDisabled(disabled: boolean): this {
      this.disabled = disabled;
      return this;
    }

    public then(cb: (component: MockComponentClass) => unknown): this {
      cb(this);
      return this;
    }
  }
  return {
    MockComponent: MockComponentClass,
    requireApiVersion: vi.fn((_version: string) => true)
  };
});

vi.mock('obsidian', async (importOriginal) => {
  const original = await importOriginal<typeof import('obsidian')>();
  return {
    ...original,
    requireApiVersion: mocks.requireApiVersion
  };
});

vi.mock('../../src/obsidian/Components/SettingComponents/CheckboxComponent.ts', () => ({
  CheckboxComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/CodeHighlighterComponent.ts', () => ({
  CodeHighlighterComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/DateComponent.ts', () => ({
  DateComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/DateTimeComponent.ts', () => ({
  DateTimeComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/EmailComponent.ts', () => ({
  EmailComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/FileComponent.ts', () => ({
  FileComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/MonthComponent.ts', () => ({
  MonthComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/MultipleDropdownComponent.ts', () => ({
  MultipleDropdownComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/MultipleEmailComponent.ts', () => ({
  MultipleEmailComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/MultipleFileComponent.ts', () => ({
  MultipleFileComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/MultipleTextComponent.ts', () => ({
  MultipleTextComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/NumberComponent.ts', () => ({
  NumberComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/PasswordComponent.ts', () => ({
  PasswordComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/TelephoneComponent.ts', () => ({
  TelephoneComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/TimeComponent.ts', () => ({
  TimeComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/TriStateCheckboxComponent.ts', () => ({
  TriStateCheckboxComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/TypedDropdownComponent.ts', () => ({
  TypedDropdownComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/TypedMultipleDropdownComponent.ts', () => ({
  TypedMultipleDropdownComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/UrlComponent.ts', () => ({
  UrlComponent: mocks.MockComponent
}));
vi.mock('../../src/obsidian/Components/SettingComponents/WeekComponent.ts', () => ({
  WeekComponent: mocks.MockComponent
}));

describe('SettingEx', () => {
  let settingEx: SettingEx;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiVersion.mockReturnValue(true);
    settingEx = new SettingEx({} as HTMLElement);
  });

  describe('addComponentClass', () => {
    it('should create component and add it via addComponentSafe', () => {
      const cb = vi.fn();
      const result = settingEx.addComponentClass(mocks.MockComponent as never, cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalledWith(expect.any(mocks.MockComponent));
      expect(settingEx.components).toHaveLength(1);
    });
  });

  describe('addComponentSafe branches', () => {
    it('should use addComponent when requireApiVersion 1.11.0 is true and 0.16.0 is true', () => {
      mocks.requireApiVersion.mockReturnValue(true);
      const cb = vi.fn();
      settingEx.addComponentClass(mocks.MockComponent as never, cb);
      expect(cb).toHaveBeenCalled();
      expect(settingEx.components).toHaveLength(1);
    });

    it('should use addComponent inner branch when requireApiVersion 0.16.0 is false', () => {
      mocks.requireApiVersion.mockImplementation((version: string) => version !== '0.16.0');
      const cb = vi.fn();
      settingEx.addComponentClass(mocks.MockComponent as never, cb);
      expect(cb).toHaveBeenCalled();
      expect(settingEx.components).toHaveLength(1);
    });

    it('should push to components directly when requireApiVersion 1.11.0 is false', () => {
      mocks.requireApiVersion.mockReturnValue(false);
      const cb = vi.fn();
      settingEx.addComponentClass(mocks.MockComponent as never, cb);
      expect(cb).toHaveBeenCalled();
      expect(settingEx.components).toHaveLength(1);
    });
  });

  describe('addXxx methods', () => {
    it('should add checkbox component', () => {
      const cb = vi.fn();
      const result = settingEx.addCheckbox(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add code highlighter component', () => {
      const cb = vi.fn();
      const result = settingEx.addCodeHighlighter(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add date component', () => {
      const cb = vi.fn();
      const result = settingEx.addDate(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add date time component', () => {
      const cb = vi.fn();
      const result = settingEx.addDateTime(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add email component', () => {
      const cb = vi.fn();
      const result = settingEx.addEmail(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add file component', () => {
      const cb = vi.fn();
      const result = settingEx.addFile(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add month component', () => {
      const cb = vi.fn();
      const result = settingEx.addMonth(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add multiple dropdown component', () => {
      const cb = vi.fn();
      const result = settingEx.addMultipleDropdown(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add multiple email component', () => {
      const cb = vi.fn();
      const result = settingEx.addMultipleEmail(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add multiple file component', () => {
      const cb = vi.fn();
      const result = settingEx.addMultipleFile(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add multiple text component', () => {
      const cb = vi.fn();
      const result = settingEx.addMultipleText(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add number component', () => {
      const cb = vi.fn();
      const result = settingEx.addNumber(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add password component', () => {
      const cb = vi.fn();
      const result = settingEx.addPassword(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add telephone component', () => {
      const cb = vi.fn();
      const result = settingEx.addTelephone(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add time component', () => {
      const cb = vi.fn();
      const result = settingEx.addTime(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add tri state checkbox component', () => {
      const cb = vi.fn();
      const result = settingEx.addTriStateCheckbox(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add typed dropdown component', () => {
      const cb = vi.fn();
      const result = settingEx.addTypedDropdown(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add typed multiple dropdown component', () => {
      const cb = vi.fn();
      const result = settingEx.addTypedMultipleDropdown(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add url component', () => {
      const cb = vi.fn();
      const result = settingEx.addUrl(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });

    it('should add week component', () => {
      const cb = vi.fn();
      const result = settingEx.addWeek(cb);
      expect(result).toBe(settingEx);
      expect(cb).toHaveBeenCalled();
    });
  });
});
