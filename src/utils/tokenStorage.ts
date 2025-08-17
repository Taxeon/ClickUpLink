import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { httpClient } from './httpClient';

const ACCESS_TOKEN_KEY = 'clickupAccessToken';
const REFRESH_TOKEN_KEY = 'clickupRefreshToken';
const TOKEN_EXPIRY_KEY = 'clickupTokenExpiry';
const CLIENT_ID = 'N2QC5GLR8EEIRPSBAPGF4HX9QXLG7CBC';
// Auth service URL - change this to your deployed service URL
const AUTH_SERVICE_URL = 'https://clickuplink.netlify.app';

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Timestamp when the token expires
}

export async function setTokens(context: vscode.ExtensionContext, tokenData: TokenData) {
  await context.secrets.store(ACCESS_TOKEN_KEY, tokenData.accessToken);
  await context.secrets.store(REFRESH_TOKEN_KEY, tokenData.refreshToken);
  await context.secrets.store(TOKEN_EXPIRY_KEY, tokenData.expiresAt.toString());
}

export async function getAccessToken(context: vscode.ExtensionContext): Promise<string | undefined> {
  return await context.secrets.get(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(context: vscode.ExtensionContext): Promise<string | undefined> {
  return await context.secrets.get(REFRESH_TOKEN_KEY);
}

export async function getTokenExpiry(context: vscode.ExtensionContext): Promise<number | undefined> {
  const expiryStr = await context.secrets.get(TOKEN_EXPIRY_KEY);
  return expiryStr ? parseInt(expiryStr, 10) : undefined;
}

export async function deleteTokens(context: vscode.ExtensionContext) {
  await context.secrets.delete(ACCESS_TOKEN_KEY);
  await context.secrets.delete(REFRESH_TOKEN_KEY);
  await context.secrets.delete(TOKEN_EXPIRY_KEY);
}

export async function getTokenData(context: vscode.ExtensionContext): Promise<TokenData | undefined> {
  const accessToken = await getAccessToken(context);
  const refreshToken = await getRefreshToken(context);
  const expiresAt = await getTokenExpiry(context);
  
  if (!accessToken || !refreshToken || !expiresAt) {
    return undefined;
  }
  
  return {
    accessToken,
    refreshToken,
    expiresAt
  };
}

/**
 * Securely handles OAuth client information using a proxy service approach.
 * The client secret is managed by a secure backend service.
 */
export function getOAuthClientInfo() {
  // Use the Netlify deployment URL
  const redirectUri = 'https://clickuplink.netlify.app/oauth/callback';
  // const redirectUri = 'clickuplink://auth';
  
  return {
    clientId: CLIENT_ID,
    redirectUri: redirectUri,
    authServiceUrl: AUTH_SERVICE_URL
  };
}

/**
 * Validates the connection to the auth service
 * @returns Promise<boolean> True if the service is reachable
 */
export async function validateAuthService(): Promise<boolean> {
  try {
    const response = await httpClient.get(`${AUTH_SERVICE_URL}/health`);
    return response.data.status === 'ok';
  } catch (error) {
    console.error('Auth service is not reachable:', error);
    return false;
  }
}

/**
 * This function handles the token exchange through a secure proxy service
 * rather than exposing the client secret in the extension code.
 * 
 * @param code The authorization code received from ClickUp
 * @returns Promise<TokenData> The token data from the exchange
 */
export async function exchangeCodeForToken(code: string): Promise<TokenData> {
  try {
    // Use the secure backend service to exchange the code for tokens
    const response = await httpClient.post(`${AUTH_SERVICE_URL}/api/token-exchange`, {
      code,
      redirectUri: 'https://clickuplink.netlify.app/oauth/callback' // Use the Netlify deployment
    });
    
    // Extract with defaults for missing fields
    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token || null;
    const expires_in = response.data.expires_in || 3600; // Default to 1 hour if not provided
    
    if (!access_token) {
      throw new Error('Access token missing in response');
    }
    
    return {
      accessToken: access_token,
      refreshToken: refresh_token || 'no-refresh-token-provided', // Use a placeholder if missing
      expiresAt: Date.now() + (expires_in * 1000)
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    if (error instanceof Error && error.message.includes('HTTP')) {
      throw new Error(`Failed to exchange code for token: ${error.message}`);
    }
    throw new Error('Failed to exchange code for token: Network error');
  }
}

/**
 * Refreshes the access token using the refresh token
 * 
 * @param refreshToken The refresh token
 * @returns Promise<TokenData> The new token data
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  // Check if we have a valid refresh token
  if (!refreshToken || refreshToken === 'no-refresh-token-provided') {
    throw new Error('No valid refresh token available');
  }
  
  try {
    console.log(`🔄 Refreshing token using refresh token (first 5 chars: ${refreshToken.substring(0, 5)}...)`);
    
    // First check if auth service is available
    try {
      await validateAuthService();
    } catch (healthCheckError) {
      console.error('❌ Auth service health check failed:', healthCheckError);
      throw new Error('Authentication service is currently unavailable');
    }
    
    // Use the secure backend service to refresh the token
    const response = await httpClient.post(`${AUTH_SERVICE_URL}/api/token-refresh`, {
      refreshToken
    });

    console.log('✅ Refresh token response received', {
      status: response.status,
      hasData: !!response.data,
      hasAccessToken: !!response.data.access_token
    });

    // Extract with defaults for missing fields
    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token || refreshToken; // Use original if not returned
    const expires_in = response.data.expires_in || 3600; // Default to 1 hour
    
    if (!access_token) {
      console.error('❌ Access token missing in refresh response:', response.data);
      throw new Error(`Access token missing in refresh response: ${JSON.stringify(response.data)}`);
    }
    
    console.log('✅ Successfully refreshed token with expiry in', expires_in, 'seconds');
    
    return {
      accessToken: access_token,
      refreshToken: refresh_token || refreshToken, // Some OAuth providers don't return a new refresh token
      expiresAt: Date.now() + (expires_in * 1000)
    };
  } catch (error: any) {
    console.error('❌ Error refreshing token:', error);
    
    // Enhanced error information for debugging
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('Response error details:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
      
      const serverErrorMessage = error.response.data?.error || error.response.data?.message || 'Unknown server error';
      throw new Error(`Failed to refresh token (${error.response.status}): ${serverErrorMessage}`);
    } 
    else if (error.request) {
      // The request was made but no response was received
      console.error('No response received for refresh token request');
      throw new Error('Failed to refresh token: No response from authentication server');
    } 
    else {
      // Something happened in setting up the request
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }
}