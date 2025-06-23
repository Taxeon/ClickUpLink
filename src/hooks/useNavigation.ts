import * as vscode from 'vscode';
import { NavigationContextType } from '../types/navigation';
import { NavigationProvider } from '../components/providers/NavigationProvider';

/**
 * React-inspired hook for navigation state and operations
 */
export function useNavigation(context?: vscode.ExtensionContext): NavigationContextType {
  if (!context) {
    // Get from extension context in extension.ts
    context = (global as any).extensionContext;
    
    if (!context) {
      throw new Error('Extension context is required for useNavigation hook');
    }
  }
  
  const provider = NavigationProvider.getInstance(context);
  
  // Get the current navigation context directly
  return provider.getCurrentContext();
}