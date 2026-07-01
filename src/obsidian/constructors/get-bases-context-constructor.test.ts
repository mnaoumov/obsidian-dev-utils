import type {
  App,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { trashSafe } from 'obsidian-dev-utils/obsidian/vault';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { getBasesContextConstructor } from './get-bases-context-constructor.ts';

vi.mock('obsidian-dev-utils/obsidian/vault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian-dev-utils/obsidian/vault')>();
  return {
    ...actual,
    trashSafe: vi.fn().mockResolvedValue(undefined)
  };
});

interface CreateAppResult {
  readonly app: App;
  readonly createNewBasesFile: ReturnType<typeof vi.fn>;
  readonly disable: ReturnType<typeof vi.fn>;
  readonly enable: ReturnType<typeof vi.fn>;
  readonly getLeaf: ReturnType<typeof vi.fn>;
}

interface CreateBasesLeafResult {
  readonly leaf: WorkspaceLeaf;
  readonly mock: MockLeaf;
}

interface MockAppOptions {
  readonly baseFiles?: TFile[];
  readonly createdBaseFile?: TFile;
  readonly isBasesEnabledInitially?: boolean;
  readonly openBasesLeaf?: WorkspaceLeaf;
  readonly openedLeaf?: WorkspaceLeaf;
}

interface MockLeaf {
  readonly detach: ReturnType<typeof vi.fn>;
  readonly openFile: ReturnType<typeof vi.fn>;
  readonly view: MockLeafView;
}

interface MockLeafController {
  readonly ctx: unknown;
}

interface MockLeafView {
  readonly controller: MockLeafController;
}

class FakeBasesContext {
  public readonly isFakeBasesContext = true;
}

function createApp(options: MockAppOptions): CreateAppResult {
  let isBasesEnabled = options.isBasesEnabledInitially ?? true;
  const createNewBasesFile = vi.fn().mockResolvedValue(options.createdBaseFile);
  const basesPluginInstance = { createNewBasesFile };
  const enable = vi.fn().mockImplementation(() => {
    isBasesEnabled = true;
    return noopAsync();
  });
  const disable = vi.fn().mockImplementation(() => {
    isBasesEnabled = false;
  });
  const basesInternalPlugin = {
    disable,
    enable,
    enabled: isBasesEnabled,
    instance: basesPluginInstance
  };
  const getLeaf = vi.fn().mockReturnValue(options.openedLeaf);

  const app = castTo<App>({
    internalPlugins: {
      getEnabledPluginById: vi.fn().mockImplementation(() => (isBasesEnabled ? basesPluginInstance : null)),
      getPluginById: vi.fn().mockReturnValue(basesInternalPlugin)
    },
    vault: {
      getFiles: vi.fn().mockReturnValue(options.baseFiles ?? [])
    },
    workspace: {
      getLeaf,
      getLeavesOfType: vi.fn().mockReturnValue(options.openBasesLeaf ? [options.openBasesLeaf] : [])
    }
  });

  return {
    app,
    createNewBasesFile,
    disable,
    enable,
    getLeaf
  };
}

function createBasesLeaf(ctx: unknown): CreateBasesLeafResult {
  const mock: MockLeaf = {
    detach: vi.fn(),
    openFile: vi.fn().mockResolvedValue(undefined),
    view: { controller: { ctx } }
  };
  return {
    leaf: castTo<WorkspaceLeaf>({
      ...mock,
      loadIfDeferred: vi.fn().mockResolvedValue(undefined)
    }),
    mock
  };
}

function makeFile(path: string, extension: string): TFile {
  return castTo<TFile>({ extension, path });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('getBasesContextConstructor', () => {
  it('should reuse an already-open bases view without enabling the plugin or opening files', async () => {
    const { leaf } = createBasesLeaf(new FakeBasesContext());
    const { app, disable, enable, getLeaf } = createApp({ openBasesLeaf: leaf });

    const ctor = await getBasesContextConstructor(app);

    expect(ctor).toBe(FakeBasesContext);
    expect(enable).not.toHaveBeenCalled();
    expect(disable).not.toHaveBeenCalled();
    expect(getLeaf).not.toHaveBeenCalled();
  });

  it('should open an existing base file when no bases view is open, then detach without deleting it', async () => {
    const baseFile = makeFile('existing.base', 'base');
    const { leaf, mock } = createBasesLeaf(new FakeBasesContext());
    const { app } = createApp({ baseFiles: [baseFile], openedLeaf: leaf });

    const ctor = await getBasesContextConstructor(app);

    expect(ctor).toBe(FakeBasesContext);
    expect(mock.openFile).toHaveBeenCalledWith(baseFile);
    expect(mock.detach).toHaveBeenCalled();
    expect(vi.mocked(trashSafe)).not.toHaveBeenCalled();
  });

  it('should create and trash a temporary base file when no bases view or base file exists', async () => {
    const tempFile = makeFile('Untitled.base', 'base');
    const { leaf, mock } = createBasesLeaf(new FakeBasesContext());
    const { app, createNewBasesFile } = createApp({
      baseFiles: [makeFile('note.md', 'md')],
      createdBaseFile: tempFile,
      openedLeaf: leaf
    });

    const ctor = await getBasesContextConstructor(app);

    expect(ctor).toBe(FakeBasesContext);
    expect(createNewBasesFile).toHaveBeenCalled();
    expect(mock.openFile).toHaveBeenCalledWith(tempFile);
    expect(mock.detach).toHaveBeenCalled();
    expect(vi.mocked(trashSafe)).toHaveBeenCalledWith(app, tempFile);
  });

  it('should temporarily enable Bases when disabled and restore it afterwards', async () => {
    const { leaf } = createBasesLeaf(new FakeBasesContext());
    const { app, disable, enable } = createApp({
      isBasesEnabledInitially: false,
      openBasesLeaf: leaf
    });

    const ctor = await getBasesContextConstructor(app);

    expect(ctor).toBe(FakeBasesContext);
    expect(enable).toHaveBeenCalled();
    expect(disable).toHaveBeenCalled();
  });
});
