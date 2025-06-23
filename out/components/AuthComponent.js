"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthComponent = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const tokenStorage_1 = require("../utils/tokenStorage");
const authState_1 = require("../state/authState");
class AuthComponent {
    constructor(context) {
        this.context = context;
    }
    static getInstance(context) {
        if (!AuthComponent.instance) {
            AuthComponent.instance = new AuthComponent(context);
        }
        return AuthComponent.instance;
    }
    /**
     * Initiates the OAuth2 authentication flow
     */
    async startAuthFlow() {
        const { clientId, redirectUri } = (0, tokenStorage_1.getOAuthClientInfo)();
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
    async handleAuthCallback(uri) {
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
        }
        catch (error) {
            console.error('Authentication error:', error);
            vscode.window.showErrorMessage('Authentication failed: Could not retrieve tokens');
        }
    }
    /**
     * Handles manual code entry without state parameter verification
     */
    async handleManualCodeEntry(code) {
        if (!code) {
            vscode.window.showErrorMessage('Authentication failed: No code provided');
            return;
        }
        try {
            const tokens = await this.exchangeCodeForTokens(code);
            const user = await this.fetchUserProfile(tokens.access_token);
            // Update state and storage
            await this.setAuthenticatedState(tokens, user);
            vscode.window.showInformationMessage(`Successfully logged in as ${user.username}`);
        }
        catch (error) {
            console.error('Authentication error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Could not retrieve tokens';
            vscode.window.showErrorMessage(`Authentication failed: ${errorMessage}`);
        }
    }
    /**
     * Exchange the authorization code for access and refresh tokens using our secure backend service
     */ async exchangeCodeForTokens(code) {
        // Check if auth service is available
        const isServiceAvailable = await (0, tokenStorage_1.validateAuthService)();
        if (!isServiceAvailable) {
            throw new Error('Authentication service is not available. Please try again later.');
        }
        // Exchange code for tokens using our secure backend service
        const tokenData = await (0, tokenStorage_1.exchangeCodeForToken)(code);
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
    async refreshAccessToken() {
        const tokenData = await (0, tokenStorage_1.getTokenData)(this.context);
        if (!tokenData?.refreshToken) {
            return false;
        }
        try {
            // Check if auth service is available
            const isServiceAvailable = await (0, tokenStorage_1.validateAuthService)();
            if (!isServiceAvailable) {
                throw new Error('Authentication service is not available');
            }
            // Use our secure backend service to refresh the token
            const newTokenData = await (0, tokenStorage_1.refreshAccessToken)(tokenData.refreshToken);
            // Store the new tokens
            await (0, tokenStorage_1.setTokens)(this.context, newTokenData);
            // Update application state
            (0, authState_1.setAuthState)({
                accessToken: newTokenData.accessToken,
                refreshToken: newTokenData.refreshToken,
                tokenExpiry: newTokenData.expiresAt
            });
            return true;
        }
        catch (error) {
            console.error('Token refresh failed:', error);
            return false;
        }
    }
    /**
     * Fetch the user profile using the access token
     */
    async fetchUserProfile(accessToken) {
        const response = await axios_1.default.get('https://api.clickup.com/api/v2/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data.user;
    }
    /**
     * Set the authenticated state after successful login
     */
    async setAuthenticatedState(tokens, user) {
        const expiresAt = Date.now() + tokens.expires_in * 1000;
        // Store tokens in secure storage
        await (0, tokenStorage_1.setTokens)(this.context, {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt
        });
        // Update application state
        (0, authState_1.setAuthState)({
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
    async checkAuthStatus() {
        const tokenData = await (0, tokenStorage_1.getTokenData)(this.context);
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
            (0, authState_1.setAuthState)({
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
        }
        catch (error) {
            // Token might be invalid, try to refresh
            return await this.refreshAccessToken();
        }
    }
    /**
     * Log out the user
     */
    async logout() {
        await (0, tokenStorage_1.deleteTokens)(this.context);
        (0, authState_1.setAuthState)({
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            user: undefined
        });
        vscode.window.showInformationMessage('Successfully logged out');
    }
}
exports.AuthComponent = AuthComponent;
//# sourceMappingURL=AuthComponent.js.map