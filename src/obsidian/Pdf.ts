/**
 * @packageDocumentation Pdf
 * Contains utility functions for printing to PDF.
 */

import { Platform } from 'obsidian';

import { ensureLoaded } from '../HTMLElement.ts';

interface PrintToPdfOptions {
  filepath: string;
  includeName: boolean;
  landscape: boolean;
  marginsType: number;
  open: boolean;
  pageSize: string;
  scale: number;
  scaleFactor: number;
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

  const printDiv = document.body.createDiv('print');
  printDiv.appendChild(el);
  await ensureLoaded(printDiv);

  const DEFAULT_OPTIONS: PrintToPdfOptions = {
    filepath: 'Untitled.pdf',
    includeName: false,
    landscape: false,
    marginsType: 0,
    open: true,
    pageSize: 'A4',
    scale: 1,
    scaleFactor: 100
  };

  const fullOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    await new Promise((resolve) => {
      electron.ipcRenderer.once(ELECTRON_PRINT_TO_PDF_CHANNEL, resolve);
      electron.ipcRenderer.send(ELECTRON_PRINT_TO_PDF_CHANNEL, fullOptions);
    });
  } finally {
    printDiv.remove();
  }
}
