export function parseYaml(yaml: string): unknown {
  if (!yaml || yaml.trim() === '') {
    return null;
  }
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, colonIndex).trim();
    let value: unknown = trimmed.slice(colonIndex + 1).trim();
    if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (value === '' || value === 'null') {
      value = null;
    } else if (!isNaN(Number(value))) {
      value = Number(value);
    }
    result[key] = value;
  }
  return result;
}
