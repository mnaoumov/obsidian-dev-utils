export function contains(this: string, target: string): boolean {
  return this.includes(target);
}

export function format(this: string, ...args: string[]): string {
  // Very small subset used in practice: "{0}" style formatting.
  return this.replace(/\{(?<Index>\d+)\}/g, (_substring: string, index: number | string): string => {
    const numericIndex = typeof index === 'number' ? index : Number(index);
    return args[numericIndex] ?? '';
  });
}
