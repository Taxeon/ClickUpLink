import * as vscode from 'vscode';
import { Task, NavigationItem } from '../../types/navigationTypes';
import { InlineTaskComponent } from './InlineTaskComponent';
import { StatusComponent } from './StatusComponent';
import { TriggerDetector } from '../triggers/TriggerDetector';
import { useDecorations } from '../../hooks/useDecorations';
import { TaskRenderer } from '../inline/TaskRenderer';
import { InteractionHandler } from '../inline/InteractionHandler';

export interface TaskDecoration {
  range: vscode.Range;
  task: Task;
  component: InlineTaskComponent;
  hoverProvider?: vscode.Disposable;
}

export interface DecorationState {
  decorations: Map<string, TaskDecoration>;
  activeEditor?: vscode.TextEditor;
  isEnabled: boolean;
}

/**
 * Main provider for task decorations using component-like architecture
 */
export class TaskDecorationProvider implements vscode.Disposable {
  private static instance: TaskDecorationProvider;
  private context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];
  private state: DecorationState;
  private triggerDetector: TriggerDetector;
  private taskRenderer: TaskRenderer;
  private interactionHandler: InteractionHandler;
  
  // Decoration types for different task states
  private readonly decorationTypes = {
    task: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('editor.foreground'),
      opacity: '0.7',
      fontStyle: 'italic',
      after: {
        contentText: '',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'normal',
        margin: '0 0 0 10px'
      }
    }),
    taskComplete: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      opacity: '0.6',
      textDecoration: 'line-through',
      after: {
        contentText: ' ✓',
        color: new vscode.ThemeColor('testing.iconPassed'),
        margin: '0 0 0 5px'
      }
    }),
    taskInProgress: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('editor.foreground'),
      opacity: '0.8',
      after: {
        contentText: ' 🔄',
        color: new vscode.ThemeColor('testing.iconQueued'),
        margin: '0 0 0 5px'
      }
    }),
    taskBlocked: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('editor.foreground'),
      opacity: '0.7',
      after: {
        contentText: ' ⚠️',
        color: new vscode.ThemeColor('testing.iconFailed'),
        margin: '0 0 0 5px'
      }
    })
  };

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.state = {
      decorations: new Map(),
      isEnabled: true
    };

    this.triggerDetector = TriggerDetector.getInstance(context);
    this.taskRenderer = TaskRenderer.getInstance(context);
    this.interactionHandler = InteractionHandler.getInstance(context);

    this.initialize();
  }

  static getInstance(context: vscode.ExtensionContext): TaskDecorationProvider {
    if (!TaskDecorationProvider.instance) {
      TaskDecorationProvider.instance = new TaskDecorationProvider(context);
    }
    return TaskDecorationProvider.instance;
  }

  private initialize(): void {
    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        this.state.activeEditor = editor;
        if (editor) {
          this.refreshDecorations(editor);
        }
      })
    );

    // Listen for document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        if (this.state.activeEditor && event.document === this.state.activeEditor.document) {
          this.handleDocumentChange(event);
        }
      })
    );

    // Listen for cursor position changes
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(event => {
        this.handleSelectionChange(event);
      })
    );

    // Initialize with current editor if available
    if (vscode.window.activeTextEditor) {
      this.state.activeEditor = vscode.window.activeTextEditor;
      this.refreshDecorations(this.state.activeEditor);
    }
  }

  /**
   * Handle document changes and update decorations
   */
  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    // Debounce document changes
    clearTimeout((this as any).changeTimeout);
    (this as any).changeTimeout = setTimeout(() => {
      if (this.state.activeEditor) {
        this.refreshDecorations(this.state.activeEditor);
      }
    }, 200);
  }

  /**
   * Handle selection changes for interaction
   */
  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    if (event.textEditor !== this.state.activeEditor) return;

    const position = event.selections[0].active;
    const decoration = this.findDecorationAtPosition(position);

    if (decoration) {
      this.interactionHandler.handleHover(decoration.task, decoration.range);
    }
  }

  /**
   * Refresh all decorations for the given editor
   */
  public async refreshDecorations(editor: vscode.TextEditor): Promise<void> {
    if (!this.state.isEnabled) return;

    const document = editor.document;
    const text = document.getText();
    
    // Clear existing decorations
    this.clearDecorations(editor);

    // Detect task references using trigger detector
    const taskReferences = await this.triggerDetector.detectTaskReferences(document);

    // Create decorations for each task reference
    for (const ref of taskReferences) {
      await this.createTaskDecoration(editor, ref);
    }
  }

  /**
   * Create a task decoration for a specific reference
   */
  private async createTaskDecoration(
    editor: vscode.TextEditor, 
    reference: { range: vscode.Range; taskId?: string; trigger: string }
  ): Promise<void> {
    let task: Task | undefined;

    if (reference.taskId) {
      // Try to fetch task details
      task = await this.fetchTaskDetails(reference.taskId);
    }

    // Create inline task component
    const component = new InlineTaskComponent({
      task,
      range: reference.range,
      trigger: reference.trigger,
      onStatusChange: (newStatus) => this.handleStatusChange(reference.taskId!, newStatus),
      onClick: () => this.handleTaskClick(reference)
    });

    // Create decoration
    const decoration: TaskDecoration = {
      range: reference.range,
      task: task!,
      component
    };

    // Store decoration
    const decorationId = `${reference.range.start.line}-${reference.range.start.character}`;
    this.state.decorations.set(decorationId, decoration);

    // Apply visual decoration
    this.applyTaskDecoration(editor, decoration);

    // Setup hover provider if task exists
    if (task) {
      decoration.hoverProvider = this.createHoverProvider(decoration);
    }
  }

  /**
   * Apply visual decoration to the editor
   */
  private applyTaskDecoration(editor: vscode.TextEditor, decoration: TaskDecoration): void {
    const { task, range } = decoration;
    
    let decorationType = this.decorationTypes.task;
    let afterText = '';

    if (task) {
      // Determine decoration based on task status
      switch (task.status) {
        case 'complete':
        case 'closed':
          decorationType = this.decorationTypes.taskComplete;
          afterText = ` [${task.name}] - Complete`;
          break;
        case 'in progress':
        case 'in review':
          decorationType = this.decorationTypes.taskInProgress;
          afterText = ` [${task.name}] - ${task.status}`;
          break;
        case 'blocked':
          decorationType = this.decorationTypes.taskBlocked;
          afterText = ` [${task.name}] - Blocked`;
          break;
        default:
          afterText = ` [${task.name}] - ${task.status || 'Open'}`;
      }
    } else {
      afterText = ' [Click to select task]';
    }

    // Apply decoration with custom after text
    const decorationOptions: vscode.DecorationOptions = {
      range,
      renderOptions: {
        after: {
          contentText: afterText,
          color: new vscode.ThemeColor('editorCodeLens.foreground'),
          fontStyle: 'italic'
        }
      }
    };

    editor.setDecorations(decorationType, [decorationOptions]);
  }

  /**
   * Create hover provider for task details
   */
  private createHoverProvider(decoration: TaskDecoration): vscode.Disposable {
    return vscode.languages.registerHoverProvider('*', {
      provideHover: (document, position) => {
        if (decoration.range.contains(position)) {
          return this.taskRenderer.createHoverContent(decoration.task);
        }
        return null;
      }
    });
  }

  /**
   * Handle task status changes
   */
  private async handleStatusChange(taskId: string, newStatus: string): Promise<void> {
    try {
      // Update task status via API
      const { useCRUD } = await import('../../hooks/useCRUD');
      const crud = useCRUD(this.context);
      
      await crud.updateTask(taskId, { status: newStatus });
      
      // Refresh decorations to show updated status
      if (this.state.activeEditor) {
        this.refreshDecorations(this.state.activeEditor);
      }

      vscode.window.showInformationMessage(`Task status updated to: ${newStatus}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update task status: ${error}`);
    }
  }

  /**
   * Handle task click for selection or creation
   */
  private async handleTaskClick(reference: { range: vscode.Range; taskId?: string; trigger: string }): Promise<void> {
    if (reference.taskId) {
      // Open task details
      await this.interactionHandler.openTaskDetails(reference.taskId);
    } else {
      // Start task selection workflow
      const { TaskInsertionWorkflow } = await import('../workflows/TaskInsertionWorkflow');
      const workflow = new TaskInsertionWorkflow(this.context);
      
      const selectedTask = await workflow.selectTask();
      if (selectedTask) {
        // Replace trigger with task reference
        if (this.state.activeEditor) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            this.state.activeEditor.document.uri,
            reference.range,
            `clickup:${selectedTask.id}`
          );
          await vscode.workspace.applyEdit(edit);
        }
      }
    }
  }

  /**
   * Fetch task details from cache or API
   */
  private async fetchTaskDetails(taskId: string): Promise<Task | undefined> {
    try {
      const { useCache } = await import('../../hooks/useCache');
      const cache = useCache(this.context);
      
      // Try to find task in cache first
      // If not found, we might need to fetch from API
      // For now, return undefined to trigger task selection
      return undefined;
    } catch (error) {
      console.error('Error fetching task details:', error);
      return undefined;
    }
  }

  /**
   * Find decoration at specific position
   */
  private findDecorationAtPosition(position: vscode.Position): TaskDecoration | undefined {
    for (const [_, decoration] of this.state.decorations) {
      if (decoration.range.contains(position)) {
        return decoration;
      }
    }
    return undefined;
  }

  /**
   * Clear all decorations from editor
   */
  private clearDecorations(editor: vscode.TextEditor): void {
    // Clear all decoration types
    Object.values(this.decorationTypes).forEach(type => {
      editor.setDecorations(type, []);
    });

    // Dispose hover providers
    this.state.decorations.forEach(decoration => {
      decoration.hoverProvider?.dispose();
    });

    // Clear decoration map
    this.state.decorations.clear();
  }

  /**
   * Enable/disable decorations
   */
  public setEnabled(enabled: boolean): void {
    this.state.isEnabled = enabled;
    
    if (!enabled && this.state.activeEditor) {
      this.clearDecorations(this.state.activeEditor);
    } else if (enabled && this.state.activeEditor) {
      this.refreshDecorations(this.state.activeEditor);
    }
  }

  /**
   * Get current decoration state
   */
  public getState(): DecorationState {
    return { ...this.state };
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.state.decorations.forEach(decoration => {
      decoration.hoverProvider?.dispose();
    });
    Object.values(this.decorationTypes).forEach(type => type.dispose());
  }
}
