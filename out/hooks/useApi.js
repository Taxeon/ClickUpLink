"use strict";
// useApi.ts
// API operations hook with OAuth2 support
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
exports.apiRequest = void 0;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
const tokenStorage_1 = require("../utils/tokenStorage");
const AuthComponent_1 = require("../components/AuthComponent");
const useAuth_1 = require("./useAuth");
const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2';
/**
 * Make an authenticated API request to ClickUp
 */
async function apiRequest(context, method, endpoint, body) {
    // Ensure user is authenticated
    const isAuthenticated = await (0, useAuth_1.checkAuth)(context);
    if (!isAuthenticated) {
        vscode.window.showErrorMessage('Not authenticated with ClickUp. Please login first.');
        return;
    }
    const accessToken = await (0, tokenStorage_1.getAccessToken)(context);
    if (!accessToken) {
        vscode.window.showErrorMessage('ClickUp access token not found. Please login again.');
        return;
    }
    try {
        const response = await (0, axios_1.default)({
            method,
            url: `${CLICKUP_API_BASE_URL}/${endpoint}`,
            data: body,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    }
    catch (error) {
        // If we get a 401 Unauthorized error, the token might be expired
        if (error.response?.status === 401) {
            // Try to refresh the token
            const authComponent = AuthComponent_1.AuthComponent.getInstance(context);
            const refreshed = await authComponent.refreshAccessToken();
            if (refreshed) {
                // Retry the request with the new token
                return apiRequest(context, method, endpoint, body);
            }
            else {
                vscode.window.showErrorMessage('Your ClickUp session has expired. Please login again.');
            }
        }
        const errorMessage = error.response?.data?.err || error.message || 'An unknown API error occurred.';
        vscode.window.showErrorMessage(`ClickUp API Error: ${errorMessage}`);
        console.error(error);
    }
}
exports.apiRequest = apiRequest;
//# sourceMappingURL=useApi.js.map