import * as vscode from 'vscode';
import { DecorationState, TaskDecorationProvider } from '../components/decorations/TaskDecorationProvider';

export interface DecorationOptions {
  enabled: boolean;
  showStatus: boolean;
  showPriority: boolean;
  showAssignees: boolean;
  compactMode: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // milliseconds
}

export interface DecorationHook {
  state: DecorationState;
  options: DecorationOptions;
  refreshDecorations: () => Promise<void>;
  toggleDecorations: () => void;
  updateOptions: (newOptions: Partial<DecorationOptions>) => void;
  clearDecorations: () => void;
  isEnabled: () => boolean;
}

/**
 * React-inspired hook for managing text decorations
 */
export function useDecorations(context?: vscode.ExtensionContext): DecorationHook {
  if (!context) {
    // Get from global extension context
    context = (global as any).extensionContext;
    
    if (!context) {
      throw new Error('Extension context is required for useDecorations hook');
    }
  }

  const provider = TaskDecorationProvider.getInstance(context);
  let currentState = provider.getState();
  let currentOptions: DecorationOptions = {
    enabled: true,
    showStatus: true,
    showPriority: true,
    showAssignees: true,
    compactMode: false,
    autoRefresh: true,
    refreshInterval: 5000
  };

  // Load options from configuration
  const loadOptions = () => {
    const config = vscode.workspace.getConfiguration('clickupLink.decorations');
    currentOptions = {
      enabled: config.get('enabled', true),
      showStatus: config.get('showStatus', true),
      showPriority: config.get('showPriority', true),
      showAssignees: config.get('showAssignees', true),
      compactMode: config.get('compactMode', false),
      autoRefresh: config.get('autoRefresh', true),
      refreshInterval: config.get('refreshInterval', 5000)
    };
  };

  // Initial load
  loadOptions();

  // Auto-refresh setup
  let refreshTimer: NodeJS.Timeout | undefined;
  const setupAutoRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    if (currentOptions.autoRefresh && currentOptions.enabled) {
      refreshTimer = setInterval(async () => {
        await refreshDecorations();
      }, currentOptions.refreshInterval);
    }
  };

  // Setup initial auto-refresh
  setupAutoRefresh();

  /**
   * Refresh decorations for active editor
   */
  const refreshDecorations = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (editor && currentOptions.enabled) {
      await provider.refreshDecorations(editor);
      currentState = provider.getState();
    }
  };

  /**
   * Toggle decorations on/off
   */
  const toggleDecorations = (): void => {
    currentOptions.enabled = !currentOptions.enabled;
    provider.setEnabled(currentOptions.enabled);
    currentState = provider.getState();

    // Update auto-refresh
    setupAutoRefresh();

    // Save to configuration
    const config = vscode.workspace.getConfiguration('clickupLink.decorations');
    config.update('enabled', currentOptions.enabled, vscode.ConfigurationTarget.Global);
  };

  /**
   * Update decoration options
   */
  const updateOptions = (newOptions: Partial<DecorationOptions>): void => {
    const oldOptions = { ...currentOptions };
    currentOptions = { ...currentOptions, ...newOptions };

    // Apply enabled state to provider
    if (newOptions.enabled !== undefined) {
      provider.setEnabled(currentOptions.enabled);
    }

    // Update auto-refresh if interval or enabled state changed
    if (newOptions.autoRefresh !== undefined || 
        newOptions.refreshInterval !== undefined ||
        newOptions.enabled !== undefined) {
      setupAutoRefresh();
    }

    // Refresh decorations if visual options changed
    if (newOptions.showStatus !== undefined ||
        newOptions.showPriority !== undefined ||
        newOptions.showAssignees !== undefined ||
        newOptions.compactMode !== undefined) {
      refreshDecorations();
    }

    // Save to configuration
    const config = vscode.workspace.getConfiguration('clickupLink.decorations');
    Object.entries(newOptions).forEach(([key, value]) => {
      config.update(key, value, vscode.ConfigurationTarget.Global);
    });

    currentState = provider.getState();
  };

  /**
   * Clear all decorations
   */
  const clearDecorations = (): void => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      // Temporarily disable and re-enable to clear
      provider.setEnabled(false);
      setTimeout(() => {
        provider.setEnabled(currentOptions.enabled);
      }, 100);
    }
    currentState = provider.getState();
  };

  /**
   * Check if decorations are enabled
   */
  const isEnabled = (): boolean => {
    return currentOptions.enabled && currentState.isEnabled;
  };

  // Listen for configuration changes
  const configListener = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('clickupLink.decorations')) {
      loadOptions();
      setupAutoRefresh();
    }
  });

  // Clean up on extension deactivation
  const cleanup = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    configListener.dispose();
  };

  // Store cleanup function globally (this is a simplified approach)
  if (!(global as any).decorationCleanup) {
    (global as any).decorationCleanup = [];
  }
  (global as any).decorationCleanup.push(cleanup);

  return {
    state: currentState,
    options: currentOptions,
    refreshDecorations,
    toggleDecorations,
    updateOptions,
    clearDecorations,
    isEnabled
  };
}

