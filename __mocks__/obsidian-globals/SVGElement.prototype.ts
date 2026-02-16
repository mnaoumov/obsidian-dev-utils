export function setCssProps(this: SVGElement, props: Record<string, string>): void {
  const style = (this as unknown).style as CSSStyleDeclaration;
  for (const [k, v] of Object.entries(props)) {
    style.setProperty(k, v);
  }
}

export function setCssStyles(this: SVGElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign((this as unknown).style, styles);
}
