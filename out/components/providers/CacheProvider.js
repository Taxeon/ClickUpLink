"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheProvider = void 0;
const vscode = __importStar(require("vscode"));
const CacheState_1 = require("../../state/CacheState");
const ProjectService_1 = require("../../services/ProjectService");
const FolderService_1 = require("../../services/FolderService");
const ListService_1 = require("../../services/ListService");
const TaskService_1 = require("../../services/TaskService");
class CacheProvider {
    constructor(context) {
        this.subscribers = [];
        this.context = context;
        this.projectService = ProjectService_1.ProjectService.getInstance(context);
        this.folderService = FolderService_1.FolderService.getInstance(context);
        this.listService = ListService_1.ListService.getInstance(context);
        this.taskService = TaskService_1.TaskService.getInstance(context);
        this.state = {
            state: CacheState_1.cacheState.getState(),
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
        CacheState_1.cacheState.subscribe(this.handleStateChange.bind(this));
    }
    static getInstance(context) {
        if (!CacheProvider.instance) {
            CacheProvider.instance = new CacheProvider(context);
        }
        return CacheProvider.instance;
    }
    handleStateChange(newCacheState) {
        this.state = { ...this.state, state: newCacheState };
        this.notifySubscribers();
    }
    updateState(updates) {
        this.state = { ...this.state, ...updates };
        this.notifySubscribers();
    }
    notifySubscribers() {
        for (const subscriber of this.subscribers) {
            subscriber(this.state);
        }
    }
    async getProjects() {
        try {
            this.updateState({ isLoading: true, error: null });
            // Check if cache is valid
            if (CacheState_1.cacheState.isCacheValid('projects')) {
                const projects = Object.values(this.state.state.projects);
                this.updateState({ isLoading: false });
                return projects;
            }
            // Fetch fresh data if cache invalid
            const projects = await this.projectService.getProjects();
            CacheState_1.cacheState.setProjects(projects);
            this.updateState({ isLoading: false });
            return projects;
        }
        catch (error) {
            this.updateState({ isLoading: false, error });
            vscode.window.showErrorMessage(`Failed to fetch projects: ${error.message}`);
            return [];
        }
    }
    async getFolders(projectId) {
        try {
            this.updateState({ isLoading: true, error: null });
            // Check if cache is valid
            if (CacheState_1.cacheState.isCacheValid('folders', projectId)) {
                const allFolders = this.state.state.folders;
                const foldersList = Object.values(allFolders).filter(folder => folder.projectId === projectId);
                this.updateState({ isLoading: false });
                return foldersList;
            }
            // Fetch fresh data if cache invalid
            const folders = await this.folderService.getFolders(projectId);
            CacheState_1.cacheState.setFolders(projectId, folders);
            this.updateState({ isLoading: false });
            return folders;
        }
        catch (error) {
            this.updateState({ isLoading: false, error });
            vscode.window.showErrorMessage(`Failed to fetch folders: ${error.message}`);
            return [];
        }
    }
    async getLists(folderId, projectId) {
        try {
            this.updateState({ isLoading: true, error: null });
            // Check if cache is valid
            if (CacheState_1.cacheState.isCacheValid('lists', folderId)) {
                const allLists = this.state.state.lists;
                const listsList = Object.values(allLists).filter(list => list.folderId === folderId);
                this.updateState({ isLoading: false });
                return listsList;
            }
            // Fetch fresh data if cache invalid
            const lists = await this.listService.getLists(folderId);
            CacheState_1.cacheState.setLists(folderId, lists);
            this.updateState({ isLoading: false });
            return lists;
        }
        catch (error) {
            this.updateState({ isLoading: false, error });
            vscode.window.showErrorMessage(`Failed to fetch lists: ${error.message}`);
            return [];
        }
    }
    async getTasks(listId) {
        try {
            this.updateState({ isLoading: true, error: null });
            // Check if cache is valid
            if (CacheState_1.cacheState.isCacheValid('tasks', listId)) {
                const allTasks = this.state.state.tasks;
                const tasksList = Object.values(allTasks).filter(task => task.listId === listId);
                this.updateState({ isLoading: false });
                return tasksList;
            }
            // Fetch fresh data if cache invalid
            const tasks = await this.taskService.getTasks(listId);
            CacheState_1.cacheState.setTasks(listId, tasks);
            this.updateState({ isLoading: false });
            return tasks;
        }
        catch (error) {
            this.updateState({ isLoading: false, error });
            vscode.window.showErrorMessage(`Failed to fetch tasks: ${error.message}`);
            return [];
        }
    }
    invalidateProjects() {
        CacheState_1.cacheState.invalidateProjects();
    }
    invalidateFolder(projectId) {
        CacheState_1.cacheState.invalidateFolders(projectId);
    }
    invalidateList(folderId) {
        CacheState_1.cacheState.invalidateLists(folderId);
    }
    invalidateTasks(listId) {
        CacheState_1.cacheState.invalidateTasks(listId);
    }
    // CRUD operations
    addProject(project) {
        CacheState_1.cacheState.setProjects([...Object.values(this.state.state.projects), project]);
    }
    addFolder(folder) {
        const allFolders = Object.values(this.state.state.folders);
        CacheState_1.cacheState.setFolders(folder.projectId, [...allFolders.filter(f => f.projectId === folder.projectId), folder]);
    }
    addList(list) {
        const allLists = Object.values(this.state.state.lists);
        CacheState_1.cacheState.setLists(list.folderId, [...allLists.filter(l => l.folderId === list.folderId), list]);
    }
    addTask(task) {
        const allTasks = Object.values(this.state.state.tasks);
        CacheState_1.cacheState.setTasks(task.listId, [...allTasks.filter(t => t.listId === task.listId), task]);
    }
    updateProject(project) {
        const updatedProjects = Object.values(this.state.state.projects).map(p => p.id === project.id ? project : p);
        CacheState_1.cacheState.setProjects(updatedProjects);
    }
    updateFolder(folder) {
        const allFolders = Object.values(this.state.state.folders);
        const updatedFolders = allFolders.map(f => f.id === folder.id ? folder : f);
        const projectFolders = updatedFolders.filter(f => f.projectId === folder.projectId);
        CacheState_1.cacheState.setFolders(folder.projectId, projectFolders);
    }
    updateList(list) {
        const allLists = Object.values(this.state.state.lists);
        const updatedLists = allLists.map(l => l.id === list.id ? list : l);
        const folderLists = updatedLists.filter(l => l.folderId === list.folderId);
        CacheState_1.cacheState.setLists(list.folderId, folderLists);
    }
    updateTask(task) {
        const allTasks = Object.values(this.state.state.tasks);
        const updatedTasks = allTasks.map(t => t.id === task.id ? task : t);
        const listTasks = updatedTasks.filter(t => t.listId === task.listId);
        CacheState_1.cacheState.setTasks(task.listId, listTasks);
    }
    deleteProject(projectId) {
        const remainingProjects = Object.values(this.state.state.projects).filter(p => p.id !== projectId);
        CacheState_1.cacheState.setProjects(remainingProjects);
    }
    deleteFolder(folderId) {
        const folder = this.state.state.folders[folderId];
        if (folder) {
            const allFolders = Object.values(this.state.state.folders);
            const remainingFolders = allFolders.filter(f => f.id !== folderId && f.projectId === folder.projectId);
            CacheState_1.cacheState.setFolders(folder.projectId, remainingFolders);
        }
    }
    deleteList(listId) {
        const list = this.state.state.lists[listId];
        if (list) {
            const allLists = Object.values(this.state.state.lists);
            const remainingLists = allLists.filter(l => l.id !== listId && l.folderId === list.folderId);
            CacheState_1.cacheState.setLists(list.folderId, remainingLists);
        }
    }
    deleteTask(taskId) {
        const task = this.state.state.tasks[taskId];
        if (task) {
            const allTasks = Object.values(this.state.state.tasks);
            const remainingTasks = allTasks.filter(t => t.id !== taskId && t.listId === task.listId);
            CacheState_1.cacheState.setTasks(task.listId, remainingTasks);
        }
    }
    subscribe(listener) {
        this.subscribers.push(listener);
        // Initial call with current state
        listener(this.state);
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== listener);
        };
    }
}
exports.CacheProvider = CacheProvider;
//# sourceMappingURL=CacheProvider.js.map