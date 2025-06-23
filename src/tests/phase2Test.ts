import * as vscode from 'vscode';
import { checkAuth } from '../hooks/useAuth';
import { useNavigation } from '../hooks/useNavigation';
import { ProjectNavigator } from '../components/navigation/ProjectNavigator';
import { FolderNavigator } from '../components/navigation/FolderNavigator';
import { ListNavigator } from '../components/navigation/ListNavigator';
import { TaskNavigator } from '../components/navigation/TaskNavigator';

/**
 * Test function for Phase 2 navigation functionality
 * This walks through the full navigation flow:
 * 1. Check authentication
 * 2. Navigate to a project
 * 3. Navigate to a folder in that project
 * 4. Navigate to a list in that folder
 * 5. Navigate to a task in that list
 * 6. Navigate back through history
 */
export async function testPhase2Navigation(context: vscode.ExtensionContext): Promise<void> {
  // Step 1: Check if authenticated
  console.log('Checking authentication status...');
  const isAuthenticated = await checkAuth(context);
  
  if (!isAuthenticated) {
    vscode.window.showInformationMessage('Please login to ClickUp first using the "ClickUp: Start Authentication" command');
    return;
  }
  
  vscode.window.showInformationMessage('Starting Phase 2 navigation test...');

  try {
    // Step 2: Navigate to a project
    console.log('Testing project navigation...');
    const projectNavigator = ProjectNavigator.getInstance(context);
    const selectedProject = await projectNavigator.navigateToProject();
    
    if (!selectedProject) {
      vscode.window.showInformationMessage('Project navigation test cancelled or failed');
      return;
    }
    
    vscode.window.showInformationMessage(`Selected project: ${selectedProject.name}`);
    
    // Step 3: Navigate to a folder in that project
    console.log('Testing folder navigation...');
    const folderNavigator = FolderNavigator.getInstance(context, selectedProject.id);
    const selectedFolder = await folderNavigator.navigateToFolder();
    
    if (!selectedFolder) {
      vscode.window.showInformationMessage('Folder navigation test cancelled or failed');
      return;
    }
    
    vscode.window.showInformationMessage(`Selected folder: ${selectedFolder.name}`);
    
    // Step 4: Navigate to a list in that folder
    console.log('Testing list navigation...');
    const listNavigator = ListNavigator.getInstance(context, selectedFolder.id);
    const selectedList = await listNavigator.navigateToList();
    
    if (!selectedList) {
      vscode.window.showInformationMessage('List navigation test cancelled or failed');
      return;
    }
    
    vscode.window.showInformationMessage(`Selected list: ${selectedList.name}`);
    
    // Step 5: Navigate to a task in that list
    console.log('Testing task navigation...');
    const taskNavigator = TaskNavigator.getInstance(context, selectedList.id);
    const selectedTask = await taskNavigator.navigateToTask();
    
    if (!selectedTask) {
      vscode.window.showInformationMessage('Task navigation test cancelled or failed');
      return;
    }
    
    vscode.window.showInformationMessage(`Selected task: ${selectedTask.name}`);
    
    // Step 6: Test navigation state
    const nav = useNavigation(context);
    console.log('Current navigation state:', nav.state);
    
    // Test breadcrumbs
    vscode.window.showInformationMessage(
      `Navigation path: ${nav.state.breadcrumbs.map(item => item.name).join(' > ')}`
    );
    
    // Step 7: Test going back
    vscode.window.showInformationMessage('Testing navigation back...');
    await nav.goBack();
    vscode.window.showInformationMessage(
      `After going back: ${nav.state.breadcrumbs.map(item => item.name).join(' > ')}`
    );
    
    vscode.window.showInformationMessage('Phase 2 navigation test completed successfully!');
  } catch (error: any) {
    console.error('Error during navigation test:', error);
    vscode.window.showErrorMessage(`Navigation test failed: ${error.message}`);
  }
}
