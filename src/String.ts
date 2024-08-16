import {
  resolveValue,
  type ValueProvider
} from "./ValueProvider.ts";

type AsyncReplacer<Args extends unknown[]> = ValueProvider<string, [string, ...Args]>;

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

export function normalize(str: string): string {
  return str.replace(/\u00A0/g, " ").normalize("NFC");
}

export async function replaceAllAsync<Args extends unknown[]>(
  str: string,
  searchValue: string | RegExp,
  replacer: AsyncReplacer<Args>
): Promise<string> {
  const replacementPromises: Promise<string>[] = [];

  str.replaceAll(searchValue, (substring: string, ...args: unknown[]) => {
    replacementPromises.push(resolveValue(replacer, substring, ...args as [...Args]));
    return substring;
  });
  const replacements = await Promise.all(replacementPromises);
  return str.replaceAll(searchValue, (): string => replacements.shift()!);
}

export function makeValidVariableName(str: string): string {
  return str.replace(/[^a-zA-Z0-9_]/g, "_");
}

export function ensureStartsWith(str: string, prefix: string): string {
  return str.startsWith(prefix) ? str : prefix + str;
}

export function ensureEndsWith(str: string, suffix: string): string {
  return str.endsWith(suffix) ? str : str + suffix;
}
