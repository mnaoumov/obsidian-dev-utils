export class TAbstractFile {
  path = '';
  name = '';
  parent: TFolder | null = null;
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

export class Vault {
  fileMap: Record<string, TAbstractFile> = {};
  adapter = { insensitive: false };

  static recurseChildren(folder: TFolder, cb: (f: TAbstractFile) => void): void {
    for (const child of folder.children) {
      cb(child);
      if (child instanceof TFolder) {
        Vault.recurseChildren(child, cb);
      }
    }
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this.fileMap[path] ?? null;
  }

  async cachedRead(_file: TFile): Promise<string> {
    return '';
  }

  async read(_file: TFile): Promise<string> {
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

  getAvailablePath(base: string, _ext: string): string {
    return base;
  }

  getMarkdownFiles(): TFile[] {
    return Object.values(this.fileMap).filter((f): f is TFile => f instanceof TFile && f.extension === 'md');
  }
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

export function requireApiVersion(_version: string): boolean {
  return true;
}

export class Plugin {
  app: App = null as unknown as App;
  manifest = { id: '', name: '', version: '' };
  register(_cb: () => void): void {/* stub */}
  registerEvent(_ref: unknown): void {/* stub */}
  addCommand(_cmd: unknown): unknown {
    return {};
  }
  loadData(): Promise<unknown> {
    return Promise.resolve({});
  }
  saveData(_data: unknown): Promise<void> {
    return Promise.resolve();
  }
}

export class Component {
  register(_cb: () => void): void {/* stub */}
  registerEvent(_ref: unknown): void {/* stub */}
  load(): void {/* stub */}
  unload(): void {/* stub */}
}

export class Notice {
  constructor(_message: string, _timeout?: number) {/* stub */}
}

export class MarkdownView {
  file: TFile | null = null;
  editor = {};
  getViewType(): string {
    return 'markdown';
  }
}

export class App {
  vault = new Vault();
  metadataCache = {
    getFirstLinkpathDest(_linkpath: string, _sourcePath: string): TFile | null {
      return null;
    },
    fileToLinktext(file: TFile, _sourcePath: string, _omitMdExt?: boolean): string {
      return file.basename;
    },
    getCache(_path: string): unknown {
      return null;
    }
  };
  workspace = {
    getLeavesOfType(_type: string): unknown[] {
      return [];
    },
    on(_event: string, _cb: (...args: unknown[]) => void): unknown {
      return {};
    },
    getLeaf(): unknown {
      return {};
    }
  };
  internalPlugins = {
    getEnabledPluginById(_id: string): unknown {
      return null;
    }
  };
  fileManager = {
    renameFile(_file: TAbstractFile, _newPath: string): Promise<void> {
      return Promise.resolve();
    }
  };
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

export const Platform = {
  isDesktop: true,
  isMobile: false,
  isDesktopApp: true,
  isMobileApp: false,
  isIosApp: false,
  isAndroidApp: false,
  isPhone: false,
  isTablet: false,
  isMacOS: false,
  isWin: true,
  isLinux: false,
  isSafari: false
};

export interface FrontMatterInfo {
  exists: boolean;
  frontmatter: string;
  from: number;
  to: number;
  contentStart: number;
}

export function getFrontMatterInfo(content: string): FrontMatterInfo {
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;
  const match = fmRegex.exec(content);
  if (match) {
    const fullMatch = match[0]!;
    const frontmatterBody = match[1]!;
    const startDelimiterEnd = content.indexOf('\n') + 1;
    const from = startDelimiterEnd;
    const to = from + frontmatterBody.length;
    return {
      exists: true,
      frontmatter: frontmatterBody,
      from,
      to,
      contentStart: fullMatch.length
    };
  }
  return {
    exists: false,
    frontmatter: '',
    from: 0,
    to: 0,
    contentStart: 0
  };
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
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (value === '' || value === 'null') value = null;
    else if (!isNaN(Number(value))) value = Number(value);
    result[key] = value;
  }
  return result;
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
  return lines.join('\n') + '\n';
}

export type EventRef = object;
export type CachedMetadata = Record<string, unknown>;
export type Reference = {
  link: string;
  original: string;
  displayText?: string;
  position: { start: { line: number; ch: number; offset: number }; end: { line: number; ch: number; offset: number } };
};
export type ListedFiles = { files: string[]; folders: string[] };
