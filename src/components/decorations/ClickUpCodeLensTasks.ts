import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { TaskReference } from '../../types/index';

export class ClickUpCodeLensTasks {
  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
  }

  async setupTaskReference(
    uri: vscode.Uri, 
    range: vscode.Range,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    try {
      console.log('🔧 Starting task reference setup...');
      
      // Let's check authentication step by step
      console.log('🔐 Step 1: Checking raw authentication...');
      const { getAccessToken } = await import('../../utils/tokenStorage');
      const token = await getAccessToken(this.context);
      console.log('🔐 Raw token exists:', !!token);
      console.log('🔐 Token preview:', token ? token.substring(0, 10) + '...' : 'null');
      
      // Check service authentication 
      const authStatus = await this.clickUpService.isAuthenticated();
      console.log('🔐 Service auth status:', authStatus);
      
      if (!authStatus) {
        console.log('❌ Not authenticated - prompting user to login');
        const result = await vscode.window.showErrorMessage(
          'Not authenticated with ClickUp. Please login first.',
          'Login Now', 'Enable Test Mode', 'Check Status'
        );
        if (result === 'Login Now') {
          vscode.commands.executeCommand('clickuplink.login');
        } else if (result === 'Enable Test Mode') {
          vscode.commands.executeCommand('clickuplink.enableTestMode');
          // Retry after enabling test mode
          setTimeout(() => this.setupTaskReference(uri, range, saveTaskReference, fireChangeEvent), 1000);
        } else if (result === 'Check Status') {
          vscode.commands.executeCommand('clickuplink.status');
        }
        return;
      }

      console.log('✅ Authenticated - testing API call...');
        // Test API call directly first
      console.log('🧪 Testing direct user API call...');
      try {
        const userData = await this.clickUpService.getAuthorizedUser();
        console.log('👤 User data:', JSON.stringify(userData, null, 2));
        
        if (!userData) {
          throw new Error('No user data returned from API');
        }
        
        // Let's also see what workspace data looks like
        console.log('🏢 Raw workspace data from user API:', userData.teams);
      } catch (apiError) {
        console.error('❌ API test failed:', apiError);
        vscode.window.showErrorMessage(`API test failed: ${apiError}. Try logging in again.`);
        return;
      }
      
      // Now try getting workspaces
      console.log('🏢 Fetching workspaces...');
      const workspaces = await this.clickUpService.getWorkspaces();
      console.log('📁 Workspaces found:', workspaces?.length || 0, workspaces);
      
      if (!workspaces || workspaces.length === 0) {
        console.log('❌ No workspaces found - this suggests an API issue');
        const result = await vscode.window.showErrorMessage(
          'No workspaces found. This might be an authentication or API issue.',
          'Try Login Again', 'Check Status', 'Enable Test Mode'
        );
        if (result === 'Try Login Again') {
          vscode.commands.executeCommand('clickuplink.login');
        } else if (result === 'Check Status') {
          vscode.commands.executeCommand('clickuplink.status');
        } else if (result === 'Enable Test Mode') {
          vscode.commands.executeCommand('clickuplink.enableTestMode');
        }
        return;
      }

      // For now, use first workspace - could enhance to let user choose
      const workspace = workspaces[0];
      console.log('🏢 Using workspace:', workspace.name);
      
      const spaces = await this.clickUpService.getSpaces(workspace.id);
      console.log('🌌 Spaces found:', spaces?.spaces?.length || 0);
      
      if (!spaces?.spaces?.length) {
        vscode.window.showErrorMessage('No spaces found in workspace. Please check your ClickUp permissions.');
        return;
      }

      // Get all folders from all spaces
      const folders: any[] = [];
      for (const space of spaces.spaces) {
        console.log(`📂 Fetching folders for space: ${space.name}`);
        const folderResponse = await this.clickUpService.getFolders(space.id);
        if (folderResponse?.folders) {
          folders.push(...folderResponse.folders);
        }
      }

      console.log('📁 Total folders found:', folders.length);
      
      if (folders.length === 0) {
        vscode.window.showErrorMessage('No folders found. Please create folders in your ClickUp workspace.');
        return;
      }

      const selectedFolder = await vscode.window.showQuickPick(
        folders.map(f => ({ label: f.name, folder: f })),
        { placeHolder: 'Select folder' }
      );
      if (!selectedFolder) return;

      const lists = await this.clickUpService.getLists(selectedFolder.folder.id);      const selectedList = await vscode.window.showQuickPick(
        (lists?.lists || []).map((l: any) => ({ label: l.name, list: l })),
        { placeHolder: 'Select list' }
      ) as { label: string, list: any } | undefined;
      if (!selectedList) return;

      const tasks = await this.clickUpService.getTasks(selectedList.list.id);
      const selectedTask = await vscode.window.showQuickPick(
        (tasks?.tasks || []).map((t: any) => ({ label: t.name, description: t.status?.status, task: t })),
        { placeHolder: 'Select task' }
      ) as { label: string, description?: string, task: any } | undefined;
      if (!selectedTask) return;

      saveTaskReference(uri.toString(), {
        range,
        folderId: selectedFolder.folder.id,
        folderName: selectedFolder.folder.name,
        listId: selectedList.list.id,
        listName: selectedList.list.name,
        taskId: selectedTask.task.id,
        taskName: selectedTask.task.name,
        taskStatus: selectedTask.task.status || { status: 'Open', color: '#3b82f6' },
        status: selectedTask.task.status?.status || 'Open',
        lastUpdated: new Date().toISOString()
      });

      // Update the comment text if one exists
      await this.updateCommentText(uri, range, selectedTask.task);

      fireChangeEvent();
      vscode.window.showInformationMessage(`Task linked: ${selectedTask.task.name} (${selectedTask.task.status?.status || 'Open'})`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to setup task: ${error}`);
    }
  }

  async changeFolder(
    range: vscode.Range, 
    currentFolderId: string,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      const folders = await this.getFolders();
      const selected = await vscode.window.showQuickPick(
        folders.map(f => ({ label: f.name, picked: f.id === currentFolderId, folder: f })),
        { placeHolder: 'Select different folder' }
      );
      if (!selected) return;

      saveTaskReference(editor.document.uri.toString(), {
        range,
        folderId: selected.folder.id,
        folderName: selected.folder.name
      });
      fireChangeEvent();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to change folder: ${error}`);
    }
  }

  async changeList(
    range: vscode.Range, 
    folderId: string, 
    currentListId: string,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      const lists = await this.clickUpService.getLists(folderId);
      const selected = await vscode.window.showQuickPick(
        (lists?.lists || []).map((l: any) => ({ label: l.name, picked: l.id === currentListId, list: l })),
        { placeHolder: 'Select different list' }
      ) as { label: string, picked: boolean, list: any } | undefined;
      if (!selected) return;

      const currentRef = getTaskReference(editor.document.uri.toString(), range);
      saveTaskReference(editor.document.uri.toString(), {
        ...currentRef!,
        listId: selected.list.id,
        listName: selected.list.name,
        taskId: undefined, taskName: undefined, status: undefined // Reset task when changing list
      });
      fireChangeEvent();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to change list: ${error}`);
    }
  }

  async changeTask(
    range: vscode.Range, 
    listId: string, 
    currentTaskId: string,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      const tasks = await this.clickUpService.getTasks(listId);
      const selected = await vscode.window.showQuickPick(
        (tasks?.tasks || []).map((t: any) => ({ 
          label: t.name, 
          description: t.status?.status,
          picked: t.id === currentTaskId, 
          task: t 
        })),
        { placeHolder: 'Select different task' }
      ) as { label: string, description?: string, picked: boolean, task: any } | undefined;
      if (!selected) return;

      const currentRef = getTaskReference(editor.document.uri.toString(), range);
      saveTaskReference(editor.document.uri.toString(), {
        ...currentRef!,
        taskId: selected.task.id,
        taskName: selected.task.name,
        status: selected.task.status?.status || 'Open'
      });
      fireChangeEvent();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to change task: ${error}`);
    }
  }

  async changeStatus(
    range: vscode.Range, 
    taskId: string,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      const taskDetails = await this.clickUpService.getTaskDetails(taskId);
      if (!taskDetails?.list?.id) {
        vscode.window.showErrorMessage('Could not find task list');
        return;
      }

      const statuses = await this.clickUpService.getListStatuses(taskDetails.list.id);
      const selected = await vscode.window.showQuickPick(
        statuses.map((s: any) => ({ label: s.status, status: s })),
        { placeHolder: 'Select new status' }
      ) as { label: string, status: any } | undefined;
      if (!selected) return;

      await this.clickUpService.updateTaskStatus(taskId, selected.status.status);
      
      const currentRef = getTaskReference(editor.document.uri.toString(), range);
      if (currentRef) {
        currentRef.status = selected.status.status;
        currentRef.taskStatus = selected.status;
        currentRef.lastUpdated = new Date().toISOString();
        
        // Update comment text if it exists
        await this.updateCommentText(editor.document.uri, range, {
          name: currentRef.taskName,
          status: selected.status
        });
        
        saveTaskReference(editor.document.uri.toString(), currentRef);
        fireChangeEvent();
      }

      vscode.window.showInformationMessage(`Status updated: ${selected.status.status}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to change status: ${error}`);
    }
  }

  async openInClickUp(taskId: string): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(`https://app.clickup.com/t/${taskId}`));
  }

  private async getFolders(): Promise<any[]> {
    const workspaces = await this.clickUpService.getWorkspaces();
    const folders: any[] = [];

    for (const workspace of workspaces) {
      const spaces = await this.clickUpService.getSpaces(workspace.id);
      if (spaces?.spaces) {
        for (const space of spaces.spaces) {
          const folderResponse = await this.clickUpService.getFolders(space.id);
          if (folderResponse?.folders) {
            folders.push(...folderResponse.folders);
          }
        }
      }
    }
    return folders;
  }

  private async updateCommentText(uri: vscode.Uri, range: vscode.Range, task: any): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);
      
      // Check if there's a comment to update on the line
      const line = document.lineAt(range.start.line);
      const lineText = line.text;
      
      // Look for existing ClickUp comment pattern
      const commentPattern = /\/\/\s*TODO:\s*ClickUp Task[^$]*/;
      if (commentPattern.test(lineText)) {
        // Update the existing comment
        const newCommentText = `// TODO: ClickUp Task - ${task.name} [${task.status?.status || 'Open'}]`;
        
        await editor.edit(editBuilder => {
          editBuilder.replace(line.range, lineText.replace(commentPattern, newCommentText));
        });
      }
    } catch (error) {
      console.error('Failed to update comment text:', error);
    }
  }
}
