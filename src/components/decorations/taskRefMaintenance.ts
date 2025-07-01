import * as vscode from 'vscode';
import { TaskReference } from '../../types/index';

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
      const data = JSON.parse(serialized);
      const currentWorkspacePath = this.getCurrentWorkspaceFolderPath();

      // Count references before cleanup
      let totalRefs = 0;
      let completedRefs = 0;

      for (const uri in data) {
        const refs = data[uri] || [];
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

      result.then(choice => {
        if (choice === 'Clear Completed References') {
          this.performClearCompletedReferences(data, currentWorkspacePath, fireChangeEvent);
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to analyze references: ${error}`);
    }
  }

  private performClearCompletedReferences(
    data: any,
    currentWorkspacePath: string | undefined,
    fireChangeEvent: () => void
  ): void {
    try {
      const cleanedData: any = {};
      let removedCount = 0;

      for (const uri in data) {
        const refs = data[uri] || [];
        const filteredRefs: any[] = [];

        for (const ref of refs) {
          const status = (ref.taskStatus?.status || ref.status || '').toLowerCase();
          const isCompleted =
            status.includes('complete') ||
            status.includes('done') ||
            status.includes('closed') ||
            status.includes('resolved');

          // Keep reference if:
          // 1. Not completed, OR
          // 2. Not in current workspace (if workspace filtering is active)
          const inCurrentWorkspace =
            !currentWorkspacePath ||
            !ref.workspaceFolderPath ||
            ref.workspaceFolderPath === currentWorkspacePath;

          if (!isCompleted || !inCurrentWorkspace) {
            filteredRefs.push(ref);
          } else {
            removedCount++;
          }
        }

        if (filteredRefs.length > 0) {
          cleanedData[uri] = filteredRefs;
        }
      }

      this.context.globalState.update('clickup.taskReferences', JSON.stringify(cleanedData));
      fireChangeEvent();

      const workspaceInfo = currentWorkspacePath ? ` from current workspace` : '';
      vscode.window.showInformationMessage(
        `Successfully removed ${removedCount} completed task references${workspaceInfo}.`
      );
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

      this.context.globalState.update('clickup.taskReferences', JSON.stringify(data));

      // Also remove any comment text from the document if it exists
      this.removeCommentTextFromDocument(uri, referenceToDelete);

      // Fire the change event to refresh CodeLenses and sidebar
      fireChangeEvent();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete reference: ${error}`);
    }
  }

  private async removeCommentTextFromDocument(uri: string, reference: any): Promise<void> {
    try {
      // Check if there's comment text to remove
      if (!reference.commentText) {
        return; // Nothing to remove from document
      }

      // Try to open the document
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
      const editor = await vscode.window.showTextDocument(document);

      // Get the line where the reference is located
      const lineNumber = reference.range?.start?.line || 0;
      const line = document.lineAt(lineNumber);
      const lineText = line.text;

      // Check if the line contains the comment text
      if (lineText.includes(reference.commentText)) {
        // Create edit to remove the comment line
        const edit = new vscode.WorkspaceEdit();
        const lineRange = new vscode.Range(
          lineNumber,
          0,
          lineNumber + 1,
          0 // Include the newline
        );
        edit.delete(document.uri, lineRange);

        // Apply the edit
        await vscode.workspace.applyEdit(edit);
      }
    } catch (error) {
      console.error('Failed to remove comment text from document:', error);
      // Don't show error to user since the main deletion was successful
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
      const anchorLine = range.start.line;
      const anchorText = `// clickup:${taskId}`;
      await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(anchorLine, 0), anchorText + '\n');
      });
    } catch (err) {
      console.error('Error in createAnchor:', err);
    }
  }

  /**
   * Updates the existing //clickup:[TaskId] anchor comment above the given range's start line.
   * If not found, does nothing.
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
      const anchorLine = range.start.line - 1;
      if (anchorLine < 0) return;
      const lineText = document.lineAt(anchorLine).text;
      const anchorRegex = /^\/\/\s*clickup:.*$/i;
      if (anchorRegex.test(lineText)) {
        const newAnchorText = `// clickup:${newTaskId}`;
        await editor.edit(editBuilder => {
          editBuilder.replace(
            new vscode.Range(anchorLine, 0, anchorLine, lineText.length),
            newAnchorText
          );
        });
      }
    } catch (err) {
      console.error('Error in updateAnchor:', err);
    }
  }
}
