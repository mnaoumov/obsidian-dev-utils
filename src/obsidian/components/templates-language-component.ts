/**
 * @file
 *
 * Contains class {@link TemplatesLanguageComponent} that registers a Prism language highlighting
 * `{{token}}` / `{{token:format}}` placeholders.
 *
 * **The language is Obsidian core's own, not a fleet invention.** `{{token:format}}` is the syntax core's
 * **Templates** plugin defines, verified in the shipped app rather than recalled — `obsidian.asar/i18n.js`,
 * the `templates:` block:
 *
 * ```text
 * optionTemplateDateFormatDescription:  '{{date}} in the template file will be replaced with this value.'
 * optionTemplateDateFormatDescription2: 'You can also use {{date:YYYY-MM-DD}} to override the format once.'
 * optionTemplateTimeFormatDescription:  '{{time}} in the template file will be replaced with this value.'
 * optionTemplateTimeFormatDescription2: 'You can also use {{time:HH:mm}} to override the format once.'
 * ```
 *
 * That matters for anyone tempted to change the delimiters: they are not ours to change. A plugin extends
 * core's language with its own token vocabulary, it does not define a competing one.
 *
 * **Beware the near-miss on that evidence.** A grep for `{{...}}` across the app bundle returns many hits
 * that prove nothing, because Obsidian's UI strings are i18next and `{{...}}` is i18next's own interpolation
 * syntax. The load-bearing hit is the `templates:` block quoted above — the core plugin's user-facing
 * settings description. Read that block; do not count braces.
 *
 * What a consumer varies is only its **vocabulary**, which is why this component is parameterized rather
 * than fixed: the language id it registers under, the characters a token name may contain, the shape of the
 * format half, and any extra top-level tokens its own template dialect needs.
 */

import type {
  Grammar,
  PrismTokenObject
} from '@obsidian-typings/obsidian-public-latest';

import type { SyntaxHighlightingComponentGrammarFactoryParams } from './syntax-highlighting-component.ts';

import { SyntaxHighlightingComponent } from './syntax-highlighting-component.ts';

/**
 * Parameters for the {@link TemplatesLanguageComponent} constructor.
 */
export interface TemplatesLanguageComponentConstructorParams {
  /**
   * Extra top-level entries merged into the built grammar, for a dialect whose templates carry syntax
   * beyond the placeholders themselves — a path separator, say. Omit when there is none.
   */
  readonly extraGrammar?: Grammar | undefined;

  /**
   * The format half of a `{{token:format}}` placeholder.
   *
   * Defaults to a scalar word, which is core's own shape.
   */
  readonly formatSource?: TemplatesLanguageComponentFormatSource | undefined;

  /**
   * The language to register the grammar as, e.g. `my-plugin-template`.
   */
  readonly language: string;

  /**
   * The characters a token name may contain, anchored at the start of the placeholder body.
   *
   * Defaults to word characters. A dialect whose token names carry more — a comma-separated argument list,
   * say — widens it here.
   */
  readonly tokenPattern?: RegExp | undefined;
}

/**
 * The format half of a `{{token:format}}` placeholder.
 *
 * - A {@link RegExp} describes a **scalar** format — core's own shape, e.g. the `YYYY-MM-DD` of
 *   `{{date:YYYY-MM-DD}}` — and is wrapped into a `string`-aliased token.
 * - A {@link PrismTokenObject} describes a **structured** format, used verbatim, so a dialect whose format
 *   half is an object rather than a word can supply its own `inside` grammar and extent `pattern`.
 * - A **factory** is the structured form for a dialect that must nest an already registered Prism language
 *   into that `inside` — it receives the loaded Prism module, so the consumer never calls `loadPrism`.
 */
export type TemplatesLanguageComponentFormatSource =
  | ((params: SyntaxHighlightingComponentGrammarFactoryParams) => PrismTokenObject)
  | PrismTokenObject
  | RegExp;

