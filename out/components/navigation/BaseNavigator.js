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
exports.BaseNavigator = void 0;
const vscode = __importStar(require("vscode"));
const useQuickPick_1 = require("../../hooks/useQuickPick");
/**
 * Base class for all navigation components
 */
class BaseNavigator {
    constructor(context, options) {
        this.context = context;
        this.options = options;
        this.quickPick = (0, useQuickPick_1.useQuickPick)();
    }
    /**
     * Show the navigation QuickPick
     */ async show(items) {
        const result = await this.quickPick.showQuickPick({
            title: this.options.title,
            placeholder: this.options.placeholder,
            items: items,
            itemToString: (item) => item.name,
            itemToDetail: this.options.itemToDetail,
            itemToDescription: this.options.itemToDescription,
            matchOnDescription: this.options.matchOnDescription,
            matchOnDetail: this.options.matchOnDetail,
            canPickMany: this.options.canPickMany,
            onDidSelectItem: this.options.onDidSelectItem,
            onDidHide: this.options.onDidHide
        });
        return result;
    }
    /**
     * Navigate to the specific level
     */
    async navigate() {
        try {
            const items = await this.loadItems();
            const result = await this.show(items);
            if (Array.isArray(result)) {
                // Handle multiple selection case if needed
                return result[0];
            }
            return result;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Navigation failed: ${error.message}`);
            return undefined;
        }
    }
}
exports.BaseNavigator = BaseNavigator;
//# sourceMappingURL=BaseNavigator.js.map