import * as vscode from 'vscode';
import { Task } from '../../types/navigationTypes';

export interface TaskRenderOptions {
  showStatus: boolean;
  showPriority: boolean;
  showAssignees: boolean;
  showDueDate: boolean;
  showTags: boolean;
  compact: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface RenderedTask {
  markdown: vscode.MarkdownString;
  text: string;
  hasInteractiveElements: boolean;
}

/**
 * Renders task information for inline display and hover content
 */
export class TaskRenderer {
  private static instance: TaskRenderer;
  private context: vscode.ExtensionContext;
  private options: TaskRenderOptions;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.options = {
      showStatus: true,
      showPriority: true,
      showAssignees: true,
      showDueDate: true,
      showTags: false,
      compact: false,
      theme: 'auto'
    };

    this.loadConfiguration();
  }

  static getInstance(context: vscode.ExtensionContext): TaskRenderer {
    if (!TaskRenderer.instance) {
      TaskRenderer.instance = new TaskRenderer(context);
    }
    return TaskRenderer.instance;
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('clickupLink.rendering');
    
    this.options = {
      showStatus: config.get('showStatus', true),
      showPriority: config.get('showPriority', true),
      showAssignees: config.get('showAssignees', true),
      showDueDate: config.get('showDueDate', true),
      showTags: config.get('showTags', false),
      compact: config.get('compact', false),
      theme: config.get('theme', 'auto')
    };
  }

  /**
   * Create hover content for a task
   */
  public createHoverContent(task: Task): vscode.Hover {
    const rendered = this.renderTask(task, { ...this.options, compact: false });
    
    return new vscode.Hover(rendered.markdown);
  }

  /**
   * Create inline display text for a task
   */
  public createInlineText(task: Task): string {
    const rendered = this.renderTask(task, { ...this.options, compact: true });
    return rendered.text;
  }

  /**
   * Render task with full formatting
   */
  public renderTask(task: Task, options?: Partial<TaskRenderOptions>): RenderedTask {
    const renderOptions = { ...this.options, ...options };
    
    if (renderOptions.compact) {
      return this.renderCompactTask(task, renderOptions);
    } else {
      return this.renderDetailedTask(task, renderOptions);
    }
  }

  /**
   * Render compact task display
   */
  private renderCompactTask(task: Task, options: TaskRenderOptions): RenderedTask {
    const parts: string[] = [];
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    // Status emoji
    if (options.showStatus) {
      const statusEmoji = this.getStatusEmoji(task.status);
      parts.push(statusEmoji);
    }

    // Task name
    parts.push(task.name);

    // Priority indicator
    if (options.showPriority && task.priority) {
      const priorityIndicator = this.getPriorityIndicator(task.priority.priority);
      parts.push(priorityIndicator);
    }

    const text = parts.join(' ');
    markdown.appendMarkdown(text);

    return {
      markdown,
      text,
      hasInteractiveElements: false
    };
  }

  /**
   * Render detailed task display
   */
  private renderDetailedTask(task: Task, options: TaskRenderOptions): RenderedTask {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    // Task header with name and status
    const statusEmoji = this.getStatusEmoji(task.status);
    const statusText = this.getStatusText(task.status);
    
    markdown.appendMarkdown(`## ${statusEmoji} ${task.name}\n\n`);

    // Status section
    if (options.showStatus && task.status) {
      const statusColor = this.getStatusColor(task.status);
      markdown.appendMarkdown(
        `**Status:** <span style="color: ${statusColor};">${statusText}</span>\n\n`
      );
    }

    // Description
    if (task.description) {
      markdown.appendMarkdown(`*${task.description}*\n\n`);
    }

    // Task details table
    const details: Array<[string, string]> = [];

    // Priority
    if (options.showPriority && task.priority) {
      const priorityColor = task.priority.color || this.getPriorityColor(task.priority.priority);
      details.push([
        'Priority',
        `<span style="color: ${priorityColor};">${task.priority.priority}</span>`
      ]);
    }

    // Assignees
    if (options.showAssignees && task.assignees && task.assignees.length > 0) {
      const assigneeText = this.formatAssignees(task.assignees);
      details.push(['Assignees', assigneeText]);
    }

    // Due date
    if (options.showDueDate && task.dueDate) {
      const dueDateText = this.formatDueDate(task.dueDate);
      const isOverdue = task.dueDate < Date.now();
      const dateColor = isOverdue ? '#e74c3c' : 'inherit';
      
      details.push([
        'Due Date',
        `<span style="color: ${dateColor};">${dueDateText}</span>`
      ]);
    }

    // Tags
    if (options.showTags && task.tags && task.tags.length > 0) {
      const tagsText = task.tags.map(tag => 
        `<span style="background-color: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">${tag}</span>`
      ).join(' ');
      details.push(['Tags', tagsText]);
    }

    // Render details table
    if (details.length > 0) {
      markdown.appendMarkdown('| | |\n|---|---|\n');
      details.forEach(([label, value]) => {
        markdown.appendMarkdown(`| **${label}** | ${value} |\n`);
      });
      markdown.appendMarkdown('\n');
    }

    // Action links
    markdown.appendMarkdown(this.renderActionLinks(task));

    const text = this.extractTextFromMarkdown(markdown.value);

    return {
      markdown,
      text,
      hasInteractiveElements: true
    };
  }

