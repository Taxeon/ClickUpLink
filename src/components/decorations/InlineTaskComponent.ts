import * as vscode from 'vscode';
import { Task } from '../../types/navigationTypes';

export interface InlineTaskComponentProps {
  task?: Task;
  range: vscode.Range;
  trigger: string;
  onStatusChange: (newStatus: string) => void;
  onClick: () => void;
  onHover?: () => void;
}

export interface InlineTaskComponentState {
  isHovered: boolean;
  isActive: boolean;
  showQuickActions: boolean;
}

/**
 * React-inspired component for inline task display
 */
export class InlineTaskComponent {
  private props: InlineTaskComponentProps;
  private state: InlineTaskComponentState;
  private listeners: Array<(state: InlineTaskComponentState) => void> = [];

  constructor(props: InlineTaskComponentProps) {
    this.props = props;
    this.state = {
      isHovered: false,
      isActive: false,
      showQuickActions: false
    };
  }

  /**
   * Update component props (React-like)
   */
  public updateProps(newProps: Partial<InlineTaskComponentProps>): void {
    this.props = { ...this.props, ...newProps };
    this.forceUpdate();
  }

  /**
   * Update component state (React-like)
   */
  private setState(newState: Partial<InlineTaskComponentState>): void {
    this.state = { ...this.state, ...newState };
    this.forceUpdate();
  }

