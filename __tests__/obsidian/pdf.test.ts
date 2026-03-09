// @vitest-environment jsdom

import { Platform } from 'obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

vi.mock('../../src/html-element.ts', () => ({
  ensureLoaded: vi.fn(async () => Promise.resolve())
}));

interface MockIpcRenderer {
  once: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

let mockIpcRenderer: MockIpcRenderer;

const HEAVY_IMPORT_TIMEOUT = 30_000;

describe('printToPdf', { timeout: HEAVY_IMPORT_TIMEOUT }, () => {
  let printDiv: HTMLDivElement;

  beforeEach(() => {
    printDiv = document.createElement('div');
    printDiv.remove = vi.fn() as () => void;
    document.body.createDiv = vi.fn((): HTMLDivElement => {
      document.body.appendChild(printDiv);
      return printDiv;
    });

    mockIpcRenderer = {
      once: vi.fn(),
      send: vi.fn()
    };
    vi.stubGlobal('electron', { ipcRenderer: mockIpcRenderer });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should throw on mobile devices', async () => {
    const originalIsMobile = Platform.isMobile;
    try {
      Platform.isMobile = true;
      const { printToPdf } = await import('../../src/obsidian/pdf.ts');
      const el = document.createElement('div');
      await expect(printToPdf(el, {})).rejects.toThrow('Printing to PDF is not supported on mobile devices.');
    } finally {
      // eslint-disable-next-line require-atomic-updates -- Restoring a mock property in a finally block is intentional.
      Platform.isMobile = originalIsMobile;
    }
  });

  it('should create a print div and append the element', async () => {
    // Resolve the ipcRenderer.once callback immediately
    mockIpcRenderer.once.mockImplementation((_channel: string, resolve: () => void): void => {
      resolve();
    });

    const { printToPdf } = await import('../../src/obsidian/pdf.ts');
    const el = document.createElement('span');

    await printToPdf(el, {});

    expect(document.body.createDiv).toHaveBeenCalledWith('print');
    expect(printDiv.contains(el)).toBe(true);
  });

  it('should call ensureLoaded on the print div', async () => {
    mockIpcRenderer.once.mockImplementation((_channel: string, resolve: () => void): void => {
      resolve();
    });

    const { ensureLoaded } = await import('../../src/html-element.ts');
    const { printToPdf } = await import('../../src/obsidian/pdf.ts');
    const el = document.createElement('div');

    await printToPdf(el, {});

    expect(ensureLoaded).toHaveBeenCalledWith(printDiv);
  });

  it('should send default options merged with provided options', async () => {
    mockIpcRenderer.once.mockImplementation((_channel: string, resolve: () => void): void => {
      resolve();
    });

    const { printToPdf } = await import('../../src/obsidian/pdf.ts');
    const el = document.createElement('div');

    await printToPdf(el, { filepath: 'test.pdf', landscape: true });

    const DEFAULT_SCALE_FACTOR = 100;
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('print-to-pdf', {
      filepath: 'test.pdf',
      includeName: false,
      landscape: true,
      marginsType: 0,
      open: true,
      pageSize: 'A4',
      scale: 1,
      scaleFactor: DEFAULT_SCALE_FACTOR
    });
  });

  it('should use default options when none are provided', async () => {
    mockIpcRenderer.once.mockImplementation((_channel: string, resolve: () => void): void => {
      resolve();
    });

    const { printToPdf } = await import('../../src/obsidian/pdf.ts');
    const el = document.createElement('div');

    await printToPdf(el, {});

    const DEFAULT_SCALE_FACTOR = 100;
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('print-to-pdf', {
      filepath: 'Untitled.pdf',
      includeName: false,
      landscape: false,
      marginsType: 0,
      open: true,
      pageSize: 'A4',
      scale: 1,
      scaleFactor: DEFAULT_SCALE_FACTOR
    });
  });

  it('should register once listener on the print-to-pdf channel', async () => {
    mockIpcRenderer.once.mockImplementation((_channel: string, resolve: () => void): void => {
      resolve();
    });

    const { printToPdf } = await import('../../src/obsidian/pdf.ts');
    const el = document.createElement('div');

    await printToPdf(el, {});

    expect(mockIpcRenderer.once).toHaveBeenCalledWith('print-to-pdf', expect.any(Function));
  });

  it('should remove the print div after successful print', async () => {
    mockIpcRenderer.once.mockImplementation((_channel: string, resolve: () => void): void => {
      resolve();
    });

    const { printToPdf } = await import('../../src/obsidian/pdf.ts');
    const el = document.createElement('div');

    await printToPdf(el, {});

    expect(vi.mocked(printDiv.remove)).toHaveBeenCalled();
  });

  it('should remove the print div even when ipcRenderer rejects', async () => {
    mockIpcRenderer.once.mockImplementation((): void => {
      // Do not call resolve - the promise will be rejected by send throwing
    });
    mockIpcRenderer.send.mockImplementation((): void => {
      throw new Error('IPC error');
    });

    const { printToPdf } = await import('../../src/obsidian/pdf.ts');
    const el = document.createElement('div');

    await expect(printToPdf(el, {})).rejects.toThrow('IPC error');

    expect(vi.mocked(printDiv.remove)).toHaveBeenCalled();
  });
});
