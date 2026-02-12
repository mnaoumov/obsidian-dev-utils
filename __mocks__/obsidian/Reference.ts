export interface Reference {
  displayText?: string;
  link: string;
  original: string;
  position: { end: { ch: number; line: number; offset: number }; start: { ch: number; line: number; offset: number } };
}
