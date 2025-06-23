import * as vscode from 'vscode';
import { TriggerDetector, TriggerMatch, TriggerDetectorOptions } from '../components/triggers/TriggerDetector';

export interface TriggerDetectionHook {
  detectTriggers: (document: vscode.TextDocument) => Promise<TriggerMatch[]>;
  detectAtPosition: (document: vscode.TextDocument, position: vscode.Position) => Promise<TriggerMatch | undefined>;
  hasTrigger: (document: vscode.TextDocument, position: vscode.Position) => Promise<boolean>;
  options: TriggerDetectorOptions;
  updateOptions: (newOptions: Partial<TriggerDetectorOptions>) => void;
  addCustomTrigger: (trigger: string) => void;
  removeCustomTrigger: (trigger: string) => void;
  isValidTaskId: (taskId: string) => boolean;
  reload: () => void;
}

export interface TriggerEvent {
  type: 'detected' | 'removed' | 'changed';
  trigger: TriggerMatch;
  document: vscode.TextDocument;
  timestamp: number;
}

export interface TriggerDetectionStats {
  totalTriggers: number;
  triggersByType: Record<string, number>;
  recentTriggers: TriggerEvent[];
  activeDocument?: string;
}

/**
 * React-inspired hook for trigger detection functionality
 */
export function useTriggerDetection(context?: vscode.ExtensionContext): TriggerDetectionHook {
  if (!context) {
    // Get from global extension context
    context = (global as any).extensionContext;
    
    if (!context) {
      throw new Error('Extension context is required for useTriggerDetection hook');
    }
  }

  const detector = TriggerDetector.getInstance(context);
  let currentOptions = detector.getOptions();

  /**
   * Detect all triggers in a document
   */
  const detectTriggers = async (document: vscode.TextDocument): Promise<TriggerMatch[]> => {
    return await detector.detectTaskReferences(document);
  };

  /**
   * Detect trigger at specific position
   */
  const detectAtPosition = async (
    document: vscode.TextDocument, 
    position: vscode.Position
  ): Promise<TriggerMatch | undefined> => {
    return await detector.detectTaskReferenceAtPosition(document, position);
  };

  /**
   * Check if there's a trigger at position
   */
  const hasTrigger = async (
    document: vscode.TextDocument, 
    position: vscode.Position
  ): Promise<boolean> => {
    return await detector.hasTriggerAtPosition(document, position);
  };

  /**
   * Update trigger detection options
   */
  const updateOptions = (newOptions: Partial<TriggerDetectorOptions>): void => {
    detector.updateOptions(newOptions);
    currentOptions = detector.getOptions();
  };

  /**
   * Add custom trigger pattern
   */
  const addCustomTrigger = (trigger: string): void => {
    detector.addCustomTrigger(trigger);
    currentOptions = detector.getOptions();
  };

  /**
   * Remove custom trigger pattern
   */
  const removeCustomTrigger = (trigger: string): void => {
    detector.removeCustomTrigger(trigger);
    currentOptions = detector.getOptions();
  };

  /**
   * Validate task ID
   */
  const isValidTaskId = (taskId: string): boolean => {
    return detector.isValidTaskId(taskId);
  };

  /**
   * Reload detector configuration
   */
  const reload = (): void => {
    detector.reload();
    currentOptions = detector.getOptions();
  };

  return {
    detectTriggers,
    detectAtPosition,
    hasTrigger,
    options: currentOptions,
    updateOptions,
    addCustomTrigger,
    removeCustomTrigger,
    isValidTaskId,
    reload
  };
}

/**
 * Hook for real-time trigger monitoring
 */
