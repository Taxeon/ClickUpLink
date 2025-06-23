import * as vscode from 'vscode';
import { BaseNavigator, BaseNavigatorOptions } from './BaseNavigator';
import { Task } from '../../types/navigation';
import { useCache } from '../../hooks/useCache';
import { useNavigation } from '../../hooks/useNavigation';

export class TaskNavigator extends BaseNavigator<Task> {
  private listId: string;
  private static instances: Map<string, TaskNavigator> = new Map();
  
  private constructor(context: vscode.ExtensionContext, listId: string, options?: Partial<BaseNavigatorOptions<Task>>) {
    const defaultOptions: BaseNavigatorOptions<Task> = {
      title: 'Select a ClickUp Task',
      placeholder: 'Choose a task to navigate to...',
      itemToDescription: (task) => task.description,
      itemToDetail: (task) => {
        const parts = [];
        if (task.status) {
          parts.push(`Status: ${task.status}`);
        }
        if (task.priority) {
          parts.push(`Priority: ${task.priority.priority}`);
        }
        if (task.dueDate) {
          const date = new Date(task.dueDate);
          parts.push(`Due: ${date.toLocaleDateString()}`);
        }
        return parts.join(' | ');
      },
    };
    
    super(context, { ...defaultOptions, ...(options || {}) });
    this.listId = listId;
  }
  
  static getInstance(context: vscode.ExtensionContext, listId: string, options?: Partial<BaseNavigatorOptions<Task>>): TaskNavigator {
    const key = `task-${listId}`;
    
    if (!TaskNavigator.instances.has(key)) {
      TaskNavigator.instances.set(key, new TaskNavigator(context, listId, options));
    }
    
    return TaskNavigator.instances.get(key)!;
  }
  
  async loadItems(): Promise<Task[]> {
    const cache = useCache(this.context);
    return await cache.getTasks(this.listId);
  }
  
  async navigateToTask(): Promise<Task | undefined> {
    const task = await this.navigate();
      if (task) {
      const navigation = useNavigation(this.context);
      await navigation.goToTask(task);
    }
    
    return task;
  }
}