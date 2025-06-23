import * as vscode from 'vscode';
import { CacheContextType, Project, Folder, List, Task } from '../../types/navigation';
import { cacheState } from '../../state/CacheState';
import { ProjectService } from '../../services/ProjectService';
import { FolderService } from '../../services/FolderService';
import { ListService } from '../../services/ListService';
import { TaskService } from '../../services/TaskService';

export class CacheProvider {
  private context: vscode.ExtensionContext;
  private state: CacheContextType;
  private subscribers: Array<(state: CacheContextType) => void> = [];
  private projectService: ProjectService;
  private folderService: FolderService;
  private listService: ListService;
  private taskService: TaskService;
  
  private static instance: CacheProvider;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.projectService = ProjectService.getInstance(context);
    this.folderService = FolderService.getInstance(context);
    this.listService = ListService.getInstance(context);
    this.taskService = TaskService.getInstance(context);
    
    this.state = {
      state: cacheState.getState(),
      getProjects: this.getProjects.bind(this),
      getFolders: this.getFolders.bind(this),
      getLists: this.getLists.bind(this),
      getTasks: this.getTasks.bind(this),
      invalidateProjects: this.invalidateProjects.bind(this),
      invalidateFolder: this.invalidateFolder.bind(this),
      invalidateList: this.invalidateList.bind(this),
      invalidateTasks: this.invalidateTasks.bind(this),
      addProject: this.addProject.bind(this),
      addFolder: this.addFolder.bind(this),
      addList: this.addList.bind(this),
      addTask: this.addTask.bind(this),
      updateProject: this.updateProject.bind(this),
      updateFolder: this.updateFolder.bind(this),
      updateList: this.updateList.bind(this),
      updateTask: this.updateTask.bind(this),
      deleteProject: this.deleteProject.bind(this),
      deleteFolder: this.deleteFolder.bind(this),
      deleteList: this.deleteList.bind(this),
      deleteTask: this.deleteTask.bind(this),
      isLoading: false,
      error: null
    };

