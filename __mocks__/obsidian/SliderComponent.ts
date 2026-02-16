import { BaseComponent } from './BaseComponent.ts';

export class SliderComponent extends BaseComponent {
  public sliderEl: HTMLInputElement;

  public constructor(_containerEl: HTMLElement) {
    super();
    this.sliderEl = document.createElement('input');
    this.sliderEl.type = 'range';
  }
}
