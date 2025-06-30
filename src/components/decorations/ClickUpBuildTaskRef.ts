import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { TaskReference } from '../../types/index';
import { TaskReferenceUtils} from './taskReferenceUtils';

export class ClickUpBuildTaskRef {
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
  async buildTaskRefandSave(
    range: vscode.Range,
    refTask: any,
    parentRef: Partial<TaskReference> = {},
    getTaskReference?: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference?: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void
  ): Promise<void> {
    try {
      // Fetch the latest task details
      const fullRefTask = await this.clickUpService.getTaskDetails(refTask.id);

      if (fullRefTask.parent) {
        await this.getParentTaskInfo(
          range,
          fullRefTask.parent,
          fullRefTask,
          parentRef,
          getTaskReference,
          saveTaskReference,
          fireChangeEvent
        );
      } else {
        await this.getListInfo(
          range,
          fullRefTask.list.id,
          fullRefTask,
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

    try {
      const actualTask = await this.clickUpService.getTaskDetails(parentTaskId);
      // Accumulate task info
      const nextRef = {
        ...parentRef,
        taskId: actualTask.id,
        taskName: actualTask.name,
        status: actualTask.status?.status || 'Open',
        taskStatus: actualTask.status || { status: 'Open', color: '#3b82f6' },
        assignee:
          actualTask.assignees && actualTask.assignees.length > 0
            ? actualTask.assignees[0]
            : undefined,
        assignees: actualTask.assignees || [],
        lastUpdated: new Date().toISOString(),
      };
      // Fix: pass actualTask.list.id, not listId (which is undefined)
      await this.getListInfo(
        range,
        actualTask.list.id,
        refTask,
        nextRef,
        getTaskReference,
        saveTaskReference,
        fireChangeEvent
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
    fireChangeEvent?: () => void
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    try {
      const list = await this.clickUpService.getListDetails(listId);
      console.log("list:", list)
      
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
        fireChangeEvent
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
    fireChangeEvent?: () => void
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    try {
      if (!folderId) throw new Error('No folderId provided');
      const folder = await this.clickUpService.getFolderDetails(folderId);
      const nextRef = {
        ...parentRef,
        folderId: folder.id,
        folderName: folder.name,
      };

      console.log("saveTaskReference:", saveTaskReference);
      console.log("getTaskReference:", getTaskReference);
      console.log("nextRef:", nextRef);
      if (saveTaskReference && getTaskReference) {
        await this.taskReferenceUtils.saveTaskReference(
          range,
          refTask,
          null,
          getTaskReference,
          saveTaskReference,
          fireChangeEvent,
          nextRef
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select folder: ${error}`);
    }
  }
}
