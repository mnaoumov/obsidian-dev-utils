import { TFile } from '../../obsidian/TFile.ts';

export function createTFileInstance(_vault: unknown, path: string): TFile {
  const file = new TFile();
  file.path = path;
  const parts = path.split('/');
  file.name = parts[parts.length - 1] ?? '';
  const dotIndex = file.name.lastIndexOf('.');
  file.extension = dotIndex >= 0 ? file.name.slice(dotIndex + 1) : '';
  file.basename = dotIndex >= 0 ? file.name.slice(0, dotIndex) : file.name;
  return file;
}
