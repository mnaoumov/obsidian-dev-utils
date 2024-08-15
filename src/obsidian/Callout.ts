import { invokeAsyncSafely } from "../Async.ts";

import {
  getRenderedContainer,
  type DataviewInlineApi,
} from "./Dataview.ts";

import type { MaybePromise } from "../Async.ts";
import {
  resolveValue,
  type ValueProvider
} from "../ValueProvider.ts";

export enum CalloutMode {
  Default,
  FoldableCollapsed,
  FoldableExpanded
}

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

export function renderCallout({
  dv,
  type = "NOTE",
  mode = CalloutMode.FoldableCollapsed,
  header = "",
  contentProvider = "",
  contentRenderer
}: {
  dv: DataviewInlineApi,
  type?: string,
  mode?: CalloutMode,
  header?: string,
  contentProvider?: ValueProvider<string | Node>
  contentRenderer?: () => MaybePromise<void>
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
    let content;

    if (contentRenderer) {
      content = await getRenderedContainer(dv, contentRenderer);
    } else {
      content = await resolveValue(contentProvider) || "(no data)";
    }

    contentDiv.empty();
    dv.paragraph(content, { container: contentDiv });
  }
}

export function wrapForCallout(content: string): string {
  const lines = content.split("\n");
  const prefixedLines = lines.map(line => `> ${line}`);
  return prefixedLines.join("\n");
}
