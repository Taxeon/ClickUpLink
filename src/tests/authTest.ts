import * as vscode from 'vscode';
import { AuthComponent } from '../components/AuthComponent';
import { validateAuthService, exchangeCodeForToken, refreshAccessToken } from '../utils/tokenStorage';

/**
 * This test file helps verify the OAuth2 authentication flow with our secure backend.
 * Run these tests manually to ensure everything works correctly.
 */

export async function testOAuthFlow(context: vscode.ExtensionContext): Promise<void> {
  // Step 1: Test connection to auth service
  console.log('Testing connection to authentication service...');
  const isServiceAvailable = await validateAuthService();
  console.log(`Auth service available: ${isServiceAvailable}`);
  
  if (!isServiceAvailable) {
    vscode.window.showErrorMessage('Authentication service is not available. Deployment may be needed.');
    return;
  }
  
  // Step 2: Start authentication flow
  console.log('Starting authentication flow...');
  const authComponent = AuthComponent.getInstance(context);
  await authComponent.startAuthFlow();
  
  // Step 3: We need to wait for user to complete auth in browser
  // This will be handled by the URI handler registered in extension.ts
  vscode.window.showInformationMessage(
    'Please complete the authentication in your browser and return to VS Code.'
  );
}

/**
 * This function would be called by your URI handler after receiving the auth code
 */
export async function testAuthCallback(context: vscode.ExtensionContext, uri: vscode.Uri): Promise<void> {
  console.log('Handling auth callback...');
  const authComponent = AuthComponent.getInstance(context);
  await authComponent.handleAuthCallback(uri);
  
  // Verify we have valid tokens
  const isAuthenticated = await authComponent.checkAuthStatus();
  console.log(`Authentication status: ${isAuthenticated}`);
  
  if (isAuthenticated) {
    vscode.window.showInformationMessage('Authentication successful! You are now logged in to ClickUp.');
  } else {
    vscode.window.showErrorMessage('Authentication failed. Please check the logs for more details.');
  }
}

/**
 * Test token refresh flow
 */
export async function testTokenRefresh(context: vscode.ExtensionContext): Promise<void> {
  console.log('Testing token refresh...');
  const authComponent = AuthComponent.getInstance(context);
  const refreshResult = await authComponent.refreshAccessToken();
  
  console.log(`Token refresh result: ${refreshResult}`);
  
  if (refreshResult) {
    vscode.window.showInformationMessage('Token refresh successful!');
  } else {
    vscode.window.showErrorMessage('Token refresh failed. See logs for details.');
  }
}
