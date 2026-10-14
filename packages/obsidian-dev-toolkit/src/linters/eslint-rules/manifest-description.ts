/**
 * @file
 *
 * ESLint rule: manifest-description
 *
 * Enforces the Community directory's constraints on a plugin's `manifest.json` `description`.
 *
 * Two of these checks deliberately diverge from `obsidianmd/validate-manifest`:
 *
 * - **Self-reference, not the word `plugin`.** Upstream's `FORBIDDEN_WORDS` bans the bare substring
 *   `plugin` in the description, which rejects two descriptions the directory itself passed untouched -
 *   `Enhances Note composer core plugin.` and `...not plugin updates...` - because each names something
 *   other than itself. The directory's actual objection is self-reference, so only self-referential
 *   phrases are matched here.
 * - **No character whitelist.** Upstream's format check rejects anything outside
 *   `[A-Za-z0-9\s.,!?'"-]`, which fails backticks, em dashes, parentheses, colons and slashes. Seven
 *   live listings carry those and the directory flagged none, so the check is noise rather than a gate.
 *
 * The no-`Obsidian` check has the opposite provenance: the directory enforces it and no Obsidian
 * document states it, which is what cost a released plugin a version bump for one word.
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
Message ID reported when the description contains the word `Obsidian`.
 */
export const MESSAGE_ID_CONTAINS_OBSIDIAN = 'descriptionContainsObsidian';

/**
Message ID reported when the description does not end with a period.
 */
export const MESSAGE_ID_MISSING_PERIOD = 'descriptionMissingPeriod';

/**
Message ID reported when the description does not start with a capital letter.
 */
export const MESSAGE_ID_NOT_CAPITALIZED = 'descriptionNotCapitalized';

/**
Message ID reported when the description refers to itself.
 */
export const MESSAGE_ID_SELF_REFERENCE = 'descriptionSelfReference';

/**
Message ID reported when the description is longer than the directory allows.
 */
export const MESSAGE_ID_TOO_LONG = 'descriptionTooLong';

/**
Message ID reported when the description is too short to describe anything.
 */
export const MESSAGE_ID_TOO_SHORT = 'descriptionTooShort';

/**
The longest description the Community directory accepts.
 */
const MAX_DESCRIPTION_LENGTH = 250;

/**
The shortest description that can plausibly say what a plugin does.
 */
const MIN_DESCRIPTION_LENGTH = 10;

/**
The word `Obsidian`, which the directory rejects in a description even though no Obsidian document says so.
 */
const OBSIDIAN_WORD = /\bobsidian\b/i;

/**
The phrasings the directory calls out as self-reference. A bare `plugin` is deliberately not among them:
naming another plugin, or plugins in general, is not referring to oneself.
 */
const SELF_REFERENCE_PATTERNS = [
  /\bthis plugin\b/i,
  /\bthis is a plugin\b/i,
  /\ba plugin (?:that|which)\b/i,
  /^the plugin\b/i,
  /^plugin\b/i
];

/**
 * ESLint rule enforcing the Community directory's constraints on a plugin's `manifest.json` `description`.
 */
export const manifestDescription: Rule.RuleModule = {
  create(context) {
    return {
      Document(node: unknown): void {
        const manifestObject = getManifestObject(node);

        if (!manifestObject) {
          return;
        }

        const member = findManifestMember(manifestObject, 'description');

        if (!member) {
          return;
        }

        const description = getStringValue(member.value);

        if (description === null) {
          return;
        }

        const reportNode = toReportNode(member.value);

        if (OBSIDIAN_WORD.test(description)) {
          context.report({
            messageId: MESSAGE_ID_CONTAINS_OBSIDIAN,
            node: reportNode
          });
        }

        if (SELF_REFERENCE_PATTERNS.some((pattern) => pattern.test(description))) {
          context.report({
            messageId: MESSAGE_ID_SELF_REFERENCE,
            node: reportNode
          });
        }

        if (description.length < MIN_DESCRIPTION_LENGTH) {
          context.report({
            messageId: MESSAGE_ID_TOO_SHORT,
            node: reportNode
          });
        }

        if (description.length > MAX_DESCRIPTION_LENGTH) {
          context.report({
            data: { maxLength: MAX_DESCRIPTION_LENGTH.toString() },
            messageId: MESSAGE_ID_TOO_LONG,
            node: reportNode
          });
        }

        if (!/^[A-Z]/.test(description)) {
          context.report({
            messageId: MESSAGE_ID_NOT_CAPITALIZED,
            node: reportNode
          });
        }

        if (!description.endsWith('.')) {
          context.report({
            messageId: MESSAGE_ID_MISSING_PERIOD,
            node: reportNode
          });
        }
      }
    };
  },
  meta: {
    docs: {
      description: 'Enforce the Community directory\'s constraints on a plugin\'s `manifest.json` `description`'
    },
    messages: {
      [MESSAGE_ID_CONTAINS_OBSIDIAN]: 'The `description` must not contain the word `Obsidian`. It is implied by the context of the plugin directory.',
      [MESSAGE_ID_MISSING_PERIOD]: 'The `description` must end with a period.',
      [MESSAGE_ID_NOT_CAPITALIZED]: 'The `description` must start with a capital letter.',
      [MESSAGE_ID_SELF_REFERENCE]: 'The `description` must not refer to itself, e.g. `this plugin` or `a plugin that`. Describe what it does instead.',
      [MESSAGE_ID_TOO_LONG]: 'The `description` must be at most {{ maxLength }} characters.',
      [MESSAGE_ID_TOO_SHORT]: 'The `description` is too short to say what the plugin does.'
    },
    schema: [],
    type: 'problem'
  }
};
