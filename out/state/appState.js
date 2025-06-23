"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appState = void 0;
// appState.ts
const events_1 = require("events");
const initialState = {
    auth: {
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        user: undefined,
    },
    config: {
        workspaceId: null,
        theme: 'light',
        notificationsEnabled: true,
    },
};
class AppStateManager extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.state = initialState;
    }
    getState() {
        return this.state;
    }
    setState(partial) {
        this.state = { ...this.state, ...partial };
        this.emit('change', this.state);
    }
    subscribe(listener) {
        this.on('change', listener);
        return () => this.removeListener('change', listener);
    }
}
exports.appState = new AppStateManager();
//# sourceMappingURL=appState.js.map