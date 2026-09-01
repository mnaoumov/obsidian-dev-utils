/**
 * @file
 *
 * ESLint rule: manifest-schema
 *
 * Validates the structure of a plugin's root `manifest.json` - the required keys, the keys the Community
 * directory does not allow, duplicate keys, each value's type, and the shape of `fundingUrl`.
 *
 * Runs on the `@eslint/json` `json/json` language; see `manifest-helpers.ts` for why the AST is Momoa
 * rather than ESTree.
 */

import type { Rule } from 'eslint';

import type {
  JsonMemberNode,
  JsonObjectNode
} from './manifest-helpers.ts';

import {
  findManifestMember,
  getManifestObject,
  getManifestStringValue,
  getMemberKey,
  getStringValue,
  JSON_NODE_TYPE_BOOLEAN,
  JSON_NODE_TYPE_OBJECT,
  JSON_NODE_TYPE_STRING,
  toReportNode,
  UNRELEASED_VERSION
} from './manifest-helpers.ts';

/**
Message ID reported when a key the Community directory does not allow is present.
 */
export const MESSAGE_ID_DISALLOWED_KEY = 'disallowedKey';

/**
Message ID reported when the same key appears more than once.
 */
export const MESSAGE_ID_DUPLICATE_KEY = 'duplicateKey';

/**
Message ID reported when `fundingUrl` is an empty string, an empty object, or an object with an empty value.
 */
export const MESSAGE_ID_EMPTY_FUNDING_URL = 'emptyFundingUrl';

/**
Message ID reported when a value has the wrong type.
 */
export const MESSAGE_ID_INVALID_TYPE = 'invalidType';

/**
Message ID reported when a `fundingUrl` object holds a non-string value.
 */
export const MESSAGE_ID_INVALID_FUNDING_URL = 'invalidFundingUrl';

/**
Message ID reported when a required key is missing.
 */
export const MESSAGE_ID_MISSING_KEY = 'missingKey';

/**
Message ID reported when the manifest's top-level value is not an object.
 */
export const MESSAGE_ID_MUST_BE_ROOT_OBJECT = 'mustBeRootObject';

/**
The keys every manifest must carry, whether or not the plugin has been released.
 */
const ALWAYS_REQUIRED_KEYS = ['author', 'description', 'id', 'isDesktopOnly', 'name', 'version'];

/**
The Momoa node type each allowed key's value may have. A key absent from this map is not allowed at all.
 */
const KEY_NODE_TYPES = new Map<string, readonly string[]>([
  ['author', [JSON_NODE_TYPE_STRING]],
  ['authorUrl', [JSON_NODE_TYPE_STRING]],
  ['description', [JSON_NODE_TYPE_STRING]],
  ['fundingUrl', [JSON_NODE_TYPE_OBJECT, JSON_NODE_TYPE_STRING]],
  ['id', [JSON_NODE_TYPE_STRING]],
  ['isDesktopOnly', [JSON_NODE_TYPE_BOOLEAN]],
  ['minAppVersion', [JSON_NODE_TYPE_STRING]],
  ['name', [JSON_NODE_TYPE_STRING]],
  ['version', [JSON_NODE_TYPE_STRING]]
]);

/**
 * ESLint rule validating the structure of a plugin's root `manifest.json`.
 */
export const manifestSchema: Rule.RuleModule = {
  create(context) {
    return {
      Document(node: unknown): void {
        const manifestObject = getManifestObject(node);

        if (!manifestObject) {
          context.report({
            messageId: MESSAGE_ID_MUST_BE_ROOT_OBJECT,
            node: toReportNode(node)
          });
          return;
        }

        reportDuplicateKeys({ context, manifestObject });
        reportMissingKeys({ context, manifestObject });
        reportKeyValues({ context, manifestObject });
      }
    };
  },
  meta: {
    docs: {
      description: 'Validate the structure of a plugin\'s root `manifest.json`'
    },
    messages: {
      [MESSAGE_ID_DISALLOWED_KEY]: 'The `{{ key }}` property is not allowed in the manifest.',
      [MESSAGE_ID_DUPLICATE_KEY]: 'The `{{ key }}` property is defined more than once.',
      [MESSAGE_ID_EMPTY_FUNDING_URL]: 'The `fundingUrl` property cannot be empty. Remove it instead when no donations are accepted.',
      [MESSAGE_ID_INVALID_FUNDING_URL]: 'The `fundingUrl` object must only contain string values.',
      [MESSAGE_ID_INVALID_TYPE]: 'The `{{ key }}` property must be of type `{{ expectedType }}`, but was `{{ actualType }}`.',
      [MESSAGE_ID_MISSING_KEY]: 'The manifest is missing the required `{{ key }}` property.',
      [MESSAGE_ID_MUST_BE_ROOT_OBJECT]: 'The manifest must be a single JSON object.'
    },
    schema: [],
    type: 'problem'
  }
};

