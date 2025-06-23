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
exports.testPhase2Cache = void 0;
const vscode = __importStar(require("vscode"));
const useAuth_1 = require("../hooks/useAuth");
const useCache_1 = require("../hooks/useCache");
/**
 * Test function for Phase 2 cache functionality
 * This demonstrates the cache system working:
 * 1. Fetch projects (first time will be from API)
 * 2. Fetch projects again (should be from cache)
 * 3. Invalidate cache
 * 4. Fetch again (should be from API)
 */
async function testPhase2Cache(context) {
    // Step 1: Check if authenticated
    console.log('Checking authentication status...');
    const isAuthenticated = await (0, useAuth_1.checkAuth)(context);
    if (!isAuthenticated) {
        vscode.window.showInformationMessage('Please login to ClickUp first using the "ClickUp: Start Authentication" command');
        return;
    }
    vscode.window.showInformationMessage('Starting Phase 2 cache test...');
    try {
        // Get cache provider
        const cache = (0, useCache_1.useCache)(context);
        // Step 2: First fetch projects (from API)
        console.log('Fetching projects from API...');
        const startTime1 = Date.now();
        const projects1 = await cache.getProjects();
        const duration1 = Date.now() - startTime1;
        vscode.window.showInformationMessage(`First fetch: ${projects1.length} projects loaded in ${duration1}ms`);
        // Step 3: Second fetch projects (from cache)
        console.log('Fetching projects from cache...');
        const startTime2 = Date.now();
        const projects2 = await cache.getProjects();
        const duration2 = Date.now() - startTime2;
        vscode.window.showInformationMessage(`Second fetch (cached): ${projects2.length} projects loaded in ${duration2}ms`);
        // Step 4: Invalidate cache
        console.log('Invalidating projects cache...');
        cache.invalidateProjects();
        vscode.window.showInformationMessage('Cache invalidated');
        // Step 5: Third fetch projects (from API again)
        console.log('Fetching projects from API after invalidation...');
        const startTime3 = Date.now();
        const projects3 = await cache.getProjects();
        const duration3 = Date.now() - startTime3;
        vscode.window.showInformationMessage(`Third fetch (after invalidation): ${projects3.length} projects loaded in ${duration3}ms`);
        // Show summary
        vscode.window.showInformationMessage(`Cache test summary:\n` +
            `- First fetch (API): ${duration1}ms\n` +
            `- Second fetch (cached): ${duration2}ms\n` +
            `- Third fetch (API after invalidation): ${duration3}ms`);
        vscode.window.showInformationMessage('Phase 2 cache test completed successfully!');
    }
    catch (error) {
        console.error('Error during cache test:', error);
        vscode.window.showErrorMessage(`Cache test failed: ${error.message}`);
    }
}
exports.testPhase2Cache = testPhase2Cache;
//# sourceMappingURL=cacheTest.js.map