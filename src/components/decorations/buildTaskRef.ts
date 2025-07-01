import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { TaskReference } from '../../types/index';
import { TaskReferenceUtils} from './taskRefUtils';

export class BuildTaskRef {
  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;
  private taskReferenceUtils: TaskReferenceUtils;


  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
    this.taskReferenceUtils = new TaskReferenceUtils();
  }

    /**
   * Get and select subtask for a given task (optional)
   */
  async buildTaskRef(
    range: vscode.Range,
    task: any,
    parentRef: Partial<TaskReference> = {},
    getTaskReference?: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference?: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void
  ): Promise<void> {
    console.log('[buildTaskRef] range:', range, 'type:', typeof range, 'start:', range?.start, 'end:', range?.end);
    if (!range || typeof range.start?.line !== 'number' || typeof range.end?.line !== 'number') {
      vscode.window.showErrorMessage('ClickUp: Invalid or missing range for task reference.');
      return;
    }
    try {
      console.log("task passed to buildTaskRef:", task)
      if (task.parent) {
        // If this is a subtask, build the parent reference first
        await this.getParentTaskInfo(
          range,
          task.parent,
          task,
          parentRef,
          getTaskReference,
          saveTaskReference,
          fireChangeEvent
        );
      } else {
        // Top-level task: build the reference directly
        await this.getListInfo(
          range,
          task.list.id,
          task,
          parentRef,
          getTaskReference,
          saveTaskReference,
          fireChangeEvent
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select subtask: ${error}`);
    }
  }

  /**
   * Get and select task for a given list, then proceed to subtasks
   */
  async getParentTaskInfo(
    range: vscode.Range,
    parentTaskId: string,    // Fix: required param before optional
    refTask: any,
    parentRef: Partial<TaskReference> = {},
    getTaskReference?: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference?: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void
  ): Promise<void> {
    console.log('[getParentTaskInfo] range:', range, 'type:', typeof range, 'start:', range?.start, 'end:', range?.end);
    if (!range || typeof range.start?.line !== 'number' || typeof range.end?.line !== 'number') {
      vscode.window.showErrorMessage('ClickUp: Invalid or missing range for parent task reference.');
      return;
    }
    try {
      const actualTask = await this.clickUpService.getTaskDetails(parentTaskId);
      // Pass the actual parent task object down the chain for use in saveTaskReference
      const parentTaskRef = {
        ...parentRef,
        parentTaskId: actualTask.id,
        parentTaskName: actualTask.name,
        parentTaskStatus: actualTask.status?.status || 'Open',
        parentTaskStatusObj: actualTask.status || { status: 'Open', color: '#3b82f6' },
        parentAssignee:
          actualTask.assignees && actualTask.assignees.length > 0
            ? actualTask.assignees[0]
            : undefined,
        parentAssignees: actualTask.assignees || [],
        parentLastUpdated: new Date().toISOString(),
      };
      // Now build the reference for the subtask, passing parent info and the parent task object
      await this.getListInfo(
        range,
        actualTask.list.id,
        refTask,
        parentTaskRef,
        getTaskReference,
        saveTaskReference,
        fireChangeEvent,
        actualTask // pass parentTask as extra argument
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select task: ${error}`);
    }
  }

  /**
   * Get and select list for a given folder, then proceed to tasks
   */
  async getListInfo(
    range: vscode.Range,
    listId: string,
    refTask: any,
    parentRef: Partial<TaskReference> = {},
    getTaskReference?: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference?: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void,
    parentTask?: any // new optional argument
  ): Promise<void> {
    console.log('[getListInfo] range:', range, 'type:', typeof range, 'start:', range?.start, 'end:', range?.end);
    if (!range || typeof range.start?.line !== 'number' || typeof range.end?.line !== 'number') {
      vscode.window.showErrorMessage('ClickUp: Invalid or missing range for list reference.');
      return;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    try {
      const list = await this.clickUpService.getListDetails(listId);
      const nextRef = {
        ...parentRef,
        listId: list.id,
        listName: list.name,
      };
      await this.getFolderInfo(
        range,
        list.folder.id,
        refTask,
        nextRef,
        getTaskReference,
        saveTaskReference,
        fireChangeEvent,
        parentTask // pass parentTask down
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select list: ${error}`);
    }
  }

  /**
   * Get and select folder, then proceed to lists
   */
  async getFolderInfo(
    range: vscode.Range,
    folderId: string | undefined,
    refTask: any,
    parentRef: Partial<TaskReference> = {},
    getTaskReference?: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference?: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void,
    parentTask?: any // new optional argument
  ): Promise<void> {
    try {
      console.log('[getFolderInfo] range:', range, 'type:', typeof range, 'start:', range?.start, 'end:', range?.end);
      if (!range || typeof range.start?.line !== 'number' || typeof range.end?.line !== 'number') {
        vscode.window.showErrorMessage('ClickUp: Invalid or missing range for folder reference.');
        return;
      }
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      if (!folderId) throw new Error('No folderId provided');
      const folder = await this.clickUpService.getFolderDetails(folderId);
      const nextRef = {
        ...parentRef,
        folderId: folder.id,
        folderName: folder.name,
      };
      if (saveTaskReference && getTaskReference) {
        try {
          await this.taskReferenceUtils.saveTaskReference(
            range,
            refTask,
            parentTask || null, // pass parentTask if present, else null
            getTaskReference,
            saveTaskReference,
            fireChangeEvent,
            nextRef
          );
        } catch (err) {
          console.error('[getFolderInfo] saveTaskReference error:', err, 'range:', range);
          vscode.window.showErrorMessage(`ClickUp: saveTaskReference failed: ${err}`);
        }
      }
    } catch (error) {
      console.error('[getFolderInfo] error:', error, 'range:', range);
      vscode.window.showErrorMessage(`Failed to get folder info: ${error}`);
    }
  }
}
