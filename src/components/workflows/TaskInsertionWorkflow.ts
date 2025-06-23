import * as vscode from 'vscode';
import { Task, Project, Folder, List } from '../../types/navigationTypes';
import { ProjectNavigator } from '../navigation/ProjectNavigator';
import { FolderNavigator } from '../navigation/FolderNavigator';
import { ListNavigator } from '../navigation/ListNavigator';
import { TaskNavigator } from '../navigation/TaskNavigator';
import { useNavigation } from '../../hooks/useNavigation';

export interface TaskInsertionOptions {
  insertFormat: 'reference' | 'link' | 'mention';
  includeStatus: boolean;
  includePriority: boolean;
  replaceSelection: boolean;
}

export interface InsertionContext {
  document: vscode.TextDocument;
  position: vscode.Position;
  selectedText?: string;
  replaceRange?: vscode.Range;
}

/**
 * Workflow for inserting task references into documents
 */
export class TaskInsertionWorkflow {
  private context: vscode.ExtensionContext;
  private options: TaskInsertionOptions;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.options = {
      insertFormat: 'reference',
      includeStatus: true,
      includePriority: false,
      replaceSelection: false
    };

    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('clickupLink.insertion');
    
    this.options = {
      insertFormat: config.get('insertFormat', 'reference') as 'reference' | 'link' | 'mention',
      includeStatus: config.get('includeStatus', true),
      includePriority: config.get('includePriority', false),
      replaceSelection: config.get('replaceSelection', false)
    };
  }

  /**
   * Insert task at current cursor position
   */
  public async insertTaskAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const position = editor.selection.active;
    const selectedText = editor.selection.isEmpty ? undefined : editor.document.getText(editor.selection);

    const context: InsertionContext = {
      document: editor.document,
      position,
      selectedText,
      replaceRange: editor.selection.isEmpty ? undefined : editor.selection
    };

    await this.insertTaskAtPosition(context.document, context.position, context);
  }

  /**
   * Insert task at specific position
   */
  public async insertTaskAtPosition(
    document: vscode.TextDocument, 
    position: vscode.Position,
    context?: InsertionContext
  ): Promise<void> {
    try {
      // Navigate through the hierarchy to select a task
      const selectedTask = await this.selectTaskThroughNavigation();
      
      if (!selectedTask) {
        return; // User cancelled selection
      }

      // Insert the task reference
      await this.insertTaskReference(selectedTask, context || {
        document,
        position
      });

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to insert task: ${error}`);
    }
  }

  /**
   * Browse and insert task with quick search
   */
  public async browseAndInsertTask(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    try {
      // Show quick search for tasks
      const task = await this.quickSearchTasks();
      
      if (!task) {
        return; // User cancelled
      }

      const context: InsertionContext = {
        document: editor.document,
        position: editor.selection.active,
        selectedText: editor.selection.isEmpty ? undefined : editor.document.getText(editor.selection),
        replaceRange: editor.selection.isEmpty ? undefined : editor.selection
      };

      await this.insertTaskReference(task, context);

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to browse tasks: ${error}`);
    }
  }

  /**
   * Select task through hierarchical navigation
   */
  public async selectTask(): Promise<Task | undefined> {
    return await this.selectTaskThroughNavigation();
  }

  /**
   * Navigate through project hierarchy to select a task
   */
  private async selectTaskThroughNavigation(): Promise<Task | undefined> {
    try {
      // Step 1: Select Project
      const projectNavigator = ProjectNavigator.getInstance(this.context);
      const project = await projectNavigator.navigateToProject();
      
      if (!project) {
        return undefined; // User cancelled
      }

      // Step 2: Select Folder (if any exist)
      const folderNavigator = FolderNavigator.getInstance(this.context, project.id);
      const folders = await folderNavigator.loadItems();
      
      let selectedFolder: Folder | undefined;
      if (folders.length > 0) {
        selectedFolder = await folderNavigator.navigateToFolder();
        if (!selectedFolder) {
          return undefined; // User cancelled
        }
      }

      // Step 3: Select List
      const folderId = selectedFolder?.id || 'no-folder'; // Some projects have lists without folders
      const listNavigator = ListNavigator.getInstance(this.context, folderId, project.id);
      const lists = await listNavigator.loadItems();
      
      if (lists.length === 0) {
        vscode.window.showWarningMessage('No lists found in the selected folder/project');
        return undefined;
      }

      const selectedList = await listNavigator.navigateToList();
      if (!selectedList) {
        return undefined; // User cancelled
      }

      // Step 4: Select Task
      const taskNavigator = TaskNavigator.getInstance(this.context, selectedList.id);
      const tasks = await taskNavigator.loadItems();
      
      if (tasks.length === 0) {
        // Offer to create a new task
        const create = await vscode.window.showInformationMessage(
          'No tasks found in the selected list. Would you like to create a new task?',
          'Create Task', 'Cancel'
        );
        
        if (create === 'Create Task') {
          const { TaskCreationWorkflow } = await import('./TaskCreationWorkflow');
          const creationWorkflow = new TaskCreationWorkflow(this.context);
          return await creationWorkflow.createTaskInList(selectedList.id);
        }
        
        return undefined;
      }

      const selectedTask = await taskNavigator.navigateToTask();
      return selectedTask;

    } catch (error) {
      vscode.window.showErrorMessage(`Navigation failed: ${error}`);
      return undefined;
    }
  }

  /**
   * Quick search for tasks across all projects
   */
  private async quickSearchTasks(): Promise<Task | undefined> {
    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { task: Task }>();
    quickPick.title = 'Search ClickUp Tasks';
    quickPick.placeholder = 'Type to search tasks...';
    quickPick.busy = true;

    // Initial load of recent/popular tasks
    quickPick.show();
    
    try {
      const { useCache } = await import('../../hooks/useCache');
      const cache = useCache(this.context);
      
      // Load all tasks from cache (this could be optimized)
      const allTasks: Task[] = [];
      const projects = await cache.getProjects();
      
      for (const project of projects.slice(0, 5)) { // Limit to first 5 projects for performance
        try {
          const folders = await cache.getFolders(project.id);
          
          for (const folder of folders.slice(0, 3)) { // Limit folders
            try {
              const lists = await cache.getLists(folder.id, project.id);
              
              for (const list of lists.slice(0, 5)) { // Limit lists
                try {
                  const tasks = await cache.getTasks(list.id);
                  allTasks.push(...tasks.slice(0, 10)); // Limit tasks per list
                } catch (error) {
                  console.warn(`Failed to load tasks for list ${list.id}:`, error);
                }
              }
            } catch (error) {
              console.warn(`Failed to load lists for folder ${folder.id}:`, error);
            }
          }
        } catch (error) {
          console.warn(`Failed to load folders for project ${project.id}:`, error);
        }
      }

      quickPick.busy = false;
      
      // Create quick pick items
      const items = allTasks.map(task => ({
        label: `${this.getStatusEmoji(task.status)} ${task.name}`,
        description: task.description || '',
        detail: this.getTaskDetails(task),
        task
      }));

      quickPick.items = items;

      // Handle search filtering
      quickPick.onDidChangeValue(value => {
        if (value.length < 2) {
          quickPick.items = items;
          return;
        }

        const filtered = items.filter(item => 
          item.label.toLowerCase().includes(value.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(value.toLowerCase()))
        );

        quickPick.items = filtered;
      });

      // Handle selection
      return new Promise<Task | undefined>((resolve) => {
        quickPick.onDidAccept(() => {
          const selected = quickPick.selectedItems[0];
          quickPick.dispose();
          resolve(selected?.task);
        });

        quickPick.onDidHide(() => {
          quickPick.dispose();
          resolve(undefined);
        });
      });

    } catch (error) {
      quickPick.dispose();
      throw error;
    }
  }

  /**
   * Insert task reference into document
   */
  private async insertTaskReference(task: Task, context: InsertionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== context.document) {
      vscode.window.showWarningMessage('Editor context has changed');
      return;
    }

    const edit = new vscode.WorkspaceEdit();
    const insertText = this.formatTaskReference(task);

    if (context.replaceRange && this.options.replaceSelection) {
      // Replace selected text
      edit.replace(context.document.uri, context.replaceRange, insertText);
    } else {
      // Insert at position
      edit.insert(context.document.uri, context.position, insertText);
    }

    const success = await vscode.workspace.applyEdit(edit);
    
    if (success) {
      vscode.window.showInformationMessage(`Inserted task reference: ${task.name}`);
    } else {
      vscode.window.showErrorMessage('Failed to insert task reference');
    }
  }

  /**
   * Format task reference based on options
   */
  private formatTaskReference(task: Task): string {
    switch (this.options.insertFormat) {
      case 'reference':
        return this.formatAsReference(task);
      case 'link':
        return this.formatAsLink(task);
      case 'mention':
        return this.formatAsMention(task);
      default:
        return this.formatAsReference(task);
    }
  }

  /**
   * Format as clickup:taskId reference
   */
  private formatAsReference(task: Task): string {
    let text = `clickup:${task.id}`;
    
    if (this.options.includeStatus) {
      const statusEmoji = this.getStatusEmoji(task.status);
      text += ` ${statusEmoji}`;
    }
    
    return text;
  }

  /**
   * Format as markdown link
   */
  private formatAsLink(task: Task): string {
    const url = `https://app.clickup.com/t/${task.id}`;
    let linkText = task.name;
    
    if (this.options.includeStatus) {
      const statusEmoji = this.getStatusEmoji(task.status);
      linkText = `${statusEmoji} ${linkText}`;
    }
    
    if (this.options.includePriority && task.priority) {
      const priorityEmoji = this.getPriorityEmoji(task.priority.priority);
      linkText = `${priorityEmoji} ${linkText}`;
    }
    
    return `[${linkText}](${url})`;
  }

  /**
   * Format as @mention style
   */
  private formatAsMention(task: Task): string {
    let text = `@${task.name.replace(/\s+/g, '')}`;
    
    if (this.options.includeStatus) {
      const statusEmoji = this.getStatusEmoji(task.status);
      text += ` ${statusEmoji}`;
    }
    
    return text;
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status?: string | { status: string }): string {
    const statusText = typeof status === 'string' ? status : status?.status || '';
    
    switch (statusText.toLowerCase()) {
      case 'complete':
      case 'closed':
      case 'done':
        return '✅';
      case 'in progress':
      case 'active':
        return '🔄';
      case 'blocked':
        return '⚠️';
      case 'in review':
        return '👀';
      default:
        return '📋';
    }
  }

  /**
   * Get priority emoji
   */
  private getPriorityEmoji(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return '🚨';
      case 'high':
        return '🔴';
      case 'medium':
      case 'normal':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  }

  /**
   * Get task details for quick pick
   */
  private getTaskDetails(task: Task): string {
    const parts = [];
    
    if (task.status) {
      const statusText = typeof task.status === 'string' ? task.status : task.status.status;
      parts.push(`Status: ${statusText}`);
    }
    
    if (task.priority) {
      parts.push(`Priority: ${task.priority.priority}`);
    }
    
    if (task.assignees && task.assignees.length > 0) {
      parts.push(`Assignees: ${task.assignees.length}`);
    }
    
    return parts.join(' • ');
  }

  /**
   * Update insertion options
   */
  public updateOptions(newOptions: Partial<TaskInsertionOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  public getOptions(): TaskInsertionOptions {
    return { ...this.options };
  }
}
