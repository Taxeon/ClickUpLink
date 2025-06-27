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
          // Store the current space selection and workspace ID
          await context.workspaceState.update('clickup.currentSpaceId', spaceId);
          await context.workspaceState.update('clickup.currentSpaceName', selectedSpace.label);
          await context.workspaceState.update('clickup.currentWorkspaceId', workspaceId);
          
          outputChannel.appendLine(`✅ Active space set to: ${selectedSpace.label} (${spaceId}) in workspace ${workspaceId}`);
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

  // Register the open space in ClickUp command
  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.openSpaceInClickUp', async (spaceId: string) => {
    outputChannel.appendLine(`🌐 Opening space in ClickUp: ${spaceId}`);
    
    try {
      // Get the current workspace ID from global state
      const workspaceId = context.workspaceState.get<string>('clickup.currentWorkspaceId');
      
      if (!workspaceId) {
        // Try to get workspaces and use the first one
        const apiResponse = await apiRequest(context, 'get', 'team');
        const workspaces = apiResponse?.teams || [];
        
        if (workspaces.length > 0) {
          const firstWorkspaceId = workspaces[0].id;
          const spaceUrl = `https://app.clickup.com/${firstWorkspaceId}/v/o/s/${spaceId}`;
          await vscode.env.openExternal(vscode.Uri.parse(spaceUrl));
          outputChannel.appendLine(`✅ Opened space in browser: ${spaceUrl}`);
        } else {
          vscode.window.showErrorMessage('No workspace found. Please ensure you are logged in.');
          outputChannel.appendLine(`❌ No workspace found`);
        }
      } else {
        const spaceUrl = `https://app.clickup.com/${workspaceId}/v/o/s/${spaceId}`;
        await vscode.env.openExternal(vscode.Uri.parse(spaceUrl));
        outputChannel.appendLine(`✅ Opened space in browser: ${spaceUrl}`);
      }
    } catch (error) {
      console.error('Error opening space in ClickUp:', error);
      vscode.window.showErrorMessage('Failed to open space in ClickUp.');
      outputChannel.appendLine(`❌ Error opening space: ${error}`);
    }
  }));

  // Register the buy pizza command
  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.buyPizza', async () => {
    outputChannel.appendLine(`🍕 Opening pizza support link`);
    
    try {
      const pizzaUrl = 'https://ko-fi.com/activemindsgames';
      await vscode.env.openExternal(vscode.Uri.parse(pizzaUrl));
      outputChannel.appendLine(`✅ Opened pizza support link: ${pizzaUrl}`);
    } catch (error) {
      console.error('Error opening pizza support link:', error);
      vscode.window.showErrorMessage('Failed to open support link.');
      outputChannel.appendLine(`❌ Error opening pizza link: ${error}`);
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

  // Register the create space command
  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.createSpace', async (workspaceId: string) => {
    outputChannel.appendLine(`🌟 Creating new space in workspace: ${workspaceId}`);
    
    try {
      const spaceName = await vscode.window.showInputBox({
        prompt: 'Enter name for new space',
        placeHolder: 'Space name...',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Space name cannot be empty';
          }
          return null;
        }
      });

      if (!spaceName) {
        return; // User cancelled
      }

      const { ClickUpService } = await import('../services/clickUpService');
      const clickUpService = ClickUpService.getInstance(context);
      
      const newSpace = await clickUpService.createSpace(workspaceId, spaceName.trim());
      
      if (newSpace && newSpace.id) {
        // Set the new space as current
        await context.workspaceState.update('clickup.currentSpaceId', newSpace.id);
        await context.workspaceState.update('clickup.currentSpaceName', newSpace.name);
        await context.workspaceState.update('clickup.currentWorkspaceId', workspaceId);
        
        outputChannel.appendLine(`✅ Created new space: ${newSpace.name} (${newSpace.id})`);
        vscode.window.showInformationMessage(`Created new space: ${newSpace.name}`);
        
        // Refresh the workspace view
        vscode.commands.executeCommand('clickup.refreshWorkspaceView');
      } else {
        throw new Error('Failed to create space - invalid response');
      }
    } catch (error) {
      console.error('Error creating space:', error);
      vscode.window.showErrorMessage(`Failed to create space: ${error instanceof Error ? error.message : 'Unknown error'}`);
      outputChannel.appendLine(`❌ Error creating space: ${error}`);
    }
  }));

  // Register the create folder command
  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.createFolder', async (spaceId: string) => {
    outputChannel.appendLine(`📁 Creating new folder in space: ${spaceId}`);
    
    try {
      const folderName = await vscode.window.showInputBox({
        prompt: 'Enter name for new folder',
        placeHolder: 'Folder name...',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Folder name cannot be empty';
          }
          return null;
        }
      });

      if (!folderName) return;

      const { ClickUpService } = await import('../services/clickUpService');
      const clickUpService = ClickUpService.getInstance(context);
      
      const newFolder = await clickUpService.createFolder(spaceId, folderName.trim());
      
      if (newFolder && newFolder.id) {
        outputChannel.appendLine(`✅ Created new folder: ${newFolder.name} (${newFolder.id})`);
        vscode.window.showInformationMessage(`Created new folder: ${newFolder.name}`);
      } else {
        throw new Error('Failed to create folder - invalid response');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      vscode.window.showErrorMessage(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
      outputChannel.appendLine(`❌ Error creating folder: ${error}`);
    }
  }));

  // Register the create list command
  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.createList', async (folderId: string, spaceId?: string) => {
    outputChannel.appendLine(`📋 Creating new list in ${folderId ? 'folder' : 'space'}: ${folderId || spaceId}`);
    
    try {
      const listName = await vscode.window.showInputBox({
        prompt: 'Enter name for new list',
        placeHolder: 'List name...',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'List name cannot be empty';
          }
          return null;
        }
      });

      if (!listName) return;

      const { ClickUpService } = await import('../services/clickUpService');
      const clickUpService = ClickUpService.getInstance(context);
      
      let newList;
      if (folderId) {
        newList = await clickUpService.createList(folderId, listName.trim());
      } else if (spaceId) {
        newList = await clickUpService.createFolderlessList(spaceId, listName.trim());
      } else {
        throw new Error('No folder or space ID provided');
      }
      
      if (newList && newList.id) {
        outputChannel.appendLine(`✅ Created new list: ${newList.name} (${newList.id})`);
        vscode.window.showInformationMessage(`Created new list: ${newList.name}`);
      } else {
        throw new Error('Failed to create list - invalid response');
      }
    } catch (error) {
      console.error('Error creating list:', error);
      vscode.window.showErrorMessage(`Failed to create list: ${error instanceof Error ? error.message : 'Unknown error'}`);
      outputChannel.appendLine(`❌ Error creating list: ${error}`);
    }
  }));

  // Register the create task command
  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.createTask', async (listId: string) => {
    outputChannel.appendLine(`📝 Creating new task in list: ${listId}`);
    
    try {
      const taskName = await vscode.window.showInputBox({
        prompt: 'Enter name for new task',
        placeHolder: 'Task name...',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Task name cannot be empty';
          }
          return null;
        }
      });

      if (!taskName) return;

      const taskDescription = await vscode.window.showInputBox({
        prompt: 'Enter task description (optional)',
        placeHolder: 'Task description...'
      });

      const { ClickUpService } = await import('../services/clickUpService');
      const clickUpService = ClickUpService.getInstance(context);
      
      const newTask = await clickUpService.createTask(listId, taskName.trim(), taskDescription?.trim());
      
      if (newTask && newTask.id) {
        outputChannel.appendLine(`✅ Created new task: ${newTask.name} (${newTask.id})`);
        vscode.window.showInformationMessage(`Created new task: ${newTask.name}`);
      } else {
        throw new Error('Failed to create task - invalid response');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      vscode.window.showErrorMessage(`Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`);
      outputChannel.appendLine(`❌ Error creating task: ${error}`);
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