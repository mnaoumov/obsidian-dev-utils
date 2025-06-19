/**
 * @packageDocumentation
 *
 * Contains a utility function for validating URLs.
 */

const SPECIAL_SCHEMES = [
  'geo:',
  'mailto:',
  'skype:',
  'slack:',
  'sms:',
  'tel:',
  'tg:',
  'whatsapp:'
];

/**
 * Determines whether a given string is a valid URL
 *
 * @param str - The string to validate as a URL.
 * @returns `true` if the string is a valid URL, otherwise `false`.
 */
export function isUrl(str: string): boolean {
  if (str.trim() !== str) {
    return false;
  }
  if (str.includes('://')) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  const lowerStr = str.toLowerCase();
  return SPECIAL_SCHEMES.some((scheme) => lowerStr.startsWith(scheme));
}
