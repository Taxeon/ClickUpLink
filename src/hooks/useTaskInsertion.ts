import * as vscode from 'vscode';
import { Task } from '../types/navigationTypes';
import { TaskInsertionWorkflow, TaskInsertionOptions } from '../components/workflows/TaskInsertionWorkflow';
import { TaskCreationWorkflow, TaskCreationData } from '../components/workflows/TaskCreationWorkflow';

export interface TaskInsertionHook {
  insertAtCursor: () => Promise<void>;
  insertAtPosition: (document: vscode.TextDocument, position: vscode.Position) => Promise<void>;
  browseAndInsert: () => Promise<void>;
  selectTask: () => Promise<Task | undefined>;
  quickInsert: (query?: string) => Promise<void>;
  replaceWithTask: () => Promise<void>;
  convertSelectionToTask: () => Promise<void>;
  options: TaskInsertionOptions;
  updateOptions: (newOptions: Partial<TaskInsertionOptions>) => void;
}

export interface TaskCreationHook {
  createTask: (data?: Partial<TaskCreationData>) => Promise<Task | undefined>;
  createQuickTask: () => Promise<Task | undefined>;
  createFromTemplate: () => Promise<Task | undefined>;
  createMultiple: () => Promise<Task[]>;
  createInList: (listId: string, data?: TaskCreationData) => Promise<Task | undefined>;
}

export interface InsertionStats {
  totalInsertions: number;
  recentInsertions: Array<{
    task: Task;
    timestamp: number;
    document: string;
    position: vscode.Position;
  }>;
  favoriteFormats: Record<string, number>;
  mostUsedTasks: Record<string, number>;
}

/**
 * React-inspired hook for task insertion functionality
 */
export function useTaskInsertion(context?: vscode.ExtensionContext): TaskInsertionHook {
  if (!context) {
    // Get from global extension context
    context = (global as any).extensionContext;
    
    if (!context) {
      throw new Error('Extension context is required for useTaskInsertion hook');
    }
  }

  const workflow = new TaskInsertionWorkflow(context);
  let currentOptions = workflow.getOptions();

  /**
   * Insert task at current cursor position
   */
  const insertAtCursor = async (): Promise<void> => {
    await workflow.insertTaskAtCursor();
    updateStats('insertAtCursor');
  };

  /**
   * Insert task at specific position
   */
  const insertAtPosition = async (
    document: vscode.TextDocument, 
    position: vscode.Position
  ): Promise<void> => {
    await workflow.insertTaskAtPosition(document, position);
    updateStats('insertAtPosition');
  };

  /**
   * Browse tasks and insert selected one
   */
  const browseAndInsert = async (): Promise<void> => {
    await workflow.browseAndInsertTask();
    updateStats('browseAndInsert');
  };

  /**
   * Select task through navigation workflow
   */
  const selectTask = async (): Promise<Task | undefined> => {
    return await workflow.selectTask();
  };

  /**
   * Quick insert with search
   */
  const quickInsert = async (query?: string): Promise<void> => {
    if (query) {
      // Use query to filter tasks
      await workflow.browseAndInsertTask();
    } else {
      await workflow.insertTaskAtCursor();
    }
    updateStats('quickInsert');
  };

  /**
   * Replace current word with task reference
   */
  const replaceWithTask = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const position = editor.selection.active;
    const wordRange = editor.document.getWordRangeAtPosition(position);
    
    if (wordRange) {
      const selectedText = editor.document.getText(wordRange);
      
      // Use workflow to select and replace
      const task = await workflow.selectTask();
      if (task) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, wordRange, `clickup:${task.id}`);
        await vscode.workspace.applyEdit(edit);
        
        vscode.window.showInformationMessage(`Replaced "${selectedText}" with task reference`);
        updateStats('replaceWithTask');
      }
    }
  };

  /**
   * Convert selection to task
   */
  const convertSelectionToTask = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showWarningMessage('Please select text to convert to a task');
      return;
    }

    const selectedText = editor.document.getText(editor.selection);
    
    // Create new task with selected text as name
    const creationWorkflow = new TaskCreationWorkflow(context!);
    const task = await creationWorkflow.createTask({ name: selectedText });
    
    if (task) {
      // Replace selection with task reference
      const edit = new vscode.WorkspaceEdit();
      edit.replace(editor.document.uri, editor.selection, `clickup:${task.id}`);
      await vscode.workspace.applyEdit(edit);
      
      vscode.window.showInformationMessage(`Created task and inserted reference: ${task.name}`);
      updateStats('convertSelectionToTask');
    }
  };

  /**
   * Update insertion options
   */
  const updateOptions = (newOptions: Partial<TaskInsertionOptions>): void => {
    workflow.updateOptions(newOptions);
    currentOptions = workflow.getOptions();
  };

  /**
   * Update usage statistics
   */
  const updateStats = (action: string): void => {
    // This would update internal statistics
    console.log(`Task insertion action: ${action}`);
  };

  return {
    insertAtCursor,
    insertAtPosition,
    browseAndInsert,
    selectTask,
    quickInsert,
    replaceWithTask,
    convertSelectionToTask,
    options: currentOptions,
    updateOptions
  };
}

