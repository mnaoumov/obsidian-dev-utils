import type { InternalPlugins } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  TAbstractFile
} from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../function.ts';
import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import { revealInFileExplorer } from './file-explorer.ts';

interface FileExplorerStub {
  readonly revealInFolder: (abstractFile: TAbstractFile) => unknown;
}

const mocks = vi.hoisted(() => {
  const events: string[] = [];
  return {
    events,
    requestAnimationFrameAsync: vi.fn(async (): Promise<void> => {
      events.push('frame');
      // eslint-disable-next-line obsidian-dev-utils/prefer-noop-async -- Cannot use noopAsync() in vi.hoisted() since imports are not yet available.
      await Promise.resolve();
    })
  };
});

vi.mock('../async.ts', () => ({
  requestAnimationFrameAsync: mocks.requestAnimationFrameAsync
}));

function createApp(fileExplorer: FileExplorerStub | null): App {
  return strictProxy<App>({
    internalPlugins: {
      getEnabledPluginById: castTo<InternalPlugins['getEnabledPluginById']>((id: string): unknown => {
        expect(id).toBe('file-explorer');
        return fileExplorer;
      })
    }
  });
}

describe('revealInFileExplorer', () => {
  const abstractFile = strictProxy<TAbstractFile>({});
  const { events } = mocks;

  beforeEach(() => {
    events.length = 0;
    mocks.requestAnimationFrameAsync.mockClear();
  });

  it('should resolve at once, waiting no frame, when the file explorer is disabled', async () => {
    await revealInFileExplorer({ abstractFile, app: createApp(null) });
    expect(mocks.requestAnimationFrameAsync).not.toHaveBeenCalled();
  });

  it('should await the runtime promise of revealInFolder, then outlast the explorer\'s trailing frames', async () => {
    const revealInFolder = vi.fn(async (file: TAbstractFile): Promise<void> => {
      expect(file).toBe(abstractFile);
      events.push('reveal started');
      await noopAsync();
      events.push('reveal settled');
    });

    await revealInFileExplorer({ abstractFile, app: createApp({ revealInFolder }) });
    events.push('resolved');

    expect(revealInFolder).toHaveBeenCalledOnce();
    expect(events).toStrictEqual(['reveal started', 'reveal settled', 'frame', 'frame', 'resolved']);
  });

  it('should still wait the frames when revealInFolder returns nothing', async () => {
    const revealInFolder = vi.fn((): void => {
      events.push('reveal');
    });

    await revealInFileExplorer({ abstractFile, app: createApp({ revealInFolder }) });

    expect(events).toStrictEqual(['reveal', 'frame', 'frame']);
  });
});
