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
exports.testCache = exports.testNavigation = void 0;
const vscode = __importStar(require("vscode"));
const useAuth_1 = require("../hooks/useAuth");
const ProjectNavigator_1 = require("../components/navigation/ProjectNavigator");
const FolderNavigator_1 = require("../components/navigation/FolderNavigator");
const ListNavigator_1 = require("../components/navigation/ListNavigator");
const TaskNavigator_1 = require("../components/navigation/TaskNavigator");
const useNavigation_1 = require("../hooks/useNavigation");
/**
 * Test file for Phase 2 navigation functionality
 *
 * This file provides a way to test the navigation components and flow
 * completed in Phase 2 of the ClickUpLink extension.
 */
/**
 * Test the navigation flow from projects to tasks
 */
async function testNavigation(context) {
    // Step 1: Check authentication first
    console.log('Testing navigation flow...');
    const isAuthenticated = await (0, useAuth_1.checkAuth)(context);
    if (!isAuthenticated) {
        vscode.window.showErrorMessage('You need to authenticate first. Use the ClickUp: Start Authentication command.');
        return;
    }
    try {
        // Store context globally for hooks
        global.extensionContext = context;
        // Step 2: Navigate to a project
        console.log('Step 1: Navigating to projects...');
        const projectNavigator = ProjectNavigator_1.ProjectNavigator.getInstance(context);
        const selectedProject = await projectNavigator.navigateToProject();
        if (!selectedProject) {
            vscode.window.showInformationMessage('Project navigation cancelled or failed.');
            return;
        }
        vscode.window.showInformationMessage(`Selected project: ${selectedProject.name}`);
        // Step 3: Navigate to a folder
        console.log('Step 2: Navigating to folders...');
        const folderNavigator = FolderNavigator_1.FolderNavigator.getInstance(context, selectedProject.id);
        const selectedFolder = await folderNavigator.navigateToFolder();
        if (!selectedFolder) {
            vscode.window.showInformationMessage('Folder navigation cancelled or failed.');
            return;
        }
        vscode.window.showInformationMessage(`Selected folder: ${selectedFolder.name}`);
        // Step 4: Navigate to a list
        console.log('Step 3: Navigating to lists...');
        const listNavigator = ListNavigator_1.ListNavigator.getInstance(context, selectedFolder.id);
        const selectedList = await listNavigator.navigateToList();
        if (!selectedList) {
            vscode.window.showInformationMessage('List navigation cancelled or failed.');
            return;
        }
        vscode.window.showInformationMessage(`Selected list: ${selectedList.name}`);
        // Step 5: Navigate to a task
        console.log('Step 4: Navigating to tasks...');
        const taskNavigator = TaskNavigator_1.TaskNavigator.getInstance(context, selectedList.id);
        const selectedTask = await taskNavigator.navigateToTask();
        if (!selectedTask) {
            vscode.window.showInformationMessage('Task navigation cancelled or failed.');
            return;
        }
        vscode.window.showInformationMessage(`Selected task: ${selectedTask.name}`);
        // Step 6: Test navigation state
        console.log('Step 5: Checking navigation state...');
        const nav = (0, useNavigation_1.useNavigation)(context);
        vscode.window.showInformationMessage(`Navigation successful! Current state: Project: ${nav.state.currentProject?.name}, ` +
            `Folder: ${nav.state.currentFolder?.name}, List: ${nav.state.currentList?.name}, ` +
            `Task: ${nav.state.currentTask?.name}`);
        // Step 7: Test going back
        console.log('Step 6: Testing navigation back...');
        await nav.goBack();
        vscode.window.showInformationMessage(`Navigated back! Current state: Project: ${nav.state.currentProject?.name}, ` +
            `Folder: ${nav.state.currentFolder?.name}, List: ${nav.state.currentList?.name}, ` +
            `Task: ${nav.state.currentTask?.name}`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Navigation test failed: ${error.message}`);
        console.error('Navigation test error:', error);
    }
}
exports.testNavigation = testNavigation;
/**
 * Test the cache functionality
 * This tests if the cache is properly storing and retrieving data
 */
async function testCache(context) {
    // Step 1: Check authentication first
    console.log('Testing cache functionality...');
    const isAuthenticated = await (0, useAuth_1.checkAuth)(context);
    if (!isAuthenticated) {
        vscode.window.showErrorMessage('You need to authenticate first. Use the ClickUp: Start Authentication command.');
        return;
    }
    try {
        // Store context globally for hooks
        global.extensionContext = context;
        // Navigate to a project
        const projectNavigator = ProjectNavigator_1.ProjectNavigator.getInstance(context);
        const project = await projectNavigator.navigateToProject();
        if (!project) {
            return;
        }
        // First navigation to folders - should fetch from API
        console.log('First navigation to folders - fetching from API...');
        const startTime1 = Date.now();
        const folderNavigator = FolderNavigator_1.FolderNavigator.getInstance(context, project.id);
        await folderNavigator.navigate();
        const duration1 = Date.now() - startTime1;
        // Second navigation to folders - should use cache
        console.log('Second navigation to folders - should use cache...');
        const startTime2 = Date.now();
        await folderNavigator.navigate();
        const duration2 = Date.now() - startTime2;
        vscode.window.showInformationMessage(`Cache test results: First load: ${duration1}ms, Second (cached) load: ${duration2}ms`);
        if (duration2 < duration1) {
            vscode.window.showInformationMessage('Cache is working correctly! Second load was faster.');
        }
        else {
            vscode.window.showInformationMessage('Cache might not be working as expected.');
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Cache test failed: ${error.message}`);
        console.error('Cache test error:', error);
    }
}
exports.testCache = testCache;
//# sourceMappingURL=navigationTest.js.map