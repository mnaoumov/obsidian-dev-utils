import type {
  App,
  Command,
  IconName,
  Plugin
} from 'obsidian';

export interface CommandBaseOptions<TPlugin extends Plugin> {
  icon: IconName;
  id: string;
  name: string;
  plugin: TPlugin;
}

export abstract class CommandBase<TPlugin extends Plugin> implements Command {
  public icon: IconName;
  public id: string;
  public name: string;
  protected readonly app: App;
  protected readonly plugin: TPlugin;

  public constructor(options: CommandBaseOptions<TPlugin>) {
    this.id = options.id;
    this.name = options.name;
    this.icon = options.icon;
    this.plugin = options.plugin;
    this.app = this.plugin.app;
  }

  public register(): void {
    this.plugin.addCommand(this);
  }
}

export abstract class CommandInvocationBase<TPlugin extends Plugin = Plugin> {
  protected readonly app: App;
  private lastCanExecuteResult?: boolean;

  public constructor(protected readonly plugin: TPlugin) {
    this.app = plugin.app;
  }

  public invoke(checking: boolean): boolean {
    this.lastCanExecuteResult = this.canExecute();
    if (!checking && this.lastCanExecuteResult) {
      this.execute();
    }

    return this.lastCanExecuteResult;
  }

  protected canExecute(): boolean {
    return true;
  }

  protected execute(): void {
    if (this.lastCanExecuteResult === undefined) {
      throw new Error('canExecute() must be called before execute()');
    }
    if (!this.lastCanExecuteResult) {
      throw new Error('canExecute() must return true before execute()');
    }
  }
}
