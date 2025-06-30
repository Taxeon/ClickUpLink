import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { TaskReference } from '../../types/index';
import { TaskReferenceUtils} from './taskReferenceUtils';

export class ClickUpGetTask {
  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;
  private taskReferenceUtils: TaskReferenceUtils;


  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
    this.taskReferenceUtils = new TaskReferenceUtils();
  }

  /**
   * Get and select folder, then proceed to lists
   */
  async selectFolder(
    range: vscode.Range,
    currentFolderId?: string,
    getTaskReference?: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference?: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void,
    parentRef: Partial<TaskReference> = {}
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      // Get current active space from workspace state
      const currentSpaceId = this.context.workspaceState.get<string>('clickup.currentSpaceId');

      if (!currentSpaceId) {
        vscode.window.showErrorMessage(
          'No active space selected. Please select a space first in the Workspace panel.'
        );
        return;
      }

      const folderResponse = await this.clickUpService.getFolders(currentSpaceId);
      const folders = folderResponse?.folders || [];

      // Create folder selection items with "Create New" option
      const folderItems = [
        { label: '+ Create New Folder', isNew: true, folder: null },
        ...folders.map((f: any) => ({
          label: f.name,
          picked: f.id === currentFolderId,
          isNew: false,
          folder: f,
        })),
      ];

      const selected = await vscode.window.showQuickPick(folderItems, {
        placeHolder: 'Select folder or create new',
      });
      if (!selected) return;

      let actualFolder = selected.folder;

      // Handle new folder creation
      if (selected.isNew) {
        const newFolder = await this.createNewItem(currentSpaceId, 'folder');
        if (!newFolder) return;
        actualFolder = newFolder;
      }

      // Accumulate folder info
      const nextRef = {
        ...parentRef,
        folderId: actualFolder.id,
        folderName: actualFolder.name,
      };
      // Continue to list selection
      await this.selectList(
        range,
        actualFolder.id,
        undefined,
        getTaskReference,
        saveTaskReference,
        fireChangeEvent,
        nextRef
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select folder: ${error}`);
    }
  }

  /**
   * Get and select list for a given folder, then proceed to tasks
   */
  async selectList(
    range: vscode.Range,
    folderId: string,
    currentListId?: string,
    getTaskReference?: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference?: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void,
    parentRef: Partial<TaskReference> = {}
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      const lists = await this.clickUpService.getLists(folderId);

      // Create list selection items with "Create New" option
      const listItems = [
        { label: '+ Create New List', isNew: true, list: null },
        ...(lists?.lists || []).map((l: any) => ({
          label: l.name,
          picked: l.id === currentListId,
          isNew: false,
          list: l,
        })),
      ];

      const selectedList = await vscode.window.showQuickPick(listItems, {
        placeHolder: 'Select list or create new',
      });
      if (!selectedList) return;

      let actualList = selectedList.list;

      // Handle new list creation
      if (selectedList.isNew) {
        const newList = await this.createNewItem({ id: folderId }, 'list');
        if (!newList) return;
        actualList = newList;
      }

      // Accumulate list info
      const nextRef = {
        ...parentRef,
        listId: actualList.id,
        listName: actualList.name,
      };
      // Continue to task selection
      await this.selectTask(
        range,
        actualList.id,
        undefined,
        getTaskReference,
        saveTaskReference,
        fireChangeEvent,
        nextRef
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select list: ${error}`);
    }
  }

  /**
   * Get and select task for a given list, then proceed to subtasks
   */
  async selectTask(
    range: vscode.Range,
    listId: string,
    currentTaskId?: string,
    getTaskReference?: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference?: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void,
    parentRef: Partial<TaskReference> = {}
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      const tasks = await this.clickUpService.getTasks(listId);

      // Create task selection items with "Create New" option
      const taskItems = [
        { label: '+ Create New Task', isNew: true, task: null },
        ...(tasks?.tasks || []).map((t: any) => ({
          label: t.name,
          description: t.status?.status,
          picked: t.id === currentTaskId,
          isNew: false,
          task: t,
        })),
      ];

      const selectedTask = await vscode.window.showQuickPick(taskItems, {
        placeHolder: 'Select task or create new',
      });
      if (!selectedTask) return;

      let actualTask = selectedTask.task;

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

      // Handle new task creation
      if (selectedTask.isNew) {
        const newTask = await this.createNewItem({ id: listId }, 'task');
        if (!newTask) return;
        actualTask = newTask;

        // If there are no subtasks, save the main task reference immediately
        const subtasks = await this.clickUpService.getSubtasksFromParentList(actualTask.id, listId);
        if (!subtasks || subtasks.length === 0) {
          if (saveTaskReference && getTaskReference) {
            await this.taskReferenceUtils.saveTaskReference(
              range,
              actualTask,
              null,
              getTaskReference,
              saveTaskReference,
              fireChangeEvent,
              nextRef
            );
          }
        }
      }

      // Continue to subtask selection (for initial setup flow)
      await this.selectSubtask(
        range,
        actualTask,
        listId,
        getTaskReference,
        saveTaskReference,
        fireChangeEvent,
        nextRef
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select task: ${error}`);
    }
  }

  /**
   * Get and select subtask for a given task (optional)
   */
  async selectSubtask(
    range: vscode.Range,
    parentTask: any,
    parentListId: string,
    getTaskReference?: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference?: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void,
    parentRef: Partial<TaskReference> = {}
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      console.log('TaskID:', parentTask.id, 'Parent List ID:', parentListId);
      const subtasks = await this.clickUpService.getSubtasksFromParentList(
        parentTask.id,
        parentListId
      );

      // Create subtask selection items with "Create New" option
      const subtaskItems = [
        { label: '+ Create New Subtask', isNew: true, subtask: null },
        ...(subtasks || []).map((s: any) => ({
          label: s.name,
          isNew: false,
          subtask: s,
        })),
      ];

      const selectedSubtask = await vscode.window.showQuickPick(subtaskItems, {
        placeHolder: 'Select subtask or create new (optional - cancel to use main task)',
      });

      console.log('SaveTaskRef:', saveTaskReference, 'getTaskRef:', getTaskReference);

      // If user cancels, that's OK - they want to use the main task
      if (!selectedSubtask) {
        if (saveTaskReference && getTaskReference) {
          await this.taskReferenceUtils.saveTaskReference(
            range,
            parentTask,
            null,
            getTaskReference,
            saveTaskReference,
            fireChangeEvent,
            parentRef
          );
        }
        return;
      }

      let actualSubtask = selectedSubtask.subtask;

      // Handle new subtask creation
      if (selectedSubtask.isNew) {
        actualSubtask = await this.createNewItem(parentTask, 'subtask');
        if (!actualSubtask) return;
        // Immediately save and exit after creating a new subtask
        if (saveTaskReference && getTaskReference) {
          await this.taskReferenceUtils.saveTaskReference(
            range,
            actualSubtask,
            parentTask,
            getTaskReference,
            saveTaskReference,
            fireChangeEvent,
            parentRef
          );
        }
        return;
      }

      // Save the subtask reference (for existing subtasks)
      if (saveTaskReference && getTaskReference) {
        await this.taskReferenceUtils.saveTaskReference(
          range,
          actualSubtask,
          parentTask,
          getTaskReference,
          saveTaskReference,
          fireChangeEvent,
          parentRef
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select subtask: ${error}`);
    }
  }

  /**
   * Generic function to create a new item (folder, list, task, subtask)
   */
  private async createNewItem(
    parent: any,
    type: 'folder' | 'list' | 'task' | 'subtask',
    parentListId?: string // for subtasks
  ): Promise<any> {
    let prompt = '';
    let placeHolder = '';
    let createFn: (...args: any[]) => Promise<any>;
    let parentId: string;
    let parentName: string;
    let itemLabel = '';

    switch (type) {
      case 'folder':
        prompt = 'Enter name for new folder';
        placeHolder = 'Folder name...';
        createFn = this.clickUpService.createFolder.bind(this.clickUpService);
        parentId = parent; // parent is spaceId
        parentName = '';
        itemLabel = 'folder';
        break;
      case 'list':
        prompt = 'Enter name for new list';
        placeHolder = 'List name...';
        createFn = this.clickUpService.createList.bind(this.clickUpService);
        parentId = parent.id;
        parentName = parent.name;
        itemLabel = 'list';
        break;
      case 'task':
        prompt = 'Enter name for new task';
        placeHolder = 'Task name...';
        createFn = this.clickUpService.createTask.bind(this.clickUpService);
        parentId = parent.id;
        parentName = parent.name;
        itemLabel = 'task';
        break;
      case 'subtask':
        prompt = `Create a subtask for "${parent.name}"`;
        placeHolder = 'Subtask name...';
        createFn = this.clickUpService.createSubtask.bind(this.clickUpService);
        parentId = parent.id;
        parentName = parent.name;
        itemLabel = 'subtask';
        break;
      default:
        throw new Error('Unknown item type');
    }

    const name = await vscode.window.showInputBox({
      prompt,
      placeHolder,
      validateInput: value => {
        if (!value || value.trim().length === 0) {
          return `${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} name cannot be empty`;
        }
        return null;
      },
    });

    if (!name) return null;

    try {
      let newItem;
      if (type === 'folder') {
        newItem = await createFn(parentId, name.trim());
      } else if (type === 'list') {
        newItem = await createFn(parentId, name.trim());
      } else if (type === 'task') {
        newItem = await createFn(parentId, name.trim());
      } else if (type === 'subtask') {
        newItem = await createFn(parentId, name.trim());
      }
      if (!newItem || !newItem.id) {
        vscode.window.showErrorMessage(`Failed to create ${itemLabel}`);
        return null;
      }
      vscode.window.showInformationMessage(`Created new ${itemLabel}: ${newItem.name}`);
      return newItem;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create ${itemLabel}: ${error}`);
      return null;
    }
  }

  
}
