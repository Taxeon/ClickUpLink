// useApi.ts
// API operations hook with OAuth2 support

import * as vscode from 'vscode';
import { getAccessToken } from '../utils/tokenStorage';
import { checkAuth } from './useAuth';
import { httpClient } from '../utils/httpClient';

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
  console.log(`🌐 API Request: ${method.toUpperCase()} /${endpoint}`, body ? { body } : '');
  
  // Ensure user is authenticated
  const isAuthenticated = await checkAuth(context);
  if (!isAuthenticated) {
    console.log('❌ API Request failed: Not authenticated');
    vscode.window.showErrorMessage('Not authenticated with ClickUp. Please login first.');
    return;
  }

  const accessToken = await getAccessToken(context);
  if (!accessToken) {
    console.log('❌ API Request failed: No access token');
    vscode.window.showErrorMessage('ClickUp access token not found. Please login again.');
    return;
  }

  try {
    const response = await httpClient.request(`${CLICKUP_API_BASE_URL}/${endpoint}`, {
      method: method.toUpperCase() as any,
      data: body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`✅ API Response: ${method.toUpperCase()} /${endpoint}`, { 
      status: response.status, 
      dataType: typeof response.data,
      hasData: !!response.data 
    });
    
    return response.data;
  } catch (error: any) {
    console.error(`❌ API Request failed: ${method.toUpperCase()} /${endpoint}`, error);
    
    // If we get a 401 Unauthorized error, the token might be expired
    if (error.message?.includes('HTTP 401')) {
      console.log('🔑 Token appears to be expired');
      vscode.window.showErrorMessage('Your ClickUp session has expired. Please login again.');
      return null;
    }
    
    const errorMessage = error.message || 'An unknown API error occurred.';
    console.error('🔧 Full error details:', error);
    vscode.window.showErrorMessage(`ClickUp API Error: ${errorMessage}`);
    
    // Return null instead of undefined to be explicit about failure
    return null;
  }
}