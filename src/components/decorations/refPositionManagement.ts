import * as vscode from 'vscode';
import { TaskReference } from '../../types';

/**
 * Manages ClickUp reference markers and their positions in a document.
 * Handles orphaned references (removed from UI but kept in memory until save).
 */
export class RefPositionManager {
  // Map: uri -> { active: TaskReference[], orphaned: TaskReference[] }
  private static referenceMap: Map<string, { active: TaskReference[]; orphaned: TaskReference[] }> =
    new Map();

  /**
   * Scan a document for ClickUp markers and update reference positions.
   * @param document The text document to scan.
   * @param allKnownReferences All references known for this document (from storage).
   */
  static updateReferencesFromMarkers(
    document: vscode.TextDocument,
    allKnownReferences: TaskReference[]
  ): void {
    const uri = document.uri.toString();
    const languageId = document.languageId;
    let lineCommentRegex: RegExp | undefined;
    let blockCommentRegex: RegExp | undefined;

    // Determine comment style based on languageId
    switch (languageId) {
      case 'typescript':
      case 'javascript':
      case 'go':
      case 'csharp':
        lineCommentRegex = /^[ \t]*(\/\/\/|\/\/)[ \t]{0,2}clickup:\s*([a-zA-Z0-9_-]+)/gi; // Starts with comment, case-insensitive
        blockCommentRegex = /\/\*[ \t]{0,2}clickup:\s*([a-zA-Z0-9_-]+)/gi; // Block comment with clickup immediately after
        break;
      case 'python':
        lineCommentRegex = /^[ \t]*#[ \t]{0,2}clickup:\s*([a-zA-Z0-9_-]+)/gi; // Must start with #, 0-2 spaces, case-insensitive
        break;
      case 'sql': // For SQL Server
        lineCommentRegex = /^[ \t]*--[ \t]{0,2}clickup:\s*([a-zA-Z0-9_-]+)/gi; // Must start with --, 0-2 spaces, case-insensitive
        break;
      case 'vb': // For VB.Net
        lineCommentRegex = /^[ \t]*'[ \t]{0,2}clickup:\s*([a-zA-Z0-9_-]+)/gi; // Must start with ', 0-2 spaces, case-insensitive
        break;
      case 'markdown':
      case 'md':
        // For markdown files, support both code-style comments and regular lines
        lineCommentRegex = /^[ \t]*(\/\/|#|\/\/\/|\*|)[ \t]{0,2}clickup:\s*([a-zA-Z0-9_-]+)/ig; // Must be at beginning of line, case insensitive
        break;
      default:
        // Default to // for unknown languages or if no specific rule applies
        lineCommentRegex = /^[ \t]*\/\/[ \t]{0,2}clickup:\s*([a-zA-Z0-9_-]+)/gi; // Must start with //, 0-2 spaces, case-insensitive
        blockCommentRegex = /\/\*[ \t]{0,2}clickup:\s*([a-zA-Z0-9_-]+)/gi; // Block comment with clickup immediately after
        break;
    }

    const activeRefs: TaskReference[] = [];
    const orphanedRefs: TaskReference[] = [];
    const seenTaskIds = new Set<string>();

    // 1. Scan for line comment markers
    if (lineCommentRegex) {
      for (let line = 0; line < document.lineCount; line++) {
        const text = document.lineAt(line).text;
        let match;
        // Reset regex lastIndex for each line
        lineCommentRegex.lastIndex = 0;
        while ((match = lineCommentRegex.exec(text))) {
          const taskId = match[2]; // The taskId is in the 2nd capture group with our updated regex
          if (!taskId) {
            console.warn(`[ClickUp] No taskId found in match: ${match[0]} at line ${line}`);
            continue;
          }
          let ref = allKnownReferences.find(r => r.taskId === taskId);
          if (!ref) {
            ref = {
              taskId,
              range: new vscode.Range(line, match.index, line, match.index + match[0].length),
            } as TaskReference;
          } else {
            ref.range = new vscode.Range(line, match.index, line, match.index + match[0].length);
          }
          activeRefs.push(ref);
          seenTaskIds.add(taskId);
        }
      }
    }

    // 2. Scan for block comment markers (if applicable)
    if (blockCommentRegex) {
      const documentText = document.getText();
      let blockMatch;
      // Reset regex lastIndex for the entire document
      blockCommentRegex.lastIndex = 0;
      while ((blockMatch = blockCommentRegex.exec(documentText))) {
        const taskId = blockMatch[1];
        const startPos = document.positionAt(blockMatch.index);
        const endPos = document.positionAt(blockMatch.index + blockMatch[0].length);
        const range = new vscode.Range(startPos, endPos);

        if (!seenTaskIds.has(taskId)) {
          let ref = allKnownReferences.find(r => r.taskId === taskId);
          if (!ref) {
            ref = {
              taskId,
              range,
            } as TaskReference;
          } else {
            ref.range = range;
          }
          activeRefs.push(ref);
          seenTaskIds.add(taskId);
        }
      }
    }

    // 3. Any stored reference not seen in this scan is orphaned
    for (const ref of allKnownReferences) {
      if (ref.taskId && !seenTaskIds.has(ref.taskId)) {
        orphanedRefs.push(ref);
      } else if (!ref.taskId) {
        // Unconfigured references are always active
        activeRefs.push(ref);
      }
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
}
