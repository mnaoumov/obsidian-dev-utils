/**
 * @packageDocumentation MultipleDropdownComponent
 * Contains a component that displays and edits a multi-select dropdown.
 */

import {
  DropdownComponent,
  ValueComponent
} from 'obsidian';

import type { MaybePromise } from '../../Async.ts';
import type { ValidatorElement } from '../../HTMLElement.ts';
import type { ValidatorComponent } from './ValidatorComponent.ts';
import type { ValueComponentWithChangeTracking } from './ValueComponentWithChangeTracking.ts';

/**
 * A multi-select dropdown component.
 */
export class MultipleDropdownComponent extends ValueComponent<string[]> implements ValidatorComponent, ValueComponentWithChangeTracking<string[]> {
  /**
   * The validator element of the component.
   */
  public get validatorEl(): ValidatorElement {
    return this.dropdownComponent.selectEl;
  }

  private readonly dropdownComponent: DropdownComponent;

  /**
   * Creates a new multiple dropdown component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super();
    this.dropdownComponent = new DropdownComponent(containerEl);
    this.dropdownComponent.selectEl.multiple = true;
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public getValue(): string[] {
    return Array.from(this.dropdownComponent.selectEl.selectedOptions).map((o) => o.value);
  }

  /**
   * Sets the callback function to be called when the component is changed.
   *
   * @param callback - The callback function to be called when the component is changed.
   * @returns The component.
   */
  public onChange(callback: (value: string[]) => MaybePromise<void>): this {
    this.dropdownComponent.onChange(() => callback(this.getValue()));
    return this;
  }

  /**
   * Sets the value of the component.
   *
   * @param value - The value to set.
   * @returns The component.
   */
  public setValue(value: string[]): this {
    for (const option of Array.from(this.dropdownComponent.selectEl.options)) {
      option.selected = value.includes(option.value);
    }

    return this;
  }
}
