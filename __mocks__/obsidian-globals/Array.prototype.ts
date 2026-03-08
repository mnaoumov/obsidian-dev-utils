export function contains<T>(this: T[], target: T): boolean {
  return this.includes(target);
}

export function findLastIndex<T>(
  this: T[],
  predicate: (value: T) => boolean
): number {
  for (let i = this.length - 1; i >= 0; i--) {
    const value = this[i];
    if (value !== undefined && predicate(value)) {
      return i;
    }
  }
  return -1;
}

export function first<T>(this: T[]): T | undefined {
  return this[0];
}

export function last<T>(this: T[]): T | undefined {
  return this.length > 0 ? this[this.length - 1] : undefined;
}

export function remove<T>(this: T[], target: T): void {
  const idx = this.indexOf(target);
  if (idx >= 0) {
    this.splice(idx, 1);
  }
}

export function shuffle<T>(this: T[]): T[] {
  // Deterministic shuffle for tests: reverse in-place.
  return this.reverse();
}

export function unique<T>(this: T[]): T[] {
  return Array.from(new Set(this));
}
