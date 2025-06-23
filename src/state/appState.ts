// appState.ts
import { EventEmitter } from 'events';
import { AuthState, ConfigState } from '../types';

export type AppStateType = {
  auth: AuthState;
  config: ConfigState;
};

const initialState: AppStateType = {
  auth: {
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
    user: undefined,
  },
  config: {
    workspaceId: null,
    theme: 'light',
    notificationsEnabled: true,
  },
};

class AppStateManager extends EventEmitter {
  private state: AppStateType = initialState;

  getState() {
    return this.state;
  }

  setState(partial: Partial<AppStateType>) {
    this.state = { ...this.state, ...partial };
    this.emit('change', this.state);
  }

  subscribe(listener: (state: AppStateType) => void) {
    this.on('change', listener);
    return () => this.removeListener('change', listener);
  }
}

export const appState = new AppStateManager(); 