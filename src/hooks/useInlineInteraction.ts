import * as vscode from 'vscode';
import { Task } from '../types/navigationTypes';
import { InteractionHandler, InteractionEvent } from '../components/inline/InteractionHandler';

export interface InteractionState {
  activeTask?: Task;
  activeTaskId?: string;
  lastInteraction?: InteractionEvent;
  hoveredElement?: string;
  selectedElement?: string;
  isContextMenuOpen: boolean;
}

export interface InteractionHook {
  state: InteractionState;
  handleClick: (taskId: string, position?: vscode.Position) => Promise<void>;
  handleHover: (task: Task, range: vscode.Range) => Promise<void>;
  handleStatusClick: (taskId: string, currentStatus?: string) => Promise<void>;
  openTaskDetails: (taskId: string) => Promise<void>;
  showQuickActions: (taskId: string) => Promise<void>;
  copyTaskLink: (taskId: string) => Promise<void>;
  markComplete: (taskId: string) => Promise<void>;
  startProgress: (taskId: string) => Promise<void>;
  setState: (newState: Partial<InteractionState>) => void;
  clearState: () => void;
}

export interface InteractionOptions {
  enableClickHandling: boolean;
  enableHoverHandling: boolean;
  enableKeyboardShortcuts: boolean;
  enableContextMenu: boolean;
  doubleClickDelay: number;
  hoverDelay: number;
}

/**
 * React-inspired hook for handling inline interactions
 */
export function useInlineInteraction(context?: vscode.ExtensionContext): InteractionHook {
  if (!context) {
    // Get from global extension context
    context = (global as any).extensionContext;
    
    if (!context) {
      throw new Error('Extension context is required for useInlineInteraction hook');
    }
  }

  const handler = InteractionHandler.getInstance(context);
  
  // State management
  let currentState: InteractionState = {
    isContextMenuOpen: false
  };

  // State listeners
  const listeners: Array<(state: InteractionState) => void> = [];

  /**
   * Update interaction state
   */
  const setState = (newState: Partial<InteractionState>): void => {
    currentState = { ...currentState, ...newState };
    notifyListeners();
  };

  /**
   * Clear interaction state
   */
  const clearState = (): void => {
    currentState = {
      isContextMenuOpen: false
    };
    notifyListeners();
  };

  /**
   * Notify state listeners
   */
  const notifyListeners = (): void => {
    listeners.forEach(listener => listener(currentState));
  };

  /**
   * Subscribe to state changes
   */
  const subscribe = (listener: (state: InteractionState) => void): () => void => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  };

  /**
   * Handle task click interactions
   */
  const handleClick = async (taskId: string, position?: vscode.Position): Promise<void> => {
    const event: InteractionEvent = {
      type: 'click',
      position: position || new vscode.Position(0, 0),
      taskId,
      element: 'task'
    };

    setState({
      activeTaskId: taskId,
      lastInteraction: event,
      selectedElement: 'task'
    });

    await handler.handleTaskClick(taskId, position);
  };

  /**
   * Handle hover interactions
   */
  const handleHover = async (task: Task, range: vscode.Range): Promise<void> => {
    const event: InteractionEvent = {
      type: 'hover',
      position: range.start,
      task,
      taskId: task.id,
      element: 'task'
    };

    setState({
      activeTask: task,
      activeTaskId: task.id,
      lastInteraction: event,
      hoveredElement: 'task'
    });

    await handler.handleHover(task, range);
  };

  /**
   * Handle status click interactions
   */
  const handleStatusClick = async (taskId: string, currentStatus?: string): Promise<void> => {
    const event: InteractionEvent = {
      type: 'click',
      position: new vscode.Position(0, 0),
      taskId,
      element: 'status',
      data: { currentStatus }
    };

    setState({
      activeTaskId: taskId,
      lastInteraction: event,
      selectedElement: 'status'
    });

    await handler.handleStatusClick(taskId, currentStatus);
  };

  /**
   * Open task details panel
   */
  const openTaskDetails = async (taskId: string): Promise<void> => {
    setState({
      activeTaskId: taskId,
      selectedElement: 'details'
    });

    await handler.openTaskDetails(taskId);
  };

  /**
   * Show quick actions for task
   */
  const showQuickActions = async (taskId: string): Promise<void> => {
    setState({
      activeTaskId: taskId,
      isContextMenuOpen: true
    });

    // This would show the quick actions menu
    // Implementation depends on how quick actions are displayed
    console.log(`Showing quick actions for task: ${taskId}`);
    
    // Reset context menu state after a delay
    setTimeout(() => {
      setState({ isContextMenuOpen: false });
    }, 100);
  };

  /**
   * Copy task link to clipboard
   */
  const copyTaskLink = async (taskId: string): Promise<void> => {
    setState({
      activeTaskId: taskId,
      lastInteraction: {
        type: 'click',
        position: new vscode.Position(0, 0),
        taskId,
        element: 'link'
      }
    });

    await handler.copyTaskLink(taskId);
  };

  /**
   * Mark task as complete
   */
  const markComplete = async (taskId: string): Promise<void> => {
    setState({
      activeTaskId: taskId,
      lastInteraction: {
        type: 'click',
        position: new vscode.Position(0, 0),
        taskId,
        element: 'status',
        data: { action: 'complete' }
      }
    });

    await handler.markTaskComplete(taskId);
  };

  /**
   * Start task progress
   */
  const startProgress = async (taskId: string): Promise<void> => {
    setState({
      activeTaskId: taskId,
      lastInteraction: {
        type: 'click',
        position: new vscode.Position(0, 0),
        taskId,
        element: 'status',
        data: { action: 'start-progress' }
      }
    });

    await handler.startTaskProgress(taskId);
  };

  return {
    state: currentState,
    handleClick,
    handleHover,
    handleStatusClick,
    openTaskDetails,
    showQuickActions,
    copyTaskLink,
    markComplete,
    startProgress,
    setState,
    clearState
  };
}