  /**
   * Subscribe to state changes (React-like)
   */
  public subscribe(listener: (state: InlineTaskComponentState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Force component update (React-like)
   */
  private forceUpdate(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Handle mouse enter event
   */
  public onMouseEnter(): void {
    this.setState({ isHovered: true });
    this.props.onHover?.();
  }

  /**
   * Handle mouse leave event
   */
  public onMouseLeave(): void {
    this.setState({ 
      isHovered: false,
      showQuickActions: false
    });
  }

  /**
   * Handle click event
   */
  public onClick(): void {
    this.setState({ isActive: true });
    this.props.onClick();
  }

  /**
   * Handle status change
   */
  public onStatusChange(newStatus: string): void {
    this.props.onStatusChange(newStatus);
  }

  /**
   * Show quick actions
   */
  public showQuickActions(): void {
    this.setState({ showQuickActions: true });
  }

  /**
   * Hide quick actions
   */
  public hideQuickActions(): void {
    this.setState({ showQuickActions: false });
  }

  /**
   * Get display text for the task
   */
  public getDisplayText(): string {
    if (!this.props.task) {
      return '[Click to select task]';
    }

    const { task } = this.props;
    const statusEmoji = this.getStatusEmoji(task.status);
    const priorityText = task.priority ? ` (${task.priority.priority})` : '';
    
    return `${statusEmoji} ${task.name}${priorityText}`;
  }

  /**
   * Get detailed description for hover
   */
  public getDetailedDescription(): string {
    if (!this.props.task) {
      return 'No task selected. Click to choose a task from ClickUp.';
    }

    const { task } = this.props;
    const parts = [];

    parts.push(`**${task.name}**`);
    
    if (task.description) {
      parts.push(`*${task.description}*`);
    }

    if (task.status) {
      const status = typeof task.status === 'string' ? task.status : task.status.status;
      parts.push(`Status: ${status}`);
    }

    if (task.priority) {
      parts.push(`Priority: ${task.priority.priority}`);
    }

    if (task.assignees && task.assignees.length > 0) {
      const assigneeNames = Array.isArray(task.assignees) && typeof task.assignees[0] === 'object'
        ? (task.assignees as any[]).map(a => a.username || a.name).join(', ')
        : (task.assignees as string[]).join(', ');
      parts.push(`Assignees: ${assigneeNames}`);
    }

    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      parts.push(`Due: ${dueDate.toLocaleDateString()}`);
    }

    if (task.tags && task.tags.length > 0) {
      parts.push(`Tags: ${task.tags.join(', ')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Get status emoji based on task status
   */
  private getStatusEmoji(status?: string | { status: string }): string {
    const statusText = typeof status === 'string' ? status : status?.status || '';
    
    switch (statusText.toLowerCase()) {
      case 'complete':
      case 'closed':
      case 'done':
        return '✅';
      case 'in progress':
      case 'in review':
      case 'active':
        return '🔄';
      case 'blocked':
      case 'on hold':
        return '⚠️';
      case 'todo':
      case 'open':
      case 'new':
        return '📋';
      default:
        return '📝';
    }
  }

  /**
   * Get CSS color for task based on priority
   */
  public getTaskColor(): string {
    if (!this.props.task?.priority) {
      return 'inherit';
    }

    return this.props.task.priority.color || 'inherit';
  }

  /**
   * Get available status options for task
   */
  public getStatusOptions(): Array<{ label: string; value: string; emoji: string }> {
    // Default status options - could be customized per list/project
    return [
      { label: 'Open', value: 'open', emoji: '📋' },
      { label: 'In Progress', value: 'in progress', emoji: '🔄' },
      { label: 'In Review', value: 'in review', emoji: '👀' },
      { label: 'Blocked', value: 'blocked', emoji: '⚠️' },
      { label: 'Complete', value: 'complete', emoji: '✅' },
      { label: 'Closed', value: 'closed', emoji: '🔒' }
    ];
  }

  /**
   * Check if task is overdue
   */
  public isOverdue(): boolean {
    if (!this.props.task?.dueDate) {
      return false;
    }

    const now = Date.now();
    const dueDate = this.props.task.dueDate;
    const status = typeof this.props.task.status === 'string' 
      ? this.props.task.status 
      : this.props.task.status?.status || '';

    return dueDate < now && !['complete', 'closed', 'done'].includes(status.toLowerCase());
  }

  /**
   * Get quick actions available for this task
   */
  public getQuickActions(): Array<{ label: string; action: string; icon: string }> {
    const actions = [
      { label: 'Open in ClickUp', action: 'open-external', icon: '🔗' },
      { label: 'Copy Task URL', action: 'copy-url', icon: '📋' },
      { label: 'View Details', action: 'view-details', icon: '👀' }
    ];

    if (this.props.task) {
      const status = typeof this.props.task.status === 'string' 
        ? this.props.task.status 
        : this.props.task.status?.status || '';

      if (!['complete', 'closed'].includes(status.toLowerCase())) {
        actions.unshift({ label: 'Mark Complete', action: 'mark-complete', icon: '✅' });
      }

      if (status.toLowerCase() !== 'in progress') {
        actions.unshift({ label: 'Start Progress', action: 'start-progress', icon: '▶️' });
      }
    } else {
      actions.unshift({ label: 'Select Task', action: 'select-task', icon: '🎯' });
    }

    return actions;
  }

  /**
   * Execute a quick action
   */
  public async executeQuickAction(action: string): Promise<void> {
    switch (action) {
      case 'mark-complete':
        this.onStatusChange('complete');
        break;
      case 'start-progress':
        this.onStatusChange('in progress');
        break;
      case 'select-task':
        this.onClick();
        break;
      case 'open-external':
        if (this.props.task) {
          const url = `https://app.clickup.com/t/${this.props.task.id}`;
          await vscode.env.openExternal(vscode.Uri.parse(url));
        }
        break;
      case 'copy-url':
        if (this.props.task) {
          const url = `https://app.clickup.com/t/${this.props.task.id}`;
          await vscode.env.clipboard.writeText(url);
          vscode.window.showInformationMessage('Task URL copied to clipboard');
        }
        break;
      case 'view-details':
        // This would open a detailed view/webview
        vscode.window.showInformationMessage('Task details view would open here');
        break;
      default:
        console.warn(`Unknown quick action: ${action}`);
    }
  }

  /**
   * Get current props (React-like)
   */
  public getProps(): InlineTaskComponentProps {
    return { ...this.props };
  }

  /**
   * Get current state (React-like)
   */
  public getState(): InlineTaskComponentState {
    return { ...this.state };
  }

  /**
   * Cleanup component
   */
  public dispose(): void {
    this.listeners = [];
  }
}
