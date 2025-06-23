// decorations.ts
// TypeScript interfaces for Phase 3 text decorations and inline components

import * as vscode from 'vscode';

export interface TaskDecoration {
  range: vscode.Range;
  taskId: string;
  taskData?: ClickUpTask;
  decorationType: vscode.TextEditorDecorationType;
  hoverMessage?: vscode.MarkdownString;
  isClickable: boolean;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: {
    status: string;
    color: string;
    orderindex: number;
    type: string;
  };
  assignees: ClickUpUser[];
  creator: ClickUpUser;
  watchers: ClickUpUser[];
  checklists: any[];
  tags: string[];
  parent?: string;
  priority?: {
    priority: string;
    color: string;
  };
  due_date?: string;
  start_date?: string;
  points?: number;
  time_estimate?: number;
  time_spent?: number;
  custom_fields: any[];
  list: {
    id: string;
    name: string;
    access: boolean;
  };
  project: {
    id: string;
    name: string;
    hidden: boolean;
    access: boolean;
  };
  folder: {
    id: string;
    name: string;
    hidden: boolean;
    access: boolean;
  };
  space: {
    id: string;
  };
  url: string;
  date_created: string;
  date_updated: string;
  date_closed?: string;
  archived: boolean;
  deleted: boolean;
  text_content?: string;
  description?: string;
  markdown_description?: string;
}

export interface ClickUpUser {
  id: string;
  username: string;
  email: string;
  color: string;
  profilePicture: string;
  initials: string;
  role: number;
  custom_role?: string;
  last_active?: string;
  date_joined?: string;
  date_invited?: string;
}

export interface TriggerPattern {
  pattern: RegExp;
  type: 'task-reference' | 'clickup-keyword' | 'status-keyword';
  priority: number;
  enableInlineDisplay: boolean;
  enableWorkflow: boolean;
}

export interface InlineInteractionState {
  activeHover?: {
    taskId: string;
    position: vscode.Position;
  };
  activeContextMenu?: {
    taskId: string;
    position: vscode.Position;
    items: vscode.QuickPickItem[];
  };
  clickHandlers: Map<string, (taskId: string) => Promise<void>>;
  hoverHandlers: Map<string, (taskId: string, position: vscode.Position) => Promise<void>>;
}

export interface DecorationConfig {
  enabled: boolean;
  greyTextColor: string;
  hoverShowDetails: boolean;
  clickActionType: 'none' | 'open-task' | 'show-menu' | 'show-webview';
  maxDecorationsPerFile: number;
  refreshIntervalMs: number;
  showInlineStatus: boolean;
  showInlineAssignees: boolean;
  showInlinePriority: boolean;
}

export interface TaskInsertionOptions {
  insertMode: 'replace' | 'append' | 'prepend';
  format: 'id-only' | 'name-only' | 'id-and-name' | 'full-link';
  includeStatus: boolean;
  includeAssignees: boolean;
  customTemplate?: string;
}

export interface DecorationPerformanceStats {
  totalDecorations: number;
  renderTimeMs: number;
  lastRefreshTime: Date;
  cacheHitRate: number;
  averageTaskFetchTimeMs: number;
}

export interface StatusDisplayOptions {
  showColor: boolean;
  showEmoji: boolean;
  showText: boolean;
  position: 'before' | 'after' | 'inline';
}

export interface WorkflowTriggerEvent {
  type: 'text-detected' | 'command-invoked' | 'hover-activated' | 'context-menu-opened';
  position: vscode.Position;
  text: string;
  triggerPattern: TriggerPattern;
  document: vscode.TextDocument;
}
