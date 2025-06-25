import * as vscode from 'vscode';
import { checkAuth } from '../hooks/useAuth';

export class AuthTreeProvider implements vscode.TreeDataProvider<AuthTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AuthTreeItem | undefined | null | void> = new vscode.EventEmitter<AuthTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<AuthTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AuthTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AuthTreeItem): Promise<AuthTreeItem[]> {
    if (!element) {
      // Root items
      const isAuthenticated = await checkAuth(this.context);
      
      if (isAuthenticated) {
        return [
          new AuthTreeItem('✅ Connected to ClickUp', vscode.TreeItemCollapsibleState.None, 'connected'),
          new AuthTreeItem('Logout', vscode.TreeItemCollapsibleState.None, 'logout', {
            command: 'clickuplink.logout',
            title: 'Logout',
            arguments: []
          })
        ];
      } else {
        return [
          new AuthTreeItem('🔐 Not Connected', vscode.TreeItemCollapsibleState.None, 'disconnected'),
          new AuthTreeItem('', vscode.TreeItemCollapsibleState.None, 'separator'), // Empty separator
          new AuthTreeItem('Step 1: Login to ClickUp', vscode.TreeItemCollapsibleState.None, 'login', {
            command: 'clickuplink.login',
            title: 'Step 1: Login to ClickUp',
            arguments: []
          }),
          new AuthTreeItem('', vscode.TreeItemCollapsibleState.None, 'separator'), // Empty separator
          new AuthTreeItem('Step 2: Enter Authorization Code', vscode.TreeItemCollapsibleState.None, 'enterCode', {
            command: 'clickuplink.enterCode',
            title: 'Step 2: Enter Authorization Code',
            arguments: []
          }),          
         ];
      }
    }
    return [];
  }
}

export class AuthTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    this.command = command;
    
    // Set icons based on context
    switch (contextValue) {
      case 'login':
        this.iconPath = new vscode.ThemeIcon('sign-in');
        break;
      case 'logout':
        this.iconPath = new vscode.ThemeIcon('sign-out');
        break;
      case 'connected':
        this.iconPath = new vscode.ThemeIcon('check');
        break;
      case 'disconnected':
        this.iconPath = new vscode.ThemeIcon('error');
        break;
    }
  }
}
