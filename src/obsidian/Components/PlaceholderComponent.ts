/**
 * A component that can set a placeholder.
 */
export interface PlaceholderComponent {
  /**
   * Sets the placeholder of the component.
   *
   * @param placeholder - The placeholder to set.
   * @returns The component.
   */
  setPlaceholder(placeholder: string): this;
}

/**
 * Type guard to check if a component is a placeholder component.
 *
 * @param component - The component to check.
 * @returns `true` if the component is a placeholder component, `false` otherwise.
 */
export function isPlaceholderComponent(component: unknown): component is PlaceholderComponent {
  return typeof (component as Partial<PlaceholderComponent>).setPlaceholder === 'function';
}