  /**
   * Render action links for task
   */
  private renderActionLinks(task: Task): string {
    const links: string[] = [];

    // Open in ClickUp
    const taskUrl = `https://app.clickup.com/t/${task.id}`;
    links.push(`[Open in ClickUp](${taskUrl})`);

    // Quick status changes
    const currentStatus = this.getStatusText(task.status);
    if (currentStatus !== 'Complete') {
      links.push(`[Mark Complete](command:clickupLink.markTaskComplete?${encodeURIComponent(JSON.stringify([task.id]))})`);
    }

    if (currentStatus !== 'In Progress') {
      links.push(`[Start Progress](command:clickupLink.startTaskProgress?${encodeURIComponent(JSON.stringify([task.id]))})`);
    }

    // Copy task link
    links.push(`[Copy Link](command:clickupLink.copyTaskLink?${encodeURIComponent(JSON.stringify([task.id]))})`);

    return `\n---\n${links.join(' • ')}\n`;
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
      case 'testing':
      case 'qa':
        return '🧪';
      case 'approved':
        return '✅';
      case 'rejected':
        return '❌';
      default:
        return '📝';
    }
  }

  /**
   * Get status text
   */
  private getStatusText(status?: string | { status: string }): string {
    if (typeof status === 'string') {
      return status;
    }
    return status?.status || 'Unknown';
  }

  /**
   * Get status color
   */
  private getStatusColor(status?: string | { status: string; color?: string }): string {
    if (typeof status === 'object' && status.color) {
      return status.color;
    }

    const statusText = typeof status === 'string' ? status : status?.status || '';
    
    switch (statusText.toLowerCase()) {
      case 'complete':
      case 'closed':
      case 'done':
        return '#2ecc71';
      case 'in progress':
      case 'active':
        return '#3498db';
      case 'in review':
      case 'testing':
        return '#f39c12';
      case 'blocked':
      case 'on hold':
        return '#e74c3c';
      case 'todo':
      case 'open':
      case 'new':
        return '#95a5a6';
      default:
        return '#34495e';
    }
  }

  /**
   * Get priority indicator
   */
  private getPriorityIndicator(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return '🚨';
      case 'high':
        return '🔴';
      case 'medium':
      case 'normal':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  }

  /**
   * Get priority color
   */
  private getPriorityColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return '#ff0000';
      case 'high':
        return '#ff6b6b';
      case 'medium':
      case 'normal':
        return '#ffd93d';
      case 'low':
        return '#6bcf7f';
      default:
        return '#95a5a6';
    }
  }

  /**
   * Format assignees for display
   */
  private formatAssignees(assignees: string[] | any[]): string {
    if (typeof assignees[0] === 'string') {
      return (assignees as string[]).join(', ');
    }

    return (assignees as any[])
      .map(assignee => assignee.username || assignee.name || 'Unknown')
      .join(', ');
  }

  /**
   * Format due date for display
   */
  private formatDueDate(dueDate: number): string {
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays === -1) {
      return 'Yesterday';
    } else if (diffDays > 0) {
      return `In ${diffDays} days`;
    } else {
      return `${Math.abs(diffDays)} days overdue`;
    }
  }

  /**
   * Extract plain text from markdown
   */
  private extractTextFromMarkdown(markdown: string): string {
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
      .replace(/<[^>]*>/g, '') // HTML tags
      .replace(/#{1,6}\s/g, '') // Headers
      .replace(/\|/g, ' ') // Table separators
      .replace(/\n\s*\n/g, '\n') // Multiple newlines
      .trim();
  }

  /**
   * Update rendering options
   */
  public updateOptions(newOptions: Partial<TaskRenderOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  public getOptions(): TaskRenderOptions {
    return { ...this.options };
  }

  /**
   * Create status badge for inline display
   */
  public createStatusBadge(status?: string | { status: string; color?: string }): string {
    const emoji = this.getStatusEmoji(status);
    const text = this.getStatusText(status);
    return `${emoji} ${text}`;
  }

  /**
   * Create priority badge for inline display
   */
  public createPriorityBadge(priority?: { priority: string; color?: string }): string {
    if (!priority) return '';
    
    const indicator = this.getPriorityIndicator(priority.priority);
    return `${indicator} ${priority.priority}`;
  }
}
