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
exports.isTestMode = exports.enableTestMode = void 0;
const vscode = __importStar(require("vscode"));
const authState_1 = require("../state/authState");
const tokenStorage_1 = require("./tokenStorage");
/**
 * Enable test mode for Phase 2 testing without backend OAuth
 */
async function enableTestMode(context) {
    // Set mock authentication state
    (0, authState_1.setAuthState)({
        isAuthenticated: true,
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        tokenExpiry: Date.now() + (3600 * 1000),
        user: {
            id: 'test_user_id',
            name: 'Test User',
            email: 'test@example.com'
        }
    });
    // Store mock tokens
    await (0, tokenStorage_1.setTokens)(context, {
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        expiresAt: Date.now() + (3600 * 1000)
    });
    vscode.window.showInformationMessage('Test mode enabled for Phase 2 testing!');
}
exports.enableTestMode = enableTestMode;
/**
 * Check if test mode is enabled
 */
function isTestMode() {
    return vscode.workspace.getConfiguration('clickupLink').get('testMode', false);
}
exports.isTestMode = isTestMode;
//# sourceMappingURL=testMode.js.map