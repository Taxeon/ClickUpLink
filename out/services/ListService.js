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
exports.ListService = void 0;
const vscode = __importStar(require("vscode"));
const useApi_1 = require("../hooks/useApi");
/**
 * Service for interacting with ClickUp lists
 */
class ListService {
    constructor(context) {
        this.context = context;
    }
    static getInstance(context) {
        if (!ListService.instance) {
            ListService.instance = new ListService(context);
        }
        return ListService.instance;
    }
    /**
     * Get all lists within a folder
     */
    async getLists(folderId) {
        try {
            const response = await (0, useApi_1.apiRequest)(this.context, 'get', `folder/${folderId}/list`);
            if (!response || !response.lists) {
                return [];
            }
            // Map ClickUp lists to our List interface
            return response.lists.map((list) => ({
                id: list.id,
                name: list.name,
                description: list.description || '',
                folderId: folderId,
                projectId: list.project?.id || '',
                status: list.status ? {
                    status: list.status.type || list.status.status || 'Unknown',
                    color: list.status.color,
                    type: list.status.type
                } : undefined
            }));
        }
        catch (error) {
            console.error(`Error fetching lists for folder ${folderId}:`, error);
            vscode.window.showErrorMessage(`Failed to fetch lists: ${error.message}`);
            return [];
        }
    }
    /**
     * Get a specific list by ID
     */
    async getList(listId) {
        try {
            const response = await (0, useApi_1.apiRequest)(this.context, 'get', `list/${listId}`);
            if (!response) {
                return undefined;
            }
            // Map ClickUp list to our List interface
            return {
                id: response.id,
                name: response.name,
                description: response.description || '',
                folderId: response.folder?.id || '',
                projectId: response.project?.id || '',
                status: response.status ? {
                    status: response.status.type || response.status.status || 'Unknown',
                    color: response.status.color,
                    type: response.status.type
                } : undefined
            };
        }
        catch (error) {
            console.error(`Error fetching list ${listId}:`, error);
            vscode.window.showErrorMessage(`Failed to fetch list: ${error.message}`);
            return undefined;
        }
    }
    /**
     * Create a new list in a folder
     */
    async createList(folderId, listData) {
        try {
            const response = await (0, useApi_1.apiRequest)(this.context, 'post', `folder/${folderId}/list`, {
                name: listData.name,
                description: listData.description || '',
                status: listData.status
            });
            if (!response) {
                return undefined;
            }
            // Map the response to our List interface
            return {
                id: response.id,
                name: response.name,
                description: response.description || '',
                folderId: folderId,
                projectId: response.project?.id || '',
                status: response.status ? {
                    status: response.status.type || response.status.status || 'Unknown',
                    color: response.status.color,
                    type: response.status.type
                } : undefined
            };
        }
        catch (error) {
            console.error(`Error creating list in folder ${folderId}:`, error);
            vscode.window.showErrorMessage(`Failed to create list: ${error.message}`);
            return undefined;
        }
    }
    /**
     * Update an existing list
     */
    async updateList(listId, updates) {
        try {
            const updateData = {};
            if (updates.name !== undefined) {
                updateData.name = updates.name;
            }
            if (updates.description !== undefined) {
                updateData.description = updates.description;
            }
            if (updates.status !== undefined) {
                updateData.status = updates.status;
            }
            const response = await (0, useApi_1.apiRequest)(this.context, 'put', `list/${listId}`, updateData);
            if (!response) {
                return undefined;
            }
            // Map the response to our List interface
            return {
                id: response.id,
                name: response.name,
                description: response.description || '',
                folderId: response.folder?.id || '',
                projectId: response.project?.id || '',
                status: response.status ? {
                    status: response.status.type || response.status.status || 'Unknown',
                    color: response.status.color,
                    type: response.status.type
                } : undefined
            };
        }
        catch (error) {
            console.error(`Error updating list ${listId}:`, error);
            vscode.window.showErrorMessage(`Failed to update list: ${error.message}`);
            return undefined;
        }
    }
    /**
     * Delete a list
     */
    async deleteList(listId) {
        try {
            await (0, useApi_1.apiRequest)(this.context, 'delete', `list/${listId}`);
            return true;
        }
        catch (error) {
            console.error(`Error deleting list ${listId}:`, error);
            vscode.window.showErrorMessage(`Failed to delete list: ${error.message}`);
            return false;
        }
    }
}
exports.ListService = ListService;
//# sourceMappingURL=ListService.js.map