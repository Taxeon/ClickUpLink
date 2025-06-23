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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const useAuth_1 = require("./hooks/useAuth");
const useConfig_1 = require("./hooks/useConfig");
const useNavigation_1 = require("./hooks/useNavigation");
const ProjectNavigator_1 = require("./components/navigation/ProjectNavigator");
const FolderNavigator_1 = require("./components/navigation/FolderNavigator");
const ListNavigator_1 = require("./components/navigation/ListNavigator");
const TaskNavigator_1 = require("./components/navigation/TaskNavigator");
const phase2Test_1 = require("./tests/phase2Test");
const cacheTest_1 = require("./tests/cacheTest");
function activate(context) {
    // Store context globally for hooks
    global.extensionContext = context;
    // Register the URI Handler for OAuth2 redirect
    const uriHandler = vscode.window.registerUriHandler({
        handleUri: async (uri) => {
            if (uri.path === '/auth') {
                await (0, useAuth_1.handleAuthCallback)(context, uri);
            }
        }
    });
    context.subscriptions.push(uriHandler);
    // Check authentication status on activation
    (0, useAuth_1.checkAuth)(context).then((isAuthenticated) => {
        if (isAuthenticated) {
            const auth = (0, useAuth_1.useAuth)();
            vscode.window.showInformationMessage(`Welcome back ${auth.user?.name || 'to ClickUp Link'}!`);
        }
    });
    // Subscribe to configuration changes
    const configSubscription = (0, useConfig_1.subscribeToConfigChanges)();
    context.subscriptions.push(configSubscription);
    // Register Commands  // Start Authentication Command
    const loginCommand = vscode.commands.registerCommand('clickuplink.login', async () => {
        await (0, useAuth_1.startAuth)(context);
        // Show option to enter code manually
        const result = await vscode.window.showInformationMessage('Complete authentication in your browser, then enter the code here.', 'Enter Code Now', 'Enter Code Later');
        if (result === 'Enter Code Now') {
            vscode.commands.executeCommand('clickuplink.enterCode');
        }
    });
    context.subscriptions.push(loginCommand);
    // Manual Code Entry Command
    const enterCodeCommand = vscode.commands.registerCommand('clickuplink.enterCode', async () => {
        const code = await vscode.window.showInputBox({
            prompt: 'Enter the authorization code from ClickUp',
            placeHolder: 'Paste your authorization code here...',
            ignoreFocusOut: true
        });
        if (code) {
            try {
                await (0, useAuth_1.handleManualCodeEntry)(context, code);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Authentication failed: ${error}`);
            }
        }
    });
    context.subscriptions.push(enterCodeCommand);
    // Reset Authentication Command
    const logoutCommand = vscode.commands.registerCommand('clickuplink.logout', async () => {
        await (0, useAuth_1.logout)(context);
        vscode.window.showInformationMessage('Logged out of ClickUp');
    });
    context.subscriptions.push(logoutCommand);
    // Show Authentication Status Command
    const statusCommand = vscode.commands.registerCommand('clickuplink.status', async () => {
        await (0, useAuth_1.checkAuth)(context);
        const auth = (0, useAuth_1.useAuth)();
        if (auth.isAuthenticated) {
            vscode.window.showInformationMessage(`Connected to ClickUp as ${auth.user?.name || 'User'}`);
        }
        else {
            vscode.window.showInformationMessage('Not connected to ClickUp. Use the login command to connect.');
        }
    });
    context.subscriptions.push(statusCommand);
    // Navigation Commands
    const navigateProjectsCommand = vscode.commands.registerCommand('clickuplink.navigateProjects', async () => {
        await (0, useAuth_1.checkAuth)(context);
        const auth = (0, useAuth_1.useAuth)();
        if (!auth.isAuthenticated) {
            vscode.window.showInformationMessage('You need to log in to ClickUp first');
            return;
        }
        const projectNavigator = ProjectNavigator_1.ProjectNavigator.getInstance(context);
        await projectNavigator.navigateToProject();
    });
    context.subscriptions.push(navigateProjectsCommand);
    const navigateFoldersCommand = vscode.commands.registerCommand('clickuplink.navigateFolders', async () => {
        await (0, useAuth_1.checkAuth)(context);
        const auth = (0, useAuth_1.useAuth)();
        if (!auth.isAuthenticated) {
            vscode.window.showInformationMessage('You need to log in to ClickUp first');
            return;
        }
        const nav = (0, useNavigation_1.useNavigation)(context);
        if (!nav.state.currentProject) {
            vscode.window.showInformationMessage('You need to select a project first');
            return;
        }
        const folderNavigator = FolderNavigator_1.FolderNavigator.getInstance(context, nav.state.currentProject.id);
        await folderNavigator.navigateToFolder();
    });
    context.subscriptions.push(navigateFoldersCommand);
    const navigateListsCommand = vscode.commands.registerCommand('clickuplink.navigateLists', async () => {
        await (0, useAuth_1.checkAuth)(context);
        const auth = (0, useAuth_1.useAuth)();
        if (!auth.isAuthenticated) {
            vscode.window.showInformationMessage('You need to log in to ClickUp first');
            return;
        }
        const nav = (0, useNavigation_1.useNavigation)(context);
        if (!nav.state.currentFolder) {
            vscode.window.showInformationMessage('You need to select a folder first');
            return;
        }
        const listNavigator = ListNavigator_1.ListNavigator.getInstance(context, nav.state.currentFolder.id);
        await listNavigator.navigateToList();
    });
    context.subscriptions.push(navigateListsCommand);
    const navigateTasksCommand = vscode.commands.registerCommand('clickuplink.navigateTasks', async () => {
        await (0, useAuth_1.checkAuth)(context);
        const auth = (0, useAuth_1.useAuth)();
        if (!auth.isAuthenticated) {
            vscode.window.showInformationMessage('You need to log in to ClickUp first');
            return;
        }
        const nav = (0, useNavigation_1.useNavigation)(context);
        if (!nav.state.currentList) {
            vscode.window.showInformationMessage('You need to select a list first');
            return;
        }
        const taskNavigator = TaskNavigator_1.TaskNavigator.getInstance(context, nav.state.currentList.id);
        await taskNavigator.navigateToTask();
    });
    context.subscriptions.push(navigateTasksCommand);
    const navigateBackCommand = vscode.commands.registerCommand('clickuplink.navigateBack', async () => {
        await (0, useAuth_1.checkAuth)(context);
        const auth = (0, useAuth_1.useAuth)();
        if (!auth.isAuthenticated) {
            vscode.window.showInformationMessage('You need to log in to ClickUp first');
            return;
        }
        const nav = (0, useNavigation_1.useNavigation)(context);
        await nav.goBack();
    });
    context.subscriptions.push(navigateBackCommand);
    // Test Commands
    const testNavigationCommand = vscode.commands.registerCommand('clickuplink.testNavigation', async () => {
        await (0, phase2Test_1.testPhase2Navigation)(context);
    });
    context.subscriptions.push(testNavigationCommand);
    const testCacheCommand = vscode.commands.registerCommand('clickuplink.testCache', async () => {
        await (0, cacheTest_1.testPhase2Cache)(context);
    });
    context.subscriptions.push(testCacheCommand);
}
exports.activate = activate;
function deactivate() {
    // Clean up if needed when extension is deactivated
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map