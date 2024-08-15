export function toPosixPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function toPosixBuffer(buffer: Buffer): Buffer {
  return Buffer.from(toPosixPath(buffer.toString()));
}
