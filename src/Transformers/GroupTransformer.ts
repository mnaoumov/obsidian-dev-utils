/**
 * @packageDocumentation
 *
 * A transformer that combines multiple transformers.
 */

import { throwExpression } from '../Error.ts';
import { Transformer } from './Transformer.ts';

/**
 * A transformer that combines multiple transformers.
 */
export class GroupTransformer extends Transformer {
  /**
   * An id of the transformer.
   *
   * @returns `group`.
   */
  public override get id(): string {
    return 'group';
  }

  /**
   * Transformers to combine.
   *
   * @param transformers - The transformers to combine.
   */
  public constructor(private readonly transformers: Transformer[]) {
    super();
  }

  /**
   * Determines if the value can be transformed by any of the transformers.
   *
   * @param value - The value to check.
   * @param key - The key of the value to check.
   * @returns A boolean indicating if the value can be transformed.
   */
  public override canTransform(value: unknown, key: string): boolean {
    return this.getFirstTransformerThatCanTransform(value, key) !== null;
  }

  /**
   * Gets the transformer with the given id.
   *
   * @param transformerId - The id of the transformer to get.
   * @returns The transformer with the given id.
   */
  public override getTransformer(transformerId: string): Transformer {
    return this.transformers.find((t) => t.id === transformerId) ?? throwExpression(`No transformer with id ${transformerId} found`);
  }

  /**
   * Transforms the value using the first transformer that can transform it.
   *
   * @param value - The value to transform.
   * @param key - The key of the value to transform.
   * @returns The transformed value.
   */
  public override transformValue(value: unknown, key: string): unknown {
    const transformer = this.getFirstTransformerThatCanTransform(value, key);
    if (transformer === null) {
      throw new Error('No transformer can transform the value');
    }

    return transformer.transformValue(value, key);
  }

  /**
   * Gets the id of the transformer that can transform the given value.
   *
   * @param value - The value to get the transformer id for.
   * @param key - The key of the value to get the transformer id for.
   * @returns The id of the transformer that can transform the given value.
   */
  protected override getTransformerId(value: unknown, key: string): null | string {
    const transformer = this.getFirstTransformerThatCanTransform(value, key);
    if (transformer === null) {
      return null;
    }

    return transformer.id;
  }

  /**
   * This transformer does not support restoring values.
   *
   * @throws
   */
  protected override restoreValue(): never {
    throw new Error('GroupTransformer does not support restoring values');
  }

  /**
   * Gets the first transformer that can transform the given value.
   *
   * @param value - The value to get the first transformer for.
   * @param key - The key of the value to get the first transformer for.
   * @returns The first transformer that can transform the given value.
   */
  private getFirstTransformerThatCanTransform(value: unknown, key: string): null | Transformer {
    return this.transformers.find((t) => t.canTransform(value, key)) ?? null;
  }
}
