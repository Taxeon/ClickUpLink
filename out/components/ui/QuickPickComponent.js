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
exports.QuickPickComponent = void 0;
const vscode = __importStar(require("vscode"));
class QuickPickComponent {
    constructor(options) {
        this.options = options;
        this.quickPick = vscode.window.createQuickPick();
        this.initQuickPick();
    }
    initQuickPick() {
        // Set up QuickPick properties
        this.quickPick.title = this.options.title;
        this.quickPick.placeholder = this.options.placeholder;
        this.quickPick.canSelectMany = this.options.canSelectMany || false;
        this.quickPick.ignoreFocusOut = this.options.ignoreFocusOut || false;
        this.quickPick.matchOnDescription = this.options.matchOnDescription ?? true;
        this.quickPick.matchOnDetail = this.options.matchOnDetail ?? true;
        // Map items to QuickPick items with the original data
        this.quickPick.items = this.options.items.map(item => ({
            ...item,
            data: item.data
        }));
        // Set active item if provided
        if (this.options.activeItem) {
            const activeQuickPickItem = this.quickPick.items.find(item => item.label === this.options.activeItem.label);
            if (activeQuickPickItem) {
                this.quickPick.activeItems = [activeQuickPickItem];
            }
        }
        // Set buttons if provided
        if (this.options.buttons) {
            this.quickPick.buttons = this.options.buttons;
        }
        // Set up event handlers
        if (this.options.onDidTriggerButton) {
            this.quickPick.onDidTriggerButton(this.options.onDidTriggerButton);
        }
        if (this.options.onDidTriggerItemButton) {
            this.quickPick.onDidTriggerItemButton(e => {
                const item = e.item;
                this.options.onDidTriggerItemButton(e.button, {
                    label: item.label,
                    description: item.description,
                    detail: item.detail,
                    alwaysShow: item.alwaysShow,
                    data: item.data
                });
            });
        }
        if (this.options.onDidChangeSelection) {
            this.quickPick.onDidChangeSelection(items => {
                const mappedItems = items.map(item => {
                    const typedItem = item;
                    return {
                        label: typedItem.label,
                        description: typedItem.description,
                        detail: typedItem.detail,
                        alwaysShow: typedItem.alwaysShow,
                        data: typedItem.data
                    };
                });
                this.options.onDidChangeSelection(mappedItems);
            });
        }
        if (this.options.onDidChangeActive) {
            this.quickPick.onDidChangeActive(items => {
                const mappedItems = items.map(item => {
                    const typedItem = item;
                    return {
                        label: typedItem.label,
                        description: typedItem.description,
                        detail: typedItem.detail,
                        alwaysShow: typedItem.alwaysShow,
                        data: typedItem.data
                    };
                });
                this.options.onDidChangeActive(mappedItems);
            });
        }
        // Handle acceptance (selection) and hide
        this.quickPick.onDidAccept(() => {
            const selectedItems = this.quickPick.selectedItems;
            if (!selectedItems.length) {
                this.result = undefined;
            }
            else if (this.options.canSelectMany) {
                this.result = selectedItems.map(item => item.data);
            }
            else {
                this.result = selectedItems[0].data;
            }
            this.quickPick.hide();
        });
        if (this.options.onDidHide) {
            this.quickPick.onDidHide(this.options.onDidHide);
        }
    }
    updateItems(items) {
        this.quickPick.items = items.map(item => ({
            ...item,
            data: item.data
        }));
    }
    show() {
        return new Promise((resolve) => {
            this.quickPick.onDidHide(() => {
                resolve(this.result);
                // Dispose of the QuickPick to avoid memory leaks
                this.quickPick.dispose();
            });
            this.quickPick.show();
        });
    }
    hide() {
        this.quickPick.hide();
    }
    dispose() {
        this.quickPick.dispose();
    }
}
exports.QuickPickComponent = QuickPickComponent;
//# sourceMappingURL=QuickPickComponent.js.map