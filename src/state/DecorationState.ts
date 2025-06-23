import { EventEmitter } from 'events';
import { TaskDecoration } from '../components/decorations/TaskDecorationProvider';

export interface DecorationState {
  decorations: Map<string, TaskDecoration>;
  activeEditor?: string; // Editor file path
  isEnabled: boolean;
  lastRefresh: number;
  refreshCount: number;
  errorCount: number;
  performance: {
    lastRefreshDuration: number;
    averageRefreshDuration: number;
    totalRefreshTime: number;
  };
}

export interface DecorationSettings {
  showStatus: boolean;
  showPriority: boolean;
  showAssignees: boolean;
  showDueDate: boolean;
  compactMode: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  theme: 'light' | 'dark' | 'auto';
  maxDecorations: number;
}

const initialState: DecorationState = {
  decorations: new Map(),
  isEnabled: true,
  lastRefresh: 0,
  refreshCount: 0,
  errorCount: 0,
  performance: {
    lastRefreshDuration: 0,
    averageRefreshDuration: 0,
    totalRefreshTime: 0
  }
};

class DecorationStateManager extends EventEmitter {
  private state: DecorationState = initialState;
  private settings: DecorationSettings = {
    showStatus: true,
    showPriority: true,
    showAssignees: true,
    showDueDate: true,
    compactMode: false,
    autoRefresh: true,
    refreshInterval: 5000,
    theme: 'auto',
    maxDecorations: 100
  };

  getState(): DecorationState {
    return { 
      ...this.state,
      decorations: new Map(this.state.decorations)
    };
  }

  getSettings(): DecorationSettings {
    return { ...this.settings };
  }

  /**
   * Update decoration state
   */
  setState(updates: Partial<DecorationState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('stateChange', this.getState());
  }

  /**
   * Update settings
   */
  updateSettings(updates: Partial<DecorationSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.emit('settingsChange', this.getSettings());
  }

  /**
   * Add decoration
   */
  addDecoration(id: string, decoration: TaskDecoration): void {
    this.state.decorations.set(id, decoration);
    
    // Limit number of decorations for performance
    if (this.state.decorations.size > this.settings.maxDecorations) {
      const firstKey = this.state.decorations.keys().next().value;
      if (firstKey) {
        this.removeDecoration(firstKey);
      }
    }
    
    this.emit('decorationAdded', { id, decoration });
    this.emit('stateChange', this.getState());
  }

  /**
   * Remove decoration
   */
  removeDecoration(id: string): boolean {
    const existed = this.state.decorations.delete(id);
    
    if (existed) {
      this.emit('decorationRemoved', { id });
      this.emit('stateChange', this.getState());
    }
    
    return existed;
  }

  /**
   * Update decoration
   */
  updateDecoration(id: string, updates: Partial<TaskDecoration>): boolean {
    const existing = this.state.decorations.get(id);
    
    if (existing) {
      const updated = { ...existing, ...updates };
      this.state.decorations.set(id, updated);
      
      this.emit('decorationUpdated', { id, decoration: updated });
      this.emit('stateChange', this.getState());
      return true;
    }
    
    return false;
  }

  /**
   * Clear all decorations
   */
  clearDecorations(): void {
    const count = this.state.decorations.size;
    this.state.decorations.clear();
    
    this.emit('decorationsCleared', { count });
    this.emit('stateChange', this.getState());
  }

  /**
   * Get decorations for specific editor
   */
  getDecorationsForEditor(editorPath: string): TaskDecoration[] {
    const decorations: TaskDecoration[] = [];
    
    this.state.decorations.forEach(decoration => {
      // This would need to track which editor each decoration belongs to
      decorations.push(decoration);
    });
    
    return decorations;
  }

  /**
   * Set active editor
   */
  setActiveEditor(editorPath?: string): void {
    this.setState({ activeEditor: editorPath });
  }

  /**
   * Toggle enabled state
   */
  setEnabled(enabled: boolean): void {
    this.setState({ isEnabled: enabled });
  }

  /**
   * Record refresh performance
   */
  recordRefresh(duration: number, success: boolean = true): void {
    const newRefreshCount = this.state.refreshCount + 1;
    const newTotalTime = this.state.performance.totalRefreshTime + duration;
    const newAverage = newTotalTime / newRefreshCount;

    this.setState({
      lastRefresh: Date.now(),
      refreshCount: newRefreshCount,
      errorCount: success ? this.state.errorCount : this.state.errorCount + 1,
      performance: {
        lastRefreshDuration: duration,
        averageRefreshDuration: newAverage,
        totalRefreshTime: newTotalTime
      }
    });
  }

  /**
   * Get decoration statistics
   */
  getStatistics() {
    return {
      totalDecorations: this.state.decorations.size,
      activeEditor: this.state.activeEditor,
      isEnabled: this.state.isEnabled,
      refreshCount: this.state.refreshCount,
      errorCount: this.state.errorCount,
      performance: { ...this.state.performance },
      lastRefresh: this.state.lastRefresh,
      uptime: Date.now() - (this.state.lastRefresh || Date.now())
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.setState({
      refreshCount: 0,
      errorCount: 0,
      performance: {
        lastRefreshDuration: 0,
        averageRefreshDuration: 0,
        totalRefreshTime: 0
      }
    });
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: DecorationState) => void): () => void {
    this.on('stateChange', listener);
    return () => this.removeListener('stateChange', listener);
  }

  /**
   * Subscribe to settings changes
   */
  subscribeToSettings(listener: (settings: DecorationSettings) => void): () => void {
    this.on('settingsChange', listener);
    return () => this.removeListener('settingsChange', listener);
  }

  /**
   * Subscribe to decoration events
   */
  subscribeToDecorationEvents(callbacks: {
    onAdded?: (data: { id: string; decoration: TaskDecoration }) => void;
    onRemoved?: (data: { id: string }) => void;
    onUpdated?: (data: { id: string; decoration: TaskDecoration }) => void;
    onCleared?: (data: { count: number }) => void;
  }): () => void {
    const disposables: (() => void)[] = [];

    if (callbacks.onAdded) {
      this.on('decorationAdded', callbacks.onAdded);
      disposables.push(() => this.removeListener('decorationAdded', callbacks.onAdded!));
    }

    if (callbacks.onRemoved) {
      this.on('decorationRemoved', callbacks.onRemoved);
      disposables.push(() => this.removeListener('decorationRemoved', callbacks.onRemoved!));
    }

    if (callbacks.onUpdated) {
      this.on('decorationUpdated', callbacks.onUpdated);
      disposables.push(() => this.removeListener('decorationUpdated', callbacks.onUpdated!));
    }

    if (callbacks.onCleared) {
      this.on('decorationsCleared', callbacks.onCleared);
      disposables.push(() => this.removeListener('decorationsCleared', callbacks.onCleared!));
    }

    return () => {
      disposables.forEach(dispose => dispose());
    };
  }

  /**
   * Export state for persistence
   */
  exportState() {
    return {
      settings: this.getSettings(),
      statistics: this.getStatistics(),
      timestamp: Date.now()
    };
  }

  /**
   * Import state from persistence
   */
  importState(data: { settings?: Partial<DecorationSettings>; statistics?: any }) {
    if (data.settings) {
      this.updateSettings(data.settings);
    }
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.state = { ...initialState, decorations: new Map() };
    this.emit('stateChange', this.getState());
  }
}

// Export singleton instance
export const decorationState = new DecorationStateManager();
