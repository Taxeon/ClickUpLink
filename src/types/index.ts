import * as vscode from 'vscode';

// index.ts
// TypeScript interfaces and types

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface ConfigState {
  workspaceId: string | null;
  theme: 'light' | 'dark';
  notificationsEnabled: boolean;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
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

export interface ClickUpTaskStatus {
  id: string;
  status: string;
  color: string;
  type: string;
  orderindex: number;
}

export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: ClickUpTaskStatus;
  url: string;
  date_created: string;
  date_updated: string;
  creator: ClickUpUser;
  assignees: ClickUpUser[];
  priority?: {
    id: string;
    priority: string;
    color: string;
  };
  due_date?: string;
  list: {
    id: string;
    name: string;
  };
  folder?: {
    id: string;
    name: string;
  };
  space: {
    id: string;
    name: string;
  };
}

export interface TaskReference {
  range: vscode.Range;
  folderId?: string;
  folderName?: string;
  listId?: string;
  listName?: string;
  taskId?: string;
  taskName?: string;
  status?: string;
  taskStatus?: ClickUpTaskStatus;
  lastUpdated?: string;
  commentText?: string;
  workspaceFolderPath?: string;
  assignee?: ClickUpUser;
  assignees?: ClickUpUser[];
  parentTaskId?: string;
  parentTaskName?: string;
  description?: string;
  parentTaskDescription?: string;
}