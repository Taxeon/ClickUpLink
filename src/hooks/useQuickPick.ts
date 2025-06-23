import * as vscode from 'vscode';

interface QuickPickOptions<T> {
  title: string;
  placeholder?: string;
  items: T[];
  itemToString: (item: T) => string;
  itemToDetail?: (item: T) => string | undefined;
  itemToDescription?: (item: T) => string | undefined;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
  canPickMany?: boolean;
  onDidSelectItem?: (item: T) => void;
  onDidHide?: () => void;
}

/**
 * React-inspired hook for creating and managing QuickPick inputs
 */
export function useQuickPick<T>() {
  /**
   * Show a QuickPick with the given options
   */
  const showQuickPick = async (options: QuickPickOptions<T>): Promise<T | T[] | undefined> => {
    const quickPick = vscode.window.createQuickPick();
    
    quickPick.title = options.title;
    quickPick.placeholder = options.placeholder;
    quickPick.matchOnDescription = options.matchOnDescription ?? true;
    quickPick.matchOnDetail = options.matchOnDetail ?? true;
    quickPick.canSelectMany = options.canPickMany ?? false;
    
    quickPick.items = options.items.map(item => ({
      label: options.itemToString(item),
      description: options.itemToDescription?.(item),
      detail: options.itemToDetail?.(item),
      item // Store the original item in the QuickPickItem
    }) as vscode.QuickPickItem & { item: T });
    
    if (options.onDidSelectItem) {
      quickPick.onDidChangeSelection(selected => {
        if (selected[0]) {
          options.onDidSelectItem?.((selected[0] as any).item);
        }
      });
    }
    
    if (options.onDidHide) {
      quickPick.onDidHide(options.onDidHide);
    }
    
    quickPick.show();
    
    return new Promise<T | T[] | undefined>((resolve) => {
      quickPick.onDidAccept(() => {
        if (options.canPickMany) {
          const selectedItems = quickPick.selectedItems.map(item => (item as any).item) as T[];
          quickPick.hide();
          resolve(selectedItems);
        } else {
          const selectedItem = quickPick.selectedItems[0];
          if (selectedItem) {
            const original = (selectedItem as any).item as T;
            quickPick.hide();
            resolve(original);
          } else {
            quickPick.hide();
            resolve(undefined);
          }
        }
      });
      
      quickPick.onDidHide(() => {
        resolve(undefined);
      });
    });
  };

  /**
   * Create a custom QuickPick with additional controls
   */
  const createCustomQuickPick = <T>() => {
    const quickPick = vscode.window.createQuickPick();
    let itemMap = new Map<string, T>();
    
    const updateItems = (items: T[], itemToString: (item: T) => string, 
                         itemToDetail?: (item: T) => string | undefined,
                         itemToDescription?: (item: T) => string | undefined) => {
      itemMap.clear();
      quickPick.items = items.map(item => {
        const label = itemToString(item);
        itemMap.set(label, item);
        return {
          label,
          description: itemToDescription?.(item),
          detail: itemToDetail?.(item)
        };
      });
    };
    
    return {
      quickPick,
      updateItems,
      getSelectedItem: (): T | undefined => {
        const selected = quickPick.selectedItems[0];
        return selected ? itemMap.get(selected.label) : undefined;
      },
      getSelectedItems: (): T[] => {
        return quickPick.selectedItems.map(item => itemMap.get(item.label)!).filter(Boolean);
      }
    };
  };
  
  return { showQuickPick, createCustomQuickPick };
}