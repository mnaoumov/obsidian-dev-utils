/**
 * @file
 *
 * Obsidian-specific HTML element helpers.
 *
 * Unlike the Obsidian-runtime-agnostic helpers in `src/html-element.ts`, these depend on
 * Obsidian-specific presentation — the `markdown-rendered` CSS class that styles rendered markdown, and
 * the `Editor > Spellcheck` vault setting — so they live in the Obsidian layer and use Obsidian's
 * `createEl` DOM augmentation.
 */

import type { App } from 'obsidian';

import { CssClass } from './css-class.ts';
import {
  isSpellcheckEnabledForMode,
  SpellcheckMode
} from './obsidian-settings.ts';

// The first code point of the Basic Multilingual Plane's Private Use Area. Written as a code point and
// composed at runtime rather than as a string escape, so the constant below stays legible in the source
// instead of being an invisible character no reader can identify.
const PRIVATE_USE_AREA_FIRST_CODE_POINT = 0xE0_00;

// Wraps a value that should render as a code block. A private-use code point, so it cannot collide with
// anything a translator would legitimately write, and so a message that somehow reaches the user with
// its delimiters intact is visibly wrong rather than plausibly intentional.
const CODE_BLOCK_DELIMITER = String.fromCodePoint(PRIVATE_USE_AREA_FIRST_CODE_POINT);

/**
 * Options for {@link applySpellcheckMode}.
 */
export interface ApplySpellcheckModeParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The element to set the `spellcheck` attribute on.
   */
  readonly element: HTMLElement;

  /**
   * The mode deciding whether the element is spell-checked.
   *
   * @default `SpellcheckMode.Off`
   */
  readonly spellcheckMode?: SpellcheckMode;
}

/**
 * Appends a code block to the given DocumentFragment or HTMLElement, styled to match Obsidian's
 * rendered-markdown inline code.
 *
 * @param element - The DocumentFragment or HTMLElement to append the code block to.
 * @param code - The code to be displayed in the code block.
 */
export function appendCodeBlock(element: DocumentFragment | HTMLElement, code: string): void {
  element.createEl('strong', { cls: `${CssClass.MarkdownRendered} ${CssClass.Code}` }, (strong) => {
    strong.createEl('code', { text: code });
  });
}

/**
 * Sets the `spellcheck` attribute on an element from a {@link SpellcheckMode}.
 *
 * The attribute has to be set explicitly, because both of the surfaces that need this are born with
 * `spellcheck="false"`: `AbstractTextComponent` forces it onto every text component, and Obsidian builds
 * every `SuggestModal` input with it without consulting `Editor > Spellcheck` at all.
 *
 * Which of those a given box wants is a call-site decision, and the distinction that holds up is what the
 * box is FOR: one that only FINDS something is a search field and stays unchecked, because squiggles under
 * half-typed fragments are noise; one that NAMES something is a prose field and follows the setting, the
 * way Obsidian's own inline title and file-explorer rename do.
 *
 * Call it again whenever that answer changes — a picker that switches between finding and creating flips
 * modes mid-open, and the attribute has to follow.
 *
 * The name being typed may be a PATH rather than a bare basename, so folder segments get checked too.
 * That is what Obsidian's own inline rename does, and the alternative — checking only the last segment —
 * cannot be expressed as an attribute.
 *
 * @param params - The parameters for applying the spellcheck mode.
 */
export function applySpellcheckMode(params: ApplySpellcheckModeParams): void {
  const {
    app,
    element,
    spellcheckMode = SpellcheckMode.Off
  } = params;
  element.setAttribute('spellcheck', String(isSpellcheckEnabledForMode(app, spellcheckMode)));
}

/**
 * Marks a value so that {@link createFragmentWithCodeBlocks} renders it as an inline code block.
 *
 * Wrap a value with this before handing it to `t()`, and the translated message comes back with the value
 * already in place, delimited:
 *
 * ```ts
 * createFragmentWithCodeBlocks(t(($) => $.obsidianDevUtils.pluginSuggestion.installed, {
 *   pluginName: asCodeBlock(pluginName)
 * }));
 * ```
 *
 * The marker travels WITH the value rather than being a positional placeholder the caller matches up
 * afterwards. That distinction is the whole point: a message naming two plugins is interpolated by name,
 * and a translation is free to put them in either order, so anything that re-associated values with
 * placeholders by position would silently swap them the moment a sentence read the other way round.
 *
 * @param value - The value to render as a code block.
 * @returns The value, delimited for {@link createFragmentWithCodeBlocks}.
 */
export function asCodeBlock(value: string): string {
  return `${CODE_BLOCK_DELIMITER}${value}${CODE_BLOCK_DELIMITER}`;
}

/**
 * Builds a {@link DocumentFragment} from an already-translated message, rendering every value that was
 * wrapped in {@link asCodeBlock} as an inline code block and the rest as plain text.
 *
 * The message stays ONE translatable unit. Splitting a sentence into a prefix and a suffix around the value
 * is the obvious alternative and it does not survive translation: a language that reorders the clause, or
 * that needs different case on the surrounding words, cannot express that through two fixed halves. Here
 * the value sits wherever the translation puts it, and only its rendering is decided.
 *
 * A message with nothing marked comes back as plain text, so this is safe to apply to any message.
 *
 * @param message - The translated message, with its code values wrapped by {@link asCodeBlock}.
 * @returns The fragment.
 */
export function createFragmentWithCodeBlocks(message: string): DocumentFragment {
  const fragment = createFragment();

  // Delimiters come in pairs, so the segments between them alternate: plain text, code value, plain text.
  let isCodeSegment = false;
  for (const segment of message.split(CODE_BLOCK_DELIMITER)) {
    if (segment !== '') {
      if (isCodeSegment) {
        appendCodeBlock(fragment, segment);
      } else {
        fragment.appendText(segment);
      }
    }

    isCodeSegment = !isCodeSegment;
  }

  return fragment;
}
