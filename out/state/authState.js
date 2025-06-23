"use strict";
// authState.ts
// Authentication state management 
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAuthState = exports.getAuthState = exports.setAuthState = void 0;
const appState_1 = require("./appState");
function setAuthState(auth) {
    const current = appState_1.appState.getState().auth;
    appState_1.appState.setState({ auth: { ...current, ...auth } });
}
exports.setAuthState = setAuthState;
function getAuthState() {
    return appState_1.appState.getState().auth;
}
exports.getAuthState = getAuthState;
function clearAuthState() {
    setAuthState({
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        user: undefined
    });
}
exports.clearAuthState = clearAuthState;
//# sourceMappingURL=authState.js.map