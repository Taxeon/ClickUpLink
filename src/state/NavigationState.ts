import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { NavigationState, NavigationItem } from '../types/navigation';

const initialState: NavigationState = {
  currentProject: null,
  currentFolder: null,
  currentList: null,
  currentTask: null,
  breadcrumbs: [],
  history: []
};

class NavigationStateManager extends EventEmitter {
  private state: NavigationState = initialState;

  getState(): NavigationState {
    return this.state;
  }

  setState(newState: Partial<NavigationState>): void {
    this.state = { ...this.state, ...newState };
    this.emit('change', this.state);
  }

  setBreadcrumbs(items: NavigationItem[]): void {
    this.state.breadcrumbs = items;
    this.emit('change', this.state);
  }

  addToHistory(type: 'project' | 'folder' | 'list' | 'task', id: string): void {
    this.state.history.push({ type, id });
    if (this.state.history.length > 50) {
      // Limit history size
      this.state.history = this.state.history.slice(-50);
    }
    this.emit('change', this.state);
  }

  reset(): void {
    this.state = initialState;
    this.emit('change', this.state);
  }

  subscribe(listener: (state: NavigationState) => void): () => void {
    this.on('change', listener);
    return () => this.removeListener('change', listener);
  }
}

export const navigationState = new NavigationStateManager();
