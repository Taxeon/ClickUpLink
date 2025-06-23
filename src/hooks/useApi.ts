// useApi.ts
// API operations hook with OAuth2 support

import axios from 'axios';
import * as vscode from 'vscode';
import { getAccessToken } from '../utils/tokenStorage';
import { AuthComponent } from '../components/AuthComponent';
import { checkAuth } from './useAuth';

const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2';

/**
 * Make an authenticated API request to ClickUp
 */
export async function apiRequest(
  context: vscode.ExtensionContext,
  method: 'get' | 'post' | 'put' | 'delete',
  endpoint: string,
  body?: any
): Promise<any> {
  // Ensure user is authenticated
  const isAuthenticated = await checkAuth(context);
  if (!isAuthenticated) {
    vscode.window.showErrorMessage('Not authenticated with ClickUp. Please login first.');
    return;
  }

  const accessToken = await getAccessToken(context);
  if (!accessToken) {
    vscode.window.showErrorMessage('ClickUp access token not found. Please login again.');
    return;
  }

  try {
    const response = await axios({
      method,
      url: `${CLICKUP_API_BASE_URL}/${endpoint}`,
      data: body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error: any) {
    // If we get a 401 Unauthorized error, the token might be expired
    if (error.response?.status === 401) {
      // Try to refresh the token
      const authComponent = AuthComponent.getInstance(context);
      const refreshed = await authComponent.refreshAccessToken();
      
      if (refreshed) {
        // Retry the request with the new token
        return apiRequest(context, method, endpoint, body);
      } else {
        vscode.window.showErrorMessage('Your ClickUp session has expired. Please login again.');
      }
    }
    
    const errorMessage = error.response?.data?.err || error.message || 'An unknown API error occurred.';
    vscode.window.showErrorMessage(`ClickUp API Error: ${errorMessage}`);
    console.error(error);
  }
}