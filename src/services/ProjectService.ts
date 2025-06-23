import * as vscode from 'vscode';
import { apiRequest } from '../hooks/useApi';
import { Project } from '../types/navigation';

/**
 * Service for interacting with ClickUp teams (projects)
 */
export class ProjectService {
  private context: vscode.ExtensionContext;
  private static instance: ProjectService;
  
  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  static getInstance(context: vscode.ExtensionContext): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService(context);
    }    return ProjectService.instance;
  }
  
  /**
   * Get all projects (teams in ClickUp terminology)
   */
  async getProjects(): Promise<Project[]> {
    try {
      const response = await apiRequest(this.context, 'get', 'team');
      
      if (!response || !response.teams) {
        return [];
      }
      
      // Map ClickUp teams to our Project interface
      return response.teams.map((team: any): Project => ({
        id: team.id,
        name: team.name,
        description: `Members: ${team.members?.length || 0}`,
        members: team.members,
        color: team.color
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      vscode.window.showErrorMessage(`Failed to fetch projects: ${(error as Error).message}`);
      return [];
    }
  }
  
  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<Project | undefined> {
    try {
      // ClickUp doesn't have a direct endpoint to get a single team by ID,
      // so we get all teams and filter
      const allProjects = await this.getProjects();
      return allProjects.find(project => project.id === projectId);
    } catch (error) {
      console.error(`Error fetching project ${projectId}:`, error);
      vscode.window.showErrorMessage(`Failed to fetch project: ${(error as Error).message}`);      return undefined;
    }
  }

  /**
   * Search for projects by name
   */
  async searchProjects(searchTerm: string): Promise<Project[]> {
    try {
      const projects = await this.getProjects();
      
      if (!searchTerm) {
        return projects;
      }
      
      const lowerSearchTerm = searchTerm.toLowerCase();
      return projects.filter(project => 
        project.name.toLowerCase().includes(lowerSearchTerm) ||
        (project.description && project.description.toLowerCase().includes(lowerSearchTerm))
      );
    } catch (error) {
      console.error('Error searching projects:', error);
      vscode.window.showErrorMessage(`Failed to search projects: ${(error as Error).message}`);
      return [];
    }
  }
}