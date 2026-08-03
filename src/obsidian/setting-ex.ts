/**
 * @file
 *
 * Extends the Setting class with additional methods for adding components.
 */

import type { BaseComponent } from 'obsidian';

import { Setting } from 'obsidian';

import { castTo } from '../object-utils.ts';
import { CheckboxComponent } from './setting-components/checkbox-component.ts';
import { CodeHighlighterComponent } from './setting-components/code-highlighter-component.ts';
import { DateComponent } from './setting-components/date-component.ts';
import { DateTimeComponent } from './setting-components/date-time-component.ts';
import { EmailComponent } from './setting-components/email-component.ts';
import { FileComponent } from './setting-components/file-component.ts';
import { MonthComponent } from './setting-components/month-component.ts';
import { MultipleDropdownComponent } from './setting-components/multiple-dropdown-component.ts';
import { MultipleEmailComponent } from './setting-components/multiple-email-component.ts';
import { MultipleFileComponent } from './setting-components/multiple-file-component.ts';
import { MultipleTextComponent } from './setting-components/multiple-text-component.ts';
import { NumberComponent } from './setting-components/number-component.ts';
import { PasswordComponent } from './setting-components/password-component.ts';
import { TelephoneComponent } from './setting-components/telephone-component.ts';
import { TimeComponent } from './setting-components/time-component.ts';
import { TriStateCheckboxComponent } from './setting-components/tri-state-checkbox-component.ts';
import { TypedDropdownComponent } from './setting-components/typed-dropdown-component.ts';
import { TypedMultipleDropdownComponent } from './setting-components/typed-multiple-dropdown-component.ts';
import { UrlComponent } from './setting-components/url-component.ts';
import { WeekComponent } from './setting-components/week-component.ts';

/**
 * Extends the Setting class with additional methods for adding components.
 */
export class SettingEx extends Setting {
  /**
   * Adds a {@link CheckboxComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addCheckbox(callback: (checkbox: CheckboxComponent) => void): this {
    return this.addComponentClass(CheckboxComponent, callback);
  }

  /**
   * Adds a {@link CodeHighlighterComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addCodeHighlighter(callback: (codeHighlighter: CodeHighlighterComponent) => void): this {
    return this.addComponentClass(CodeHighlighterComponent, callback);
  }

  /**
   * Adds a component to the setting.
   *
   * @typeParam T - The type of the component to add.
   * @param componentClass - The class of the component to add.
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addComponentClass<T extends BaseComponent>(componentClass: new (containerEl: HTMLElement) => T, callback: (component: T) => void): this {
    return this.addComponent((element) => {
      const component = new componentClass(element);
      callback(component);
      return component;
    });
  }

  /**
   * Adds a {@link DateComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addDate(callback: (date: DateComponent) => void): this {
    return this.addComponentClass(DateComponent, callback);
  }

  /**
   * Adds a {@link DateTimeComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addDateTime(callback: (dateTime: DateTimeComponent) => void): this {
    return this.addComponentClass(DateTimeComponent, callback);
  }

  /**
   * Adds an {@link EmailComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addEmail(callback: (email: EmailComponent) => void): this {
    return this.addComponentClass(EmailComponent, callback);
  }

  /**
   * Adds a {@link FileComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addFile(callback: (file: FileComponent) => void): this {
    return this.addComponentClass(FileComponent, callback);
  }

  /**
   * Adds a {@link MonthComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMonth(callback: (month: MonthComponent) => void): this {
    return this.addComponentClass(MonthComponent, callback);
  }

  /**
   * Adds a {@link MultipleDropdownComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleDropdown(callback: (multipleDropdown: MultipleDropdownComponent) => void): this {
    return this.addComponentClass(MultipleDropdownComponent, callback);
  }

  /**
   * Adds a {@link MultipleEmailComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleEmail(callback: (multipleEmail: MultipleEmailComponent) => void): this {
    return this.addComponentClass(MultipleEmailComponent, callback);
  }

  /**
   * Adds a {@link MultipleFileComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleFile(callback: (multipleFile: MultipleFileComponent) => void): this {
    return this.addComponentClass(MultipleFileComponent, callback);
  }

  /**
   * Adds a {@link MultipleTextComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleText(callback: (multipleText: MultipleTextComponent) => void): this {
    return this.addComponentClass(MultipleTextComponent, callback);
  }

  /**
   * Adds a {@link NumberComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addNumber(callback: ($number: NumberComponent) => void): this {
    return this.addComponentClass(NumberComponent, callback);
  }

  /**
   * Adds a {@link PasswordComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addPassword(callback: (password: PasswordComponent) => void): this {
    return this.addComponentClass(PasswordComponent, callback);
  }

  /**
   * Adds a {@link TelephoneComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTelephone(callback: (telephone: TelephoneComponent) => void): this {
    return this.addComponentClass(TelephoneComponent, callback);
  }

  /**
   * Adds a {@link TimeComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTime(callback: (time: TimeComponent) => void): this {
    return this.addComponentClass(TimeComponent, callback);
  }

  /**
   * Adds a {@link TriStateCheckboxComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTriStateCheckbox(callback: (triStateCheckbox: TriStateCheckboxComponent) => void): this {
    return this.addComponentClass(TriStateCheckboxComponent, callback);
  }

  /**
   * Adds a {@link TypedDropdownComponent} to the setting.
   *
   * @typeParam T - The type of the dropdown items.
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTypedDropdown<T>(callback: (typedDropdown: TypedDropdownComponent<T>) => void): this {
    return this.addComponentClass(TypedDropdownComponent<T>, callback);
  }

  /**
   * Adds a {@link TypedMultipleDropdownComponent} to the setting.
   *
   * @typeParam T - The type of the items in the dropdown.
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTypedMultipleDropdown<T>(callback: (typedMultipleDropdown: TypedMultipleDropdownComponent<T>) => void): this {
    return this.addComponentClass(TypedMultipleDropdownComponent<T>, callback);
  }

  /**
   * Adds an {@link UrlComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addUrl(callback: (url: UrlComponent) => void): this {
    return this.addComponentClass(UrlComponent, callback);
  }

  /**
   * Adds a {@link WeekComponent} to the setting.
   *
   * @param callback - The callback to call with the component.
   * @returns The setting instance.
   */
  public addWeek(callback: (week: WeekComponent) => void): this {
    return this.addComponentClass(WeekComponent, callback);
  }
}

/**
 * Adopts a plain {@link Setting} into a {@link SettingEx}, returning the very same instance.
 *
 * Obsidian's declarative settings API creates the row itself and hands a plain {@link Setting} to a
 * `SettingDefinitionRender.render` callback, so the extended adders are out of reach there. Re-pointing the
 * instance's prototype at {@link SettingEx.prototype} makes them available on the object Obsidian already
 * owns and keeps rendering: {@link SettingEx} declares no instance state and its constructor only delegates
 * to `super`, and `SettingEx.prototype` inherits from the very `Setting.prototype` the instance came from,
 * so every method Obsidian relies on — including the ones absent from the public typings — stays reachable.
 *
 * @param setting - The setting to adopt.
 * @returns The same instance, typed as a {@link SettingEx}.
 */
export function adoptSettingEx(setting: Setting): SettingEx {
  if (setting instanceof SettingEx) {
    return setting;
  }

  Object.setPrototypeOf(setting, SettingEx.prototype);
  return castTo<SettingEx>(setting);
}
