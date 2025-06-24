import * as vscode from 'vscode';
import { startAuth, logout, checkAuth, handleAuthCallback, handleManualCodeEntry } from '../hooks/useAuth';
import { AuthTreeProvider } from '../views/AuthTreeProvider';
import { WorkspaceTreeProvider } from '../views/WorkspaceTreeProvider';
import { ReferencesTreeProvider } from '../views/ReferencesTreeProvider';
import { SettingsTreeProvider } from '../views/SettingsTreeProvider';

/**
 * Register settings and authentication-related commands
 */
export function registerSettingsCommands(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  authProvider: AuthTreeProvider,
  workspaceProvider: WorkspaceTreeProvider,
  referencesProvider: ReferencesTreeProvider,
  settingsProvider: SettingsTreeProvider
) {
  // Authentication Commands - only the essential ones
  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.login', async () => {
    await startAuth(context);    
    // Refresh views after authentication
    const isAuthenticated = await checkAuth(context);
    vscode.commands.executeCommand('setContext', 'clickup:authenticated', isAuthenticated);
    authProvider.refresh();
    workspaceProvider.refresh();
    referencesProvider.refresh();
    settingsProvider.refresh();
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
        // Refresh views after successful authentication
        const isAuthenticated = await checkAuth(context);
        vscode.commands.executeCommand('setContext', 'clickup:authenticated', isAuthenticated);
        authProvider.refresh();
        workspaceProvider.refresh();
        referencesProvider.refresh();
        settingsProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Authentication failed: ${error}`);
      }
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('clickuplink.logout', async () => {
    await logout(context);
    vscode.window.showInformationMessage('Logged out of ClickUp');    
    // Refresh views after logout
    vscode.commands.executeCommand('setContext', 'clickup:authenticated', false);
    authProvider.refresh();
    workspaceProvider.refresh();
    referencesProvider.refresh();
    settingsProvider.refresh();
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
    const { enableTestMode } = await import('../utils/testMode');
    await enableTestMode(context);
  }));

  // Add refresh commands for tree views
  context.subscriptions.push(vscode.commands.registerCommand('clickup.refreshAuthView', () => {
    authProvider.refresh();
  }));
  
  context.subscriptions.push(vscode.commands.registerCommand('clickup.refreshWorkspaceView', () => {
    workspaceProvider.refresh();
  }));
  
  context.subscriptions.push(vscode.commands.registerCommand('clickup.refreshReferencesView', () => {
    referencesProvider.refresh();
  }));
  
  context.subscriptions.push(vscode.commands.registerCommand('clickup.refreshSettingsView', () => {
    settingsProvider.refresh();
  }));

  // Add command to refresh all views at once
  context.subscriptions.push(vscode.commands.registerCommand('clickup.refreshAllViews', () => {
    authProvider.refresh();
    workspaceProvider.refresh();
    referencesProvider.refresh();
    settingsProvider.refresh();
  }));

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
}
