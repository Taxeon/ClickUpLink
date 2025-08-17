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
    const allKnownReferences = this.taskReferences.get(document.uri.toString()) || [];
    RefPositionManager.updateReferencesFromMarkers(document, allKnownReferences);

    const activeReferences = RefPositionManager.getActiveReferences(document.uri.toString());

    // Inflate any new references that have a taskId but are missing other details
    for (const ref of activeReferences) {
      if (ref.taskId && !ref.taskName) {
          const newReference = await this.tasks.buildReferenceFromTaskId(
            ref.taskId,
            document,
            ref.range
          );
          if (newReference) {
            this.saveTaskReference(document.uri.toString(), newReference);
          }
      }
    }

    // After inflation, re-fetch active references to ensure they are up-to-date
    // This is crucial because saveTaskReference updates the global state and map
    const finalReferencesForLenses = RefPositionManager.getActiveReferences(document.uri.toString())
      .map(activeRef => this.getTaskReference(document.uri.toString(), activeRef.range))
      .filter((ref): ref is TaskReference => ref !== undefined);

    const allLenses = await Promise.all(
      finalReferencesForLenses.map(ref => this.createCodeLensForReference(ref, document))
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
        if (!task || !task.id) {
          // If task is not found or invalid, do not proceed with creating task-specific lenses
          return lenses;
        }
        ref.description = task?.description || ref.description;
        // If subtask, fetch parent description as well if needed
        if (ref.parentTaskId) {
          const parentTask = await this.clickUpService.getTaskDetails(ref.parentTaskId);
          if (parentTask && parentTask.id) {
            ref.parentTaskName = parentTask?.name || ref.parentTaskName;
            ref.parentTaskDescription = parentTask?.description || ref.parentTaskDescription;
          }
        }
      } catch (err) {
        // If there's an error fetching the task, do not proceed with creating task-specific lenses
        console.error(`Error fetching task ${ref.taskId}:`, err);
        return lenses;
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
      this.tasks.taskGetter,
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
    await this.executeTaskCommand(range, this.tasks.taskGetter.changeFolder, currentFolderId);
  }

  async changeList(range: vscode.Range, folderId: string, currentListId: string): Promise<void> {
    await this.executeTaskCommand(range, this.tasks.taskGetter.changeList, folderId, currentListId);
  }

  async changeTask(range: vscode.Range, listId: string, currentTaskId: string): Promise<void> {
    await this.executeTaskCommand(range, this.tasks.taskGetter.changeTask, listId, currentTaskId);
  }

  async changeSubtask(
    range: vscode.Range,
    listId: string,
    parentTaskId: string,
    subtaskId: string
  ): Promise<void> {
    await this.executeTaskCommand(range, this.tasks.taskGetter.changeSubtask, listId, parentTaskId, subtaskId);
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
    
    // Refresh with latest ClickUp data on startup (async, don't block initialization)
    this.refreshFromClickUpOnStartup();
    
    // Setup event response to document saves to update changes to anchor comments
    vscode.workspace.onDidSaveTextDocument(document => {
      RefPositionManager.purgeOrphanedReferencesOnSave(document.uri.toString(), (uri, refs) => {
        this.taskReferences.set(uri, refs);
        this.persistReferences();
      });
      this._onDidChangeCodeLenses.fire();
    });
  }

  /**
   * Refresh from ClickUp on startup - don't block initialization
   */
  private async refreshFromClickUpOnStartup(): Promise<void> {
    await this.refreshFromClickUpWithOptions({ 
      silent: true, 
      checkAuth: true 
    });
  }

  /**
   * Unified refresh method that handles both manual and automatic refresh scenarios
   */
  public async refreshFromClickUpWithOptions(options: {
    silent?: boolean;
    checkAuth?: boolean;
    showProgress?: boolean;
    onSuccess?: () => void;
  } = {}): Promise<void> {
    const { silent = false, checkAuth = false, showProgress = false, onSuccess } = options;

    try {
      // Check authentication if requested
      if (checkAuth) {
        const isAuthenticated = await this.clickUpService.isAuthenticated();
        if (!isAuthenticated) {
          if (!silent) {
            vscode.window.showWarningMessage('Not authenticated with ClickUp');
          } else {
            console.log('ℹ️ Not authenticated, skipping ClickUp refresh');
          }
          return;
        }
      }

      if (!silent) {
        console.log('🔄 Refreshing task references from ClickUp...');
      }

      // Execute the refresh
      await this.refreshFromClickUp();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      const errorMessage = `Could not refresh from ClickUp: ${error}`;
      if (!silent) {
        console.error('❌', errorMessage);
        vscode.window.showErrorMessage(`Failed to refresh task references: ${error}`);
      } else {
        console.warn('⚠️', errorMessage);
      }
    }
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

  /**
   * Refresh all task references with fresh data from ClickUp API
   * This scans workspace documents for ClickUp references, then fetches fresh data from ClickUp API
   * This ensures we only refresh references that actually exist in the code
   */

  async refreshFromClickUp(): Promise<void> {
    console.log('🔄 Starting fresh data refresh from ClickUp API...');
    
    // Step 1: Get all text documents in the workspace
    const allDocuments = await vscode.workspace.findFiles('**/*.*', '**/node_modules/**');
    console.log(`📂 Found ${allDocuments.length} documents in workspace`);
    
    // Step 2: Collect active references from all documents by scanning for anchor tags
    const activeReferences = new Map<string, TaskReference[]>();
    const uniqueTaskIds = new Set<string>();
    
    // Track existing references to preserve metadata that might not be in the anchor
    const existingReferences = new Map<string, TaskReference>();
    for (const [uri, references] of this.taskReferences.entries()) {
      for (const ref of references) {
        if (ref.taskId) {
          existingReferences.set(ref.taskId, ref);
        }
      }
    }
    
    // Process each document to find ClickUp reference markers
    for (const docUri of allDocuments) {
      try {
        const document = await vscode.workspace.openTextDocument(docUri);
        const uri = document.uri.toString();
        
        // Get all known references for this document from our storage
        const allKnownReferences = this.taskReferences.get(uri) || [];
        
        // Use RefPositionManager to find all active references in this document
        RefPositionManager.updateReferencesFromMarkers(document, allKnownReferences);
        const documentActiveRefs = RefPositionManager.getActiveReferences(uri);
        
        if (documentActiveRefs.length > 0) {
          console.log(`� Found ${documentActiveRefs.length} active references in ${uri}`);
          activeReferences.set(uri, documentActiveRefs);
          
          // Collect unique task IDs to refresh
          for (const ref of documentActiveRefs) {
            if (ref.taskId) {
              uniqueTaskIds.add(ref.taskId);
              
              // Log the found reference
              console.log(`   - Line ${ref.range.start.line}: Task ${ref.taskId} (${ref.taskName || 'unnamed'})`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing document ${docUri.toString()}:`, error);
      }
    }
    
    console.log(`📊 Total documents with references: ${activeReferences.size}`);
    console.log(`📊 Total unique task IDs to refresh: ${uniqueTaskIds.size}`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    try {
      // Process only documents with active references
      for (const [uri, references] of activeReferences.entries()) {
        const updatedReferences: TaskReference[] = [];
        
        for (const ref of references) {
          if (ref.taskId) {
            try {
              console.log(`🔍 Refreshing task ${ref.taskId} for ${uri}...`);
              
              // Fetch latest task details from ClickUp API
              const freshTask = await this.clickUpService.getTaskDetails(ref.taskId);
              
              if (freshTask && freshTask.id) {
                // Start with existing reference data if available to preserve metadata
                const baseRef = existingReferences.get(ref.taskId) || ref;
                
                // Update the reference with fresh data
                const updatedRef: TaskReference = {
                  ...baseRef,
                  // Always use the current position from the document scan
                  range: ref.range,
                  taskName: freshTask.name,
                  description: freshTask.description,
                  status: freshTask.status?.status || baseRef.status,
                  taskStatus: freshTask.status || baseRef.taskStatus,
                  assignee: freshTask.assignees && freshTask.assignees.length > 0 ? freshTask.assignees[0] : undefined,
                  assignees: freshTask.assignees || [],
                  lastUpdated: new Date().toISOString(),
                  // Update hierarchy info if available
                  listId: freshTask.list?.id || baseRef.listId,
                  listName: freshTask.list?.name || baseRef.listName,
                  folderId: freshTask.folder?.id || baseRef.folderId,
                  folderName: freshTask.folder?.name || baseRef.folderName,
                  // Ensure we have the workspace folder path
                  workspaceFolderPath: this.getWorkspaceFolderPath(vscode.Uri.parse(uri)),
                };
                
                // If this is a subtask, also refresh parent task info
                if (freshTask.parent) {
                  try {
                    const parentTask = await this.clickUpService.getTaskDetails(freshTask.parent);
                    if (parentTask && parentTask.id) {
                      updatedRef.parentTaskId = parentTask.id;
                      updatedRef.parentTaskName = parentTask.name;
                      updatedRef.parentTaskDescription = parentTask.description;
                    }
                  } catch (parentError) {
                    console.warn(`⚠️ Could not refresh parent task ${freshTask.parent}:`, parentError);
                  }
                }
                
                updatedReferences.push(updatedRef);
                updatedCount++;
                console.log(`✅ Successfully refreshed task ${ref.taskId}`);
              } else {
                console.warn(`⚠️ Task ${ref.taskId} not found or invalid, keeping existing reference`);
                updatedReferences.push(ref);
              }
            } catch (error) {
              console.error(`❌ Failed to refresh task ${ref.taskId}:`, error);
              // Keep the existing reference if API call fails
              updatedReferences.push(ref);
              errorCount++;
            }
          } else {
            // No taskId, keep the unconfigured reference as-is
            updatedReferences.push(ref);
          }
        }
        
        // Update the references for this URI
        this.taskReferences.set(uri, updatedReferences);
      }
      
      // Clean up any references that no longer have corresponding anchor tags
      this.cleanupOrphanedReferences();
      
      // Persist the updated references
      this.persistReferences();
      
      // Fire events to refresh UI
      this._onDidChangeCodeLenses.fire();
      
      console.log(`🎉 Refresh complete: Updated ${updatedCount} task references, ${errorCount} errors`);
      
      if (updatedCount > 0) {
        vscode.window.showInformationMessage(
          `Refreshed ${updatedCount} task references from ClickUp${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
        );
      } else {
        vscode.window.showInformationMessage('No task references to refresh');
      }
      
    } catch (error) {
      console.error('❌ Critical error during refresh from ClickUp:', error);
      vscode.window.showErrorMessage(`Failed to refresh from ClickUp: ${error}`);
    }
  }


  /**
   * Remove references that no longer have corresponding anchor tags in documents
   * This helps keep the global state clean and prevents orphaned references
   */
  private cleanupOrphanedReferences(): void {
    console.log('🧹 Cleaning up orphaned references...');
    
    const activeUris = new Set<string>();
    const activeTaskIds = new Set<string>();
    
    // Collect all active URIs and task IDs
    for (const [uri, refs] of this.taskReferences.entries()) {
      if (refs.some(ref => ref.taskId)) {
        activeUris.add(uri);
        refs.forEach(ref => {
          if (ref.taskId) activeTaskIds.add(ref.taskId);
        });
      }
    }
    
    // Get the original data from storage to clean
    const serialized = this.context.globalState.get<string>('clickup.taskReferences');
    if (!serialized) return;
    
    try {
      const data = JSON.parse(serialized);
      let removedUriCount = 0;
      let removedRefCount = 0;
      
      // Clean up stored data based on active references
      const cleanedData: any = {};
      
      for (const uri in data) {
        const refs = data[uri] || [];
        
        // If the URI is not active, skip it entirely
        if (!activeUris.has(uri)) {
          removedUriCount++;
          removedRefCount += refs.length;
          continue;
        }
        
        // Filter references within active URIs to only keep those with active task IDs
        const validRefs = refs.filter((ref: any) => 
          !ref.taskId || activeTaskIds.has(ref.taskId)
        );
        
        if (validRefs.length > 0) {
          cleanedData[uri] = validRefs;
        } else {
          removedUriCount++;
        }
        
        removedRefCount += (refs.length - validRefs.length);
      }
      
      // Update storage with cleaned data
      this.context.globalState.update('clickup.taskReferences', JSON.stringify(cleanedData));
      
      if (removedRefCount > 0) {
        console.log(`🧹 Removed ${removedRefCount} orphaned references from ${removedUriCount} files`);
      } else {
        console.log('✅ No orphaned references found');
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up orphaned references:', error);
    }
  }

  private getWorkspaceFolderPath(uri: vscode.Uri): string | undefined {
    return vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
  }

  private getCurrentWorkspaceFolderPath(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
}
