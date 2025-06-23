// useAuth.ts
// Authentication hook with OAuth2 support

import { setAuthState, getAuthState, clearAuthState } from '../state/authState';
import { AuthState } from '../types';
import * as vscode from 'vscode';
import { AuthComponent } from '../components/AuthComponent';

/**
 * Start the OAuth2 authentication flow
 */
export async function startAuth(context: vscode.ExtensionContext): Promise<void> {
  const authComponent = AuthComponent.getInstance(context);
  await authComponent.startAuthFlow();
}

/**
 * Handle the OAuth2 callback
 */
export async function handleAuthCallback(context: vscode.ExtensionContext, uri: vscode.Uri): Promise<void> {
  const authComponent = AuthComponent.getInstance(context);
  await authComponent.handleAuthCallback(uri);
}

/**
 * Handle manual code entry for authentication
 */
export async function handleManualCodeEntry(context: vscode.ExtensionContext, code: string): Promise<void> {
  const authComponent = AuthComponent.getInstance(context);
  await authComponent.handleManualCodeEntry(code);
}

/**
 * Logout and clear authentication state
 */
export async function logout(context: vscode.ExtensionContext) {
  const authComponent = AuthComponent.getInstance(context);
  await authComponent.logout();
}

/**
 * Check if user is authenticated
 */
export async function checkAuth(context: vscode.ExtensionContext): Promise<boolean> {
  const authComponent = AuthComponent.getInstance(context);
  return await authComponent.checkAuthStatus();
}

/**
 * Get current authentication state
 */
export function useAuth(): AuthState {
  return getAuthState();
}