// clickUpService.ts
// ClickUp API service implementation with OAuth2 support

import * as vscode from 'vscode';
import { apiRequest } from '../hooks/useApi';
import { checkAuth } from '../hooks/useAuth';

export class ClickUpService {
  private readonly context: vscode.ExtensionContext;
  private static instance: ClickUpService;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  static getInstance(context: vscode.ExtensionContext): ClickUpService {
    if (!ClickUpService.instance) {
      ClickUpService.instance = new ClickUpService(context);
    }
    return ClickUpService.instance;
  }

  /**
   * Get authorized user information
   */
  async getAuthorizedUser() {
    return apiRequest(this.context, 'get', 'user');
  }

  /**
   * Get all workspaces accessible by the user
   */
  async getWorkspaces() {
    const userData = await apiRequest(this.context, 'get', 'user');
    return userData?.teams || [];
  }

  /**
   * Get spaces within a workspace
   */
  async getSpaces(workspaceId: string) {
    return apiRequest(this.context, 'get', `team/${workspaceId}/space`);
  }

  /**
   * Get folders within a space
   */
  async getFolders(spaceId: string) {
    return apiRequest(this.context, 'get', `space/${spaceId}/folder`);
  }

  /**
   * Get lists within a folder
   */
  async getLists(folderId: string) {
    return apiRequest(this.context, 'get', `folder/${folderId}/list`);
  }

  /**
   * Get tasks within a list
   */
  async getTasks(listId: string) {
    return apiRequest(this.context, 'get', `list/${listId}/task`);
  }

  /**
   * Create a new task
   */
  async createTask(listId: string, taskData: any) {
    return apiRequest(this.context, 'post', `list/${listId}/task`, taskData);
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: string) {
    return apiRequest(this.context, 'put', `task/${taskId}`, { status });
  }

  /**
   * Get task details
   */
  async getTaskDetails(taskId: string) {
    return apiRequest(this.context, 'get', `task/${taskId}`);
  }

  /**
   * Check if currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await checkAuth(this.context);
  }
}