/**
 * Parameters for {@link TemplatesLanguageComponent.buildPlaceholderToken}.
 */
interface TemplatesLanguageComponentBuildPlaceholderTokenParams {
  /**
   * The Prism token describing the format half, or `null` for a placeholder that carries none.
   */
  readonly formatToken: null | PrismTokenObject;

  /**
   * The extent of the whole placeholder.
   */
  readonly pattern: RegExp;
}

/**
 * The scalar format half, matching core's own `{{date:YYYY-MM-DD}}` shape.
 */
const DEFAULT_FORMAT_PATTERN = /[a-zA-Z0-9_-]+/;

/**
 * The characters a token name may contain, anchored at the start of the placeholder body.
 */
const DEFAULT_TOKEN_PATTERN = /^[a-zA-Z0-9_]+/;

/**
 * The `:` separating a token from its format.
 */
const FORMAT_DELIMITER_PATTERN = /:/;

/**
 * A whole placeholder, lazily matched so adjacent placeholders do not merge into one.
 */
const PLACEHOLDER_PATTERN = /\{\{.+?\}\}/;

/**
 * The opening `{{`.
 */
const PREFIX_PATTERN = /\{\{/;

/**
 * The closing `}}`.
 */
const SUFFIX_PATTERN = /\}\}/;

/**
 * Registers a Prism language highlighting the `{{token}}` / `{{token:format}}` placeholders of a plugin's
 * tokenized-string templates.
 *
 * @remarks
 * The language is not a code fence — it is rendered by the `CodeHighlighterComponent` fields of a settings
 * tab, so only the Prism half of {@link SyntaxHighlightingComponent} is used. Registration is undone when
 * the component unloads, as it is for every registration that base makes.
 *
 * @example
 * ```ts
 * this.addChild(new TemplatesLanguageComponent({ language: 'my-plugin-template' }));
 * ```
 */
export class TemplatesLanguageComponent extends SyntaxHighlightingComponent {
  private readonly extraGrammar: Grammar | undefined;
  private readonly formatSource: TemplatesLanguageComponentFormatSource;
  private readonly language: string;
  private readonly tokenPattern: RegExp;

  /**
   * Creates a new instance of the {@link TemplatesLanguageComponent} class.
   *
   * @param params - The parameters for the component.
   */
  public constructor(params: TemplatesLanguageComponentConstructorParams) {
    super();
    this.extraGrammar = params.extraGrammar;
    this.formatSource = params.formatSource ?? DEFAULT_FORMAT_PATTERN;
    this.language = params.language;
    this.tokenPattern = params.tokenPattern ?? DEFAULT_TOKEN_PATTERN;
  }

  /**
   * Registers the language.
   *
   * @returns A {@link Promise} that resolves when the language is registered.
   */
  public override async onloadAsync(): Promise<void> {
    await this.registerPrismLanguage({
      // The factory form is used unconditionally.
      // The base resolves either form, so branching on whether this consumer needs Prism would buy nothing.
      grammar: (factoryParams) => this.buildGrammar(factoryParams),
      language: this.language
    });
  }

