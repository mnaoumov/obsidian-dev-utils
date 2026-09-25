/**
 * @file
 *
 * Rewrites a note's YAML front matter by splicing its concrete syntax tree, so every region a change does not reach
 * keeps the exact bytes its author wrote — comments and the whitespace inside them, quoting style, blank lines,
 * indentation width, flow versus block collections, and folded and literal scalars.
 *
 * Obsidian's own `processFrontMatter()` parses the block to a plain object and re-stringifies the whole of it, so a
 * callback that changes one key rewrites every other. Re-emitting the parsed document instead of the raw text does not
 * fix that: five of the losses survive every emit option the `yaml` package offers. Splicing the CST does fix it,
 * because an untouched token is never re-emitted at all — {@link https://github.com/eemeli/yaml | the library} keeps
 * each token's original source text and {@link https://eemeli.org/yaml/#cst-parser | `CST.stringify`} concatenates it.
 *
 * This module is DELIBERATELY not on the default path. It needs the `yaml` package's CST API, which Obsidian does not
 * hand to plugins through its module map — that map is `obsidian`, `@codemirror/*` and `@lezer/*` and nothing else —
 * so the package cannot be marked external and lands in the consuming plugin's `main.js`, about 100 KB of it. A plugin
 * opts in by calling {@link enableFrontmatterFormattingPreservation} once, and only it pays.
 */

import type {
  Node,
  ParsedNode
} from 'yaml';

import {
  getFrontMatterInfo,
  parseYaml,
  stringifyYaml
} from 'obsidian';
import {
  Composer,
  CST,
  isAlias,
  parseDocument,
  Parser,
  stringify,
  visit
} from 'yaml';

import type { GenericObject } from '../type-guards.ts';

import {
  castTo,
  isDeepEqual
} from '../object-utils.ts';
import { insertAt } from '../string.ts';
import {
  checkIsPlainObject,
  registerFrontmatterFormattingPreserver
} from './frontmatter.ts';

/**
 * A block or flow collection token whose items the splice rearranges.
 */
type CollectionToken = CST.BlockMap | CST.BlockSequence;

/**
 * One step of the edit script {@link buildEditScript} derives for a sequence.
 *
 * `keep` reuses the old item's token untouched, `merge` reuses it and rewrites its value in place, and `insert`
 * emits a brand new item. A removal produces no step at all — it is simply an old index no step names.
 */
interface EditStep {
  readonly kind: 'insert' | 'keep' | 'merge';
  readonly newIndex: number;
  readonly oldIndex: number;
}

/**
 * The `sep` and `value` tokens of a freshly emitted block-map item, ready to be transplanted onto an existing one.
 */
interface MapItemTokens {
  readonly separatorTokens: CST.SourceToken[];
  readonly value: CST.Token | undefined;
}

/**
 * A sequence long enough that the quadratic edit script stops being worth its cost.
 *
 * A front matter sequence is a tag list or an alias list, so this is never approached in practice; it is here so that a
 * pathological one degrades to a whole-collection re-emit instead of stalling the write queue.
 */
const EDIT_SCRIPT_CELL_LIMIT = 10_000;

/**
 * What a mapping emits as when every one of its values is `undefined`, i.e. when it has nothing to write at all.
 */
const EMPTY_MAPPING_FRAGMENT = '{}';

/**
 * The options Obsidian itself passes to `stringify()`, read out of its bundle.
 *
 * Every fragment this module emits goes through them, so a fragment it writes is byte-identical to the one the
 * parse-and-stringify path would have written for the same value.
 */
const OBSIDIAN_STRINGIFY_OPTIONS = {
  aliasDuplicateObjects: false,
  lineWidth: 0,
  // eslint-disable-next-line unicorn/name-replacements -- `nullStr` is the `yaml` package's own option name.
  nullStr: ''
} as const;

/**
 * The key a fragment is emitted under when only its value is wanted. Never reaches the output.
 */
const PLACEHOLDER_KEY = 'k';

/**
 * The `Array.at()` index of the token before the last one, which is where a newline sits when an indent follows it.
 */
const SECOND_TO_LAST_INDEX = -2;

