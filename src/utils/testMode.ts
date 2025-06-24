import * as vscode from 'vscode';
import { setTokens } from './tokenStorage';

/**
 * Enable test mode for Phase 2 testing without backend OAuth
 */
export async function enableTestMode(context: vscode.ExtensionContext): Promise<void> {
  // Store mock tokens directly
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
