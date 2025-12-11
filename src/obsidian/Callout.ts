/**
 * @packageDocumentation
 *
 * This module provides utility functions for rendering callouts in Dataview.
 */

import type { MaybeReturn } from '../Type.ts';
import type { ValueProvider } from '../ValueProvider.ts';
import type { DataviewInlineApi } from './Dataview.ts';
import type { AddToQueueOptions } from './Queue.ts';

import { throwExpression } from '../Error.ts';
import { normalizeOptionalProperties } from '../ObjectUtils.ts';
import { resolveValue } from '../ValueProvider.ts';
import { getRenderedContainer } from './Dataview.ts';
import { t } from './i18n/i18n.ts';
import { addToQueue } from './Queue.ts';

/**
 * Enum representing the mode of a callout.
 */
export enum CalloutMode {
  /** Default mode, with no special behavior. */
  Default,

  /** Foldable mode with the callout collapsed. */
  FoldableCollapsed,

  /** Foldable mode with the callout expanded. */
  FoldableExpanded
}

/**
 * Options for {@link renderCallout}.
 */
export interface RenderCalloutOptions {
  /**
   * An abort signal.
   */
  abortSignal?: AbortSignal;

  /**
   * An optional provider for the content, which can be either a string or a Node.
   */
  contentProvider?: ValueProvider<MaybeReturn<Node | string>>;

  /**
   * A {@link DataviewInlineApi} instance.
   */
  dv: DataviewInlineApi;

  /**
   * A header text of the callout, default is an empty string.
   */
  header?: string;

  /**
   * A callout mode, default is `CalloutMode.FoldableCollapsed`.
   */
  mode?: CalloutMode;

  /**
   * A type of the callout, default is `"NOTE"`.
   */
  type?: string;
}

/**
 * Renders a callout block in Dataview.
 *
 * @param options - The options for rendering the callout.
 */
export function renderCallout(options: RenderCalloutOptions): void {
  const {
    contentProvider = '',
    dv,
    header = '',
    mode = CalloutMode.FoldableCollapsed,
    type = 'NOTE'
  } = options;
  const modifier = getModifier(mode);
  const callout = dv.paragraph(`> [!${type}]${modifier} ${header}\n>\n> <div class="content"></div>`);
  const contentDiv = callout.querySelector<HTMLDivElement>('.content') ?? throwExpression(new Error('Content div not found'));
  dv.paragraph('Loading... ⏳', { container: contentDiv });

  const observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        addToQueue(normalizeOptionalProperties<AddToQueueOptions>({
          abortSignal: options.abortSignal,
          app: dv.app,
          operationFn: loadContent,
          operationName: t(($) => $.obsidianDevUtils.callout.loadContent)
        }));
      }
    }
  });
  observer.observe(contentDiv);

  async function loadContent(abortSignal: AbortSignal): Promise<void> {
    abortSignal.throwIfAborted();
    let content: MaybeReturn<Node | string | undefined>;

    const paragraph = await getRenderedContainer(dv, async () => {
      content = await resolveValue(contentProvider, abortSignal);
      abortSignal.throwIfAborted();
    });
    abortSignal.throwIfAborted();

    content ??= paragraph;

    contentDiv.empty();
    dv.paragraph(content, { container: contentDiv });
  }
}

/**
 * Wraps the provided content in blockquote syntax for a callout.
 *
 * @param content - The content to wrap.
 * @returns The content wrapped in blockquote syntax.
 */
export function wrapForCallout(content: string): string {
  const lines = content.split('\n');
  const prefixedLines = lines.map((line) => `> ${line}`);
  return prefixedLines.join('\n');
}

/**
 * Returns the modifier string based on the callout mode.
 *
 * @param mode - The mode of the callout.
 * @returns The corresponding modifier string.
 */
function getModifier(mode: CalloutMode): string {
  switch (mode) {
    case CalloutMode.FoldableCollapsed:
      return '-';
    case CalloutMode.FoldableExpanded:
      return '+';
    default:
      return '';
  }
}