const TRAILING_NEWLINE_REG_EXP = /\n$/;

const UNRESOLVED_TAG_WARNING_CODE = 'TAG_RESOLVE_FAILED';

/**
 * One step of the raw edit script, before removals are folded into the insertions that follow them.
 */
interface RawEditStep {
  readonly kind: 'insert' | 'keep' | 'remove';
  readonly newIndex: number;
  readonly oldIndex: number;
}

/**
 * What `CST.resolveAsScalar` hands back for a key: the scalar's own text, never a schema-resolved value.
 */
interface ResolvedScalar {
  readonly value: string;
}

/**
 * Registers this module's engine as the front matter formatting preserver for every write this library performs.
 *
 * Call it once, from a plugin's `onloadImpl()`. It takes effect for `processFrontmatter()`, `applyFileChanges()` and
 * every other path that reaches `setFrontmatter()`, including the ones the calling plugin does not invoke itself.
 *
 * There is one preserver per realm, so two plugins that both call this simply agree.
 */
export function enableFrontmatterFormattingPreservation(): void {
  registerFrontmatterFormattingPreserver(preserveFrontmatterFormatting);
}

/**
 * Rewrites the front matter of a note, keeping the original bytes of everything the change does not reach.
 *
 * It is the engine {@link enableFrontmatterFormattingPreservation} registers, and can be called directly as well.
 *
 * `null` means "this one is not mine": the block does not exist, the new front matter is empty (both are the
 * parse-and-stringify path's business, unchanged), or the splice could not be proved faithful. The proof is not
 * hand-waved — the spliced block is re-parsed and compared against the value the parse-and-stringify path would have
 * produced for the same input, and any difference returns `null`. That is what makes this strictly better than that
 * path or identical to it, and never worse.
 *
 * @param content - The note to rewrite the front matter of.
 * @param newFrontmatter - The front matter to write.
 * @returns The new note, or `null` when the caller should parse the block and write the whole of it out again instead.
 */
export function preserveFrontmatterFormatting(content: string, newFrontmatter: object): null | string {
  const frontmatterInfo = getFrontMatterInfo(content);
  if (!frontmatterInfo.exists || Object.keys(newFrontmatter).length === 0) {
    return null;
  }

  const splicedBody = spliceFrontmatterBody(frontmatterInfo.frontmatter, newFrontmatter);
  return splicedBody === null
    ? null
    : insertAt({
      $string: content,
      endIndex: frontmatterInfo.to,
      startIndex: frontmatterInfo.from,
      substring: splicedBody
    });
}

/**
 * Derives the edit script that turns `oldArray` into `newArray`, reusing as many of the old items as it can.
 *
 * A longest-common-subsequence diff over value equality is what recovers the AUTHOR's operation. Replaying the
 * mutation an array method performed instead — `[a, b, c].splice(1, 1)` writes `[1] = 'c'` then truncates — would
 * overwrite `b`'s node with `c`'s value and delete `c`'s node, so `b`'s comment would end up annotating `c`: exactly
 * the misattribution this module exists to prevent.
 *
 * A removal immediately followed by an insertion of the same shape is folded into a single `merge`, so an item edited
 * in place (`[{ qty: 1 }]` to `[{ qty: 2 }]`) keeps its own node and its comments rather than being rebuilt.
 *
 * @param oldArray - The sequence as the source holds it.
 * @param newArray - The sequence as it is to be written.
 * @returns The steps to apply, in output order.
 */
function buildEditScript(oldArray: readonly unknown[], newArray: readonly unknown[]): EditStep[] {
  const rawSteps = buildRawEditScript(oldArray, newArray);
  const steps: EditStep[] = [];

  for (let index = 0; index < rawSteps.length; index++) {
    const step = castTo<RawEditStep>(rawSteps[index]);
    const nextStep = rawSteps[index + 1];
    if (
      step.kind === 'remove' && nextStep?.kind === 'insert'
      && checkIsMergeable(oldArray[step.oldIndex], newArray[nextStep.newIndex])
    ) {
      steps.push({ kind: 'merge', newIndex: nextStep.newIndex, oldIndex: step.oldIndex });
      index++;
      continue;
    }

    if (step.kind !== 'remove') {
      steps.push({ kind: step.kind, newIndex: step.newIndex, oldIndex: step.oldIndex });
    }
  }

  return steps;
}

