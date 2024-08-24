/**
 * @packageDocumentation Callout
 * This module provides utility functions for rendering callouts in Dataview.
 */


import { invokeAsyncSafely } from "../Async.ts";

import {
  getRenderedContainer,
  type DataviewInlineApi,
} from "./Dataview.ts";

import {
  resolveValue,
  type ValueProvider
} from "../ValueProvider.ts";

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
 * Returns the modifier string based on the callout mode.
 *
 * @param mode - The mode of the callout.
 * @returns The corresponding modifier string.
 */
function getModifier(mode: CalloutMode): string {
  switch (mode) {
    case CalloutMode.FoldableCollapsed:
      return "-";
    case CalloutMode.FoldableExpanded:
      return "+";
    default:
      return "";
  }
}

/**
 * Renders a callout block in Dataview.
 *
 * @param dv - The DataviewInlineApi instance.
 * @param type - The type of the callout, default is `"NOTE"`.
 * @param mode - The callout mode, default is `CalloutMode.FoldableCollapsed`.
 * @param header - The header text of the callout, default is an empty string.
 * @param contentProvider - An optional provider for the content, which can be either a string or a Node.
 * @param contentRenderer - An optional function to render the content asynchronously.
 */
export function renderCallout({
  dv,
  type = "NOTE",
  mode = CalloutMode.FoldableCollapsed,
  header = "",
  contentProvider = ""
}: {
  dv: DataviewInlineApi,
  type?: string,
  mode?: CalloutMode,
  header?: string,
  contentProvider?: ValueProvider<string | Node | void>
}): void {
  const modifier = getModifier(mode);
  const callout = dv.paragraph(`> [!${type}]${modifier} ${header}\n>\n> <div class="content"></div>`);
  const contentDiv = callout.querySelector<HTMLDivElement>(".content")!;
  dv.paragraph("Loading... ⏳", { container: contentDiv });

  const observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        invokeAsyncSafely(loadContent());
      }
    }
  });
  observer.observe(contentDiv);

  async function loadContent(): Promise<void> {
    await sleep(50);
    let content: string | Node | void;

    const paragraph = await getRenderedContainer(dv, async() => {
      content = await resolveValue(contentProvider);
    });

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
  const lines = content.split("\n");
  const prefixedLines = lines.map((line) => `> ${line}`);
  return prefixedLines.join("\n");
}
