import * as vscode from 'vscode';
import axios from 'axios';
import { AuthState, OAuthTokenResponse, ClickUpUser } from '../types';
import { getOAuthClientInfo, setTokens, getTokenData, deleteTokens, exchangeCodeForToken, refreshAccessToken, validateAuthService } from '../utils/tokenStorage';
import { setAuthState } from '../state/authState';

export class AuthComponent {
  private readonly context: vscode.ExtensionContext;
  private static instance: AuthComponent;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  static getInstance(context: vscode.ExtensionContext): AuthComponent {
    if (!AuthComponent.instance) {
      AuthComponent.instance = new AuthComponent(context);
    }
    return AuthComponent.instance;
  }
  /**
   * Initiates the OAuth2 authentication flow
   */
  public async startAuthFlow(): Promise<void> {    const { clientId, redirectUri } = getOAuthClientInfo();
    
    // Generate a state parameter to prevent CSRF attacks
    const state = Math.random().toString(36).substring(2, 15);
    await this.context.secrets.store('oauth_state', state);
      // Construct the authorization URL with proper encoding and parameters
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodedRedirectUri}&response_type=code&state=${state}`;
    
    // Debug: Log the exact URLs being used
    console.log('=== DEBUG OAuth URLs ===');
    console.log('Client ID:', clientId);
    console.log('Redirect URI (raw):', redirectUri);
    console.log('Redirect URI (encoded):', encodedRedirectUri);
    console.log('Full OAuth URL:', authUrl);
    console.log('========================');
    
    // Show user the redirect URI being used
    vscode.window.showInformationMessage(`Using redirect URI: ${redirectUri}`);
    
    // Open the browser for the user to authenticate
    vscode.env.openExternal(vscode.Uri.parse(authUrl));
    
    vscode.window.showInformationMessage('Please complete authentication in your browser.');
  }

  /**
   * Handles the OAuth2 callback with the authorization code
   */
  public async handleAuthCallback(uri: vscode.Uri): Promise<void> {
    const query = new URLSearchParams(uri.query);
    const code = query.get('code');
    const state = query.get('state');
    
    // Verify state parameter to prevent CSRF attacks
    const savedState = await this.context.secrets.get('oauth_state');
    if (!code || state !== savedState) {
      vscode.window.showErrorMessage('Authentication failed: Invalid state parameter');
      return;
    }
    
    try {
      const tokens = await this.exchangeCodeForTokens(code);
      const user = await this.fetchUserProfile(tokens.access_token);
      
      // Update state and storage
      await this.setAuthenticatedState(tokens, user);
      vscode.window.showInformationMessage(`Successfully logged in as ${user.username}`);
    } catch (error) {
      console.error('Authentication error:', error);
      vscode.window.showErrorMessage('Authentication failed: Could not retrieve tokens');
    }
  }

  /**
   * Handles manual code entry without state parameter verification
   */
  public async handleManualCodeEntry(code: string): Promise<void> {
    if (!code) {
      vscode.window.showErrorMessage('Authentication failed: No code provided');
      return;
    }
    
    try {
      const tokens = await this.exchangeCodeForTokens(code);
      const user = await this.fetchUserProfile(tokens.access_token);
      
      // Update state and storage
      await this.setAuthenticatedState(tokens, user);
      vscode.window.showInformationMessage(`Successfully logged in as ${user.username}`);    } catch (error) {
      console.error('Authentication error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Could not retrieve tokens';
      vscode.window.showErrorMessage(`Authentication failed: ${errorMessage}`);
    }
  }

  /**
   * Exchange the authorization code for access and refresh tokens using our secure backend service
   */  private async exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
    // Check if auth service is available
    const isServiceAvailable = await validateAuthService();
    if (!isServiceAvailable) {
      throw new Error('Authentication service is not available. Please try again later.');
    }

    // Exchange code for tokens using our secure backend service
    const tokenData = await exchangeCodeForToken(code);
    
    return {
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
      expires_in: Math.floor((tokenData.expiresAt - Date.now()) / 1000),
      token_type: 'Bearer'
    };
  }
  /**
   * Refresh the access token using the refresh token via our secure backend service
   */
  public async refreshAccessToken(): Promise<boolean> {
    const tokenData = await getTokenData(this.context);
    if (!tokenData?.refreshToken) {
      return false;
    }

    try {
      // Check if auth service is available
      const isServiceAvailable = await validateAuthService();
      if (!isServiceAvailable) {
        throw new Error('Authentication service is not available');
      }

      // Use our secure backend service to refresh the token
      const newTokenData = await refreshAccessToken(tokenData.refreshToken);
      
      // Store the new tokens
      await setTokens(this.context, newTokenData);
      
      // Update application state
      setAuthState({
        accessToken: newTokenData.accessToken,
        refreshToken: newTokenData.refreshToken,
        tokenExpiry: newTokenData.expiresAt
      });
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Fetch the user profile using the access token
   */
  private async fetchUserProfile(accessToken: string): Promise<ClickUpUser> {
    const response = await axios.get('https://api.clickup.com/api/v2/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    return response.data.user;
  }

  /**
   * Set the authenticated state after successful login
   */
  private async setAuthenticatedState(tokens: OAuthTokenResponse, user: ClickUpUser): Promise<void> {
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    
    // Store tokens in secure storage
    await setTokens(this.context, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    });
    
    // Update application state
    setAuthState({
      isAuthenticated: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: expiresAt,
      user: {
        id: user.id,
        name: user.username,
        email: user.email
      }
    });
  }

  /**
   * Check if the user is authenticated and tokens are valid
   */
  public async checkAuthStatus(): Promise<boolean> {
    const tokenData = await getTokenData(this.context);
    
    if (!tokenData) {
      return false;
    }
    
    // Check if token is expired or about to expire (within 5 minutes)
    if (tokenData.expiresAt < Date.now() + 5 * 60 * 1000) {
      // Try to refresh the token
      return await this.refreshAccessToken();
    }
    
    try {
      // Verify token by fetching user data
      const user = await this.fetchUserProfile(tokenData.accessToken);
      
      setAuthState({
        isAuthenticated: true,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        tokenExpiry: tokenData.expiresAt,
        user: {
          id: user.id,
          name: user.username,
          email: user.email
        }
      });
      
      return true;
    } catch (error) {
      // Token might be invalid, try to refresh
      return await this.refreshAccessToken();
    }
  }

  /**
   * Log out the user
   */
  public async logout(): Promise<void> {
    await deleteTokens(this.context);
    setAuthState({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      user: undefined
    });
    vscode.window.showInformationMessage('Successfully logged out');
  }
}
