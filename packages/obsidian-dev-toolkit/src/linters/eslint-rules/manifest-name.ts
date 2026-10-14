/**
 * @file
 *
 * ESLint rule: manifest-name
 *
 * Enforces the Community directory's constraints on a plugin's `manifest.json` `name`: no `Obsidian` or
 * its variants, no `Plugin`, and Basic Latin only with hyphens, plus signs and parentheses the sole
 * permitted punctuation.
 *
 * Runs on the `@eslint/json` `json/json` language; see `manifest-helpers.ts` for why the AST is Momoa
 * rather than ESTree.
 */

import type { Rule } from 'eslint';

import {
  findManifestMember,
  getManifestObject,
  getStringValue,
  toReportNode
} from './manifest-helpers.ts';

/**
Message ID reported when the name contains `Obsidian` or one of its variants.
 */
export const MESSAGE_ID_CONTAINS_OBSIDIAN = 'nameContainsObsidian';

/**
Message ID reported when the name contains `Plugin`.
 */
export const MESSAGE_ID_CONTAINS_PLUGIN = 'nameContainsPlugin';

/**
Message ID reported when the name holds a character outside Basic Latin, or punctuation the directory rejects.
 */
export const MESSAGE_ID_INVALID_CHARACTERS = 'nameInvalidCharacters';

/**
The only characters a plugin name may hold: Basic Latin letters and digits, spaces, and the three
permitted punctuation marks.
 */
const ALLOWED_NAME_CHARACTERS = /^[A-Za-z0-9 \-+()]+$/;

/**
`Obsidian` and the two variants the directory also rejects.
 */
const OBSIDIAN_VARIANTS = /obsi|sidian/i;

/**
 * ESLint rule enforcing the Community directory's constraints on a plugin's `manifest.json` `name`.
 */
export const manifestName: Rule.RuleModule = {
  create(context) {
    return {
      Document(node: unknown): void {
        const manifestObject = getManifestObject(node);

        if (!manifestObject) {
          return;
        }

        const member = findManifestMember(manifestObject, 'name');

        if (!member) {
          return;
        }

        const name = getStringValue(member.value);

        if (name === null) {
          return;
        }

        const reportNode = toReportNode(member.value);

        if (OBSIDIAN_VARIANTS.test(name)) {
          context.report({
            messageId: MESSAGE_ID_CONTAINS_OBSIDIAN,
            node: reportNode
          });
        }

        if (name.toLowerCase().includes('plugin')) {
          context.report({
            messageId: MESSAGE_ID_CONTAINS_PLUGIN,
            node: reportNode
          });
        }

        if (!ALLOWED_NAME_CHARACTERS.test(name)) {
          context.report({
            messageId: MESSAGE_ID_INVALID_CHARACTERS,
            node: reportNode
          });
        }
      }
    };
  },
  meta: {
    docs: {
      description: 'Enforce the Community directory\'s constraints on a plugin\'s `manifest.json` `name`'
    },
    messages: {
      [MESSAGE_ID_CONTAINS_OBSIDIAN]: 'The `name` must not contain `Obsidian` or a variant of it. It is implied by the context of the plugin directory.',
      [MESSAGE_ID_CONTAINS_PLUGIN]: 'The `name` must not contain `Plugin`.',
      [MESSAGE_ID_INVALID_CHARACTERS]: 'The `name` must use Basic Latin only, with hyphens, plus signs and parentheses the only permitted punctuation.'
    },
    schema: [],
    type: 'problem'
  }
};
