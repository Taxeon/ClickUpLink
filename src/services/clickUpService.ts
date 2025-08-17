// clickUpService.ts
// ClickUp API service implementation with OAuth2 support

import * as vscode from 'vscode';
import { apiRequest } from '../hooks/useApi';
import { checkAuth } from '../hooks/useAuth';
import { getAccessToken } from '../utils/tokenStorage';
import { httpClient } from '../utils/httpClient';

const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2';

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
    // ClickUp API v2 has a dedicated endpoint for teams
    const teamsResponse = await apiRequest(this.context, 'get', 'team');
    console.log('🔍 Teams API response:', JSON.stringify(teamsResponse, null, 2));
    return teamsResponse?.teams || [];
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
   * Get folders within a space
   */
  async getFolderDetails(folderId: string) {
    return apiRequest(this.context, 'get', `folder/${folderId}`);
  }

  /**
   * Get lists within a folder
   */
  async getLists(folderId: string) {
    return apiRequest(this.context, 'get', `folder/${folderId}/list`);
  }

    /**
   * Get lists within a folder
   */
  async getListDetails(listId: string) {
    return apiRequest(this.context, 'get', `list/${listId}`);
  }

  /**
   * Get tasks within a list
   */
  async getTasks(listId: string) {
    return apiRequest(this.context, 'get', `list/${listId}/task`);
  }

  async getSubtasks(taskId: string) {
    return apiRequest(this.context, 'get', `task/${taskId}/subtask`);
  }

  async getAllListTasks(listId: string) {
    return apiRequest(this.context, 'get', `list/${listId}/task?subtasks=true`);
  }

  async getSubtasksFromParentList(taskId: string, parentListId: string) {
    const allListTasks = await this.getAllListTasks(parentListId);
    return allListTasks.tasks.filter((t: any) => t.parent === taskId);
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
   * Get space details including members
   */
  async getSpaceDetails(spaceId: string) {
    console.log(`🔧 ClickUpService.getSpaceDetails called with spaceId: ${spaceId}`);

    try {
      const result = await apiRequest(this.context, 'get', `space/${spaceId}`);
      console.log('🔧 ClickUpService.getSpaceDetails result:', result);
      return result;
    } catch (error) {
      console.error('🔧 ClickUpService.getSpaceDetails error:', error);
      throw error;
    }
  }

  /**
   * Get available statuses for a specific list
   */
  async getListStatuses(listId: string) {
    try {
      const listDetails = await this.getListDetails(listId);
      return listDetails?.statuses || [];
    } catch (error) {
      console.error('Failed to fetch list statuses:', error);
      return [];
    }
  }

  /**
   * Check if currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await checkAuth(this.context);
  }

  /**
   * Create a new space in a workspace
   */
  async createSpace(workspaceId: string, name: string) {
    return apiRequest(this.context, 'post', `team/${workspaceId}/space`, { name });
  }

  /**
   * Create a new folder in a space
   */
  async createFolder(spaceId: string, name: string) {
    return apiRequest(this.context, 'post', `space/${spaceId}/folder`, { name });
  }

  /**
   * Create a new list in a folder
   */
  async createList(folderId: string, name: string) {
    console.log(`🔧 ClickUpService.createList called with folderId: ${folderId}, name: "${name}"`);
    try {
      const result = await apiRequest(this.context, 'post', `folder/${folderId}/list`, { name });
      console.log('🔧 ClickUpService.createList result:', result);
      return result;
    } catch (error) {
      console.error('🔧 ClickUpService.createList error:', error);
      throw error;
    }
  }

  /**
   * Create a new list directly in a space (folderless)
   */
  async createFolderlessList(spaceId: string, name: string) {
    return apiRequest(this.context, 'post', `space/${spaceId}/list`, { name });
  }

  /**
   * Create a new task in a list
   */
  async createTask(listId: string, name: string, description?: string) {
    console.log(
      `🔧 ClickUpService.createTask called with listId: ${listId}, name: "${name}", description: "${description || 'None'}"`
    );
    const taskData: any = { name };
    if (description) {
      taskData.description = description;
    }
    console.log(`🔧 ClickUpService.createTask taskData:`, taskData);

    try {
      // Make the API request with a custom timeout of 45 seconds for task creation
      const result = await httpClient.request(`${CLICKUP_API_BASE_URL}/list/${listId}/task`, {
        method: 'POST',
        data: taskData,
        timeout: 45000, // 45 second timeout specifically for task creation
        headers: {
          Authorization: `Bearer ${await getAccessToken(this.context)}`,
          'Content-Type': 'application/json',
        },
      }).then(response => response.data);
      
      console.log('🔧 ClickUpService.createTask result:', result);
      return result;
    } catch (error) {
      console.error('🔧 ClickUpService.createTask error:', error);
      throw error;
    }
  }

  /**
   * Create a new subtask
   */
  async createSubtask(parentTaskId: string, name: string, description?: string) {
    console.log(
      `🔧 ClickUpService.createSubtask called with parentTaskId: ${parentTaskId}, name: "${name}", description: "${description || 'None'}"`
    );

    // First get the parent task to find its list ID
    const parentTask = await this.getTaskDetails(parentTaskId);
    if (!parentTask?.list?.id) {
      throw new Error('Could not find parent task list');
    }

    const taskData: any = {
      name,
      parent: parentTaskId, // This makes it a subtask
    };
    if (description) {
      taskData.description = description;
    }
    console.log(`🔧 ClickUpService.createSubtask taskData:`, taskData);
    console.log(`🔧 ClickUpService.createSubtask creating in list: ${parentTask.list.id}`);

    try {
      // Create the subtask using the regular task creation endpoint but with parent field
      // Use httpClient directly with a longer timeout for subtasks
      const result = await httpClient.request(`${CLICKUP_API_BASE_URL}/list/${parentTask.list.id}/task`, {
        method: 'POST',
        data: taskData,
        timeout: 60000, // 60 second timeout for subtasks (they take longer)
        headers: {
          Authorization: `Bearer ${await getAccessToken(this.context)}`,
          'Content-Type': 'application/json',
        },
      }).then(response => response.data);
      
      console.log('🔧 ClickUpService.createSubtask result:', result);
      return result;
    } catch (error) {
      console.error('🔧 ClickUpService.createSubtask error:', error);
      throw error;
    }
  }

  /**
   * Get task members (people who have access to a task)
   */
  async getTaskMembers(taskId: string) {
    console.log(`🔧 ClickUpService.getTaskMembers called with taskId: ${taskId}`);

    try {
      const result = await apiRequest(this.context, 'get', `task/${taskId}/member`);
      console.log('🔧 ClickUpService.getTaskMembers result:', result);
      return result;
    } catch (error) {
      console.error('🔧 ClickUpService.getTaskMembers error:', error);
      throw error;
    }
  }

  /**
   * Get workspace members - try different approaches
   */
  async getWorkspaceMembers(workspaceId: string) {
    console.log(`🔧 ClickUpService.getWorkspaceMembers called with workspaceId: ${workspaceId}`);

    try {
      // Try the team/{team_id} endpoint first to get team info including members
      const result = await apiRequest(this.context, 'get', `team/${workspaceId}`);
      console.log('🔧 ClickUpService.getWorkspaceMembers (team info) result:', result);
      return result?.members || [];
    } catch (error) {
      console.error('🔧 ClickUpService.getWorkspaceMembers error:', error);
      // Return empty array rather than throwing, so we can try other approaches
      return [];
    }
  }

  /**
   * Update task assignee
   */
  async updateTaskAssignee(taskId: string, assigneeIds: string[]) {
    console.log(
      `🔧 ClickUpService.updateTaskAssignee called with taskId: ${taskId}, assigneeIds:`,
      assigneeIds
    );

    const taskData = {
      assignees: {
        add: assigneeIds,
        rem: [], // We'll clear existing and set new ones
      },
    };

    // First clear existing assignees, then add new ones
    try {
      // Get current task to find existing assignees
      const taskDetails = await this.getTaskDetails(taskId);
      const currentAssigneeIds = taskDetails?.assignees?.map((a: any) => a.id) || [];

      taskData.assignees.rem = currentAssigneeIds;
      console.log(
        `🔧 ClickUpService.updateTaskAssignee removing existing assignees:`,
        currentAssigneeIds
      );
      console.log(`🔧 ClickUpService.updateTaskAssignee adding new assignees:`, assigneeIds);

      const result = await apiRequest(this.context, 'put', `task/${taskId}`, taskData);
      console.log('🔧 ClickUpService.updateTaskAssignee result:', result);
      return result;
    } catch (error) {
      console.error('🔧 ClickUpService.updateTaskAssignee error:', error);
      throw error;
    }
  }
}
