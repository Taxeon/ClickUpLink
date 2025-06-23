"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListNavigator = void 0;
const BaseNavigator_1 = require("./BaseNavigator");
const useCache_1 = require("../../hooks/useCache");
const useNavigation_1 = require("../../hooks/useNavigation");
class ListNavigator extends BaseNavigator_1.BaseNavigator {
    constructor(context, folderId, projectId, options) {
        const defaultOptions = {
            title: 'Select a ClickUp List', placeholder: 'Choose a list to navigate to...',
            itemToDescription: (list) => list.description,
            itemToDetail: (list) => list.status ? `Status: ${list.status.status}` : undefined,
        };
        super(context, { ...defaultOptions, ...(options || {}) });
        this.folderId = folderId;
        this.projectId = projectId;
    }
    static getInstance(context, folderId, projectId, options) {
        const key = `list-${folderId}`;
        if (!ListNavigator.instances.has(key)) {
            ListNavigator.instances.set(key, new ListNavigator(context, folderId, projectId, options));
        }
        return ListNavigator.instances.get(key);
    }
    async loadItems() {
        const cache = (0, useCache_1.useCache)(this.context);
        return await cache.getLists(this.folderId, this.projectId);
    }
    async navigateToList() {
        const list = await this.navigate();
        if (list) {
            const navigation = (0, useNavigation_1.useNavigation)(this.context);
            await navigation.goToList(list);
        }
        return list;
    }
}
exports.ListNavigator = ListNavigator;
ListNavigator.instances = new Map();
//# sourceMappingURL=ListNavigator.js.map