/**
 * Parameters for {@link reportFundingUrl}.
 */
interface ReportFundingUrlParams {
  /**
   * The ESLint rule context.
   */
  readonly context: Rule.RuleContext;

  /**
   * The `fundingUrl` member.
   */
  readonly member: JsonMemberNode;
}

/**
 * Parameters for the manifest reporting helpers.
 */
interface ReportParams {
  /**
   * The ESLint rule context.
   */
  readonly context: Rule.RuleContext;

  /**
   * The manifest's root object node.
   */
  readonly manifestObject: JsonObjectNode;
}

/**
 * Reports every key that appears more than once.
 *
 * @param params - The {@link ReportParams}.
 */
function reportDuplicateKeys(params: ReportParams): void {
  const { context, manifestObject } = params;
  const seenKeys = new Set<string>();

  for (const member of manifestObject.members) {
    const key = getMemberKey(member);

    if (seenKeys.has(key)) {
      context.report({
        data: { key },
        messageId: MESSAGE_ID_DUPLICATE_KEY,
        node: toReportNode(member.name)
      });
    } else {
      seenKeys.add(key);
    }
  }
}

/**
 * Reports the ways a `fundingUrl` can be empty or hold a non-string value.
 *
 * @param params - The {@link ReportFundingUrlParams}.
 */
function reportFundingUrl(params: ReportFundingUrlParams): void {
  const { context, member } = params;

  const stringValue = getStringValue(member.value);

  if (stringValue !== null) {
    if (stringValue === '') {
      context.report({
        messageId: MESSAGE_ID_EMPTY_FUNDING_URL,
        node: toReportNode(member.value)
      });
    }

    return;
  }

  const fundingObject = member.value as JsonObjectNode;

  if (fundingObject.members.length === 0) {
    context.report({
      messageId: MESSAGE_ID_EMPTY_FUNDING_URL,
      node: toReportNode(fundingObject)
    });
    return;
  }

  for (const fundingMember of fundingObject.members) {
    const fundingValue = getStringValue(fundingMember.value);

    if (fundingValue === null) {
      context.report({
        messageId: MESSAGE_ID_INVALID_FUNDING_URL,
        node: toReportNode(fundingMember.value)
      });
    } else if (fundingValue === '') {
      context.report({
        messageId: MESSAGE_ID_EMPTY_FUNDING_URL,
        node: toReportNode(fundingMember.value)
      });
    }
  }
}

/**
 * Reports every key that is not allowed, and every allowed key whose value has the wrong type.
 *
 * @param params - The {@link ReportParams}.
 */
function reportKeyValues(params: ReportParams): void {
  const { context, manifestObject } = params;

  for (const member of manifestObject.members) {
    const key = getMemberKey(member);
    const expectedNodeTypes = KEY_NODE_TYPES.get(key);

    if (!expectedNodeTypes) {
      context.report({
        data: { key },
        messageId: MESSAGE_ID_DISALLOWED_KEY,
        node: toReportNode(member.name)
      });
      continue;
    }

    if (!expectedNodeTypes.includes(member.value.type)) {
      context.report({
        data: {
          actualType: member.value.type,
          expectedType: expectedNodeTypes.join(' or '),
          key
        },
        messageId: MESSAGE_ID_INVALID_TYPE,
        node: toReportNode(member.value)
      });
      continue;
    }

    if (key === 'fundingUrl') {
      reportFundingUrl({ context, member });
    }
  }
}

/**
 * Reports every required key the manifest is missing.
 *
 * `minAppVersion` is required only once the plugin has been released. `updateVersionInFilesForPlugin`
 * writes it at release time, so a repo still at version `0.0.0` legitimately has none and must not be
 * reported for it.
 *
 * @param params - The {@link ReportParams}.
 */
function reportMissingKeys(params: ReportParams): void {
  const { context, manifestObject } = params;
  const requiredKeys = [...ALWAYS_REQUIRED_KEYS];

  if (getManifestStringValue(manifestObject, 'version') !== UNRELEASED_VERSION) {
    requiredKeys.push('minAppVersion');
  }

  for (const key of requiredKeys) {
    if (!findManifestMember(manifestObject, key)) {
      context.report({
        data: { key },
        messageId: MESSAGE_ID_MISSING_KEY,
        node: toReportNode(manifestObject)
      });
    }
  }
}
