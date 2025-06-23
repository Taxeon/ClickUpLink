// authState.ts
// Authentication state management 

import { appState } from './appState';
import { AuthState } from '../types';

export function setAuthState(auth: Partial<AuthState>) {
  const current = appState.getState().auth;
  appState.setState({ auth: { ...current, ...auth } });
}

export function getAuthState(): AuthState {
  return appState.getState().auth;
}

export function clearAuthState() {
  setAuthState({
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
    user: undefined
  });
}