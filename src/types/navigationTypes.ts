import { ClickUpUser } from './index';

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
  projectId?: string;
  status?: {
    status: string;
    color: string;
    type?: string;
  };
}

export interface Task extends NavigationItem {
  listId: string;
  folderId?: string;
  projectId?: string;
  status?: {
    status: string;
    color: string;
    type?: string;
  } | string;
  assignees?: ClickUpUser[] | string[];
  dueDate?: number;
  priority?: {
    priority: string;
    color: string;
    id?: any;
  };
  tags?: string[];
}

export interface NavigationState {
  currentProject: Project | null;
  currentFolder: Folder | null;
  currentList: List | null; 
  currentTask: Task | null;
  breadcrumbs: NavigationItem[];
  history: Array<{type: 'project' | 'folder' | 'list' | 'task', id: string}>;
}

export interface NavigationContextType {
  state: NavigationState;
  goToProject: (project: Project) => void;
  goToFolder: (folder: Folder) => void;
  goToList: (list: List) => void;
  goToTask: (task: Task) => void;
  goBack: () => Promise<boolean>;
  reset: () => void;
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
  getTasks: (listId: string) => Promise<Task[]>;
  invalidateProjects: () => void;
  invalidateFolder: (projectId: string) => void;
  invalidateList: (folderId: string) => void;
  invalidateTasks: (listId: string) => void;
  isLoading: boolean;
  error: Error | null;
  addProject: (project: Project) => void;
  addFolder: (folder: Folder) => void;
  addList: (list: List) => void;
  addTask: (task: Task) => void;
  updateProject: (project: Project) => void;
  updateFolder: (folder: Folder) => void;
  updateList: (list: List) => void;
  updateTask: (task: Task) => void;
  deleteProject: (projectId: string) => void;
  deleteFolder: (folderId: string) => void;
  deleteList: (listId: string) => void;
  deleteTask: (taskId: string) => void;
}
