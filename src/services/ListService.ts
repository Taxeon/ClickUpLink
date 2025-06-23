import * as vscode from 'vscode';
import { apiRequest } from '../hooks/useApi';
import { List } from '../types/navigation';

/**
 * Service for interacting with ClickUp lists
 */
export class ListService {
  private context: vscode.ExtensionContext;
  private static instance: ListService;
  
  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  static getInstance(context: vscode.ExtensionContext): ListService {
    if (!ListService.instance) {
      ListService.instance = new ListService(context);
    }
    return ListService.instance;
  }
  
  /**
   * Get all lists within a folder
   */
  async getLists(folderId: string): Promise<List[]> {
    try {
      const response = await apiRequest(this.context, 'get', `folder/${folderId}/list`);
      
      if (!response || !response.lists) {
        return [];
      }
      
      // Map ClickUp lists to our List interface
      return response.lists.map((list: any): List => ({
        id: list.id,
        name: list.name,
        description: list.description || '',
        folderId: folderId,
        projectId: list.project?.id || '',        
        status: list.status ? {
          status: list.status.type || list.status.status || 'Unknown',
          color: list.status.color,
          type: list.status.type
        } : undefined
      }));
    } catch (error) {
      console.error(`Error fetching lists for folder ${folderId}:`, error);
      vscode.window.showErrorMessage(`Failed to fetch lists: ${(error as Error).message}`);
      return [];
    }
  }
  
  /**
   * Get a specific list by ID
   */
  async getList(listId: string): Promise<List | undefined> {
    try {
      const response = await apiRequest(this.context, 'get', `list/${listId}`);
      
      if (!response) {
        return undefined;
      }
      
      // Map ClickUp list to our List interface
      return {
        id: response.id,
        name: response.name,
        description: response.description || '',
        folderId: response.folder?.id || '',
        projectId: response.project?.id || '',
        status: response.status ? {
          status: response.status.type || response.status.status || 'Unknown',
          color: response.status.color,
          type: response.status.type
        } : undefined
      };
    } catch (error) {
      console.error(`Error fetching list ${listId}:`, error);
      vscode.window.showErrorMessage(`Failed to fetch list: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Create a new list in a folder
   */
  async createList(folderId: string, listData: Omit<List, 'id' | 'folderId' | 'projectId'>): Promise<List | undefined> {
    try {
      const response = await apiRequest(this.context, 'post', `folder/${folderId}/list`, {
        name: listData.name,
        description: listData.description || '',
        status: listData.status
      });
      
      if (!response) {
        return undefined;
      }
      
      // Map the response to our List interface
      return {
        id: response.id,
        name: response.name,
        description: response.description || '',
        folderId: folderId,
        projectId: response.project?.id || '',
        status: response.status ? {
          status: response.status.type || response.status.status || 'Unknown',
          color: response.status.color,
          type: response.status.type
        } : undefined
      };
    } catch (error) {
      console.error(`Error creating list in folder ${folderId}:`, error);
      vscode.window.showErrorMessage(`Failed to create list: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Update an existing list
   */
  async updateList(listId: string, updates: Partial<List>): Promise<List | undefined> {
    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) {
        updateData.name = updates.name;
      }
      
      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }
      
      if (updates.status !== undefined) {
        updateData.status = updates.status;
      }
      
      const response = await apiRequest(this.context, 'put', `list/${listId}`, updateData);
      
      if (!response) {
        return undefined;
      }
      
      // Map the response to our List interface
      return {
        id: response.id,
        name: response.name,
        description: response.description || '',
        folderId: response.folder?.id || '',
        projectId: response.project?.id || '',
        status: response.status ? {
          status: response.status.type || response.status.status || 'Unknown',
          color: response.status.color,
          type: response.status.type
        } : undefined
      };
    } catch (error) {
      console.error(`Error updating list ${listId}:`, error);
      vscode.window.showErrorMessage(`Failed to update list: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Delete a list
   */
  async deleteList(listId: string): Promise<boolean> {
    try {
      await apiRequest(this.context, 'delete', `list/${listId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting list ${listId}:`, error);
      vscode.window.showErrorMessage(`Failed to delete list: ${(error as Error).message}`);
      return false;
    }
  }
}
