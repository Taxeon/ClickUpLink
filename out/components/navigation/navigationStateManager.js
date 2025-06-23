"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.navigationState = void 0;
const events_1 = require("events");
const initialState = {
    currentProject: undefined,
    currentFolder: undefined,
    currentList: undefined,
    currentTask: undefined,
    breadcrumbs: [],
    history: []
};
class NavigationStateManager extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.state = initialState;
    }
    getState() {
        return this.state;
    }
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.emit('change', this.state);
    }
    setBreadcrumbs(items) {
        this.state.breadcrumbs = items;
        this.emit('change', this.state);
    }
    addToHistory(type, id) {
        this.state.history.push({ type, id });
        if (this.state.history.length > 50) {
            // Limit history size
            this.state.history = this.state.history.slice(-50);
        }
        this.emit('change', this.state);
    }
    reset() {
        this.state = initialState;
        this.emit('change', this.state);
    }
    subscribe(listener) {
        this.on('change', listener);
        return () => this.removeListener('change', listener);
    }
}
exports.navigationState = new NavigationStateManager();
//# sourceMappingURL=navigationStateManager.js.map