/**
 * Hook for keyboard interaction handling
 */
export function useKeyboardInteractions(context?: vscode.ExtensionContext) {
  const interactionHook = useInlineInteraction(context);

  const keyboardCommands = {
    'Enter': 'activateTask',
    'Space': 'quickActions',
    'Escape': 'clearSelection',
    'F2': 'editTask',
    'Ctrl+Enter': 'markComplete',
    'Ctrl+Shift+Enter': 'startProgress',
    'Ctrl+C': 'copyLink'
  };

  /**
   * Handle keyboard events
   */
  const handleKeyboardEvent = async (
    key: string, 
    modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
  ): Promise<void> => {
    const keyCombo = buildKeyCombo(key, modifiers);
    const command = keyboardCommands[keyCombo as keyof typeof keyboardCommands];

    if (!command || !interactionHook.state.activeTaskId) {
      return;
    }

    switch (command) {
      case 'activateTask':
        await interactionHook.openTaskDetails(interactionHook.state.activeTaskId);
        break;
      case 'quickActions':
        await interactionHook.showQuickActions(interactionHook.state.activeTaskId);
        break;
      case 'clearSelection':
        interactionHook.clearState();
        break;
      case 'markComplete':
        await interactionHook.markComplete(interactionHook.state.activeTaskId);
        break;
      case 'startProgress':
        await interactionHook.startProgress(interactionHook.state.activeTaskId);
        break;
      case 'copyLink':
        await interactionHook.copyTaskLink(interactionHook.state.activeTaskId);
        break;
    }
  };

  /**
   * Build key combination string
   */
  const buildKeyCombo = (
    key: string, 
    modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean }
  ): string => {
    const parts = [];
    if (modifiers.ctrl) parts.push('Ctrl');
    if (modifiers.shift) parts.push('Shift');
    if (modifiers.alt) parts.push('Alt');
    parts.push(key);
    return parts.join('+');
  };

  /**
   * Register keyboard shortcuts
   */
  const registerKeyboardShortcuts = (): vscode.Disposable[] => {
    const disposables: vscode.Disposable[] = [];

    // Register commands for keyboard shortcuts
    Object.entries(keyboardCommands).forEach(([keyCombo, command]) => {
      const commandId = `clickupLink.keyboard.${command}`;
      
      const disposable = vscode.commands.registerCommand(commandId, async () => {
        const [key, ...modifierParts] = keyCombo.split('+').reverse();
        const modifiers = {
          ctrl: modifierParts.includes('Ctrl'),
          shift: modifierParts.includes('Shift'),
          alt: modifierParts.includes('Alt')
        };
        
        await handleKeyboardEvent(key, modifiers);
      });

      disposables.push(disposable);
    });

    return disposables;
  };

  /**
   * Get available keyboard shortcuts
   */
  const getKeyboardShortcuts = () => {
    return { ...keyboardCommands };
  };

  /**
   * Update keyboard shortcuts
   */
  const updateKeyboardShortcuts = (newShortcuts: Partial<typeof keyboardCommands>): void => {
    Object.assign(keyboardCommands, newShortcuts);
  };

  return {
    ...interactionHook,
    handleKeyboardEvent,
    registerKeyboardShortcuts,
    getKeyboardShortcuts,
    updateKeyboardShortcuts
  };
}

