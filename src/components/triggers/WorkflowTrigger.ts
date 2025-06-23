import * as vscode from 'vscode';
import { TriggerDetector, TriggerMatch } from './TriggerDetector';
import { TaskInsertionWorkflow } from '../workflows/TaskInsertionWorkflow';
import { TaskCreationWorkflow, TaskCreationData } from '../workflows/TaskCreationWorkflow';
import { Task } from '../../types/navigationTypes';

export interface WorkflowTriggerOptions {
  enableAutoTrigger: boolean;
  triggerDelay: number; // milliseconds
  enableKeyboardShortcuts: boolean;
  enableContextMenu: boolean;
}

export interface WorkflowContext {
  document: vscode.TextDocument;
  position: vscode.Position;
  trigger: TriggerMatch;
  selectedText?: string;
}

/**
 * Manages workflow initiation based on trigger detection
 */
export class WorkflowTrigger implements vscode.Disposable {
  private static instance: WorkflowTrigger;
  private context: vscode.ExtensionContext;
  private triggerDetector: TriggerDetector;
  private disposables: vscode.Disposable[] = [];
  private options: WorkflowTriggerOptions;
  private pendingTriggers: Map<string, NodeJS.Timeout> = new Map();

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.triggerDetector = TriggerDetector.getInstance(context);
    this.options = {
      enableAutoTrigger: true,
      triggerDelay: 1000, // 1 second delay
      enableKeyboardShortcuts: true,
      enableContextMenu: true
    };

