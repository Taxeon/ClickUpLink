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
    const markerRegex = /\/\/\s*clickup:\s*([a-zA-Z0-9_-]+)/g;
    const foundRefs: TaskReference[] = [];
    const orphanedRefs: TaskReference[] = [];
    const seenTaskIds = new Set<string>();

    for (let line = 0; line < document.lineCount; line++) {
      const text = document.lineAt(line).text;
      let match;
      while ((match = markerRegex.exec(text))) {
        const taskId = match[1];
        // Try to find an existing reference for this taskId
        let ref = allKnownReferences.find(r => r.taskId === taskId);
        if (!ref) {
          // If not found, create a minimal reference (to be filled in later)
          ref = {
            taskId,
            range: new vscode.Range(line, match.index, line, match.index + match[0].length),
          } as TaskReference;

          console.log('1. create new ref:', ref);
        } else {
          console.log('1. update existing ref:', ref);
          // Update the range to the marker's current position
          ref.range = new vscode.Range(line, match.index, line, match.index + match[0].length);
        }
        foundRefs.push(ref);
        seenTaskIds.add(taskId);
      }
    }

    // Orphaned: references that are in allKnownReferences but not in foundRefs
    for (const ref of allKnownReferences) {
      if (!foundRefs.includes(ref) && !orphanedRefs.includes(ref)) {
        foundRefs.push(ref); // Treat as active if not orphaned and not marker-based
      }
    }

    RefPositionManager.referenceMap.set(uri, { active: foundRefs, orphaned: orphanedRefs });
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
