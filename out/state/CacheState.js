"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheState = void 0;
const events_1 = require("events");
const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
const initialState = {
    projects: {},
    folders: {},
    lists: {},
    tasks: {},
    lastUpdated: {}
};
class CacheStateManager extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.state = initialState;
    }
    getState() {
        return this.state;
    }
    setProjects(projects) {
        const projectsMap = projects.reduce((acc, project) => {
            acc[project.id] = project;
            return acc;
        }, {});
        this.state.projects = projectsMap;
        this.state.lastUpdated = {
            ...this.state.lastUpdated,
            projects: Date.now()
        };
        this.emit('change', this.state);
    }
    setFolders(projectId, folders) {
        const foldersMap = folders.reduce((acc, folder) => {
            acc[folder.id] = folder;
            return acc;
        }, {});
        this.state.folders = { ...this.state.folders, ...foldersMap };
        this.state.lastUpdated.folders = {
            ...this.state.lastUpdated.folders,
            [projectId]: Date.now()
        };
        this.emit('change', this.state);
    }
    setLists(folderId, lists) {
        const listsMap = lists.reduce((acc, list) => {
            acc[list.id] = list;
            return acc;
        }, {});
        this.state.lists = { ...this.state.lists, ...listsMap };
        this.state.lastUpdated.lists = {
            ...this.state.lastUpdated.lists,
            [folderId]: Date.now()
        };
        this.emit('change', this.state);
    }
    setTasks(listId, tasks) {
        const tasksMap = tasks.reduce((acc, task) => {
            acc[task.id] = task;
            return acc;
        }, {});
        this.state.tasks = { ...this.state.tasks, ...tasksMap };
        this.state.lastUpdated.tasks = {
            ...this.state.lastUpdated.tasks,
            [listId]: Date.now()
        };
        this.emit('change', this.state);
    }
    isCacheValid(type, parentId) {
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
    invalidateProjects() {
        this.state.lastUpdated.projects = undefined;
        this.emit('change', this.state);
    }
    invalidateFolders(projectId) {
        if (this.state.lastUpdated.folders) {
            delete this.state.lastUpdated.folders[projectId];
            this.emit('change', this.state);
        }
    }
    invalidateLists(folderId) {
        if (this.state.lastUpdated.lists) {
            delete this.state.lastUpdated.lists[folderId];
            this.emit('change', this.state);
        }
    }
    invalidateTasks(listId) {
        if (this.state.lastUpdated.tasks) {
            delete this.state.lastUpdated.tasks[listId];
            this.emit('change', this.state);
        }
    }
    reset() {
        this.state = initialState;
        this.emit('change', this.state);
    }
    subscribe(listener) {
        this.on('change', listener);
        return () => this.removeListener('change', listener);
    }
}
exports.cacheState = new CacheStateManager();
//# sourceMappingURL=CacheState.js.map