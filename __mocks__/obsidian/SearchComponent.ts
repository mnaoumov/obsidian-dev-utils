import { noop } from '../../src/Function.ts';
import { AbstractTextComponent } from './AbstractTextComponent.ts';

export class SearchComponent extends AbstractTextComponent<HTMLInputElement> {
  public clearButtonEl: HTMLElement;

  public constructor(_containerEl: HTMLElement) {
    super(createEl('input'));
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Accessing mock-only @deprecated inputEl.
    this.inputEl.type = 'search';
    this.clearButtonEl = createDiv();
  }

  public override onChanged(): void {
    noop();
  }
}
