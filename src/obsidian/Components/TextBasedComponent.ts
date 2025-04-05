import type { BaseComponent } from 'obsidian';

import { AbstractTextComponent } from 'obsidian';

/**
 * A component based on a text input.
 */
export interface TextBasedComponent {
  /**
   * Checks if the component is empty.
   *
   * @returns `true` if the component is empty, `false` otherwise.
   */
  isEmpty(): boolean;

  /**
   * Sets the placeholder of the component.
   *
   * @param placeholder - The placeholder to set.
   * @returns The component.
   */
  setPlaceholder(placeholder: string): this;
}

/**
 * Gets the text based component value of the component.
 *
 * @param component - The component to get the text based component value of.
 * @returns The text based component value of the component or `null` if the component is not a text based component.
 */
export function getTextBasedComponentValue(component: BaseComponent): null | TextBasedComponent {
  if (isTextBasedComponent(component)) {
    return component;
  }

  if (component instanceof AbstractTextComponent) {
    return {
      isEmpty(): boolean {
        return component.getValue() === '';
      },
      setPlaceholder(placeholder: string): TextBasedComponent {
        component.setPlaceholder(placeholder);
        return this;
      }
    };
  }

  return null;
}

function isTextBasedComponent(component: unknown): component is TextBasedComponent {
  const textBasedComponent = component as Partial<TextBasedComponent>;
  return typeof textBasedComponent.setPlaceholder === 'function' && typeof textBasedComponent.isEmpty === 'function';
}
