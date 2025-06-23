"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskNavigator = void 0;
const BaseNavigator_1 = require("./BaseNavigator");
const useCache_1 = require("../../hooks/useCache");
const useNavigation_1 = require("../../hooks/useNavigation");
class TaskNavigator extends BaseNavigator_1.BaseNavigator {
    constructor(context, listId, options) {
        const defaultOptions = {
            title: 'Select a ClickUp Task',
            placeholder: 'Choose a task to navigate to...',
            itemToDescription: (task) => task.description,
            itemToDetail: (task) => {
                const parts = [];
                if (task.status) {
                    parts.push(`Status: ${task.status}`);
                }
                if (task.priority) {
                    parts.push(`Priority: ${task.priority.priority}`);
                }
                if (task.dueDate) {
                    const date = new Date(task.dueDate);
                    parts.push(`Due: ${date.toLocaleDateString()}`);
                }
                return parts.join(' | ');
            },
        };
        super(context, { ...defaultOptions, ...(options || {}) });
        this.listId = listId;
    }
    static getInstance(context, listId, options) {
        const key = `task-${listId}`;
        if (!TaskNavigator.instances.has(key)) {
            TaskNavigator.instances.set(key, new TaskNavigator(context, listId, options));
        }
        return TaskNavigator.instances.get(key);
    }
    async loadItems() {
        const cache = (0, useCache_1.useCache)(this.context);
        return await cache.getTasks(this.listId);
    }
    async navigateToTask() {
        const task = await this.navigate();
        if (task) {
            const navigation = (0, useNavigation_1.useNavigation)(this.context);
            await navigation.goToTask(task);
        }
        return task;
    }
}
exports.TaskNavigator = TaskNavigator;
TaskNavigator.instances = new Map();
//# sourceMappingURL=TaskNavigator.js.map