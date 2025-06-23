import React, { useState, useEffect, useCallback } from 'react';

interface StatusOption {
  label: string;
  value: string;
  color: string;
  emoji: string;
  description?: string;
}

interface StatusSelectorProps {
  currentStatus: string;
  availableStatuses: StatusOption[];
  onStatusChange: (newStatus: string) => void;
  onCancel: () => void;
  taskName?: string;
}

/**
 * React component for selecting task status in webview
 */
export const StatusSelector: React.FC<StatusSelectorProps> = ({
  currentStatus,
  availableStatuses,
  onStatusChange,
  onCancel,
  taskName
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>(currentStatus);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredStatuses = availableStatuses.filter(status =>
    status.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    status.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusSelect = useCallback((status: string) => {
    setSelectedStatus(status);
  }, []);

  const handleConfirm = useCallback(() => {
    onStatusChange(selectedStatus);
  }, [selectedStatus, onStatusChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onCancel();
        break;
      case 'Enter':
        if (selectedStatus !== currentStatus) {
          handleConfirm();
        }
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        const currentIndex = filteredStatuses.findIndex(s => s.value === selectedStatus);
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, filteredStatuses.length - 1)
          : Math.max(currentIndex - 1, 0);
        
        if (filteredStatuses[nextIndex]) {
          setSelectedStatus(filteredStatuses[nextIndex].value);
        }
        break;
    }
  }, [selectedStatus, currentStatus, filteredStatuses, handleConfirm, onCancel]);

  useEffect(() => {
    // Focus the component for keyboard navigation
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onCancel]);

  const getStatusIcon = useCallback((status: StatusOption): string => {
    return status.emoji || '📝';
  }, []);

  const getStatusDescription = useCallback((status: StatusOption): string => {
    return status.description || `Set task status to ${status.label}`;
  }, []);

  return (
    <div className="status-selector-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    }}>
      <div className="status-selector" onKeyDown={handleKeyDown} tabIndex={0}>
        {/* Header */}
        <div className="selector-header">
          <h3>Change Status</h3>
          {taskName && <div className="task-name">for: {taskName}</div>}
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        {/* Search */}
        <div className="search-section">
          <input
            type="text"
            placeholder="Search statuses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="status-search"
            autoFocus
          />
        </div>

        {/* Status Options */}
        <div className="status-options">
          {filteredStatuses.map((status) => (
            <div
              key={status.value}
              className={`status-option ${
                status.value === selectedStatus ? 'selected' : ''
              } ${
                status.value === currentStatus ? 'current' : ''
              }`}
              onClick={() => handleStatusSelect(status.value)}
              onDoubleClick={() => {
                setSelectedStatus(status.value);
                if (status.value !== currentStatus) {
                  handleConfirm();
                }
              }}
            >
              <div className="status-icon">
                {getStatusIcon(status)}
              </div>
              <div className="status-content">
                <div className="status-label">{status.label}</div>
                <div className="status-description">
                  {getStatusDescription(status)}
                </div>
              </div>
              <div 
                className="status-color-indicator"
                style={{ backgroundColor: status.color }}
              />
              {status.value === currentStatus && (
                <div className="current-indicator">Current</div>
              )}
            </div>
          ))}

          {filteredStatuses.length === 0 && (
            <div className="no-results">
              No statuses found matching "{searchTerm}"
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={selectedStatus === currentStatus}
          >
            {selectedStatus === currentStatus ? 'No Change' : 'Update Status'}
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>

        {/* Status Preview */}
        {selectedStatus !== currentStatus && (
          <div className="status-preview">
            <div className="preview-text">
              Status will change from <strong>{currentStatus}</strong> to{' '}
              <strong style={{ 
                color: filteredStatuses.find(s => s.value === selectedStatus)?.color 
              }}>
                {filteredStatuses.find(s => s.value === selectedStatus)?.label}
              </strong>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .status-selector-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .status-selector {
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          width: 480px;
          max-width: 90vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          font-family: var(--vscode-font-family);
          color: var(--vscode-editor-foreground);
        }

        .selector-header {
          display: flex;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .selector-header h3 {
          margin: 0;
          flex: 1;
          font-size: 1.2em;
          font-weight: 600;
        }

        .task-name {
          font-size: 0.9em;
          color: var(--vscode-descriptionForeground);
          margin-left: 12px;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--vscode-icon-foreground);
          font-size: 1.5em;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 12px;
        }

        .close-btn:hover {
          color: var(--vscode-errorForeground);
        }

        .search-section {
          padding: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .status-search {
          width: 100%;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .status-search:focus {
          outline: none;
          border-color: var(--vscode-focusBorder);
        }

        .status-options {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          min-height: 200px;
          max-height: 400px;
        }

        .status-option {
          display: flex;
          align-items: center;
          padding: 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          margin-bottom: 4px;
          border: 2px solid transparent;
        }

        .status-option:hover {
          background: var(--vscode-list-hoverBackground);
        }

        .status-option.selected {
          background: var(--vscode-list-activeSelectionBackground);
          border-color: var(--vscode-focusBorder);
        }

        .status-option.current {
          background: var(--vscode-button-secondaryBackground);
        }

        .status-option.current.selected {
          background: var(--vscode-list-activeSelectionBackground);
        }

        .status-icon {
          font-size: 1.2em;
          margin-right: 12px;
          min-width: 20px;
          text-align: center;
        }

        .status-content {
          flex: 1;
        }

        .status-label {
          font-weight: 500;
          margin-bottom: 2px;
        }

        .status-description {
          font-size: 0.85em;
          color: var(--vscode-descriptionForeground);
        }

        .status-color-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-left: 8px;
          border: 1px solid var(--vscode-panel-border);
        }

        .current-indicator {
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 0.75em;
          margin-left: 8px;
        }

        .no-results {
          text-align: center;
          color: var(--vscode-descriptionForeground);
          padding: 24px;
          font-style: italic;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-top: 1px solid var(--vscode-panel-border);
        }

        .btn {
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
          border: none;
          font-family: inherit;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          flex: 1;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }

        .status-preview {
          padding: 12px 16px;
          background: var(--vscode-textCodeBlock-background);
          border-top: 1px solid var(--vscode-panel-border);
          border-radius: 0 0 8px 8px;
        }

        .preview-text {
          font-size: 0.9em;
          text-align: center;
        }

        /* Scrollbar styling */
        .status-options::-webkit-scrollbar {
          width: 8px;
        }

        .status-options::-webkit-scrollbar-track {
          background: var(--vscode-scrollbarSlider-background);
        }

        .status-options::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-hoverBackground);
          border-radius: 4px;
        }

        .status-options::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-activeBackground);
        }
      `}</style>
    </div>
  );
};

export default StatusSelector;