/**
 * Hook for decoration-specific operations
 */
export function useDecorationActions(context?: vscode.ExtensionContext) {
  const decorationHook = useDecorations(context);

  /**
   * Toggle compact mode
   */
  const toggleCompactMode = (): void => {
    decorationHook.updateOptions({ 
      compactMode: !decorationHook.options.compactMode 
    });
  };

  /**
   * Toggle status display
   */
  const toggleStatusDisplay = (): void => {
    decorationHook.updateOptions({ 
      showStatus: !decorationHook.options.showStatus 
    });
  };

  /**
   * Toggle priority display
   */
  const togglePriorityDisplay = (): void => {
    decorationHook.updateOptions({ 
      showPriority: !decorationHook.options.showPriority 
    });
  };

  /**
   * Toggle assignee display
   */
  const toggleAssigneeDisplay = (): void => {
    decorationHook.updateOptions({ 
      showAssignees: !decorationHook.options.showAssignees 
    });
  };

  /**
   * Set refresh interval
   */
  const setRefreshInterval = (interval: number): void => {
    decorationHook.updateOptions({ refreshInterval: interval });
  };

  /**
   * Toggle auto-refresh
   */
  const toggleAutoRefresh = (): void => {
    decorationHook.updateOptions({ 
      autoRefresh: !decorationHook.options.autoRefresh 
    });
  };

  /**
   * Refresh all decorations in all open editors
   */
  const refreshAllDecorations = async (): Promise<void> => {
    const editors = vscode.window.visibleTextEditors;
    const provider = TaskDecorationProvider.getInstance(context!);
    
    for (const editor of editors) {
      await provider.refreshDecorations(editor);
    }
  };

  /**
   * Get decoration statistics
   */
  const getDecorationStats = () => {
    const state = decorationHook.state;
    return {
      totalDecorations: state.decorations.size,
      activeEditor: state.activeEditor?.document.fileName,
      isEnabled: state.isEnabled
    };
  };

  return {
    ...decorationHook,
    toggleCompactMode,
    toggleStatusDisplay,
    togglePriorityDisplay,
    toggleAssigneeDisplay,
    setRefreshInterval,
    toggleAutoRefresh,
    refreshAllDecorations,
    getDecorationStats
  };
}

/**
 * Hook for managing decoration themes
 */
export function useDecorationThemes(context?: vscode.ExtensionContext) {
  const decorationHook = useDecorations(context);

  const themes = {
    minimal: {
      showStatus: true,
      showPriority: false,
      showAssignees: false,
      compactMode: true
    },
    detailed: {
      showStatus: true,
      showPriority: true,
      showAssignees: true,
      compactMode: false
    },
    statusOnly: {
      showStatus: true,
      showPriority: false,
      showAssignees: false,
      compactMode: false
    }
  };

  /**
   * Apply a decoration theme
   */
  const applyTheme = (themeName: keyof typeof themes): void => {
    const theme = themes[themeName];
    decorationHook.updateOptions(theme);
  };

  /**
   * Get available themes
   */
  const getAvailableThemes = () => {
    return Object.keys(themes);
  };

  /**
   * Get current theme (best match)
   */
  const getCurrentTheme = (): string | undefined => {
    const options = decorationHook.options;
    
    for (const [themeName, themeOptions] of Object.entries(themes)) {
      const matches = Object.entries(themeOptions).every(([key, value]) => 
        options[key as keyof DecorationOptions] === value
      );
      
      if (matches) {
        return themeName;
      }
    }
    
    return 'custom';
  };

  return {
    applyTheme,
    getAvailableThemes,
    getCurrentTheme,
    themes
  };
}
