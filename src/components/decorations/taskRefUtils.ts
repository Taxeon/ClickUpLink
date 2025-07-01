import * as vscode from 'vscode';
import { TaskReference } from '../../types/index';

export class TaskReferenceUtils {

    /**
   * Save a task reference and update UI
   */
  public async saveTaskReference(
    range: vscode.Range,
    task: any,
    parentTask: any | null,
    getTaskReference: (uri: string, range: vscode.Range) => TaskReference | undefined,
    saveTaskReference: (uri: string, reference: TaskReference) => void,
    fireChangeEvent?: () => void,
    parentRef: Partial<TaskReference> = {}
  ): Promise<void> {
    if (!range || typeof range.start?.line !== 'number' || typeof range.end?.line !== 'number') {
      vscode.window.showErrorMessage('ClickUp: Invalid or missing range for task reference.');
      throw new Error('ClickUp: Invalid or missing range for task reference.');
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    let currentRef = getTaskReference(editor.document.uri.toString(), range);
    if (!currentRef) {
      currentRef = { range };
    }

    // Merge all accumulated info
    const updatedRef = {
      ...currentRef,
      ...parentRef,
      taskId: task.id,
      taskName: task.name,
      description: task.description,
      status: task.status?.status || 'Open',
      taskStatus: task.status || { status: 'Open', color: '#3b82f6' },
      assignee: task.assignees && task.assignees.length > 0 ? task.assignees[0] : undefined,
      assignees: task.assignees || [],
      lastUpdated: new Date().toISOString(),
      parentTaskId: parentTask?.id,
      parentTaskName: parentTask?.name,
    };

    console.log('Updated Ref:', updatedRef);

    saveTaskReference(editor.document.uri.toString(), updatedRef);
    if (fireChangeEvent) fireChangeEvent();
    const taskType = parentTask ? 'subtask' : 'task';
    vscode.window.showInformationMessage(
      `${taskType} updated: ${task.name} (${task.status?.status || 'Open'})`
    );
  }
}