export function useTriggerMonitoring(context?: vscode.ExtensionContext) {
  const triggerHook = useTriggerDetection(context);
  const events: TriggerEvent[] = [];
  const maxEvents = 100;

  let stats: TriggerDetectionStats = {
    totalTriggers: 0,
    triggersByType: {},
    recentTriggers: [],
    activeDocument: undefined
  };

  /**
   * Monitor document for trigger changes
   */
  const monitorDocument = async (document: vscode.TextDocument): Promise<void> => {
    const triggers = await triggerHook.detectTriggers(document);
    
    // Update stats
    stats.totalTriggers = triggers.length;
    stats.triggersByType = {};
    stats.activeDocument = document.fileName;

    triggers.forEach(trigger => {
      stats.triggersByType[trigger.type] = (stats.triggersByType[trigger.type] || 0) + 1;
      
      // Add to events
      const event: TriggerEvent = {
        type: 'detected',
        trigger,
        document,
        timestamp: Date.now()
      };
      
      events.push(event);
      
      // Limit events array size
      if (events.length > maxEvents) {
        events.splice(0, events.length - maxEvents);
      }
    });

    stats.recentTriggers = events.slice(-10); // Last 10 events
  };

  /**
   * Start monitoring active editor
   */
  const startMonitoring = (): vscode.Disposable => {
    const disposables: vscode.Disposable[] = [];

    // Monitor active editor changes
    disposables.push(
      vscode.window.onDidChangeActiveTextEditor(async editor => {
        if (editor) {
          await monitorDocument(editor.document);
        }
      })
    );

    // Monitor document changes
    disposables.push(
      vscode.workspace.onDidChangeTextDocument(async event => {
        // Debounce document changes
        clearTimeout((monitorDocument as any).timeout);
        (monitorDocument as any).timeout = setTimeout(async () => {
          await monitorDocument(event.document);
        }, 500);
      })
    );

    // Initial monitoring if there's an active editor
    if (vscode.window.activeTextEditor) {
      monitorDocument(vscode.window.activeTextEditor.document);
    }

    return {
      dispose: () => {
        disposables.forEach(d => d.dispose());
        clearTimeout((monitorDocument as any).timeout);
      }
    };
  };

  /**
   * Get current statistics
   */
  const getStats = (): TriggerDetectionStats => {
    return { ...stats };
  };

  /**
   * Get trigger events
   */
  const getEvents = (): TriggerEvent[] => {
    return [...events];
  };

  /**
   * Clear events history
   */
  const clearEvents = (): void => {
    events.length = 0;
    stats.recentTriggers = [];
  };

  /**
   * Get triggers by type
   */
  const getTriggersByType = (type: string): TriggerEvent[] => {
    return events.filter(event => event.trigger.type === type);
  };

  return {
    ...triggerHook,
    monitorDocument,
    startMonitoring,
    getStats,
    getEvents,
    clearEvents,
    getTriggersByType
  };
}

/**
 * Hook for trigger pattern management
 */
export function useTriggerPatterns(context?: vscode.ExtensionContext) {
  const triggerHook = useTriggerDetection(context);

  const defaultPatterns = {
    basic: ['clickup', 'cu', 'task'],
    advanced: ['clickup', 'cu', 'task', 'issue', 'ticket'],
    minimal: ['clickup'],
    comprehensive: ['clickup', 'cu', 'task', 'issue', 'ticket', 'story', 'bug', 'feature']
  };

  /**
   * Apply pattern preset
   */
  const applyPatternPreset = (presetName: keyof typeof defaultPatterns): void => {
    const patterns = defaultPatterns[presetName];
    triggerHook.updateOptions({
      customTriggers: patterns
    });
  };

  /**
   * Get available presets
   */
  const getAvailablePresets = () => {
    return Object.keys(defaultPatterns);
  };

  /**
   * Create custom pattern set
   */
  const createCustomPatternSet = (name: string, patterns: string[]): void => {
    // Store in workspace configuration
    const config = vscode.workspace.getConfiguration('clickupLink.triggers');
    const customSets = config.get('customPatternSets', {}) as Record<string, string[]>;
    customSets[name] = patterns;
    config.update('customPatternSets', customSets, vscode.ConfigurationTarget.Workspace);
  };

  /**
   * Get custom pattern sets
   */
  const getCustomPatternSets = (): Record<string, string[]> => {
    const config = vscode.workspace.getConfiguration('clickupLink.triggers');
    return config.get('customPatternSets', {}) as Record<string, string[]>;
  };

  /**
   * Apply custom pattern set
   */
  const applyCustomPatternSet = (name: string): void => {
    const customSets = getCustomPatternSets();
    const patterns = customSets[name];
    
    if (patterns) {
      triggerHook.updateOptions({
        customTriggers: patterns
      });
    }
  };

  /**
   * Test pattern against text
   */
  const testPattern = (pattern: string, text: string): boolean => {
    try {
      const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      return regex.test(text);
    } catch (error) {
      return false;
    }
  };

  /**
   * Validate pattern
   */
  const validatePattern = (pattern: string): { valid: boolean; error?: string } => {
    if (!pattern || pattern.trim().length === 0) {
      return { valid: false, error: 'Pattern cannot be empty' };
    }

    if (pattern.length > 50) {
      return { valid: false, error: 'Pattern is too long (max 50 characters)' };
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(pattern)) {
      return { valid: false, error: 'Pattern can only contain letters, numbers, hyphens, and underscores' };
    }

    return { valid: true };
  };

  /**
   * Get pattern usage statistics
   */
  const getPatternStats = (): Record<string, number> => {
    const monitoring = useTriggerMonitoring(context);
    const events = monitoring.getEvents();
    const stats: Record<string, number> = {};

    events.forEach(event => {
      const pattern = event.trigger.trigger.toLowerCase();
      stats[pattern] = (stats[pattern] || 0) + 1;
    });

    return stats;
  };

  return {
    ...triggerHook,
    applyPatternPreset,
    getAvailablePresets,
    createCustomPatternSet,
    getCustomPatternSets,
    applyCustomPatternSet,
    testPattern,
    validatePattern,
    getPatternStats,
    defaultPatterns
  };
}