function buildRawEditScript(oldArray: readonly unknown[], newArray: readonly unknown[]): RawEditStep[] {
  const oldLength = oldArray.length;
  const newLength = newArray.length;
  const commonLengths = Array.from({ length: oldLength + 1 }, () => Array.from({ length: newLength + 1 }, () => 0));

  for (let oldIndex = oldLength - 1; oldIndex >= 0; oldIndex--) {
    for (let newIndex = newLength - 1; newIndex >= 0; newIndex--) {
      const row = castTo<number[]>(commonLengths[oldIndex]);
      const nextRow = castTo<number[]>(commonLengths[oldIndex + 1]);
      row[newIndex] = isDeepEqual(oldArray[oldIndex], newArray[newIndex])
        ? castTo<number>(nextRow[newIndex + 1]) + 1
        : Math.max(castTo<number>(nextRow[newIndex]), castTo<number>(row[newIndex + 1]));
    }
  }

  const steps: RawEditStep[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLength && newIndex < newLength) {
    if (isDeepEqual(oldArray[oldIndex], newArray[newIndex])) {
      steps.push({ kind: 'keep', newIndex, oldIndex });
      oldIndex++;
      newIndex++;
      continue;
    }

    const removalRow = castTo<number[]>(commonLengths[oldIndex + 1]);
    const insertionRow = castTo<number[]>(commonLengths[oldIndex]);
    const removalCommonLength = castTo<number>(removalRow[newIndex]);
    const insertionCommonLength = castTo<number>(insertionRow[newIndex + 1]);
    if (removalCommonLength >= insertionCommonLength) {
      steps.push({ kind: 'remove', newIndex: -1, oldIndex });
      oldIndex++;
    } else {
      steps.push({ kind: 'insert', newIndex, oldIndex: -1 });
      newIndex++;
    }
  }

  for (; oldIndex < oldLength; oldIndex++) {
    steps.push({ kind: 'remove', newIndex: -1, oldIndex });
  }

  for (; newIndex < newLength; newIndex++) {
    steps.push({ kind: 'insert', newIndex, oldIndex: -1 });
  }

  return steps;
}

function checkCarriesIndent(item: CST.CollectionItem, indent: number): boolean {
  return CST.stringify(item).replace(/^\n+/, '').startsWith(' '.repeat(indent));
}

function checkHasAnchorOrAlias(contents: ParsedNode): boolean {
  let hasAnchorOrAlias = false;

  visit(contents, {
    Node(_key: unknown, node: Node): symbol | undefined {
      if (!isAlias(node) && node.anchor === undefined) {
        return undefined;
      }

      hasAnchorOrAlias = true;
      return visit.BREAK;
    }
  });

  return hasAnchorOrAlias;
}

function checkIsMergeable(oldValue: unknown, newValue: unknown): boolean {
  return (checkIsPlainObject(oldValue) && checkIsPlainObject(newValue)) || (Array.isArray(oldValue) && Array.isArray(newValue));
}

/**
 * Checks the spliced block against the one the parse-and-stringify path would have written for the same value.
 *
 * Comparing the two PARSED values rather than the two texts is the whole point: the texts are supposed to differ — that
 * is the formatting this module preserves — while the values must not. Comparing against that path's output rather than
 * against `newFrontmatter` itself is what makes the guarantee exact, since both sides then carry the same round-trip
 * losses, `undefined` values dropped and timestamps read back as dates among them.
 *
 * @param splicedBody - The spliced block text.
 * @param newFrontmatter - The front matter that was to be written.
 * @returns Whether the spliced block reads back as the value the parse-and-stringify path would have written.
 */
