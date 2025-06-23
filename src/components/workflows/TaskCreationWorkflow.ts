import * as vscode from 'vscode';
import { Task, Project, Folder, List } from '../../types/navigationTypes';
import { ProjectNavigator } from '../navigation/ProjectNavigator';
import { FolderNavigator } from '../navigation/FolderNavigator';
import { ListNavigator } from '../navigation/ListNavigator';
import { CreateDialog, CreateDialogField } from '../ui/CreateDialog';

export interface TaskCreationData {
  name: string;
  description?: string;
  priority?: string;
  assignees?: string[];
  dueDate?: Date;
  tags?: string[];
  status?: string;
}

export interface CreationContext {
  selectedText?: string;
  projectId?: string;
  folderId?: string;
  listId?: string;
  document?: vscode.TextDocument;
  position?: vscode.Position;
}

/**
 * Workflow for creating new ClickUp tasks
 */
export class TaskCreationWorkflow {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Create a new task with full workflow
   */
  public async createTask(initialData?: Partial<TaskCreationData>, creationContext?: CreationContext): Promise<Task | undefined> {
    try {
      // Step 1: Select where to create the task
      const location = await this.selectTaskLocation(creationContext);
      if (!location) {
        return undefined; // User cancelled
      }

      // Step 2: Gather task information
      const taskData = await this.gatherTaskInformation(initialData, creationContext);
      if (!taskData) {
        return undefined; // User cancelled
      }

      // Step 3: Create the task
      const createdTask = await this.createTaskInList(location.listId, taskData);
      
      if (createdTask) {
        await this.handlePostCreation(createdTask, creationContext);
        vscode.window.showInformationMessage(`Task created: ${createdTask.name}`);
      }

      return createdTask;

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create task: ${error}`);
      return undefined;
    }
  }

  /**
   * Create task in specific list
   */
  public async createTaskInList(listId: string, taskData?: TaskCreationData): Promise<Task | undefined> {
    try {
      const data = taskData || await this.gatherTaskInformation();
      if (!data) {
        return undefined;
      }

      const { useCRUD } = await import('../../hooks/useCRUD');
      const crud = useCRUD(this.context);
      
      // Create the task using CRUD operations
      const newTask = await crud.createTask(listId, {
        name: data.name,
        description: data.description,
        listId,
        status: data.status || 'open',
        priority: data.priority ? { priority: data.priority, color: this.getPriorityColor(data.priority) } : undefined,
        assignees: data.assignees || [],
        dueDate: data.dueDate ? data.dueDate.getTime() : undefined,
        tags: data.tags || []
      } as Omit<Task, 'id'>);

      return newTask;

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create task in list: ${error}`);
      return undefined;
    }
  }

  /**
   * Quick task creation from selected text
   */
  public async createQuickTask(): Promise<Task | undefined> {
    const editor = vscode.window.activeTextEditor;
    const selectedText = editor && !editor.selection.isEmpty 
      ? editor.document.getText(editor.selection)
      : undefined;

    const creationContext: CreationContext = {
      selectedText,
      document: editor?.document,
      position: editor?.selection.active
    };

    // Use selected text as task name if available
    const initialData: Partial<TaskCreationData> = selectedText 
      ? { name: selectedText.substring(0, 100) } // Limit length
      : {};

    return await this.createTask(initialData, creationContext);
  }

  /**
   * Select location for task creation
   */
  private async selectTaskLocation(context?: CreationContext): Promise<{
    projectId: string;
    folderId?: string;
    listId: string;
  } | undefined> {
    // If context provides specific location, use it
    if (context?.listId) {
      return {
        projectId: context.projectId!,
        folderId: context.folderId,
        listId: context.listId
      };
    }

    // Step 1: Select Project
    const projectNavigator = ProjectNavigator.getInstance(this.context);
    const project = await projectNavigator.navigateToProject();
    
    if (!project) {
      return undefined;
    }

    // Step 2: Select Folder (optional)
    const folderNavigator = FolderNavigator.getInstance(this.context, project.id);
    const folders = await folderNavigator.loadItems();
    
    let selectedFolder: Folder | undefined;
    if (folders.length > 0) {
      const choice = await vscode.window.showQuickPick([
        { label: 'Select a folder', value: 'folder' },
        { label: 'Skip folder selection', value: 'skip' }
      ], {
        title: 'Folder Selection',
        placeHolder: 'Do you want to select a specific folder?'
      });

      if (!choice) {
        return undefined;
      }

      if (choice.value === 'folder') {
        selectedFolder = await folderNavigator.navigateToFolder();
        if (!selectedFolder) {
          return undefined;
        }
      }
    }

    // Step 3: Select List
    const folderId = selectedFolder?.id || 'no-folder';
    const listNavigator = ListNavigator.getInstance(this.context, folderId, project.id);
    const lists = await listNavigator.loadItems();
    
    if (lists.length === 0) {
      vscode.window.showWarningMessage('No lists found. Please create a list first.');
      return undefined;
    }

    const selectedList = await listNavigator.navigateToList();
    if (!selectedList) {
      return undefined;
    }

    return {
      projectId: project.id,
      folderId: selectedFolder?.id,
      listId: selectedList.id
    };
  }

  /**
   * Gather task information from user
   */
  private async gatherTaskInformation(
    initialData?: Partial<TaskCreationData>,
    context?: CreationContext
  ): Promise<TaskCreationData | undefined> {
    const fields: CreateDialogField[] = [
      {
        name: 'name',
        label: 'Task Name',
        type: 'text',
        placeholder: 'Enter task name...',
        defaultValue: initialData?.name || context?.selectedText || '',
        required: true,
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Task name is required';
          }
          if (value.length > 200) {
            return 'Task name is too long (max 200 characters)';
          }
          return undefined;
        }
      },
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        placeholder: 'Enter task description (optional)...',
        defaultValue: initialData?.description || '',
        required: false
      },
      {
        name: 'priority',
        label: 'Priority',
        type: 'dropdown',
        options: ['Low', 'Medium', 'High', 'Urgent'],
        defaultValue: initialData?.priority || 'Medium',
        required: false
      },
      {
        name: 'status',
        label: 'Initial Status',
        type: 'dropdown',
        options: ['Open', 'Todo', 'In Progress', 'In Review'],
        defaultValue: initialData?.status || 'Open',
        required: false
      }
    ];

    try {
      const result = await CreateDialog.show({
        title: 'Create New Task',
        fields,
        totalSteps: fields.length
      });

      if (!result) {
        return undefined; // User cancelled
      }

      // Process tags if provided
      let tags: string[] = [];
      if (result.tags && typeof result.tags === 'string') {
        tags = result.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      }

      // Process due date if provided
      let dueDate: Date | undefined;
      if (result.dueDate && typeof result.dueDate === 'string') {
        const parsed = new Date(result.dueDate);
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed;
        }
      }

      return {
        name: result.name as string,
        description: result.description as string || undefined,
        priority: result.priority as string || undefined,
        status: result.status as string || undefined,
        tags,
        dueDate
      };

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to gather task information: ${error}`);
      return undefined;
    }
  }

  /**
   * Handle post-creation actions
   */
  private async handlePostCreation(task: Task, context?: CreationContext): Promise<void> {
    const actions = [
      'Open in ClickUp',
      'Insert Reference',
      'Create Another Task',
      'Done'
    ];

    const selected = await vscode.window.showQuickPick(actions, {
      title: 'Task Created Successfully',
      placeHolder: 'What would you like to do next?'
    });

    switch (selected) {
      case 'Open in ClickUp':
        await this.openTaskInBrowser(task);
        break;
      case 'Insert Reference':
        await this.insertTaskReference(task, context);
        break;
      case 'Create Another Task':
        await this.createTask(undefined, context);
        break;
      case 'Done':
      default:
        // Do nothing
        break;
    }
  }

  /**
   * Open task in browser
   */
  private async openTaskInBrowser(task: Task): Promise<void> {
    const url = `https://app.clickup.com/t/${task.id}`;
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  /**
   * Insert task reference at current position
   */
  private async insertTaskReference(task: Task, context?: CreationContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const position = context?.position || editor.selection.active;
    const reference = `clickup:${task.id}`;

    const edit = new vscode.WorkspaceEdit();
    edit.insert(editor.document.uri, position, reference);

    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
      vscode.window.showInformationMessage('Task reference inserted');
    }
  }

  /**
   * Create task template
   */
  public async createTaskFromTemplate(): Promise<Task | undefined> {
    const templates = await this.getTaskTemplates();
    
    if (templates.length === 0) {
      vscode.window.showInformationMessage('No task templates found');
      return await this.createTask();
    }

    const selectedTemplate = await vscode.window.showQuickPick(
      templates.map(template => ({
        label: template.name,
        description: template.description,
        template
      })),
      {
        title: 'Select Task Template',
        placeHolder: 'Choose a template or create custom task...'
      }
    );

    if (!selectedTemplate) {
      return undefined;
    }

    return await this.createTask(selectedTemplate.template.data);
  }

  /**
   * Get available task templates
   */
  private async getTaskTemplates(): Promise<Array<{
    name: string;
    description: string;
    data: Partial<TaskCreationData>;
  }>> {
    // This could be loaded from configuration or a templates file
    return [
      {
        name: 'Bug Report',
        description: 'Template for reporting bugs',
        data: {
          name: 'Bug: ',
          description: 'Steps to reproduce:\n1. \n2. \n3. \n\nExpected behavior:\n\nActual behavior:',
          priority: 'High',
          status: 'Open',
          tags: ['bug']
        }
      },
      {
        name: 'Feature Request',
        description: 'Template for new features',
        data: {
          name: 'Feature: ',
          description: 'User story:\nAs a...\nI want...\nSo that...\n\nAcceptance criteria:\n- \n- ',
          priority: 'Medium',
          status: 'Open',
          tags: ['feature', 'enhancement']
        }
      },
      {
        name: 'Research Task',
        description: 'Template for research tasks',
        data: {
          name: 'Research: ',
          description: 'Research objective:\n\nKey questions:\n- \n- \n\nDeliverables:\n- ',
          priority: 'Medium',
          status: 'Open',
          tags: ['research']
        }
      }
    ];
  }

  /**
   * Get priority color
   */
  private getPriorityColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return '#ff0000';
      case 'high':
        return '#ff6b6b';
      case 'medium':
        return '#ffd93d';
      case 'low':
        return '#6bcf7f';
      default:
        return '#95a5a6';
    }
  }

  /**
   * Bulk task creation
   */
  public async createMultipleTasks(): Promise<Task[]> {
    const input = await vscode.window.showInputBox({
      title: 'Bulk Task Creation',
      prompt: 'Enter task names (one per line)',
      placeHolder: 'Task 1\nTask 2\nTask 3...',
      ignoreFocusOut: true
    });

    if (!input) {
      return [];
    }

    const taskNames = input.split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (taskNames.length === 0) {
      return [];
    }

    // Select location once for all tasks
    const location = await this.selectTaskLocation();
    if (!location) {
      return [];
    }

    const createdTasks: Task[] = [];
    
    for (const name of taskNames) {
      try {
        const task = await this.createTaskInList(location.listId, { name });
        if (task) {
          createdTasks.push(task);
        }
      } catch (error) {
        console.error(`Failed to create task "${name}":`, error);
      }
    }

    if (createdTasks.length > 0) {
      vscode.window.showInformationMessage(`Created ${createdTasks.length} tasks`);
    }

    return createdTasks;
  }
}
