import * as vscode from 'vscode';
import { apiRequest } from '../hooks/useApi';

/**
 * Register workspace-related commands and functionality
 */
export function registerWorkspaceCommands(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
) {
  // Add command to select current space 
  context.subscriptions.push(vscode.commands.registerCommand('clickup.selectSpace', async (workspaceId?: string) => {
    try {
      if (!workspaceId) {
        vscode.window.showWarningMessage('No workspace ID provided');
        return;
      }

      outputChannel.appendLine(`🔍 Selecting space for workspace ID: ${workspaceId}`);
      
      // Get spaces from ClickUp API
      const { ClickUpService } = await import('../services/clickUpService');
      const clickUpService = ClickUpService.getInstance(context);
      
      const spacesResponse = await clickUpService.getSpaces(workspaceId);
      
      // Handle different possible response structures
      let spaces = null;
      if (spacesResponse && spacesResponse.spaces && Array.isArray(spacesResponse.spaces)) {
        spaces = spacesResponse.spaces;
      } else if (spacesResponse && Array.isArray(spacesResponse)) {
        spaces = spacesResponse;
      } else if (spacesResponse && spacesResponse.data && Array.isArray(spacesResponse.data)) {
        spaces = spacesResponse.data;
      }
      
      if (!spaces || spaces.length === 0) {
        vscode.window.showWarningMessage('No spaces found in this workspace');
        return;
      }
        // Create quick pick items
      const items: vscode.QuickPickItem[] = spaces.map((space: any) => ({
        label: space.name,
        description: `Space ID: ${space.id}`,
        detail: 'Select this space as your active workspace space'
      }));
      
      // Show space selection
      const selectedSpace = await vscode.window.showQuickPick(items, {
        title: 'Select Active Space',
        placeHolder: 'Choose the space you want to work with',
        ignoreFocusOut: true
      });
      
      if (selectedSpace) {
        // Extract space ID from description
        const spaceIdMatch = selectedSpace.description?.match(/Space ID: (\w+)/);
        const spaceId = spaceIdMatch ? spaceIdMatch[1] : null;
        
        if (spaceId) {
          // Store the current space selection
          await context.globalState.update('clickup.currentSpaceId', spaceId);
          await context.globalState.update('clickup.currentSpaceName', selectedSpace.label);
          
          outputChannel.appendLine(`✅ Active space set to: ${selectedSpace.label} (${spaceId})`);
          vscode.window.showInformationMessage(`Active space set to: ${selectedSpace.label}`);
          
          // Refresh the workspace view to show the new current space
          vscode.commands.executeCommand('clickup.refreshWorkspaceView');
        }
      }
    } catch (error) {
      outputChannel.appendLine(`❌ Error selecting space: ${error}`);
      vscode.window.showErrorMessage(`Failed to select space: ${error}`);
    }
  }));

  // Add command to browse workspace structure
  context.subscriptions.push(vscode.commands.registerCommand('clickup.browseWorkspaceStructure', async (workspaceId?: string) => {
    try {
      if (!workspaceId) {
        vscode.window.showWarningMessage('No workspace ID provided');
        return;
      }
        outputChannel.appendLine(`🔍 Browse workspace structure called with ID: ${workspaceId}`);
      
      // Show progress while loading workspace data
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading ClickUp workspace structure...",
        cancellable: true
      }, async (progress) => {        progress.report({ increment: 0 });
        
        // Get workspace structure from ClickUp API
        const { ClickUpService } = await import('../services/clickUpService');
        const clickUpService = ClickUpService.getInstance(context);
        
        try {
          const spacesResponse = await clickUpService.getSpaces(workspaceId);
          
          const items: vscode.QuickPickItem[] = [];
          
          // Handle different possible response structures
          let spaces = null;
          if (spacesResponse && spacesResponse.spaces && Array.isArray(spacesResponse.spaces)) {
            spaces = spacesResponse.spaces;
          } else if (spacesResponse && Array.isArray(spacesResponse)) {
            spaces = spacesResponse;
          } else if (spacesResponse && spacesResponse.data && Array.isArray(spacesResponse.data)) {
            spaces = spacesResponse.data;
          }
          
          outputChannel.appendLine(`🔍 Processed spaces: ${spaces ? spaces.length : 0} spaces found`);
          
          if (spaces && spaces.length > 0) {
            items.push({ label: '📁 Spaces in this Workspace', kind: vscode.QuickPickItemKind.Separator });
            
            for (const space of spaces) {
              items.push({
                label: `📁 ${space.name}`,
                description: `Space ID: ${space.id}`,
                detail: `Click to view folders and lists in this space`
              });
            }
          } else {
            items.push({
              label: '❌ No spaces found',
              description: `Workspace ID: ${workspaceId}`,
              detail: 'This workspace appears to be empty or you may not have access'
            });          }
          
          progress.report({ increment: 100 });
          
          // Now show the actual QuickPick with the loaded data
          const selectedSpace = await vscode.window.showQuickPick(items, {
            title: 'ClickUp Workspace Structure',
            placeHolder: 'Select a space to explore further',
            ignoreFocusOut: true
          });
          
          if (selectedSpace) {
            outputChannel.appendLine(`✅ User selected space: ${selectedSpace.label}`);
            
            // Extract the space ID from the description
            const spaceIdMatch = selectedSpace.description?.match(/Space ID: (\d+)/);
            const spaceId = spaceIdMatch ? spaceIdMatch[1] : null;
            
            if (spaceId) {
              outputChannel.appendLine(`🔍 Fetching folders for space ID: ${spaceId}`);
                // Show another progress indicator for fetching folders
              await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: `Loading folders and lists...`,
                cancellable: false
              }, async (progress) => {                try {
                  // Get folders for this space
                  const foldersResponse = await clickUpService.getFolders(spaceId);
                  
                  const folderItems: vscode.QuickPickItem[] = [];
                  
                  // Handle folders response
                  let folders = null;
                  if (foldersResponse && foldersResponse.folders && Array.isArray(foldersResponse.folders)) {
                    folders = foldersResponse.folders;
                  } else if (foldersResponse && Array.isArray(foldersResponse)) {
                    folders = foldersResponse;
                  }
                  
                  if (folders && folders.length > 0) {
                    folderItems.push({ 
                      label: `📁 Folders in ${selectedSpace.label.replace('📁 ', '')}`, 
                      kind: vscode.QuickPickItemKind.Separator 
                    });
                    
                    for (const folder of folders) {
                      folderItems.push({
                        label: `📁 ${folder.name}`,
                        description: `Folder ID: ${folder.id}`,
                        detail: `Click to view lists in this folder`
                      });
                      
                      // Also try to get lists for each folder
                      try {
                        const listsResponse = await clickUpService.getLists(folder.id);
                        let lists = null;
                        if (listsResponse && listsResponse.lists && Array.isArray(listsResponse.lists)) {
                          lists = listsResponse.lists;
                        } else if (listsResponse && Array.isArray(listsResponse)) {
                          lists = listsResponse;
                        }
                        
                        if (lists && lists.length > 0) {
                          for (const list of lists) {
                            folderItems.push({
                              label: `  📋 ${list.name}`,
                              description: `List ID: ${list.id}`,
                              detail: `List in folder: ${folder.name}`
                            });
                          }
                        }
                      } catch (listError) {
                        outputChannel.appendLine(`⚠️ Could not fetch lists for folder ${folder.name}: ${listError}`);
                      }
                    }
                  } else {
                    folderItems.push({
                      label: '❌ No folders found',
                      description: `Space: ${selectedSpace.label}`,
                      detail: 'This space appears to be empty or may contain folderless lists'
                    });                  }
                  
                  // Show the folders and lists
                  const selectedItem = await vscode.window.showQuickPick(folderItems, {
                    title: `Folders and Lists in ${selectedSpace.label.replace('📁 ', '')}`,
                    placeHolder: 'Select a folder or list to work with',
                    ignoreFocusOut: true
                  });
                  
                  if (selectedItem) {
                    outputChannel.appendLine(`✅ User selected: ${selectedItem.label}`);
                    
                    // Check if it's a folder or list and handle accordingly
                    if (selectedItem.label.startsWith('📁') && !selectedItem.label.includes('Folders in')) {
                      // It's a folder - show lists within the folder
                      const folderIdMatch = selectedItem.description?.match(/Folder ID: (\d+)/);
                      if (folderIdMatch) {
                        const folderId = folderIdMatch[1];
                        await showListsInFolder(folderId, selectedItem.label, clickUpService, outputChannel);
                      }
                    } else if (selectedItem.label.startsWith('  📋') || selectedItem.label.startsWith('📋')) {
                      // It's a list - show tasks within the list
                      const listIdMatch = selectedItem.description?.match(/List ID: (\d+)/);
                      if (listIdMatch) {
                        const listId = listIdMatch[1];
                        await showTasksInList(listId, selectedItem.label.trim(), clickUpService, outputChannel);
                      }
                    } else {
                      // It's a separator or informational item
                      vscode.window.showInformationMessage(`Selected: ${selectedItem.label} - ${selectedItem.description}`);
                    }
                  } else {
                    outputChannel.appendLine(`❌ User cancelled folder/list selection`);
                  }
                  
                } catch (error) {
                  outputChannel.appendLine(`❌ Error fetching folders: ${error}`);
                  vscode.window.showErrorMessage(`Failed to load folders: ${error}`);
                }
              });
            } else {
              vscode.window.showErrorMessage('Could not extract space ID from selection');
            }
          } else {
            outputChannel.appendLine(`❌ User cancelled or no selection made`);
          }
        } catch (error) {
          outputChannel.appendLine(`❌ Error calling getSpaces: ${error}`);
          vscode.window.showErrorMessage(`Failed to load workspace structure: ${error}`);
        }
      });
      
    } catch (error) {
      outputChannel.appendLine(`❌ Error browsing workspace: ${error}`);
      vscode.window.showErrorMessage(`Error browsing workspace: ${error}`);
    }
  }));
}

