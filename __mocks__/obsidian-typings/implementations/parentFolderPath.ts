export function parentFolderPath(path: string): string {
  const index = path.lastIndexOf('/');
  if (index === -1) {
    return '/';
  }
  return path.slice(0, index) || '/';
}
