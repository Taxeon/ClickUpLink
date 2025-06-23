import * as vscode from 'vscode';
import { BaseNavigator, BaseNavigatorOptions } from './BaseNavigator';
import { Project } from '../../types/navigation';
import { useCache } from '../../hooks/useCache';
import { useNavigation } from '../../hooks/useNavigation';

export class ProjectNavigator extends BaseNavigator<Project> {
  private static instance: ProjectNavigator;
  
  private constructor(context: vscode.ExtensionContext, options?: Partial<BaseNavigatorOptions<Project>>) {
    const defaultOptions: BaseNavigatorOptions<Project> = {
      title: 'Select a ClickUp Project',
      placeholder: 'Choose a project to navigate to...',
      itemToDetail: (project) => `Members: ${project.members?.length || 0}`,
      itemToDescription: (project) => project.description,
    };
    
    super(context, { ...defaultOptions, ...(options || {}) });
  }
  
  static getInstance(context: vscode.ExtensionContext, options?: Partial<BaseNavigatorOptions<Project>>): ProjectNavigator {
    if (!ProjectNavigator.instance) {
      ProjectNavigator.instance = new ProjectNavigator(context, options);
    }
    return ProjectNavigator.instance;
  }
  
  async loadItems(): Promise<Project[]> {
    const cache = useCache(this.context);
    return await cache.getProjects();
  }
  
  async navigateToProject(): Promise<Project | undefined> {
    const project = await this.navigate();
      if (project) {
      const navigation = useNavigation(this.context);
      await navigation.goToProject(project);
    }
    
    return project;
  }
}