function checkIsSemanticMatch(splicedBody: string, newFrontmatter: object): boolean {
  let splicedValue: unknown;

  try {
    splicedValue = parseYaml(splicedBody);
    /*
     * v8 ignore start -- A net, not a path: `parseYaml` THROWS on a block it cannot read rather than reporting it, and
     * a splice could produce one. A 36 000-mutation differential fuzz found 93 that did, every one of them the
     * valueless-item shape `normalizeItemIndents` now repairs, and none at all afterwards — so there is no input left
     * to pin this with, and the contract that it upholds (decline, never throw) is the one this module's callers rely
     * on. Do not delete it on the strength of that: it is the reason a future shape is a fallback rather than a crash.
     */
  } catch {
    return false;
    /* v8 ignore stop */
  }

  return isDeepEqual(splicedValue, parseYaml(stringifyYaml(newFrontmatter)));
}

function createMapItem(key: string, value: unknown, indent: number): CST.CollectionItem | null {
  const fragment = stringify({ [key]: value }, OBSIDIAN_STRINGIFY_OPTIONS);
  // An empty mapping means the value is `undefined`, which the rewrite path drops as well. Drop the key with it.
  return fragment.trimEnd() === EMPTY_MAPPING_FRAGMENT ? null : liftFragmentItem(fragment, indent, true);
}

function createSeqItem(value: unknown, indent: number): CST.CollectionItem {
  return liftFragmentItem(stringify([value], OBSIDIAN_STRINGIFY_OPTIONS), indent, true);
}

function createSpaceToken(indent: number): CST.SourceToken {
  return {
    indent,
    offset: -1,
    source: ' '.repeat(indent),
    type: 'space'
  };
}

/**
 * Rebuilds a block map's items so it represents `newObject`, reusing each surviving key's own item token.
 *
 * The items are rebuilt in the NEW object's key order rather than the source's, so a callback that sorts or reorders
 * keys still sorts them — the reordered key simply takes its comment, its quoting and its value formatting with it.
 *
 * `false` means the caller should re-emit this whole collection instead: a duplicate key, a key no string can name, or
 * a nested merge that gave up.
 *
 * @param token - The block map to rebuild.
 * @param oldObject - The mapping as the source holds it.
 * @param newObject - The mapping to write.
 * @returns Whether the token now represents `newObject`.
 */
function didMergeMap(token: CST.BlockMap, oldObject: GenericObject, newObject: GenericObject): boolean {
  normalizeItemIndents(token);
  const itemsByKey = new Map<string, CST.CollectionItem>();

  for (const item of token.items) {
    const key = readItemKey(item);
    if (key === null || itemsByKey.has(key)) {
      return false;
    }

    itemsByKey.set(key, item);
  }

  const mergedItems: CST.CollectionItem[] = [];

  for (const [key, newValue] of Object.entries(newObject)) {
    const item = itemsByKey.get(key);

    if (!item) {
      const createdItem = createMapItem(key, newValue, token.indent);
      if (createdItem !== null) {
        mergedItems.push(createdItem);
      }

      continue;
    }

    mergeItemValue(item, oldObject[key], newValue, token.indent, false);
    mergedItems.push(item);
  }

  if (mergedItems.length === 0) {
    return false;
  }

  finalizeItems(mergedItems);
  token.items = castTo<CST.BlockMap['items']>(mergedItems);
  return true;
}

/**
 * Rebuilds a block sequence's items so it represents `newArray`, reusing the token of every item that survives.
 *
 * @param token - The block sequence to rebuild.
 * @param oldArray - The sequence as the source holds it.
 * @param newArray - The sequence to write.
 * @returns Whether the token now represents `newArray`.
 */
function didMergeSeq(token: CST.BlockSequence, oldArray: readonly unknown[], newArray: readonly unknown[]): boolean {
  if (oldArray.length * newArray.length > EDIT_SCRIPT_CELL_LIMIT) {
    return false;
  }

  normalizeItemIndents(token);
  const mergedItems: CST.CollectionItem[] = [];

  for (const step of buildEditScript(oldArray, newArray)) {
    if (step.kind === 'insert') {
      mergedItems.push(createSeqItem(newArray[step.newIndex], token.indent));
      continue;
    }

    const item = castTo<CST.CollectionItem>(token.items[step.oldIndex]);
    if (step.kind === 'merge') {
      mergeItemValue(item, oldArray[step.oldIndex], newArray[step.newIndex], token.indent, true);
    }

    mergedItems.push(item);
  }

  if (mergedItems.length === 0) {
    return false;
  }

  finalizeItems(mergedItems);
  token.items = castTo<CST.BlockSequence['items']>(mergedItems);
  return true;
}