  /**
   * Builds the grammar this component registers.
   *
   * @param factoryParams - The Prism module and language lookup handed to a grammar factory.
   * @returns The grammar.
   */
  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- This implements the exported grammar-factory signature of the base class, so it takes that seam's own parameter type rather than one named after this method.
  private buildGrammar(factoryParams: SyntaxHighlightingComponentGrammarFactoryParams): Grammar {
    const formatToken = this.resolveFormatToken(factoryParams);

    // A scalar format half fits inside ONE lazily-matched placeholder token.
    // That is the shape core's own `{{date:YYYY-MM-DD}}` has.
    // It is also the shape every consumer had before this component existed, so emitting exactly it leaves them unchanged.
    //
    // A structured format half does not fit that shape, since its extent is described by its own pattern.
    // The with-format case therefore needs a pattern built from that extent.
    // The without-format case needs one that stops before the delimiter, so the two cannot claim the same text.
    const grammar: Grammar = this.formatSource instanceof RegExp
      ? {
        expression: this.buildPlaceholderToken({
          formatToken,
          pattern: PLACEHOLDER_PATTERN
        })
      }
      : {
        expression: this.buildPlaceholderToken({
          formatToken: null,
          pattern: buildPattern([this.tokenPattern])
        }),
        expressionWithFormat: this.buildPlaceholderToken({
          formatToken,
          pattern: buildPattern([this.tokenPattern, FORMAT_DELIMITER_PATTERN, formatToken.pattern])
        })
      };

    // Merged rather than spread, because spreading a `Grammar` widens every optional member of
    // `GrammarRest` to admit `undefined`, which `exactOptionalPropertyTypes` then refuses.
    if (this.extraGrammar !== undefined) {
      Object.assign(grammar, this.extraGrammar);
    }

    return grammar;
  }

  /**
   * Builds the token describing a whole placeholder.
   *
   * @param params - The resolved format token and the placeholder's extent pattern.
   * @returns The placeholder token.
   */
  private buildPlaceholderToken(params: TemplatesLanguageComponentBuildPlaceholderTokenParams): PrismTokenObject {
    const prefixToken = {
      alias: 'regex',
      pattern: PREFIX_PATTERN
    };
    const tokenToken = {
      alias: 'number',
      pattern: this.tokenPattern
    };
    const suffixToken = {
      alias: 'regex',
      pattern: SUFFIX_PATTERN
    };

    if (params.formatToken === null) {
      return {
        greedy: true,
        inside: {
          /* eslint-disable perfectionist/sort-objects -- Prism matches the entries in order, so the order is behavior. */
          prefix: prefixToken,
          token: tokenToken,
          suffix: suffixToken
          /* eslint-enable perfectionist/sort-objects -- Prism matches the entries in order, so the order is behavior. */
        },
        pattern: params.pattern
      };
    }

    return {
      greedy: true,
      inside: {
        /* eslint-disable perfectionist/sort-objects -- Prism matches the entries in order, so the order is behavior. */
        prefix: prefixToken,
        token: tokenToken,
        formatDelimiter: {
          alias: 'regex',
          pattern: FORMAT_DELIMITER_PATTERN
        },
        format: params.formatToken,
        suffix: suffixToken
        /* eslint-enable perfectionist/sort-objects -- Prism matches the entries in order, so the order is behavior. */
      },
      pattern: params.pattern
    };
  }

  /**
   * Resolves the configured format source into the Prism token describing the format half.
   *
   * @param factoryParams - The Prism module and language lookup handed to a grammar factory.
   * @returns The format token.
   */
  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- Forwards the base class's exported grammar-factory parameter type to a caller-supplied factory, so it cannot take a type named after this method.
  private resolveFormatToken(factoryParams: SyntaxHighlightingComponentGrammarFactoryParams): PrismTokenObject {
    if (this.formatSource instanceof RegExp) {
      return {
        alias: 'string',
        pattern: this.formatSource
      };
    }

    if (typeof this.formatSource === 'function') {
      return this.formatSource(factoryParams);
    }

    return this.formatSource;
  }
}

/**
 * Builds a placeholder extent pattern from the parts that sit between the delimiters.
 *
 * A part anchored with a leading `^` — as a pattern meant for a nested `inside` entry is — is spliced in
 * without that anchor, since it lands in the middle of the built pattern rather than at its start.
 *
 * @param parts - The patterns between the opening `{{` and the closing `}}`.
 * @returns The pattern.
 */
function buildPattern(parts: readonly RegExp[]): RegExp {
  const body = parts.map((part) => part.source.startsWith('^') ? part.source.slice(1) : part.source).join('');
  return new RegExp(`${PREFIX_PATTERN.source}${body}${SUFFIX_PATTERN.source}`);
}
