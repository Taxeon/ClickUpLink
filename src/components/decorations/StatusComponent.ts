import * as vscode from 'vscode';
import { Task } from '../../types/navigationTypes';

export interface StatusComponentProps {
  task: Task;
  currentStatus: string;
  availableStatuses: Array<{ label: string; value: string; color?: string }>;
  onStatusChange: (newStatus: string) => void;
  isEditable: boolean;
}

export interface StatusComponentState {
  isEditing: boolean;
  selectedStatus: string;
  isHovered: boolean;
}

/**
 * React-inspired component for task status display and editing
 */
export class StatusComponent {
  private props: StatusComponentProps;
  private state: StatusComponentState;
  private listeners: Array<(state: StatusComponentState) => void> = [];
  private statusQuickPick?: vscode.QuickPick<vscode.QuickPickItem>;

  constructor(props: StatusComponentProps) {
    this.props = props;
    this.state = {
      isEditing: false,
      selectedStatus: props.currentStatus,
      isHovered: false
    };
  }

  /**
   * Update component props (React-like)
   */
  public updateProps(newProps: Partial<StatusComponentProps>): void {
    this.props = { ...this.props, ...newProps };
    this.setState({ selectedStatus: newProps.currentStatus || this.state.selectedStatus });
  }

  /**
   * Update component state (React-like)
   */
  private setState(newState: Partial<StatusComponentState>): void {
    this.state = { ...this.state, ...newState };
    this.forceUpdate();
  }

