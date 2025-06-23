"use strict";
// clickUpService.ts
// ClickUp API service implementation with OAuth2 support
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClickUpService = void 0;
const useApi_1 = require("../hooks/useApi");
const useAuth_1 = require("../hooks/useAuth");
class ClickUpService {
    constructor(context) {
        this.context = context;
    }
    static getInstance(context) {
        if (!ClickUpService.instance) {
            ClickUpService.instance = new ClickUpService(context);
        }
        return ClickUpService.instance;
    }
    /**
     * Get authorized user information
     */
    async getAuthorizedUser() {
        return (0, useApi_1.apiRequest)(this.context, 'get', 'user');
    }
    /**
     * Get all workspaces accessible by the user
     */
    async getWorkspaces() {
        const userData = await (0, useApi_1.apiRequest)(this.context, 'get', 'user');
        return userData?.teams || [];
    }
    /**
     * Get spaces within a workspace
     */
    async getSpaces(workspaceId) {
        return (0, useApi_1.apiRequest)(this.context, 'get', `team/${workspaceId}/space`);
    }
    /**
     * Get folders within a space
     */
    async getFolders(spaceId) {
        return (0, useApi_1.apiRequest)(this.context, 'get', `space/${spaceId}/folder`);
    }
    /**
     * Get lists within a folder
     */
    async getLists(folderId) {
        return (0, useApi_1.apiRequest)(this.context, 'get', `folder/${folderId}/list`);
    }
    /**
     * Get tasks within a list
     */
    async getTasks(listId) {
        return (0, useApi_1.apiRequest)(this.context, 'get', `list/${listId}/task`);
    }
    /**
     * Create a new task
     */
    async createTask(listId, taskData) {
        return (0, useApi_1.apiRequest)(this.context, 'post', `list/${listId}/task`, taskData);
    }
    /**
     * Update task status
     */
    async updateTaskStatus(taskId, status) {
        return (0, useApi_1.apiRequest)(this.context, 'put', `task/${taskId}`, { status });
    }
    /**
     * Get task details
     */
    async getTaskDetails(taskId) {
        return (0, useApi_1.apiRequest)(this.context, 'get', `task/${taskId}`);
    }
    /**
     * Check if currently authenticated
     */
    async isAuthenticated() {
        return await (0, useAuth_1.checkAuth)(this.context);
    }
}
exports.ClickUpService = ClickUpService;
//# sourceMappingURL=clickUpService.js.map