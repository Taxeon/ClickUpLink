import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { TaskReference } from '../../types/index';
import { GetTask } from './getTaskId';
import { BuildTaskRef } from './buildTaskRef';
import { ClickUpCodeLensDebug } from './taskRefMaintenance';

export class ClickUpCodeLensTasks {
  private clickUpService: ClickUpService;
  public taskGetter: GetTask;
  private taskRefBuilder: BuildTaskRef;

  constructor(
    private context: vscode.ExtensionContext,
    private getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined
  ) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
    this.taskRefBuilder = new BuildTaskRef(context);
    this.taskGetter = new GetTask(context, this.taskRefBuilder, this.getTaskReference);
  }

  //Used in creation of a new Task Reference
  async setupTaskReference(
    uri: vscode.Uri,
    range: vscode.Range,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent: () => void
  ): Promise<void> {
    // 1. Let user select a task
    const { selectedTask: summaryTask, parentTask } = await this.taskGetter.selectFolder(range, undefined);
    if (!summaryTask?.id) {
      console.log('Task selection cancelled.');
      return;
    }

    try {
      // 2. Fetch full task details to ensure we have everything
      const fullTask = await this.clickUpService.getTaskDetails(summaryTask.id);
      if (!fullTask) {
        vscode.window.showErrorMessage(`Could not fetch details for task ${summaryTask.name}.`);
        return;
      }

      // 3. Build the new, complete reference object
      const newReference = await this.taskRefBuilder.build(fullTask, parentTask, range);

      // 4. Save the updated reference
      saveTaskReference(uri.toString(), newReference);

      // 5. Create the anchor in the document
      await ClickUpCodeLensDebug.createAnchor(range, fullTask.id);
      
      // 6. Fire the change event to refresh all UI
      fireChangeEvent();

      vscode.window.showInformationMessage(`Linked to task: ${fullTask.name}`);

    } catch (error) {
      console.error('Error setting up task reference:', error);
      vscode.window.showErrorMessage(`Failed to set up task reference: ${error}`);
    }
  }

  /**
   * Helper method to create a getTaskReference callback for the taskGetter
   */
  private getTaskReferenceCallback(): (
    uri: string,
    range: vscode.Range
  ) => TaskReference | undefined {
    return this.getTaskReference;
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
      if (currentRef) {
        currentRef.status = selected.status.status;
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

  /**
   * Reconstruct a full TaskReference from just a taskId (for marker-based triggers).
   * Fetches task details from ClickUp API and builds a TaskReference object, including parent, list, folder, and space.
   * Always attempts to populate all possible details, logging warnings for any missing data.
   */
  async buildReferenceFromTaskId(
    taskId: string,
    document: vscode.TextDocument,
    markerRange: vscode.Range
  ): Promise<TaskReference | undefined> {
    try {
      const task = await this.clickUpService.getTaskDetails(taskId);
      if (!task) {
        vscode.window.showWarningMessage(`ClickUp: Could not fetch details for task ID ${taskId}`);
        return undefined;
      }

      let parentTask: any = undefined;
      if (task.parent && task.parent.id) {
        try {
          parentTask = await this.clickUpService.getTaskDetails(task.parent.id);
        } catch (err) {
          console.warn(`ClickUp: Could not fetch parent task for ${taskId}`);
        }
      }

      return await this.taskRefBuilder.build(task, parentTask, markerRange);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to build reference from taskId: ${error}`);
      return undefined;
    }
  }
}
