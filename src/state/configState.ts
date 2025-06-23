// configState.ts
// Placeholder for configuration state 

import { appState } from './appState';
import { ConfigState } from '../types';

export function setConfigState(config: Partial<ConfigState>) {
  const current = appState.getState().config;
  appState.setState({ config: { ...current, ...config } });
}

export function getConfigState(): ConfigState {
  return appState.getState().config;
} 