import * as vscode from 'vscode';
import { TaskReference } from '../../types';
import { OutputChannelManager } from '../../utils/outputChannels';

/**
 * Manages ClickUp reference markers and their positions in a document.
 * Handles orphaned references (removed from UI but kept in memory until save).
 */
export class RefPositionManager {
  // Map: uri -> { active: TaskReference[], orphaned: TaskReference[] }
  private static referenceMap: Map<string, { active: TaskReference[]; orphaned: TaskReference[] }> =
    new Map();
    
  /**
   * Get language-specific or generic regex patterns for ClickUp task references
   * @param document The text document to get patterns for
   * @returns Object containing lineCommentRegex and blockCommentRegex if applicable
   */
  static getClickUpRegexPatterns(document: vscode.TextDocument): { 
    lineCommentRegex: RegExp;
    blockCommentRegex?: RegExp;
  } {
    const languageId = document.languageId;
    let lineCommentRegex: RegExp;
    let blockCommentRegex: RegExp | undefined;
    
    console.log(`Getting regex patterns for language: ${languageId}`);

    // Determine comment style based on languageId
    switch (languageId) {
      case 'typescript':
      case 'javascript':
      case 'javascriptreact': // Added for JSX files
      case 'typescriptreact': // Added for TSX files
      case 'jsx': // Explicitly handle JSX
      case 'tsx': // Explicitly handle TSX
      case 'go':
      case 'csharp':
        lineCommentRegex = /(\/\/\/|\/\/)\s*clickup:\s*([a-zA-Z0-9_-]+)/g; // Supports /// and //
        blockCommentRegex = /\/\*\s*clickup:\s*([a-zA-Z0-9_-]+)/g; // Supports /*
        break;
      case 'python':
        lineCommentRegex = /#\s*clickup:\s*([a-zA-Z0-9_-]+)/g;
        break;
      case 'sql': // For SQL Server
        lineCommentRegex = /--\s*clickup:\s*([a-zA-Z0-9_-]+)/g;
        break;
      case 'vb': // For VB.Net
        lineCommentRegex = /'\s*clickup:\s*([a-zA-Z0-9_-]+)/g;
        break;
      case 'markdown':
        // For markdown, support both regular comment format and code block format
        lineCommentRegex = /(\/\/|#|<!--)\s*clickup:\s*([a-zA-Z0-9_-]+)/g;
        break;
      default:
        // Default to // for unknown languages or if no specific rule applies
        lineCommentRegex = /\/\/\s*clickup:\s*([a-zA-Z0-9_-]+)/g;
        blockCommentRegex = /\/\*\s*clickup:\s*([a-zA-Z0-9_-]+)/g;
        
        // Special handling for potential markdown files that aren't recognized
        if (document.fileName.toLowerCase().endsWith('.md')) {
          console.log('Detected markdown file by extension');
          lineCommentRegex = /(\/\/|#|<!--)\s*clickup:\s*([a-zA-Z0-9_-]+)/g;
        }
        break;
    }
    
    return { lineCommentRegex, blockCommentRegex };
  }
  
  /**
   * Get a generic flexible regex that matches ClickUp task references in any language
   * @returns A RegExp object
   */
  static getGenericClickUpRegex(): RegExp {
    // This regex is more flexible and tries to match all possible comment styles
    // Always return a fresh instance to avoid issues with lastIndex state
    return new RegExp(/(\/\/|\/\*|#|--|'|\*|<!--)[ \t]{0,2}clickup:([a-zA-Z0-9_-]+)/i);
  }

  /**
   * Scan a document for ClickUp markers and update reference positions.
   * @param document The text document to scan.
   * @param allKnownReferences All references known for this document (from storage).
   */
  static updateReferencesFromMarkers(
    document: vscode.TextDocument,
    allKnownReferences: TaskReference[]
  ): void {
    const outputChannel = OutputChannelManager.getChannel('ClickUpLink: UpdateReferences Debug');
    outputChannel.appendLine(`🔍 Scanning document for ClickUp markers: ${document.fileName}`);
    console.log(`📄 Document language: ${document.languageId}`);
    console.log(`💾 Known references count: ${allKnownReferences.length}`);
    
    const uri = document.uri.toString();
    
    // Get the appropriate regex patterns for this document's language
    const { lineCommentRegex, blockCommentRegex } = this.getClickUpRegexPatterns(document);

    const activeRefs: TaskReference[] = [];
    const orphanedRefs: TaskReference[] = [];
    const seenTaskIds = new Set<string>();
    // Add a Set to track positions to avoid duplicates (especially in JSX/TSX files)
    const seenPositions = new Set<string>();

    // 1. Scan for line comment markers
    if (lineCommentRegex) {
      for (let line = 0; line < document.lineCount; line++) {
        const text = document.lineAt(line).text;
        // Create a new regex instance for each line to ensure lastIndex is reset
        const regexInstance = new RegExp(lineCommentRegex.source, 'g');
        let match;
        
        console.log(`Scanning line ${line}: "${text}"`);
        
        while ((match = regexInstance.exec(text))) {
          console.log(`Found match at line ${line}, index ${match.index}: "${match[0]}"`);
          const taskId = match[2]; // Adjusted for capture group in regex
          console.log(`Extracted taskId: ${taskId}`);
          
          // Create a unique position key to avoid duplicates (especially in JSX files)
          const positionKey = `${line}:${match.index}`;
          
          // Skip if we've already seen this position
          if (seenPositions.has(positionKey)) {
            console.log(`Skipping duplicate reference at position ${positionKey}`);
            continue;
          }
          
          // Mark this position as seen
          seenPositions.add(positionKey);
          
          let ref = allKnownReferences.find(r => r.taskId === taskId);
          if (!ref) {
            ref = {
              taskId,
              range: new vscode.Range(line, match.index, line, match.index + match[0].length),
            } as TaskReference;
            console.log(`Created new reference for taskId ${taskId}`);
          } else {
            ref.range = new vscode.Range(line, match.index, line, match.index + match[0].length);
            console.log(`Updated existing reference for taskId ${taskId}`);
          }
          activeRefs.push(ref);
          seenTaskIds.add(taskId);
        }
      }
    }

    // 2. Scan for block comment markers (if applicable)
    if (blockCommentRegex) {
      const documentText = document.getText();
      // Create a new regex instance for block comments
      const blockRegexInstance = new RegExp(blockCommentRegex.source, 'g');
      let blockMatch;
      
      console.log(`Scanning document for block comments using regex: ${blockRegexInstance}`);
      
      while ((blockMatch = blockRegexInstance.exec(documentText))) {
        console.log(`Found block comment match at index ${blockMatch.index}: "${blockMatch[0]}"`);
        const taskId = blockMatch[1];
        console.log(`Extracted taskId from block comment: ${taskId}`);
        
        const startPos = document.positionAt(blockMatch.index);
        const endPos = document.positionAt(blockMatch.index + blockMatch[0].length);
        const range = new vscode.Range(startPos, endPos);
        
        // Create a unique position key to avoid duplicates
        const positionKey = `${startPos.line}:${startPos.character}`;
        
        // Skip if we've already seen this position or task ID
        if (seenPositions.has(positionKey) || seenTaskIds.has(taskId)) {
          console.log(`Skipping duplicate block comment at position ${positionKey}`);
          continue;
        }
        
        // Mark this position as seen
        seenPositions.add(positionKey);

        let ref = allKnownReferences.find(r => r.taskId === taskId);
        if (!ref) {
          ref = {
            taskId,
            range,
          } as TaskReference;
          console.log(`Created new reference for block comment taskId ${taskId}`);
        } else {
          ref.range = range;
          console.log(`Updated existing reference for block comment taskId ${taskId}`);
        }
        activeRefs.push(ref);
        seenTaskIds.add(taskId);
      }
    }

    // 3. Any stored reference not seen in this scan is orphaned
    for (const ref of allKnownReferences) {
      if (ref.taskId && !seenTaskIds.has(ref.taskId)) {
        orphanedRefs.push(ref);
        console.log(`⚠️ Reference orphaned: ${ref.taskId} (not found in document)`);
      } else if (!ref.taskId) {
        // Unconfigured references are always active
        activeRefs.push(ref);
        console.log(`ℹ️ Adding unconfigured reference (no taskId)`);
      }
    }

    console.log(`✅ Scan complete - Found: ${activeRefs.length} active references, ${orphanedRefs.length} orphaned references`);
    for (const ref of activeRefs) {
      console.log(`   - Active: ${ref.taskId} at line ${ref.range.start.line}`);
    }

    RefPositionManager.referenceMap.set(uri, { active: activeRefs, orphaned: orphanedRefs });
  }

  /**
   * Get all active references for a document (those with a marker present).
   */
  static getActiveReferences(uri: string): TaskReference[] {
    return RefPositionManager.referenceMap.get(uri)?.active || [];
  }

  /**
   * Get all orphaned references for a document (those without a marker, but not yet deleted).
   */
  static getOrphanedReferences(uri: string): TaskReference[] {
    return RefPositionManager.referenceMap.get(uri)?.orphaned || [];
  }

  /**
   * On document save, remove all orphaned references for this document.
   */
  static purgeOrphanedReferencesOnSave(
    uri: string,
    saveFn: (uri: string, refs: TaskReference[]) => void
  ): void {
    const entry = RefPositionManager.referenceMap.get(uri);
    if (!entry) return;
    // Only keep active references
    saveFn(uri, entry.active);
    RefPositionManager.referenceMap.set(uri, { active: entry.active, orphaned: [] });
  }

  /**
   * If a marker for an orphaned reference reappears, re-link it as active.
   * (Handled automatically in updateReferencesFromMarkers)
   */
  
  /**
   * Find a clickup reference marker near a given position
   * @param document The text document to scan
   * @param range The range to look near
   * @returns Object with marker details if found, null otherwise
   */
  static findClickupAnchor(
    document: vscode.TextDocument,
    range: vscode.Range
  ): { line: number; match: RegExpExecArray; commentStyle: string } | null {
    console.log(`🔍 Finding clickup marker near line ${range.start.line}`);
    
    // Check current line
    const line = range.start.line;
    
    // Check each line for a clickup tag
    try {
      const lineText = document.lineAt(line).text;
      console.log(`Checking line ${line}: "${lineText}"`);
      
      // Create a fresh regex instance for each line to avoid stateful issues with lastIndex
      const anchorRegex = this.getGenericClickUpRegex();
      const match = anchorRegex.exec(lineText);
      
      if (match) {
        console.log(`Found marker match at line ${line}, pos ${match.index}-${match.index + match[0].length}`);
        const commentStyle = match[1] || ''; // The comment marker (// or /* or # etc.)
        console.log(`Comment style: "${commentStyle}", Task ID: "${match[2]}"`);
        
        return { line, match, commentStyle };
      }
    } catch (e) {
      console.log(`⚠️ Error checking line ${line} for marker: ${e}`);
    }
        
    console.log(`❌ No marker found at line ${range.start.line}`);
    return null;
  }
}
