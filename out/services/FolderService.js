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
exports.FolderService = void 0;
const vscode = __importStar(require("vscode"));
const useApi_1 = require("../hooks/useApi");
/**
 * Service for interacting with ClickUp folders
 */
class FolderService {
    constructor(context) {
        this.context = context;
    }
    static getInstance(context) {
        if (!FolderService.instance) {
            FolderService.instance = new FolderService(context);
        }
        return FolderService.instance;
    }
    /**
     * Get all folders within a project/team
     */
    async getFolders(projectId) {
        try {
            // In ClickUp, we need to first get spaces in a team, then folders in each space
            const spacesResponse = await (0, useApi_1.apiRequest)(this.context, 'get', `team/${projectId}/space`);
            if (!spacesResponse || !spacesResponse.spaces) {
                return [];
            }
            const allFolders = [];
            // For each space, get all folders
            for (const space of spacesResponse.spaces) {
                const foldersResponse = await (0, useApi_1.apiRequest)(this.context, 'get', `space/${space.id}/folder`);
                if (foldersResponse && foldersResponse.folders) {
                    // Map ClickUp folders to our Folder interface
                    const folders = foldersResponse.folders.map((folder) => ({
                        id: folder.id,
                        name: folder.name,
                        description: folder.description || '',
                        projectId: projectId,
                        hidden: folder.hidden
                    }));
                    allFolders.push(...folders);
                }
            }
            return allFolders;
        }
        catch (error) {
            console.error(`Error fetching folders for project ${projectId}:`, error);
            vscode.window.showErrorMessage(`Failed to fetch folders: ${error.message}`);
            return [];
        }
    }
    /**
     * Get a specific folder by ID
     */
    async getFolder(folderId) {
        try {
            const response = await (0, useApi_1.apiRequest)(this.context, 'get', `folder/${folderId}`);
            if (!response) {
                return undefined;
            }
            // Map ClickUp folder to our Folder interface
            return {
                id: response.id,
                name: response.name,
                description: response.description || '',
                projectId: response.project?.id || '',
                hidden: response.hidden
            };
        }
        catch (error) {
            console.error(`Error fetching folder ${folderId}:`, error);
            vscode.window.showErrorMessage(`Failed to fetch folder: ${error.message}`);
            return undefined;
        }
    }
    /**
     * Create a new folder in a project
     */
    async createFolder(projectId, folderData) {
        try {
            // In ClickUp, folders are created within a space, so we need a space ID
            // Typically, we would ask the user to select a space first, but for simplicity
            // we'll get the first space in the team
            const spacesResponse = await (0, useApi_1.apiRequest)(this.context, 'get', `team/${projectId}/space`);
            if (!spacesResponse || !spacesResponse.spaces || spacesResponse.spaces.length === 0) {
                vscode.window.showErrorMessage(`No spaces found in project ${projectId}.`);
                return undefined;
            }
            const spaceId = spacesResponse.spaces[0].id;
            // Create the folder in the selected space
            const response = await (0, useApi_1.apiRequest)(this.context, 'post', `space/${spaceId}/folder`, {
                name: folderData.name,
                description: folderData.description || ''
            });
            if (!response) {
                return undefined;
            }
            // Map the response to our Folder interface
            return {
                id: response.id,
                name: response.name,
                description: response.description || '',
                projectId: projectId,
                hidden: response.hidden
            };
        }
        catch (error) {
            console.error(`Error creating folder in project ${projectId}:`, error);
            vscode.window.showErrorMessage(`Failed to create folder: ${error.message}`);
            return undefined;
        }
    }
    /**
     * Update an existing folder
     */
    async updateFolder(folderId, updates) {
        try {
            const updateData = {};
            if (updates.name !== undefined) {
                updateData.name = updates.name;
            }
            if (updates.description !== undefined) {
                updateData.description = updates.description;
            }
            if (updates.hidden !== undefined) {
                updateData.hidden = updates.hidden;
            }
            const response = await (0, useApi_1.apiRequest)(this.context, 'put', `folder/${folderId}`, updateData);
            if (!response) {
                return undefined;
            }
            // Map the response to our Folder interface
            return {
                id: response.id,
                name: response.name,
                description: response.description || '',
                projectId: response.project?.id || '',
                hidden: response.hidden
            };
        }
        catch (error) {
            console.error(`Error updating folder ${folderId}:`, error);
            vscode.window.showErrorMessage(`Failed to update folder: ${error.message}`);
            return undefined;
        }
    }
    /**
     * Delete a folder
     */
    async deleteFolder(folderId) {
        try {
            await (0, useApi_1.apiRequest)(this.context, 'delete', `folder/${folderId}`);
            return true;
        }
        catch (error) {
            console.error(`Error deleting folder ${folderId}:`, error);
            vscode.window.showErrorMessage(`Failed to delete folder: ${error.message}`);
            return false;
        }
    }
}
exports.FolderService = FolderService;
//# sourceMappingURL=FolderService.js.map