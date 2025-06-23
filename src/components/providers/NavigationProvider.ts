import * as vscode from 'vscode';
import { navigationState } from '../../state/NavigationState';
import { NavigationContextType, Project, Folder, List, Task } from '../../types/navigation';

/**
 * Provider for navigation functionality
 */
export class NavigationProvider {
  private static instance: NavigationProvider;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(context: vscode.ExtensionContext): NavigationProvider {
    if (!NavigationProvider.instance) {
      NavigationProvider.instance = new NavigationProvider(context);
    }
    return NavigationProvider.instance;
  }

  /**
   * Get current navigation context
   */
  public getCurrentContext(): NavigationContextType {
    return this.createNavigationContext();
  }

  /**
   * Subscribe to navigation state changes
   */
  public subscribe(listener: (state: NavigationContextType) => void): () => void {
    // Create context object with state and methods
    const navigationContext = this.createNavigationContext();
    
    // Subscribe to state changes
    const unsubscribe = navigationState.subscribe((state) => {
      // Update the context with the new state
      navigationContext.state = state;
      // Call the listener with the updated context
      listener(navigationContext);
    });
    
    return unsubscribe;
  }

  /**
   * Create navigation context with state and methods
   */
  private createNavigationContext(): NavigationContextType {
    return {
      state: navigationState.getState(),
      goToProject: (project: Project) => {
        navigationState.setState({
          currentProject: project,
          currentFolder: null,
          currentList: null,
          currentTask: null
        });
        navigationState.addToHistory('project', project.id);
        navigationState.setBreadcrumbs([project]);
      },
      goToFolder: (folder: Folder) => {
        const currentState = navigationState.getState();
        navigationState.setState({
          currentFolder: folder,
          currentList: null,
          currentTask: null
        });
        navigationState.addToHistory('folder', folder.id);
        
        // Update breadcrumbs
        if (currentState.currentProject) {
          navigationState.setBreadcrumbs([currentState.currentProject, folder]);
        } else {
          navigationState.setBreadcrumbs([folder]);
        }
      },
      goToList: (list: List) => {
        const currentState = navigationState.getState();
        navigationState.setState({
          currentList: list,
          currentTask: null
        });
        navigationState.addToHistory('list', list.id);
        
        // Update breadcrumbs
        const breadcrumbs = [];
        if (currentState.currentProject) {
          breadcrumbs.push(currentState.currentProject);
        }
        if (currentState.currentFolder) {
          breadcrumbs.push(currentState.currentFolder);
        }
        breadcrumbs.push(list);
        navigationState.setBreadcrumbs(breadcrumbs);
      },
      goToTask: (task: Task) => {
        const currentState = navigationState.getState();
        navigationState.setState({
          currentTask: task
        });
        navigationState.addToHistory('task', task.id);
        
        // Update breadcrumbs
        const breadcrumbs = [];
        if (currentState.currentProject) {
          breadcrumbs.push(currentState.currentProject);
        }
        if (currentState.currentFolder) {
          breadcrumbs.push(currentState.currentFolder);
        }
        if (currentState.currentList) {
          breadcrumbs.push(currentState.currentList);
        }
        breadcrumbs.push(task);
        navigationState.setBreadcrumbs(breadcrumbs);
      },
      goBack: async (): Promise<boolean> => {
        const currentState = navigationState.getState();
        const history = currentState.history;
        
        if (history.length <= 1) {
          return false; // Can't go back
        }
        
        // Remove current item
        history.pop();
        
        // Go to previous item
        const previousItem = history[history.length - 1];
        
        // TODO: Need to fetch items from cache or API
        // For now just reset to null
        navigationState.setState({
          currentProject: null,
          currentFolder: null,
          currentList: null,
          currentTask: null,
          history: history
        });
        
        return true;
      },
      reset: () => {
        navigationState.reset();
      }
    };
  }
}
