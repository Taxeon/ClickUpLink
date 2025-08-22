import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { ClickUpCodeLensTasks } from './ClickUpCodeLensTasks';
import { ClickUpCodeLensDebug } from './taskRefMaintenance';
import { TaskReference } from '../../types/index';
import { RefPositionManager } from './refPositionManagement';
import { BuildTaskRef } from './buildTaskRef';
import { OutputChannelManager } from '../../utils/outputChannels';

export class ClickUpCodeLensProvider implements vscode.CodeLensProvider {
  private static instance: ClickUpCodeLensProvider;
  private context: vscode.ExtensionContext;
  readonly clickUpService: ClickUpService;
  private taskReferences: Map<string, TaskReference[]> = new Map();
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  private taskRefBuilder: BuildTaskRef;
  private referencesTreeProvider: any; // Will store the tree provider for refreshing the UI
  private refreshIntervalTimer: NodeJS.Timeout | undefined;
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
    const isGoFile = document.languageId === 'go' || document.fileName.toLowerCase().endsWith('.go');
    const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
    
    if (isGoFile) {
      outputChannel.appendLine(`🚀 GO FILE: provideCodeLenses for ${document.fileName}`);
    }
    
    const allKnownReferences = this.taskReferences.get(document.uri.toString()) || [];
    //RefPositionManager.updateReferencesFromMarkers(document, allKnownReferences);

    const activeReferences = RefPositionManager.getActiveReferences(document.uri.toString());
    
    if (isGoFile) {
      outputChannel.appendLine(`📋 GO FILE: Found ${activeReferences.length} active references`);
      if (activeReferences.length > 0) {
        activeReferences.forEach((ref, i) => {
          outputChannel.appendLine(`  ${i+1}. Line ${ref.range.start.line}: TaskID=${ref.taskId || 'none'}, TaskName=${ref.taskName || 'none'}`);
        });
      }
    }

    // Check authentication for Go files
    if (isGoFile) {
      try {
        const isAuthenticated = await this.clickUpService.isAuthenticated();
        outputChannel.appendLine(`🔐 GO FILE: Authentication status: ${isAuthenticated ? 'Authenticated' : 'Not authenticated'}`);
        
        if (!isAuthenticated) {
          outputChannel.appendLine('⚠️ GO FILE: Not authenticated - this will prevent task data from loading');
          // Still continue to show the setup lenses
        }
      } catch (err) {
        outputChannel.appendLine(`⚠️ GO FILE: Error checking authentication: ${err}`);
      }
    }

    // Inflate any new references that have a taskId but are missing other details
    let needToSaveChanges = false;
    for (const ref of activeReferences) {
      if (ref.taskId && !ref.taskName) {
        if (isGoFile) {
          outputChannel.appendLine(`🔄 GO FILE: Building reference for taskId ${ref.taskId} at line ${ref.range.start.line}`);
        }
          
        try {
          const newReference = await this.tasks.buildReferenceFromTaskId(
            ref.taskId,
            document,
            ref.range
          );
          
          if (newReference) {
            if (isGoFile) {
              outputChannel.appendLine(`✅ GO FILE: Successfully built reference for taskId ${ref.taskId}`);
              outputChannel.appendLine(`  TaskName: ${newReference.taskName || 'none'}`);
              outputChannel.appendLine(`  FolderName: ${newReference.folderName || 'none'}`);
              outputChannel.appendLine(`  ListName: ${newReference.listName || 'none'}`);
            }
            
            this.saveTaskReference(document.uri.toString(), newReference, true); // Skip individual persists
            needToSaveChanges = true;
          } else if (isGoFile) {
            outputChannel.appendLine(`❌ GO FILE: Failed to build reference for taskId ${ref.taskId} - returned undefined`);
          }
        } catch (error) {
          if (isGoFile) {
            outputChannel.appendLine(`❌ GO FILE: Error building reference for taskId ${ref.taskId}: ${error}`);
          }
          console.error(`Error building reference for taskId ${ref.taskId}:`, error);
        }
      }
    }
    
    // Only persist once if any changes were made
    if (needToSaveChanges) {
      if (isGoFile) {
        outputChannel.appendLine(`💾 GO FILE: Persisting references after building`);
      }
      this.persistReferences();
    }

