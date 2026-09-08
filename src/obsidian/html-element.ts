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