/**
 * Gives a nested collection's first item the leading indent of its own, so the items become interchangeable.
 *
 * A nested collection's first item carries no indent in the source: the indent sits in whatever precedes the
 * collection — the separator's trailing spaces, or the dash of the sequence item it belongs to. Every later item
 * carries its own. Removing or reordering the first item without repairing that leaves the survivor doubly indented,
 * so the indent is moved out of the separator and onto the item before anything is rearranged.
 *
 * The one shape it cannot repair is a first item written INLINE with what precedes it (`- name: a`), where there is no
 * indent to move because the item is not at the start of its line. Such a collection is re-emitted whole instead.
 *
 * @param precedingTokens - The separator tokens that sit between the parent and the collection.
 * @param collection - The collection whose first item is to carry its own indent.
 * @returns Whether the collection's items are now interchangeable.
 */
function didNormalizeFirstItemIndent(precedingTokens: CST.SourceToken[] | undefined, collection: CollectionToken): boolean {
  // A parsed block collection always holds at least one item, or it would not have parsed as a collection at all.
  const firstItem = castTo<CST.CollectionItem>(collection.items[0]);

  if (collection.indent === 0 || checkCarriesIndent(firstItem, collection.indent)) {
    return true;
  }

  const lastToken = precedingTokens?.at(-1);
  if (lastToken?.type !== 'space' || precedingTokens?.at(SECOND_TO_LAST_INDEX)?.type !== 'newline') {
    return false;
  }

  precedingTokens.pop();
  firstItem.start.unshift(lastToken);
  return true;
}

function emitMapItemTokens(value: unknown, indent: number, shouldPreferFlow: boolean): MapItemTokens {
  const fragment = shouldPreferFlow
    ? `${PLACEHOLDER_KEY}: ${stringifyFlow(value)}`
    : stringify({ [PLACEHOLDER_KEY]: value }, OBSIDIAN_STRINGIFY_OPTIONS);
  const item = liftFragmentItem(fragment, indent, false);
  return { separatorTokens: castTo<CST.SourceToken[]>(item.sep), value: item.value };
}

function emitSeqItem(value: unknown, indent: number, shouldPreferFlow: boolean): CST.CollectionItem {
  const fragment = shouldPreferFlow ? `- ${stringifyFlow(value)}` : stringify([value], OBSIDIAN_STRINGIFY_OPTIONS);
  return liftFragmentItem(fragment, indent, false);
}

/**
 * Makes the merged items of a collection joinable again, whatever the merge did to their order.
 *
 * An item that was not first can carry the blank line that separated it from its predecessor, which becomes a leading
 * blank line once it IS first, and nothing in the item tokens themselves shows it. Every item already ends in its own
 * newline, because Obsidian's front matter block always ends in one, so reordering never joins two items on one line.
 *
 * @param items - The merged items, mutated in place.
 */
function finalizeItems(items: CST.CollectionItem[]): void {
  const firstItem = castTo<CST.CollectionItem>(items[0]);
  while (firstItem.start[0]?.type === 'newline') {
    firstItem.start.shift();
  }
}

function indentLines(text: string, indent: number): string {
  if (indent === 0) {
    return text;
  }

  const padding = ' '.repeat(indent);
  return text.split('\n').map((line) => line === '' ? line : padding + line).join('\n');
}

