/**
 * @file
 *
 * ESLint rule: manifest-id
 *
 * Enforces the Community directory's constraints on a plugin's `manifest.json` `id`: lowercase letters,
 * digits and hyphens only; never containing `obsidian`; never ending with `plugin`.
 *
 * A published id can never be changed, so a violation in an already-listed plugin is permanent and the
 * only remedy is turning this rule off for that repo with the reason written beside it.
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
Message ID reported when the id contains `obsidian`.
 */
export const MESSAGE_ID_CONTAINS_OBSIDIAN = 'idContainsObsidian';

/**
Message ID reported when the id ends with `plugin`.
 */
export const MESSAGE_ID_ENDS_WITH_PLUGIN = 'idEndsWithPlugin';

/**
Message ID reported when the id holds characters other than lowercase letters, digits and hyphens.
 */
export const MESSAGE_ID_INVALID_CHARACTERS = 'idInvalidCharacters';

/**
The only characters a plugin id may hold.
 */
const ALLOWED_ID_CHARACTERS = /^[a-z0-9-]+$/;

/**
 * ESLint rule enforcing the Community directory's constraints on a plugin's `manifest.json` `id`.
 */
export const manifestId: Rule.RuleModule = {
  create(context) {
    return {
      Document(node: unknown): void {
        const manifestObject = getManifestObject(node);

        if (!manifestObject) {
          return;
        }

        const member = findManifestMember(manifestObject, 'id');

        if (!member) {
          return;
        }

        const id = getStringValue(member.value);

        if (id === null) {
          return;
        }

        const reportNode = toReportNode(member.value);

        if (!ALLOWED_ID_CHARACTERS.test(id)) {
          context.report({
            messageId: MESSAGE_ID_INVALID_CHARACTERS,
            node: reportNode
          });
        }

        if (id.toLowerCase().includes('obsidian')) {
          context.report({
            messageId: MESSAGE_ID_CONTAINS_OBSIDIAN,
            node: reportNode
          });
        }

        if (id.toLowerCase().endsWith('plugin')) {
          context.report({
            messageId: MESSAGE_ID_ENDS_WITH_PLUGIN,
            node: reportNode
          });
        }
      }
    };
  },
  meta: {
    docs: {
      description: 'Enforce the Community directory\'s constraints on a plugin\'s `manifest.json` `id`'
    },
    messages: {
      [MESSAGE_ID_CONTAINS_OBSIDIAN]: 'The `id` must not contain `obsidian`. It is implied by the context of the plugin directory.',
      [MESSAGE_ID_ENDS_WITH_PLUGIN]: 'The `id` must not end with `plugin`.',
      [MESSAGE_ID_INVALID_CHARACTERS]: 'The `id` must contain only lowercase letters, digits and hyphens.'
    },
    schema: [],
    type: 'problem'
  }
};
