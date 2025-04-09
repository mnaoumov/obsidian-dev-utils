/**
 * @packageDocumentation
 *
 * Extends the Setting class with additional methods for adding components.
 */

import type { BaseComponent } from 'obsidian';

import { Setting } from 'obsidian';

import { CheckboxComponent } from './Components/SettingComponents/CheckboxComponent.ts';
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
  public addCheckbox(cb: (component: CheckboxComponent) => void): this {
    return this.addComponent(CheckboxComponent, cb);
  }

  /**
   * Adds a component to the setting.
   *
   * @typeParam T - The type of the component to add.
   * @param componentClass - The class of the component to add.
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addComponent<T extends BaseComponent>(componentClass: new (containerEl: HTMLElement) => T, cb: (component: T) => void): this {
    const component = new componentClass(this.controlEl);
    this.components.push(component);
    cb(component);
    return this;
  }

  /**
   * Adds a {@link DateComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addDate(cb: (component: DateComponent) => void): this {
    return this.addComponent(DateComponent, cb);
  }

  /**
   * Adds a {@link DateTimeComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addDateTime(cb: (component: DateTimeComponent) => void): this {
    return this.addComponent(DateTimeComponent, cb);
  }

  /**
   * Adds an {@link EmailComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addEmail(cb: (component: EmailComponent) => void): this {
    return this.addComponent(EmailComponent, cb);
  }

  /**
   * Adds a {@link FileComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addFile(cb: (component: FileComponent) => void): this {
    return this.addComponent(FileComponent, cb);
  }

  /**
   * Adds a {@link MonthComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMonth(cb: (component: MonthComponent) => void): this {
    return this.addComponent(MonthComponent, cb);
  }

  /**
   * Adds a {@link MultipleDropdownComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleDropdown(cb: (component: MultipleDropdownComponent) => void): this {
    return this.addComponent(MultipleDropdownComponent, cb);
  }

  /**
   * Adds a {@link MultipleEmailComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleEmail(cb: (component: MultipleEmailComponent) => void): this {
    return this.addComponent(MultipleEmailComponent, cb);
  }

  /**
   * Adds a {@link MultipleFileComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleFile(cb: (component: MultipleFileComponent) => void): this {
    return this.addComponent(MultipleFileComponent, cb);
  }

  /**
   * Adds a {@link MultipleTextComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleText(cb: (component: MultipleTextComponent) => void): this {
    return this.addComponent(MultipleTextComponent, cb);
  }

  /**
   * Adds a {@link NumberComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addNumber(cb: (component: NumberComponent) => void): this {
    return this.addComponent(NumberComponent, cb);
  }

  /**
   * Adds a {@link TimeComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTime(cb: (component: TimeComponent) => void): this {
    return this.addComponent(TimeComponent, cb);
  }

  /**
   * Adds a {@link TriStateCheckboxComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTriStateCheckbox(cb: (component: TriStateCheckboxComponent) => void): this {
    return this.addComponent(TriStateCheckboxComponent, cb);
  }

  /**
   * Adds a {@link TypedDropdownComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTypedDropdown<T>(cb: (component: TypedDropdownComponent<T>) => void): this {
    return this.addComponent(TypedDropdownComponent<T>, cb);
  }

  /**
   * Adds a {@link TypedMultipleDropdownComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTypedMultipleDropdown<T>(cb: (component: TypedMultipleDropdownComponent<T>) => void): this {
    return this.addComponent(TypedMultipleDropdownComponent<T>, cb);
  }

  /**
   * Adds an {@link UrlComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addUrl(cb: (component: UrlComponent) => void): this {
    return this.addComponent(UrlComponent, cb);
  }

  /**
   * Adds a {@link WeekComponent} to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addWeek(cb: (component: WeekComponent) => void): this {
    return this.addComponent(WeekComponent, cb);
  }
}
