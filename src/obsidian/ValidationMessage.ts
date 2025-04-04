/**
 * Holds a validation message.
 */
export interface ValidationMessageHolder {
  /**
   * The validation message.
   */
  validationMessage: string;
}

/**
 * Type guard to check if a value is a validation message holder.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a validation message holder, `false` otherwise.
 */
export function isValidationMessageHolder(value: unknown): value is ValidationMessageHolder {
  return !!(value as Partial<ValidationMessageHolder>).validationMessage;
}
