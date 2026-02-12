export function stringifyYaml(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return '';
  }
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === null || value === undefined) {
      lines.push(`${key}: `);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
