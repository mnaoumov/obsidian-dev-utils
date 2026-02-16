import { BaseComponent } from './BaseComponent.ts';

export class ProgressBarComponent extends BaseComponent {
  public progressBar: HTMLElement;

  public constructor(_containerEl: HTMLElement) {
    super();
    this.progressBar = document.createElement('div');
  }
}
