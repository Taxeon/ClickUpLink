import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { ClickUpCodeLensTasks } from './ClickUpCodeLensTasks';
import { ClickUpCodeLensDebug } from './taskRefMaintenance';
import { TaskReference } from '../../types/index';
import { RefPositionManager } from './refPositionManagement';
import { BuildTaskRef } from './buildTaskRef';

export class ClickUpCodeLensProvider implements vscode.CodeLensProvider {
  private static instance: ClickUpCodeLensProvider;
  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;
  private taskReferences: Map<string, TaskReference[]> = new Map();
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  private taskRefBuilder: BuildTaskRef;
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  // Helper modules
  private tasks: ClickUpCodeLensTasks;
  private debug: ClickUpCodeLensDebug;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
    this.tasks = new ClickUpCodeLensTasks(context, (uri, range) =>
      this.getTaskReference(uri, range)
    );
    this.debug = new ClickUpCodeLensDebug(context);
    this.taskRefBuilder = new BuildTaskRef(context);
  }

  static getInstance(context: vscode.ExtensionContext): ClickUpCodeLensProvider {
    if (!ClickUpCodeLensProvider.instance) {
      ClickUpCodeLensProvider.instance = new ClickUpCodeLensProvider(context);
    }
    return ClickUpCodeLensProvider.instance;
  }

  private _alreadyPopulated: Set<string> = new Set();

  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    // 1. Load all known references for this document
    const allReferences = this.taskReferences.get(document.uri.toString()) || [];
    // 2. Scan for markers and update reference positions (active/orphaned)
    RefPositionManager.updateReferencesFromMarkers(document, allReferences);
    // 3. Use only active references for display
    const activeReferences = RefPositionManager.getActiveReferences(document.uri.toString());

    // Always attempt to build out any reference with a taskId but missing details
    for (const ref of activeReferences) {
      if (
        ref.taskId &&
        (!ref.folderId || !ref.listId || !ref.taskName)
      ) {
        try {
        // Fetch full details and save using ClickUpGetTask.saveTaskReference
        console.log('2. Active References:', ref);
        const clickUpGetTask = new (require('./ClickUpGetTask').ClickUpGetTask)(this.context);

        console.log('3. clickUp Task fetch:', clickUpGetTask);
        // Fetch the full task and parent task objects as the UI flow does
          const task = await this.clickUpService.getTaskDetails(ref.taskId);
          if (task) {
            await this.taskRefBuilder.buildTaskRef(
              ref.range,
              task,
              task.parent,
              (uri: string, range: vscode.Range) => this.getTaskReference(uri, range),
              (uri: string, reference: TaskReference) => this.saveTaskReference(uri, reference),
              () => this._onDidChangeCodeLenses.fire()
            );
            this.loadReferences();
          }
        } catch (err) {
          console.error('Failed to build reference for anchor:', ref.taskId, err);
        }
      }
    }

    // 4. Build CodeLenses for active references
    const allLenses = await Promise.all(
      RefPositionManager.getActiveReferences(document.uri.toString()).map(ref =>
        this.createCodeLensForReference(ref, document)
      )
    );
    return allLenses.flat();
  }

  // Streamlined reference filtering
  private getFilteredReferences(document: vscode.TextDocument): TaskReference[] {
    const allReferences = this.taskReferences.get(document.uri.toString()) || [];
    const currentWorkspacePath = this.getWorkspaceFolderPath(document.uri);

    return allReferences.filter(
      ref =>
        !ref.workspaceFolderPath ||
        !currentWorkspacePath ||
        ref.workspaceFolderPath === currentWorkspacePath
    );
  }

  // Simplified CodeLens creation
  // Placeholders (created by Alt+CU) have no taskId and always show the setup lens
  private async createCodeLensForReference(
    reference: TaskReference,
    document: vscode.TextDocument
  ): Promise<vscode.CodeLens[]> {
    console.log('[ClickUp] createCodeLensForReference:', {
      line: reference.range?.start?.line,
      character: reference.range?.start?.character,
      hasTaskId: !!reference.taskId,
      taskId: reference.taskId,
      reference
    });
    return reference.taskId
      ? await this.createBreadcrumbs(reference, reference.range.start.line)
      : [
        new vscode.CodeLens(reference.range, {
            title: '$(add) Select ClickUp Task',
          command: 'clickuplink.setupTaskReference',
          arguments: [document.uri, reference.range],
        }),
      ];
  }

  // Change this method to async
  private async createBreadcrumbs(ref: TaskReference, line: number): Promise<vscode.CodeLens[]> {
    const lenses: vscode.CodeLens[] = [];
    const fullBreadcrumb = this.buildFullBreadcrumb(ref);
    let col = 0;

    // Fetch latest description from ClickUp
    if (ref.taskId) {
      try {
        const task = await this.clickUpService.getTaskDetails(ref.taskId);
        ref.description = task?.description || ref.description;
        // If subtask, fetch parent description as well if needed
        if (ref.parentTaskId) {
          const parentTask = await this.clickUpService.getTaskDetails(ref.parentTaskId);
          ref.parentTaskName = parentTask?.name || ref.parentTaskName;
          ref.parentTaskDescription = parentTask?.description || ref.parentTaskDescription;
        }
      } catch (err) {
        // Ignore fetch errors, fallback to stored description
      }
    }

    // Streamlined breadcrumb creation with helper
    const breadcrumbItems = [
      {
        condition: ref.folderName,
        text: ref.folderName ? `📁 ${ref.folderName}` : '',
        command: 'clickuplink.changeFolder',
        args: [ref.range, ref.folderId],
        tooltip: `Change folder selection\nFull path: ${fullBreadcrumb}`,
      },
      {
        condition: ref.listName,
        text: ref.listName ? `📋 ${ref.listName}` : '',
        command: 'clickuplink.changeList',
        args: [ref.range, ref.folderId, ref.listId],
        tooltip: `Change list selection\nFull path: ${fullBreadcrumb}`,
      },
      {
        condition: ref.parentTaskName && ref.parentTaskId,
        text: ref.parentTaskName || '',
        command: 'clickuplink.changeTask',
        args: [ref.range, ref.listId, ref.parentTaskId],
        tooltip: ref.parentTaskDescription
          ? `${ref.parentTaskDescription}\n\nFull path: ${fullBreadcrumb}`
          : `Change parent task selection "${ref.parentTaskName}"\nFull path: ${fullBreadcrumb}`,
      },
      {
        condition: ref.taskName,
        text: ref.taskName ? `${ref.parentTaskId ? '🔗' : '📋'} ${ref.taskName}` : '',
        command: ref.parentTaskId ? 'clickuplink.changeSubtask' : 'clickuplink.changeTask',
        args: ref.parentTaskId
          ? [ref.range, ref.listId, ref.parentTaskId, ref.taskId]
          : [ref.range, ref.listId, ref.taskId],
        tooltip: this.buildTaskTooltip(ref, fullBreadcrumb),
      },
    ];

    // Create breadcrumb lenses
    breadcrumbItems.forEach(item => {
      if (item.condition && item.text) {
        lenses.push(
          this.createBreadcrumbLens(line, col, item.text, item.tooltip, item.command, item.args)
        );
        col += item.text.length + 1;
      }
    });

    // Add status, assignee, and link lenses if taskId exists
    if (ref.taskId) {
      col = this.addStatusAssigneeAndLink(lenses, ref, line, col, fullBreadcrumb);
    }

    return lenses;
  }

  // Helper to create individual breadcrumb lens
  private createBreadcrumbLens(
    line: number,
    col: number,
    title: string,
    tooltip: string,
    command: string,
    args: any[]
  ): vscode.CodeLens {
    return new vscode.CodeLens(new vscode.Range(line, col, line, col + title.length), {
      title,
      tooltip,
      command,
      arguments: args,
    });
  }

  // Streamlined status/assignee/link creation
  private addStatusAssigneeAndLink(
    lenses: vscode.CodeLens[],
    ref: TaskReference,
    line: number,
    col: number,
    fullBreadcrumb: string
  ): number {
    const statusItems = [
      {
        condition: ref.status || ref.taskStatus?.status,
        text: `🔄 ${ref.taskStatus?.status || ref.status || 'Unknown'}`,
        command: 'clickuplink.changeStatus',
        args: [ref.range, ref.taskId],
        tooltip: `Change status\nDescription: ${ref.description || 'No description set'}`,
      },
      {
        condition: true, // Always show assignee
        text: ref.assignee ? `👤 ${ref.assignee.username}` : '👤 unassigned',
        command: 'clickuplink.changeAssignee',
        args: [ref.range, ref.taskId],
        tooltip: `Change assignee\nDescription: ${ref.description || 'No description set'}`,
      },
      {
        condition: true, // Always show link
        text: '🔗 ClickUp',
        command: 'clickuplink.openInClickUp',
        args: [ref.taskId],
        tooltip: `Open in ClickUp\nDescription: ${ref.description || 'No description set'}\n\nFull path: ${fullBreadcrumb}`,
      },
    ];

    statusItems.forEach(item => {
      if (item.condition) {
        lenses.push(
          this.createBreadcrumbLens(line, col, item.text, item.tooltip, item.command, item.args)
        );
        col += item.text.length + 1;
      }
    });

    return col;
  }

  // Build task-specific tooltip with description
  private buildTaskTooltip(ref: TaskReference, fullBreadcrumb: string): string {
    const taskType = ref.parentTaskId ? 'subtask' : 'task';
    const description = ref.description?.trim();

    if (description) {
      return `${description}\n\nFull path: ${fullBreadcrumb}`;
    } else {
      return `No description set for this ${taskType}\n\nFull path: ${fullBreadcrumb}`;
    }
  }
  private buildFullBreadcrumb(ref: TaskReference): string {
    const parts = [
      ref.folderName && `📁 ${ref.folderName}`,
      ref.listName && `📋 ${ref.listName}`,
      ref.parentTaskName,
      ref.taskName && `${ref.parentTaskId ? '🔗' : '📋'} ${ref.taskName}`,
      (ref.status || ref.taskStatus?.status) && `🔄 ${ref.taskStatus?.status || ref.status}`,
      ref.assignee && `👤 ${ref.assignee.username}`,
    ].filter(Boolean);

    return parts.join(' | ');
  }

  // Streamlined reference management
  private getTaskReference(uri: string, range: vscode.Range): TaskReference | undefined {
    return this.taskReferences
      .get(uri)
      ?.find(
        ref =>
          ref.range.start.line === range.start.line &&
          ref.range.start.character === range.start.character
      );
  }

  private saveTaskReference(uri: string, reference: TaskReference): void {
    const references = this.taskReferences.get(uri) || [];

    // Add workspace folder path if missing
    reference.workspaceFolderPath ??= this.getWorkspaceFolderPath(vscode.Uri.parse(uri));

    // Find and replace existing or add new
    const existingIndex = references.findIndex(
      ref =>
        ref.range.start.line === reference.range.start.line &&
        ref.range.start.character === reference.range.start.character
    );

    if (existingIndex !== -1) {
      references[existingIndex] = reference;
    } else {
      references.push(reference);
    }

    this.taskReferences.set(uri, references);
    this.persistReferences();
    // Refresh the task reference pane
    this._onDidChangeCodeLenses.fire();
  }

  // Streamlined persistence with functional approach
  private persistReferences(): void {
    const dataObject = Object.fromEntries(
      Array.from(this.taskReferences.entries()).map(([uri, references]) => [
        uri,
        references.map(ref => ({
          ...ref,
          range: {
            start: { line: ref.range.start.line, character: ref.range.start.character },
            end: { line: ref.range.end.line, character: ref.range.end.character },
          },
        })),
      ])
    );

    this.context.globalState.update('clickup.taskReferences', JSON.stringify(dataObject));
  }

  public loadReferences(): void {
    const serialized = this.context.globalState.get<string>('clickup.taskReferences');
    if (!serialized) return;

    try {
      const data = JSON.parse(serialized);
      this.taskReferences.clear();

      Object.entries(data).forEach(([uri, refs]) => {
        if (!Array.isArray(refs)) return;
        const restoredRefs = refs.map(ref => ({
          ...ref,
          range: new vscode.Range(
            ref.range.start.line,
            ref.range.start.character,
            ref.range.end.line,
            ref.range.end.character
          ),
        }));
        this.taskReferences.set(uri, restoredRefs);
      });
    } catch (error) {
      console.error('Failed to load task references:', error);
    }
  }

  // Streamlined command handlers with common pattern
  private async executeTaskCommand(
    range: vscode.Range,
    commandMethod: (range: vscode.Range, ...args: any[]) => Promise<void>,
    ...args: any[]
  ): Promise<void> {
    const saveCallback = (uri: string, ref: TaskReference) => this.saveTaskReference(uri, ref);
    const refreshCallback = () => this._onDidChangeCodeLenses.fire();
    const getCallback = (uri: string, range: vscode.Range) => this.getTaskReference(uri, range);

    await commandMethod.call(
      this.tasks,
      range,
      ...args,
      getCallback,
      saveCallback,
      refreshCallback
    );
  }

  async setupTaskReference(uri: vscode.Uri, range: vscode.Range): Promise<void> {
    let ref = this.getTaskReference(uri.toString(), range);
    if (!ref) {
      ref = { range };
      this.saveTaskReference(uri.toString(), ref);
    }
    await this.tasks.setupTaskReference(
      uri,
      range,
      (uri: string, ref: TaskReference) => this.saveTaskReference(uri, ref),
      () => this._onDidChangeCodeLenses.fire()
    );
  }

  async changeFolder(range: vscode.Range, currentFolderId: string): Promise<void> {
    await this.executeTaskCommand(range, this.tasks.changeFolder, currentFolderId);
  }

  async changeList(range: vscode.Range, folderId: string, currentListId: string): Promise<void> {
    await this.executeTaskCommand(range, this.tasks.changeList, folderId, currentListId);
  }

  async changeTask(range: vscode.Range, listId: string, currentTaskId: string): Promise<void> {
    await this.executeTaskCommand(range, this.tasks.changeTask, listId, currentTaskId);
  }

  async changeSubtask(
    range: vscode.Range,
    listId: string,
    parentTaskId: string,
    subtaskId: string
  ): Promise<void> {
    await this.executeTaskCommand(range, this.tasks.changeSubtask, listId, parentTaskId, subtaskId);
  }

  async changeStatus(range: vscode.Range, taskId: string): Promise<void> {
    await this.executeTaskCommand(range, this.tasks.changeStatus, taskId);
  }

  async changeAssignee(range: vscode.Range, taskId: string): Promise<void> {
    await this.executeTaskCommand(range, this.tasks.changeAssignee, taskId);
  }

  async openInClickUp(taskId: string): Promise<void> {
    await this.tasks.openInClickUp(taskId);
  }

  // Streamlined cursor reference addition
  // This creates a placeholder reference (no taskId) at the cursor line, which will show '+ Set up ClickUp Reference' in the CodeLens and as 'undefined' in the task reference pane
  async addTaskReferenceAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const position = editor.selection.active;
    const range = new vscode.Range(position, position);
    const uri = editor.document.uri.toString();

    // Check for duplicates more concisely
    const existing = this.taskReferences.get(uri) || [];
    const isDuplicate = existing.some(
      ref =>
        ref.range.start.line === position.line && ref.range.start.character === position.character
    );

    if (isDuplicate) {
      vscode.window.showWarningMessage('A task reference already exists at this position');
      return;
    }

    // Only save range and workspaceFolderPath, do not set taskId yet (placeholder)
    this.saveTaskReference(uri, {
      range,
      workspaceFolderPath: this.getWorkspaceFolderPath(editor.document.uri),
    });

    // Force refresh so CodeLens and task reference pane update immediately
    this._onDidChangeCodeLenses.fire();
    vscode.window.showInformationMessage(
      'ClickUp task reference added. Click the CodeLens to set it up.'
    );
  }

  // Utility methods
  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public initialize(): void {
    this.loadReferences();
    vscode.workspace.onDidSaveTextDocument(document => {
      RefPositionManager.purgeOrphanedReferencesOnSave(document.uri.toString(), (uri, refs) => {
        this.taskReferences.set(uri, refs);
        this.persistReferences();
      });
      this._onDidChangeCodeLenses.fire();
    });
  }

  public dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }

  // Debug method delegations
  debugShowStoredReferences(outputChannel: vscode.OutputChannel): void {
    this.debug.debugShowStoredReferences(outputChannel);
  }

  debugClearStoredReferences(): void {
    this.debug.debugClearStoredReferences(this.taskReferences, () =>
      this._onDidChangeCodeLenses.fire()
    );
  }

  clearCompletedReferences(): void {
    this.debug.clearCompletedReferences(() => this._onDidChangeCodeLenses.fire());
  }

  cleanupDuplicateReferences(): void {
    this.debug.cleanupDuplicateReferences(() => this._onDidChangeCodeLenses.fire());
  }

  deleteTaskReference(uri: string, line: number, character: number): void {
    this.debug.deleteTaskReference(uri, line, character, () => {
      this.loadReferences();
      this._onDidChangeCodeLenses.fire();
    });
  }

  private getWorkspaceFolderPath(uri: vscode.Uri): string | undefined {
    return vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
  }

  private getCurrentWorkspaceFolderPath(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
}
