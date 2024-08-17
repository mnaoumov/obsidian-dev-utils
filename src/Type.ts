export type Constructor<T, Args extends unknown[] = []> = new (...args: Args) => T;

export type KeysMatching<Type, Value> = { [Key in keyof Type]-?: Type[Key] extends Value ? Key : never }[keyof Type];
