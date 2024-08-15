import {
  type App,
  Modal
} from "obsidian";

export async function alert(app: App, message: string): Promise<void> {
  return new Promise<void>((resolve) => {
    class AlertModal extends Modal {
      public constructor(app: App) {
        super(app);
      }

      public override onOpen(): void {
        this.setContent(createFragment(fragment => {
          const modalContent = fragment.createDiv({ cls: "mod-cta" });
          modalContent.createEl("p", { text: message });
          modalContent.createEl("button", {
            cls: "mod-cta",
            text: "OK",
            onclick: () => this.close()
          } as DomElementInfo);
        }));
      }

      public override onClose(): void {
        resolve();
      }
    }

    const modal = new AlertModal(app);
    modal.open();
  });
}
