import * as vscode from 'vscode';
import { startAuth, logout, useAuth, checkAuth, handleAuthCallback, handleManualCodeEntry } from './hooks/useAuth';
import { subscribeToConfigChanges } from './hooks/useConfig';
import { ClickUpCodeLensProvider } from './components/decorations/ClickUpCodeLensProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 ClickUp Link extension is activating...');
  
  // Create an output channel for easier debugging
  const outputChannel = vscode.window.createOutputChannel('ClickUp Link Debug');
  outputChannel.appendLine('🚀 ClickUp Link extension is activating...');
  
  // Store context globally for hooks
  (global as any).extensionContext = context;
  
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
  
  // Show a visible notification that the extension is ready
  vscode.window.showInformationMessage('ClickUp Link extension activated! Use Ctrl+C Ctrl+U to add task references.');
  
  // Register CodeLens commands - these are the only commands needed for your breadcrumb functionality
  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.setupTaskReference',
    async (uri: vscode.Uri, range: vscode.Range) => {
      console.log('🎯 setupTaskReference command called');
      await codeLensProvider.setupTaskReference(uri, range);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeFolder',
    async (range: vscode.Range, folderId: string) => {
      await codeLensProvider.changeFolder(range, folderId);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeList',
    async (range: vscode.Range, folderId: string, listId: string) => {
      await codeLensProvider.changeList(range, folderId, listId);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeTask',
    async (range: vscode.Range, listId: string, taskId: string) => {
      await codeLensProvider.changeTask(range, listId, taskId);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.changeStatus',
    async (range: vscode.Range, taskId: string) => {
      await codeLensProvider.changeStatus(range, taskId);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.openInClickUp',
    async (taskId: string) => {
      await codeLensProvider.openInClickUp(taskId);
    }
  ));

  // Add command to create a task reference at cursor position
  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.addTaskReference',
    async () => {
      await codeLensProvider.addTaskReferenceAtCursor();
    }
  ));

  // Register the URI Handler for OAuth2 redirect
  const uriHandler = vscode.window.registerUriHandler({
    handleUri: async (uri: vscode.Uri) => {
      console.log('📱 URI Handler received:', uri.toString());
      try {
        await handleAuthCallback(context, uri);
      } catch (error) {
        console.error('❌ URI Handler error:', error);
        vscode.window.showErrorMessage(`Authentication callback failed: ${error}`);
      }
    }
  });
  context.subscriptions.push(uriHandler);

  // Check authentication status on startup
  checkAuth(context).then((isAuthenticated) => {    console.log('🔐 Authentication check on startup:', isAuthenticated);
    if (isAuthenticated) {
      vscode.window.showInformationMessage('Welcome back to ClickUp Link!');
    } else {
      console.log('🔐 Not authenticated on extension activation');
    }
  }).catch((error) => {
    console.error('🔐 Error checking authentication on activation:', error);
  });

  // Subscribe to configuration changes
  const configSubscription = subscribeToConfigChanges((config) => {
    console.log('Config changed:', config);
  });
  context.subscriptions.push(configSubscription);
  // Authentication Commands - only the essential ones
  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.login', async () => {
    await startAuth(context);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.enterCode', async () => {
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
  }));

  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.logout', async () => {
    await logout(context);
    vscode.window.showInformationMessage('Logged out of ClickUp');
  }));
  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.status', async () => {
    const isAuthenticated = await checkAuth(context);
    if (isAuthenticated) {
      vscode.window.showInformationMessage('Connected to ClickUp');
    } else {
      vscode.window.showInformationMessage('Not connected to ClickUp. Use the login command to connect.');
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.enableTestMode', async () => {
    const { enableTestMode } = await import('./utils/testMode');
    await enableTestMode(context);
  }));
  // Add debug commands for testing persistence
  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.debugShowReferences',
    () => {
      outputChannel.show(); // Show the output channel when debugging
      codeLensProvider.debugShowStoredReferences(outputChannel);
    }
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    'clickuplink.debugClearReferences',
    () => {
      outputChannel.show();
      outputChannel.appendLine('🗑️ Clearing all stored task references...');
      codeLensProvider.debugClearStoredReferences();
    }
  ));
  
  // Store output channel for use throughout extension
  (codeLensProvider as any).outputChannel = outputChannel;
  console.log('✅ ClickUp Link extension activated successfully!');
  console.log('📋 Available commands: addTaskReference, debugShowReferences, debugClearReferences');
  console.log('⌨️  Keybinding: Ctrl+C Ctrl+U to add task reference');
}

export function deactivate() {
  // Clean up if needed when extension is deactivated
}
