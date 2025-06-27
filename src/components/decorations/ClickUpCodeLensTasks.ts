import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { TaskReference } from '../../types/index';
import { ClickUpGetTask } from './ClickUpGetTask';

export class ClickUpCodeLensTasks {
  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;
  private taskGetter: ClickUpGetTask;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
    this.taskGetter = new ClickUpGetTask(context);
  }

  async setupTaskReference(
    uri: vscode.Uri,
    range: vscode.Range,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    // Delegate the entire selection flow to ClickUpGetTask
    await this.taskGetter.selectFolder(
      range,
      undefined, // No current folder for new reference
      this.getTaskReferenceCallback(),
      saveTaskReference,
      fireChangeEvent
    );
  }

  async changeFolder(
    range: vscode.Range,
    currentFolderId: string,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    // Breadcrumb click: start at folder selection, passing current folder
    await this.taskGetter.selectFolder(
      range,
      currentFolderId,
      this.getTaskReferenceCallback(),
      saveTaskReference,
      fireChangeEvent
    );
  }

  async changeList(
    range: vscode.Range,
    folderId: string,
    currentListId: string,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    // Breadcrumb click: start at list selection, passing current folder and list
    await this.taskGetter.selectList(
      range,
      folderId,
      currentListId,
      getTaskReference,
      saveTaskReference,
      fireChangeEvent
    );
  }

  async changeTask(
    range: vscode.Range,
    listId: string,
    currentTaskId: string,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    // Breadcrumb click: start at task selection, passing current list and task
    await this.taskGetter.selectTask(
      range,
      listId,
      currentTaskId,
      getTaskReference,
      saveTaskReference,
      fireChangeEvent
    );
  }

  async changeSubtask(
    range: vscode.Range,
    listId: string,
    parentTaskId: string,
    subtaskId: string,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    // Find parent task details (needed for subtask selection)
    const parentTask = await this.clickUpService.getTaskDetails(parentTaskId);
    if (!parentTask) {
      vscode.window.showErrorMessage('Could not find parent task for subtask selection');
      return;
    }
    await this.taskGetter.selectSubtask(
      range,
      parentTask,
      listId,
      getTaskReference,
      saveTaskReference,
      fireChangeEvent,
      { parentTaskId: parentTask.id, parentTaskName: parentTask.name }
    );
  }

  /**
   * Helper method to create a getTaskReference callback for the taskGetter
   */
  private getTaskReferenceCallback(): (uri: string, range: vscode.Range) => TaskReference | undefined {
    return (uri: string, range: vscode.Range) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return undefined;
      
      // This is a simple implementation - in a real scenario, you'd want to 
      // retrieve the actual reference from your storage mechanism
      // For now, return undefined to allow the modular functions to work
      return undefined;
    };
  }

  private async createNewTaskInList(
    range: vscode.Range,
    listId: string,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const taskName = await vscode.window.showInputBox({
      prompt: 'Enter name for new task',
      placeHolder: 'Task name...',
      validateInput: value => {
        if (!value || value.trim().length === 0) {
          return 'Task name cannot be empty';
        }
        return null;
      },
    });

    if (!taskName) return;

    try {
      const newTask = await this.clickUpService.createTask(listId, taskName.trim());
      if (!newTask) {
        vscode.window.showErrorMessage('Failed to create task');
        return;
      }

      const currentRef = getTaskReference(editor.document.uri.toString(), range);
      saveTaskReference(editor.document.uri.toString(), {
        ...currentRef!,
        taskId: newTask.id,
        taskName: newTask.name,
        status: newTask.status?.status || 'Open',
        taskStatus: newTask.status || { status: 'Open', color: '#3b82f6' },
        assignee:
          newTask.assignees && newTask.assignees.length > 0 ? newTask.assignees[0] : undefined,
        assignees: newTask.assignees || [],
        lastUpdated: new Date().toISOString(),
      });
      fireChangeEvent();
      vscode.window.showInformationMessage(`Created and linked to new task: ${newTask.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create task: ${error}`);
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
      const selected = (await vscode.window.showQuickPick(
        statuses.map((s: any) => ({ label: s.status, status: s })),
        { placeHolder: 'Select new status' }
      )) as { label: string; status: any } | undefined;
      if (!selected) return;

      await this.clickUpService.updateTaskStatus(taskId, selected.status.status);

      const currentRef = getTaskReference(editor.document.uri.toString(), range);
      if (currentRef) {        currentRef.status = selected.status.status;
        currentRef.taskStatus = selected.status;
        currentRef.lastUpdated = new Date().toISOString();
        
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

  private getWorkspaceFolderPath(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder?.uri.fsPath;
  }

  private getCurrentWorkspaceFolderPath(): string | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return undefined;
  }

  async changeAssignee(
    range: vscode.Range,
    taskId: string,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      // Get task details to find the list and workspace info
      const taskDetails = await this.clickUpService.getTaskDetails(taskId);
      if (!taskDetails?.list?.id) {
        vscode.window.showErrorMessage('Could not find task details');
        return;
      }

      let members: any[] = [];

      try {
        // Approach 1: Try to get members from task members (people who can access this task)
        console.log('🔍 Approach 1: Trying to get task members...');
        const taskMembers = await this.clickUpService.getTaskMembers(taskId);
        console.log('🔍 Task members response:', JSON.stringify(taskMembers, null, 2));

        if (taskMembers?.members && taskMembers.members.length > 0) {
          members = taskMembers.members;
          console.log('✅ Found members from task members:', members.length);
        } else {
          console.log('❌ No members in task members, trying list details...');

          // Approach 2: Try to get members from the list details
          console.log('🔍 Approach 2: Trying to get members from list details...');
          const listDetails = await this.clickUpService.getListDetails(taskDetails.list.id);
          console.log('🔍 List details response:', JSON.stringify(listDetails, null, 2));

          if (listDetails?.members && listDetails.members.length > 0) {
            members = listDetails.members;
            console.log('✅ Found members from list details:', members.length);
          } else {
            console.log('❌ No members in list details, trying space details...');

            // Approach 3: Try to get members from space details
            if (taskDetails.space?.id) {
              console.log('🔍 Approach 3: Trying to get members from space details...');
              const spaceDetails = await this.clickUpService.getSpaceDetails(taskDetails.space.id);
              console.log('🔍 Space details response:', JSON.stringify(spaceDetails, null, 2));

              if (spaceDetails?.members && spaceDetails.members.length > 0) {
                members = spaceDetails.members;
                console.log('✅ Found members from space details:', members.length);
              } else {
                console.log('❌ No members in space details, trying workspace members...');

                // Approach 4: Try to get members from workspace
                const workspaces = await this.clickUpService.getWorkspaces();
                if (workspaces && workspaces.length > 0) {
                  console.log('🔍 Approach 4: Trying to get workspace members...');
                  const workspaceMembers = await this.clickUpService.getWorkspaceMembers(
                    workspaces[0].id
                  );
                  console.log(
                    '🔍 Workspace members response:',
                    JSON.stringify(workspaceMembers, null, 2)
                  );

                  if (workspaceMembers && workspaceMembers.length > 0) {
                    members = workspaceMembers;
                    console.log('✅ Found members from workspace:', members.length);
                  } else {
                    console.log('❌ No members found in workspace either');
                  }
                } else {
                  console.log('❌ No workspaces found for member lookup');
                }
              }
            } else {
              console.log('❌ No space ID found in task details');
            }
          }
        }

        console.log('🔍 Final members array:', JSON.stringify(members, null, 2));
        console.log('🔍 Task details for debugging:', JSON.stringify(taskDetails, null, 2));
      } catch (apiError) {
        console.error('❌ Error fetching members from all approaches:', apiError);
      }

      if (!members || members.length === 0) {
        // No members found - offer to open in ClickUp instead
        const result = await vscode.window.showInformationMessage(
          'No team members found. Would you like to open this task in ClickUp to assign it there?',
          'Open in ClickUp',
          'Cancel'
        );

        if (result === 'Open in ClickUp') {
          await this.openInClickUp(taskId);
        }
        return;
      }

      const assigneeOptions = [
        { label: 'Unassigned', member: null },
        ...members.map((member: any) => ({
          label: `${member.username || member.user?.username || 'Unknown'} (${member.email || member.user?.email || 'No email'})`,
          member: member.user || member,
        })),
      ];

      const selected = await vscode.window.showQuickPick(assigneeOptions, {
        placeHolder: 'Select assignee',
      });

      if (selected === undefined) return;

      // Update task assignee in ClickUp
      const assigneeIds = selected.member ? [selected.member.id] : [];
      await this.clickUpService.updateTaskAssignee(taskId, assigneeIds);

      // Update local reference
      const currentRef = getTaskReference(editor.document.uri.toString(), range);
      if (currentRef) {
        currentRef.assignee = selected.member || undefined;
        currentRef.assignees = selected.member ? [selected.member] : [];
        currentRef.lastUpdated = new Date().toISOString();

        saveTaskReference(editor.document.uri.toString(), currentRef);
        fireChangeEvent();
      }
    } catch (error) {
      console.error('❌ Error changing assignee:', error);

      // Fallback - offer to open in ClickUp
      const result = await vscode.window.showInformationMessage(
        'Unable to fetch team members. Would you like to open this task in ClickUp to assign it there?',
        'Open in ClickUp',
        'Cancel'
      );

      if (result === 'Open in ClickUp') {
        await this.openInClickUp(taskId);
      }
    }
  }

  private async updateTaskReference(
    range: vscode.Range,
    task: any,
    parentTask: any | null,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const currentRef = getTaskReference(editor.document.uri.toString(), range);
    if (!currentRef) return;

    // Update the reference
    const updatedRef = {
      ...currentRef,
      taskId: task.id,
      taskName: task.name,
      description: task.description, // Ensure description is set
      status: task.status?.status || 'Open',
      taskStatus: task.status || { status: 'Open', color: '#3b82f6' },
      assignee: task.assignees && task.assignees.length > 0 ? task.assignees[0] : undefined,
      assignees: task.assignees || [],
      lastUpdated: new Date().toISOString(),
      // Include parent task info if this is a subtask
      parentTaskId: parentTask?.id,
      parentTaskName: parentTask?.name,
    };

    saveTaskReference(editor.document.uri.toString(), updatedRef);

    fireChangeEvent();
  }
}
