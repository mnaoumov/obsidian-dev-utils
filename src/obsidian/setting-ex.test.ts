// @vitest-environment jsdom

import { Setting } from 'obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noop } from '../function.ts';
import {
  adoptSettingEx,
  SettingEx
} from './setting-ex.ts';

const mocks = vi.hoisted(() => {
  class MockComponentClass {
    public disabled = false;
    public constructor(_containerElement: HTMLElement) {
      noop();
    }

    public setDisabled(disabled: boolean): this {
      this.disabled = disabled;
      return this;
    }

    public then(callback: (component: MockComponentClass) => unknown): this {
      callback(this);
      return this;
    }
  }
  return {
    MockComponent: MockComponentClass
  };
});

vi.mock('../obsidian/components/setting-components/checkbox-component.ts', () => ({
  CheckboxComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/code-highlighter-component.ts', () => ({
  CodeHighlighterComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/date-component.ts', () => ({
  DateComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/date-time-component.ts', () => ({
  DateTimeComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/email-component.ts', () => ({
  EmailComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/file-component.ts', () => ({
  FileComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/month-component.ts', () => ({
  MonthComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/multiple-dropdown-component.ts', () => ({
  MultipleDropdownComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/multiple-email-component.ts', () => ({
  MultipleEmailComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/multiple-file-component.ts', () => ({
  MultipleFileComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/multiple-text-component.ts', () => ({
  MultipleTextComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/number-component.ts', () => ({
  NumberComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/password-component.ts', () => ({
  PasswordComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/telephone-component.ts', () => ({
  TelephoneComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/time-component.ts', () => ({
  TimeComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/tri-state-checkbox-component.ts', () => ({
  TriStateCheckboxComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/typed-dropdown-component.ts', () => ({
  TypedDropdownComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/typed-multiple-dropdown-component.ts', () => ({
  TypedMultipleDropdownComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/url-component.ts', () => ({
  UrlComponent: mocks.MockComponent
}));
vi.mock('../obsidian/components/setting-components/week-component.ts', () => ({
  WeekComponent: mocks.MockComponent
}));

describe('SettingEx', () => {
  let settingEx: SettingEx;

  beforeEach(() => {
    vi.clearAllMocks();
    settingEx = new SettingEx(createDiv());
  });

  describe('addComponentClass', () => {
    it('should create component and add it', () => {
      const callback = vi.fn();
      const result = settingEx.addComponentClass(mocks.MockComponent, callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalledWith(expect.any(mocks.MockComponent));
      expect(settingEx.components).toHaveLength(1);
    });
  });

  describe('addXxx methods', () => {
    it('should add checkbox component', () => {
      const callback = vi.fn();
      const result = settingEx.addCheckbox(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add code highlighter component', () => {
      const callback = vi.fn();
      const result = settingEx.addCodeHighlighter(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add date component', () => {
      const callback = vi.fn();
      const result = settingEx.addDate(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add date time component', () => {
      const callback = vi.fn();
      const result = settingEx.addDateTime(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add email component', () => {
      const callback = vi.fn();
      const result = settingEx.addEmail(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add file component', () => {
      const callback = vi.fn();
      const result = settingEx.addFile(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add month component', () => {
      const callback = vi.fn();
      const result = settingEx.addMonth(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add multiple dropdown component', () => {
      const callback = vi.fn();
      const result = settingEx.addMultipleDropdown(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add multiple email component', () => {
      const callback = vi.fn();
      const result = settingEx.addMultipleEmail(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add multiple file component', () => {
      const callback = vi.fn();
      const result = settingEx.addMultipleFile(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add multiple text component', () => {
      const callback = vi.fn();
      const result = settingEx.addMultipleText(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add number component', () => {
      const callback = vi.fn();
      const result = settingEx.addNumber(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add password component', () => {
      const callback = vi.fn();
      const result = settingEx.addPassword(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add telephone component', () => {
      const callback = vi.fn();
      const result = settingEx.addTelephone(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add time component', () => {
      const callback = vi.fn();
      const result = settingEx.addTime(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add tri state checkbox component', () => {
      const callback = vi.fn();
      const result = settingEx.addTriStateCheckbox(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add typed dropdown component', () => {
      const callback = vi.fn();
      const result = settingEx.addTypedDropdown(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add typed multiple dropdown component', () => {
      const callback = vi.fn();
      const result = settingEx.addTypedMultipleDropdown(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add url component', () => {
      const callback = vi.fn();
      const result = settingEx.addUrl(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });

    it('should add week component', () => {
      const callback = vi.fn();
      const result = settingEx.addWeek(callback);
      expect(result).toBe(settingEx);
      expect(callback).toHaveBeenCalled();
    });
  });
});

describe('adoptSettingEx', () => {
  it('should adopt a plain setting in place', () => {
    const setting = new Setting(createDiv());

    const adopted = adoptSettingEx(setting);

    // Obsidian keeps rendering the very object it created, so adoption must not replace it.
    expect(adopted).toBe(setting);
    expect(adopted).toBeInstanceOf(SettingEx);
    const callback = vi.fn();
    adopted.addNumber(callback);
    expect(callback).toHaveBeenCalled();
  });

  it('should leave an already adopted setting untouched', () => {
    const settingEx = new SettingEx(createDiv());

    expect(adoptSettingEx(settingEx)).toBe(settingEx);
  });
});
