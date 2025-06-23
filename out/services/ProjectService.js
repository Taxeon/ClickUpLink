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
exports.ProjectService = void 0;
const vscode = __importStar(require("vscode"));
const useApi_1 = require("../hooks/useApi");
/**
 * Service for interacting with ClickUp teams (projects)
 */
class ProjectService {
    constructor(context) {
        this.context = context;
    }
    static getInstance(context) {
        if (!ProjectService.instance) {
            ProjectService.instance = new ProjectService(context);
        }
        return ProjectService.instance;
    }
    /**
     * Get all projects (teams in ClickUp terminology)
     */
    async getProjects() {
        try {
            const response = await (0, useApi_1.apiRequest)(this.context, 'get', 'team');
            if (!response || !response.teams) {
                return [];
            }
            // Map ClickUp teams to our Project interface
            return response.teams.map((team) => ({
                id: team.id,
                name: team.name,
                description: `Members: ${team.members?.length || 0}`,
                members: team.members,
                color: team.color
            }));
        }
        catch (error) {
            console.error('Error fetching projects:', error);
            vscode.window.showErrorMessage(`Failed to fetch projects: ${error.message}`);
            return [];
        }
    }
    /**
     * Get a specific project by ID
     */
    async getProject(projectId) {
        try {
            // ClickUp doesn't have a direct endpoint to get a single team by ID,
            // so we get all teams and filter
            const allProjects = await this.getProjects();
            return allProjects.find(project => project.id === projectId);
        }
        catch (error) {
            console.error(`Error fetching project ${projectId}:`, error);
            vscode.window.showErrorMessage(`Failed to fetch project: ${error.message}`);
            return undefined;
        }
    }
    /**
     * Search for projects by name
     */
    async searchProjects(searchTerm) {
        try {
            const projects = await this.getProjects();
            if (!searchTerm) {
                return projects;
            }
            const lowerSearchTerm = searchTerm.toLowerCase();
            return projects.filter(project => project.name.toLowerCase().includes(lowerSearchTerm) ||
                (project.description && project.description.toLowerCase().includes(lowerSearchTerm)));
        }
        catch (error) {
            console.error('Error searching projects:', error);
            vscode.window.showErrorMessage(`Failed to search projects: ${error.message}`);
            return [];
        }
    }
}
exports.ProjectService = ProjectService;
//# sourceMappingURL=ProjectService.js.map