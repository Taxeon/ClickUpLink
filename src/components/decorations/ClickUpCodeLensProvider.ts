import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { ClickUpCodeLensTasks } from './ClickUpCodeLensTasks';
import { ClickUpCodeLensDebug } from './ClickUpCodeLensDebug';
import { TaskReference } from '../../types/index';

export class ClickUpCodeLensProvider implements vscode.CodeLensProvider {
  private static instance: ClickUpCodeLensProvider;
  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;
  private taskReferences: Map<string, TaskReference[]> = new Map();
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  
  // Helper modules
  private tasks: ClickUpCodeLensTasks;
  private debug: ClickUpCodeLensDebug;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
    this.tasks = new ClickUpCodeLensTasks(context);
    this.debug = new ClickUpCodeLensDebug(context);
  }

  static getInstance(context: vscode.ExtensionContext): ClickUpCodeLensProvider {
    if (!ClickUpCodeLensProvider.instance) {
      ClickUpCodeLensProvider.instance = new ClickUpCodeLensProvider(context);
    }
    return ClickUpCodeLensProvider.instance;
  }  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    
    // Only show CodeLens for manually added task references
    const references = this.taskReferences.get(document.uri.toString()) || [];
    
    for (const reference of references) {
      if (reference.taskId) {
        // Show breadcrumbs for completed task references
        const breadcrumbs = this.createBreadcrumbs(reference, reference.range.start.line);
        codeLenses.push(...breadcrumbs);
      } else {
        // Show "+Select ClickUp Task" for incomplete references
        codeLenses.push(new vscode.CodeLens(reference.range, {
          title: '$(add) Select ClickUp Task',
          command: 'clickuplink.setupTaskReference',
          arguments: [document.uri, reference.range]
        }));
      }
    }
    
    return codeLenses;
  }private createBreadcrumbs(ref: TaskReference, line: number): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    let col = 0;

    // Format: 📁 Folder Name | 📋 List Name | Task Name | Status | 🔗 Open
    if (ref.folderName) {
      lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + ref.folderName.length + 2), {
        title: `📁 ${ref.folderName}`,
        command: 'clickuplink.changeFolder',
        arguments: [ref.range, ref.folderId]
      }));
      col += ref.folderName.length + 2;     

    }

    if (ref.listName) {
      lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + ref.listName.length + 2), {
        title: `📋 ${ref.listName}`,
        command: 'clickuplink.changeList',
        arguments: [ref.range, ref.folderId, ref.listId]
      }));
      col += ref.listName.length + 2;

    }

    if (ref.taskName) {
      // Task name without status
      lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + ref.taskName.length), {
        title: ref.taskName,
        command: 'clickuplink.changeTask',
        arguments: [ref.range, ref.listId, ref.taskId]
      }));
      col += ref.taskName.length;      

    }

    // Separate clickable status with enhanced display
    if ((ref.status || ref.taskStatus?.status) && ref.taskId) {
      const statusText = ref.taskStatus?.status || ref.status || 'Unknown';
      const displayStatus = `🔄 ${statusText}`;
      lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + displayStatus.length), {
        title: displayStatus,
        command: 'clickuplink.changeStatus',
        arguments: [ref.range, ref.taskId]
      }));
      col += displayStatus.length + 1;
    }

    //Add clickup link to selected task in Clickup site
    if (ref.taskId) {
      lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + 6), {
        title: '🔗 ClickUp',
        command: 'clickuplink.openInClickUp',
        arguments: [ref.taskId]
      }));
    }

    return lenses;
  }
  private getTaskReference(uri: string, range: vscode.Range): TaskReference | undefined {
    const references = this.taskReferences.get(uri) || [];
    return references.find(ref => 
      ref.range.start.line === range.start.line && 
      ref.range.start.character === range.start.character
    );
  }  private saveTaskReference(uri: string, reference: TaskReference): void {
    const references = this.taskReferences.get(uri) || [];
    const existingIndex = references.findIndex(ref => 
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
  }private persistReferences(): void {
    // Convert Map to plain object for compatibility with ReferencesTreeProvider
    const dataObject: {[uri: string]: any[]} = {};
    for (const [uri, references] of this.taskReferences) {
      // Convert Range objects to plain objects for serialization
      dataObject[uri] = references.map(ref => ({
        ...ref,
        range: {
          start: { line: ref.range.start.line, character: ref.range.start.character },
          end: { line: ref.range.end.line, character: ref.range.end.character }
        }
      }));
    }
    const serialized = JSON.stringify(dataObject);
    this.context.globalState.update('clickup.taskReferences', serialized);
  }  private loadReferences(): void {
    const serialized = this.context.globalState.get<string>('clickup.taskReferences');
    if (serialized) {
      try {
        const data = JSON.parse(serialized);
        this.taskReferences.clear();
        // Convert plain object back to Map and restore Range objects
        for (const uri in data) {
          const refs = data[uri].map((ref: any) => ({
            ...ref,
            range: new vscode.Range(
              ref.range.start.line,
              ref.range.start.character,
              ref.range.end.line,
              ref.range.end.character
            )
          }));
          this.taskReferences.set(uri, refs);
        }
      } catch (error) {
        console.error('Failed to load task references:', error);
      }
    }
  }
  // Simplified command handlers using existing navigation components
  async setupTaskReference(uri: vscode.Uri, range: vscode.Range): Promise<void> {
    await this.tasks.setupTaskReference(
      uri, 
      range, 
      (uri, ref) => this.saveTaskReference(uri, ref),
      () => this._onDidChangeCodeLenses.fire()
    );
  }

  async changeFolder(range: vscode.Range, currentFolderId: string): Promise<void> {
    await this.tasks.changeFolder(
      range, 
      currentFolderId,
      (uri, ref) => this.saveTaskReference(uri, ref),
      () => this._onDidChangeCodeLenses.fire()
    );
  }

  async changeList(range: vscode.Range, folderId: string, currentListId: string): Promise<void> {
    await this.tasks.changeList(
      range, 
      folderId, 
      currentListId,
      (uri, range) => this.getTaskReference(uri, range),
      (uri, ref) => this.saveTaskReference(uri, ref),
      () => this._onDidChangeCodeLenses.fire()
    );
  }

  async changeTask(range: vscode.Range, listId: string, currentTaskId: string): Promise<void> {
    await this.tasks.changeTask(
      range, 
      listId, 
      currentTaskId,
      (uri, range) => this.getTaskReference(uri, range),
      (uri, ref) => this.saveTaskReference(uri, ref),
      () => this._onDidChangeCodeLenses.fire()
    );
  }

  async changeStatus(range: vscode.Range, taskId: string): Promise<void> {
    await this.tasks.changeStatus(
      range, 
      taskId,
      (uri, range) => this.getTaskReference(uri, range),
      (uri, ref) => this.saveTaskReference(uri, ref),
      () => this._onDidChangeCodeLenses.fire()
    );
  }

  async openInClickUp(taskId: string): Promise<void> {
    await this.tasks.openInClickUp(taskId);
  }

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public initialize(): void {
    this.loadReferences();
  }

  public dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }  async addTaskReferenceAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const position = editor.selection.active;
    const range = new vscode.Range(position, position);
    const uri = editor.document.uri.toString();
    
    // Check if there's already a reference at this exact position
    const existing = this.taskReferences.get(uri) || [];
    const duplicateIndex = existing.findIndex(ref => 
      ref.range.start.line === position.line &&
      ref.range.start.character === position.character
    );
    
    if (duplicateIndex !== -1) {
      vscode.window.showWarningMessage('A task reference already exists at this position');
      return;
    }
    
    // Create an empty task reference that will show the "Select ClickUp Task" CodeLens
    this.saveTaskReference(uri, {
      range
      // No task details yet - this will trigger the setup CodeLens
    });

    this._onDidChangeCodeLenses.fire();
    vscode.window.showInformationMessage('ClickUp task reference added. Click the CodeLens to set it up.');
  }
  // Debug methods for testing and troubleshooting
  debugShowStoredReferences(outputChannel: vscode.OutputChannel): void {
    this.debug.debugShowStoredReferences(outputChannel);
  }

  debugClearStoredReferences(): void {
    this.debug.debugClearStoredReferences(this.taskReferences, () => this._onDidChangeCodeLenses.fire());
  }

  cleanupDuplicateReferences(): void {
    this.debug.cleanupDuplicateReferences(() => this._onDidChangeCodeLenses.fire());
  }

  deleteTaskReference(uri: string, line: number, character: number): void {
    this.debug.deleteTaskReference(uri, line, character, () => this._onDidChangeCodeLenses.fire());
  }
}
