export function parseLinktext(linktext: string): { path: string; subpath: string } {
  const hashIndex = linktext.indexOf('#');
  if (hashIndex === -1) {
    return { path: linktext, subpath: '' };
  }
  return { path: linktext.slice(0, hashIndex), subpath: linktext.slice(hashIndex) };
}
