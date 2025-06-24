import * as vscode from 'vscode';
import { checkAuth } from './hooks/useAuth';
import { subscribeToConfigChanges } from './hooks/useConfig';
import { ClickUpCodeLensProvider } from './components/decorations/ClickUpCodeLensProvider';
import { AuthTreeProvider } from './views/AuthTreeProvider';
import { WorkspaceTreeProvider } from './views/WorkspaceTreeProvider';
import { ReferencesTreeProvider } from './views/ReferencesTreeProvider';
import { SettingsTreeProvider } from './views/SettingsTreeProvider';

// Import the new panel modules
import { registerWorkspaceCommands } from './panels/extensionWorkspacePanel';
import { registerTaskCommands } from './panels/extensionTasksPanel';
import { registerSettingsCommands } from './panels/extensionSettingsPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 ClickUp Link extension is activating...');
  
  // Create an output channel for easier debugging
  const outputChannel = vscode.window.createOutputChannel('ClickUp Link Debug');
  outputChannel.appendLine('🚀 ClickUp Link extension is activating...');
  
  // Store context globally for hooks
  (global as any).extensionContext = context;
  
  // Set initial authentication context
  checkAuth(context).then(isAuthenticated => {
    vscode.commands.executeCommand('setContext', 'clickup:authenticated', isAuthenticated);
  });
    // Initialize Tree Data Providers for sidebar views
  const authProvider = new AuthTreeProvider(context);
  const workspaceProvider = new WorkspaceTreeProvider(context);
  const referencesProvider = new ReferencesTreeProvider(context);
  const settingsProvider = new SettingsTreeProvider(context);
  
  // Register tree data providers
  vscode.window.createTreeView('clickup-auth', { treeDataProvider: authProvider });
  vscode.window.createTreeView('clickup-workspace', { treeDataProvider: workspaceProvider });
  vscode.window.createTreeView('clickup-references', { treeDataProvider: referencesProvider });
  vscode.window.createTreeView('clickup-settings', { treeDataProvider: settingsProvider });
  
  // Initialize simple CodeLens provider for ClickUp breadcrumb navigation
  const codeLensProvider = ClickUpCodeLensProvider.getInstance(context);
  console.log('📋 CodeLens provider created');
  outputChannel.appendLine('📋 CodeLens provider created');
  
  // Register CodeLens provider for clickable triggers
  const codeLensDisposable = vscode.languages.registerCodeLensProvider('*', codeLensProvider);
  context.subscriptions.push(codeLensDisposable);
  console.log('✅ CodeLens provider registered for all file types');
  
  // Initialize CodeLens Provider
  codeLensProvider.initialize();
  console.log('🔧 CodeLens provider initialized');
  
  // Register commands using the modular panel system
  registerTaskCommands(context, outputChannel, codeLensProvider, referencesProvider);
  registerSettingsCommands(context, outputChannel, authProvider, workspaceProvider, referencesProvider, settingsProvider);
  registerWorkspaceCommands(context, outputChannel);
  
  // Subscribe to configuration changes
  const configSubscription = subscribeToConfigChanges((config) => {
    console.log('Config changed:', config);
  });
  context.subscriptions.push(configSubscription);

  // Check authentication status on startup
  checkAuth(context).then((isAuthenticated) => {
    console.log('🔐 Authentication check on startup:', isAuthenticated);
    if (isAuthenticated) {
      vscode.window.showInformationMessage('Welcome back to ClickUp Link!');
    } else {
      console.log('🔐 Not authenticated on extension activation');
    }
  }).catch((error) => {
    console.error('🔐 Error checking authentication on activation:', error);
  });

  // Store output channel for use throughout extension
  (codeLensProvider as any).outputChannel = outputChannel;
  console.log('✅ ClickUp Link extension activated successfully!');
  console.log('📋 Available commands: addTaskReference, debugShowReferences, debugClearReferences');
  console.log('⌨️  Keybinding: Ctrl+C+U to add task reference');
}

export function deactivate() {
  // Clean up if needed when extension is deactivated
}
