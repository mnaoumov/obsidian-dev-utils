export class App {
  fileManager = {
    renameFile(_file: TAbstractFile, _newPath: string): Promise<void> {
      return Promise.resolve();
    }
  };

  internalPlugins = {
    getEnabledPluginById(_id: string): unknown {
      return null;
    }
  };

  metadataCache = {
    fileToLinktext(file: TFile, _sourcePath: string, _omitMdExt?: boolean): string {
      return file.basename;
    },
    getCache(_path: string): unknown {
      return null;
    },
    getFirstLinkpathDest(_linkpath: string, _sourcePath: string): null | TFile {
      return null;
    }
  };

  vault = new Vault();
  workspace = {
    getLeaf(): unknown {
      return {};
    },
    getLeavesOfType(_type: string): unknown[] {
      return [];
    },
    on(_event: string, _cb: (...args: unknown[]) => void): unknown {
      return {};
    }
  };
}

export class Component {
  load(): void {}
  register(_cb: () => void): void {}
  registerEvent(_ref: unknown): void {}
  unload(): void {}
}

export class MarkdownView {
  editor = {};
  file: null | TFile = null;
  getViewType(): string {
    return 'markdown';
  }
}

export class Notice {
  constructor(_message: string, _timeout?: number) {}
}

export class Plugin {
  app: App = null as unknown as App;
  manifest = { id: '', name: '', version: '' };
  addCommand(_cmd: unknown): unknown {
    return {};
  }

  loadData(): Promise<unknown> {
    return Promise.resolve({});
  }

  register(_cb: () => void): void {}
  registerEvent(_ref: unknown): void {}
  saveData(_data: unknown): Promise<void> {
    return Promise.resolve();
  }
}

export class TAbstractFile {
  name = '';
  parent: null | TFolder = null;
  path = '';
  vault: Vault = null as unknown as Vault;
}

export class TFile extends TAbstractFile {
  basename = '';
  extension = '';
  stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot(): boolean {
    return this.path === '' || this.path === '/';
  }
}

export class ValueComponent<T> {
  inputEl: HTMLElement = null as unknown as HTMLElement;
  protected value: T = undefined as unknown as T;
  getValue(): T {
    return this.value;
  }

  setValue(value: T): this {
    this.value = value;
    return this;
  }
}

export class Vault {
  adapter = { insensitive: false };
  fileMap: Record<string, TAbstractFile> = {};

  static recurseChildren(folder: TFolder, cb: (f: TAbstractFile) => void): void {
    for (const child of folder.children) {
      cb(child);
      if (child instanceof TFolder) {
        Vault.recurseChildren(child, cb);
      }
    }
  }

  async cachedRead(_file: TFile): Promise<string> {
    return '';
  }

  async create(path: string, _content: string): Promise<TFile> {
    const f = new TFile();
    f.path = path;
    return f;
  }

  async createFolder(path: string): Promise<TFolder> {
    const f = new TFolder();
    f.path = path;
    return f;
  }

  getAbstractFileByPath(path: string): null | TAbstractFile {
    return this.fileMap[path] ?? null;
  }

  getAvailablePath(base: string, _ext: string): string {
    return base;
  }

  getMarkdownFiles(): TFile[] {
    return Object.values(this.fileMap).filter((f): f is TFile => f instanceof TFile && f.extension === 'md');
  }

  async read(_file: TFile): Promise<string> {
    return '';
  }
}

export function getFrontMatterInfo(content: string): FrontMatterInfo {
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;
  const match = fmRegex.exec(content);
  if (match) {
    const fullMatch = match[0];
    const frontmatterBody = match[1]!;
    const startDelimiterEnd = content.indexOf('\n') + 1;
    const from = startDelimiterEnd;
    const to = from + frontmatterBody.length;
    return {
      contentStart: fullMatch.length,
      exists: true,
      from,
      frontmatter: frontmatterBody,
      to
    };
  }
  return {
    contentStart: 0,
    exists: false,
    from: 0,
    frontmatter: '',
    to: 0
  };
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

export function parseLinktext(linktext: string): { path: string; subpath: string } {
  const hashIndex = linktext.indexOf('#');
  if (hashIndex === -1) {
    return { path: linktext, subpath: '' };
  }
  return { path: linktext.slice(0, hashIndex), subpath: linktext.slice(hashIndex) };
}

export function parseYaml(yaml: string): unknown {
  if (!yaml || yaml.trim() === '') {
    return null;
  }
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, colonIndex).trim();
    let value: unknown = trimmed.slice(colonIndex + 1).trim();
    if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (value === '' || value === 'null') {
      value = null;
    } else if (!isNaN(Number(value))) {
      value = Number(value);
    }
    result[key] = value;
  }
  return result;
}

export function requireApiVersion(_version: string): boolean {
  return true;
}

export function stringifyYaml(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return '';
  }
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === null || value === undefined) {
      lines.push(`${key}: `);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export const Platform = {
  isAndroidApp: false,
  isDesktop: true,
  isDesktopApp: true,
  isIosApp: false,
  isLinux: false,
  isMacOS: false,
  isMobile: false,
  isMobileApp: false,
  isPhone: false,
  isSafari: false,
  isTablet: false,
  isWin: true
};

export type CachedMetadata = Record<string, unknown>;

export type EventRef = object;

export interface FrontMatterInfo {
  contentStart: number;
  exists: boolean;
  from: number;
  frontmatter: string;
  to: number;
}

export interface ListedFiles {
  files: string[];
  folders: string[];
}

export interface Reference {
  displayText?: string;
  link: string;
  original: string;
  position: { end: { ch: number; line: number; offset: number }; start: { ch: number; line: number; offset: number } };
}