/**
 * Hook for task creation functionality
 */
export function useTaskCreation(context?: vscode.ExtensionContext): TaskCreationHook {
  if (!context) {
    context = (global as any).extensionContext;
    
    if (!context) {
      throw new Error('Extension context is required for useTaskCreation hook');
    }
  }

  const workflow = new TaskCreationWorkflow(context);

  /**
   * Create new task with full workflow
   */
  const createTask = async (data?: Partial<TaskCreationData>): Promise<Task | undefined> => {
    return await workflow.createTask(data);
  };

  /**
   * Quick task creation
   */
  const createQuickTask = async (): Promise<Task | undefined> => {
    return await workflow.createQuickTask();
  };

  /**
   * Create task from template
   */
  const createFromTemplate = async (): Promise<Task | undefined> => {
    return await workflow.createTaskFromTemplate();
  };

  /**
   * Create multiple tasks
   */
  const createMultiple = async (): Promise<Task[]> => {
    return await workflow.createMultipleTasks();
  };

  /**
   * Create task in specific list
   */
  const createInList = async (listId: string, data?: TaskCreationData): Promise<Task | undefined> => {
    return await workflow.createTaskInList(listId, data);
  };

  return {
    createTask,
    createQuickTask,
    createFromTemplate,
    createMultiple,
    createInList
  };
}

/**
 * Hook for advanced task insertion with templates and shortcuts
 */
