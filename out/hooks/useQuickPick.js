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
exports.useQuickPick = void 0;
const vscode = __importStar(require("vscode"));
/**
 * React-inspired hook for creating and managing QuickPick inputs
 */
function useQuickPick() {
    /**
     * Show a QuickPick with the given options
     */
    const showQuickPick = async (options) => {
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = options.title;
        quickPick.placeholder = options.placeholder;
        quickPick.matchOnDescription = options.matchOnDescription ?? true;
        quickPick.matchOnDetail = options.matchOnDetail ?? true;
        quickPick.canSelectMany = options.canPickMany ?? false;
        quickPick.items = options.items.map(item => ({
            label: options.itemToString(item),
            description: options.itemToDescription?.(item),
            detail: options.itemToDetail?.(item),
            item // Store the original item in the QuickPickItem
        }));
        if (options.onDidSelectItem) {
            quickPick.onDidChangeSelection(selected => {
                if (selected[0]) {
                    options.onDidSelectItem?.(selected[0].item);
                }
            });
        }
        if (options.onDidHide) {
            quickPick.onDidHide(options.onDidHide);
        }
        quickPick.show();
        return new Promise((resolve) => {
            quickPick.onDidAccept(() => {
                if (options.canPickMany) {
                    const selectedItems = quickPick.selectedItems.map(item => item.item);
                    quickPick.hide();
                    resolve(selectedItems);
                }
                else {
                    const selectedItem = quickPick.selectedItems[0];
                    if (selectedItem) {
                        const original = selectedItem.item;
                        quickPick.hide();
                        resolve(original);
                    }
                    else {
                        quickPick.hide();
                        resolve(undefined);
                    }
                }
            });
            quickPick.onDidHide(() => {
                resolve(undefined);
            });
        });
    };
    /**
     * Create a custom QuickPick with additional controls
     */
    const createCustomQuickPick = () => {
        const quickPick = vscode.window.createQuickPick();
        let itemMap = new Map();
        const updateItems = (items, itemToString, itemToDetail, itemToDescription) => {
            itemMap.clear();
            quickPick.items = items.map(item => {
                const label = itemToString(item);
                itemMap.set(label, item);
                return {
                    label,
                    description: itemToDescription?.(item),
                    detail: itemToDetail?.(item)
                };
            });
        };
        return {
            quickPick,
            updateItems,
            getSelectedItem: () => {
                const selected = quickPick.selectedItems[0];
                return selected ? itemMap.get(selected.label) : undefined;
            },
            getSelectedItems: () => {
                return quickPick.selectedItems.map(item => itemMap.get(item.label)).filter(Boolean);
            }
        };
    };
    return { showQuickPick, createCustomQuickPick };
}
exports.useQuickPick = useQuickPick;
//# sourceMappingURL=useQuickPick.js.map