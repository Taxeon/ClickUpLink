import * as vscode from 'vscode';
import { BaseNavigator, BaseNavigatorOptions } from './BaseNavigator';
import { Folder } from '../../types/navigation';
import { useCache } from '../../hooks/useCache';
import { useNavigation } from '../../hooks/useNavigation';

export class FolderNavigator extends BaseNavigator<Folder> {
  private projectId: string;
  private static instances: Map<string, FolderNavigator> = new Map();
  
  private constructor(context: vscode.ExtensionContext, projectId: string, options?: Partial<BaseNavigatorOptions<Folder>>) {
    const defaultOptions: BaseNavigatorOptions<Folder> = {
      title: 'Select a ClickUp Folder',
      placeholder: 'Choose a folder to navigate to...',
      itemToDescription: (folder) => folder.description,
    };
    
    super(context, { ...defaultOptions, ...(options || {}) });
    this.projectId = projectId;
  }
  
  static getInstance(context: vscode.ExtensionContext, projectId: string, options?: Partial<BaseNavigatorOptions<Folder>>): FolderNavigator {
    const key = `folder-${projectId}`;
    
    if (!FolderNavigator.instances.has(key)) {
      FolderNavigator.instances.set(key, new FolderNavigator(context, projectId, options));
    }
    
    return FolderNavigator.instances.get(key)!;
  }
  
  async loadItems(): Promise<Folder[]> {
    const cache = useCache(this.context);
    return await cache.getFolders(this.projectId);
  }
  
  async navigateToFolder(): Promise<Folder | undefined> {
    const folder = await this.navigate();
      if (folder) {
      const navigation = useNavigation(this.context);
      await navigation.goToFolder(folder);
    }
    
    return folder;
  }
}