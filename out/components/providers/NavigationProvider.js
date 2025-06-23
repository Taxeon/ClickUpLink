"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavigationProvider = void 0;
const NavigationState_1 = require("../../state/NavigationState");
/**
 * Provider for navigation functionality
 */
class NavigationProvider {
    constructor(context) {
        this.context = context;
    }
    /**
     * Get singleton instance
     */
    static getInstance(context) {
        if (!NavigationProvider.instance) {
            NavigationProvider.instance = new NavigationProvider(context);
        }
        return NavigationProvider.instance;
    }
    /**
     * Get current navigation context
     */
    getCurrentContext() {
        return this.createNavigationContext();
    }
    /**
     * Subscribe to navigation state changes
     */
    subscribe(listener) {
        // Create context object with state and methods
        const navigationContext = this.createNavigationContext();
        // Subscribe to state changes
        const unsubscribe = NavigationState_1.navigationState.subscribe((state) => {
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
    createNavigationContext() {
        return {
            state: NavigationState_1.navigationState.getState(),
            goToProject: (project) => {
                NavigationState_1.navigationState.setState({
                    currentProject: project,
                    currentFolder: null,
                    currentList: null,
                    currentTask: null
                });
                NavigationState_1.navigationState.addToHistory('project', project.id);
                NavigationState_1.navigationState.setBreadcrumbs([project]);
            },
            goToFolder: (folder) => {
                const currentState = NavigationState_1.navigationState.getState();
                NavigationState_1.navigationState.setState({
                    currentFolder: folder,
                    currentList: null,
                    currentTask: null
                });
                NavigationState_1.navigationState.addToHistory('folder', folder.id);
                // Update breadcrumbs
                if (currentState.currentProject) {
                    NavigationState_1.navigationState.setBreadcrumbs([currentState.currentProject, folder]);
                }
                else {
                    NavigationState_1.navigationState.setBreadcrumbs([folder]);
                }
            },
            goToList: (list) => {
                const currentState = NavigationState_1.navigationState.getState();
                NavigationState_1.navigationState.setState({
                    currentList: list,
                    currentTask: null
                });
                NavigationState_1.navigationState.addToHistory('list', list.id);
                // Update breadcrumbs
                const breadcrumbs = [];
                if (currentState.currentProject) {
                    breadcrumbs.push(currentState.currentProject);
                }
                if (currentState.currentFolder) {
                    breadcrumbs.push(currentState.currentFolder);
                }
                breadcrumbs.push(list);
                NavigationState_1.navigationState.setBreadcrumbs(breadcrumbs);
            },
            goToTask: (task) => {
                const currentState = NavigationState_1.navigationState.getState();
                NavigationState_1.navigationState.setState({
                    currentTask: task
                });
                NavigationState_1.navigationState.addToHistory('task', task.id);
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
                NavigationState_1.navigationState.setBreadcrumbs(breadcrumbs);
            },
            goBack: async () => {
                const currentState = NavigationState_1.navigationState.getState();
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
                NavigationState_1.navigationState.setState({
                    currentProject: null,
                    currentFolder: null,
                    currentList: null,
                    currentTask: null,
                    history: history
                });
                return true;
            },
            reset: () => {
                NavigationState_1.navigationState.reset();
            }
        };
    }
}
exports.NavigationProvider = NavigationProvider;
//# sourceMappingURL=NavigationProvider.js.map