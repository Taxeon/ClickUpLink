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
exports.testPhase2Navigation = void 0;
const vscode = __importStar(require("vscode"));
const useAuth_1 = require("../hooks/useAuth");
const useNavigation_1 = require("../hooks/useNavigation");
const ProjectNavigator_1 = require("../components/navigation/ProjectNavigator");
const FolderNavigator_1 = require("../components/navigation/FolderNavigator");
const ListNavigator_1 = require("../components/navigation/ListNavigator");
const TaskNavigator_1 = require("../components/navigation/TaskNavigator");
/**
 * Test function for Phase 2 navigation functionality
 * This walks through the full navigation flow:
 * 1. Check authentication
 * 2. Navigate to a project
 * 3. Navigate to a folder in that project
 * 4. Navigate to a list in that folder
 * 5. Navigate to a task in that list
 * 6. Navigate back through history
 */
async function testPhase2Navigation(context) {
    // Step 1: Check if authenticated
    console.log('Checking authentication status...');
    const isAuthenticated = await (0, useAuth_1.checkAuth)(context);
    if (!isAuthenticated) {
        vscode.window.showInformationMessage('Please login to ClickUp first using the "ClickUp: Start Authentication" command');
        return;
    }
    vscode.window.showInformationMessage('Starting Phase 2 navigation test...');
    try {
        // Step 2: Navigate to a project
        console.log('Testing project navigation...');
        const projectNavigator = ProjectNavigator_1.ProjectNavigator.getInstance(context);
        const selectedProject = await projectNavigator.navigateToProject();
        if (!selectedProject) {
            vscode.window.showInformationMessage('Project navigation test cancelled or failed');
            return;
        }
        vscode.window.showInformationMessage(`Selected project: ${selectedProject.name}`);
        // Step 3: Navigate to a folder in that project
        console.log('Testing folder navigation...');
        const folderNavigator = FolderNavigator_1.FolderNavigator.getInstance(context, selectedProject.id);
        const selectedFolder = await folderNavigator.navigateToFolder();
        if (!selectedFolder) {
            vscode.window.showInformationMessage('Folder navigation test cancelled or failed');
            return;
        }
        vscode.window.showInformationMessage(`Selected folder: ${selectedFolder.name}`);
        // Step 4: Navigate to a list in that folder
        console.log('Testing list navigation...');
        const listNavigator = ListNavigator_1.ListNavigator.getInstance(context, selectedFolder.id);
        const selectedList = await listNavigator.navigateToList();
        if (!selectedList) {
            vscode.window.showInformationMessage('List navigation test cancelled or failed');
            return;
        }
        vscode.window.showInformationMessage(`Selected list: ${selectedList.name}`);
        // Step 5: Navigate to a task in that list
        console.log('Testing task navigation...');
        const taskNavigator = TaskNavigator_1.TaskNavigator.getInstance(context, selectedList.id);
        const selectedTask = await taskNavigator.navigateToTask();
        if (!selectedTask) {
            vscode.window.showInformationMessage('Task navigation test cancelled or failed');
            return;
        }
        vscode.window.showInformationMessage(`Selected task: ${selectedTask.name}`);
        // Step 6: Test navigation state
        const nav = (0, useNavigation_1.useNavigation)(context);
        console.log('Current navigation state:', nav.state);
        // Test breadcrumbs
        vscode.window.showInformationMessage(`Navigation path: ${nav.state.breadcrumbs.map(item => item.name).join(' > ')}`);
        // Step 7: Test going back
        vscode.window.showInformationMessage('Testing navigation back...');
        await nav.goBack();
        vscode.window.showInformationMessage(`After going back: ${nav.state.breadcrumbs.map(item => item.name).join(' > ')}`);
        vscode.window.showInformationMessage('Phase 2 navigation test completed successfully!');
    }
    catch (error) {
        console.error('Error during navigation test:', error);
        vscode.window.showErrorMessage(`Navigation test failed: ${error.message}`);
    }
}
exports.testPhase2Navigation = testPhase2Navigation;
//# sourceMappingURL=phase2Test.js.map