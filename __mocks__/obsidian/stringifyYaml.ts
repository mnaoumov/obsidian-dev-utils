import { stringify } from 'yaml';

export function stringifyYaml(obj: unknown): string {
  return stringify(obj);
}
