import * as vscode from 'vscode';
import { ClickUpCodeLensProvider } from '../components/decorations/ClickUpCodeLensProvider';
import { ReferencesTreeProvider } from '../views/ReferencesTreeProvider';

/**
 * Register task-related commands and functionality
 */
export function registerTaskCommands(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  codeLensProvider: ClickUpCodeLensProvider,
  referencesProvider: ReferencesTreeProvider
) {
  // Register CodeLens commands - these are the only commands needed for your breadcrumb functionality
  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.setupTaskReference',
    async (uri: vscode.Uri, range: vscode.Range) => {
      console.log('🎯 setupTaskReference command called');
      try {
        await codeLensProvider.setupTaskReference(uri, range);
        outputChannel.appendLine('✅ setupTaskReference completed successfully');
      } catch (error) {
        outputChannel.appendLine(`❌ ERROR in setupTaskReference: ${error}`);
        console.error('ERROR in setupTaskReference:', error);
      }
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeFolder',
    async (range: vscode.Range, folderId: string) => {
      await codeLensProvider.changeFolder(range, folderId);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeList',
    async (range: vscode.Range, folderId: string, listId: string) => {
      console.log('🎯 change list range:',range, '|listid:',listId, '|folderId:', folderId);
      await codeLensProvider.changeList(range, folderId, listId);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeTask',
    async (range: vscode.Range, listId: string, taskId: string) => {
      console.log('🎯 change Task range:',range, '|listid:',listId, '|taskId:', taskId);
      await codeLensProvider.changeTask(range, listId, taskId);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeStatus',
    async (range: vscode.Range, taskId: string) => {
      await codeLensProvider.changeStatus(range, taskId);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeAssignee',
    async (range: vscode.Range, taskId: string) => {
      await codeLensProvider.changeAssignee(range, taskId);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.openInClickUp',
    async (taskId: string) => {
      await codeLensProvider.openInClickUp(taskId);
    }
  ));  
  
  // Add command to create a task reference at cursor position
  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.addTaskReference',
    async () => {
      console.log('🎯 addTaskReference command triggered via hotkey');
      outputChannel.appendLine('🎯 addTaskReference command triggered via hotkey');
      try {
        await codeLensProvider.addTaskReferenceAtCursor();
        console.log('✅ addTaskReferenceAtCursor completed');
        outputChannel.appendLine('✅ addTaskReferenceAtCursor completed');
        
        // Refresh the task references tree view to show the new reference
        referencesProvider.refresh();
        console.log('🔄 Task references tree view refreshed');
        outputChannel.appendLine('🔄 Task references tree view refreshed');
      } catch (error) {
        console.error('❌ Error in addTaskReference:', error);
        outputChannel.appendLine(`❌ Error in addTaskReference: ${error}`);
        vscode.window.showErrorMessage(`Failed to add task reference: ${error}`);
      }
    }
  ));

  // Add command to refresh the task references tree view
  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.refreshTaskReferences',
    async () => {
      console.log('🔄 refreshTaskReferences command triggered');
      outputChannel.appendLine('🔄 refreshTaskReferences command triggered');
      
      try {
        // Show progress indicator since this might take a while
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Refreshing task references from ClickUp...",
          cancellable: false
        }, async (progress) => {
          progress.report({ message: "Fetching latest task data..." });
          
          // First clean up any potential duplicate references 
          // (especially important for JSX/TSX files)
          progress.report({ message: "Cleaning up any duplicate references..." });
          codeLensProvider.cleanupDuplicateReferences();
          
          // Check auth before continuing with the sync
          const isAuthenticated = await codeLensProvider.clickUpService.isAuthenticated();
          if (!isAuthenticated) {
            vscode.window.showWarningMessage('Not authenticated with ClickUp');
            // Still refresh local references without ClickUp sync
            await codeLensProvider.refreshTaskReferences(false);
            return;
          }
          
          // Use the enhanced refresh method with syncToClickUp=true for manual refresh
          progress.report({ message: "Syncing with ClickUp..." });
          await codeLensProvider.refreshTaskReferences(true);
          
          progress.report({ message: "Updating tree view..." });
          referencesProvider.refresh();
        });

        console.log('✅ Task references refreshed with fresh ClickUp data');
        outputChannel.appendLine('✅ Task references refreshed with fresh ClickUp data');
      } catch (error) {
        console.error('❌ Error refreshing task references:', error);
        outputChannel.appendLine(`❌ Error refreshing task references: ${error}`);
        vscode.window.showErrorMessage(`Failed to refresh task references: ${error}`);
      }
    }
  ));

  // Add debug commands for testing persistence
  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.debugShowReferences',
    () => {
      outputChannel.show(); // Show the output channel when debugging
      codeLensProvider.debugShowStoredReferences(outputChannel);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.debugClearReferences',
    () => {
      outputChannel.show();
      outputChannel.appendLine('🗑️ Clearing all stored task references...');
      codeLensProvider.debugClearStoredReferences();
      referencesProvider.refresh(); // Refresh the tree view immediately
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.clearCompletedReferences',
    () => {
      outputChannel.show();
      outputChannel.appendLine('🧹 Clearing completed task references...');
      codeLensProvider.clearCompletedReferences();
      referencesProvider.refresh(); // Refresh the tree view immediately
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.cleanupDuplicates',
    () => {
      outputChannel.show();
      outputChannel.appendLine('🧹 Cleaning up duplicate references...');
      codeLensProvider.cleanupDuplicateReferences();
    }
  ));

  // Register delete reference command
  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.deleteTaskReference',
    (item: any) => {
      if (item && item.uri && typeof item.line === 'number' && typeof item.character === 'number') {
        outputChannel.show();
        outputChannel.appendLine(`🗑️ Deleting reference at ${item.uri}:${item.line}:${item.character}`);
        codeLensProvider.deleteTaskReference(item.uri, item.line, item.character);
        referencesProvider.refresh();
      } else {
        vscode.window.showErrorMessage('Invalid reference data for deletion');
      }
    }
  ));

  // Add command to clear references with warning
  // Register command to open refresh settings
  context.subscriptions.push(vscode.commands.registerCommand('clickup.openRefreshSettings', () => {
    vscode.commands.executeCommand(
      'workbench.action.openSettings', 
      'clickupLink.references'
    );
  }));

  context.subscriptions.push(vscode.commands.registerCommand('clickup.clearReferencesWithWarning', async () => {
    const result = await vscode.window.showWarningMessage(
      'Are you sure you want to clear ALL task references? This action cannot be undone.',
      { modal: true },
      'Clear All References',
      'Cancel'
    );
    
    if (result === 'Clear All References') {
      codeLensProvider.debugClearStoredReferences();
      referencesProvider.refresh();
      outputChannel.appendLine('🗑️ User confirmed: All task references cleared');
      vscode.window.showInformationMessage('All task references have been cleared.');
    } else {
      outputChannel.appendLine('❌ User cancelled: Clear references operation cancelled');
    }
  }));

  // Add command to clean up corrupted references
  context.subscriptions.push(vscode.commands.registerCommand('clickup.cleanupReferences', async () => {
    try {
      const serialized = context.globalState.get<string>('clickup.taskReferences');
      if (!serialized) {
        vscode.window.showInformationMessage('No references to clean up.');
        return;
      }
      
      const data = JSON.parse(serialized);
      const cleanedData: any = {};
      let removedCount = 0;
      
      for (const uri in data) {
        const refs = data[uri] || [];
        const validRefs = refs.filter((ref: any) => 
          ref && ref.range && ref.range.start !== undefined && ref.range.end !== undefined
        );
        
        if (validRefs.length > 0) {
          cleanedData[uri] = validRefs;
        } else {
          removedCount++;
        }
      }
      
      context.globalState.update('clickup.taskReferences', JSON.stringify(cleanedData));
      // Force refresh by triggering code lens update
      vscode.commands.executeCommand('workbench.action.reloadWindow').then(() => {
        referencesProvider.refresh();
      });
      
      outputChannel.appendLine(`🧹 Cleanup complete: Removed ${removedCount} corrupted file entries`);
      vscode.window.showInformationMessage(`Cleanup complete. Removed ${removedCount} corrupted entries.`);
    } catch (error) {
      outputChannel.appendLine(`❌ Cleanup failed: ${error}`);
      vscode.window.showErrorMessage(`Cleanup failed: ${error}`);
    }
  }));

  // Add command to fix URI issues directly
  context.subscriptions.push(vscode.commands.registerCommand('clickup.fixUriIssues', async () => {
    try {
      outputChannel.show();
      outputChannel.appendLine('🔧 Starting URI fix process...');
      
      const serialized = context.globalState.get<string>('clickup.taskReferences');
      if (!serialized) {
        vscode.window.showInformationMessage('No references found to fix.');
        return;
      }
      
      const data = JSON.parse(serialized);
      const fixedData: any = {};
      let fixedCount = 0;
      let removedCount = 0;
      
      outputChannel.appendLine(`📊 Found ${Object.keys(data).length} file entries to examine`);
      
      for (const uri in data) {
        const refs = data[uri] || [];
        outputChannel.appendLine(`🔍 Examining URI: "${uri}"`);
        outputChannel.appendLine(`   - Has ${refs.length} references`);
        
        // Try to determine if this is a valid file path
        let fixedUri = uri;
        let isValid = false;
        
        // Check if file exists with current URI
        try {
          const parsedUri = vscode.Uri.parse(uri);
          const stat = await vscode.workspace.fs.stat(parsedUri);
          isValid = true;
          outputChannel.appendLine(`   ✅ URI is valid: ${uri}`);
        } catch {
          outputChannel.appendLine(`   ❌ URI is invalid: ${uri}`);
          
          // Try to fix common URI issues
          if (!uri.startsWith('file://')) {
            // Add file:// scheme if missing
            fixedUri = `file://${uri.replace(/\\/g, '/')}`;
            try {
              const parsedUri = vscode.Uri.parse(fixedUri);
              const stat = await vscode.workspace.fs.stat(parsedUri);
              isValid = true;
              fixedCount++;
              outputChannel.appendLine(`   🔧 Fixed by adding file:// scheme: ${fixedUri}`);
            } catch {}
          }
          
          if (!isValid && uri.includes('ClickUpLink')) {
            // Try to map Extension Development Host paths to actual workspace paths
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
              const workspaceRoot = workspaceFolders[0].uri.fsPath;
              // Extract filename from the URI
              const filename = uri.split('/').pop() || uri.split('\\').pop();
              if (filename) {
                fixedUri = vscode.Uri.file(`${workspaceRoot}/${filename}`).toString();
                try {
                  const parsedUri = vscode.Uri.parse(fixedUri);
                  const stat = await vscode.workspace.fs.stat(parsedUri);
                  isValid = true;
                  fixedCount++;
                  outputChannel.appendLine(`   🔧 Fixed by mapping to workspace: ${fixedUri}`);
                } catch {}
              }
            }
          }
        }
        
        if (isValid) {
          // Validate and clean references
          const validRefs = refs.filter((ref: any) => 
            ref && ref.range && 
            ref.range.start !== undefined && 
            ref.range.end !== undefined &&
            typeof ref.range.start.line === 'number' &&
            typeof ref.range.start.character === 'number'
          );
          
          if (validRefs.length > 0) {
            fixedData[fixedUri] = validRefs;
            outputChannel.appendLine(`   ✅ Kept ${validRefs.length} valid references`);
          } else {
            removedCount++;
            outputChannel.appendLine(`   🗑️ Removed file with no valid references`);
          }
        } else {
          removedCount++;
          outputChannel.appendLine(`   🗑️ Removed invalid file entry`);
        }
      }
      
      // Save the fixed data
      await context.globalState.update('clickup.taskReferences', JSON.stringify(fixedData));
      
      // Force refresh
      referencesProvider.refresh();
      vscode.commands.executeCommand('workbench.action.reloadWindow');
      
      outputChannel.appendLine(`🎉 Fix complete!`);
      outputChannel.appendLine(`   - Fixed ${fixedCount} URI issues`);
      outputChannel.appendLine(`   - Removed ${removedCount} invalid entries`);
      outputChannel.appendLine(`   - Final result: ${Object.keys(fixedData).length} valid files`);
      
      vscode.window.showInformationMessage(
        `URI fix complete! Fixed ${fixedCount} issues, removed ${removedCount} invalid entries.`
      );
      
    } catch (error) {
      outputChannel.appendLine(`❌ Fix failed: ${error}`);
      vscode.window.showErrorMessage(`URI fix failed: ${error}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeSubtask',
    async (range: vscode.Range, listId: string, parentTaskId: string, subtaskId: string) => {
      await codeLensProvider.changeSubtask(range, listId, parentTaskId, subtaskId);
    }
  ));
}
