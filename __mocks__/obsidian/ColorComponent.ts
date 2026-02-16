import { BaseComponent } from './BaseComponent.ts';

export class ColorComponent extends BaseComponent {
  public colorPickerEl: HTMLInputElement;

  public constructor(_containerEl: HTMLElement) {
    super();
    this.colorPickerEl = document.createElement('input');
    this.colorPickerEl.type = 'color';
  }
}
