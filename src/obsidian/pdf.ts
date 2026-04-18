/**
 * @file
 *
 * Contains utility functions for printing to PDF.
 */

import { Platform } from 'obsidian';

import { ensureLoaded } from '../html-element.ts';

interface PrintToPdfOptions {
  readonly filepath: string;
  readonly includeName: boolean;
  readonly landscape: boolean;
  readonly marginsType: number;
  readonly open: boolean;
  readonly pageSize: string;
  readonly scale: number;
  readonly scaleFactor: number;
}

const ELECTRON_PRINT_TO_PDF_CHANNEL = 'print-to-pdf';

/**
 * Print the given element to a PDF file.
 *
 * Works only on desktop.
 *
 * @param el - The element to print.
 * @param options - The options to use for the print.
 */
export async function printToPdf(el: HTMLElement, options: Partial<PrintToPdfOptions>): Promise<void> {
  if (Platform.isMobile) {
    throw new Error('Printing to PDF is not supported on mobile devices.');
  }

  const printDiv = activeDocument.body.createDiv('print');
  printDiv.appendChild(el);
  await ensureLoaded(printDiv);

  const DEFAULT_SCALE_FACTOR = 100;
  const DEFAULT_OPTIONS: PrintToPdfOptions = {
    filepath: 'Untitled.pdf',
    includeName: false,
    landscape: false,
    marginsType: 0,
    open: true,
    pageSize: 'A4',
    scale: 1,
    scaleFactor: DEFAULT_SCALE_FACTOR
  };

  const fullOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    await new Promise((resolve) => {
      activeWindow.electron.ipcRenderer.once(ELECTRON_PRINT_TO_PDF_CHANNEL, resolve);
      activeWindow.electron.ipcRenderer.send(ELECTRON_PRINT_TO_PDF_CHANNEL, fullOptions);
    });
  } finally {
    printDiv.remove();
  }
}