    // After inflation, re-fetch active references to ensure they are up-to-date
    // This is crucial because saveTaskReference updates the global state and map
    const finalReferencesForLenses = RefPositionManager.getActiveReferences(document.uri.toString())
      .map(activeRef => this.getTaskReference(document.uri.toString(), activeRef.range))
      .filter((ref): ref is TaskReference => ref !== undefined);

    if (isGoFile) {
      outputChannel.appendLine(`📋 GO FILE: Final references for lenses: ${finalReferencesForLenses.length}`);
      finalReferencesForLenses.forEach((ref, i) => {
        outputChannel.appendLine(`  ${i+1}. Line ${ref.range.start.line}: TaskID=${ref.taskId || 'none'}, TaskName=${ref.taskName || 'none'}`);
      });
    }

    // Create code lenses with extra error handling for Go files
    const allLenses = await Promise.all(
      finalReferencesForLenses.map(async (ref) => {
        try {
          const lenses = await this.createCodeLensForReference(ref, document);
          if (isGoFile) {
            outputChannel.appendLine(`🔍 GO FILE: Created ${lenses.length} code lenses for reference at line ${ref.range.start.line}`);
          }
          return lenses;
        } catch (error) {
          if (isGoFile) {
            outputChannel.appendLine(`❌ GO FILE: Error creating code lens for reference at line ${ref.range.start.line}: ${error}`);
          }
          console.error(`Error creating code lens for reference:`, error);
          // Return a simple error lens if we can't create the proper one
          return [
            new vscode.CodeLens(ref.range, {
              title: '⚠️ Error loading task reference',
              command: 'clickuplink.setupTaskReference',
              arguments: [document.uri, ref.range],
            }),
          ];
        }
      })
    );

    if (isGoFile) {
      outputChannel.appendLine(`✅ GO FILE: Returning ${allLenses.flat().length} code lenses in total`);
    }

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
    
    // Check if this is a Go file
    const editor = vscode.window.activeTextEditor;
    const isGoFile = editor && (editor.document.languageId === 'go' || editor.document.fileName.toLowerCase().endsWith('.go'));
    const outputChannel = isGoFile ? OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug') : null;
    
    if (isGoFile && outputChannel) {
      outputChannel.appendLine(`🔍 GO FILE: Creating breadcrumbs for task at line ${line}`);
      outputChannel.appendLine(`  TaskId: ${ref.taskId || 'none'}`);
      outputChannel.appendLine(`  TaskName: ${ref.taskName || 'none'}`);
    }

