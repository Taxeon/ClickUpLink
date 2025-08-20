import * as vscode from 'vscode';
import { TaskReference } from '../../types/index';
import { RefPositionManager } from './refPositionManagement';
import { OutputChannelManager } from '../../utils/outputChannels';

export class ClickUpCodeLensDebug {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  debugShowStoredReferences(outputChannel: vscode.OutputChannel): void {
    outputChannel.appendLine('=== DEBUGGING TASK REFERENCES ===');

    const serialized = this.context.globalState.get<string>('clickup.taskReferences');
    if (!serialized) {
      outputChannel.appendLine('No stored references found');
      return;
    }

    try {
      const data = JSON.parse(serialized);
      outputChannel.appendLine(`Total files with references: ${Object.keys(data).length}`);

      let totalRefs = 0;
      for (const uri in data) {
        const refs = data[uri] || [];
        totalRefs += refs.length;
        outputChannel.appendLine(`File: ${uri}`);
        outputChannel.appendLine(`  Number of references: ${refs.length}`);

        refs.forEach((ref: any, index: number) => {
          const line = (ref.range?.start?.line || 0) + 1;
          outputChannel.appendLine(
            `  ${index + 1}. Position: Line ${line}, Char ${ref.range?.start?.character || 0}`
          );
          outputChannel.appendLine(`     Folder: ${ref.folderName || 'No folder'}`);
          outputChannel.appendLine(`     List: ${ref.listName || 'No list'}`);
          outputChannel.appendLine(`     Task: ${ref.taskName || 'No task'}`);
          outputChannel.appendLine(`     Status: ${ref.status || 'No status'}`);
          outputChannel.appendLine(
            `     Workspace: ${ref.workspaceFolderPath || 'Legacy (no workspace)'}`
          );
          outputChannel.appendLine(
            `     Range valid: ${ref.range && ref.range.start !== undefined && ref.range.end !== undefined}`
          );
        });
      }

      outputChannel.appendLine(`Total references across all files: ${totalRefs}`);
      this.debugShowWorkspaceFiltering(outputChannel, data);
    } catch (error) {
      outputChannel.appendLine(`Error parsing stored references: ${error}`);
    }

    outputChannel.appendLine('=== END DEBUG ===');
    outputChannel.show();
  }

  debugShowWorkspaceFiltering(outputChannel: vscode.OutputChannel, data: any): void {
    outputChannel.appendLine('\n=== WORKSPACE FILTERING DEBUG ===');

    const currentWorkspacePath = this.getCurrentWorkspaceFolderPath();
    outputChannel.appendLine(
      `Current workspace path: ${currentWorkspacePath || 'None (no workspace open)'}`
    );

    if (!currentWorkspacePath) {
      outputChannel.appendLine('No workspace open - all references will be shown');
      return;
    }

    const filteredData = this.filterReferencesByWorkspace(data, currentWorkspacePath);
    const originalFileCount = Object.keys(data).length;
    const filteredFileCount = Object.keys(filteredData).length;

    let originalRefCount = 0;
    let filteredRefCount = 0;

    for (const uri in data) {
      originalRefCount += (data[uri] || []).length;
    }

    for (const uri in filteredData) {
      filteredRefCount += (filteredData[uri] || []).length;
    }

    outputChannel.appendLine(
      `Before filtering: ${originalRefCount} references in ${originalFileCount} files`
    );
    outputChannel.appendLine(
      `After filtering: ${filteredRefCount} references in ${filteredFileCount} files`
    );

    if (originalRefCount !== filteredRefCount) {
      outputChannel.appendLine(
        `Filtered out: ${originalRefCount - filteredRefCount} references from other workspaces`
      );
    }

    outputChannel.appendLine('=== END WORKSPACE FILTERING DEBUG ===');
  }

