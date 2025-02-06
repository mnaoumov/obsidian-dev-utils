/**
 * @packageDocumentation SettingEx
 * Extends the Setting class with additional methods for adding components.
 */

import type { BaseComponent } from 'obsidian';

import { Setting } from 'obsidian';

import { DateComponent } from './Components/DateComponent.ts';
import { DateTimeComponent } from './Components/DateTimeComponent.ts';
import { EmailComponent } from './Components/EmailComponent.ts';
import { MultipleEmailComponent } from './Components/MultipleEmailComponent.ts';
import { NumberComponent } from './Components/NumberComponent.ts';
import { TimeComponent } from './Components/TimeComponent.ts';

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
   * Adds a multiple email component to the setting.
   *
   * @param cb - The callback to call with the component.
   * @returns The setting instance.
   */
  public addMultipleEmail(cb: (component: MultipleEmailComponent) => void): this {
    return this.addComponent(MultipleEmailComponent, cb);
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
}
