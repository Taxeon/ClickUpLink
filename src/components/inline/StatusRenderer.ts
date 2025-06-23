import * as vscode from 'vscode';

export interface StatusRenderOptions {
  showEmoji: boolean;
  showColor: boolean;
  compact: boolean;
  interactive: boolean;
}

export interface RenderedStatus {
  text: string;
  color: string;
  emoji: string;
  isClickable: boolean;
}

/**
 * Renders task status information with visual indicators
 */
export class StatusRenderer {
  private static instance: StatusRenderer;
  private context: vscode.ExtensionContext;
  private options: StatusRenderOptions;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.options = {
      showEmoji: true,
      showColor: true,
      compact: false,
      interactive: true
    };

    this.loadConfiguration();
  }

  static getInstance(context: vscode.ExtensionContext): StatusRenderer {
    if (!StatusRenderer.instance) {
      StatusRenderer.instance = new StatusRenderer(context);
    }
    return StatusRenderer.instance;
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('clickupLink.status');
    
    this.options = {
      showEmoji: config.get('showEmoji', true),
      showColor: config.get('showColor', true),
      compact: config.get('compact', false),
      interactive: config.get('interactive', true)
    };
  }

  /**
   * Render status for inline display
   */
  public renderInlineStatus(
    status: string | { status: string; color?: string },
    options?: Partial<StatusRenderOptions>
  ): RenderedStatus {
    const renderOptions = { ...this.options, ...options };
    const statusText = typeof status === 'string' ? status : status.status;
    const statusColor = typeof status === 'object' && status.color 
      ? status.color 
      : this.getDefaultStatusColor(statusText);

    const emoji = renderOptions.showEmoji ? this.getStatusEmoji(statusText) : '';
    const displayText = renderOptions.compact 
      ? this.getCompactStatusText(statusText)
      : statusText;

    const text = renderOptions.showEmoji 
      ? `${emoji} ${displayText}`
      : displayText;

    return {
      text,
      color: renderOptions.showColor ? statusColor : 'inherit',
      emoji,
      isClickable: renderOptions.interactive
    };
  }

  /**
   * Create status decoration for VS Code editor
   */
  public createStatusDecoration(
    status: string | { status: string; color?: string },
    range: vscode.Range
  ): vscode.DecorationOptions {
    const rendered = this.renderInlineStatus(status, { compact: true });
    
    return {
      range,
      renderOptions: {
        after: {
          contentText: ` ${rendered.text}`,
          color: rendered.color,
          fontStyle: 'italic',
          margin: '0 0 0 10px'
        }
      },
      hoverMessage: this.createStatusHoverMessage(status)
    };
  }

  /**
   * Create hover message for status
   */
  public createStatusHoverMessage(
    status: string | { status: string; color?: string }
  ): vscode.MarkdownString {
    const statusText = typeof status === 'string' ? status : status.status;
    const statusColor = typeof status === 'object' && status.color 
      ? status.color 
      : this.getDefaultStatusColor(statusText);

    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    const emoji = this.getStatusEmoji(statusText);
    const description = this.getStatusDescription(statusText);

    markdown.appendMarkdown(`### ${emoji} Status: ${statusText}\n\n`);
    
    if (description) {
      markdown.appendMarkdown(`*${description}*\n\n`);
    }

    // Status color indicator
    markdown.appendMarkdown(
      `<span style="display: inline-block; width: 12px; height: 12px; background-color: ${statusColor}; border-radius: 2px; margin-right: 8px;"></span>`
    );
    markdown.appendMarkdown(`Color: ${statusColor}\n\n`);

    // Add action links if interactive
    if (this.options.interactive) {
      markdown.appendMarkdown('**Actions:**\n');
      markdown.appendMarkdown('- [Change Status](command:clickupLink.changeTaskStatus)\n');
      markdown.appendMarkdown('- [View Status History](command:clickupLink.viewStatusHistory)\n');
    }

    return markdown;
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status: string): string {
    switch (status.toLowerCase()) {
      case 'complete':
      case 'closed':
      case 'done':
      case 'resolved':
        return '✅';
      case 'in progress':
      case 'active':
      case 'working':
        return '🔄';
      case 'in review':
      case 'review':
      case 'pending review':
        return '👀';
      case 'blocked':
      case 'on hold':
      case 'paused':
        return '⚠️';
      case 'todo':
      case 'open':
      case 'new':
      case 'created':
        return '📋';
      case 'testing':
      case 'qa':
      case 'quality assurance':
        return '🧪';
      case 'approved':
      case 'accepted':
        return '✅';
      case 'rejected':
      case 'declined':
        return '❌';
      case 'draft':
      case 'planning':
        return '📝';
      case 'urgent':
      case 'critical':
        return '🚨';
      default:
        return '📄';
    }
  }

  /**
   * Get compact status text
   */
  private getCompactStatusText(status: string): string {
    switch (status.toLowerCase()) {
      case 'in progress':
        return 'Progress';
      case 'in review':
        return 'Review';
      case 'quality assurance':
        return 'QA';
      case 'pending review':
        return 'Pending';
      default:
        return status.length > 8 ? status.substring(0, 8) + '...' : status;
    }
  }

  /**
   * Get default status color
   */
  private getDefaultStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'complete':
      case 'closed':
      case 'done':
      case 'resolved':
      case 'approved':
      case 'accepted':
        return '#2ecc71'; // Green
      case 'in progress':
      case 'active':
      case 'working':
        return '#3498db'; // Blue
      case 'in review':
      case 'review':
      case 'pending review':
      case 'testing':
      case 'qa':
        return '#f39c12'; // Orange
      case 'blocked':
      case 'on hold':
      case 'paused':
      case 'rejected':
      case 'declined':
        return '#e74c3c'; // Red
      case 'todo':
      case 'open':
      case 'new':
      case 'created':
        return '#95a5a6'; // Gray
      case 'draft':
      case 'planning':
        return '#9b59b6'; // Purple
      case 'urgent':
      case 'critical':
        return '#ff0000'; // Bright Red
      default:
        return '#34495e'; // Dark Gray
    }
  }

  /**
   * Get status description
   */
  private getStatusDescription(status: string): string {
    switch (status.toLowerCase()) {
      case 'complete':
      case 'closed':
      case 'done':
        return 'Task has been completed successfully';
      case 'in progress':
      case 'active':
        return 'Task is currently being worked on';
      case 'in review':
      case 'review':
        return 'Task is being reviewed by team members';
      case 'blocked':
        return 'Task is blocked and cannot proceed';
      case 'on hold':
        return 'Task has been temporarily paused';
      case 'todo':
      case 'open':
      case 'new':
        return 'Task is ready to be started';
      case 'testing':
      case 'qa':
        return 'Task is being tested for quality assurance';
      case 'approved':
        return 'Task has been approved and accepted';
      case 'rejected':
        return 'Task has been rejected and needs changes';
      case 'draft':
        return 'Task is in draft stage';
      case 'urgent':
        return 'Task requires immediate attention';
      default:
        return '';
    }
  }

  /**
   * Get status priority level (for sorting/filtering)
   */
  public getStatusPriority(status: string): number {
    switch (status.toLowerCase()) {
      case 'urgent':
      case 'critical':
        return 1;
      case 'blocked':
        return 2;
      case 'in progress':
      case 'active':
        return 3;
      case 'in review':
      case 'testing':
        return 4;
      case 'todo':
      case 'open':
      case 'new':
        return 5;
      case 'draft':
      case 'planning':
        return 6;
      case 'on hold':
      case 'paused':
        return 7;
      case 'complete':
      case 'closed':
      case 'done':
        return 8;
      case 'rejected':
      case 'declined':
        return 9;
      default:
        return 10;
    }
  }

  /**
   * Check if status indicates active work
   */
  public isActiveStatus(status: string): boolean {
    const activeStatuses = [
      'in progress', 'active', 'working', 
      'in review', 'review', 'testing', 'qa'
    ];
    return activeStatuses.includes(status.toLowerCase());
  }

  /**
   * Check if status indicates completion
   */
  public isCompletedStatus(status: string): boolean {
    const completedStatuses = [
      'complete', 'closed', 'done', 'resolved', 
      'approved', 'accepted'
    ];
    return completedStatuses.includes(status.toLowerCase());
  }

  /**
   * Check if status indicates a problem
   */
  public isProblemStatus(status: string): boolean {
    const problemStatuses = [
      'blocked', 'on hold', 'paused', 
      'rejected', 'declined', 'urgent', 'critical'
    ];
    return problemStatuses.includes(status.toLowerCase());
  }

  /**
   * Get status transition suggestions
   */
  public getStatusTransitions(currentStatus: string): Array<{
    status: string;
    label: string;
    description: string;
  }> {
    const current = currentStatus.toLowerCase();
    const transitions: Array<{
      status: string;
      label: string;
      description: string;
    }> = [];

    switch (current) {
      case 'todo':
      case 'open':
      case 'new':
        transitions.push(
          { status: 'in progress', label: 'Start Work', description: 'Begin working on this task' },
          { status: 'blocked', label: 'Mark Blocked', description: 'Task cannot proceed' }
        );
        break;
      case 'in progress':
      case 'active':
        transitions.push(
          { status: 'in review', label: 'Submit for Review', description: 'Ready for team review' },
          { status: 'complete', label: 'Mark Complete', description: 'Task is finished' },
          { status: 'blocked', label: 'Mark Blocked', description: 'Encountered a blocker' },
          { status: 'on hold', label: 'Put on Hold', description: 'Temporarily pause work' }
        );
        break;
      case 'in review':
        transitions.push(
          { status: 'approved', label: 'Approve', description: 'Review passed' },
          { status: 'rejected', label: 'Reject', description: 'Needs changes' },
          { status: 'in progress', label: 'Return to Progress', description: 'Continue working' }
        );
        break;
      case 'blocked':
        transitions.push(
          { status: 'in progress', label: 'Unblock', description: 'Blocker has been resolved' },
          { status: 'todo', label: 'Reset to Todo', description: 'Return to backlog' }
        );
        break;
      default:
        // Common transitions for any status
        transitions.push(
          { status: 'in progress', label: 'Start Progress', description: 'Begin or resume work' },
          { status: 'complete', label: 'Mark Complete', description: 'Task is finished' }
        );
    }

    return transitions;
  }

  /**
   * Update rendering options
   */
  public updateOptions(newOptions: Partial<StatusRenderOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  public getOptions(): StatusRenderOptions {
    return { ...this.options };
  }
}
