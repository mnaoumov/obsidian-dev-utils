/**
 * @file
 *
 * Shared helpers for the `manifest.json` ESLint rules.
 *
 * The manifest is linted through `@eslint/json`'s `json/json` language, whose AST is Momoa
 * (`Document` -> `Object` -> `Member`) rather than ESTree, so these rules visit `Document` instead of
 * `Program`. That difference is exactly why `obsidianmd/validate-manifest` can never fire: it registers a
 * `Program` visitor and expects an ESTree `ObjectExpression`, which no shipped JSON parser produces.
 *
 * The Momoa node shapes are declared structurally here rather than imported from `@humanwhocodes/momoa`,
 * which is only a transitive dependency of `@eslint/json`. A type-only import would leak into the
 * published declarations and force every consumer to resolve a package it never installed.
 */

import type {
  ESLint,
  Rule
} from 'eslint';

// eslint-disable-next-line import-x/no-rename-default -- The default export name `plugin` is too confusing.
import json from '@eslint/json';

/**
 * The Momoa node type of a JSON boolean value.
 */
export const JSON_NODE_TYPE_BOOLEAN = 'Boolean';

/**
 * The Momoa node type of a JSON object value.
 */
export const JSON_NODE_TYPE_OBJECT = 'Object';

/**
 * The Momoa node type of a JSON string value.
 */
export const JSON_NODE_TYPE_STRING = 'String';

/**
 * `@eslint/json`, typed as the plugin type a flat config and `RuleTester` are written against.
 *
 * The package's rule definitions are generic over its own JSON language, which `@types/eslint`'s
 * `ESLint.Plugin` - written against ESTree rules - cannot express, so the two are nominally incompatible
 * while being exactly compatible at runtime. Registering it is what makes `language: 'json/json'`
 * resolvable, so there is no way to avoid the bridge.
 */
export const jsonPlugin: ESLint.Plugin = bridgeJsonPlugin();

/**
 * The `version` a plugin repo carries before its first release, when `minAppVersion` is legitimately absent.
 */
export const UNRELEASED_VERSION = '0.0.0';

/**
 * The root node of a parsed JSON document.
 */
export interface JsonDocumentNode extends JsonNode {
  /**
   * The document's single top-level value.
   */
  readonly body: JsonNode;
}

/**
 * A JSON literal - a string, number, boolean or null.
 */
export interface JsonLiteralNode extends JsonNode {
  /**
   * The literal's parsed value.
   */
  readonly value: boolean | null | number | string;
}

/**
 * A single `"key": value` pair of a JSON object.
 */
export interface JsonMemberNode extends JsonNode {
  /**
   * The member's key.
   */
  readonly name: JsonLiteralNode;

  /**
   * The member's value.
   */
  readonly value: JsonNode;
}

/**
 * Any node of the Momoa JSON AST.
 */
export interface JsonNode {
  /**
   * The node type, e.g. `Document`, `Object`, `Member`, `String`.
   */
  readonly type: string;
}

/**
 * A JSON object value.
 */
export interface JsonObjectNode extends JsonNode {
  /**
   * The object's members, in source order, including any duplicate keys.
   */
  readonly members: readonly JsonMemberNode[];
}

/**
 * Finds a top-level member of the manifest by key.
 *
 * @param manifestObject - The manifest's root object node.
 * @param key - The key to look for.
 * @returns The first member with that key, or `null` when the manifest has none.
 */
export function findManifestMember(manifestObject: JsonObjectNode, key: string): JsonMemberNode | null {
  return manifestObject.members.find((member) => getMemberKey(member) === key) ?? null;
}

/**
 * Reads the manifest's root object out of the visited `Document` node.
 *
 * @param node - The `Document` node handed to the rule's visitor.
 * @returns The root object node, or `null` when the document's top-level value is not an object.
 */
export function getManifestObject(node: unknown): JsonObjectNode | null {
  const document = node as JsonDocumentNode;
  return document.body.type === JSON_NODE_TYPE_OBJECT ? document.body as JsonObjectNode : null;
}

/**
 * Reads the value of a top-level string member of the manifest.
 *
 * @param manifestObject - The manifest's root object node.
 * @param key - The key to look for.
 * @returns The member's value, or `null` when it is absent or not a string.
 */
export function getManifestStringValue(manifestObject: JsonObjectNode, key: string): null | string {
  const member = findManifestMember(manifestObject, key);
  return member ? getStringValue(member.value) : null;
}

/**
 * Reads a member's key.
 *
 * Under the `json/json` language a member's name is always a string node - identifier keys exist only in
 * JSON5 - so this never has to account for a missing key.
 *
 * @param member - The member to read.
 * @returns The member's key.
 */
export function getMemberKey(member: JsonMemberNode): string {
  return member.name.value as string;
}

/**
 * Reads the value of a Momoa string node.
 *
 * @param node - The node to read.
 * @returns The string value, or `null` when the node is not a string.
 */
export function getStringValue(node: JsonNode): null | string {
  if (node.type !== JSON_NODE_TYPE_STRING) {
    return null;
  }

  const literal = node as JsonLiteralNode;
  return literal.value as string;
}

/**
 * Bridges a Momoa node to the node type `context.report()` is typed against.
 *
 * The two are structurally incompatible - ESLint's rule types describe ESTree - but the `json/json`
 * language's source code adapter resolves a Momoa node's position at report time, so they are compatible
 * at runtime. This mirrors the bridge `rule-tester-helper.ts` makes over the same kind of type-level gap.
 *
 * @param node - The Momoa node to report on.
 * @returns The same node, typed for `context.report()`.
 */
export function toReportNode(node: unknown): Rule.Node {
  const bridged: unknown = node;
  return bridged as Rule.Node;
}

/**
 * Casts `@eslint/json` to the plugin type `@types/eslint` declares.
 *
 * @returns The `@eslint/json` plugin, typed for a flat config.
 */
function bridgeJsonPlugin(): ESLint.Plugin {
  const bridged: unknown = json;
  return bridged as ESLint.Plugin;
}
