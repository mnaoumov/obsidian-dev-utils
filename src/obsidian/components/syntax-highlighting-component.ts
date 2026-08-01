/**
 * @file
 *
 * Contains class {@link SyntaxHighlightingComponent} that registers syntax highlighting languages.
 *
 * Obsidian highlights code in two independent places, through two separate registries, and a plugin adding
 * its own language usually has to touch both:
 *
 * - **Prism** (`prism.languages[language]`) highlights code in reading view and in every `<pre><code>` the
 *   library renders — including the {@link CodeHighlighterComponent} settings field.
 * - **The CodeMirror 5 mode registry** (`window.CodeMirror.modes[language]`) highlights a fenced code block
 *   inside the editor.
 *
 * The CodeMirror 5 half looks like legacy that should be migrated to CodeMirror 6. **It is not** — verified
 * against the Obsidian 1.13.4 runtime:
 *
 * - Obsidian's own CodeMirror 6 editor language is a bridged CodeMirror 5 mode:
 *   `StreamLanguage.define(CodeMirror.getMode({}, { name: 'hypermd' }))`.
 * - Obsidian registers that `hypermd` mode through `window.CodeMirror.defineMode` with
 *   `fencedCodeBlockHighlighting: true`, and that option resolves each fence's language through the
 *   **CodeMirror 5 mode registry**.
 * - There is no public or internal CodeMirror 6 language-registration API for fences.
 *
 * So `window.CodeMirror.defineMode` is the sanctioned extension point, not legacy debt. Do not reopen this
 * as a migration.
 *
 * Teardown REMOVES the mode rather than redefining it to `null`. Plugins predating this component redefined
 * the mode to `null` on unload, because it was unclear whether CodeMirror's `getMode` needs the entry to
 * stay present. It does not — verified against a live Obsidian 1.13.4 by
 * `syntax-highlighting-component.obsidian.integration.test.ts`: after the entry is deleted, the fence
 * renders its text with no error and drops back to the exact token count it had before the language was
 * ever registered.
 */

import type {
  Grammar,
  PrismModule
} from '@obsidian-typings/obsidian-public-latest';

import { loadPrism } from '@obsidian-typings/obsidian-public-latest/implementations';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `CodeHighlighterComponent` to use it in the tsdocs.
import type { CodeHighlighterComponent } from '../setting-components/code-highlighter-component.ts';

import { throwExpression } from '../../error.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * The loaded Prism module, handed to a grammar factory.
 */
export interface SyntaxHighlightingComponentGrammarFactoryParams {
  /**
   * The loaded Prism module.
   */
  readonly prism: PrismModule;

  /**
   * Returns the grammar of an already registered Prism language, for nesting into the built grammar.
   *
   * @param language - The language to look up.
   * @returns The grammar of the language.
   * @throws An {@link Error} if the language is not registered.
   */
  requirePrismLanguage(language: string): Grammar;
}

/**
 * A grammar, the name of an already registered language to alias, or a factory that builds the grammar from
 * the loaded Prism module.
 */
export type SyntaxHighlightingComponentGrammarSource = ((params: SyntaxHighlightingComponentGrammarFactoryParams) => Grammar) | Grammar | string;

/**
 * Parameters for {@link SyntaxHighlightingComponent.registerCodeBlockLanguage}.
 */
export interface SyntaxHighlightingComponentRegisterCodeBlockLanguageParams {
  /**
   * The CodeMirror 5 mode name or MIME type the editor highlights the fence as, e.g. `text/typescript`.
   */
  readonly editorMode: string;

  /**
   * The fence language, e.g. the `foo` in a ` ```foo ` code block.
   */
  readonly language: string;

  /**
   * The grammar highlighting the fence in reading view. Omit when the fence is replaced in reading view —
   * e.g. a fence rendered as a button.
   */
  readonly prismGrammar?: SyntaxHighlightingComponentGrammarSource | undefined;
}

/**
 * Parameters for {@link SyntaxHighlightingComponent.registerPrismLanguage}.
 */
