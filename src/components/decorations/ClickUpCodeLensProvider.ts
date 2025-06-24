import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';

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

export class ClickUpCodeLensProvider implements vscode.CodeLensProvider {
  private static instance: ClickUpCodeLensProvider;
  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;
  private taskReferences: Map<string, TaskReference[]> = new Map();
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
  }

  static getInstance(context: vscode.ExtensionContext): ClickUpCodeLensProvider {
    if (!ClickUpCodeLensProvider.instance) {
      ClickUpCodeLensProvider.instance = new ClickUpCodeLensProvider(context);
    }
    return ClickUpCodeLensProvider.instance;
  }  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    console.log('🔍 provideCodeLenses called for:', document.uri.toString());
    const codeLenses: vscode.CodeLens[] = [];
    
    // Only show CodeLens for manually added task references
    const references = this.taskReferences.get(document.uri.toString()) || [];
    console.log('� Found', references.length, 'task references');
      for (const reference of references) {
      // Validate that reference has required properties
      if (!reference || !reference.range || !reference.range.start) {
        console.warn('⚠️ Skipping invalid reference (missing range):', reference);
        continue;
      }

      if (reference.taskId) {
        // Show breadcrumbs for completed task references
        console.log('📋 Creating breadcrumbs for completed reference');
        try {
          const breadcrumbs = this.createBreadcrumbs(reference, reference.range.start.line);
          codeLenses.push(...breadcrumbs);
        } catch (error) {
          console.error('❌ Error creating breadcrumbs:', error);
        }
      } else {
        // Show "+Select ClickUp Task" for incomplete references
        console.log('➕ Creating "Select ClickUp Task" CodeLens');
        try {
          codeLenses.push(new vscode.CodeLens(reference.range, {
            title: '$(add) Select ClickUp Task',
            command: 'clickuplink.setupTaskReference',
            arguments: [document.uri, reference.range]
          }));
        } catch (error) {
          console.error('❌ Error creating CodeLens:', error);
        }
      }
    }
    
    console.log('🔧 Returning', codeLenses.length, 'CodeLenses');
    return codeLenses;
  }  private createBreadcrumbs(ref: TaskReference, line: number): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    let col = 0;

    // Validate that we have a valid reference and range
    if (!ref || !ref.range) {
      console.error('❌ Invalid task reference:', ref);
      return lenses;
    }

    console.log('🍞 Creating breadcrumbs for:', ref);

    // Format: 📁 Folder Name | 📋 List Name | Task Name | Status | 🔗 Open
if (ref.folderName) {
  const title = `📁 ${ref.folderName}`;
  lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + title.length), {
    title,
    command: 'clickuplink.changeFolder',
    arguments: [ref.range, ref.folderId]
  }));
  col += title.length + 1;

}

if (ref.listName) {
  
  const title = `📋 ${ref.listName}`;
  lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + title.length), {
    title,
    command: 'clickuplink.changeList',
    arguments: [ref.range, ref.folderId, ref.listId]
  }));
  col += title.length + 1;

}

if (ref.taskName) {


  lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + ref.taskName.length), {
    title: ref.taskName,
    command: 'clickuplink.changeTask',
    arguments: [ref.range, ref.listId, ref.taskId]
  }));
  col += ref.taskName.length + 1;

}

if (ref.status && ref.taskId) {

  lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + ref.status.length), {
    title: ref.status,
    command: 'clickuplink.changeStatus',
    arguments: [ref.range, ref.taskId]
  }));
  col += ref.status.length + 1;

}