  /**
   * Subscribe to state changes (React-like)
   */
  public subscribe(listener: (state: StatusComponentState) => void): () => void {
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
   * Start editing status
   */
  public startEditing(): void {
    if (!this.props.isEditable) {
      return;
    }

    this.setState({ isEditing: true });
    this.showStatusSelector();
  }

  /**
   * Cancel editing
   */
  public cancelEditing(): void {
    this.setState({ 
      isEditing: false,
      selectedStatus: this.props.currentStatus
    });
    this.hideStatusSelector();
  }

  /**
   * Confirm status change
   */
  public confirmStatusChange(): void {
    if (this.state.selectedStatus !== this.props.currentStatus) {
      this.props.onStatusChange(this.state.selectedStatus);
    }
    this.setState({ isEditing: false });
    this.hideStatusSelector();
  }

  /**
   * Show status selector QuickPick
   */
  private async showStatusSelector(): Promise<void> {
    const quickPick = vscode.window.createQuickPick();
    this.statusQuickPick = quickPick;

    quickPick.title = `Change Status for "${this.props.task.name}"`;
    quickPick.placeholder = 'Select new status...';
    quickPick.canSelectMany = false;
    quickPick.ignoreFocusOut = false;

    // Create quick pick items from available statuses
    quickPick.items = this.props.availableStatuses.map(status => ({
      label: `${this.getStatusEmoji(status.value)} ${status.label}`,
      description: status.value === this.props.currentStatus ? '(current)' : '',
      detail: status.color ? `Color: ${status.color}` : undefined,
      picked: status.value === this.props.currentStatus,
      alwaysShow: true
    }));

    // Set active item to current status
    const currentItem = quickPick.items.find(item => 
      item.description === '(current)'
    );
    if (currentItem) {
      quickPick.activeItems = [currentItem];
    }

    // Handle selection
    quickPick.onDidAccept(() => {
      const selectedItem = quickPick.selectedItems[0];
      if (selectedItem) {
        // Extract status value from label
        const statusValue = this.props.availableStatuses.find(s => 
          selectedItem.label.includes(s.label)
        )?.value;

        if (statusValue) {
          this.setState({ selectedStatus: statusValue });
          this.confirmStatusChange();
        }
      }
      quickPick.dispose();
    });

    // Handle cancellation
    quickPick.onDidHide(() => {
      this.cancelEditing();
      quickPick.dispose();
    });

    // Handle active item changes
    quickPick.onDidChangeActive(items => {
      if (items.length > 0) {
        const statusValue = this.props.availableStatuses.find(s => 
          items[0].label.includes(s.label)
        )?.value;

        if (statusValue) {
          this.setState({ selectedStatus: statusValue });
        }
      }
    });

    quickPick.show();
  }

  /**
   * Hide status selector
   */
  private hideStatusSelector(): void {
    if (this.statusQuickPick) {
      this.statusQuickPick.dispose();
      this.statusQuickPick = undefined;
    }
  }

  /**
   * Handle click event
   */
  public onClick(): void {
    if (this.props.isEditable) {
      this.startEditing();
    }
  }

  /**
   * Handle hover events
   */
  public onMouseEnter(): void {
    this.setState({ isHovered: true });
  }

  public onMouseLeave(): void {
    this.setState({ isHovered: false });
  }

  /**
   * Get status emoji based on status value
   */
  private getStatusEmoji(status: string): string {
    switch (status.toLowerCase()) {
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
      case 'testing':
      case 'qa':
        return '🧪';
      case 'approved':
        return '👍';
      case 'rejected':
        return '👎';
      default:
        return '📝';
    }
  }

  /**
   * Get status color
   */
  public getStatusColor(): string {
    const status = this.props.availableStatuses.find(s => 
      s.value === this.props.currentStatus
    );
    return status?.color || this.getDefaultStatusColor(this.props.currentStatus);
  }

  /**
   * Get default status color based on status type
   */
  private getDefaultStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'complete':
      case 'closed':
      case 'done':
        return '#2ecc71'; // Green
      case 'in progress':
      case 'active':
        return '#3498db'; // Blue
      case 'in review':
      case 'testing':
        return '#f39c12'; // Orange
      case 'blocked':
      case 'on hold':
        return '#e74c3c'; // Red
      case 'todo':
      case 'open':
      case 'new':
        return '#95a5a6'; // Gray
      default:
        return '#34495e'; // Dark gray
    }
  }

  /**
   * Get display text for status
   */
  public getDisplayText(): string {
    const emoji = this.getStatusEmoji(this.props.currentStatus);
    const statusLabel = this.props.availableStatuses.find(s => 
      s.value === this.props.currentStatus
    )?.label || this.props.currentStatus;

    return `${emoji} ${statusLabel}`;
  }

  /**
   * Get hover text
   */
  public getHoverText(): string {
    const parts = [`Current Status: ${this.getDisplayText()}`];
    
    if (this.props.isEditable) {
      parts.push('Click to change status');
    }

    // Add available status options
    if (this.props.availableStatuses.length > 1) {
      parts.push('');
      parts.push('Available statuses:');
      this.props.availableStatuses.forEach(status => {
        const emoji = this.getStatusEmoji(status.value);
        const current = status.value === this.props.currentStatus ? ' (current)' : '';
        parts.push(`${emoji} ${status.label}${current}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Check if status indicates completion
   */
  public isCompleted(): boolean {
    const completedStatuses = ['complete', 'closed', 'done'];
    return completedStatuses.includes(this.props.currentStatus.toLowerCase());
  }

  /**
   * Check if status indicates active work
   */
  public isActive(): boolean {
    const activeStatuses = ['in progress', 'active', 'in review', 'testing'];
    return activeStatuses.includes(this.props.currentStatus.toLowerCase());
  }

  /**
   * Check if status indicates a blocked state
   */
  public isBlocked(): boolean {
    const blockedStatuses = ['blocked', 'on hold'];
    return blockedStatuses.includes(this.props.currentStatus.toLowerCase());
  }

  /**
   * Get CSS class names for styling
   */
  public getCssClasses(): string[] {
    const classes = ['status-component'];

    if (this.state.isHovered) {
      classes.push('status-hovered');
    }

    if (this.state.isEditing) {
      classes.push('status-editing');
    }

    if (this.props.isEditable) {
      classes.push('status-editable');
    }

    if (this.isCompleted()) {
      classes.push('status-completed');
    } else if (this.isActive()) {
      classes.push('status-active');
    } else if (this.isBlocked()) {
      classes.push('status-blocked');
    }

    return classes;
  }

  /**
   * Get current props (React-like)
   */
  public getProps(): StatusComponentProps {
    return { ...this.props };
  }

  /**
   * Get current state (React-like)
   */
  public getState(): StatusComponentState {
    return { ...this.state };
  }

  /**
   * Cleanup component
   */
  public dispose(): void {
    this.listeners = [];
    this.hideStatusSelector();
  }
}
