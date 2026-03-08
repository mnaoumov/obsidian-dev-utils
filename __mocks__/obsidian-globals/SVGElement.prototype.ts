export function setCssProps(this: SVGElement, props: Record<string, string>): void {
  const style = this.style;
  for (const [k, v] of Object.entries(props)) {
    style.setProperty(k, v);
  }
}

export function setCssStyles(this: SVGElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(this.style, styles);
}
