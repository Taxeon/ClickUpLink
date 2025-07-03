import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { TaskReference } from '../../types/index';
import { BuildTaskRef } from './buildTaskRef';
import { ClickUpCodeLensDebug } from './taskRefMaintenance';

export class GetTask {
  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;
  private taskRefBuilder: BuildTaskRef;
  private getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined;

  constructor(
    context: vscode.ExtensionContext,
    taskRefBuilder: BuildTaskRef,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined
  ) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
    this.taskRefBuilder = taskRefBuilder;
    this.getTaskReference = getTaskReference;

    // Bind methods to the current instance
    this.selectFolder = this.selectFolder.bind(this);
    this.selectList = this.selectList.bind(this);
    this.selectTask = this.selectTask.bind(this);
    this.selectSubtask = this.selectSubtask.bind(this);
    this.createNewItem = this.createNewItem.bind(this);
  }

  /**
   * Get and select folder, then proceed to lists
   * Refactored: No parentRef/refChain propagation, just selection.
   */
  async selectFolder(
    range: vscode.Range,
    currentFolderId?: string
  ): Promise<{ selectedTask: any, parentTask: any }> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return { selectedTask: null, parentTask: null };
    try {
      const currentSpaceId = this.context.workspaceState.get<string>('clickup.currentSpaceId');
      if (!currentSpaceId) {
        vscode.window.showErrorMessage(
          'No active space selected. Please select a space first in the Workspace panel.'
        );
        return { selectedTask: null, parentTask: null };
      }
      const folderResponse = await this.clickUpService.getFolders(currentSpaceId);
      const folders = folderResponse?.folders || [];
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
      if (!selected) return { selectedTask: null, parentTask: null };
      let actualFolder = selected.folder;
      if (selected.isNew) {
        const newFolder = await this.createNewItem(currentSpaceId, 'folder');
        if (!newFolder) return { selectedTask: null, parentTask: null };
        actualFolder = newFolder;
      }
      // Continue to list selection
      return await this.selectList(range, actualFolder.id);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select folder: ${error}`);
      return { selectedTask: null, parentTask: null };
    }
  }

  /**
   * Get and select list for a given folder, then proceed to tasks
   */
  async selectList(
    range: vscode.Range,
    folderId: string,
    currentListId?: string
  ): Promise<{ selectedTask: any, parentTask: any }> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return { selectedTask: null, parentTask: null };
    try {
      const lists = await this.clickUpService.getLists(folderId);
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
      if (!selectedList) return { selectedTask: null, parentTask: null };
      let actualList = selectedList.list;
      if (selectedList.isNew) {
        const newList = await this.createNewItem({ id: folderId }, 'list');
        if (!newList) return { selectedTask: null, parentTask: null };
        actualList = newList;
      }
      // Continue to task selection
      return await this.selectTask(range, actualList.id);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select list: ${error}`);
      return { selectedTask: null, parentTask: null };
    }
  }

  /**
   * Get and select task for a given list, then proceed to subtasks
   */
  async selectTask(
    range: vscode.Range,
    listId: string,
    currentTaskId?: string
  ): Promise<{ selectedTask: any, parentTask: any }> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return { selectedTask: null, parentTask: null };
    try {
      const tasks = await this.clickUpService.getTasks(listId);
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
      if (!selectedTask) return { selectedTask: null, parentTask: null };
      let actualTask = selectedTask.task;
      if (selectedTask.isNew) {
        const newTask = await this.createNewItem({ id: listId }, 'task');
        if (!newTask) return { selectedTask: null, parentTask: null };
        actualTask = newTask;
      }
      
      // Continue to subtask selection
      return await this.selectSubtask(range, actualTask, listId);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select task: ${error}`);
      return { selectedTask: null, parentTask: null };
    }
  }

  /**
   * Get and select subtask for a given task (optional)
   */
  async selectSubtask(
    range: vscode.Range,
    parentTask: any,
    parentListId: string
  ): Promise<{ selectedTask: any, parentTask: any }> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return { selectedTask: null, parentTask: null };
    try {
      const subtasks = await this.clickUpService.getSubtasksFromParentList(
        parentTask.id,
        parentListId
      );
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
      if (!selectedSubtask) {
        // User cancelled: use main task
        return { selectedTask: parentTask, parentTask: null };
      }
      let actualSubtask = selectedSubtask.subtask;
      if (selectedSubtask.isNew) {
        actualSubtask = await this.createNewItem(parentTask, 'subtask');
        if (!actualSubtask) return { selectedTask: null, parentTask: null };
      }
      // Return the selected/created subtask and its parent
      return { selectedTask: actualSubtask, parentTask };
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select subtask: ${error}`);
      return { selectedTask: null, parentTask: null };
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

  //used when editing task reference from the folder level down
  async changeFolder(
    range: vscode.Range,
    currentFolderId: string,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const { selectedTask, parentTask } = await this.selectFolder(range, currentFolderId);
    if (!selectedTask) return;

    const newReference = await this.taskRefBuilder.build(selectedTask, parentTask, range);
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      saveTaskReference(editor.document.uri.toString(), newReference);
      await ClickUpCodeLensDebug.updateAnchor(range, selectedTask.id);
      fireChangeEvent();
    }
  }

  async changeList(
    range: vscode.Range,
    folderId: string,
    currentListId: string,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const { selectedTask, parentTask } = await this.selectList(range, folderId, currentListId);
    if (!selectedTask) return;

    const newReference = await this.taskRefBuilder.build(selectedTask, parentTask, range);
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      saveTaskReference(editor.document.uri.toString(), newReference);
      await ClickUpCodeLensDebug.updateAnchor(range, selectedTask.id);
      fireChangeEvent();
    }
  }

  async changeTask(
    range: vscode.Range,
    listId: string,
    currentTaskId: string,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const { selectedTask, parentTask } = await this.selectTask(range, listId, currentTaskId);
    if (!selectedTask) return;

    const newReference = await this.taskRefBuilder.build(selectedTask, parentTask, range);
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      saveTaskReference(editor.document.uri.toString(), newReference);
      await ClickUpCodeLensDebug.updateAnchor(range, selectedTask.id);
      fireChangeEvent();
    }
  }

  async changeSubtask(
    range: vscode.Range,
    listId: string,
    parentTaskId: string,
    subtaskId: string,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const parentTask = await this.clickUpService.getTaskDetails(parentTaskId);
    if (!parentTask) {
      vscode.window.showErrorMessage('Could not find parent task for subtask selection');
      return;
    }
    const { selectedTask } = await this.selectSubtask(range, parentTask, listId);
    if (!selectedTask) return;

    const newReference = await this.taskRefBuilder.build(selectedTask, parentTask, range);
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      saveTaskReference(editor.document.uri.toString(), newReference);
      await ClickUpCodeLensDebug.updateAnchor(range, selectedTask.id);
      fireChangeEvent();
    }
  }
}
