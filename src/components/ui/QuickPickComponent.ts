import * as vscode from 'vscode';

export interface QuickPickItem<T> {
  label: string;
  description?: string;
  detail?: string;
  alwaysShow?: boolean;
  data: T;
}

export interface QuickPickOptions<T> {
  title?: string;
  placeholder?: string;
  items: QuickPickItem<T>[];
  canSelectMany?: boolean;
  ignoreFocusOut?: boolean;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
  activeItem?: QuickPickItem<T>;
  buttons?: vscode.QuickInputButton[];
  onDidTriggerButton?: (button: vscode.QuickInputButton) => void;
  onDidTriggerItemButton?: (itemButton: vscode.QuickInputButton, item: QuickPickItem<T>) => void;
  onDidChangeSelection?: (items: QuickPickItem<T>[]) => void;
  onDidChangeActive?: (items: QuickPickItem<T>[]) => void;
  onDidHide?: () => void;
}

export class QuickPickComponent<T> {
  private quickPick: vscode.QuickPick<vscode.QuickPickItem & { data: T }>;
  private options: QuickPickOptions<T>;
  private result: T | T[] | undefined;
  
  constructor(options: QuickPickOptions<T>) {
    this.options = options;
    this.quickPick = vscode.window.createQuickPick();
    this.initQuickPick();
  }
  
  private initQuickPick(): void {
    // Set up QuickPick properties
    this.quickPick.title = this.options.title;
    this.quickPick.placeholder = this.options.placeholder;
    this.quickPick.canSelectMany = this.options.canSelectMany || false;
    this.quickPick.ignoreFocusOut = this.options.ignoreFocusOut || false;
    this.quickPick.matchOnDescription = this.options.matchOnDescription ?? true;
    this.quickPick.matchOnDetail = this.options.matchOnDetail ?? true;
    
    // Map items to QuickPick items with the original data
    this.quickPick.items = this.options.items.map(item => ({
      ...item,
      data: item.data
    }));
    
    // Set active item if provided
    if (this.options.activeItem) {
      const activeQuickPickItem = this.quickPick.items.find(
        item => item.label === this.options.activeItem!.label
      );
      if (activeQuickPickItem) {
        this.quickPick.activeItems = [activeQuickPickItem];
      }
    }
    
    // Set buttons if provided
    if (this.options.buttons) {
      this.quickPick.buttons = this.options.buttons;
    }
    
    // Set up event handlers
    if (this.options.onDidTriggerButton) {
      this.quickPick.onDidTriggerButton(this.options.onDidTriggerButton);
    }
    
    if (this.options.onDidTriggerItemButton) {
      this.quickPick.onDidTriggerItemButton(e => {
        const item = e.item as vscode.QuickPickItem & { data: T };
        this.options.onDidTriggerItemButton!(e.button, {
          label: item.label,
          description: item.description,
          detail: item.detail,
          alwaysShow: item.alwaysShow,
          data: item.data
        });
      });
    }
    
    if (this.options.onDidChangeSelection) {
      this.quickPick.onDidChangeSelection(items => {
        const mappedItems = items.map(item => {
          const typedItem = item as vscode.QuickPickItem & { data: T };
          return {
            label: typedItem.label,
            description: typedItem.description,
            detail: typedItem.detail,
            alwaysShow: typedItem.alwaysShow,
            data: typedItem.data
          };
        });
        this.options.onDidChangeSelection!(mappedItems);
      });
    }
    
    if (this.options.onDidChangeActive) {
      this.quickPick.onDidChangeActive(items => {
        const mappedItems = items.map(item => {
          const typedItem = item as vscode.QuickPickItem & { data: T };
          return {
            label: typedItem.label,
            description: typedItem.description,
            detail: typedItem.detail,
            alwaysShow: typedItem.alwaysShow,
            data: typedItem.data
          };
        });
        this.options.onDidChangeActive!(mappedItems);
      });
    }
    
    // Handle acceptance (selection) and hide
    this.quickPick.onDidAccept(() => {
      const selectedItems = this.quickPick.selectedItems;
      if (!selectedItems.length) {
        this.result = undefined;
      } else if (this.options.canSelectMany) {
        this.result = selectedItems.map(item => (item as any).data);
      } else {
        this.result = (selectedItems[0] as any).data;
      }
      this.quickPick.hide();
    });
    
    if (this.options.onDidHide) {
      this.quickPick.onDidHide(this.options.onDidHide);
    }
  }
  
  public updateItems(items: QuickPickItem<T>[]): void {
    this.quickPick.items = items.map(item => ({
      ...item,
      data: item.data
    }));
  }
  
  public show(): Promise<T | T[] | undefined> {
    return new Promise<T | T[] | undefined>((resolve) => {
      this.quickPick.onDidHide(() => {
        resolve(this.result);
        // Dispose of the QuickPick to avoid memory leaks
        this.quickPick.dispose();
      });
      
      this.quickPick.show();
    });
  }
  
  public hide(): void {
    this.quickPick.hide();
  }
  
  public dispose(): void {
    this.quickPick.dispose();
  }
}