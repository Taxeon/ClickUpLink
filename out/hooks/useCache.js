"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCache = void 0;
const CacheProvider_1 = require("../components/providers/CacheProvider");
/**
 * React-inspired hook for cache state and operations
 */
function useCache(context) {
    if (!context) {
        // Get from extension context in extension.ts
        context = global.extensionContext;
        if (!context) {
            throw new Error('Extension context is required for useCache hook');
        }
    }
    const provider = CacheProvider_1.CacheProvider.getInstance(context);
    let currentState;
    // Subscribe to state changes
    provider.subscribe((state) => {
        currentState = state;
    });
    return currentState;
}
exports.useCache = useCache;
//# sourceMappingURL=useCache.js.map