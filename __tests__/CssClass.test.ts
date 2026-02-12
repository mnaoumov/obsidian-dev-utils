import {
  describe,
  expect,
  it
} from 'vitest';

import { CssClass } from '../src/CssClass.ts';

describe('CssClass', () => {
  it.each([
    ['AlertModal', 'alert-modal'],
    ['CancelButton', 'cancel-button'],
    ['CheckboxComponent', 'checkbox-component'],
    ['CodeHighlighterComponent', 'code-highlighter-component'],
    ['ConfirmModal', 'confirm-modal'],
    ['DateComponent', 'date-component'],
    ['DateTimeComponent', 'datetime-component'],
    ['EmailComponent', 'email-component'],
    ['FileComponent', 'file-component'],
    ['IsPlaceholder', 'is-placeholder'],
    ['LibraryName', 'obsidian-dev-utils'],
    ['MonthComponent', 'month-component'],
    ['MultipleDropdownComponent', 'multiple-dropdown-component'],
    ['MultipleEmailComponent', 'multiple-email-component'],
    ['MultipleFileComponent', 'multiple-file-component'],
    ['MultipleTextComponent', 'multiple-text-component'],
    ['NumberComponent', 'number-component'],
    ['OkButton', 'ok-button'],
    ['OverlayValidator', 'overlay-validator'],
    ['PasswordComponent', 'password-component'],
    ['PluginSettingsTab', 'plugin-settings-tab'],
    ['PromptModal', 'prompt-modal'],
    ['SelectItemModal', 'select-item-modal'],
    ['SettingComponentWrapper', 'setting-component-wrapper'],
    ['TelephoneComponent', 'telephone-component'],
    ['TextBox', 'text-box'],
    ['TimeComponent', 'time-component'],
    ['Tooltip', 'tooltip'],
    ['TooltipArrow', 'tooltip-arrow'],
    ['TooltipValidator', 'tooltip-validator'],
    ['TriStateCheckboxComponent', 'tri-state-checkbox-component'],
    ['TypedDropdownComponent', 'typed-dropdown-component'],
    ['TypedMultipleDropdownComponent', 'typed-multiple-dropdown-component'],
    ['UrlComponent', 'url-component'],
    ['WeekComponent', 'week-component']
  ])('should have CssClass.%s equal to "%s"', (key: string, expectedValue: string) => {
    expect(CssClass[key as keyof typeof CssClass]).toBe(expectedValue);
  });
});
