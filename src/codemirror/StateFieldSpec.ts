/**
 * @packageDocumentation StateFieldSpec
 * Contains a specification for a state field.
 */

import type {
  EditorState,
  Extension,
  StateField,
  Transaction
} from '@codemirror/state';

/**
 * A specification for a state field.
 */
export interface StateFieldSpec<Value> {
  /**
   * Compare two values of the field, returning `true` when they are
   * the same. This is used to avoid recomputing facets that depend
   * on the field when its value did not change. Defaults to using
   * `===`.
   *
   * @param a - The first value to compare.
   * @param b - The second value to compare.
   * @returns `true` if the values are the same, `false` otherwise.
   */
  compare?(a: Value, b: Value): boolean;

  /**
   * Creates the initial value for the field when a state is created.
   *
   * @param state - The state to create the value for.
   * @returns The initial value for the field.
   */
  create: (state: EditorState) => Value;

  /**
   * A function that deserializes the JSON representation of this
   * field's content.
   *
   * @param json - The JSON representation of the value.
   * @param state - The state to deserialize the value for.
   * @returns The deserialized value.
   */
  fromJSON?(json: unknown, state: EditorState): Value;

  /**
   * Provide extensions based on this field. The given function will
   * be called once with the initialized field. It will usually want
   * to call some facet's [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method to
   * create facet inputs from this field, but can also return other
   * extensions that should be enabled when the field is present in a
   * configuration.
   *
   * @param field - The initialized field.
   * @returns The extensions to enable when the field is present in a configuration.
   */
  provide?(field: StateField<Value>): Extension;

  /**
   * A function used to serialize this field's content to JSON. Only
   * necessary when this field is included in the argument to
   * [`EditorState.toJSON`](https://codemirror.net/6/docs/ref/#state.EditorState.toJSON).
   *
   * @param value - The value to serialize.
   * @param state - The state to serialize the value for.
   * @returns The serialized value.
   */
  toJSON?(value: Value, state: EditorState): unknown;

  /**
   * Compute a new value from the field's previous value and a
   * [transaction](https://codemirror.net/6/docs/ref/#state.Transaction).
   *
   * @param value - The previous value of the field.
   * @param transaction - The transaction to compute the new value from.
   * @returns The new value of the field.
   */
  update: (value: Value, transaction: Transaction) => Value;
}
