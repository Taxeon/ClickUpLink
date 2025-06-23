"use strict";
// useAuth.ts
// Authentication hook with OAuth2 support
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuth = exports.checkAuth = exports.logout = exports.handleManualCodeEntry = exports.handleAuthCallback = exports.startAuth = void 0;
const authState_1 = require("../state/authState");
const AuthComponent_1 = require("../components/AuthComponent");
/**
 * Start the OAuth2 authentication flow
 */
async function startAuth(context) {
    const authComponent = AuthComponent_1.AuthComponent.getInstance(context);
    await authComponent.startAuthFlow();
}
exports.startAuth = startAuth;
/**
 * Handle the OAuth2 callback
 */
async function handleAuthCallback(context, uri) {
    const authComponent = AuthComponent_1.AuthComponent.getInstance(context);
    await authComponent.handleAuthCallback(uri);
}
exports.handleAuthCallback = handleAuthCallback;
/**
 * Handle manual code entry for authentication
 */
async function handleManualCodeEntry(context, code) {
    const authComponent = AuthComponent_1.AuthComponent.getInstance(context);
    await authComponent.handleManualCodeEntry(code);
}
exports.handleManualCodeEntry = handleManualCodeEntry;
/**
 * Logout and clear authentication state
 */
async function logout(context) {
    const authComponent = AuthComponent_1.AuthComponent.getInstance(context);
    await authComponent.logout();
}
exports.logout = logout;
/**
 * Check if user is authenticated
 */
async function checkAuth(context) {
    const authComponent = AuthComponent_1.AuthComponent.getInstance(context);
    return await authComponent.checkAuthStatus();
}
exports.checkAuth = checkAuth;
/**
 * Get current authentication state
 */
function useAuth() {
    return (0, authState_1.getAuthState)();
}
exports.useAuth = useAuth;
//# sourceMappingURL=useAuth.js.map