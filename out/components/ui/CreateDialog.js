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
exports.CreateDialog = void 0;
const vscode = __importStar(require("vscode"));
class CreateDialog {
    /**
     * Create a multi-field dialog for creating entities
     */
    static async show(options) {
        const inputBox = vscode.window.createInputBox();
        const result = {};
        inputBox.ignoreFocusOut = options.ignoreFocusOut ?? true;
        if (options.buttons) {
            inputBox.buttons = options.buttons;
        }
        for (let i = 0; i < options.fields.length; i++) {
            const field = options.fields[i];
            let value = await this.showInputField(inputBox, field, i + 1, options.fields.length, options.title);
            if (value === undefined) {
                // User cancelled the input
                return undefined;
            }
            // Convert checkbox value if needed
            if (field.type === 'checkbox') {
                result[field.name] = value === 'true';
            }
            else {
                result[field.name] = value;
            }
        }
        return result;
    }
    /**
     * Show a single field in the multi-step dialog
     */
    static async showInputField(inputBox, field, step, totalSteps, title) {
        return new Promise((resolve) => {
            // Configure InputBox for this field
            inputBox.title = `${title} (${step}/${totalSteps})`;
            inputBox.prompt = field.label + (field.required ? ' (required)' : '');
            inputBox.placeholder = field.placeholder;
            inputBox.password = field.type === 'password';
            // Handle dropdown type
            if (field.type === 'dropdown' && field.options?.length) {
                const quickPick = vscode.window.createQuickPick();
                quickPick.title = `${title} (${step}/${totalSteps})`;
                quickPick.placeholder = field.label;
                quickPick.items = field.options.map(opt => ({ label: opt }));
                if (field.defaultValue && typeof field.defaultValue === 'string') {
                    const defaultItem = quickPick.items.find(item => item.label === field.defaultValue);
                    if (defaultItem) {
                        quickPick.activeItems = [defaultItem];
                    }
                }
                quickPick.onDidAccept(() => {
                    const selected = quickPick.selectedItems[0];
                    quickPick.hide();
                    resolve(selected ? selected.label : undefined);
                });
                quickPick.onDidHide(() => {
                    quickPick.dispose();
                    if (!quickPick.selectedItems.length) {
                        resolve(undefined);
                    }
                });
                quickPick.show();
                return;
            }
            // Handle checkbox type
            if (field.type === 'checkbox') {
                const quickPick = vscode.window.createQuickPick();
                quickPick.title = `${title} (${step}/${totalSteps})`;
                quickPick.placeholder = field.label;
                quickPick.items = [
                    { label: 'Yes', picked: field.defaultValue === true },
                    { label: 'No', picked: field.defaultValue === false }
                ];
                quickPick.onDidAccept(() => {
                    const selected = quickPick.selectedItems[0];
                    quickPick.hide();
                    resolve(selected ? (selected.label === 'Yes' ? 'true' : 'false') : 'false');
                });
                quickPick.onDidHide(() => {
                    quickPick.dispose();
                    if (!quickPick.selectedItems.length) {
                        resolve(undefined);
                    }
                });
                quickPick.show();
                return;
            }
            // Handle text and password types
            if (field.defaultValue && typeof field.defaultValue === 'string') {
                inputBox.value = field.defaultValue;
            }
            else {
                inputBox.value = '';
            }
            // Set up validation
            if (field.validateInput) {
                inputBox.validationMessage = '';
                inputBox.onDidChangeValue(async (value) => {
                    const validationResult = await field.validateInput(value);
                    if (validationResult) {
                        inputBox.validationMessage = validationResult;
                    }
                    else {
                        inputBox.validationMessage = '';
                    }
                });
            }
            // Handle acceptance
            inputBox.onDidAccept(async () => {
                const value = inputBox.value.trim();
                // Required field validation
                if (field.required && !value) {
                    inputBox.validationMessage = 'This field is required';
                    return;
                }
                // Custom validation
                if (field.validateInput) {
                    const validationResult = await field.validateInput(value);
                    if (validationResult) {
                        inputBox.validationMessage = validationResult;
                        return;
                    }
                }
                inputBox.hide();
                resolve(value);
            });
            // Handle cancellation
            inputBox.onDidHide(() => {
                if (!inputBox.value && field.required) {
                    resolve(undefined);
                }
            });
            inputBox.show();
        });
    }
}
exports.CreateDialog = CreateDialog;
//# sourceMappingURL=CreateDialog.js.map