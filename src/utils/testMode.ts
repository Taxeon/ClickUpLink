import * as vscode from 'vscode';
import { setAuthState } from '../state/authState';
import { setTokens } from './tokenStorage';

/**
 * Enable test mode for Phase 2 testing without backend OAuth
 */
export async function enableTestMode(context: vscode.ExtensionContext): Promise<void> {
  // Set mock authentication state
  setAuthState({
    isAuthenticated: true,
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    tokenExpiry: Date.now() + (3600 * 1000), // 1 hour from now
    user: {
      id: 'test_user_id',
      name: 'Test User',
      email: 'test@example.com'
    }
  });

  // Store mock tokens
  await setTokens(context, {
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    expiresAt: Date.now() + (3600 * 1000)
  });

  vscode.window.showInformationMessage('Test mode enabled for Phase 2 testing!');
}

/**
 * Check if test mode is enabled
 */
export function isTestMode(): boolean {
  return vscode.workspace.getConfiguration('clickupLink').get('testMode', false);
}
