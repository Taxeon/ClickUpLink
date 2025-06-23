import * as vscode from 'vscode';
import { startAuth, logout, useAuth, checkAuth, handleAuthCallback, handleManualCodeEntry } from './hooks/useAuth';
import { subscribeToConfigChanges } from './hooks/useConfig';
import { useNavigation } from './hooks/useNavigation';
import { ProjectNavigator } from './components/navigation/ProjectNavigator';
import { FolderNavigator } from './components/navigation/FolderNavigator';
import { ListNavigator } from './components/navigation/ListNavigator';
import { TaskNavigator } from './components/navigation/TaskNavigator';
import { testPhase2Navigation } from './tests/phase2Test';
import { testPhase2Cache } from './tests/cacheTest';
// Phase 3 imports
import { TaskDecorationProvider } from './components/decorations/TaskDecorationProvider';
import { WebviewManager } from './webviews/WebviewManager';
import { useDecorations } from './hooks/useDecorations';
import { useTriggerDetection } from './hooks/useTriggerDetection';
import { useTaskInsertion } from './hooks/useTaskInsertion';
import { useInlineInteraction } from './hooks/useInlineInteraction';

export function activate(context: vscode.ExtensionContext) {
  // Store context globally for hooks
  (global as any).extensionContext = context;
  
  // Initialize Phase 3 components
  const decorationProvider = TaskDecorationProvider.getInstance(context);
  const webviewManager = WebviewManager.getInstance(context);
  const decorationHook = useDecorations(context);
  const triggerHook = useTriggerDetection(context);
  const insertionHook = useTaskInsertion(context);
  const interactionHook = useInlineInteraction(context);
  
  // Store hooks globally for easy access
  (global as any).decorationHook = decorationHook;
  (global as any).triggerHook = triggerHook;
  (global as any).insertionHook = insertionHook;
  (global as any).interactionHook = interactionHook;

  // Register the URI Handler for OAuth2 redirect
  const uriHandler = vscode.window.registerUriHandler({
    handleUri: async (uri: vscode.Uri) => {
      if (uri.path === '/auth') {
        await handleAuthCallback(context, uri);
      }
    }
  });
  context.subscriptions.push(uriHandler);

  // Check authentication status on activation
  checkAuth(context).then((isAuthenticated) => {
    if (isAuthenticated) {
      const auth = useAuth();
      vscode.window.showInformationMessage(`Welcome back ${auth.user?.name || 'to ClickUp Link'}!`);
    }
  });

  // Subscribe to configuration changes
  const configSubscription = subscribeToConfigChanges();
  context.subscriptions.push(configSubscription);

  // Register Commands  // Start Authentication Command
  const loginCommand = vscode.commands.registerCommand('clickuplink.login', async () => {
    await startAuth(context);
    
    // Show option to enter code manually
    const result = await vscode.window.showInformationMessage(
      'Complete authentication in your browser, then enter the code here.',
      'Enter Code Now',
      'Enter Code Later'
    );
    
    if (result === 'Enter Code Now') {
      vscode.commands.executeCommand('clickuplink.enterCode');
    }
  });
  context.subscriptions.push(loginCommand);
  // Manual Code Entry Command
  const enterCodeCommand = vscode.commands.registerCommand('clickuplink.enterCode', async () => {
    const code = await vscode.window.showInputBox({
      prompt: 'Enter the authorization code from ClickUp',
      placeHolder: 'Paste your authorization code here...',
      ignoreFocusOut: true
    });
    
    if (code) {
      try {
        await handleManualCodeEntry(context, code);
      } catch (error) {
        vscode.window.showErrorMessage(`Authentication failed: ${error}`);
      }
    }
  });
  context.subscriptions.push(enterCodeCommand);

  // Reset Authentication Command
  const logoutCommand = vscode.commands.registerCommand('clickuplink.logout', async () => {
    await logout(context);
    vscode.window.showInformationMessage('Logged out of ClickUp');
  });
  context.subscriptions.push(logoutCommand);
  // Show Authentication Status Command
  const statusCommand = vscode.commands.registerCommand('clickuplink.status', async () => {
    await checkAuth(context);
    const auth = useAuth();
    if (auth.isAuthenticated) {
      vscode.window.showInformationMessage(`Connected to ClickUp as ${auth.user?.name || 'User'}`);
    } else {
      vscode.window.showInformationMessage('Not connected to ClickUp. Use the login command to connect.');
    }
  });
  context.subscriptions.push(statusCommand);
  
  // Navigation Commands
  const navigateProjectsCommand = vscode.commands.registerCommand('clickuplink.navigateProjects', async () => {
    await checkAuth(context);
    const auth = useAuth();
    if (!auth.isAuthenticated) {
      vscode.window.showInformationMessage('You need to log in to ClickUp first');
      return;
    }
    
    const projectNavigator = ProjectNavigator.getInstance(context);
    await projectNavigator.navigateToProject();
  });
  context.subscriptions.push(navigateProjectsCommand);

  const navigateFoldersCommand = vscode.commands.registerCommand('clickuplink.navigateFolders', async () => {
    await checkAuth(context);
    const auth = useAuth();
    if (!auth.isAuthenticated) {
      vscode.window.showInformationMessage('You need to log in to ClickUp first');
      return;
    }

    const nav = useNavigation(context);
    if (!nav.state.currentProject) {
      vscode.window.showInformationMessage('You need to select a project first');
      return;
    }
    
    const folderNavigator = FolderNavigator.getInstance(context, nav.state.currentProject.id);
    await folderNavigator.navigateToFolder();
  });
  context.subscriptions.push(navigateFoldersCommand);
  
  const navigateListsCommand = vscode.commands.registerCommand('clickuplink.navigateLists', async () => {
    await checkAuth(context);
    const auth = useAuth();
    if (!auth.isAuthenticated) {
      vscode.window.showInformationMessage('You need to log in to ClickUp first');
      return;
    }

    const nav = useNavigation(context);
    if (!nav.state.currentFolder) {
      vscode.window.showInformationMessage('You need to select a folder first');
      return;
    }
    
    const listNavigator = ListNavigator.getInstance(context, nav.state.currentFolder.id);
    await listNavigator.navigateToList();
  });
  context.subscriptions.push(navigateListsCommand);
  
  const navigateTasksCommand = vscode.commands.registerCommand('clickuplink.navigateTasks', async () => {
    await checkAuth(context);
    const auth = useAuth();
    if (!auth.isAuthenticated) {
      vscode.window.showInformationMessage('You need to log in to ClickUp first');
      return;
    }

    const nav = useNavigation(context);
    if (!nav.state.currentList) {
      vscode.window.showInformationMessage('You need to select a list first');
      return;
    }
    
    const taskNavigator = TaskNavigator.getInstance(context, nav.state.currentList.id);
    await taskNavigator.navigateToTask();
  });
  context.subscriptions.push(navigateTasksCommand);  const navigateBackCommand = vscode.commands.registerCommand('clickuplink.navigateBack', async () => {
    await checkAuth(context);
    const auth = useAuth();
    if (!auth.isAuthenticated) {
      vscode.window.showInformationMessage('You need to log in to ClickUp first');
      return;
    }

    const nav = useNavigation(context);
    await nav.goBack();
  });
  context.subscriptions.push(navigateBackCommand);
    // Test Commands
  const testNavigationCommand = vscode.commands.registerCommand('clickuplink.testNavigation', async () => {
    await testPhase2Navigation(context);
  });
  context.subscriptions.push(testNavigationCommand);
  
  const testCacheCommand = vscode.commands.registerCommand('clickuplink.testCache', async () => {
    await testPhase2Cache(context);
  });
  context.subscriptions.push(testCacheCommand);
  
  // Phase 3 Commands - Inline Task Integration
  const toggleDecorationsCommand = vscode.commands.registerCommand('clickuplink.toggleDecorations', () => {
    decorationHook.toggleDecorations();
    vscode.window.showInformationMessage(
      decorationHook.isEnabled() ? 'Task decorations enabled' : 'Task decorations disabled'
    );
  });
  context.subscriptions.push(toggleDecorationsCommand);
  
  const insertTaskCommand = vscode.commands.registerCommand('clickuplink.insertTask', async () => {
    await checkAuth(context);
    const auth = useAuth();
    if (!auth.isAuthenticated) {
      vscode.window.showInformationMessage('You need to log in to ClickUp first');
      return;
    }
    
    await insertionHook.insertAtCursor();
  });
  context.subscriptions.push(insertTaskCommand);
  
  const browseAndInsertCommand = vscode.commands.registerCommand('clickuplink.browseAndInsert', async () => {
    await checkAuth(context);
    const auth = useAuth();
    if (!auth.isAuthenticated) {
      vscode.window.showInformationMessage('You need to log in to ClickUp first');
      return;
    }
    
    await insertionHook.browseAndInsert();
  });
  context.subscriptions.push(browseAndInsertCommand);
  
  const quickInsertCommand = vscode.commands.registerCommand('clickuplink.quickInsert', async () => {
    await checkAuth(context);
    const auth = useAuth();
    if (!auth.isAuthenticated) {
      vscode.window.showInformationMessage('You need to log in to ClickUp first');
      return;
    }
    
    const query = await vscode.window.showInputBox({
      prompt: 'Search for tasks to insert',
      placeHolder: 'Type task name or keywords...'
    });
    
    if (query) {
      await insertionHook.quickInsert(query);
    }
  });
  context.subscriptions.push(quickInsertCommand);
  
  const openTaskDetailsCommand = vscode.commands.registerCommand('clickuplink.openTaskDetails', async (taskId?: string) => {
    if (!taskId) {
      // Try to get task ID from current cursor position
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const position = editor.selection.active;
        const trigger = await triggerHook.detectAtPosition(editor.document, position);
        if (trigger && trigger.taskId) {
          taskId = trigger.taskId;
        }
      }
    }
    
    if (taskId) {
      await interactionHook.openTaskDetails(taskId);
    } else {
      vscode.window.showInformationMessage('No task found at cursor position');
    }
  });
  context.subscriptions.push(openTaskDetailsCommand);
  
  const changeTaskStatusCommand = vscode.commands.registerCommand('clickuplink.changeTaskStatus', async (taskId?: string) => {
    if (!taskId) {
      // Try to get task ID from current cursor position
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const position = editor.selection.active;
        const trigger = await triggerHook.detectAtPosition(editor.document, position);
        if (trigger && trigger.taskId) {
          taskId = trigger.taskId;
        }
      }
    }
    
    if (taskId) {
      await interactionHook.handleStatusClick(taskId);
    } else {
      vscode.window.showInformationMessage('No task found at cursor position');
    }
  });
  context.subscriptions.push(changeTaskStatusCommand);
  
  const showQuickActionsCommand = vscode.commands.registerCommand('clickuplink.showQuickActions', async (taskId?: string) => {
    if (!taskId) {
      // Try to get task ID from current cursor position
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const position = editor.selection.active;
        const trigger = await triggerHook.detectAtPosition(editor.document, position);
        if (trigger && trigger.taskId) {
          taskId = trigger.taskId;
        }
      }
    }
    
    if (taskId) {
      await interactionHook.showQuickActions(taskId);
    } else {
      await webviewManager.showQuickActions(); // Show general actions
    }
  });
  context.subscriptions.push(showQuickActionsCommand);
  
  const refreshDecorationsCommand = vscode.commands.registerCommand('clickuplink.refreshDecorations', async () => {
    await decorationHook.refreshDecorations();
    vscode.window.showInformationMessage('Task decorations refreshed');
  });
  context.subscriptions.push(refreshDecorationsCommand);
  
  // Phase 3 Test Commands
  const testPhase3Command = vscode.commands.registerCommand('clickuplink.testPhase3', async () => {
    const { testPhase3Integration, testPhase3Scenarios } = await import('./tests/phase3Test');
    await testPhase3Integration(context);
  });
  context.subscriptions.push(testPhase3Command);
  
  const testPhase3ScenariosCommand = vscode.commands.registerCommand('clickuplink.testPhase3Scenarios', async () => {
    const { testPhase3Scenarios } = await import('./tests/phase3Test');
    await testPhase3Scenarios(context);
  });
  context.subscriptions.push(testPhase3ScenariosCommand);
}

export function deactivate() {
  // Clean up if needed when extension is deactivated
}