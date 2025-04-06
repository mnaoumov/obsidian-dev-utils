/**
 * @packageDocumentation SkipPrivatePropertyTransformer
 * A transformer that skips private properties.
 */

import { Transformer } from './Transformer.ts';

const PRIVATE_PROPERTY_PREFIX = '_';

/**
 * A transformer that skips private properties.
 */
export class SkipPrivatePropertyTransformer extends Transformer {
  /**
   * The id of the transformer.
   *
   * @returns `skip-private-property`.
   */
  public override get id(): string {
    return 'skip-private-property';
  }

  /**
   * Determines if the transformer can transform the given value.
   *
   * @param _value - The value to check.
   * @param key - The key of the value to check.
   * @returns A boolean indicating if the transformer can transform the value.
   */
  public override canTransform(_value: unknown, key: string): boolean {
    return key.startsWith(PRIVATE_PROPERTY_PREFIX);
  }

  /**
   * Transforms the given value.
   *
   * @returns The transformed value.
   */
  public override transformValue(): unknown {
    return undefined;
  }

  /**
   * Restores the given value.
   */
  protected override restoreValue(): unknown {
    throw new Error('SkipPrivatePropertyTransformer does not support restoring values');
  }
}