/**
 * Parses a freshly emitted fragment and hands back its one collection item, indented to sit where it is going.
 *
 * The fragment's own lines are indented before parsing, so every token inside it carries the absolute indent the
 * output needs. The item's OWN leading indent is not part of that — a first item never carries one, the indent being
 * supplied by whatever precedes the collection — so it is prepended as a token, which is what makes the item uniform
 * with its new siblings and therefore free to be reordered or to become the first.
 *
 * The fragment was produced by `stringify` a line above the call, as a one-item block collection, so it always parses
 * back as one — which is why this reads the item out rather than checking for it. Were that ever to stop holding, the
 * resulting throw is caught by `setFrontmatter`'s seam, which reports it and writes the block the ordinary way.
 *
 * @param fragment - The emitted YAML fragment, at indent zero.
 * @param indent - The indent the item will sit at.
 * @param shouldCarryIndent - Whether to prepend the item's own leading indent token.
 * @returns The item.
 */
function liftFragmentItem(fragment: string, indent: number, shouldCarryIndent: boolean): CST.CollectionItem {
  const root = parseDocument(indentLines(fragment, indent), { keepSourceTokens: true }).contents?.srcToken;
  const item = castTo<CST.CollectionItem>(castTo<CollectionToken>(root).items[0]);

  if (shouldCarryIndent && indent > 0) {
    item.start.unshift(createSpaceToken(indent));
  }

  return item;
}

/**
 * Rewrites an item's value in place where it can, and re-emits the whole value where it cannot.
 *
 * @param item - The collection item to rewrite the value of.
 * @param oldValue - The value the source holds.
 * @param newValue - The value to write.
 * @param parentIndent - The indent of the collection the item belongs to.
 * @param isSeqItem - Whether the item is a sequence item, which carries no `sep` and no key.
 */
function mergeItemValue(item: CST.CollectionItem, oldValue: unknown, newValue: unknown, parentIndent: number, isSeqItem: boolean): void {
  if (isDeepEqual(oldValue, newValue)) {
    // Untouched: its bytes stay exactly as its author wrote them. This is the whole point of the module.
    return;
  }

  const valueToken = item.value;
  const precedingTokens = isSeqItem ? item.start : item.sep;

  if (
    (valueToken?.type === 'block-map' && checkIsPlainObject(oldValue) && checkIsPlainObject(newValue)
      && didNormalizeFirstItemIndent(precedingTokens, valueToken) && didMergeMap(valueToken, oldValue, newValue)) || (valueToken?.type === 'block-seq' && Array.isArray(oldValue) && Array.isArray(newValue)
        && didNormalizeFirstItemIndent(precedingTokens, valueToken) && didMergeSeq(valueToken, oldValue, newValue))
  ) {
    return;
  }

  replaceItemValue(item, newValue, parentIndent, valueToken?.type === 'flow-collection', isSeqItem);
}

/**
 * Gives every item of a collection the indent of its own line, so that any of them can be removed or moved.
 *
 * An item with NO VALUE — a bare `-`, or `key:` with nothing after it — absorbs the newline that ends its line AND the
 * indent of the line after it, because the parser has nothing else to hang them on. Removing or moving such an item
 * therefore takes its successor's indent with it, and the block that comes back does not parse at all.
 *
 * Measured: over a 36 000-mutation differential fuzz this ONE shape accounted for every splice the safety net had to
 * refuse on unreadable output — 93 of them — so it is a fidelity fix rather than a correctness one, the safety net
 * having already made each of those a fallback.
 *
 * @param collection - The collection whose items are to carry their own indent.
 */
function normalizeItemIndents(collection: CollectionToken): void {
  for (const [index, item] of collection.items.entries()) {
    const nextItem = castTo<CST.CollectionItem | undefined>(collection.items[index + 1]);
    if (!nextItem || item.value) {
      continue;
    }

    // A map item hangs them on its `sep`, a sequence item on its `start`, that being all it has.
    const trailingTokens = item.sep?.length ? item.sep : item.start;
    const lastToken = trailingTokens.at(-1);
    if (lastToken?.type !== 'space' || trailingTokens.at(SECOND_TO_LAST_INDEX)?.type !== 'newline') {
      continue;
    }

    trailingTokens.pop();
    nextItem.start.unshift(lastToken);
  }
}

