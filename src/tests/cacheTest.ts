import * as vscode from 'vscode';
import { checkAuth } from '../hooks/useAuth';
import { useCache } from '../hooks/useCache';

/**
 * Test function for Phase 2 cache functionality
 * This demonstrates the cache system working:
 * 1. Fetch projects (first time will be from API)
 * 2. Fetch projects again (should be from cache)
 * 3. Invalidate cache
 * 4. Fetch again (should be from API)
 */
export async function testPhase2Cache(context: vscode.ExtensionContext): Promise<void> {
  // Step 1: Check if authenticated
  console.log('Checking authentication status...');
  const isAuthenticated = await checkAuth(context);
  
  if (!isAuthenticated) {
    vscode.window.showInformationMessage('Please login to ClickUp first using the "ClickUp: Start Authentication" command');
    return;
  }
  
  vscode.window.showInformationMessage('Starting Phase 2 cache test...');

  try {
    // Get cache provider
    const cache = useCache(context);
    
    // Step 2: First fetch projects (from API)
    console.log('Fetching projects from API...');
    const startTime1 = Date.now();
    const projects1 = await cache.getProjects();
    const duration1 = Date.now() - startTime1;
    
    vscode.window.showInformationMessage(
      `First fetch: ${projects1.length} projects loaded in ${duration1}ms`
    );
    
    // Step 3: Second fetch projects (from cache)
    console.log('Fetching projects from cache...');
    const startTime2 = Date.now();
    const projects2 = await cache.getProjects();
    const duration2 = Date.now() - startTime2;
    
    vscode.window.showInformationMessage(
      `Second fetch (cached): ${projects2.length} projects loaded in ${duration2}ms`
    );
    
    // Step 4: Invalidate cache
    console.log('Invalidating projects cache...');
    cache.invalidateProjects();
    vscode.window.showInformationMessage('Cache invalidated');
    
    // Step 5: Third fetch projects (from API again)
    console.log('Fetching projects from API after invalidation...');
    const startTime3 = Date.now();
    const projects3 = await cache.getProjects();
    const duration3 = Date.now() - startTime3;
    
    vscode.window.showInformationMessage(
      `Third fetch (after invalidation): ${projects3.length} projects loaded in ${duration3}ms`
    );
    
    // Show summary
    vscode.window.showInformationMessage(
      `Cache test summary:\n` +
      `- First fetch (API): ${duration1}ms\n` +
      `- Second fetch (cached): ${duration2}ms\n` +
      `- Third fetch (API after invalidation): ${duration3}ms`
    );
    
    vscode.window.showInformationMessage('Phase 2 cache test completed successfully!');
  } catch (error: any) {
    console.error('Error during cache test:', error);
    vscode.window.showErrorMessage(`Cache test failed: ${error.message}`);
  }
}
