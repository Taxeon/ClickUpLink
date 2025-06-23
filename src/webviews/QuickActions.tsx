import React, { useState, useCallback } from 'react';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: 'status' | 'navigation' | 'edit' | 'external';
  hotkey?: string;
  disabled?: boolean;
}

interface QuickActionsProps {
  taskId?: string;
  taskName?: string;
  currentStatus?: string;
  availableActions: QuickAction[];
  onActionExecute: (actionId: string, taskId?: string) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

/**
 * React component for quick actions popup in webview
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
  taskId,
  taskName,
  currentStatus,
  availableActions,
  onActionExecute,
  onClose,
  position
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [filter, setFilter] = useState<string>('');

  const filteredActions = availableActions.filter(action =>
    action.label.toLowerCase().includes(filter.toLowerCase()) ||
    action.description.toLowerCase().includes(filter.toLowerCase())
  );

  const groupedActions = filteredActions.reduce((groups, action) => {
    const category = action.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(action);
    return groups;
  }, {} as Record<string, QuickAction[]>);

  const handleActionExecute = useCallback((action: QuickAction) => {
    if (!action.disabled) {
      onActionExecute(action.id, taskId);
      onClose();
    }
  }, [onActionExecute, taskId, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'Enter':
        if (filteredActions[selectedIndex] && !filteredActions[selectedIndex].disabled) {
          handleActionExecute(filteredActions[selectedIndex]);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
    }
  }, [selectedIndex, filteredActions, handleActionExecute, onClose]);

  const getCategoryLabel = useCallback((category: string): string => {
    switch (category) {
      case 'status':
        return 'Status Actions';
      case 'navigation':
        return 'Navigation';
      case 'edit':
        return 'Edit Task';
      case 'external':
        return 'External Links';
      default:
        return 'Actions';
    }
  }, []);

  const getCategoryIcon = useCallback((category: string): string => {
    switch (category) {
      case 'status':
        return '🔄';
      case 'navigation':
        return '🧭';
      case 'edit':
        return '✏️';
      case 'external':
        return '🔗';
      default:
        return '⚡';
    }
  }, []);

  const getActionStyle = useCallback((action: QuickAction, index: number) => {
    const globalIndex = filteredActions.indexOf(action);
    return {
      backgroundColor: globalIndex === selectedIndex 
        ? 'var(--vscode-list-activeSelectionBackground)'
        : undefined,
      opacity: action.disabled ? 0.5 : 1,
      cursor: action.disabled ? 'not-allowed' : 'pointer'
    };
  }, [selectedIndex, filteredActions]);

  const positionStyle = position ? {
    position: 'fixed' as const,
    left: position.x,
    top: position.y,
    transform: 'translate(-50%, -100%)'
  } : {};

  return (
    <div className="quick-actions-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    }}>
      <div 
        className="quick-actions" 
        style={positionStyle}
        onKeyDown={handleKeyDown} 
        tabIndex={0}
      >
        {/* Header */}
        <div className="actions-header">
          <div className="header-content">
            <h3>Quick Actions</h3>
            {taskName && (
              <div className="task-info">
                <span className="task-name">{taskName}</span>
                {currentStatus && (
                  <span className="task-status">({currentStatus})</span>
                )}
              </div>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Filter */}
        <div className="filter-section">
          <input
            type="text"
            placeholder="Filter actions..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="action-filter"
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="actions-content">
          {Object.entries(groupedActions).map(([category, actions]) => (
            <div key={category} className="action-category">
              <div className="category-header">
                <span className="category-icon">{getCategoryIcon(category)}</span>
                <span className="category-label">{getCategoryLabel(category)}</span>
              </div>
              
              <div className="category-actions">
                {actions.map((action, index) => (
                  <div
                    key={action.id}
                    className={`action-item ${action.disabled ? 'disabled' : ''}`}
                    style={getActionStyle(action, index)}
                    onClick={() => handleActionExecute(action)}
                    onMouseEnter={() => {
                      const globalIndex = filteredActions.indexOf(action);
                      setSelectedIndex(globalIndex);
                    }}
                  >
                    <div className="action-icon">{action.icon}</div>
                    <div className="action-content">
                      <div className="action-label">{action.label}</div>
                      <div className="action-description">{action.description}</div>
                    </div>
                    {action.hotkey && (
                      <div className="action-hotkey">{action.hotkey}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredActions.length === 0 && (
            <div className="no-actions">
              {filter ? `No actions found for "${filter}"` : 'No actions available'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="actions-footer">
          <div className="footer-hint">
            Use ↑↓ to navigate, Enter to execute, Esc to close
          </div>
        </div>
      </div>

      <style>{`
        .quick-actions-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .quick-actions {
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          width: 420px;
          max-width: 90vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          font-family: var(--vscode-font-family);
          color: var(--vscode-editor-foreground);
        }

        .actions-header {
          display: flex;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header-content {
          flex: 1;
        }

        .actions-header h3 {
          margin: 0 0 4px 0;
          font-size: 1.1em;
          font-weight: 600;
        }

        .task-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85em;
          color: var(--vscode-descriptionForeground);
        }

        .task-name {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .task-status {
          font-style: italic;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--vscode-icon-foreground);
          font-size: 1.3em;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          color: var(--vscode-errorForeground);
        }

        .filter-section {
          padding: 12px 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .action-filter {
          width: 100%;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .action-filter:focus {
          outline: none;
          border-color: var(--vscode-focusBorder);
        }

        .actions-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          min-height: 200px;
          max-height: 400px;
        }

        .action-category {
          margin-bottom: 16px;
        }

        .action-category:last-child {
          margin-bottom: 0;
        }

        .category-header {
          display: flex;
          align-items: center;
          padding: 8px 4px;
          margin-bottom: 4px;
          font-size: 0.9em;
          font-weight: 600;
          color: var(--vscode-descriptionForeground);
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .category-icon {
          margin-right: 8px;
        }

        .category-actions {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .action-item {
          display: flex;
          align-items: center;
          padding: 10px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .action-item:hover:not(.disabled) {
          background: var(--vscode-list-hoverBackground);
        }

        .action-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-icon {
          font-size: 1.1em;
          margin-right: 12px;
          min-width: 20px;
          text-align: center;
        }

        .action-content {
          flex: 1;
        }

        .action-label {
          font-weight: 500;
          margin-bottom: 2px;
        }

        .action-description {
          font-size: 0.8em;
          color: var(--vscode-descriptionForeground);
          line-height: 1.3;
        }

        .action-hotkey {
          background: var(--vscode-keybindingLabel-background);
          color: var(--vscode-keybindingLabel-foreground);
          border: 1px solid var(--vscode-keybindingLabel-border);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.75em;
          font-family: var(--vscode-editor-font-family);
          margin-left: 8px;
        }

        .no-actions {
          text-align: center;
          color: var(--vscode-descriptionForeground);
          padding: 32px 16px;
          font-style: italic;
        }

        .actions-footer {
          padding: 8px 16px;
          border-top: 1px solid var(--vscode-panel-border);
          background: var(--vscode-textCodeBlock-background);
        }

        .footer-hint {
          font-size: 0.8em;
          color: var(--vscode-descriptionForeground);
          text-align: center;
        }

        /* Scrollbar styling */
        .actions-content::-webkit-scrollbar {
          width: 6px;
        }

        .actions-content::-webkit-scrollbar-track {
          background: var(--vscode-scrollbarSlider-background);
        }

        .actions-content::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-hoverBackground);
          border-radius: 3px;
        }

        .actions-content::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-activeBackground);
        }
      `}</style>
    </div>
  );
};

export default QuickActions;