/**
 * Names the key an item is addressed by, or `null` when no string can name it.
 *
 * `resolveAsScalar` yields the scalar's TEXT rather than a schema-resolved value, so the answer is always a string —
 * and it is the same string the plain-object projection both sides of the merge are compared through, which is what
 * lets a `42:` key match the projection's `'42'` without quoting it on the way out.
 *
 * @param item - The item to name the key of.
 * @returns The key, or `null` when the key is a collection rather than a scalar.
 */
function readItemKey(item: CST.CollectionItem): null | string {
  return !item.key || !CST.isScalar(item.key) ? null : castTo<ResolvedScalar>(CST.resolveAsScalar(item.key)).value;
}

function replaceItemValue(item: CST.CollectionItem, newValue: unknown, indent: number, shouldPreferFlow: boolean, isSeqItem: boolean): void {
  if (isSeqItem) {
    setItemValue(item, emitSeqItem(newValue, indent, shouldPreferFlow).value);
    return;
  }

  const emittedTokens = emitMapItemTokens(newValue, indent, shouldPreferFlow);
  // eslint-disable-next-line unicorn/name-replacements -- `sep` is the `yaml` package's own property name.
  item.sep = emittedTokens.separatorTokens;
  setItemValue(item, emittedTokens.value);
}

/**
 * Assigns an item's value token, removing the property outright when the emitted value has none.
 *
 * A key with a `null` value emits as `key:` with nothing after the separator, so the item genuinely has no value
 * token — and under `exactOptionalPropertyTypes` that is a property to delete, not one to set to `undefined`.
 *
 * @param item - The item to assign the value token of.
 * @param value - The value token, or `undefined` when the emitted value has none.
 */
function setItemValue(item: CST.CollectionItem, value: CST.Token | undefined): void {
  if (value === undefined) {
    delete item.value;
    return;
  }

  item.value = value;
}

/**
 * Splices the text INSIDE a front matter block's delimiters, leaving both `---` lines untouched.
 *
 * @param source - The front matter block's text.
 * @param newFrontmatter - The front matter to write.
 * @returns The new block text, or `null` when the splice could not be proved faithful.
 */
function spliceFrontmatterBody(source: string, newFrontmatter: object): null | string {
  const tokens = [...new Parser().parse(source)];
  const documents = [...new Composer({ keepSourceTokens: true }).compose(tokens, true)];
  // A second document is reachable — a `...` end marker starts one — and splicing the first would emit both.
  const document = documents.length === 1 ? documents[0] : undefined;

  if (!document || document.errors.length > 0 || document.warnings.some((warning) => warning.code === UNRESOLVED_TAG_WARNING_CODE)) {
    return null;
  }

  const contents = document.contents;
  const rootToken = contents?.srcToken;
  // An anchor is a second name for a node, so a splice that moves or drops one of the two silently rewrites the other.
  // Nothing here is worth that risk for a construct Obsidian's own property editor cannot produce.
  if (!contents || rootToken?.type !== 'block-map' || checkHasAnchorOrAlias(contents)) {
    return null;
  }

  // A block-map root always projects to a plain object, so this is a cast rather than a check. Anything that made it
  // untrue would still be caught downstream: the merge would write a mapping the safety net then refuses.
  const oldFrontmatter = castTo<GenericObject>(document.toJS());

  if (!didMergeMap(rootToken, oldFrontmatter, castTo<GenericObject>(newFrontmatter))) {
    return null;
  }

  // Every token, not just the root collection's: a comment before or after the mapping belongs to the DOCUMENT, so
  // `CST.stringify(contents.srcToken)` alone silently drops both.
  const emittedBody = tokens.map((token) => CST.stringify(token)).join('');

  // The replaced region has to end in exactly one newline, as Obsidian's front matter block always does, or the closing
  // `---` moves off its own line. A block whose last key was dropped can emit none, so it is normalized, not trusted.
  const splicedBody = `${emittedBody.replace(TRAILING_NEWLINE_REG_EXP, '')}\n`;

  return checkIsSemanticMatch(splicedBody, newFrontmatter) ? splicedBody : null;
}

function stringifyFlow(value: unknown): string {
  return stringify(value, {
    ...OBSIDIAN_STRINGIFY_OPTIONS,
    collectionStyle: 'flow',
    flowCollectionPadding: false
  });
}
