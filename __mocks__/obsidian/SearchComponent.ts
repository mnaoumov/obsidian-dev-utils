import { BaseComponent } from './BaseComponent.ts';

export class SearchComponent extends BaseComponent {
  public inputEl: HTMLInputElement;

  public constructor(_containerEl: HTMLElement) {
    super();
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'search';
  }
}
