// useAuth.ts
// Authentication hook with OAuth2 support

import { AuthState } from '../types';
import * as vscode from 'vscode';
import { getAccessToken, deleteTokens } from '../utils/tokenStorage';

/**
 * Start the OAuth2 authentication flow
 */
export async function startAuth(context: vscode.ExtensionContext): Promise<void> {
  try {
    const { getOAuthClientInfo, validateAuthService } = await import('../utils/tokenStorage');
    
    // First validate that the auth service is available
    const serviceAvailable = await validateAuthService();
    if (!serviceAvailable) {
      vscode.window.showErrorMessage('Authentication service is not available. Please check your internet connection.');
      return;
    }    const { clientId, redirectUri } = getOAuthClientInfo();
    
    // Build the OAuth URL
    const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    // Open the OAuth URL in the browser
    await vscode.env.openExternal(vscode.Uri.parse(authUrl));
    
    // Show message to user
    const result = await vscode.window.showInformationMessage(
      'Complete authentication in your browser, then enter the code here.',
      'Enter Code Now',
      'Enter Code Later'
    );
    
    if (result === 'Enter Code Now') {
      vscode.commands.executeCommand('clickuplink.enterCode');
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to start authentication: ${error}`);
  }
}

/**
 * Handle the OAuth2 callback
 */
export async function handleAuthCallback(context: vscode.ExtensionContext, uri: vscode.Uri): Promise<void> {
  try {
    const query = new URLSearchParams(uri.query);
    const code = query.get('code');
    
    if (!code) {
      vscode.window.showErrorMessage('No authorization code received');
      return;
    }
    
    await handleManualCodeEntry(context, code);
  } catch (error) {
    vscode.window.showErrorMessage(`Authentication callback failed: ${error}`);
  }
}

/**
 * Handle manual code entry for authentication
 */
export async function handleManualCodeEntry(context: vscode.ExtensionContext, code: string): Promise<void> {
  try {
    const { exchangeCodeForToken, setTokens } = await import('../utils/tokenStorage');
    
    vscode.window.showInformationMessage('Exchanging code for tokens...');
    
    const tokenData = await exchangeCodeForToken(code);
    await setTokens(context, tokenData);
    
    vscode.window.showInformationMessage('Successfully authenticated with ClickUp!');
  } catch (error) {
    vscode.window.showErrorMessage(`Authentication failed: ${error}`);
  }
}

/**
 * Logout and clear authentication state
 */
export async function logout(context: vscode.ExtensionContext) {
  await deleteTokens(context);
  vscode.window.showInformationMessage('Logged out successfully');
}

/**
 * Check if user is authenticated
 */
export async function checkAuth(context: vscode.ExtensionContext): Promise<boolean> {
  const token = await getAccessToken(context);
  return !!token;
}

/**
 * Get current authentication state
 */
export async function useAuth(context: vscode.ExtensionContext): Promise<{ isAuthenticated: boolean }> {
  const token = await getAccessToken(context);
  return { isAuthenticated: !!token };
}