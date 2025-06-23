"use strict";
// configState.ts
// Placeholder for configuration state 
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigState = exports.setConfigState = void 0;
const appState_1 = require("./appState");
function setConfigState(config) {
    const current = appState_1.appState.getState().config;
    appState_1.appState.setState({ config: { ...current, ...config } });
}
exports.setConfigState = setConfigState;
function getConfigState() {
    return appState_1.appState.getState().config;
}
exports.getConfigState = getConfigState;
//# sourceMappingURL=configState.js.map