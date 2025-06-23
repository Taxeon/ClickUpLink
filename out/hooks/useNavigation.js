"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useNavigation = void 0;
const NavigationProvider_1 = require("../components/providers/NavigationProvider");
/**
 * React-inspired hook for navigation state and operations
 */
function useNavigation(context) {
    if (!context) {
        // Get from extension context in extension.ts
        context = global.extensionContext;
        if (!context) {
            throw new Error('Extension context is required for useNavigation hook');
        }
    }
    const provider = NavigationProvider_1.NavigationProvider.getInstance(context);
    // Get the current navigation context directly
    return provider.getCurrentContext();
}
exports.useNavigation = useNavigation;
//# sourceMappingURL=useNavigation.js.map