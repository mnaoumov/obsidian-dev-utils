export function appendCodeBlock(fragment: DocumentFragment, code: string): void {
  fragment.appendChild(createSpan({ cls: "markdown-rendered code" }, (span) => {
    span.style.fontWeight = "bold";
    span.appendChild(createEl("code", { text: code }));
  }));
}
