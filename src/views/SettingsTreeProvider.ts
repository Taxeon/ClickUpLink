import * as vscode from 'vscode';
import { checkAuth } from '../hooks/useAuth';

export class SettingsTreeProvider implements vscode.TreeDataProvider<SettingsTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SettingsTreeItem | undefined | null | void> = new vscode.EventEmitter<SettingsTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SettingsTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SettingsTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SettingsTreeItem): Promise<SettingsTreeItem[]> {
    if (!element) {
      // Root - show account info and settings actions
      const isAuthenticated = await checkAuth(this.context);
      
      if (!isAuthenticated) {
        return [
          new SettingsTreeItem('Not authenticated', vscode.TreeItemCollapsibleState.None, 'info'),
          new SettingsTreeItem('Login to ClickUp', vscode.TreeItemCollapsibleState.None, 'login', {
            command: 'clickuplink.login',
            title: 'Login',
            arguments: []
          })
        ];
      }

      return [
        new SettingsTreeItem('Account', vscode.TreeItemCollapsibleState.Expanded, 'account-header'),
        new SettingsTreeItem('Extension', vscode.TreeItemCollapsibleState.Expanded, 'extension-header')
      ];
    } else if (element.contextValue === 'account-header') {
      // Show account-related actions
      return [
        new SettingsTreeItem('View Status', vscode.TreeItemCollapsibleState.None, 'status', {
          command: 'clickuplink.status',
          title: 'Check Status',
          arguments: []
        }),
        new SettingsTreeItem('Logout', vscode.TreeItemCollapsibleState.None, 'logout', {
          command: 'clickuplink.logout',
          title: 'Logout',
          arguments: []
        })
      ];
    } else if (element.contextValue === 'extension-header') {
      // Show extension-related settings
      return [
        new SettingsTreeItem('View Output Log', vscode.TreeItemCollapsibleState.None, 'log', {
          command: 'clickuplink.debugShowReferences',
          title: 'Show Debug Output',
          arguments: []
        }),
        new SettingsTreeItem('Refresh All Views', vscode.TreeItemCollapsibleState.None, 'refresh', {
          command: 'clickup.refreshAllViews',
          title: 'Refresh All Views',
          arguments: []
        })
      ];
    }

    return [];
  }
}

export class SettingsTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = this.label;
    
    // Set icons for different types
    switch (contextValue) {
      case 'login':
        this.iconPath = new vscode.ThemeIcon('sign-in');
        break;
      case 'logout':
        this.iconPath = new vscode.ThemeIcon('sign-out');
        break;
      case 'status':
        this.iconPath = new vscode.ThemeIcon('account');
        break;
      case 'log':
        this.iconPath = new vscode.ThemeIcon('output');
        break;
      case 'refresh':
        this.iconPath = new vscode.ThemeIcon('refresh');
        break;
      case 'account-header':
        this.iconPath = new vscode.ThemeIcon('person');
        break;
      case 'extension-header':
        this.iconPath = new vscode.ThemeIcon('extensions');
        break;
    }
  }
}
