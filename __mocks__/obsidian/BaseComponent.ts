export class BaseComponent {
  disabled = false;

  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    return this;
  }

  then(cb: (component: this) => unknown): this {
    cb(this);
    return this;
  }
}
