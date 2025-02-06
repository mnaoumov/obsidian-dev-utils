/**
 * @packageDocumentation SettingEx
 * Extends the Setting class with additional methods for adding components.
 */

import type { BaseComponent } from 'obsidian';

import { Setting } from 'obsidian';

import { DateComponent } from './Components/DateComponent.ts';
import { DateTimeComponent } from './Components/DateTimeComponent.ts';
import { EmailComponent } from './Components/EmailComponent.ts';
import { FileComponent } from './Components/FileComponent.ts';
import { MonthComponent } from './Components/MonthComponent.ts';
import { MultipleDropdownComponent } from './Components/MultipleDropdownComponent.ts';
import { MultipleEmailComponent } from './Components/MultipleEmailComponent.ts';
import { MultipleFileComponent } from './Components/MultipleFileComponent.ts';
import { NumberComponent } from './Components/NumberComponent.ts';
import { TimeComponent } from './Components/TimeComponent.ts';
import { UrlComponent } from './Components/UrlComponent.ts';
import { WeekComponent } from './Components/WeekComponent.ts';

/**
 * Extends the Setting class with additional methods for adding components.
 */
export class SettingEx extends Setting {
  /**
   * Adds a component to the setting.
   *
   * @typeParam T - The type of the component to add.
   * @param componentClass - The class of the component to add.
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addComponent<T extends BaseComponent>(componentClass: new (controlEl: HTMLElement) => T, cb: (component: T) => void): this {
    const component = new componentClass(this.controlEl);
    this.components.push(component);
    cb(component);
    return this;
  }

  /**
   * Adds a date component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addDate(cb: (component: DateComponent) => void): this {
    return this.addComponent(DateComponent, cb);
  }

  /**
   * Adds a date and time component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addDateTime(cb: (component: DateTimeComponent) => void): this {
    return this.addComponent(DateTimeComponent, cb);
  }

  /**
   * Adds an email component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addEmail(cb: (component: EmailComponent) => void): this {
    return this.addComponent(EmailComponent, cb);
  }

  /**
   * Adds a file component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addFile(cb: (component: FileComponent) => void): this {
    return this.addComponent(FileComponent, cb);
  }

  /**
   * Adds a month component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMonth(cb: (component: MonthComponent) => void): this {
    return this.addComponent(MonthComponent, cb);
  }

  /**
   * Adds a multiple dropdown component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleDropdown(cb: (component: MultipleDropdownComponent) => void): this {
    return this.addComponent(MultipleDropdownComponent, cb);
  }

  /**
   * Adds a multiple email component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleEmail(cb: (component: MultipleEmailComponent) => void): this {
    return this.addComponent(MultipleEmailComponent, cb);
  }

  /**
   * Adds a multiple file component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleFile(cb: (component: MultipleFileComponent) => void): this {
    return this.addComponent(MultipleFileComponent, cb);
  }

  /**
   * Adds a number component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addNumber(cb: (component: NumberComponent) => void): this {
    return this.addComponent(NumberComponent, cb);
  }

  /**
   * Adds a time component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addTime(cb: (component: TimeComponent) => void): this {
    return this.addComponent(TimeComponent, cb);
  }

  /**
   * Adds a url component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addUrl(cb: (component: UrlComponent) => void): this {
    return this.addComponent(UrlComponent, cb);
  }

  /**
   * Adds a week component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addWeek(cb: (component: WeekComponent) => void): this {
    return this.addComponent(WeekComponent, cb);
  }
}
