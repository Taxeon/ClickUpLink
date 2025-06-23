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
exports.NavigationProvider = void 0;
const vscode = __importStar(require("vscode"));
const NavigationState_1 = require("../../state/NavigationState");
const ProjectService_1 = require("../../services/ProjectService");
const FolderService_1 = require("../../services/FolderService");
const ListService_1 = require("../../services/ListService");
const TaskService_1 = require("../../services/TaskService");
class NavigationProvider {
    constructor(context) {
        this.subscribers = [];
        this.context = context;
        this.projectService = ProjectService_1.ProjectService.getInstance(context);
        this.folderService = FolderService_1.FolderService.getInstance(context);
        this.listService = ListService_1.ListService.getInstance(context);
        this.taskService = TaskService_1.TaskService.getInstance(context);
        this.state = {
            state: NavigationState_1.navigationState.getState(),
            navigateToProject: this.navigateToProject.bind(this),
            navigateToFolder: this.navigateToFolder.bind(this),
            navigateToList: this.navigateToList.bind(this),
            navigateToTask: this.navigateToTask.bind(this),
            goBack: this.goBack.bind(this),
            resetNavigation: this.resetNavigation.bind(this),
            isLoading: false,
            error: null
        };
        NavigationState_1.navigationState.subscribe(this.handleStateChange.bind(this));
    }
    static getInstance(context) {
        if (!NavigationProvider.instance) {
            NavigationProvider.instance = new NavigationProvider(context);
        }
        return NavigationProvider.instance;
    }
    handleStateChange(newNavigationState) {
        this.state = { ...this.state, state: newNavigationState };
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
    async navigateToProject(projectId) {
        try {
            this.updateState({ isLoading: true, error: null });
            const project = await this.projectService.getProject(projectId);
            if (!project) {
                throw new Error(`Project with id ${projectId} not found`);
            }
            NavigationState_1.navigationState.setState({
                currentProject: project,
                currentFolder: undefined,
                currentList: undefined,
                currentTask: undefined
            });
            NavigationState_1.navigationState.setBreadcrumbs([project]);
            NavigationState_1.navigationState.addToHistory('project', projectId);
            this.updateState({ isLoading: false });
        }
        catch (error) {
            this.updateState({ isLoading: false, error });
            vscode.window.showErrorMessage(`Failed to navigate to project: ${error.message}`);
        }
    }
    async navigateToFolder(folderId) {
        try {
            this.updateState({ isLoading: true, error: null });
            const folder = await this.folderService.getFolder(folderId);
            if (!folder) {
                throw new Error(`Folder with id ${folderId} not found`);
            }
            // Ensure we have the parent project
            const project = this.state.state.currentProject ||
                await this.projectService.getProject(folder.projectId);
            if (!project) {
                throw new Error(`Parent project not found for folder ${folderId}`);
            }
            NavigationState_1.navigationState.setState({
                currentProject: project,
                currentFolder: folder,
                currentList: undefined,
                currentTask: undefined
            });
            NavigationState_1.navigationState.setBreadcrumbs([project, folder]);
            NavigationState_1.navigationState.addToHistory('folder', folderId);
            this.updateState({ isLoading: false });
        }
        catch (error) {
            this.updateState({ isLoading: false, error });
            vscode.window.showErrorMessage(`Failed to navigate to folder: ${error.message}`);
        }
    }
    async navigateToList(listId) {
        try {
            this.updateState({ isLoading: true, error: null });
            const list = await this.listService.getList(listId);
            if (!list) {
                throw new Error(`List with id ${listId} not found`);
            }
            // Ensure we have the parent folder and project
            const folder = this.state.state.currentFolder ||
                await this.folderService.getFolder(list.folderId);
            if (!folder) {
                throw new Error(`Parent folder not found for list ${listId}`);
            }
            const project = this.state.state.currentProject ||
                await this.projectService.getProject(list.projectId);
            if (!project) {
                throw new Error(`Parent project not found for list ${listId}`);
            }
            NavigationState_1.navigationState.setState({
                currentProject: project,
                currentFolder: folder,
                currentList: list,
                currentTask: undefined
            });
            NavigationState_1.navigationState.setBreadcrumbs([project, folder, list]);
            NavigationState_1.navigationState.addToHistory('list', listId);
            this.updateState({ isLoading: false });
        }
        catch (error) {
            this.updateState({ isLoading: false, error });
            vscode.window.showErrorMessage(`Failed to navigate to list: ${error.message}`);
        }
    }
    async navigateToTask(taskId) {
        try {
            this.updateState({ isLoading: true, error: null });
            const task = await this.taskService.getTask(taskId);
            if (!task) {
                throw new Error(`Task with id ${taskId} not found`);
            }
            // Ensure we have the parent list, folder, and project
            const list = this.state.state.currentList ||
                await this.listService.getList(task.listId);
            if (!list) {
                throw new Error(`Parent list not found for task ${taskId}`);
            }
            const folder = this.state.state.currentFolder ||
                await this.folderService.getFolder(task.folderId);
            if (!folder) {
                throw new Error(`Parent folder not found for task ${taskId}`);
            }
            const project = this.state.state.currentProject ||
                await this.projectService.getProject(task.projectId);
            if (!project) {
                throw new Error(`Parent project not found for task ${taskId}`);
            }
            NavigationState_1.navigationState.setState({
                currentProject: project,
                currentFolder: folder,
                currentList: list,
                currentTask: task
            });
            NavigationState_1.navigationState.setBreadcrumbs([project, folder, list, task]);
            NavigationState_1.navigationState.addToHistory('task', taskId);
            this.updateState({ isLoading: false });
        }
        catch (error) {
            this.updateState({ isLoading: false, error });
            vscode.window.showErrorMessage(`Failed to navigate to task: ${error.message}`);
        }
    }
    async goBack() {
        try {
            this.updateState({ isLoading: true, error: null });
            const history = [...this.state.state.history];
            if (history.length < 2) {
                // Can't go back if we have no history or just one item
                this.updateState({ isLoading: false });
                return;
            }
            // Remove current item
            history.pop();
            // Get previous item
            const previous = history[history.length - 1];
            // Navigate to previous item based on type
            switch (previous.type) {
                case 'project':
                    await this.navigateToProject(previous.id);
                    break;
                case 'folder':
                    await this.navigateToFolder(previous.id);
                    break;
                case 'list':
                    await this.navigateToList(previous.id);
                    break;
                case 'task':
                    await this.navigateToTask(previous.id);
                    break;
            }
            this.updateState({ isLoading: false });
        }
        catch (error) {
            this.updateState({ isLoading: false, error });
            vscode.window.showErrorMessage(`Failed to navigate back: ${error.message}`);
        }
    }
    resetNavigation() {
        NavigationState_1.navigationState.reset();
        this.updateState({ isLoading: false, error: null });
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
exports.NavigationProvider = NavigationProvider;
//# sourceMappingURL=navigationProvider.js.map