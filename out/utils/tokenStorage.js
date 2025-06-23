"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshAccessToken = exports.exchangeCodeForToken = exports.validateAuthService = exports.getOAuthClientInfo = exports.getTokenData = exports.deleteTokens = exports.getTokenExpiry = exports.getRefreshToken = exports.getAccessToken = exports.setTokens = void 0;
const axios_1 = __importDefault(require("axios"));
const ACCESS_TOKEN_KEY = 'clickupAccessToken';
const REFRESH_TOKEN_KEY = 'clickupRefreshToken';
const TOKEN_EXPIRY_KEY = 'clickupTokenExpiry';
const CLIENT_ID = 'N2QC5GLR8EEIRPSBAPGF4HX9QXLG7CBC';
// Auth service URL - change this to your deployed service URL
const AUTH_SERVICE_URL = 'https://clickuplink.netlify.app';
async function setTokens(context, tokenData) {
    await context.secrets.store(ACCESS_TOKEN_KEY, tokenData.accessToken);
    await context.secrets.store(REFRESH_TOKEN_KEY, tokenData.refreshToken);
    await context.secrets.store(TOKEN_EXPIRY_KEY, tokenData.expiresAt.toString());
}
exports.setTokens = setTokens;
async function getAccessToken(context) {
    return await context.secrets.get(ACCESS_TOKEN_KEY);
}
exports.getAccessToken = getAccessToken;
async function getRefreshToken(context) {
    return await context.secrets.get(REFRESH_TOKEN_KEY);
}
exports.getRefreshToken = getRefreshToken;
async function getTokenExpiry(context) {
    const expiryStr = await context.secrets.get(TOKEN_EXPIRY_KEY);
    return expiryStr ? parseInt(expiryStr, 10) : undefined;
}
exports.getTokenExpiry = getTokenExpiry;
async function deleteTokens(context) {
    await context.secrets.delete(ACCESS_TOKEN_KEY);
    await context.secrets.delete(REFRESH_TOKEN_KEY);
    await context.secrets.delete(TOKEN_EXPIRY_KEY);
}
exports.deleteTokens = deleteTokens;
async function getTokenData(context) {
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
exports.getTokenData = getTokenData;
/**
 * Securely handles OAuth client information using a proxy service approach.
 * The client secret is managed by a secure backend service.
 */
function getOAuthClientInfo() {
    // Use the Netlify deployment URL
    const redirectUri = 'https://clickuplink.netlify.app/oauth/callback';
    // const redirectUri = 'clickuplink://auth';
    return {
        clientId: CLIENT_ID,
        redirectUri: redirectUri,
        authServiceUrl: AUTH_SERVICE_URL
    };
}
exports.getOAuthClientInfo = getOAuthClientInfo;
/**
 * Validates the connection to the auth service
 * @returns Promise<boolean> True if the service is reachable
 */
async function validateAuthService() {
    try {
        const response = await axios_1.default.get(`${AUTH_SERVICE_URL}/health`);
        return response.data.status === 'ok';
    }
    catch (error) {
        console.error('Auth service is not reachable:', error);
        return false;
    }
}
exports.validateAuthService = validateAuthService;
/**
 * This function handles the token exchange through a secure proxy service
 * rather than exposing the client secret in the extension code.
 *
 * @param code The authorization code received from ClickUp
 * @returns Promise<TokenData> The token data from the exchange
 */
async function exchangeCodeForToken(code) {
    try {
        // Use the secure backend service to exchange the code for tokens
        const response = await axios_1.default.post(`${AUTH_SERVICE_URL}/api/token-exchange`, {
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
            refreshToken: refresh_token || 'no-refresh-token-provided',
            expiresAt: Date.now() + (expires_in * 1000)
        };
    }
    catch (error) {
        console.error('Error exchanging code for token:', error);
        if (axios_1.default.isAxiosError(error) && error.response) {
            throw new Error(`Failed to exchange code for token: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error('Failed to exchange code for token: Network error');
    }
}
exports.exchangeCodeForToken = exchangeCodeForToken;
/**
 * Refreshes the access token using the refresh token
 *
 * @param refreshToken The refresh token
 * @returns Promise<TokenData> The new token data
 */
async function refreshAccessToken(refreshToken) {
    // Check if we have a valid refresh token
    if (!refreshToken || refreshToken === 'no-refresh-token-provided') {
        throw new Error('No valid refresh token available');
    }
    try {
        // Use the secure backend service to refresh the token
        const response = await axios_1.default.post(`${AUTH_SERVICE_URL}/api/token-refresh`, {
            refreshToken
        });
        // Extract with defaults for missing fields
        const access_token = response.data.access_token;
        const refresh_token = response.data.refresh_token || refreshToken; // Use original if not returned
        const expires_in = response.data.expires_in || 3600; // Default to 1 hour
        if (!access_token) {
            throw new Error('Access token missing in refresh response');
        }
        return {
            accessToken: access_token,
            refreshToken: refresh_token || refreshToken,
            expiresAt: Date.now() + (expires_in * 1000)
        };
    }
    catch (error) {
        console.error('Error refreshing token:', error);
        if (axios_1.default.isAxiosError(error) && error.response) {
            throw new Error(`Failed to refresh token: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error('Failed to refresh token: Network error');
    }
}
exports.refreshAccessToken = refreshAccessToken;
//# sourceMappingURL=tokenStorage.js.map