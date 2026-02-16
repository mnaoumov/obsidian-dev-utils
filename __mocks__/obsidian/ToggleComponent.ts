import { BaseComponent } from './BaseComponent.ts';

export class ToggleComponent extends BaseComponent {
  public toggleEl: HTMLElement;

  public constructor(_containerEl: HTMLElement) {
    super();
    this.toggleEl = document.createElement('div');
  }
}
