"use strict";
// useConfig.ts
// Placeholder for configuration hook logic 
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
exports.updateConfig = exports.subscribeToConfigChanges = exports.readConfig = void 0;
const vscode = __importStar(require("vscode"));
const configState_1 = require("../state/configState");
const CONFIG_SECTION = 'clickupLink';
function readConfig() {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return {
        workspaceId: config.get('workspaceId', ''),
        theme: config.get('theme', 'light'),
        notificationsEnabled: config.get('notificationsEnabled', true),
    };
}
exports.readConfig = readConfig;
function subscribeToConfigChanges() {
    return vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIG_SECTION)) {
            (0, configState_1.setConfigState)(readConfig());
        }
    });
}
exports.subscribeToConfigChanges = subscribeToConfigChanges;
async function updateConfig(key, value) {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(key, value, vscode.ConfigurationTarget.Global);
}
exports.updateConfig = updateConfig;
//# sourceMappingURL=useConfig.js.map