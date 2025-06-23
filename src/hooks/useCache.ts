import * as vscode from 'vscode';
import { CacheContextType } from '../types/navigation';
import { CacheProvider } from '../components/providers/CacheProvider';

/**
 * React-inspired hook for cache state and operations
 */
export function useCache(context?: vscode.ExtensionContext): CacheContextType {
  if (!context) {
    // Get from extension context in extension.ts
    context = (global as any).extensionContext;
    
    if (!context) {
      throw new Error('Extension context is required for useCache hook');
    }
  }
  
  const provider = CacheProvider.getInstance(context);
  
  let currentState: CacheContextType;
  
  // Subscribe to state changes
  provider.subscribe((state) => {
    currentState = state;
  });
  
  return currentState!;
}