if (ref.taskId) {

  lenses.push(new vscode.CodeLens(new vscode.Range(line, col, line, col + 6), {
    title: '🔗 Open',
    command: 'clickuplink.openInClickUp',
    arguments: [ref.taskId]
  }));
}

    return lenses;
  }private getTaskReference(uri: string, range: vscode.Range): TaskReference | undefined {
    const references = this.taskReferences.get(uri) || [];
    return references.find(ref => 
      ref.range && ref.range.start && range && range.start &&
      ref.range.start.line === range.start.line && 
      ref.range.start.character === range.start.character
    );
  }
  private saveTaskReference(uri: string, reference: TaskReference): void {
    // Validate that the reference has proper range structure
    if (!reference || !reference.range || !reference.range.start) {
      console.error('❌ Cannot save task reference with invalid range:', reference);
      return;
    }

    const references = this.taskReferences.get(uri) || [];
    const existingIndex = references.findIndex(ref => 
      ref.range && ref.range.start &&
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
  }
  private persistReferences(): void {
    try {
      // Convert Map to array and serialize Range objects manually
      const serializable = Array.from(this.taskReferences.entries()).map(([uri, references]) => [
        uri,
        references.map(ref => ({
          range: {
            start: { line: ref.range.start.line, character: ref.range.start.character },
            end: { line: ref.range.end.line, character: ref.range.end.character }
          },
          folderId: ref.folderId,
          folderName: ref.folderName,
          listId: ref.listId,
          listName: ref.listName,
          taskId: ref.taskId,
          taskName: ref.taskName,
          status: ref.status
        }))
      ]);
      
      const serialized = JSON.stringify(serializable);
      this.context.globalState.update('clickup.taskReferences', serialized);
      console.log('💾 Successfully persisted', Array.from(this.taskReferences.values()).reduce((total, refs) => total + refs.length, 0), 'task references');
    } catch (error) {
      console.error('❌ Failed to persist task references:', error);
    }
  }

  private loadReferences(): void {
    try {
      const serialized = this.context.globalState.get<string>('clickup.taskReferences');
      if (serialized) {
        const entries = JSON.parse(serialized);
        // Reconstruct Range objects from serialized data
        this.taskReferences = new Map(
          entries.map(([uri, references]: [string, any[]]) => [
            uri,
            references.map(ref => ({
              range: new vscode.Range(
                new vscode.Position(ref.range.start.line, ref.range.start.character),
                new vscode.Position(ref.range.end.line, ref.range.end.character)
              ),
              folderId: ref.folderId,
              folderName: ref.folderName,
              listId: ref.listId,
              listName: ref.listName,
              taskId: ref.taskId,
              taskName: ref.taskName,
              status: ref.status
            }))
          ])
        );
        console.log('📂 Successfully loaded', Array.from(this.taskReferences.values()).reduce((total, refs) => total + refs.length, 0), 'task references');
      } else {
        console.log('📂 No stored task references found');
      }
    } catch (error) {
      console.error('❌ Failed to load task references:', error);
      this.taskReferences = new Map(); // Reset to empty state on error
    }
  }

  // Simplified command handlers using existing navigation components
  async setupTaskReference(uri: vscode.Uri, range: vscode.Range): Promise<void> {
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
          setTimeout(() => this.setupTaskReference(uri, range), 1000);
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

      this.saveTaskReference(uri.toString(), {
        range,
        folderId: selectedFolder.folder.id,
        folderName: selectedFolder.folder.name,
        listId: selectedList.list.id,
        listName: selectedList.list.name,
        taskId: selectedTask.task.id,
        taskName: selectedTask.task.name,
        status: selectedTask.task.status?.status || 'Open'
      });      this._onDidChangeCodeLenses.fire();
      vscode.window.showInformationMessage(`Task linked: ${selectedTask.task.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to setup task: ${error}`);
    }
  }

  async changeFolder(range: vscode.Range, currentFolderId: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      const folders = await this.getFolders();
      const selected = await vscode.window.showQuickPick(
        folders.map(f => ({ label: f.name, picked: f.id === currentFolderId, folder: f })),
        { placeHolder: 'Select different folder' }
      );
      if (!selected) return;

      this.saveTaskReference(editor.document.uri.toString(), {
        range,
        folderId: selected.folder.id,
        folderName: selected.folder.name
      });
      this._onDidChangeCodeLenses.fire();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to change folder: ${error}`);
    }
  }

  async changeList(range: vscode.Range, folderId: string, currentListId: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      const lists = await this.clickUpService.getLists(folderId);
      const selected = await vscode.window.showQuickPick(
        (lists?.lists || []).map((l: any) => ({ label: l.name, picked: l.id === currentListId, list: l })),
        { placeHolder: 'Select different list' }
      ) as { label: string, picked: boolean, list: any } | undefined;
      if (!selected) return;

      const currentRef = this.getTaskReference(editor.document.uri.toString(), range);
      this.saveTaskReference(editor.document.uri.toString(), {
        ...currentRef!,
        listId: selected.list.id,
        listName: selected.list.name,
        taskId: undefined, taskName: undefined, status: undefined // Reset task when changing list
      });
      this._onDidChangeCodeLenses.fire();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to change list: ${error}`);
    }
  }

  async changeTask(range: vscode.Range, listId: string, currentTaskId: string): Promise<void> {
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

      const currentRef = this.getTaskReference(editor.document.uri.toString(), range);
      this.saveTaskReference(editor.document.uri.toString(), {
        ...currentRef!,
        taskId: selected.task.id,
        taskName: selected.task.name,
        status: selected.task.status?.status || 'Open'
      });
      this._onDidChangeCodeLenses.fire();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to change task: ${error}`);
    }
  }

  async changeStatus(range: vscode.Range, taskId: string): Promise<void> {
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
      
      const currentRef = this.getTaskReference(editor.document.uri.toString(), range);
      if (currentRef) {
        currentRef.status = selected.status.status;
        this.saveTaskReference(editor.document.uri.toString(), currentRef);
        this._onDidChangeCodeLenses.fire();
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

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public initialize(): void {
    this.loadReferences();
  }

  public dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }
  // Add a new task reference at the current cursor position
  async addTaskReferenceAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    try {
      const position = editor.selection.active;
      const range = new vscode.Range(position, position);
      
      console.log('🎯 Adding task reference at position:', position.line, position.character);
      console.log('📍 Created range:', range);
      
      // Create an empty task reference that will show the "Select ClickUp Task" CodeLens
      this.saveTaskReference(editor.document.uri.toString(), {
        range,
        // No task details yet - this will trigger the setup CodeLens
      });

      this._onDidChangeCodeLenses.fire();
      vscode.window.showInformationMessage('ClickUp task reference added. Click the CodeLens to set it up.');
    } catch (error) {
      console.error('❌ Error adding task reference:', error);
      vscode.window.showErrorMessage(`Failed to add task reference: ${error}`);
    }
  }  // Debug methods for testing persistence
  public debugShowStoredReferences(outputChannel?: any): void {
    const log = (message: string) => {
      console.log(message);
      if (outputChannel) {
        outputChannel.appendLine(message);
      }
    };
    
    log('🔍 ===== DEBUGGING TASK REFERENCES =====');
    log(`📊 Total files with references: ${this.taskReferences.size}`);
    
    let totalRefs = 0;
    
    for (const [uri, references] of this.taskReferences.entries()) {
      log(`📄 File: ${uri}`);
      log(`   Number of references: ${references.length}`);
      
      references.forEach((ref, index) => {
        log(`  ${index + 1}. Position: Line ${ref.range?.start?.line}, Char ${ref.range?.start?.character}`);
        log(`     📁 Folder: ${ref.folderName || 'No folder'}`);
        log(`     📋 List: ${ref.listName || 'No list'}`);
        log(`     📝 Task: ${ref.taskName || 'No task'}`);
        log(`     📊 Status: ${ref.status || 'No status'}`);
        log(`     🆔 Task ID: ${ref.taskId || 'No ID'}`);
        log(`     ✅ Range valid: ${!!(ref.range && ref.range.start && ref.range.end)}`);
        totalRefs++;
      });
      log(''); // Empty line for readability
    }

    // Also show raw stored data
    const serialized = this.context.globalState.get<string>('clickup.taskReferences');
    log(`💾 Raw stored data length: ${serialized?.length || 0} characters`);
    
    if (serialized) {
      log(`💾 Raw stored data preview (first 300 chars):`);
      log(serialized.substring(0, 300) + (serialized.length > 300 ? '...' : ''));
    } else {
      log('💾 No raw stored data found');
    }
    
    log('🔍 ===== END DEBUG REPORT =====');
    
    // Show detailed message
    const message = `Found ${totalRefs} task references in ${this.taskReferences.size} files. Check 'ClickUp Link Debug' output for full details.`;
    vscode.window.showInformationMessage(message);
    log(`📊 Summary: ${message}`);
  }

  public debugClearStoredReferences(): void {
    this.taskReferences.clear();
    this.context.globalState.update('clickup.taskReferences', undefined);
    this._onDidChangeCodeLenses.fire();
    console.log('🗑️ Cleared all stored task references');
    vscode.window.showInformationMessage('All task references cleared!');
  }
}