    cacheState.subscribe(this.handleStateChange.bind(this));
  }

  static getInstance(context: vscode.ExtensionContext): CacheProvider {
    if (!CacheProvider.instance) {
      CacheProvider.instance = new CacheProvider(context);
    }
    return CacheProvider.instance;
  }

  private handleStateChange(newCacheState: any): void {
    this.state = { ...this.state, state: newCacheState };
    this.notifySubscribers();
  }

  private updateState(updates: Partial<CacheContextType>): void {
    this.state = { ...this.state, ...updates };
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.state);
    }
  }

  async getProjects(): Promise<Project[]> {
    try {
      this.updateState({ isLoading: true, error: null });
      
      // Check if cache is valid
      if (cacheState.isCacheValid('projects')) {
        const projects = Object.values(this.state.state.projects);
        this.updateState({ isLoading: false });
        return projects;
      }
      
      // Fetch fresh data if cache invalid
      const projects = await this.projectService.getProjects();
      cacheState.setProjects(projects);
      
      this.updateState({ isLoading: false });
      return projects;
    } catch (error: any) {
      this.updateState({ isLoading: false, error });
      vscode.window.showErrorMessage(`Failed to fetch projects: ${error.message}`);
      return [];
    }
  }

  async getFolders(projectId: string): Promise<Folder[]> {
    try {
      this.updateState({ isLoading: true, error: null });
      
      // Check if cache is valid
      if (cacheState.isCacheValid('folders', projectId)) {
        const allFolders = this.state.state.folders;
        const foldersList = Object.values(allFolders).filter(
          folder => folder.projectId === projectId
        );
        this.updateState({ isLoading: false });
        return foldersList;
      }
      
      // Fetch fresh data if cache invalid
      const folders = await this.folderService.getFolders(projectId);
      cacheState.setFolders(projectId, folders);
      
      this.updateState({ isLoading: false });
      return folders;
    } catch (error: any) {
      this.updateState({ isLoading: false, error });
      vscode.window.showErrorMessage(`Failed to fetch folders: ${error.message}`);
      return [];
    }
  }

  async getLists(folderId: string, projectId?: string): Promise<List[]> {
    try {
      this.updateState({ isLoading: true, error: null });
      
      // Check if cache is valid
      if (cacheState.isCacheValid('lists', folderId)) {
        const allLists = this.state.state.lists;
        const listsList = Object.values(allLists).filter(
          list => list.folderId === folderId
        );
        this.updateState({ isLoading: false });
        return listsList;
      }
      
      // Fetch fresh data if cache invalid
      const lists = await this.listService.getLists(folderId);
      cacheState.setLists(folderId, lists);
      
      this.updateState({ isLoading: false });
      return lists;
    } catch (error: any) {
      this.updateState({ isLoading: false, error });
      vscode.window.showErrorMessage(`Failed to fetch lists: ${error.message}`);
      return [];
    }
  }

  async getTasks(listId: string): Promise<Task[]> {
    try {
      this.updateState({ isLoading: true, error: null });
      
      // Check if cache is valid
      if (cacheState.isCacheValid('tasks', listId)) {
        const allTasks = this.state.state.tasks;
        const tasksList = Object.values(allTasks).filter(
          task => task.listId === listId
        );
        this.updateState({ isLoading: false });
        return tasksList;
      }
      
      // Fetch fresh data if cache invalid
      const tasks = await this.taskService.getTasks(listId);
      cacheState.setTasks(listId, tasks);
      
      this.updateState({ isLoading: false });
      return tasks;
    } catch (error: any) {
      this.updateState({ isLoading: false, error });
      vscode.window.showErrorMessage(`Failed to fetch tasks: ${error.message}`);
      return [];
    }
  }

  invalidateProjects(): void {
    cacheState.invalidateProjects();
  }

  invalidateFolder(projectId: string): void {
    cacheState.invalidateFolders(projectId);
  }

  invalidateList(folderId: string): void {
    cacheState.invalidateLists(folderId);
  }

  invalidateTasks(listId: string): void {
    cacheState.invalidateTasks(listId);
  }

  // CRUD operations
  addProject(project: Project): void {
    cacheState.setProjects([...Object.values(this.state.state.projects), project]);
  }

  addFolder(folder: Folder): void {
    const allFolders = Object.values(this.state.state.folders);
    cacheState.setFolders(folder.projectId, [...allFolders.filter(f => f.projectId === folder.projectId), folder]);
  }

  addList(list: List): void {
    const allLists = Object.values(this.state.state.lists);
    cacheState.setLists(list.folderId, [...allLists.filter(l => l.folderId === list.folderId), list]);
  }

  addTask(task: Task): void {
    const allTasks = Object.values(this.state.state.tasks);
    cacheState.setTasks(task.listId, [...allTasks.filter(t => t.listId === task.listId), task]);
  }

  updateProject(project: Project): void {
    const updatedProjects = Object.values(this.state.state.projects).map(p => 
      p.id === project.id ? project : p
    );
    cacheState.setProjects(updatedProjects);
  }

  updateFolder(folder: Folder): void {
    const allFolders = Object.values(this.state.state.folders);
    const updatedFolders = allFolders.map(f => f.id === folder.id ? folder : f);
    const projectFolders = updatedFolders.filter(f => f.projectId === folder.projectId);
    cacheState.setFolders(folder.projectId, projectFolders);
  }

  updateList(list: List): void {
    const allLists = Object.values(this.state.state.lists);
    const updatedLists = allLists.map(l => l.id === list.id ? list : l);
    const folderLists = updatedLists.filter(l => l.folderId === list.folderId);
    cacheState.setLists(list.folderId, folderLists);
  }

  updateTask(task: Task): void {
    const allTasks = Object.values(this.state.state.tasks);
    const updatedTasks = allTasks.map(t => t.id === task.id ? task : t);
    const listTasks = updatedTasks.filter(t => t.listId === task.listId);
    cacheState.setTasks(task.listId, listTasks);
  }

  deleteProject(projectId: string): void {
    const remainingProjects = Object.values(this.state.state.projects).filter(p => p.id !== projectId);
    cacheState.setProjects(remainingProjects);
  }

  deleteFolder(folderId: string): void {
    const folder = this.state.state.folders[folderId];
    if (folder) {
      const allFolders = Object.values(this.state.state.folders);
      const remainingFolders = allFolders.filter(f => f.id !== folderId && f.projectId === folder.projectId);
      cacheState.setFolders(folder.projectId, remainingFolders);
    }
  }

  deleteList(listId: string): void {
    const list = this.state.state.lists[listId];
    if (list) {
      const allLists = Object.values(this.state.state.lists);
      const remainingLists = allLists.filter(l => l.id !== listId && l.folderId === list.folderId);
      cacheState.setLists(list.folderId, remainingLists);
    }
  }

  deleteTask(taskId: string): void {
    const task = this.state.state.tasks[taskId];
    if (task) {
      const allTasks = Object.values(this.state.state.tasks);
      const remainingTasks = allTasks.filter(t => t.id !== taskId && t.listId === task.listId);
      cacheState.setTasks(task.listId, remainingTasks);
    }
  }

  subscribe(listener: (state: CacheContextType) => void): () => void {
    this.subscribers.push(listener);
    // Initial call with current state
    listener(this.state);
    
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== listener);
    };
  }
}
