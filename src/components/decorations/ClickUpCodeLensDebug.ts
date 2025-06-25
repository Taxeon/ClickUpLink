import * as vscode from 'vscode';

interface TaskReference {
  range: vscode.Range;
  folderId?: string;
  folderName?: string;
  listId?: string;
  listName?: string;
  taskId?: string;
  taskName?: string;
  status?: string;
}

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
          outputChannel.appendLine(`  ${index + 1}. Position: Line ${line}, Char ${ref.range?.start?.character || 0}`);
          outputChannel.appendLine(`     Folder: ${ref.folderName || 'No folder'}`);
          outputChannel.appendLine(`     List: ${ref.listName || 'No list'}`);
          outputChannel.appendLine(`     Task: ${ref.taskName || 'No task'}`);
          outputChannel.appendLine(`     Status: ${ref.status || 'No status'}`);
          outputChannel.appendLine(`     Range valid: ${ref.range && ref.range.start !== undefined && ref.range.end !== undefined}`);
        });
      }
      
      outputChannel.appendLine(`Summary: Found ${totalRefs} task references in ${Object.keys(data).length} files`);
    } catch (error) {
      outputChannel.appendLine(`Error parsing stored references: ${error}`);
    }
    
    outputChannel.appendLine('=== END DEBUG REPORT ===');
  }

  debugClearStoredReferences(
    taskReferences: Map<string, TaskReference[]>,
    fireChangeEvent: () => void
  ): void {
    this.context.globalState.update('clickup.taskReferences', undefined);
    taskReferences.clear();
    fireChangeEvent();
    vscode.window.showInformationMessage('All task references cleared');
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
      vscode.window.showInformationMessage(`Cleanup complete. Removed ${removedCount} duplicate references.`);
    } catch (error) {
      vscode.window.showErrorMessage(`Cleanup failed: ${error}`);
    }
  }

  deleteTaskReference(uri: string, line: number, character: number, fireChangeEvent: () => void): void {
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
      
      fireChangeEvent();
      vscode.window.showInformationMessage('Task reference deleted successfully');
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
          lineNumber, 0,
          lineNumber + 1, 0  // Include the newline
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
}
