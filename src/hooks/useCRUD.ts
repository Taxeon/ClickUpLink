import * as vscode from 'vscode';
import { ProjectService } from '../services/ProjectService';
import { FolderService } from '../services/FolderService';
import { ListService } from '../services/ListService';
import { TaskService } from '../services/TaskService';
import { Project, Folder, List, Task } from '../types/navigation';
import { useCache } from './useCache';

/**
 * React-inspired hook for CRUD operations on projects, folders, lists, and tasks
 */
export function useCRUD(context?: vscode.ExtensionContext) {
  if (!context) {
    // Get from extension context in extension.ts
    context = (global as any).extensionContext;
    
    if (!context) {
      throw new Error('Extension context is required for useCRUD hook');
    }
  }
  
  const projectService = ProjectService.getInstance(context);
  const folderService = FolderService.getInstance(context);
  const listService = ListService.getInstance(context);
  const taskService = TaskService.getInstance(context);
  
  const cache = useCache(context);
  
  // Create operations
  const createTask = async (listId: string, taskData: Omit<Task, 'id'>): Promise<Task | undefined> => {
    const task = await taskService.createTask(listId, taskData);
    if (task) {
      cache.invalidateTasks(listId);
    }
    return task;
  };
  
  const createList = async (folderId: string, listData: Omit<List, 'id' | 'folderId' | 'projectId'>): Promise<List | undefined> => {
    const list = await listService.createList(folderId, listData);
    if (list) {
      cache.invalidateList(folderId);
    }
    return list;
  };
  
  const createFolder = async (projectId: string, folderData: Omit<Folder, 'id' | 'projectId'>): Promise<Folder | undefined> => {
    const folder = await folderService.createFolder(projectId, folderData);
    if (folder) {
      cache.invalidateFolder(projectId);
    }
    return folder;
  };
  
  // Update operations
  const updateTask = async (taskId: string, updates: Partial<Task>): Promise<Task | undefined> => {
    const task = await taskService.updateTask(taskId, updates);
    if (task) {
      cache.invalidateTasks(task.listId);
    }
    return task;
  };
  
  const updateList = async (listId: string, updates: Partial<List>): Promise<List | undefined> => {
    const list = await listService.updateList(listId, updates);
    if (list) {
      cache.invalidateList(list.folderId);
    }
    return list;
  };
  
  const updateFolder = async (folderId: string, updates: Partial<Folder>): Promise<Folder | undefined> => {
    const folder = await folderService.updateFolder(folderId, updates);
    if (folder) {
      cache.invalidateFolder(folder.projectId);
    }
    return folder;
  };
  
  // Delete operations
  const deleteTask = async (taskId: string, listId: string): Promise<boolean> => {
    const success = await taskService.deleteTask(taskId);
    if (success) {
      cache.invalidateTasks(listId);
    }
    return success;
  };
  
  const deleteList = async (listId: string, folderId: string): Promise<boolean> => {
    const success = await listService.deleteList(listId);
    if (success) {
      cache.invalidateList(folderId);
    }
    return success;
  };
  
  const deleteFolder = async (folderId: string, projectId: string): Promise<boolean> => {
    const success = await folderService.deleteFolder(folderId);
    if (success) {
      cache.invalidateFolder(projectId);
    }
    return success;
  };
  
  return {
    // Create
    createTask,
    createList,
    createFolder,
    
    // Update
    updateTask,
    updateList,
    updateFolder,
    
    // Delete
    deleteTask,
    deleteList,
    deleteFolder
  };
}