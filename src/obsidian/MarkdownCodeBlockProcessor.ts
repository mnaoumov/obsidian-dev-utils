import type { MarkdownPostProcessorContext } from "obsidian";

export function getCodeBlockArgument(ctx: MarkdownPostProcessorContext, el: HTMLElement): string | null {
  const sectionInfo = ctx.getSectionInfo(el);
  if (!sectionInfo) {
    return null;
  }
  const lines = sectionInfo.text.split("\n");
  const codeBlockHeader = lines[sectionInfo.lineStart]!;
  const match = codeBlockHeader.match(/^\`{3,}\S+\s+(.*)$/);
  if (!match) {
    return null;
  }
  return match[1]?.trim() ?? null;
}
