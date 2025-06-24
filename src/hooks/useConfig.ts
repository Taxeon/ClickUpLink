// useConfig.ts
// Placeholder for configuration hook logic 

import * as vscode from 'vscode';
import { ConfigState } from '../types';

const CONFIG_SECTION = 'clickupLink';

export function readConfig(): ConfigState {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    workspaceId: config.get<string>('workspaceId', ''),
    theme: config.get<'light' | 'dark'>('theme', 'light'),
    notificationsEnabled: config.get<boolean>('notificationsEnabled', true),
  };
}

export function subscribeToConfigChanges(callback: (config: ConfigState) => void) {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_SECTION)) {
      callback(readConfig());
    }
  });
}

export async function updateConfig<K extends keyof ConfigState>(key: K, value: ConfigState[K]) {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update(key, value, vscode.ConfigurationTarget.Global);
} 