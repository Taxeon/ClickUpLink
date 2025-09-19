import * as vscode from 'vscode';
import { ClickUpService } from '../../services/clickUpService';
import { TaskReference } from '../../types/index';

export class BuildTaskRef {
  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
  }

  public async build(
    task: any,
    parentTask: any | null,
    range: vscode.Range,
    preferredListId?: string
  ): Promise<TaskReference> {
    // Use the selected list (e.g., sprint list) if provided; otherwise use task's home list
    const targetListId = preferredListId || task.list.id;
    const list = await this.clickUpService.getListDetails(targetListId);
    const folder = await this.clickUpService.getFolderDetails(list.folder.id);

    return {
      range,
      taskId: task.id,
      taskName: task.name,
      status: task.status?.status,
      taskStatus: task.status,
      assignee: task.assignees?.[0],
      assignees: task.assignees,
      lastUpdated: new Date().toISOString(),
      folderId: folder.id,
      folderName: folder.name,
      listId: list.id,
      listName: list.name,
      parentTaskId: parentTask?.id,
      parentTaskName: parentTask?.name,
      description: task.description,
      parentTaskDescription: parentTask?.description,
    };
  }
}
