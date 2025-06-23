import * as vscode from 'vscode';
import { Task } from '../../types/navigationTypes';

export interface InteractionEvent {
  type: 'click' | 'hover' | 'key' | 'context-menu';
  position: vscode.Position;
  task?: Task;
  taskId?: string;
  element?: 'task' | 'status' | 'priority' | 'assignee' | 'link';
  data?: any;
}

export interface InteractionHandlerOptions {
  enableClickHandling: boolean;
  enableHoverHandling: boolean;
  enableKeyboardShortcuts: boolean;
  enableContextMenu: boolean;
  doubleClickDelay: number;
}

/**
 * Handles user interactions with inline task elements
 */
export class InteractionHandler implements vscode.Disposable {
  private static instance: InteractionHandler;
  private context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];
  private options: InteractionHandlerOptions;
  private lastClickTime: number = 0;
  private lastClickPosition?: vscode.Position;
  
  // Webview panels for rich interactions
  private taskDetailPanels: Map<string, vscode.WebviewPanel> = new Map();

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.options = {
      enableClickHandling: true,
      enableHoverHandling: true,
      enableKeyboardShortcuts: true,
      enableContextMenu: true,
      doubleClickDelay: 300
    };

    this.initialize();
  }

  static getInstance(context: vscode.ExtensionContext): InteractionHandler {
    if (!InteractionHandler.instance) {
      InteractionHandler.instance = new InteractionHandler(context);
    }
    return InteractionHandler.instance;
  }

  private initialize(): void {
    this.loadConfiguration();
    this.registerCommands();
    this.setupEventListeners();
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('clickupLink.interactions');
    
    this.options = {
      enableClickHandling: config.get('enableClickHandling', true),
      enableHoverHandling: config.get('enableHoverHandling', true),
      enableKeyboardShortcuts: config.get('enableKeyboardShortcuts', true),
      enableContextMenu: config.get('enableContextMenu', true),
      doubleClickDelay: config.get('doubleClickDelay', 300)
    };
  }

  private registerCommands(): void {
    // Register interaction commands
    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.handleTaskClick', async (taskId: string, position?: vscode.Position) => {
        await this.handleTaskClick(taskId, position);
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.handleStatusClick', async (taskId: string, currentStatus: string) => {
        await this.handleStatusClick(taskId, currentStatus);
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.openTaskDetails', async (taskId: string) => {
        await this.openTaskDetails(taskId);
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.markTaskComplete', async (taskId: string) => {
        await this.markTaskComplete(taskId);
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.startTaskProgress', async (taskId: string) => {
        await this.startTaskProgress(taskId);
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.copyTaskLink', async (taskId: string) => {
        await this.copyTaskLink(taskId);
      })
    );
  }

  private setupEventListeners(): void {
    // Listen for editor clicks
    if (this.options.enableClickHandling) {
      this.disposables.push(
        vscode.window.onDidChangeTextEditorSelection(event => {
          this.handleSelectionChange(event);
        })
      );
    }

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('clickupLink.interactions')) {
          this.loadConfiguration();
        }
      })
    );
  }

  /**
   * Handle selection changes for click detection
   */
  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    if (!this.options.enableClickHandling) return;

    const selection = event.selections[0];
    if (selection && selection.isEmpty) {
      const position = selection.active;
      const now = Date.now();

      // Check for double-click
      if (this.lastClickPosition && 
          this.lastClickPosition.line === position.line &&
          this.lastClickPosition.character === position.character &&
          now - this.lastClickTime < this.options.doubleClickDelay) {
        
        this.handleDoubleClick(event.textEditor, position);
      } else {
        this.handleSingleClick(event.textEditor, position);
      }

      this.lastClickTime = now;
      this.lastClickPosition = position;
    }
  }

  /**
   * Handle single click events
   */
  private async handleSingleClick(editor: vscode.TextEditor, position: vscode.Position): Promise<void> {
    const taskInfo = await this.getTaskAtPosition(editor.document, position);
    if (!taskInfo) return;

    const event: InteractionEvent = {
      type: 'click',
      position,
      task: taskInfo.task,
      taskId: taskInfo.taskId,
      element: taskInfo.element
    };

    await this.processInteractionEvent(event);
  }

  /**
   * Handle double click events
   */
  private async handleDoubleClick(editor: vscode.TextEditor, position: vscode.Position): Promise<void> {
    const taskInfo = await this.getTaskAtPosition(editor.document, position);
    if (!taskInfo) return;

    // Double-click opens task details
    if (taskInfo.taskId) {
      await this.openTaskDetails(taskInfo.taskId);
    }
  }

  /**
   * Handle hover events
   */
  public async handleHover(task: Task, range: vscode.Range): Promise<void> {
    if (!this.options.enableHoverHandling) return;

    const event: InteractionEvent = {
      type: 'hover',
      position: range.start,
      task,
      taskId: task.id,
      element: 'task'
    };

    await this.processInteractionEvent(event);
  }

  /**
   * Process interaction events
   */
  private async processInteractionEvent(event: InteractionEvent): Promise<void> {
    switch (event.type) {
      case 'click':
        await this.handleClickEvent(event);
        break;
      case 'hover':
        await this.handleHoverEvent(event);
        break;
      case 'context-menu':
        await this.handleContextMenuEvent(event);
        break;
    }
  }

  /**
   * Handle click events
   */
  private async handleClickEvent(event: InteractionEvent): Promise<void> {
    if (!event.taskId) return;

    switch (event.element) {
      case 'status':
        await this.handleStatusClick(event.taskId, event.data?.currentStatus);
        break;
      case 'task':
        await this.handleTaskClick(event.taskId, event.position);
        break;
      case 'link':
        await this.openTaskInBrowser(event.taskId);
        break;
      default:
        await this.showTaskQuickActions(event.taskId);
    }
  }

  /**
   * Handle hover events
   */
  private async handleHoverEvent(event: InteractionEvent): Promise<void> {
    // Hover events are typically handled by the hover provider
    // This can be used for additional hover-based interactions
  }

  /**
   * Handle context menu events
   */
  private async handleContextMenuEvent(event: InteractionEvent): Promise<void> {
    if (!event.taskId) return;

    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Task Actions';
    quickPick.placeholder = 'Select an action...';
    
    quickPick.items = [
      { label: '$(eye) View Details', description: 'Open task details panel' },
      { label: '$(globe) Open in ClickUp', description: 'Open task in web browser' },
      { label: '$(check) Mark Complete', description: 'Mark task as complete' },
      { label: '$(play) Start Progress', description: 'Set status to in progress' },
      { label: '$(copy) Copy Task Link', description: 'Copy task URL to clipboard' },
      { label: '$(edit) Edit Task', description: 'Edit task properties' }
    ];

    quickPick.onDidAccept(async () => {
      const selected = quickPick.selectedItems[0];
      if (!selected) return;

      switch (selected.label.split(' ')[1]) {
        case 'View':
          await this.openTaskDetails(event.taskId!);
          break;
        case 'Open':
          await this.openTaskInBrowser(event.taskId!);
          break;
        case 'Mark':
          await this.markTaskComplete(event.taskId!);
          break;
        case 'Start':
          await this.startTaskProgress(event.taskId!);
          break;
        case 'Copy':
          await this.copyTaskLink(event.taskId!);
          break;
        case 'Edit':
          await this.editTask(event.taskId!);
          break;
      }

      quickPick.dispose();
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  }

  /**
   * Get task information at a specific position
   */
  private async getTaskAtPosition(
    document: vscode.TextDocument, 
    position: vscode.Position
  ): Promise<{ task?: Task; taskId?: string; element?: 'task' | 'status' | 'priority' | 'assignee' | 'link' } | undefined> {
    // This would integrate with your trigger detection system
    const { TriggerDetector } = await import('../triggers/TriggerDetector');
    const triggerDetector = TriggerDetector.getInstance(this.context);
    
    const trigger = await triggerDetector.detectTaskReferenceAtPosition(document, position);
    if (trigger && trigger.taskId) {
      return {
        taskId: trigger.taskId,
        element: 'task'
      };
    }

    return undefined;
  }

  /**
   * Handle task click
   */
  public async handleTaskClick(taskId: string, position?: vscode.Position): Promise<void> {
    await this.showTaskQuickActions(taskId);
  }

  /**
   * Handle status click
   */
  public async handleStatusClick(taskId: string, currentStatus?: string): Promise<void> {
    const { StatusComponent } = await import('../decorations/StatusComponent');
    
    // Create a temporary status component for interaction
    const statusComponent = new StatusComponent({
      task: { id: taskId } as Task,
      currentStatus: currentStatus || 'unknown',
      availableStatuses: [
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in progress' },
        { label: 'In Review', value: 'in review' },
        { label: 'Complete', value: 'complete' }
      ],
      onStatusChange: async (newStatus) => {
        await this.updateTaskStatus(taskId, newStatus);
      },
      isEditable: true
    });

    statusComponent.startEditing();
  }

  /**
   * Open task details in webview panel
   */
  public async openTaskDetails(taskId: string): Promise<void> {
    // Check if panel already exists
    let panel = this.taskDetailPanels.get(taskId);
    
    if (panel) {
      panel.reveal();
      return;
    }

    // Create new webview panel
    panel = vscode.window.createWebviewPanel(
      'clickupTaskDetails',
      `Task Details: ${taskId}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'webviews')
        ]
      }
    );

    // Set up webview content
    panel.webview.html = await this.getTaskDetailsWebviewContent(taskId, panel.webview);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async message => {
      await this.handleWebviewMessage(taskId, message);
    });

    // Clean up when panel is disposed
    panel.onDidDispose(() => {
      this.taskDetailPanels.delete(taskId);
    });

    this.taskDetailPanels.set(taskId, panel);
  }

  /**
   * Get webview content for task details
   */
  private async getTaskDetailsWebviewContent(taskId: string, webview: vscode.Webview): Promise<string> {
    // This would load the React component
    // For now, return a simple HTML page
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Details</title>
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          .task-header { margin-bottom: 20px; }
          .task-title { font-size: 1.5em; font-weight: bold; }
          .task-status { color: var(--vscode-textLink-foreground); }
        </style>
      </head>
      <body>
        <div class="task-header">
          <div class="task-title">Task: ${taskId}</div>
          <div class="task-status">Loading task details...</div>
        </div>
        <div id="task-content">
          <!-- React component would be rendered here -->
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Handle messages from webview
   */
  private async handleWebviewMessage(taskId: string, message: any): Promise<void> {
    switch (message.command) {
      case 'updateStatus':
        await this.updateTaskStatus(taskId, message.status);
        break;
      case 'openInBrowser':
        await this.openTaskInBrowser(taskId);
        break;
      case 'copyLink':
        await this.copyTaskLink(taskId);
        break;
    }
  }

  /**
   * Show quick actions for a task
   */
  private async showTaskQuickActions(taskId: string): Promise<void> {
    const actions = [
      'View Details',
      'Open in ClickUp',
      'Mark Complete',
      'Start Progress',
      'Copy Link',
      'Edit Task'
    ];

    const selected = await vscode.window.showQuickPick(actions, {
      title: `Task Actions: ${taskId}`,
      placeHolder: 'Select an action...'
    });

    if (!selected) return;

    switch (selected) {
      case 'View Details':
        await this.openTaskDetails(taskId);
        break;
      case 'Open in ClickUp':
        await this.openTaskInBrowser(taskId);
        break;
      case 'Mark Complete':
        await this.markTaskComplete(taskId);
        break;
      case 'Start Progress':
        await this.startTaskProgress(taskId);
        break;
      case 'Copy Link':
        await this.copyTaskLink(taskId);
        break;
      case 'Edit Task':
        await this.editTask(taskId);
        break;
    }
  }

  /**
   * Mark task as complete
   */
  public async markTaskComplete(taskId: string): Promise<void> {
    await this.updateTaskStatus(taskId, 'complete');
  }

  /**
   * Start task progress
   */
  public async startTaskProgress(taskId: string): Promise<void> {
    await this.updateTaskStatus(taskId, 'in progress');
  }

  /**
   * Update task status
   */
  private async updateTaskStatus(taskId: string, newStatus: string): Promise<void> {
    try {
      const { useCRUD } = await import('../../hooks/useCRUD');
      const crud = useCRUD(this.context);
      
      await crud.updateTask(taskId, { status: newStatus });
      
      vscode.window.showInformationMessage(`Task status updated to: ${newStatus}`);
      
      // Refresh decorations
      vscode.commands.executeCommand('clickupLink.refreshDecorations');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update task status: ${error}`);
    }
  }

  /**
   * Open task in browser
   */
  public async openTaskInBrowser(taskId: string): Promise<void> {
    const url = `https://app.clickup.com/t/${taskId}`;
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  /**
   * Copy task link to clipboard
   */
  public async copyTaskLink(taskId: string): Promise<void> {
    const url = `https://app.clickup.com/t/${taskId}`;
    await vscode.env.clipboard.writeText(url);
    vscode.window.showInformationMessage('Task link copied to clipboard');
  }

  /**
   * Edit task
   */
  private async editTask(taskId: string): Promise<void> {
    // This would open a task editing interface
    vscode.window.showInformationMessage('Task editing interface would open here');
  }

  /**
   * Update interaction options
   */
  public updateOptions(newOptions: Partial<InteractionHandlerOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  public getOptions(): InteractionHandlerOptions {
    return { ...this.options };
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    
    // Dispose all webview panels
    this.taskDetailPanels.forEach(panel => panel.dispose());
    this.taskDetailPanels.clear();
  }
}
