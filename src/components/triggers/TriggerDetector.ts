import * as vscode from 'vscode';

export interface TriggerMatch {
  range: vscode.Range;
  trigger: string;
  taskId?: string;
  type: 'clickup-trigger' | 'task-reference' | 'task-id';
}

export interface TriggerDetectorOptions {
  enableClickupTrigger: boolean;
  enableTaskReferences: boolean;
  enableTaskIds: boolean;
  customTriggers: string[];
}

/**
 * Event-driven trigger detection for ClickUp integration
 */
export class TriggerDetector {
  private static instance: TriggerDetector;
  private context: vscode.ExtensionContext;
  private options: TriggerDetectorOptions;
  
  // Regex patterns for different trigger types
  private readonly patterns = {
    // Basic "clickup" trigger (case insensitive)
    clickupTrigger: /\bclickup\b/gi,
    
    // Task reference with ID: clickup:12345 or clickup:abc123
    taskReference: /\bclickup:([a-zA-Z0-9]+)\b/gi,
    
    // Direct task ID references: CU-12345, #12345, or similar patterns
    taskId: /(?:CU-|#)([a-zA-Z0-9]+)\b/gi,
    
    // URL-based task references
    taskUrl: /https?:\/\/app\.clickup\.com\/t\/([a-zA-Z0-9]+)/gi
  };

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.options = {
      enableClickupTrigger: true,
      enableTaskReferences: true,
      enableTaskIds: true,
      customTriggers: []
    };
    
    this.loadConfiguration();
  }

  static getInstance(context: vscode.ExtensionContext): TriggerDetector {
    if (!TriggerDetector.instance) {
      TriggerDetector.instance = new TriggerDetector(context);
    }
    return TriggerDetector.instance;
  }

  /**
   * Load configuration for trigger detection
   */
  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('clickupLink.triggers');
    
