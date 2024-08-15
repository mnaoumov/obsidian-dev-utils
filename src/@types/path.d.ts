declare module "path2" {
  export const posix: {
    basename(this: void, path: string, ext?: string): string;
    dirname(this: void, path: string): string;
    extname(this: void, path: string): string;
    join(this: void, ...paths: string[]): string;
    relative(this: void, from: string, to: string): string;
    resolve(this: void, ...paths: string[]): string;
  };
}
