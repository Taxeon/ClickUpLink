import * as vscode from 'vscode';
import { checkAuth } from './hooks/useAuth';
import { subscribeToConfigChanges } from './hooks/useConfig';
import { ClickUpCodeLensProvider } from './components/decorations/ClickUpCodeLensProvider';
import { AuthTreeProvider } from './views/AuthTreeProvider';
import { WorkspaceTreeProvider } from './views/WorkspaceTreeProvider';
import { ReferencesTreeProvider } from './views/ReferencesTreeProvider';
import { SettingsTreeProvider } from './views/SettingsTreeProvider';
import { OutputChannelManager } from './utils/outputChannels';

// Import the new panel modules
import { registerWorkspaceCommands } from './panels/extensionWorkspacePanel';
import { registerTaskCommands } from './panels/extensionTasksPanel';
import { registerSettingsCommands } from './panels/extensionSettingsPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 ClickUp Link extension is activating...');
  
  // Initialize all output channels
  OutputChannelManager.initializeChannels();
  const outputChannel = OutputChannelManager.getChannel('ClickUp Link Debug');
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

  // Connect the references tree provider to the CodeLens provider
  // This allows the CodeLens provider to refresh the tree view when references change
  codeLensProvider.setReferencesTreeProvider(referencesProvider);

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

  let scanTimeout: Map<string, NodeJS.Timeout> = new Map();

const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
    
    // Add detailed logging to understand the trigger
    const docUri = event.document.uri.toString();
    const fileName = event.document.fileName.split(/[\/\\]/).pop(); // Get just the filename
    
    // IMPORTANT: Filter out non-file schemes and temporary/system files
    // This prevents processing events from output channels, git views, and other VS Code internal docs
    if (event.document.uri.scheme !== 'file' || 
        docUri.includes('extension-output') || 
        docUri.includes('vscode-') || 
        docUri.includes('output:') ||
        fileName?.startsWith('.')) {
        // Don't even log these to avoid cluttering the output
        return;
    }
    
    // Log the event details
    outputChannel.appendLine(`⚡ Document change event: ${fileName} (${docUri})`);
    outputChannel.appendLine(`📄 Changes: ${event.contentChanges.length} | Reason: ${event.reason || 'unknown'}`);
    
    // Early return if no changes (should prevent unnecessary triggers)
    if (event.contentChanges.length === 0) {
        outputChannel.appendLine(`⏭️ Skipping - No content changes`);
        return;
    }
    
    // Log change details (safely handles large changes)
    if (event.contentChanges.length > 0) {
        const change = event.contentChanges[0];
        outputChannel.appendLine(`📝 First change - Range: L${change.range.start.line}:${change.range.start.character}-L${change.range.end.line}:${change.range.end.character}`);
        
        // Only log text if it's short (to avoid flooding the output)
        if (change.text.length < 50) {
            outputChannel.appendLine(`✏️ Text: "${change.text}"`);
        } else {
            outputChannel.appendLine(`✏️ Text length: ${change.text.length} characters`);
        }
    }
    
    // Clear existing timeout for this document
    const existingTimeout = scanTimeout.get(docUri);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
        outputChannel.appendLine(`🔄 Cleared previous timeout for ${fileName}`);
    }

    // Set new timeout
    const newTimeout = setTimeout(async () => {
        outputChannel.appendLine(`⏰ Timeout triggered for ${fileName} - refreshing CodeLens`);
        
        // First clean the state for this document to avoid duplicates
        await codeLensProvider.cleanStateForDocument(docUri);
        
        // Then update task references locally without syncing to ClickUp API
        // This is more efficient for document changes as we only need to update positions
        codeLensProvider.refreshTaskReferences(false);
        
        // Then, trigger a refresh of the CodeLenses
        // The refresh method fires the _onDidChangeCodeLenses event which updates the UI
        codeLensProvider.refresh();
        
        scanTimeout.delete(docUri);
    }, 300); // Wait 300ms after last change

    scanTimeout.set(docUri, newTimeout);
    outputChannel.appendLine(`⏳ Set timeout for ${fileName}\n---`); // Add separator for readability
});

  console.log('✅ ClickUp Link extension activated successfully!');
  console.log('📋 Available commands: addTaskReference, debugShowReferences, debugClearReferences');
  console.log('⌨️  Keybinding: Ctrl+C+U to add task reference');
}

export function deactivate() {
  // Clean up when extension is deactivated
  OutputChannelManager.disposeAll();
  console.log('ClickUp Link extension deactivated');
}
