import * as vscode from 'vscode';
import { BaseNavigator, BaseNavigatorOptions } from './BaseNavigator';
import { List } from '../../types/navigation';
import { useCache } from '../../hooks/useCache';
import { useNavigation } from '../../hooks/useNavigation';

export class ListNavigator extends BaseNavigator<List> {
  private folderId: string;
  private projectId?: string;
  private static instances: Map<string, ListNavigator> = new Map();
  
  private constructor(context: vscode.ExtensionContext, folderId: string, projectId?: string, options?: Partial<BaseNavigatorOptions<List>>) {
    const defaultOptions: BaseNavigatorOptions<List> = {
      title: 'Select a ClickUp List',      placeholder: 'Choose a list to navigate to...',
      itemToDescription: (list) => list.description,
      itemToDetail: (list) => list.status ? `Status: ${list.status.status}` : undefined,
    };
    
    super(context, { ...defaultOptions, ...(options || {}) });
    this.folderId = folderId;
    this.projectId = projectId;
  }
  
  static getInstance(context: vscode.ExtensionContext, folderId: string, projectId?: string, options?: Partial<BaseNavigatorOptions<List>>): ListNavigator {
    const key = `list-${folderId}`;
    
    if (!ListNavigator.instances.has(key)) {
      ListNavigator.instances.set(key, new ListNavigator(context, folderId, projectId, options));
    }
    
    return ListNavigator.instances.get(key)!;
  }
  
  async loadItems(): Promise<List[]> {
    const cache = useCache(this.context);
    return await cache.getLists(this.folderId, this.projectId);
  }
  
  async navigateToList(): Promise<List | undefined> {
    const list = await this.navigate();
      if (list) {
      const navigation = useNavigation(this.context);
      await navigation.goToList(list);
    }
    
    return list;
  }
}