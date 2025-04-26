/**
 * @packageDocumentation
 *
 * Two-way map.
 */

/**
 * A map that allows you to look up a value by its key and vice versa.
 *
 * @example
 * ```ts
 * const map = new TwoWayMap<string, number>();
 * map.set('foo', 42);
 * map.getValue('foo'); // 42
 * map.getKey(42); // 'foo'
 * map.deleteKey('foo');
 * map.deleteValue(42);
 * map.clear();
 * ```
 */
export class TwoWayMap<Key, Value> {
  private readonly keyValueMap = new Map<Key, Value>();
  private readonly valueKeyMap = new Map<Value, Key>();

  /**
   * Creates a new two-way map.
   *
   * @param entries - Entries to initialize the map with.
   */
  public constructor(entries: (readonly [key: Key, value: Value])[] = []) {
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  /**
   * Clears the map.
   */
  public clear(): void {
    this.keyValueMap.clear();
    this.valueKeyMap.clear();
  }

  /**
   * Deletes a key from the map.
   *
   * @param key - The key.
   */
  public deleteKey(key: Key): void {
    const value = this.getValue(key);
    if (value !== undefined) {
      this.valueKeyMap.delete(value);
    }
    this.keyValueMap.delete(key);
  }

  /**
   * Deletes a value from the map.
   *
   * @param value - The value.
   */
  public deleteValue(value: Value): void {
    const key = this.getKey(value);
    if (key !== undefined) {
      this.keyValueMap.delete(key);
    }
    this.valueKeyMap.delete(value);
  }

  /**
   * Gets all entries in the map.
   *
   * @returns An iterator over all entries in the map.
   */
  public entries(): IterableIterator<readonly [key: Key, value: Value]> {
    return this.keyValueMap.entries();
  }

  /**
   * Gets a key by its value.
   *
   * @param value - The value.
   * @returns The key.
   */
  public getKey(value: Value): Key | undefined {
    return this.valueKeyMap.get(value);
  }

  /**
   * Gets a value by its key.
   *
   * @param key - The key.
   * @returns The value.
   */
  public getValue(key: Key): undefined | Value {
    return this.keyValueMap.get(key);
  }

  /**
   * Gets all keys in the map.
   *
   * @returns An iterator over all keys in the map.
   */
  public keys(): IterableIterator<Key> {
    return this.keyValueMap.keys();
  }

  /**
   * Sets a key-value pair in the map.
   *
   * @param key - The key.
   * @param value - The value.
   */
  public set(key: Key, value: Value): void {
    this.deleteKey(key);
    this.deleteValue(value);

    this.keyValueMap.set(key, value);
    this.valueKeyMap.set(value, key);
  }

  /**
   * Gets all values in the map.
   *
   * @returns An iterator over all values in the map.
   */
  public values(): IterableIterator<Value> {
    return this.valueKeyMap.keys();
  }
}