  private getCurrentWorkspaceFolderPath(): string | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return undefined;
  }

  private filterReferencesByWorkspace(data: any, currentWorkspacePath?: string): any {
    if (!currentWorkspacePath) {
      return data; // If no workspace, show all references
    }

    const filteredData: any = {};
    for (const uri in data) {
      const refs = data[uri] || [];
      const filteredRefs = refs.filter((ref: any) => {
        // If no workspace folder path is stored (legacy references), show them
        if (!ref.workspaceFolderPath) {
          return true;
        }
        return ref.workspaceFolderPath === currentWorkspacePath;
      });

      if (filteredRefs.length > 0) {
        filteredData[uri] = filteredRefs;
      }
    }
    return filteredData;
  }

  debugClearStoredReferences(
    taskReferences: Map<string, TaskReference[]>,
    fireChangeEvent: () => void
  ): void {
    const serialized = this.context.globalState.get<string>('clickup.taskReferences');
    if (!serialized) {
      vscode.window.showInformationMessage('No references found to clear');
      return;
    }

    try {
      const data = JSON.parse(serialized);
      const currentWorkspacePath = this.getCurrentWorkspaceFolderPath();

      // Count references in current workspace
      let totalRefs = 0;
      let workspaceRefs = 0;

      for (const uri in data) {
        const refs = data[uri] || [];
        totalRefs += refs.length;
        for (const ref of refs) {
          if (
            !currentWorkspacePath ||
            !ref.workspaceFolderPath ||
            ref.workspaceFolderPath === currentWorkspacePath
          ) {
            workspaceRefs++;
          }
        }
      }

      const workspaceInfo = currentWorkspacePath
        ? ` from current workspace (${vscode.workspace.workspaceFolders?.[0]?.name || 'current project'})`
        : '';
      const refsToRemove = currentWorkspacePath ? workspaceRefs : totalRefs;

      if (refsToRemove === 0) {
        vscode.window.showInformationMessage(`No task references found${workspaceInfo}`);
        return;
      }

      // Show confirmation dialog
      const result = vscode.window.showWarningMessage(
        `This will permanently remove ${refsToRemove} task references${workspaceInfo}. This action cannot be undone.`,
        { modal: true },
        'Clear All References',
        'Cancel'
      );

      result.then(choice => {
        if (choice === 'Clear All References') {
          if (currentWorkspacePath) {
            this.performClearWorkspaceReferences(
              data,
              currentWorkspacePath,
              taskReferences,
              fireChangeEvent
            );
          } else {
            // Clear all references (original behavior)
            this.context.globalState.update('clickup.taskReferences', undefined);
            taskReferences.clear();
            fireChangeEvent();
            vscode.window.showInformationMessage('All task references cleared');
          }
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to analyze references: ${error}`);
    }
  }

  private performClearWorkspaceReferences(
    data: any,
    currentWorkspacePath: string,
    taskReferences: Map<string, TaskReference[]>,
    fireChangeEvent: () => void
  ): void {
    try {
      const cleanedData: any = {};
      let removedCount = 0;

      for (const uri in data) {
        const refs = data[uri] || [];
        const filteredRefs: any[] = [];

        for (const ref of refs) {
          // Keep reference if not in current workspace
          if (ref.workspaceFolderPath && ref.workspaceFolderPath !== currentWorkspacePath) {
            filteredRefs.push(ref);
          } else {
            removedCount++;
          }
        }

        if (filteredRefs.length > 0) {
          cleanedData[uri] = filteredRefs;
        }
      }

      // Update global state
      this.context.globalState.update('clickup.taskReferences', JSON.stringify(cleanedData));

      // Update in-memory references for current workspace
      const currentWorkspaceUris: string[] = [];
      for (const [uri, refs] of taskReferences) {
        const documentUri = vscode.Uri.parse(uri);
        const workspacePath = this.getWorkspaceFolderPath(documentUri);
        if (workspacePath === currentWorkspacePath) {
          currentWorkspaceUris.push(uri);
        }
      }

      // Clear current workspace references from memory
      currentWorkspaceUris.forEach(uri => taskReferences.delete(uri));

      fireChangeEvent();
      vscode.window.showInformationMessage(
        `Cleared ${removedCount} task references from current workspace`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear workspace references: ${error}`);
    }
  }

  private getWorkspaceFolderPath(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder?.uri.fsPath;
  }

  cleanupDuplicateReferences(fireChangeEvent: () => void): void {
    const serialized = this.context.globalState.get<string>('clickup.taskReferences');
    if (!serialized) {
      vscode.window.showInformationMessage('No references to clean up');
      return;
    }

    try {
      const data = JSON.parse(serialized);
      const cleanedData: any = {};
      let removedCount = 0;

      for (const uri in data) {
        const refs = data[uri] || [];
        const uniqueRefs: any[] = [];
        const seen = new Set<string>();

        for (const ref of refs) {
          // Create a unique key based on position and task
          const key = `${ref.range?.start?.line || 0}-${ref.range?.start?.character || 0}-${ref.taskId || 'none'}`;

          if (!seen.has(key)) {
            seen.add(key);
            uniqueRefs.push(ref);
          } else {
            removedCount++;
          }
        }

        if (uniqueRefs.length > 0) {
          cleanedData[uri] = uniqueRefs;
        }
      }

      this.context.globalState.update('clickup.taskReferences', JSON.stringify(cleanedData));
      fireChangeEvent();
      vscode.window.showInformationMessage(
        `Cleanup complete. Removed ${removedCount} duplicate references.`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Cleanup failed: ${error}`);
    }
  }

  clearCompletedReferences(fireChangeEvent: () => void): void {
    const serialized = this.context.globalState.get<string>('clickup.taskReferences');
    if (!serialized) {
      vscode.window.showInformationMessage('No references found to clear');
      return;
    }

    try {
      const taskReferences = JSON.parse(serialized);
      const currentWorkspacePath = this.getCurrentWorkspaceFolderPath();
      const completedTaskRefs: any[] = [];

      // Count references before cleanup
      let totalRefs = 0;
      let completedRefs = 0;

      for (const uri in taskReferences) {
        const refs = taskReferences[uri] || [];
        for (const ref of refs) {
          // Only count references in current workspace
          if (
            !currentWorkspacePath ||
            !ref.workspaceFolderPath ||
            ref.workspaceFolderPath === currentWorkspacePath
          ) {
            totalRefs++;
            const status = (ref.taskStatus?.status || ref.status || '').toLowerCase();
            if (
              status.includes('complete') ||
              status.includes('done') ||
              status.includes('closed') ||
              status.includes('resolved')
            ) {
              completedRefs++;
            }
          }
        }
      }

      if (completedRefs === 0) {
        const workspaceInfo = currentWorkspacePath ? ' in current workspace' : '';
        vscode.window.showInformationMessage(`No completed task references found${workspaceInfo}`);
        return;
      }

      // Show confirmation dialog
      const workspaceInfo = currentWorkspacePath
        ? ` in current workspace (${vscode.workspace.workspaceFolders?.[0]?.name || 'current project'})`
        : '';
      const result = vscode.window.showWarningMessage(
        `This will permanently remove ${completedRefs} completed task references${workspaceInfo}. This action cannot be undone.`,
        { modal: true },
        'Clear Completed References',
        'Cancel'
      );

      result.then(async choice => {
        if (choice === 'Clear Completed References') {
          await this.performClearCompletedReferences(taskReferences, currentWorkspacePath, fireChangeEvent);
          
          // Trigger a refresh of task references via extension command
          // This ensures any removed anchors are properly reflected in the data model
          vscode.commands.executeCommand('clickuplink.refreshTaskReferences');
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to analyze references: ${error}`);
    }
  }

  private async performClearCompletedReferences(
    taskReferences: any,
    currentWorkspacePath: string | undefined,
    fireChangeEvent: () => void
  ): Promise<void> {
    try {
      // Output channel for logging      
      const outputChannel = OutputChannelManager.getChannel('ClickUp Link Debug');
      outputChannel.appendLine('🧹 Starting removal of completed task references...');
      
      let removedCount = 0;
      const completedTaskRefs: Array<{ uri: string; ref: any; taskId: string }> = [];

      // First, collect all completed task references
      for (const uri in taskReferences) {
        const refs = taskReferences[uri] || [];        
        
        for (const ref of refs) {
          const status = (ref.taskStatus?.status || ref.status || '').toLowerCase();
          const isCompleted =
            status.includes('complete') ||
            status.includes('done') ||
            status.includes('closed') ||
            status.includes('resolved');

          const inCurrentWorkspace =
            !currentWorkspacePath ||
            !ref.workspaceFolderPath ||
            ref.workspaceFolderPath === currentWorkspacePath;

          if (isCompleted && inCurrentWorkspace) {
            // Add to the list of references to remove
            completedTaskRefs.push({
              uri,
              ref,
              taskId: ref.taskId || ''
            });
          }
        }
      }

      // If no completed references were found, show a message and return
      if (completedTaskRefs.length === 0) {
        const workspaceInfo = currentWorkspacePath ? ' in current workspace' : '';
        vscode.window.showInformationMessage(`No completed task references found${workspaceInfo}.`);
        return;
      }
      
      outputChannel.appendLine(`🔍 Found ${completedTaskRefs.length} completed task references to remove`);
      
      // Group references by URI for more efficient processing
      const referencesByUri: Record<string, Array<{ref: any; taskId: string}>> = {};
      for (const item of completedTaskRefs) {
        if (!referencesByUri[item.uri]) {
          referencesByUri[item.uri] = [];
        }
        referencesByUri[item.uri].push({
          ref: item.ref,
          taskId: item.taskId
        });
      }
      
      // Process each file separately
      for (const uri in referencesByUri) {
        try {
          const refs = referencesByUri[uri];
          outputChannel.appendLine(`📄 Processing file: ${uri} with ${refs.length} references`);
          
          // Sort refs in descending order by line number to prevent line shifting issues
          refs.sort((a, b) => {
            const lineA = a.ref.range?.start?.line || 0;
            const lineB = b.ref.range?.start?.line || 0;
            return lineB - lineA; // Reverse sort (highest line number first)
          });
          
          // Remove clickup anchors one by one, from bottom to top
          for (const { ref, taskId } of refs) {
            try {
              outputChannel.appendLine(`📄 Processing remove for anchor at line ${ref.range?.start?.line}`);
              await this.removeClickupAnchor(uri, ref, taskId);
              removedCount++;
            } catch (error) {
              outputChannel.appendLine(`⚠️ Error removing anchor at line ${ref.range?.start?.line}: ${error}`);
            }
          }
        } catch (fileError) {
          outputChannel.appendLine(`❌ Error processing file ${uri}: ${fileError}`);
        }
      }

      outputChannel.appendLine(`✅ Removed ${removedCount} anchors from documents`);
      
      // Run a refresh to update the references list based on the remaining anchors
      // This is important - we're not updating the references data directly anymore
      fireChangeEvent();
      
      // Show success message
      const workspaceInfo = currentWorkspacePath ? ` from current workspace` : '';
      vscode.window.showInformationMessage(
        `Successfully removed ${removedCount} completed task references${workspaceInfo}.`
      );
      
      outputChannel.appendLine('🎉 Completed reference removal process');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear completed references: ${error}`);
    }
  }

  deleteTaskReference(
    uri: string,
    line: number,
    character: number,
    fireChangeEvent: () => void
  ): void {
    const serialized = this.context.globalState.get<string>('clickup.taskReferences');
    if (!serialized) {
      vscode.window.showWarningMessage('No references found to delete');
      return;
    }

    try {
      // Parse the stored references data
      const data = JSON.parse(serialized);
      const refs = data[uri] || [];

      // Find the reference at the specified position
      const referenceToDelete = refs.find((ref: any) => {
        const refLine = ref.range?.start?.line || 0;
        const refChar = ref.range?.start?.character || 0;
        return refLine === line && refChar === character;
      });

      if (!referenceToDelete) {
        vscode.window.showWarningMessage('Reference not found at specified location');
        return;
      }

      // Store the taskId for anchor removal
      const taskId = referenceToDelete.taskId;

      // Remove the reference from stored data
      const filteredRefs = refs.filter((ref: any) => {
        const refLine = ref.range?.start?.line || 0;
        const refChar = ref.range?.start?.character || 0;
        return !(refLine === line && refChar === character);
      });

      // Update stored references
      if (filteredRefs.length > 0) {
        data[uri] = filteredRefs;
      } else {
        delete data[uri];
      }

      // Save changes to global state
      this.context.globalState.update('clickup.taskReferences', JSON.stringify(data));

      // Remove the anchor tag from the document
      this.removeClickupAnchor(uri, referenceToDelete, taskId)
        .catch(error => {
          console.error('Error removing clickup anchor:', error);
        })
        .finally(() => {
          // Always fire the change event to refresh CodeLenses and sidebar
          fireChangeEvent();
        });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete reference: ${error}`);
      // Still try to fire change event to avoid UI getting out of sync
      fireChangeEvent();
    }
  }

  /**
   * Public method to remove a ClickUp anchor tag from a document
   * @param uri Document URI
   * @param reference Reference object with position information
   * @param taskId Task ID to remove
   */
  async removeAnchor(uri: string, reference: any, taskId: string): Promise<void> {
    return this.removeClickupAnchor(uri, reference, taskId);
  }

  private async removeClickupAnchor(uri: string, reference: any, taskId: string): Promise<void> {
    try {
      // Try to open the document
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
      const editor = await vscode.window.showTextDocument(document);
      
      // First look for the clickup anchor tag near the reference position
      const range = reference.range ? 
        new vscode.Range(
          reference.range.start.line, 
          reference.range.start.character, 
          reference.range.end.line, 
          reference.range.end.character
        ) : 
        new vscode.Range(0, 0, 0, 0);
      
      // Create an output channel for debugging      
      const outputChannel = OutputChannelManager.getChannel('ClickUp Link Debug');
      outputChannel.appendLine(`Attempting to remove clickup anchor for task ${taskId} at line ${range.start.line}`);
      
      // Look for clickup marker near the reference position
      const markerInfo = RefPositionManager.findClickupAnchor(document, range);
      
      if (markerInfo) {

        // Create edit to remove the entire line with the clickup tag
        const edit = new vscode.WorkspaceEdit();
        const lineRange = new vscode.Range(
          markerInfo.line,
          0,
          markerInfo.line + 1,
          0 // Include the newline
        );
        edit.delete(document.uri, lineRange);
        
        // Apply the edit
        await vscode.workspace.applyEdit(edit);
        outputChannel.appendLine(`✅ Removed clickup anchor for task ${taskId}`);
      } else {
        outputChannel.appendLine(`⚠️ Clickup anchor not found for task ${taskId} at line ${range.start.line}`);
      }
    } catch (error) {
      console.error('Failed to remove clickup anchor from document:', error);
      throw error; // Propagate the error to be caught in the calling method
    }
  
  }

  /**
   * Inserts a new //clickup:[TaskId] anchor comment directly above the given range's start line.
   * @param documentUri The URI of the document.
   * @param range The range where the anchor should be inserted above.
   * @param taskId The ClickUp Task ID to anchor.
   */
  static async createAnchor(range: vscode.Range, taskId: string): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const document = editor.document;
      const anchorLine = range.start.line;
      
      // Determine the appropriate comment style based on file type
      let anchorText = `// clickup:${taskId}`;
      
      // For JSX/TSX files, make sure we use the proper comment format
      const languageId = document.languageId.toLowerCase();
      console.log(`Creating anchor for language: ${languageId}`);
      
      if (languageId === 'javascriptreact' || 
          languageId === 'typescriptreact' || 
          languageId === 'jsx' || 
          languageId === 'tsx' ||
          document.fileName.toLowerCase().endsWith('.jsx') ||
          document.fileName.toLowerCase().endsWith('.tsx')) {
        // For React files, we'll still use line comments but log this special case
        console.log(`Using JSX/TSX specific comment for file: ${document.fileName}`);
      }
      
      await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(anchorLine, 0), anchorText + '\n');
      });
      
      console.log(`✅ Successfully created anchor: ${anchorText}`);
    } catch (err) {
      console.error('Error in createAnchor:', err);
    }
  }

  /**
   * Updates the existing //clickup:[TaskId] anchor comment above the given range's start line.
   * Using a simpler approach that removes the old anchor and creates a new one.
   * @param range The range where the anchor should be updated above.
   * @param newTaskId The new ClickUp Task ID to update in the anchor.
   */
  static async updateAnchor(
    range: vscode.Range,
    newTaskId: string
  ): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const document = editor.document;
      const uri = document.uri.toString();
      
      console.log(`Updating anchor to task ID ${newTaskId} at line ${range.start.line}`);
      
      // Step 1: Delete the line containing the clickup tag
      // We'll just find the clickup marker and delete the line directly
      
      // Check current line and a few lines above
      const currentLine = range.start.line;
      const linesToCheck = [currentLine];
      for (let i = 1; i <= 3; i++) {
        if (currentLine - i >= 0) linesToCheck.push(currentLine - i);
      }
      if (currentLine < document.lineCount - 1) linesToCheck.push(currentLine + 1);
      
      // Sort lines to check closest lines first
      linesToCheck.sort((a, b) => Math.abs(a - currentLine) - Math.abs(b - currentLine));
      
      // Check each line for a clickup tag
      let foundTag = false;
      for (const line of linesToCheck) {
        try {
          const lineText = document.lineAt(line).text;
          const anchorRegex = /(\/\/|\/\*|#|--|'|\*|<!--)[ \t]{0,2}clickup:[a-zA-Z0-9_-]+/i;
          
          if (anchorRegex.test(lineText)) {
            // Found a clickup tag, delete this line
            await editor.edit(editBuilder => {
              editBuilder.delete(new vscode.Range(line, 0, line + 1, 0));
            });
            console.log(`Deleted existing clickup anchor at line ${line}`);
            foundTag = true;
            break;
          }
        } catch (e) {
          console.error(`Error checking line ${line} for clickup tag:`, e);
        }
      }
      
      if (!foundTag) {
        console.log(`No existing clickup anchor found to remove`);
      }
      
      // Step 2: Create a new anchor with the new task ID
      await ClickUpCodeLensDebug.createAnchor(range, newTaskId);
      
      console.log(`✅ Updated anchor to task ID ${newTaskId}`);
    } catch (err) {
      console.error('Error in updateAnchor:', err);
    }
  }
}
