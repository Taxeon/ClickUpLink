import * as vscode from 'vscode';
import { ClickUpService } from '../services/clickUpService';
import { checkAuth } from '../hooks/useAuth';

export class WorkspaceTreeProvider implements vscode.TreeDataProvider<WorkspaceTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorkspaceTreeItem | undefined | null | void> = new vscode.EventEmitter<WorkspaceTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WorkspaceTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private context: vscode.ExtensionContext;
  private clickUpService: ClickUpService;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.clickUpService = ClickUpService.getInstance(context);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem {
    return element;
  }
  async getChildren(element?: WorkspaceTreeItem): Promise<WorkspaceTreeItem[]> {
    const isAuthenticated = await checkAuth(this.context);
    if (!isAuthenticated) {
      return [new WorkspaceTreeItem('Please login to view workspace', vscode.TreeItemCollapsibleState.None, 'message')];
    }

    try {
      if (!element) {
        // Root - show current workspace info
        const workspaces = await this.clickUpService.getWorkspaces();
        if (workspaces && workspaces.length > 0) {
          const currentWorkspace = workspaces[0]; // Use first workspace for now
          return [
            new WorkspaceTreeItem(`${currentWorkspace.name}`, vscode.TreeItemCollapsibleState.Expanded, 'workspace', undefined, currentWorkspace.id)
          ];
        } else {
          return [new WorkspaceTreeItem('No workspaces found', vscode.TreeItemCollapsibleState.None, 'message')];
        }      } else if (element.contextValue === 'workspace') {        // Show workspace actions and current space info
        const items: WorkspaceTreeItem[] = [
          new WorkspaceTreeItem('Browse Spaces', vscode.TreeItemCollapsibleState.None, 'browse-spaces', {
            command: 'clickup.selectSpace',
            title: 'Select Active Space',
            arguments: [element.workspaceId]
          })
        ];
        
        // Try to get current active space
        const currentSpaceId = this.context.globalState.get<string>('clickup.currentSpaceId');
        const currentSpaceName = this.context.globalState.get<string>('clickup.currentSpaceName');
        
        if (currentSpaceId && currentSpaceName) {
          items.push(new WorkspaceTreeItem(
            `Current Space: ${currentSpaceName}`, 
            vscode.TreeItemCollapsibleState.None, 
            'current-space',
            {
              command: 'clickuplink.openSpaceInClickUp',
              title: 'Open Space in ClickUp',
              arguments: [currentSpaceId]
            },
            element.workspaceId,
            currentSpaceId
          ));
        } else {
          items.push(new WorkspaceTreeItem(
            'No active space selected', 
            vscode.TreeItemCollapsibleState.None, 
            'no-space'
          ));
        }

        // Add visual spacer
        items.push(new WorkspaceTreeItem(
          '', 
          vscode.TreeItemCollapsibleState.None, 
          'spacer'
        ));

        // Add Pizza button at the bottom
        items.push(new WorkspaceTreeItem(
          '🍕 Buy Dev a Slice of Pizza',
          vscode.TreeItemCollapsibleState.None,
          'pizza-button',
          {
            command: 'clickuplink.buyPizza',
            title: 'Support Development'
          }
        ));
        
        return items;
      }
    } catch (error) {
      console.error('Error loading workspace data:', error);
      return [new WorkspaceTreeItem('Error loading workspace data', vscode.TreeItemCollapsibleState.None, 'error')];
    }

    return [];
  }
}

export class WorkspaceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly command?: vscode.Command,
    public readonly workspaceId?: string,
    public readonly spaceId?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    this.command = command;
    this.workspaceId = workspaceId;
    this.spaceId = spaceId;      // Set icons based on context
    switch (contextValue) {
      case 'workspace':
        this.iconPath = new vscode.ThemeIcon('organization');
        break;
      case 'browse-spaces':
        this.iconPath = new vscode.ThemeIcon('search', new vscode.ThemeColor('charts.blue'));
        break;
      case 'current-space':
        this.iconPath = new vscode.ThemeIcon('location', new vscode.ThemeColor('charts.green'));
        break;
      case 'pizza-button':
        this.iconPath = new vscode.ThemeIcon('heart', new vscode.ThemeColor('charts.red'));
        break;
      case 'spacer':
        // No icon for spacer - creates visual separation
        this.iconPath = undefined;
        break;
      case 'no-space':
        this.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.orange'));
        break;
      case 'view-folders':
        this.iconPath = new vscode.ThemeIcon('layout', new vscode.ThemeColor('charts.blue'));
        break;
      case 'info':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
      case 'error':
        this.iconPath = new vscode.ThemeIcon('error');
        break;
      case 'message':
        this.iconPath = new vscode.ThemeIcon('comment');
        break;
    }
  }
}
