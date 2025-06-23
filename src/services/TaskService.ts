import * as vscode from 'vscode';
import { apiRequest } from '../hooks/useApi';
import { Task } from '../types/navigation';

/**
 * Service for interacting with ClickUp tasks
 */
export class TaskService {
  private context: vscode.ExtensionContext;
  private static instance: TaskService;
  
  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  static getInstance(context: vscode.ExtensionContext): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService(context);
    }
    return TaskService.instance;
  }
  
  /**
   * Get all tasks within a list
   */
  async getTasks(listId: string): Promise<Task[]> {
    try {
      const response = await apiRequest(this.context, 'get', `list/${listId}/task`);
      
      if (!response || !response.tasks) {
        return [];
      }
      
      // Map ClickUp tasks to our Task interface
      return response.tasks.map((task: any): Task => ({
        id: task.id,
        name: task.name,
        description: task.description || '',
        listId: listId,
        folderId: task.folder?.id || '',
        projectId: task.project?.id || '',
        status: task.status?.status,
        priority: task.priority ? {
          id: task.priority.id,
          priority: task.priority.priority,
          color: task.priority.color
        } : undefined,
        assignees: task.assignees?.map((assignee: any) => assignee.id) || [],
        dueDate: task.due_date,
        tags: task.tags?.map((tag: any) => tag.name) || []
      }));
    } catch (error) {
      console.error(`Error fetching tasks for list ${listId}:`, error);
      vscode.window.showErrorMessage(`Failed to fetch tasks: ${(error as Error).message}`);
      return [];
    }
  }
  
  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<Task | undefined> {
    try {
      const response = await apiRequest(this.context, 'get', `task/${taskId}`);
      
      if (!response) {
        return undefined;
      }
      
      // Map ClickUp task to our Task interface
      return {
        id: response.id,
        name: response.name,
        description: response.description || '',
        listId: response.list?.id || '',
        folderId: response.folder?.id || '',
        projectId: response.project?.id || '',
        status: response.status?.status,
        priority: response.priority ? {
          id: response.priority.id,
          priority: response.priority.priority,
          color: response.priority.color
        } : undefined,
        assignees: response.assignees?.map((assignee: any) => assignee.id) || [],
        dueDate: response.due_date,
        tags: response.tags?.map((tag: any) => tag.name) || []
      };
    } catch (error) {
      console.error(`Error fetching task ${taskId}:`, error);
      vscode.window.showErrorMessage(`Failed to fetch task: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Create a new task in a list
   */
  async createTask(listId: string, taskData: Omit<Task, 'id'>): Promise<Task | undefined> {
    try {
      const requestData: any = {
        name: taskData.name,
        description: taskData.description || ''
      };

      if (taskData.status) {
        requestData.status = taskData.status;
      }

      if (taskData.priority) {
        requestData.priority = taskData.priority;
      }

      if (taskData.assignees && taskData.assignees.length > 0) {
        requestData.assignees = taskData.assignees;
      }

      if (taskData.dueDate) {
        requestData.due_date = taskData.dueDate;
      }

      if (taskData.tags && taskData.tags.length > 0) {
        requestData.tags = taskData.tags;
      }

      const response = await apiRequest(this.context, 'post', `list/${listId}/task`, requestData);
      
      if (!response) {
        return undefined;
      }
      
      // Map the response to our Task interface
      return {
        id: response.id,
        name: response.name,
        description: response.description || '',
        listId: listId,
        folderId: response.folder?.id || '',
        projectId: response.project?.id || '',
        status: response.status?.status,
        priority: response.priority ? {
          id: response.priority.id,
          priority: response.priority.priority,
          color: response.priority.color
        } : undefined,
        assignees: response.assignees?.map((assignee: any) => assignee.id) || [],
        dueDate: response.due_date,
        tags: response.tags?.map((tag: any) => tag.name) || []
      };
    } catch (error) {
      console.error(`Error creating task in list ${listId}:`, error);
      vscode.window.showErrorMessage(`Failed to create task: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | undefined> {
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
      
      if (updates.priority !== undefined) {
        updateData.priority = updates.priority.priority;
      }
      
      if (updates.assignees !== undefined) {
        updateData.assignees = updates.assignees;
      }
      
      if (updates.dueDate !== undefined) {
        updateData.due_date = updates.dueDate;
      }
      
      if (updates.tags !== undefined) {
        updateData.tags = updates.tags;
      }
      
      const response = await apiRequest(this.context, 'put', `task/${taskId}`, updateData);
      
      if (!response) {
        return undefined;
      }
      
      // Map the response to our Task interface
      return {
        id: response.id,
        name: response.name,
        description: response.description || '',
        listId: response.list?.id || '',
        folderId: response.folder?.id || '',
        projectId: response.project?.id || '',
        status: response.status?.status,
        priority: response.priority ? {
          id: response.priority.id,
          priority: response.priority.priority,
          color: response.priority.color
        } : undefined,
        assignees: response.assignees?.map((assignee: any) => assignee.id) || [],
        dueDate: response.due_date,
        tags: response.tags?.map((tag: any) => tag.name) || []
      };
    } catch (error) {
      console.error(`Error updating task ${taskId}:`, error);
      vscode.window.showErrorMessage(`Failed to update task: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      await apiRequest(this.context, 'delete', `task/${taskId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting task ${taskId}:`, error);
      vscode.window.showErrorMessage(`Failed to delete task: ${(error as Error).message}`);
      return false;
    }
  }
}
