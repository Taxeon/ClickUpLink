import { EventEmitter } from 'events';
import { CacheState, Project, Folder, List, Task } from '../types/navigation';

const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

const initialState: CacheState = {
  projects: {},
  folders: {},
  lists: {},
  tasks: {},
  lastUpdated: {}
};

class CacheStateManager extends EventEmitter {
  private state: CacheState = initialState;

  getState(): CacheState {
    return this.state;
  }

  setProjects(projects: Project[]): void {
    const projectsMap = projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, Project>);
    
    this.state.projects = projectsMap;
    this.state.lastUpdated = { 
      ...this.state.lastUpdated,
      projects: Date.now() 
    };
    this.emit('change', this.state);
  }

  setFolders(projectId: string, folders: Folder[]): void {
    const foldersMap = folders.reduce((acc, folder) => {
      acc[folder.id] = folder;
      return acc;
    }, {} as Record<string, Folder>);
    
    this.state.folders = { ...this.state.folders, ...foldersMap };
    this.state.lastUpdated.folders = {
      ...this.state.lastUpdated.folders,
      [projectId]: Date.now()
    };
    this.emit('change', this.state);
  }

  setLists(folderId: string, lists: List[]): void {
    const listsMap = lists.reduce((acc, list) => {
      acc[list.id] = list;
      return acc;
    }, {} as Record<string, List>);
    
    this.state.lists = { ...this.state.lists, ...listsMap };
    this.state.lastUpdated.lists = {
      ...this.state.lastUpdated.lists,
      [folderId]: Date.now()
    };
    this.emit('change', this.state);
  }

  setTasks(listId: string, tasks: Task[]): void {
    const tasksMap = tasks.reduce((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {} as Record<string, Task>);
    
    this.state.tasks = { ...this.state.tasks, ...tasksMap };
    this.state.lastUpdated.tasks = {
      ...this.state.lastUpdated.tasks,
      [listId]: Date.now()
    };
    this.emit('change', this.state);
  }

  isCacheValid(type: 'projects' | 'folders' | 'lists' | 'tasks', parentId?: string): boolean {
    if (type === 'projects') {
      const lastUpdated = this.state.lastUpdated.projects;
      return !!lastUpdated && (Date.now() - lastUpdated) < CACHE_EXPIRY_TIME;
    } 
    
    if (!parentId) {
      return false;
    }
    
    const lastUpdated = this.state.lastUpdated[type]?.[parentId];
    return !!lastUpdated && (Date.now() - lastUpdated) < CACHE_EXPIRY_TIME;
  }

  invalidateProjects(): void {
    this.state.lastUpdated.projects = undefined;
    this.emit('change', this.state);
  }

  invalidateFolders(projectId: string): void {
    if (this.state.lastUpdated.folders) {
      delete this.state.lastUpdated.folders[projectId];
      this.emit('change', this.state);
    }
  }

  invalidateLists(folderId: string): void {
    if (this.state.lastUpdated.lists) {
      delete this.state.lastUpdated.lists[folderId];
      this.emit('change', this.state);
    }
  }

  invalidateTasks(listId: string): void {
    if (this.state.lastUpdated.tasks) {
      delete this.state.lastUpdated.tasks[listId];
      this.emit('change', this.state);
    }
  }

  reset(): void {
    this.state = initialState;
    this.emit('change', this.state);
  }

  subscribe(listener: (state: CacheState) => void): () => void {
    this.on('change', listener);
    return () => this.removeListener('change', listener);
  }
}

export const cacheState = new CacheStateManager();
