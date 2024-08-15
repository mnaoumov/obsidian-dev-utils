export function trimStart(str: string, prefix: string, validate?: boolean): string {
  if (str.startsWith(prefix)) {
    return str.slice(prefix.length);
  }

  if (validate) {
    throw new Error(`String ${str} does not start with prefix ${prefix}`);
  }

  return str;
}

export function trimEnd(str: string, suffix: string, validate?: boolean): string {
  if (str.endsWith(suffix)) {
    return str.slice(0, -suffix.length);
  }

  if (validate) {
    throw new Error(`String ${str} does not end with suffix ${suffix}`);
  }

  return str;
}
