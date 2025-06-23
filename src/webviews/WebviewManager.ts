import * as vscode from 'vscode';
import * as path from 'path';
import { Task } from '../types/navigationTypes';

export interface WebviewMessage {
  command: string;
  data?: any;
  requestId?: string;
}

export interface TaskDetailWebviewState {
  task: Task | null;
  isEditing: boolean;
  availableStatuses: Array<{
    label: string;
    value: string;
    color: string;
    emoji: string;
  }>;
}

/**
 * Manager for React webview panels with task details and interactions
 */
export class WebviewManager {
  private static instance: WebviewManager;
  private context: vscode.ExtensionContext;
  private activeWebviews: Map<string, vscode.WebviewPanel> = new Map();
  private messageHandlers: Map<string, (message: WebviewMessage) => Promise<any>> = new Map();

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.setupMessageHandlers();
  }

  static getInstance(context: vscode.ExtensionContext): WebviewManager {
    if (!WebviewManager.instance) {
      WebviewManager.instance = new WebviewManager(context);
    }
    return WebviewManager.instance;
  }

  private setupMessageHandlers(): void {
    // Task status change handler
    this.messageHandlers.set('statusChange', async (message) => {
      const { taskId, newStatus } = message.data;
      
      // Import CRUD operations
      const { useCRUD } = await import('../hooks/useCRUD');
      const crud = useCRUD(this.context);
      
      try {
        await crud.updateTask(taskId, { status: newStatus });
        
        // Refresh decorations to show updated status
        const { TaskDecorationProvider } = await import('../components/decorations/TaskDecorationProvider');
        const provider = TaskDecorationProvider.getInstance(this.context);
        
        if (vscode.window.activeTextEditor) {
          await provider.refreshDecorations(vscode.window.activeTextEditor);
        }

        return { success: true, message: `Status updated to ${newStatus}` };
      } catch (error) {
        return { success: false, error: `Failed to update status: ${error}` };
      }
    });

    // Task update handler
    this.messageHandlers.set('taskUpdate', async (message) => {
      const { taskId, updates } = message.data;
      
      const { useCRUD } = await import('../hooks/useCRUD');
      const crud = useCRUD(this.context);
      
      try {
        await crud.updateTask(taskId, updates);
        return { success: true, message: 'Task updated successfully' };
      } catch (error) {
        return { success: false, error: `Failed to update task: ${error}` };
      }
    });

    // External URL opener
    this.messageHandlers.set('openExternal', async (message) => {
      const { url } = message.data;
      await vscode.env.openExternal(vscode.Uri.parse(url));
      return { success: true };
    });

    // Quick action executor
    this.messageHandlers.set('executeQuickAction', async (message) => {
      const { actionId, taskId } = message.data;
      
      try {
        await this.executeQuickAction(actionId, taskId);
        return { success: true };
      } catch (error) {
        return { success: false, error: `Failed to execute action: ${error}` };
      }
    });

    // Status options fetcher
    this.messageHandlers.set('getStatusOptions', async (message) => {
      // For now, return default status options
      // In a real implementation, this would fetch from ClickUp API
      return {
        statuses: [
          { label: 'Open', value: 'open', color: '#6c757d', emoji: '📋' },
          { label: 'In Progress', value: 'in progress', color: '#007bff', emoji: '🔄' },
          { label: 'In Review', value: 'in review', color: '#6f42c1', emoji: '👀' },
          { label: 'Blocked', value: 'blocked', color: '#dc3545', emoji: '⚠️' },
          { label: 'Complete', value: 'complete', color: '#28a745', emoji: '✅' },
          { label: 'Closed', value: 'closed', color: '#6c757d', emoji: '🔒' }
        ]
      };
    });
  }

  /**
   * Create a task detail webview panel
   */
  public async createTaskDetailPanel(task: Task | null): Promise<vscode.WebviewPanel> {
    const panel = vscode.window.createWebviewPanel(
      'clickupTaskDetail',
      `Task: ${task?.name || 'No Task Selected'}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webviews')),
          vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
        ]
      }
    );

    // Store the panel
    const panelId = `task-detail-${Date.now()}`;
    this.activeWebviews.set(panelId, panel);

    // Setup message handler
    panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      const handler = this.messageHandlers.get(message.command);
      if (handler) {
        try {
          const result = await handler(message);
          
          // Send response back to webview
          if (message.requestId) {
            panel.webview.postMessage({
              command: 'response',
              requestId: message.requestId,
              data: result
            });
          }
        } catch (error) {
          console.error(`Error handling webview message ${message.command}:`, error);
          
          if (message.requestId) {
            panel.webview.postMessage({
              command: 'response',
              requestId: message.requestId,
              data: { success: false, error: error instanceof Error ? error.message : String(error) }
            });
          }
        }
      }
    });

    // Cleanup when panel is disposed
    panel.onDidDispose(() => {
      this.activeWebviews.delete(panelId);
    });

    // Set the HTML content
    panel.webview.html = this.getTaskDetailHtml(panel.webview, task);

    return panel;
  }

  /**
   * Create a status selector webview
   */
  public async createStatusSelector(
    currentStatus: string,
    taskName: string,
    onStatusChange: (newStatus: string) => void
  ): Promise<vscode.WebviewPanel> {
    const panel = vscode.window.createWebviewPanel(
      'clickupStatusSelector',
      'Change Task Status',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webviews'))
        ]
      }
    );

    // Setup message handler for status selection
    panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.command === 'statusSelected') {
        const { newStatus } = message.data;
        onStatusChange(newStatus);
        panel.dispose();
      } else if (message.command === 'cancel') {
        panel.dispose();
      } else {
        // Handle other messages through normal handlers
        const handler = this.messageHandlers.get(message.command);
        if (handler) {
          const result = await handler(message);
          if (message.requestId) {
            panel.webview.postMessage({
              command: 'response',
              requestId: message.requestId,
              data: result
            });
          }
        }
      }
    });

    panel.webview.html = this.getStatusSelectorHtml(panel.webview, currentStatus, taskName);
    return panel;
  }

  /**
   * Show quick actions popup
   */
  public async showQuickActions(taskId?: string, taskName?: string): Promise<void> {
    const actions = this.getAvailableQuickActions(taskId);
    
    // Use VS Code's quick pick for quick actions instead of webview
    // This provides better UX for quick actions
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = taskName ? `Quick Actions for: ${taskName}` : 'Quick Actions';
    quickPick.placeholder = 'Choose an action...';
    
    quickPick.items = actions.map(action => ({
      label: `${action.icon} ${action.label}`,
      description: action.description,
      detail: action.category,
      action: action
    } as any));

    quickPick.onDidAccept(async () => {
      const selectedItem = quickPick.selectedItems[0] as any;
      if (selectedItem && selectedItem.action) {
        await this.executeQuickAction(selectedItem.action.id, taskId);
      }
      quickPick.dispose();
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  }

  private getAvailableQuickActions(taskId?: string) {
    const actions = [
      {
        id: 'mark-complete',
        label: 'Mark Complete',
        icon: '✅',
        description: 'Mark task as complete',
        category: 'Status'
      },
      {
        id: 'start-progress',
        label: 'Start Progress',
        icon: '▶️',
        description: 'Start working on task',
        category: 'Status'
      },
      {
        id: 'open-external',
        label: 'Open in ClickUp',
        icon: '🔗',
        description: 'Open task in ClickUp web app',
        category: 'External'
      },
      {
        id: 'copy-url',
        label: 'Copy URL',
        icon: '📋',
        description: 'Copy task URL to clipboard',
        category: 'External'
      }
    ];

    if (!taskId) {
      actions.unshift({
        id: 'select-task',
        label: 'Select Task',
        icon: '🎯',
        description: 'Choose a task from ClickUp',
        category: 'Navigation'
      });
    }

    return actions;
  }

  private async executeQuickAction(actionId: string, taskId?: string): Promise<void> {
    switch (actionId) {
      case 'mark-complete':
        if (taskId) {
          const { useCRUD } = await import('../hooks/useCRUD');
          const crud = useCRUD(this.context);
          await crud.updateTask(taskId, { status: 'complete' });
          vscode.window.showInformationMessage('Task marked as complete');
        }
        break;
        
      case 'start-progress':
        if (taskId) {
          const { useCRUD } = await import('../hooks/useCRUD');
          const crud = useCRUD(this.context);
          await crud.updateTask(taskId, { status: 'in progress' });
          vscode.window.showInformationMessage('Task started');
        }
        break;
        
      case 'open-external':
        if (taskId) {
          const url = `https://app.clickup.com/t/${taskId}`;
          await vscode.env.openExternal(vscode.Uri.parse(url));
        }
        break;
        
      case 'copy-url':
        if (taskId) {
          const url = `https://app.clickup.com/t/${taskId}`;
          await vscode.env.clipboard.writeText(url);
          vscode.window.showInformationMessage('Task URL copied to clipboard');
        }
        break;
        
      case 'select-task':
        const { TaskInsertionWorkflow } = await import('../components/workflows/TaskInsertionWorkflow');
        const workflow = new TaskInsertionWorkflow(this.context);
        await workflow.insertTaskAtCursor();
        break;
    }
  }
  private getTaskDetailHtml(webview: vscode.Webview, task: Task | null): string {
    const nonce = this.getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webviews', 'TaskDetailPanel.js')
    );
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">
      <title>Task Details</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: var(--vscode-font-family);
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
        }
        #root {
          height: 100vh;
        }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        // Initialize React component
        const initialTask = ${JSON.stringify(task)};
        
        const props = {
          task: initialTask,
          onStatusChange: (taskId, newStatus) => {
            vscode.postMessage({
              command: 'statusChange',
              data: { taskId, newStatus },
              requestId: Date.now().toString()
            });
          },
          onTaskUpdate: (taskId, updates) => {
            vscode.postMessage({
              command: 'taskUpdate',
              data: { taskId, updates },
              requestId: Date.now().toString()
            });
          },
          onClose: () => {
            vscode.postMessage({
              command: 'closePanel'
            });
          }
        };
        
        // Initialize the React component when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            if (window.initializeWebview) {
              window.initializeWebview('TaskDetailPanel', props);
            }
          });
        } else {
          if (window.initializeWebview) {
            window.initializeWebview('TaskDetailPanel', props);
          }
        }
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          switch (message.command) {
            case 'updateTask':
              // Re-initialize with new task data
              props.task = message.data.task;
              if (window.initializeWebview) {
                window.initializeWebview('TaskDetailPanel', props);
              }
              break;
            case 'response':
              // Handle responses from extension
              if (message.data.success) {
                console.log('Operation successful:', message.data.message);
              } else {
                console.error('Operation failed:', message.data.error);
              }
              break;
          }
        });
      </script>
    </body>
    </html>`;
  }
  private getStatusSelectorHtml(webview: vscode.Webview, currentStatus: string, taskName: string): string {
    const nonce = this.getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webviews', 'StatusSelector.js')
    );
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">
      <title>Change Status</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: var(--vscode-font-family);
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
        }
        #root {
          height: 100vh;
        }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        // Get available statuses
        vscode.postMessage({
          command: 'getStatusOptions',
          requestId: 'init-status-options'
        });
        
        let availableStatuses = [
          { label: 'Open', value: 'open', color: '#6c757d', emoji: '📋' },
          { label: 'In Progress', value: 'in progress', color: '#007bff', emoji: '🔄' },
          { label: 'In Review', value: 'in review', color: '#6f42c1', emoji: '👀' },
          { label: 'Blocked', value: 'blocked', color: '#dc3545', emoji: '⚠️' },
          { label: 'Complete', value: 'complete', color: '#28a745', emoji: '✅' },
          { label: 'Closed', value: 'closed', color: '#6c757d', emoji: '🔒' }
        ];
        
        const props = {
          currentStatus: '${currentStatus}',
          availableStatuses: availableStatuses,
          taskName: '${taskName}',
          onStatusChange: (newStatus) => {
            vscode.postMessage({
              command: 'statusSelected',
              data: { newStatus }
            });
          },
          onCancel: () => {
            vscode.postMessage({
              command: 'cancel'
            });
          }
        };
        
        // Initialize React component when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            if (window.initializeWebview) {
              window.initializeWebview('StatusSelector', props);
            }
          });
        } else {
          if (window.initializeWebview) {
            window.initializeWebview('StatusSelector', props);
          }
        }
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          if (message.command === 'response' && message.requestId === 'init-status-options') {
            if (message.data.statuses) {
              props.availableStatuses = message.data.statuses;
              if (window.initializeWebview) {
                window.initializeWebview('StatusSelector', props);
              }
            }
          }
        });
      </script>
    </body>
    </html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Broadcast message to all active webviews
   */
  public broadcastMessage(message: WebviewMessage): void {
    this.activeWebviews.forEach(panel => {
      panel.webview.postMessage(message);
    });
  }

  /**
   * Close all webviews
   */
  public closeAllWebviews(): void {
    this.activeWebviews.forEach(panel => {
      panel.dispose();
    });
    this.activeWebviews.clear();
  }

  dispose(): void {
    this.closeAllWebviews();
  }
}