    this.options = {
      enableClickupTrigger: config.get('enableClickupTrigger', true),
      enableTaskReferences: config.get('enableTaskReferences', true),
      enableTaskIds: config.get('enableTaskIds', true),
      customTriggers: config.get('customTriggers', [])
    };
  }

  /**
   * Detect all task references in a document
   */
  public async detectTaskReferences(document: vscode.TextDocument): Promise<TriggerMatch[]> {
    const text = document.getText();
    const matches: TriggerMatch[] = [];

    // Detect different types of triggers based on configuration
    if (this.options.enableClickupTrigger) {
      matches.push(...this.detectClickupTriggers(document, text));
    }

    if (this.options.enableTaskReferences) {
      matches.push(...this.detectTaskReferencePattern(document, text));
    }

    if (this.options.enableTaskIds) {
      matches.push(...this.detectTaskIds(document, text));
    }

    // Detect custom triggers
    if (this.options.customTriggers.length > 0) {
      matches.push(...this.detectCustomTriggers(document, text));
    }

    // Sort matches by position
    matches.sort((a, b) => {
      const posA = a.range.start;
      const posB = b.range.start;
      
      if (posA.line !== posB.line) {
        return posA.line - posB.line;
      }
      return posA.character - posB.character;
    });

    return matches;
  }

  /**
   * Detect basic "clickup" triggers
   */
  private detectClickupTriggers(document: vscode.TextDocument, text: string): TriggerMatch[] {
    const matches: TriggerMatch[] = [];
    const pattern = this.patterns.clickupTrigger;
    pattern.lastIndex = 0; // Reset regex state

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      // Check if this is not part of a task reference (avoid double detection)
      if (!this.isPartOfTaskReference(text, match.index)) {
        matches.push({
          range,
          trigger: match[0],
          type: 'clickup-trigger'
        });
      }
    }

    return matches;
  }
  /**
   * Detect task references (clickup:taskId format)
   */
  private detectTaskReferencePattern(document: vscode.TextDocument, text: string): TriggerMatch[] {
    const matches: TriggerMatch[] = [];
    const pattern = this.patterns.taskReference;
    pattern.lastIndex = 0; // Reset regex state

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      matches.push({
        range,
        trigger: match[0],
        taskId: match[1], // Captured task ID
        type: 'task-reference'
      });
    }

    return matches;
  }

  /**
   * Detect direct task ID patterns
   */
  private detectTaskIds(document: vscode.TextDocument, text: string): TriggerMatch[] {
    const matches: TriggerMatch[] = [];
    const pattern = this.patterns.taskId;
    pattern.lastIndex = 0; // Reset regex state

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      matches.push({
        range,
        trigger: match[0],
        taskId: match[1], // Captured task ID
        type: 'task-id'
      });
    }

    return matches;
  }

  /**
   * Detect custom triggers defined by user
   */
  private detectCustomTriggers(document: vscode.TextDocument, text: string): TriggerMatch[] {
    const matches: TriggerMatch[] = [];

    for (const customTrigger of this.options.customTriggers) {
      const pattern = new RegExp(`\\b${this.escapeRegex(customTrigger)}\\b`, 'gi');
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        matches.push({
          range,
          trigger: match[0],
          type: 'clickup-trigger'
        });
      }
    }

    return matches;
  }

  /**
   * Check if a position is part of a task reference to avoid double detection
   */
  private isPartOfTaskReference(text: string, position: number): boolean {
    // Look for "clickup:" pattern around the current position
    const beforeText = text.substring(Math.max(0, position - 10), position);
    const afterText = text.substring(position, position + 20);
    
    return beforeText.includes('clickup') && afterText.includes(':');
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Detect task references at a specific position
   */
  public async detectTaskReferenceAtPosition(
    document: vscode.TextDocument, 
    position: vscode.Position
  ): Promise<TriggerMatch | undefined> {
    const allMatches = await this.detectTaskReferences(document);
    
    return allMatches.find(match => match.range.contains(position));
  }

  /**
   * Check if position contains any trigger
   */
  public async hasTriggerAtPosition(
    document: vscode.TextDocument, 
    position: vscode.Position
  ): Promise<boolean> {
    const allMatches = await this.detectTaskReferences(document);
    
    return allMatches.some(match => match.range.contains(position));
  }

  /**
   * Get word range at position for trigger detection
   */
  public getWordRangeAtPosition(
    document: vscode.TextDocument, 
    position: vscode.Position
  ): vscode.Range | undefined {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return undefined;
    }

    // Extend range to include potential task reference format
    const line = document.lineAt(position.line);
    const text = line.text;
    
    let start = wordRange.start.character;
    let end = wordRange.end.character;

    // Look backwards for "clickup:" prefix
    while (start > 0 && text[start - 1] !== ' ' && text[start - 1] !== '\t') {
      start--;
    }

    // Look forwards for task ID
    while (end < text.length && text[end] !== ' ' && text[end] !== '\t') {
      end++;
    }

    return new vscode.Range(
      new vscode.Position(position.line, start),
      new vscode.Position(position.line, end)
    );
  }

  /**
   * Update trigger detection options
   */
  public updateOptions(newOptions: Partial<TriggerDetectorOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  public getOptions(): TriggerDetectorOptions {
    return { ...this.options };
  }

  /**
   * Clear all pattern caches and reload configuration
   */
  public reload(): void {
    this.loadConfiguration();
    
    // Reset regex lastIndex to ensure fresh matching
    Object.values(this.patterns).forEach(pattern => {
      pattern.lastIndex = 0;
    });
  }

  /**
   * Add custom trigger pattern
   */
  public addCustomTrigger(trigger: string): void {
    if (!this.options.customTriggers.includes(trigger)) {
      this.options.customTriggers.push(trigger);
    }
  }

  /**
   * Remove custom trigger pattern
   */
  public removeCustomTrigger(trigger: string): void {
    const index = this.options.customTriggers.indexOf(trigger);
    if (index > -1) {
      this.options.customTriggers.splice(index, 1);
    }
  }

  /**
   * Validate if a string could be a valid ClickUp task ID
   */
  public isValidTaskId(taskId: string): boolean {
    // ClickUp task IDs are typically alphanumeric
    return /^[a-zA-Z0-9]+$/.test(taskId) && taskId.length >= 3;
  }
}
