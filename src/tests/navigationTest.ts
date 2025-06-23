import * as vscode from 'vscode';
import { checkAuth } from '../hooks/useAuth';
import { ProjectNavigator } from '../components/navigation/ProjectNavigator';
import { FolderNavigator } from '../components/navigation/FolderNavigator';
import { ListNavigator } from '../components/navigation/ListNavigator';
import { TaskNavigator } from '../components/navigation/TaskNavigator';
import { useNavigation } from '../hooks/useNavigation';

/**
 * Test file for Phase 2 navigation functionality
 * 
 * This file provides a way to test the navigation components and flow
 * completed in Phase 2 of the ClickUpLink extension.
 */

/**
 * Test the navigation flow from projects to tasks
 */
export async function testNavigation(context: vscode.ExtensionContext): Promise<void> {
  // Step 1: Check authentication first
  console.log('Testing navigation flow...');
  const isAuthenticated = await checkAuth(context);
  
  if (!isAuthenticated) {
    vscode.window.showErrorMessage('You need to authenticate first. Use the ClickUp: Start Authentication command.');
    return;
  }
  
  try {
    // Store context globally for hooks
    (global as any).extensionContext = context;
    
    // Step 2: Navigate to a project
    console.log('Step 1: Navigating to projects...');
    const projectNavigator = ProjectNavigator.getInstance(context);
    const selectedProject = await projectNavigator.navigateToProject();
    
    if (!selectedProject) {
      vscode.window.showInformationMessage('Project navigation cancelled or failed.');
      return;
    }
    
    vscode.window.showInformationMessage(`Selected project: ${selectedProject.name}`);
    
    // Step 3: Navigate to a folder
    console.log('Step 2: Navigating to folders...');
    const folderNavigator = FolderNavigator.getInstance(context, selectedProject.id);
    const selectedFolder = await folderNavigator.navigateToFolder();
    
    if (!selectedFolder) {
      vscode.window.showInformationMessage('Folder navigation cancelled or failed.');
      return;
    }
    
    vscode.window.showInformationMessage(`Selected folder: ${selectedFolder.name}`);
    
    // Step 4: Navigate to a list
    console.log('Step 3: Navigating to lists...');
    const listNavigator = ListNavigator.getInstance(context, selectedFolder.id);
    const selectedList = await listNavigator.navigateToList();
    
    if (!selectedList) {
      vscode.window.showInformationMessage('List navigation cancelled or failed.');
      return;
    }
    
    vscode.window.showInformationMessage(`Selected list: ${selectedList.name}`);
    
    // Step 5: Navigate to a task
    console.log('Step 4: Navigating to tasks...');
    const taskNavigator = TaskNavigator.getInstance(context, selectedList.id);
    const selectedTask = await taskNavigator.navigateToTask();
    
    if (!selectedTask) {
      vscode.window.showInformationMessage('Task navigation cancelled or failed.');
      return;
    }
    
    vscode.window.showInformationMessage(`Selected task: ${selectedTask.name}`);
    
    // Step 6: Test navigation state
    console.log('Step 5: Checking navigation state...');
    const nav = useNavigation(context);
    
    vscode.window.showInformationMessage(
      `Navigation successful! Current state: Project: ${nav.state.currentProject?.name}, ` +
      `Folder: ${nav.state.currentFolder?.name}, List: ${nav.state.currentList?.name}, ` +
      `Task: ${nav.state.currentTask?.name}`
    );
    
    // Step 7: Test going back
    console.log('Step 6: Testing navigation back...');
    await nav.goBack();
    
    vscode.window.showInformationMessage(
      `Navigated back! Current state: Project: ${nav.state.currentProject?.name}, ` +
      `Folder: ${nav.state.currentFolder?.name}, List: ${nav.state.currentList?.name}, ` +
      `Task: ${nav.state.currentTask?.name}`
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`Navigation test failed: ${error.message}`);
    console.error('Navigation test error:', error);
  }
}

/**
 * Test the cache functionality
 * This tests if the cache is properly storing and retrieving data
 */
export async function testCache(context: vscode.ExtensionContext): Promise<void> {
  // Step 1: Check authentication first
  console.log('Testing cache functionality...');
  const isAuthenticated = await checkAuth(context);
  
  if (!isAuthenticated) {
    vscode.window.showErrorMessage('You need to authenticate first. Use the ClickUp: Start Authentication command.');
    return;
  }
  
  try {
    // Store context globally for hooks
    (global as any).extensionContext = context;
    
    // Navigate to a project
    const projectNavigator = ProjectNavigator.getInstance(context);
    const project = await projectNavigator.navigateToProject();
    
    if (!project) {
      return;
    }
    
    // First navigation to folders - should fetch from API
    console.log('First navigation to folders - fetching from API...');
    const startTime1 = Date.now();
    const folderNavigator = FolderNavigator.getInstance(context, project.id);
    await folderNavigator.navigate();
    const duration1 = Date.now() - startTime1;
    
    // Second navigation to folders - should use cache
    console.log('Second navigation to folders - should use cache...');
    const startTime2 = Date.now();
    await folderNavigator.navigate();
    const duration2 = Date.now() - startTime2;
    
    vscode.window.showInformationMessage(
      `Cache test results: First load: ${duration1}ms, Second (cached) load: ${duration2}ms`
    );
    
    if (duration2 < duration1) {
      vscode.window.showInformationMessage('Cache is working correctly! Second load was faster.');
    } else {
      vscode.window.showInformationMessage('Cache might not be working as expected.');
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(`Cache test failed: ${error.message}`);
    console.error('Cache test error:', error);
  }
}