/**
 * Hook for managing interaction context menus
 */
export function useContextMenu(context?: vscode.ExtensionContext) {
  const interactionHook = useInlineInteraction(context);

  interface ContextMenuItem {
    id: string;
    label: string;
    icon?: string;
    enabled?: boolean;
    action: () => Promise<void>;
  }

  /**
   * Get context menu items for task
   */
  const getContextMenuItems = (taskId: string): ContextMenuItem[] => {
    return [
      {
        id: 'view-details',
        label: 'View Details',
        icon: '$(eye)',
        action: () => interactionHook.openTaskDetails(taskId)
      },
      {
        id: 'open-browser',
        label: 'Open in ClickUp',
        icon: '$(globe)',
        action: async () => {
          const url = `https://app.clickup.com/t/${taskId}`;
          await vscode.env.openExternal(vscode.Uri.parse(url));
        }
      },
      {
        id: 'mark-complete',
        label: 'Mark Complete',
        icon: '$(check)',
        action: () => interactionHook.markComplete(taskId)
      },
      {
        id: 'start-progress',
        label: 'Start Progress',
        icon: '$(play)',
        action: () => interactionHook.startProgress(taskId)
      },
      {
        id: 'copy-link',
        label: 'Copy Link',
        icon: '$(copy)',
        action: () => interactionHook.copyTaskLink(taskId)
      }
    ];
  };

  /**
   * Show context menu
   */
  const showContextMenu = async (taskId: string): Promise<void> => {
    const items = getContextMenuItems(taskId);
    
    const quickPickItems = items.map(item => ({
      label: item.icon ? `${item.icon} ${item.label}` : item.label,
      description: item.id,
      item
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      title: 'Task Actions',
      placeHolder: 'Select an action...'
    });

    if (selected) {
      await selected.item.action();
    }
  };

  /**
   * Register context menu commands
   */
  const registerContextMenuCommands = (): vscode.Disposable[] => {
    const disposables: vscode.Disposable[] = [];

    // Register main context menu command
    disposables.push(
      vscode.commands.registerCommand('clickupLink.showTaskContextMenu', async (taskId: string) => {
        await showContextMenu(taskId);
      })
    );

    // Register individual action commands
    const items = getContextMenuItems(''); // Get template items
    items.forEach(item => {
      const commandId = `clickupLink.contextMenu.${item.id}`;
      disposables.push(
        vscode.commands.registerCommand(commandId, async (taskId: string) => {
          const actualItems = getContextMenuItems(taskId);
          const actualItem = actualItems.find(i => i.id === item.id);
          if (actualItem) {
            await actualItem.action();
          }
        })
      );
    });

    return disposables;
  };

  return {
    ...interactionHook,
    getContextMenuItems,
    showContextMenu,
    registerContextMenuCommands
  };
}