    // Fetch latest description from ClickUp
    if (ref.taskId) {
      if (isGoFile && outputChannel) {
        outputChannel.appendLine(`🔄 GO FILE: Fetching task details for ${ref.taskId}`);
      }
      
      try {
        const task = await this.clickUpService.getTaskDetails(ref.taskId);
        if (!task || !task.id) {
          if (isGoFile && outputChannel) {
            outputChannel.appendLine(`⚠️ GO FILE: Task not found or invalid for ${ref.taskId}`);
          }
          // If task is not found or invalid, provide a fallback lens
          if (isGoFile) {
            return [
              new vscode.CodeLens(new vscode.Range(line, 0, line, 10), {
                title: `⚠️ Task Not Found: ${ref.taskId}`,
                command: 'clickuplink.setupTaskReference',
                arguments: [editor?.document.uri, ref.range],
              }),
            ];
          }
          return lenses;
        }
        
        if (isGoFile && outputChannel) {
          outputChannel.appendLine(`✅ GO FILE: Successfully fetched task details for ${ref.taskId}`);
          outputChannel.appendLine(`  Task name: ${task.name}`);
        }
        
        ref.description = task?.description || ref.description;
        ref.taskName = task?.name || ref.taskName; // Ensure task name is updated
        
        // If subtask, fetch parent description as well if needed
        if (ref.parentTaskId) {
          if (isGoFile && outputChannel) {
            outputChannel.appendLine(`🔄 GO FILE: Fetching parent task details for ${ref.parentTaskId}`);
          }
          
          try {
            const parentTask = await this.clickUpService.getTaskDetails(ref.parentTaskId);
            if (parentTask && parentTask.id) {
              ref.parentTaskName = parentTask?.name || ref.parentTaskName;
              ref.parentTaskDescription = parentTask?.description || ref.parentTaskDescription;
              
              if (isGoFile && outputChannel) {
                outputChannel.appendLine(`✅ GO FILE: Successfully fetched parent task details for ${ref.parentTaskId}`);
              }
            }
          } catch (parentErr) {
            if (isGoFile && outputChannel) {
              outputChannel.appendLine(`⚠️ GO FILE: Error fetching parent task ${ref.parentTaskId}: ${parentErr}`);
            }
            console.error(`Error fetching parent task ${ref.parentTaskId}:`, parentErr);
          }
        }
      } catch (err) {
        // If there's an error fetching the task, provide a fallback lens for Go files
        if (isGoFile && outputChannel) {
          outputChannel.appendLine(`❌ GO FILE: Error fetching task ${ref.taskId}: ${err}`);
          
          // For Go files, return a special error lens instead of empty lenses
          return [
            new vscode.CodeLens(new vscode.Range(line, 0, line, 10), {
              title: `⚠️ Error loading task: ${err}`,
              command: 'clickuplink.setupTaskReference',
              arguments: [editor?.document.uri, ref.range],
              tooltip: `Error: ${err}\nTry refreshing or re-authenticating with ClickUp`
            }),
          ];
        }
        
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

  /**
   * Saves a task reference to the in-memory cache and persists to globalState
   * This is a lower-level function that doesn't trigger UI updates
   * @param skipPersist If true, don't persist to globalState (use for batch operations)
   */
  private saveTaskReference(uri: string, reference: TaskReference, skipPersist: boolean = false): void {
    const references = this.taskReferences.get(uri) || [];

    // Add workspace folder path if missing
    reference.workspaceFolderPath ??= this.getWorkspaceFolderPath(vscode.Uri.parse(uri));

    // Find and replace existing or add new
    const existingIndex = references.findIndex(
      ref =>
        ref.range.start.line === reference.range.start.line &&
        ref.range.start.character === reference.range.start.character
    );

    // Check if we're actually changing anything to avoid unnecessary updates
    let hasChanges = false;
    
    if (existingIndex !== -1) {
      // Only update if there are actual changes
      const existing = references[existingIndex];
      if (JSON.stringify(existing) !== JSON.stringify(reference)) {
        references[existingIndex] = reference;
        hasChanges = true;
      }
    } else {
      // New reference
      references.push(reference);
      hasChanges = true;
    }

    if (hasChanges) {
      this.taskReferences.set(uri, references);
      
      // Only persist to globalState if not skipped and there were changes
      if (!skipPersist) {
        this.persistReferences();
        const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
        outputChannel.appendLine(`🔍 saveTaskReference: Updated reference cache`);
      }
    }
    // No UI updates here - those are handled by the caller or document events
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

    // Create new reference with just range and workspace folder path
    const newRef = {
      range,
      workspaceFolderPath: this.getWorkspaceFolderPath(editor.document.uri),
    };

    // Save to task references map
    this.saveTaskReference(uri, newRef);
    
    // IMPORTANT: Also directly register with the RefPositionManager to ensure it shows up
    // Get current active references or create new array
    const currentRefs = RefPositionManager.getActiveReferences(uri);
    const updatedRefs = [...currentRefs, newRef];
    
    // Update the RefPositionManager's map with our new reference
    RefPositionManager.setActiveReferences(uri, updatedRefs);
    
    // Force refresh so CodeLens and task reference pane update immediately
    const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
    outputChannel.appendLine(`🔍 addTaskReferfenceAtCursor: Triggering Codelense Change`);
    this._onDidChangeCodeLenses.fire();
    vscode.window.showInformationMessage(
      'ClickUp task reference added. Click the CodeLens to set it up.'
    );
  }

  // Utility methods
  public refresh(): void {
    const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
    outputChannel.appendLine(`🔍 refresh(): Triggering CodeLens Change`);
       
    // Fire the event to update CodeLenses
    this._onDidChangeCodeLenses.fire();
  }
  
  public initialize(): void {
    this.loadReferences();
    
    // Refresh with latest ClickUp data on startup (async, don't block initialization)
    this.refreshFromClickUpOnStartup();
    
    // Setup automatic periodic refresh based on user settings
    this.setupAutoRefresh();
    
    // Setup event response to document saves to update changes to anchor comments
    vscode.workspace.onDidSaveTextDocument(document => {
      const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
      outputChannel.appendLine(`🔍 Document saved: ${document.fileName}`);
      
      // Purge orphaned references (those without anchors) on save
      RefPositionManager.purgeOrphanedReferencesOnSave(document.uri.toString(), (uri, refs) => {
        this.taskReferences.set(uri, refs);
        this.persistReferences();
        
        outputChannel.appendLine(`📋 Updated references after save: ${refs.length} references remain`);
      });
      
      // No need to manually trigger CodeLens update - onDidChangeTextDocument handles this
    });
    
    // Listen for configuration changes to update refresh timer if needed
    vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration('clickupLink.references.autoRefreshEnabled') ||
        event.affectsConfiguration('clickupLink.references.refreshIntervalMinutes')
      ) {
        // Reconfigure the refresh timer when settings change
        this.setupAutoRefresh();
      }
    });
  }
  
  /**
   * Connects the references tree provider to the CodeLens provider
   * This allows the CodeLens provider to refresh the tree view when references change
   * @param treeProvider The references tree provider instance
   */
  public setReferencesTreeProvider(treeProvider: any): void {
    this.referencesTreeProvider = treeProvider;
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
          
          // Still refresh local references without ClickUp sync
          await this.refreshTaskReferences(false);
          return;
        }
      }

      if (!silent) {
        console.log('🔄 Refreshing task references from ClickUp...');
      }

      // Execute the refresh with ClickUp sync
      await this.refreshTaskReferences(true);

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

  /**
   * Sets up automatic periodic refresh of task references based on user settings
   */
  private setupAutoRefresh(): void {
    // Clear any existing timer
    if (this.refreshIntervalTimer) {
      clearInterval(this.refreshIntervalTimer);
      this.refreshIntervalTimer = undefined;
    }
    
    // Check if auto-refresh is enabled
    const config = vscode.workspace.getConfiguration('clickupLink.references');
    const autoRefreshEnabled = config.get<boolean>('autoRefreshEnabled', true);
    
    if (autoRefreshEnabled) {
      // Get refresh interval in minutes (default: 60 minutes, min: 5, max: 1440)
      let intervalMinutes = config.get<number>('refreshIntervalMinutes', 60);
      
      // Enforce min/max bounds
      intervalMinutes = Math.max(5, Math.min(1440, intervalMinutes));
      
      // Convert to milliseconds
      const intervalMs = intervalMinutes * 60 * 1000;
      
      const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
      outputChannel.appendLine(`⏰ Setting up auto-refresh every ${intervalMinutes} minutes`);
      
      // Set up the timer
      this.refreshIntervalTimer = setInterval(() => {
        outputChannel.appendLine(`⏰ Auto-refresh timer triggered after ${intervalMinutes} minutes`);
        
        // Use the enhanced refresh method with syncToClickUp=true for timed auto-refresh
        this.refreshTaskReferences(true).catch(error => {
          console.warn('Auto-refresh error:', error);
        });
      }, intervalMs);
      
      console.log(`⏰ Automatic refresh configured for every ${intervalMinutes} minutes`);
    } else {
      console.log('⏰ Automatic refresh is disabled');
    }
  }

  public dispose(): void {
    // Clean up the refresh timer when the extension is deactivated
    if (this.refreshIntervalTimer) {
      clearInterval(this.refreshIntervalTimer);
      this.refreshIntervalTimer = undefined;
    }
    
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
    });
  }

  /**
   * Main refresh task references function with enhanced functionality
   * @param syncToClickUp When true, fetches fresh data from ClickUp API; false only updates local references based on document changes
   */
  public async refreshTaskReferences(syncToClickUp: boolean = false): Promise<void> {
    const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
    outputChannel.appendLine(`🔄 refreshTaskReferences called with syncToClickUp=${syncToClickUp}`);
    
    try {
      // Step 1: Get all text documents in the workspace
      const allDocuments = await vscode.workspace.findFiles('**/*.*', '**/node_modules/**');
      outputChannel.appendLine(`📂 Found ${allDocuments.length} documents in workspace to scan for anchor tags`);
      
      // Step 2: Track existing references to compare changes later
      const existingReferences = new Map<string, Map<string, TaskReference>>();
      // Also create a taskId-based lookup for references that might have moved
      const existingRefsByTaskId = new Map<string, TaskReference>();
      
      for (const [uri, references] of this.taskReferences.entries()) {
        const uriRefs = new Map<string, TaskReference>();
        for (const ref of references) {
          // Create a unique key based on line and character position
          const posKey = `${ref.range.start.line}:${ref.range.start.character}`;
          uriRefs.set(posKey, ref);
          
          // Also store by taskId for quicker lookup when positions change
          if (ref.taskId) {
            existingRefsByTaskId.set(ref.taskId, ref);
          }
        }
        existingReferences.set(uri, uriRefs);
      }
      
      // Step 3: Gather the ClickUp anchor tags, their associated document and line number
      const activeReferences = new Map<string, TaskReference[]>();
      const uniqueTaskIds = new Set<string>();
      
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
            outputChannel.appendLine(`📄 Found ${documentActiveRefs.length} active references in ${uri}`);
            activeReferences.set(uri, documentActiveRefs);
            
            // Collect unique task IDs to refresh
            for (const ref of documentActiveRefs) {
              if (ref.taskId) {
                uniqueTaskIds.add(ref.taskId);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error processing document ${docUri.toString()}:`, error);
          outputChannel.appendLine(`❌ Error processing document ${docUri.toString()}: ${error}`);
        }
      }
      
      // Step 4: Compare to stored reference data to check for changes
      let positionChanges = 0;
      let deletedReferences = 0;
      let addedReferences = 0;
      
      // Track all references we'll update in this operation
      const updatedReferences = new Map<string, TaskReference[]>();
      
      // Process each document with active references
      for (const [uri, references] of activeReferences.entries()) {
        const existingUriRefs = existingReferences.get(uri) || new Map<string, TaskReference>();
        const updatedUriRefs: TaskReference[] = [];
        
        // Find new and updated references
        for (const ref of references) {
          const posKey = `${ref.range.start.line}:${ref.range.start.character}`;
          const existingRef = existingUriRefs.get(posKey);
          
          // Get previously saved reference data if available (from cleanStateForDocument)
          const taskRefsByTaskId = (this as any).taskRefsByTaskId as Map<string, any> || new Map();
          const savedRef = ref.taskId ? taskRefsByTaskId.get(ref.taskId) : undefined;
          
          if (existingRef) {
            // Reference exists at this position - check for taskId changes
            // Only keep references that have a taskId
            if (!existingRef.taskId && !ref.taskId) {
              // Both refs are unconfigured - skip
              outputChannel.appendLine(`🚫 Skipping unconfigured reference at ${uri}:${posKey}`);
            } else if (existingRef.taskId !== ref.taskId) {
              outputChannel.appendLine(`🔄 Task ID changed at ${uri}:${posKey} from ${existingRef.taskId} to ${ref.taskId}`);
              // Keep all properties from existing ref but update taskId
              updatedUriRefs.push({
                ...existingRef,
                taskId: ref.taskId
              });
              positionChanges++;
            } else {
              // Keep position but preserve existing data
              // Even if the position is the same in the posKey, we need to ensure the range is updated
              // This is important when lines are added or removed above the reference
              updatedUriRefs.push({
                ...existingRef,
                range: ref.range
              });
            }
            
            // Remove from existing map to track what's been processed
            existingUriRefs.delete(posKey);
          } 
          // Handle references that moved to a new position
          else if (savedRef && ref.taskId) {
            outputChannel.appendLine(`🔄 Reference with taskId ${ref.taskId} moved to new position ${posKey}`);
            // Use the saved reference data but update the position
            updatedUriRefs.push({
              ...savedRef,
              range: ref.range
            });
            positionChanges++;
            
            // If this was in existingUriRefs at a different position, remove it
            for (const [oldPosKey, oldRef] of existingUriRefs.entries()) {
              if (oldRef.taskId === ref.taskId) {
                existingUriRefs.delete(oldPosKey);
                break;
              }
            }
          } else {
            // New reference at this position - only include if it has a taskId
            if (ref.taskId) {
              outputChannel.appendLine(`➕ New reference at ${uri}:${posKey} with task ID ${ref.taskId}`);
              updatedUriRefs.push(ref);
              addedReferences++;
            } else {
              outputChannel.appendLine(`🚫 Skipping unconfigured reference at ${uri}:${posKey}`);
            }
          }
        }
        
        // Any refs left in existingUriRefs were not found in the document
        // They're either deleted or moved
        deletedReferences += existingUriRefs.size;
        for (const [posKey, ref] of existingUriRefs.entries()) {
          outputChannel.appendLine(`➖ Reference at ${uri}:${posKey} no longer exists`);
        }
        
        // Store the updated references for this URI
        updatedReferences.set(uri, updatedUriRefs);
      }
      
      // For any URI not in activeReferences but in existingReferences, all refs were removed
      for (const [uri, refs] of existingReferences.entries()) {
        if (!activeReferences.has(uri)) {
          deletedReferences += refs.size;
          outputChannel.appendLine(`🗑️ All references removed from ${uri}`);
        }
      }
      
      outputChannel.appendLine(`📊 Changes detected: ${addedReferences} added, ${deletedReferences} deleted, ${positionChanges} position/ID changes`);
      
      // Step 5: If syncToClickUp is true, fetch latest data from ClickUp API
      if (syncToClickUp && uniqueTaskIds.size > 0) {
        outputChannel.appendLine(`🔄 Syncing with ClickUp for ${uniqueTaskIds.size} unique task IDs...`);
        
        // Build a map of all existing references by task ID for faster lookup
        const refsByTaskId = new Map<string, TaskReference[]>();
        for (const [uri, refs] of updatedReferences.entries()) {
          for (const ref of refs) {
            if (ref.taskId) {
              if (!refsByTaskId.has(ref.taskId)) {
                refsByTaskId.set(ref.taskId, []);
              }
              refsByTaskId.get(ref.taskId)!.push(ref);
            }
          }
        }
        
        let refreshedCount = 0;
        let errorCount = 0;
        
        // Process each unique task ID
        for (const taskId of uniqueTaskIds) {
          try {
            outputChannel.appendLine(`🔍 Refreshing task ${taskId} from ClickUp API...`);
            
            // Fetch latest task details from ClickUp API
            const freshTask = await this.clickUpService.getTaskDetails(taskId);
            
            if (freshTask && freshTask.id) {
              // Update all references for this task ID
              const refsForTask = refsByTaskId.get(taskId) || [];
              
              for (const ref of refsForTask) {
                // Update the reference with fresh data
                ref.taskName = freshTask.name;
                ref.description = freshTask.description;
                ref.status = freshTask.status?.status || ref.status;
                ref.taskStatus = freshTask.status || ref.taskStatus;
                ref.assignee = freshTask.assignees && freshTask.assignees.length > 0 ? freshTask.assignees[0] : undefined;
                ref.assignees = freshTask.assignees || [];
                ref.lastUpdated = new Date().toISOString();
                ref.listId = freshTask.list?.id || ref.listId;
                ref.listName = freshTask.list?.name || ref.listName;
                ref.folderId = freshTask.folder?.id || ref.folderId;
                ref.folderName = freshTask.folder?.name || ref.folderName;
                
                // If this is a subtask, also refresh parent task info
                if (freshTask.parent) {
                  try {
                    const parentTask = await this.clickUpService.getTaskDetails(freshTask.parent);
                    if (parentTask && parentTask.id) {
                      ref.parentTaskId = parentTask.id;
                      ref.parentTaskName = parentTask.name;
                      ref.parentTaskDescription = parentTask.description;
                    }
                  } catch (parentError) {
                    console.warn(`⚠️ Could not refresh parent task ${freshTask.parent}:`, parentError);
                  }
                }
              }
              
              refreshedCount += refsForTask.length;
              outputChannel.appendLine(`✅ Successfully refreshed ${refsForTask.length} references for task ${taskId}`);
            } else {
              outputChannel.appendLine(`⚠️ Task ${taskId} not found or invalid in ClickUp API`);
              errorCount++;
            }
          } catch (error) {
            console.error(`❌ Failed to refresh task ${taskId}:`, error);
            outputChannel.appendLine(`❌ Failed to refresh task ${taskId}: ${error}`);
            errorCount++;
          }
        }
        
        outputChannel.appendLine(`🔄 ClickUp sync complete: Refreshed ${refreshedCount} references, ${errorCount} errors`);
        
        // Show notification only for API sync
        if (refreshedCount > 0) {
          vscode.window.showInformationMessage(
            `Refreshed ${refreshedCount} task references from ClickUp${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
          );
        } else if (errorCount === 0) {
          vscode.window.showInformationMessage('No task references to refresh from ClickUp');
        }
      }
      
      // Update task references map with our processed references
      // Note: Unconfigured tasks have already been filtered out during processing
      this.taskReferences.clear();
      for (const [uri, refs] of updatedReferences.entries()) {
        if (refs.length > 0) {
          this.taskReferences.set(uri, refs);
        }
      }
      
      // Clean up any references that no longer have corresponding anchor tags
      this.cleanupOrphanedReferences();
      
      // Persist all changes to storage
      this.persistReferences();
      
      // Fire events to refresh UI
      outputChannel.appendLine(`🔍 refreshTaskReferences: Triggering CodeLens Change`);
      this._onDidChangeCodeLenses.fire();
      
      // Also refresh the references tree view to ensure unconfigured references are removed
      if (this.referencesTreeProvider) {
        outputChannel.appendLine(`🔄 Refreshing task references tree view`);
        this.referencesTreeProvider.refresh();
      }
      
      // Clean up the temporary taskRefsByTaskId map
      if ((this as any).taskRefsByTaskId) {
        outputChannel.appendLine(`🧹 Cleaning up temporary task reference data (${(this as any).taskRefsByTaskId.size} items)`);
        (this as any).taskRefsByTaskId = undefined;
      }
      
      outputChannel.appendLine(`✅ refreshTaskReferences complete`);
      
    } catch (error) {
      console.error('❌ Critical error during refreshTaskReferences:', error);
      outputChannel.appendLine(`❌ Critical error during refreshTaskReferences: ${error}`);
      
      // Always show critical errors
      vscode.window.showErrorMessage(`Failed to refresh task references: ${error}`);
      
      // Re-throw the error so the caller can handle it
      throw error;
    }
  }

  /**
   * Legacy method that now calls the enhanced refreshTaskReferences
   * @param silent If true, suppress non-critical notifications and messages
   * @deprecated Use refreshTaskReferences(true) instead
   */
  async refreshFromClickUp(silent: boolean = false): Promise<void> {
    console.log('🔄 Starting fresh data refresh from ClickUp API...');
    return this.refreshTaskReferences(true);
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
  
  /**
   * Cleans up the state for a specific document to avoid duplicate references
   * @param uri The document URI to clean
   */
  public async cleanStateForDocument(uri: string): Promise<void> {
    const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
    outputChannel.appendLine(`🧹 Cleaning state for document: ${uri}`);
    
    // Clear this document from the RefPositionManager but keep a reference to existing tasks
    // This preserves task information (taskId, taskName, etc.) while allowing positions to be updated
    const existingRefs = this.taskReferences.get(uri) || [];
    const taskRefsByTaskId = new Map<string, any>();
    
    // Create a map of existing references by taskId for easy lookup
    for (const ref of existingRefs) {
      if (ref.taskId) {
        taskRefsByTaskId.set(ref.taskId, ref);
        outputChannel.appendLine(`� Saved reference data for taskId: ${ref.taskId}`);
      }
    }
    
    // Only clear the document state in RefPositionManager, not the task references themselves
    RefPositionManager.clearDocumentState(uri);
    outputChannel.appendLine(`🔍 Cleared position state but preserved ${taskRefsByTaskId.size} task reference data items`);
    
    // Store this map for use during refresh
    (this as any).taskRefsByTaskId = taskRefsByTaskId;
  }
}
