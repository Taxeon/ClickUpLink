"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderNavigator = void 0;
const BaseNavigator_1 = require("./BaseNavigator");
const useCache_1 = require("../../hooks/useCache");
const useNavigation_1 = require("../../hooks/useNavigation");
class FolderNavigator extends BaseNavigator_1.BaseNavigator {
    constructor(context, projectId, options) {
        const defaultOptions = {
            title: 'Select a ClickUp Folder',
            placeholder: 'Choose a folder to navigate to...',
            itemToDescription: (folder) => folder.description,
        };
        super(context, { ...defaultOptions, ...(options || {}) });
        this.projectId = projectId;
    }
    static getInstance(context, projectId, options) {
        const key = `folder-${projectId}`;
        if (!FolderNavigator.instances.has(key)) {
            FolderNavigator.instances.set(key, new FolderNavigator(context, projectId, options));
        }
        return FolderNavigator.instances.get(key);
    }
    async loadItems() {
        const cache = (0, useCache_1.useCache)(this.context);
        return await cache.getFolders(this.projectId);
    }
    async navigateToFolder() {
        const folder = await this.navigate();
        if (folder) {
            const navigation = (0, useNavigation_1.useNavigation)(this.context);
            await navigation.goToFolder(folder);
        }
        return folder;
    }
}
exports.FolderNavigator = FolderNavigator;
FolderNavigator.instances = new Map();
//# sourceMappingURL=FolderNavigator.js.map