    this.initialize();
  }

  static getInstance(context: vscode.ExtensionContext): WorkflowTrigger {
    if (!WorkflowTrigger.instance) {
      WorkflowTrigger.instance = new WorkflowTrigger(context);
    }
    return WorkflowTrigger.instance;
  }

  private initialize(): void {
    this.loadConfiguration();
    this.setupEventListeners();
    this.registerCommands();
    this.setupContextMenu();
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('clickupLink.workflows');
    
    this.options = {
      enableAutoTrigger: config.get('enableAutoTrigger', true),
      triggerDelay: config.get('triggerDelay', 1000),
      enableKeyboardShortcuts: config.get('enableKeyboardShortcuts', true),
      enableContextMenu: config.get('enableContextMenu', true)
    };
  }

  private setupEventListeners(): void {
    // Listen for document changes to detect new triggers
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        if (this.options.enableAutoTrigger) {
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

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('clickupLink.workflows')) {
          this.loadConfiguration();
        }
      })
    );
  }

  private registerCommands(): void {
    // Command to manually trigger task insertion workflow
    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.insertTask', async (uri?: vscode.Uri) => {
        await this.triggerTaskInsertion();
      })
    );

    // Command to trigger task creation workflow
    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.createTask', async (uri?: vscode.Uri) => {
        await this.triggerTaskCreation();
      })
    );

    // Command to replace current word with task reference
    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.replaceWithTask', async () => {
        await this.replaceCurrentWordWithTask();
      })
    );

    // Command to convert selection to task
    this.disposables.push(
      vscode.commands.registerCommand('clickupLink.convertToTask', async () => {
        await this.convertSelectionToTask();
      })
    );
  }

  private setupContextMenu(): void {
    if (!this.options.enableContextMenu) {
      return;
    }

    // Context menu items will be registered in package.json
    // This method can be used for dynamic context menu handling
  }

  /**
   * Handle document changes to detect new triggers
   */
  private async handleDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
    if (!event.document || event.contentChanges.length === 0) {
      return;
    }

    // Process each change
    for (const change of event.contentChanges) {
      await this.processTextChange(event.document, change);
    }
  }

  /**
   * Process individual text changes for trigger detection
   */
  private async processTextChange(
    document: vscode.TextDocument, 
    change: vscode.TextDocumentContentChangeEvent
  ): Promise<void> {
    const changeText = change.text.toLowerCase();
    
    // Check if the change might contain a trigger
    if (changeText.includes('clickup') || /\b(cu-|#)\w+\b/.test(changeText)) {
      const changeRange = change.range;
      const changeKey = `${document.uri.toString()}-${changeRange.start.line}-${changeRange.start.character}`;

      // Clear existing pending trigger for this location
      const existingTimeout = this.pendingTriggers.get(changeKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new pending trigger with delay
      const timeout = setTimeout(async () => {
        await this.checkForTriggersInRange(document, changeRange);
        this.pendingTriggers.delete(changeKey);
      }, this.options.triggerDelay);

      this.pendingTriggers.set(changeKey, timeout);
    }
  }

  /**
   * Check for triggers in a specific range
   */
  private async checkForTriggersInRange(
    document: vscode.TextDocument, 
    range: vscode.Range
  ): Promise<void> {
    // Expand range to include potential trigger context
    const expandedRange = this.expandRangeForTriggerDetection(document, range);
    const text = document.getText(expandedRange);
    
    // Create a temporary document section for trigger detection
    const tempDoc = {
      ...document,
      getText: () => text,
      positionAt: (offset: number) => {
        const fullText = document.getText();
        const rangeStart = document.offsetAt(expandedRange.start);
        return document.positionAt(rangeStart + offset);
      }
    } as vscode.TextDocument;

    const triggers = await this.triggerDetector.detectTaskReferences(tempDoc);
    
    if (triggers.length > 0) {
      await this.handleTriggersDetected(document, triggers);
    }
  }

  /**
   * Expand range to include full words and potential trigger context
   */
  private expandRangeForTriggerDetection(
    document: vscode.TextDocument, 
    range: vscode.Range
  ): vscode.Range {
    const line = document.lineAt(range.start.line);
    const text = line.text;
    
    let start = range.start.character;
    let end = range.end.character;

    // Expand backwards to word boundary
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }

    // Expand forwards to word boundary  
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }

    return new vscode.Range(
      new vscode.Position(range.start.line, start),
      new vscode.Position(range.end.line, end)
    );
  }

  /**
   * Handle detected triggers
   */
  private async handleTriggersDetected(
    document: vscode.TextDocument, 
    triggers: TriggerMatch[]
  ): Promise<void> {
    for (const trigger of triggers) {
      await this.processTrigger(document, trigger);
    }
  }

  /**
   * Process individual trigger
   */
  private async processTrigger(
    document: vscode.TextDocument, 
    trigger: TriggerMatch
  ): Promise<void> {
    const workflowContext: WorkflowContext = {
      document,
      position: trigger.range.start,
      trigger
    };

    switch (trigger.type) {
      case 'clickup-trigger':
        await this.handleClickupTrigger(workflowContext);
        break;
      case 'task-reference':
        await this.handleTaskReference(workflowContext);
        break;
      case 'task-id':
        await this.handleTaskId(workflowContext);
        break;
    }
  }

  /**
   * Handle basic clickup trigger
   */
  private async handleClickupTrigger(context: WorkflowContext): Promise<void> {
    // Show code lens or quick actions for basic triggers
    await this.showQuickActions(context);
  }

  /**
   * Handle task reference (clickup:taskId)
   */
  private async handleTaskReference(context: WorkflowContext): Promise<void> {
    if (context.trigger.taskId) {
      // Task ID already specified, try to resolve task details
      await this.resolveTaskReference(context);
    } else {
      // Incomplete reference, offer task selection
      await this.showQuickActions(context);
    }
  }

  /**
   * Handle direct task ID
   */
  private async handleTaskId(context: WorkflowContext): Promise<void> {
    if (context.trigger.taskId) {
      await this.resolveTaskReference(context);
    }
  }

  /**
   * Resolve task reference to get task details
   */
  private async resolveTaskReference(context: WorkflowContext): Promise<void> {
    // This would integrate with your task lookup system
    // For now, we'll show a placeholder
    console.log(`Resolving task: ${context.trigger.taskId}`);
  }

  /**
   * Show quick actions for triggers
   */
  private async showQuickActions(context: WorkflowContext): Promise<void> {
    const actions = [
      'Insert Existing Task',
      'Create New Task',
      'Browse Tasks',
      'Dismiss'
    ];

    const selected = await vscode.window.showQuickPick(actions, {
      title: 'ClickUp Integration',
      placeHolder: 'What would you like to do?'
    });

    if (!selected || selected === 'Dismiss') {
      return;
    }

    switch (selected) {
      case 'Insert Existing Task':
        await this.triggerTaskInsertion(context);
        break;
      case 'Create New Task':
        await this.triggerTaskCreation(context);
        break;
      case 'Browse Tasks':
        await this.triggerTaskBrowsing(context);
        break;
    }
  }

  /**
   * Handle selection changes for context-aware triggers
   */
  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    // Could be used for showing contextual hints or actions
  }

  /**
   * Trigger task insertion workflow
   */
  public async triggerTaskInsertion(context?: WorkflowContext): Promise<void> {
    const workflow = new TaskInsertionWorkflow(this.context);
    
    if (context) {
      await workflow.insertTaskAtPosition(context.document, context.position);
    } else {
      await workflow.insertTaskAtCursor();
    }
  }

  /**
   * Trigger task creation workflow
   */  public async triggerTaskCreation(context?: WorkflowContext): Promise<void> {
    const workflow = new TaskCreationWorkflow(this.context);
    
    let taskData: Partial<TaskCreationData> = {};
    
    if (context?.selectedText) {
      taskData.name = context.selectedText;
    }
    
    await workflow.createTask(taskData);
  }

  /**
   * Trigger task browsing
   */
  public async triggerTaskBrowsing(context?: WorkflowContext): Promise<void> {
    const workflow = new TaskInsertionWorkflow(this.context);
    await workflow.browseAndInsertTask();
  }

  /**
   * Replace current word with task reference
   */
  public async replaceCurrentWordWithTask(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const position = editor.selection.active;
    const wordRange = editor.document.getWordRangeAtPosition(position);
    
    if (wordRange) {
      const context: WorkflowContext = {
        document: editor.document,
        position,
        trigger: {
          range: wordRange,
          trigger: editor.document.getText(wordRange),
          type: 'clickup-trigger'
        }
      };

      await this.triggerTaskInsertion(context);
    }
  }

  /**
   * Convert current selection to task
   */
  public async convertSelectionToTask(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showWarningMessage('Please select text to convert to a task.');
      return;
    }

    const selectedText = editor.document.getText(editor.selection);
    const context: WorkflowContext = {
      document: editor.document,
      position: editor.selection.start,
      trigger: {
        range: editor.selection,
        trigger: selectedText,
        type: 'clickup-trigger'
      },
      selectedText
    };

    await this.triggerTaskCreation(context);
  }

  /**
   * Update workflow options
   */
  public updateOptions(newOptions: Partial<WorkflowTriggerOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  public getOptions(): WorkflowTriggerOptions {
    return { ...this.options };
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    
    // Clear pending triggers
    this.pendingTriggers.forEach(timeout => clearTimeout(timeout));
    this.pendingTriggers.clear();
  }
}
