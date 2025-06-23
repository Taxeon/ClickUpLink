"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectNavigator = void 0;
const BaseNavigator_1 = require("./BaseNavigator");
const useCache_1 = require("../../hooks/useCache");
const useNavigation_1 = require("../../hooks/useNavigation");
class ProjectNavigator extends BaseNavigator_1.BaseNavigator {
    constructor(context, options) {
        const defaultOptions = {
            title: 'Select a ClickUp Project',
            placeholder: 'Choose a project to navigate to...',
            itemToDetail: (project) => `Members: ${project.members?.length || 0}`,
            itemToDescription: (project) => project.description,
        };
        super(context, { ...defaultOptions, ...(options || {}) });
    }
    static getInstance(context, options) {
        if (!ProjectNavigator.instance) {
            ProjectNavigator.instance = new ProjectNavigator(context, options);
        }
        return ProjectNavigator.instance;
    }
    async loadItems() {
        const cache = (0, useCache_1.useCache)(this.context);
        return await cache.getProjects();
    }
    async navigateToProject() {
        const project = await this.navigate();
        if (project) {
            const navigation = (0, useNavigation_1.useNavigation)(this.context);
            await navigation.goToProject(project);
        }
        return project;
    }
}
exports.ProjectNavigator = ProjectNavigator;
//# sourceMappingURL=ProjectNavigator.js.map