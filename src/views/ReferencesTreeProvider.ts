import * as vscode from 'vscode';
import { ClickUpCodeLensProvider } from '../components/decorations/ClickUpCodeLensProvider';

export class ReferencesTreeProvider implements vscode.TreeDataProvider<ReferenceTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ReferenceTreeItem | undefined | null | void> = new vscode.EventEmitter<ReferenceTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ReferenceTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private context: vscode.ExtensionContext;
  private codeLensProvider: ClickUpCodeLensProvider;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.codeLensProvider = ClickUpCodeLensProvider.getInstance(context);
  }

  private getCurrentWorkspaceFolderPath(): string | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return undefined;
  }

  private getWorkspaceFolderPath(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder?.uri.fsPath;
  }

  private filterReferencesByWorkspace(data: any): any {
    const currentWorkspacePath = this.getCurrentWorkspaceFolderPath();
    if (!currentWorkspacePath) {
      return data; // If no workspace, show all references
    }

    const filteredData: any = {};
    for (const uri in data) {
      const refs = data[uri] || [];
      const filteredRefs = refs.filter((ref: any) => {
        // If no workspace folder path is stored (legacy references), show them
        if (!ref.workspaceFolderPath) {
          return true;
        }
        return ref.workspaceFolderPath === currentWorkspacePath;
      });
      
      if (filteredRefs.length > 0) {
        filteredData[uri] = filteredRefs;
      }
    }
    return filteredData;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ReferenceTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ReferenceTreeItem): Promise<ReferenceTreeItem[]> {
    if (!element) {
      // Root - show summary and actions
      const serialized = this.context.globalState.get<string>('clickup.taskReferences');
        if (!serialized) {        return [
          new ReferenceTreeItem('No task references found', vscode.TreeItemCollapsibleState.None, 'empty'),
          new ReferenceTreeItem('Actions', vscode.TreeItemCollapsibleState.Expanded, 'actions-header')
        ];
      }

      try {
        const data = JSON.parse(serialized);
        const filteredData = this.filterReferencesByWorkspace(data);
        const fileCount = Object.keys(filteredData).length;
        let totalRefs = 0;
        
        for (const uri in filteredData) {
          totalRefs += filteredData[uri].length || 0;
        }

        const workspaceName = this.getCurrentWorkspaceFolderPath() ? 
          vscode.workspace.workspaceFolders?.[0]?.name || 'current workspace' : 
          'all workspaces';

        const items: ReferenceTreeItem[] = [
          new ReferenceTreeItem(`${totalRefs} references in ${fileCount} files (${workspaceName})`, vscode.TreeItemCollapsibleState.None, 'summary'),
          new ReferenceTreeItem('Files with References', vscode.TreeItemCollapsibleState.Expanded, 'files-header'),
          new ReferenceTreeItem('Actions', vscode.TreeItemCollapsibleState.Expanded, 'actions-header')
        ];

        return items;      } catch (error) {        return [
          new ReferenceTreeItem('Error loading references', vscode.TreeItemCollapsibleState.None, 'error'),
          new ReferenceTreeItem('Actions', vscode.TreeItemCollapsibleState.Expanded, 'actions-header')
        ];
      }
    } else if (element.contextValue === 'files-header') {
      // Show files with references
      const serialized = this.context.globalState.get<string>('clickup.taskReferences');
      if (!serialized) return [];

      try {
        const data = JSON.parse(serialized);
        const filteredData = this.filterReferencesByWorkspace(data);
        const items: ReferenceTreeItem[] = [];

        console.log('🔍 ReferencesTreeProvider: Raw data keys:', Object.keys(filteredData));

        for (const uri in filteredData) {
          const refs = filteredData[uri] || [];
          console.log(`🔍 Processing URI: "${uri}" with ${refs.length} refs`);
          
          // Better file name extraction that handles both Windows and Unix paths
          const pathParts = uri.replace(/\\/g, '/').split('/');
          const fileName = pathParts[pathParts.length - 1] || uri;
            console.log(`Extracted filename: "${fileName}" from URI: "${uri}"`);
            items.push(new ReferenceTreeItem(
            `${fileName} (${refs.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'file',
            {
              command: 'vscode.open',
              title: 'Open File',
              arguments: [vscode.Uri.parse(uri)]
            },
            uri
          ));
        }

        console.log(`🔍 ReferencesTreeProvider: Created ${items.length} file items`);
        return items;
      } catch (error) {
        return [new ReferenceTreeItem('Error loading files', vscode.TreeItemCollapsibleState.None, 'error')];
      }
    } else if (element.contextValue === 'file' && element.uri) {
      // Show references in this file
      const serialized = this.context.globalState.get<string>('clickup.taskReferences');
      if (!serialized) return [];

      try {
        const data = JSON.parse(serialized);
        const filteredData = this.filterReferencesByWorkspace(data);
        const refs = filteredData[element.uri] || [];
        const items: ReferenceTreeItem[] = [];
        
        console.log(`🔍 Loading references for URI: "${element.uri}"`);
        console.log(`🔍 Found ${refs.length} references for this file`);        refs.forEach((ref: any, index: number) => {
          const line = (ref.range?.start?.line || 0) + 1; // Convert to 1-based line number
          
          let label: string;
          let contextValue: string;
          
          if (ref.taskName && ref.taskId) {
            // Configured reference with actual task - show status as prefix
            const statusText = ref.taskStatus?.status || ref.status || 'Unknown';
            if (ref.parentTaskName && ref.parentTaskId) {
              label = `(${statusText}) ${ref.parentTaskName} > ${ref.taskName} (Line ${line})`;
            } else {
              label = `(${statusText}) ${ref.taskName} (Line ${line})`;
            }
            
            contextValue = 'reference';
          } else {            
            // Unconfigured reference - needs setup
            label = `Unconfigured Reference (Line ${line})`;
            contextValue = 'unconfigured-reference';
          }
          items.push(new ReferenceTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            contextValue,
            element.uri ? {
              command: 'vscode.open',
              title: 'Go to Reference',
              arguments: [
                vscode.Uri.parse(element.uri),
                { 
                  selection: new vscode.Range(
                    ref.range?.start?.line || 0, 
                    ref.range?.start?.character || 0, 
                    ref.range?.end?.line || 0, 
                    ref.range?.end?.character || 0
                  ) 
                }
              ]
            } : undefined,
            element.uri, // Pass the URI for deletion
            ref.range?.start?.line, // Pass line for deletion
            ref.range?.start?.character // Pass character for deletion
          ));
        });

        return items;
      } catch (error) {
        return [new ReferenceTreeItem('Error loading references', vscode.TreeItemCollapsibleState.None, 'error')];
      }    } else if (element.contextValue === 'actions-header') {      // Show action buttons
      return [
        new ReferenceTreeItem('Add New Reference', vscode.TreeItemCollapsibleState.None, 'add', {
          command: 'clickuplink.addTaskReference',
          title: 'Add Task Reference',
          arguments: []
        }),
        new ReferenceTreeItem('Clear Completed References', vscode.TreeItemCollapsibleState.None, 'clear-completed', {
          command: 'clickuplink.clearCompletedReferences',
          title: 'Clear Completed References',
          arguments: []
        }),
        new ReferenceTreeItem('Clear All References', vscode.TreeItemCollapsibleState.None, 'clear', {
          command: 'clickup.clearReferencesWithWarning',
          title: 'Clear References with Warning',
          arguments: []
        })
      ];
    }

    return [];
  }
}

export class ReferenceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly command?: vscode.Command,
    public readonly uri?: string,
    public readonly line?: number,
    public readonly character?: number
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    this.command = command;
    this.uri = uri;
    this.line = line;
    this.character = character;
      // Set icons based on context
    switch (contextValue) {
      case 'summary':
        this.iconPath = new vscode.ThemeIcon('graph', new vscode.ThemeColor('charts.blue'));
        break;
      case 'files-header':
        this.iconPath = new vscode.ThemeIcon('files');
        break;
      case 'actions-header':
        this.iconPath = new vscode.ThemeIcon('tools');
        break;
      case 'file':
        this.iconPath = new vscode.ThemeIcon('file');
        break;
      case 'reference':
        this.iconPath = new vscode.ThemeIcon('link', new vscode.ThemeColor('charts.blue'));
        break;
      case 'unconfigured-reference':
        this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        break;case 'add':
        this.iconPath = new vscode.ThemeIcon('plus', new vscode.ThemeColor('charts.green'));
        break;
      case 'debug':
        this.iconPath = new vscode.ThemeIcon('debug');
        break;
      case 'clear':
        this.iconPath = new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red'));
        break;
      case 'clear-completed':
        this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.orange'));
        break;
      case 'cleanup':
        this.iconPath = new vscode.ThemeIcon('tools');
        break;
      case 'empty':
        this.iconPath = new vscode.ThemeIcon('circle-slash');
        break;
      case 'error':
        this.iconPath = new vscode.ThemeIcon('error');
        break;
    }
  }
}