// Helper function to show lists within a folder
async function showListsInFolder(folderId: string, folderName: string, clickUpService: any, outputChannel: vscode.OutputChannel) {  try {
    const listsResponse = await clickUpService.getLists(folderId);
    
    let lists = listsResponse?.lists || [];
    if (!Array.isArray(lists) && Array.isArray(listsResponse)) {
      lists = listsResponse;
    }
    
    if (lists.length === 0) {
      vscode.window.showInformationMessage(`No lists found in folder: ${folderName}`);
      return;
    }
    
    const listItems: vscode.QuickPickItem[] = lists.map((list: any) => ({
      label: `📋 ${list.name}`,
      description: `List (${list.id})`,
      detail: `Click to view tasks in this list`
    }));
    
    const selectedList = await vscode.window.showQuickPick(listItems, {
      placeHolder: `Select a list in ${folderName}`,
      canPickMany: false
    });
    
    if (selectedList) {
      const listIdMatch = selectedList.description?.match(/\((\d+)\)$/);
      if (listIdMatch) {
        const listId = listIdMatch[1];
        await showTasksInList(listId, selectedList.label, clickUpService, outputChannel);
      }
    }
  } catch (error) {
    outputChannel.appendLine(`❌ Error fetching lists for folder: ${error}`);
    vscode.window.showErrorMessage(`Failed to fetch lists: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to show tasks within a list
async function showTasksInList(listId: string, listName: string, clickUpService: any, outputChannel: vscode.OutputChannel) {
  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: `Loading tasks...`,
      cancellable: false
    }, async (progress) => {
      const tasksResponse = await clickUpService.getTasks(listId);
      
      let tasks = tasksResponse?.tasks || [];
      if (!Array.isArray(tasks) && Array.isArray(tasksResponse)) {
        tasks = tasksResponse;
      }
      
      if (tasks.length === 0) {
        vscode.window.showInformationMessage(`No tasks found in list: ${listName}`);
        return;
      }
      
      const taskItems: vscode.QuickPickItem[] = tasks.map((task: any) => ({
        label: `📝 ${task.name}`,
        description: `Task (${task.id})`,
        detail: `Status: ${task.status?.status || 'Unknown'} | Click to add reference`      }));
      
      const selectedTask = await vscode.window.showQuickPick(taskItems, {
        placeHolder: `Select a task from ${listName} to add as reference`,
        canPickMany: false
      });
      
      if (selectedTask) {
        outputChannel.appendLine(`✅ User selected task: ${selectedTask.label}`);
        
        // Ask if user wants to add this task as a reference at cursor
        const action = await vscode.window.showInformationMessage(
          `Add task "${selectedTask.label.replace('📝 ', '')}" as reference at cursor?`,
          'Add Reference',
          'Copy Task URL',
          'Cancel'
        );        if (action === 'Add Reference') {
          // For now, just copy the task URL and tell user to add reference manually
          const taskIdMatch = selectedTask.description?.match(/\((\d+)\)$/);
          if (taskIdMatch) {
            const taskId = taskIdMatch[1];
            const taskName = selectedTask.label.replace('📝 ', '');
            const taskUrl = `https://app.clickup.com/t/${taskId}`;
            
            // Copy task info to clipboard for easy reference
            await vscode.env.clipboard.writeText(`Task: ${taskName}\nURL: ${taskUrl}\nID: ${taskId}`);
            
            vscode.window.showInformationMessage(
              `Task "${taskName}" copied to clipboard. Use Ctrl+C+U to add a task reference, then select this task from the ClickUp browser.`,
              'Add Reference Now'
            ).then(selection => {
              if (selection === 'Add Reference Now') {
                // Trigger the normal add reference command
                vscode.commands.executeCommand('clickuplink.addTaskReference');
              }
            });
          }
        }else if (action === 'Copy Task URL') {
          const taskIdMatch = selectedTask.description?.match(/\((\d+)\)$/);
          if (taskIdMatch) {
            const taskId = taskIdMatch[1];
            const taskUrl = `https://app.clickup.com/t/${taskId}`;
            await vscode.env.clipboard.writeText(taskUrl);
            vscode.window.showInformationMessage(`Copied task URL to clipboard: ${taskUrl}`);
          }
        }
      }
    });
  } catch (error) {
    outputChannel.appendLine(`❌ Error fetching tasks for list: ${error}`);
    vscode.window.showErrorMessage(`Failed to fetch tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
