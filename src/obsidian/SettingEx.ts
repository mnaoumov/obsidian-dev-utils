/**
 * @packageDocumentation
 *
 * Extends the Setting class with additional methods for adding components.
 */

import type { BaseComponent } from 'obsidian';

import { Setting } from 'obsidian';

import { CheckboxComponent } from './Components/SettingComponents/CheckboxComponent.ts';
import { CodeHighlighterComponent } from './Components/SettingComponents/CodeHighlighterComponent.ts';
import { DateComponent } from './Components/SettingComponents/DateComponent.ts';
import { DateTimeComponent } from './Components/SettingComponents/DateTimeComponent.ts';
import { EmailComponent } from './Components/SettingComponents/EmailComponent.ts';
import { FileComponent } from './Components/SettingComponents/FileComponent.ts';
import { MonthComponent } from './Components/SettingComponents/MonthComponent.ts';
import { MultipleDropdownComponent } from './Components/SettingComponents/MultipleDropdownComponent.ts';
import { MultipleEmailComponent } from './Components/SettingComponents/MultipleEmailComponent.ts';
import { MultipleFileComponent } from './Components/SettingComponents/MultipleFileComponent.ts';
import { MultipleTextComponent } from './Components/SettingComponents/MultipleTextComponent.ts';
import { NumberComponent } from './Components/SettingComponents/NumberComponent.ts';
import { PasswordComponent } from './Components/SettingComponents/PasswordComponent.ts';
import { TelephoneComponent } from './Components/SettingComponents/TelephoneComponent.ts';
import { TimeComponent } from './Components/SettingComponents/TimeComponent.ts';
import { TriStateCheckboxComponent } from './Components/SettingComponents/TriStateCheckboxComponent.ts';
import { TypedDropdownComponent } from './Components/SettingComponents/TypedDropdownComponent.ts';
import { TypedMultipleDropdownComponent } from './Components/SettingComponents/TypedMultipleDropdownComponent.ts';
import { UrlComponent } from './Components/SettingComponents/UrlComponent.ts';
import { WeekComponent } from './Components/SettingComponents/WeekComponent.ts';

/**
 * Extends the Setting class with additional methods for adding components.
 */
export class SettingEx extends Setting {
  /**
   * Adds a {@link CheckboxComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addCheckbox(cb: (checkbox: CheckboxComponent) => void): this {
    return this.addComponentClass(CheckboxComponent, cb);
  }

  /**
   * Adds a {@link CodeHighlighterComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addCodeHighlighter(cb: (codeHighlighter: CodeHighlighterComponent) => void): this {
    return this.addComponentClass(CodeHighlighterComponent, cb);
  }

  /**
   * Adds a component to the setting.
   *
   * @typeParam T - The type of the component to add.
   * @param componentClass - The class of the component to add.
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addComponentClass<T extends BaseComponent>(componentClass: new (containerEl: HTMLElement) => T, cb: (component: T) => void): this {
    return this.addComponent<T>((el) => {
      const component = new componentClass(el);
      cb(component);
      return component;
    });
  }

  /**
   * Adds a {@link DateComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addDate(cb: (date: DateComponent) => void): this {
    return this.addComponentClass(DateComponent, cb);
  }

  /**
   * Adds a {@link DateTimeComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addDateTime(cb: (dateTime: DateTimeComponent) => void): this {
    return this.addComponentClass(DateTimeComponent, cb);
  }

  /**
   * Adds an {@link EmailComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addEmail(cb: (email: EmailComponent) => void): this {
    return this.addComponentClass(EmailComponent, cb);
  }

  /**
   * Adds a {@link FileComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addFile(cb: (file: FileComponent) => void): this {
    return this.addComponentClass(FileComponent, cb);
  }

  /**
   * Adds a {@link MonthComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMonth(cb: (month: MonthComponent) => void): this {
    return this.addComponentClass(MonthComponent, cb);
  }

  /**
   * Adds a {@link MultipleDropdownComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleDropdown(cb: (multipleDropdown: MultipleDropdownComponent) => void): this {
    return this.addComponentClass(MultipleDropdownComponent, cb);
  }

  /**
   * Adds a {@link MultipleEmailComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleEmail(cb: (multipleEmail: MultipleEmailComponent) => void): this {
    return this.addComponentClass(MultipleEmailComponent, cb);
  }

  /**
   * Adds a {@link MultipleFileComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleFile(cb: (multipleFile: MultipleFileComponent) => void): this {
    return this.addComponentClass(MultipleFileComponent, cb);
  }

  /**
   * Adds a {@link MultipleTextComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleText(cb: (multipleText: MultipleTextComponent) => void): this {
    return this.addComponentClass(MultipleTextComponent, cb);
  }

  /**
   * Adds a {@link NumberComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addNumber(cb: (number: NumberComponent) => void): this {
    return this.addComponentClass(NumberComponent, cb);
  }

  /**
   * Adds a {@link PasswordComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addPassword(cb: (password: PasswordComponent) => void): this {
    return this.addComponentClass(PasswordComponent, cb);
  }

  /**
   * Adds a {@link TelephoneComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTelephone(cb: (telephone: TelephoneComponent) => void): this {
    return this.addComponentClass(TelephoneComponent, cb);
  }

  /**
   * Adds a {@link TimeComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTime(cb: (time: TimeComponent) => void): this {
    return this.addComponentClass(TimeComponent, cb);
  }

  /**
   * Adds a {@link TriStateCheckboxComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTriStateCheckbox(cb: (triStateCheckbox: TriStateCheckboxComponent) => void): this {
    return this.addComponentClass(TriStateCheckboxComponent, cb);
  }

  /**
   * Adds a {@link TypedDropdownComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTypedDropdown<T>(cb: (typedDropdown: TypedDropdownComponent<T>) => void): this {
    return this.addComponentClass(TypedDropdownComponent<T>, cb);
  }

  /**
   * Adds a {@link TypedMultipleDropdownComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTypedMultipleDropdown<T>(cb: (typedMultipleDropdown: TypedMultipleDropdownComponent<T>) => void): this {
    return this.addComponentClass(TypedMultipleDropdownComponent<T>, cb);
  }

  /**
   * Adds an {@link UrlComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addUrl(cb: (url: UrlComponent) => void): this {
    return this.addComponentClass(UrlComponent, cb);
  }

  /**
   * Adds a {@link WeekComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addWeek(cb: (week: WeekComponent) => void): this {
    return this.addComponentClass(WeekComponent, cb);
  }
}
