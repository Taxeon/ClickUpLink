import { ClickUpUser } from '../../types';

export interface NavigationItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface Project extends NavigationItem {
  members?: ClickUpUser[];
  color?: string;
}

export interface Folder extends NavigationItem {
  projectId: string;
  hidden?: boolean;
}

export interface List extends NavigationItem {
  folderId: string;
  projectId: string;
  status?: {
    color: string;
    type: string;
  };
}

export interface Task extends NavigationItem {
  listId: string;
  folderId: string;
  projectId: string;
  status?: string;
  priority?: {
    id: string;
    priority: string;
    color: string;
  };
  assignees?: string[];
  dueDate?: number; // Unix timestamp
  tags?: string[];
}

export interface NavigationState {
  currentProject?: Project;
  currentFolder?: Folder;
  currentList?: List;
  currentTask?: Task;
  breadcrumbs: NavigationItem[];
  history: Array<{
    type: 'project' | 'folder' | 'list' | 'task';
    id: string;
  }>;
}

export interface NavigationContextType {
  state: NavigationState;
  navigateToProject: (projectId: string) => Promise<void>;
  navigateToFolder: (folderId: string) => Promise<void>;
  navigateToList: (listId: string) => Promise<void>;
  navigateToTask: (taskId: string) => Promise<void>;
  goBack: () => Promise<void>;
  resetNavigation: () => void;
  isLoading: boolean;
  error: Error | null;
}

export interface CacheState {
  projects: Record<string, Project>;
  folders: Record<string, Folder>;
  lists: Record<string, List>;
  tasks: Record<string, Task>;
  lastUpdated: {
    projects?: number;
    folders?: Record<string, number>; // Key is projectId
    lists?: Record<string, number>; // Key is folderId
    tasks?: Record<string, number>; // Key is listId
  };
}

export interface CacheContextType {
  state: CacheState;
  getProjects: () => Promise<Project[]>;
  getFolders: (projectId: string) => Promise<Folder[]>;
  getLists: (folderId: string, projectId?: string) => Promise<List[]>;
  getTasks: (listId: string) => Promise<Task[]>;  invalidateProjects: () => void;
  invalidateFolder: (projectId: string) => void;
  invalidateList: (folderId: string) => void;
  invalidateTasks: (listId: string) => void;
  isLoading: boolean;
  error: Error | null;
}