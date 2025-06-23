import * as vscode from 'vscode';
import { apiRequest } from '../hooks/useApi';
import { Folder } from '../types/navigation';

/**
 * Service for interacting with ClickUp folders
 */
export class FolderService {
  private context: vscode.ExtensionContext;
  private static instance: FolderService;
  
  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  static getInstance(context: vscode.ExtensionContext): FolderService {
    if (!FolderService.instance) {
      FolderService.instance = new FolderService(context);
    }
    return FolderService.instance;
  }
  
  /**
   * Get all folders within a project/team
   */
  async getFolders(projectId: string): Promise<Folder[]> {
    try {
      // In ClickUp, we need to first get spaces in a team, then folders in each space
      const spacesResponse = await apiRequest(this.context, 'get', `team/${projectId}/space`);
      
      if (!spacesResponse || !spacesResponse.spaces) {
        return [];
      }
      
      const allFolders: Folder[] = [];
      
      // For each space, get all folders
      for (const space of spacesResponse.spaces) {
        const foldersResponse = await apiRequest(this.context, 'get', `space/${space.id}/folder`);
        
        if (foldersResponse && foldersResponse.folders) {
          // Map ClickUp folders to our Folder interface
          const folders = foldersResponse.folders.map((folder: any): Folder => ({
            id: folder.id,
            name: folder.name,
            description: folder.description || '',
            projectId: projectId,
            hidden: folder.hidden
          }));
          
          allFolders.push(...folders);
        }
      }
      
      return allFolders;
    } catch (error) {
      console.error(`Error fetching folders for project ${projectId}:`, error);
      vscode.window.showErrorMessage(`Failed to fetch folders: ${(error as Error).message}`);
      return [];
    }
  }
  
  /**
   * Get a specific folder by ID
   */
  async getFolder(folderId: string): Promise<Folder | undefined> {
    try {
      const response = await apiRequest(this.context, 'get', `folder/${folderId}`);
      
      if (!response) {
        return undefined;
      }
      
      // Map ClickUp folder to our Folder interface
      return {
        id: response.id,
        name: response.name,
        description: response.description || '',
        projectId: response.project?.id || '',
        hidden: response.hidden
      };
    } catch (error) {
      console.error(`Error fetching folder ${folderId}:`, error);
      vscode.window.showErrorMessage(`Failed to fetch folder: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Create a new folder in a project
   */
  async createFolder(projectId: string, folderData: Omit<Folder, 'id' | 'projectId'>): Promise<Folder | undefined> {
    try {
      // In ClickUp, folders are created within a space, so we need a space ID
      // Typically, we would ask the user to select a space first, but for simplicity
      // we'll get the first space in the team
      const spacesResponse = await apiRequest(this.context, 'get', `team/${projectId}/space`);
      
      if (!spacesResponse || !spacesResponse.spaces || spacesResponse.spaces.length === 0) {
        vscode.window.showErrorMessage(`No spaces found in project ${projectId}.`);
        return undefined;
      }
      
      const spaceId = spacesResponse.spaces[0].id;
      
      // Create the folder in the selected space
      const response = await apiRequest(this.context, 'post', `space/${spaceId}/folder`, {
        name: folderData.name,
        description: folderData.description || ''
      });
      
      if (!response) {
        return undefined;
      }
      
      // Map the response to our Folder interface
      return {
        id: response.id,
        name: response.name,
        description: response.description || '',
        projectId: projectId,
        hidden: response.hidden
      };
    } catch (error) {
      console.error(`Error creating folder in project ${projectId}:`, error);
      vscode.window.showErrorMessage(`Failed to create folder: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Update an existing folder
   */
  async updateFolder(folderId: string, updates: Partial<Folder>): Promise<Folder | undefined> {
    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) {
        updateData.name = updates.name;
      }
      
      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }
      
      if (updates.hidden !== undefined) {
        updateData.hidden = updates.hidden;
      }
      
      const response = await apiRequest(this.context, 'put', `folder/${folderId}`, updateData);
      
      if (!response) {
        return undefined;
      }
      
      // Map the response to our Folder interface
      return {
        id: response.id,
        name: response.name,
        description: response.description || '',
        projectId: response.project?.id || '',
        hidden: response.hidden
      };
    } catch (error) {
      console.error(`Error updating folder ${folderId}:`, error);
      vscode.window.showErrorMessage(`Failed to update folder: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId: string): Promise<boolean> {
    try {
      await apiRequest(this.context, 'delete', `folder/${folderId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting folder ${folderId}:`, error);
      vscode.window.showErrorMessage(`Failed to delete folder: ${(error as Error).message}`);
      return false;
    }
  }
}
