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
Object.defineProperty(exports, "__esModule", { value: true });
exports.testTokenRefresh = exports.testAuthCallback = exports.testOAuthFlow = void 0;
const vscode = __importStar(require("vscode"));
const AuthComponent_1 = require("../components/AuthComponent");
const tokenStorage_1 = require("../utils/tokenStorage");
/**
 * This test file helps verify the OAuth2 authentication flow with our secure backend.
 * Run these tests manually to ensure everything works correctly.
 */
async function testOAuthFlow(context) {
    // Step 1: Test connection to auth service
    console.log('Testing connection to authentication service...');
    const isServiceAvailable = await (0, tokenStorage_1.validateAuthService)();
    console.log(`Auth service available: ${isServiceAvailable}`);
    if (!isServiceAvailable) {
        vscode.window.showErrorMessage('Authentication service is not available. Deployment may be needed.');
        return;
    }
    // Step 2: Start authentication flow
    console.log('Starting authentication flow...');
    const authComponent = AuthComponent_1.AuthComponent.getInstance(context);
    await authComponent.startAuthFlow();
    // Step 3: We need to wait for user to complete auth in browser
    // This will be handled by the URI handler registered in extension.ts
    vscode.window.showInformationMessage('Please complete the authentication in your browser and return to VS Code.');
}
exports.testOAuthFlow = testOAuthFlow;
/**
 * This function would be called by your URI handler after receiving the auth code
 */
async function testAuthCallback(context, uri) {
    console.log('Handling auth callback...');
    const authComponent = AuthComponent_1.AuthComponent.getInstance(context);
    await authComponent.handleAuthCallback(uri);
    // Verify we have valid tokens
    const isAuthenticated = await authComponent.checkAuthStatus();
    console.log(`Authentication status: ${isAuthenticated}`);
    if (isAuthenticated) {
        vscode.window.showInformationMessage('Authentication successful! You are now logged in to ClickUp.');
    }
    else {
        vscode.window.showErrorMessage('Authentication failed. Please check the logs for more details.');
    }
}
exports.testAuthCallback = testAuthCallback;
/**
 * Test token refresh flow
 */
async function testTokenRefresh(context) {
    console.log('Testing token refresh...');
    const authComponent = AuthComponent_1.AuthComponent.getInstance(context);
    const refreshResult = await authComponent.refreshAccessToken();
    console.log(`Token refresh result: ${refreshResult}`);
    if (refreshResult) {
        vscode.window.showInformationMessage('Token refresh successful!');
    }
    else {
        vscode.window.showErrorMessage('Token refresh failed. See logs for details.');
    }
}
exports.testTokenRefresh = testTokenRefresh;
//# sourceMappingURL=authTest.js.map