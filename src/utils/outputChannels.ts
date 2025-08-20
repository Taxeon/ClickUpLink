import * as vscode from 'vscode';

/**
 * Utility class to manage shared output channels across the extension
 */
export class OutputChannelManager {
  private static channels: Map<string, vscode.OutputChannel> = new Map();
  
  /**
   * Get or create an output channel by name
   * @param name The name of the output channel
   * @returns The output channel instance
   */
  public static getChannel(name: string): vscode.OutputChannel {
    if (!this.channels.has(name)) {
      const channel = vscode.window.createOutputChannel(name);
      this.channels.set(name, channel);
    }
    
    return this.channels.get(name)!;
  }
  
  /**
   * Initialize all standard channels used by the extension
   * Should be called during extension activation
   */
  public static initializeChannels(): void {
    // Main debug channel
    this.getChannel('ClickUp Link Debug');
    
    // Feature-specific channels
    this.getChannel('ClickUpLink: UpdateReferences Debug');
    
    // Add other channels as needed
  }
  
  /**
   * Dispose all channels when extension is deactivated
   */
  public static disposeAll(): void {
    this.channels.forEach(channel => {
      channel.dispose();
    });
    this.channels.clear();
  }
}
