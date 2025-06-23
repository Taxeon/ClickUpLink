"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCRUD = void 0;
const ProjectService_1 = require("../services/ProjectService");
const FolderService_1 = require("../services/FolderService");
const ListService_1 = require("../services/ListService");
const TaskService_1 = require("../services/TaskService");
const useCache_1 = require("./useCache");
/**
 * React-inspired hook for CRUD operations on projects, folders, lists, and tasks
 */
function useCRUD(context) {
    if (!context) {
        // Get from extension context in extension.ts
        context = global.extensionContext;
        if (!context) {
            throw new Error('Extension context is required for useCRUD hook');
        }
    }
    const projectService = ProjectService_1.ProjectService.getInstance(context);
    const folderService = FolderService_1.FolderService.getInstance(context);
    const listService = ListService_1.ListService.getInstance(context);
    const taskService = TaskService_1.TaskService.getInstance(context);
    const cache = (0, useCache_1.useCache)(context);
    // Create operations
    const createTask = async (listId, taskData) => {
        const task = await taskService.createTask(listId, taskData);
        if (task) {
            cache.invalidateTasks(listId);
        }
        return task;
    };
    const createList = async (folderId, listData) => {
        const list = await listService.createList(folderId, listData);
        if (list) {
            cache.invalidateList(folderId);
        }
        return list;
    };
    const createFolder = async (projectId, folderData) => {
        const folder = await folderService.createFolder(projectId, folderData);
        if (folder) {
            cache.invalidateFolder(projectId);
        }
        return folder;
    };
    // Update operations
    const updateTask = async (taskId, updates) => {
        const task = await taskService.updateTask(taskId, updates);
        if (task) {
            cache.invalidateTasks(task.listId);
        }
        return task;
    };
    const updateList = async (listId, updates) => {
        const list = await listService.updateList(listId, updates);
        if (list) {
            cache.invalidateList(list.folderId);
        }
        return list;
    };
    const updateFolder = async (folderId, updates) => {
        const folder = await folderService.updateFolder(folderId, updates);
        if (folder) {
            cache.invalidateFolder(folder.projectId);
        }
        return folder;
    };
    // Delete operations
    const deleteTask = async (taskId, listId) => {
        const success = await taskService.deleteTask(taskId);
        if (success) {
            cache.invalidateTasks(listId);
        }
        return success;
    };
    const deleteList = async (listId, folderId) => {
        const success = await listService.deleteList(listId);
        if (success) {
            cache.invalidateList(folderId);
        }
        return success;
    };
    const deleteFolder = async (folderId, projectId) => {
        const success = await folderService.deleteFolder(folderId);
        if (success) {
            cache.invalidateFolder(projectId);
        }
        return success;
    };
    return {
        // Create
        createTask,
        createList,
        createFolder,
        // Update
        updateTask,
        updateList,
        updateFolder,
        // Delete
        deleteTask,
        deleteList,
        deleteFolder
    };
}
exports.useCRUD = useCRUD;
//# sourceMappingURL=useCRUD.js.map