export interface SyntaxHighlightingComponentRegisterPrismLanguageParams {
  /**
   * The grammar to register.
   */
  readonly grammar: SyntaxHighlightingComponentGrammarSource;

  /**
   * The language to register the grammar as.
   */
  readonly language: string;
}

/**
 * A component that registers and unregisters syntax highlighting languages.
 *
 * @remarks
 * Every registration is undone when the component is unloaded: the previous entry is restored if the
 * language was already registered, otherwise the entry is removed.
 */
export class SyntaxHighlightingComponent extends ComponentEx {
  /**
   * Registers a fenced code block language, highlighting it in the editor and, optionally, in reading view.
   *
   * @param params - The parameters for registering the language.
   * @returns A {@link Promise} that resolves when the language is registered.
   *
   * @example
   * ```ts
   * await component.registerCodeBlockLanguage({
   *   editorMode: 'text/typescript',
   *   language: 'my-language',
   *   prismGrammar: 'typescript'
   * });
   * ```
   */
  public async registerCodeBlockLanguage(params: SyntaxHighlightingComponentRegisterCodeBlockLanguageParams): Promise<void> {
    const {
      editorMode,
      language,
      prismGrammar
    } = params;

    this.ensureLoaded();

    if (prismGrammar !== undefined) {
      await this.registerPrismLanguage({
        grammar: prismGrammar,
        language
      });
    }

    this.ensureLoaded();

    const previousModeFactory = window.CodeMirror.modes[language];
    window.CodeMirror.defineMode(language, (config) => window.CodeMirror.getMode(config, editorMode));

    this.register(() => {
      if (previousModeFactory !== undefined) {
        window.CodeMirror.modes[language] = previousModeFactory;
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- The language is only known at runtime.
      delete window.CodeMirror.modes[language];
    });
  }

  /**
   * Registers a Prism language, highlighting it everywhere Prism renders code — reading view and the
   * {@link CodeHighlighterComponent} settings field.
   *
   * @param params - The parameters for registering the language.
   * @returns A {@link Promise} that resolves when the language is registered.
   *
   * @example
   * ```ts
   * await component.registerPrismLanguage({
   *   grammar: {
   *     keyword: /\bfoo\b/
   *   },
   *   language: 'my-language'
   * });
   * ```
   */
  public async registerPrismLanguage(params: SyntaxHighlightingComponentRegisterPrismLanguageParams): Promise<void> {
    const {
      grammar,
      language
    } = params;

    this.ensureLoaded();

    const prism = await loadPrism();

    // The component might have been unloaded while Prism was loading.
    this.ensureLoaded();

    const previousGrammar = prism.languages[language];
    prism.languages[language] = this.resolveGrammar(prism, grammar);

    this.register(() => {
      if (previousGrammar !== undefined) {
        prism.languages[language] = previousGrammar;
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- The language is only known at runtime.
      delete prism.languages[language];
    });
  }

  /**
   * Returns the grammar of an already registered Prism language.
   *
   * @param prism - The loaded Prism module.
   * @param language - The language to look up.
   * @returns The grammar of the language.
   * @throws An {@link Error} if the language is not registered.
   */
  private requirePrismLanguage(prism: PrismModule, language: string): Grammar {
    return prism.languages[language] ?? throwExpression(new Error(`Prism language "${language}" is not registered.`));
  }

  /**
   * Resolves a grammar source into the grammar to register.
   *
   * @param prism - The loaded Prism module.
   * @param grammarSource - The grammar source to resolve.
   * @returns The resolved grammar.
   */
  private resolveGrammar(prism: PrismModule, grammarSource: SyntaxHighlightingComponentGrammarSource): Grammar {
    if (typeof grammarSource === 'string') {
      return this.requirePrismLanguage(prism, grammarSource);
    }

    if (typeof grammarSource === 'function') {
      return grammarSource({
        prism,
        requirePrismLanguage: (language) => this.requirePrismLanguage(prism, language)
      });
    }

    return grammarSource;
  }
}
