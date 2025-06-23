import * as vscode from 'vscode';
import { useQuickPick } from '../../hooks/useQuickPick';
import { NavigationItem } from '../../types/navigation';

export interface BaseNavigatorOptions<T extends NavigationItem> {
  title: string;
  placeholder?: string;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
  canPickMany?: boolean;
  itemToDetail?: (item: T) => string | undefined;
  itemToDescription?: (item: T) => string | undefined;
  onDidSelectItem?: (item: T) => void;
  onDidHide?: () => void;
}

/**
 * Base class for all navigation components
 */
export abstract class BaseNavigator<T extends NavigationItem> {  protected context: vscode.ExtensionContext;
  protected options: BaseNavigatorOptions<T>;
  protected quickPick: ReturnType<typeof useQuickPick<T>>;
  
  constructor(context: vscode.ExtensionContext, options: BaseNavigatorOptions<T>) {
    this.context = context;
    this.options = options;
    this.quickPick = useQuickPick<T>();
  }
  
  /**
   * Show the navigation QuickPick
   */  async show(items: T[]): Promise<T | T[] | undefined> {
    const result = await this.quickPick.showQuickPick({
      title: this.options.title,
      placeholder: this.options.placeholder,
      items: items,
      itemToString: (item) => item.name,
      itemToDetail: this.options.itemToDetail,
      itemToDescription: this.options.itemToDescription,
      matchOnDescription: this.options.matchOnDescription,
      matchOnDetail: this.options.matchOnDetail,
      canPickMany: this.options.canPickMany,
      onDidSelectItem: this.options.onDidSelectItem,
      onDidHide: this.options.onDidHide
    });
    
    return result;
  }
  
  /**
   * Abstract method to load items
   */
  abstract loadItems(): Promise<T[]>;
  
  /**
   * Navigate to the specific level
   */
  async navigate(): Promise<T | undefined> {
    try {
      const items = await this.loadItems();
      const result = await this.show(items);
      
      if (Array.isArray(result)) {
        // Handle multiple selection case if needed
        return result[0];
      }
      
      return result;
    } catch (error) {
      vscode.window.showErrorMessage(`Navigation failed: ${(error as Error).message}`);
      return undefined;
    }
  }
}