export function useAdvancedTaskInsertion(context?: vscode.ExtensionContext) {
  const insertionHook = useTaskInsertion(context);
  const creationHook = useTaskCreation(context);

  const templates = {
    bug: {
      name: 'Bug: ',
      format: 'reference',
      includeStatus: true,
      includePriority: true
    },
    feature: {
      name: 'Feature: ',
      format: 'link',
      includeStatus: true,
      includePriority: false
    },
    task: {
      name: 'Task: ',
      format: 'reference',
      includeStatus: true,
      includePriority: false
    }
  };

  /**
   * Insert task with template
   */
  const insertWithTemplate = async (templateName: keyof typeof templates): Promise<void> => {
    const template = templates[templateName];
    
    // Update options based on template
    insertionHook.updateOptions({
      insertFormat: template.format as any,
      includeStatus: template.includeStatus,
      includePriority: template.includePriority
    });

    // Create task with template data
    const task = await creationHook.createTask({ name: template.name });
    
    if (task) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const position = editor.selection.active;
        await insertionHook.insertAtPosition(editor.document, position);
      }
    }
  };

  /**
   * Smart insertion based on context
   */
  const smartInsert = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const position = editor.selection.active;
    const line = document.lineAt(position.line);
    const text = line.text.toLowerCase();

    // Determine context and suggest appropriate action
    if (text.includes('bug') || text.includes('issue')) {
      await insertWithTemplate('bug');
    } else if (text.includes('feature') || text.includes('enhancement')) {
      await insertWithTemplate('feature');
    } else {
      await insertWithTemplate('task');
    }
  };

  /**
   * Batch insert tasks from list
   */
  const batchInsert = async (taskNames: string[]): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const edit = new vscode.WorkspaceEdit();
    let position = editor.selection.active;

    for (const taskName of taskNames) {
      // Create task
      const task = await creationHook.createTask({ name: taskName });
      
      if (task) {
        // Insert reference
        const reference = `clickup:${task.id}`;
        edit.insert(editor.document.uri, position, reference + '\n');
        
        // Move to next line
        position = new vscode.Position(position.line + 1, 0);
      }
    }

    await vscode.workspace.applyEdit(edit);
  };

  /**
   * Insert task list as markdown
   */
  const insertAsMarkdownList = async (tasks: Task[]): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const markdownList = tasks.map(task => {
      const status = typeof task.status === 'string' ? task.status : task.status?.status || '';
      const checkbox = status.toLowerCase() === 'complete' ? '[x]' : '[ ]';
      return `- ${checkbox} [${task.name}](https://app.clickup.com/t/${task.id})`;
    }).join('\n');

    const edit = new vscode.WorkspaceEdit();
    edit.insert(editor.document.uri, editor.selection.active, markdownList);
    await vscode.workspace.applyEdit(edit);
  };

  /**
   * Get insertion statistics
   */
  const getStats = (): InsertionStats => {
    // This would return real statistics from storage
    return {
      totalInsertions: 0,
      recentInsertions: [],
      favoriteFormats: {},
      mostUsedTasks: {}
    };
  };

  return {
    ...insertionHook,
    ...creationHook,
    insertWithTemplate,
    smartInsert,
    batchInsert,
    insertAsMarkdownList,
    getStats,
    templates
  };
}

/**
 * Hook for task insertion shortcuts and productivity features
 */
export function useTaskInsertionShortcuts(context?: vscode.ExtensionContext) {
  const advancedHook = useAdvancedTaskInsertion(context);

  const shortcuts = {
    'Ctrl+Shift+T': 'quickInsert',
    'Ctrl+Shift+B': 'insertBug',
    'Ctrl+Shift+F': 'insertFeature',
    'Ctrl+Shift+C': 'convertSelection',
    'Ctrl+Shift+R': 'replaceWord'
  };

  /**
   * Register keyboard shortcuts
   */
  const registerShortcuts = (): vscode.Disposable[] => {
    const disposables: vscode.Disposable[] = [];

    Object.entries(shortcuts).forEach(([shortcut, action]) => {
      const commandId = `clickupLink.shortcut.${action}`;
      
      disposables.push(
        vscode.commands.registerCommand(commandId, async () => {
          await executeShortcutAction(action);
        })
      );
    });

    return disposables;
  };

  /**
   * Execute shortcut action
   */
  const executeShortcutAction = async (action: string): Promise<void> => {
    switch (action) {
      case 'quickInsert':
        await advancedHook.quickInsert();
        break;
      case 'insertBug':
        await advancedHook.insertWithTemplate('bug');
        break;
      case 'insertFeature':
        await advancedHook.insertWithTemplate('feature');
        break;
      case 'convertSelection':
        await advancedHook.convertSelectionToTask();
        break;
      case 'replaceWord':
        await advancedHook.replaceWithTask();
        break;
    }
  };

  /**
   * Show shortcuts help
   */
  const showShortcutsHelp = async (): Promise<void> => {
    const items = Object.entries(shortcuts).map(([shortcut, action]) => ({
      label: shortcut,
      description: action.replace(/([A-Z])/g, ' $1').toLowerCase(),
      action
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: 'Task Insertion Shortcuts',
      placeHolder: 'Select a shortcut to execute or view help'
    });

    if (selected) {
      await executeShortcutAction(selected.action);
    }
  };

  return {
    ...advancedHook,
    registerShortcuts,
    executeShortcutAction,
    showShortcutsHelp,
    shortcuts
  };
}
