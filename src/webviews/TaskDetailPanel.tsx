import React, { useState, useEffect, useCallback } from 'react';
import { Task } from '../types/navigationTypes';

interface TaskDetailPanelProps {
  task: Task | null;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onClose: () => void;
}

interface TaskDetailPanelState {
  task: Task | null;
  isEditing: boolean;
  editingField: string | null;
  localChanges: Partial<Task>;
}

/**
 * React component for detailed task view in webview panel
 */
export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  task,
  onStatusChange,
  onTaskUpdate,
  onClose
}) => {
  const [state, setState] = useState<TaskDetailPanelState>({
    task,
    isEditing: false,
    editingField: null,
    localChanges: {}
  });

  useEffect(() => {
    setState(prev => ({ ...prev, task }));
  }, [task]);

  const handleEdit = useCallback((field: string) => {
    setState(prev => ({ 
      ...prev, 
      isEditing: true, 
      editingField: field 
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (state.task && Object.keys(state.localChanges).length > 0) {
      onTaskUpdate(state.task.id, state.localChanges);
      setState(prev => ({ 
        ...prev, 
        isEditing: false, 
        editingField: null, 
        localChanges: {} 
      }));
    }
  }, [state.task, state.localChanges, onTaskUpdate]);

  const handleCancel = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isEditing: false, 
      editingField: null, 
      localChanges: {} 
    }));
  }, []);

  const handleFieldChange = useCallback((field: string, value: any) => {
    setState(prev => ({
      ...prev,
      localChanges: {
        ...prev.localChanges,
        [field]: value
      }
    }));
  }, []);

  const handleStatusChange = useCallback((newStatus: string) => {
    if (state.task) {
      onStatusChange(state.task.id, newStatus);
    }
  }, [state.task, onStatusChange]);

  const getStatusColor = useCallback((status: string): string => {
    switch (status.toLowerCase()) {
      case 'complete':
      case 'closed':
      case 'done':
        return '#28a745';
      case 'in progress':
      case 'active':
        return '#007bff';
      case 'blocked':
      case 'on hold':
        return '#dc3545';
      case 'in review':
        return '#6f42c1';
      default:
        return '#6c757d';
    }
  }, []);

  const getPriorityColor = useCallback((priority: string): string => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return '#dc3545';
      case 'high':
        return '#fd7e14';
      case 'normal':
        return '#28a745';
      case 'low':
        return '#6c757d';
      default:
        return '#6c757d';
    }
  }, []);

  const formatDate = useCallback((timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  if (!state.task) {
    return (
      <div className="task-detail-panel no-task">
        <div className="panel-header">
          <h2>No Task Selected</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="panel-content">
          <p>Select a task to view its details.</p>
        </div>
      </div>
    );
  }

  const { task: currentTask } = state;
  const taskStatus = typeof currentTask.status === 'string' 
    ? currentTask.status 
    : currentTask.status?.status || 'Unknown';

  return (
    <div className="task-detail-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="task-title-section">
          <h2 className="task-title">
            {state.editingField === 'name' ? (
              <input
                type="text"
                value={state.localChanges.name || currentTask.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                autoFocus
              />
            ) : (
              <span onClick={() => handleEdit('name')} className="editable">
                {currentTask.name}
              </span>
            )}
          </h2>
          <div className="task-id">#{currentTask.id}</div>
        </div>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {/* Panel Content */}
      <div className="panel-content">
        {/* Status Section */}
        <div className="detail-section">
          <label>Status</label>
          <div className="status-container">
            <span 
              className="status-badge"
              style={{ backgroundColor: getStatusColor(taskStatus) }}
            >
              {taskStatus}
            </span>
            <button 
              className="change-status-btn"
              onClick={() => handleEdit('status')}
            >
              Change
            </button>
          </div>
        </div>

        {/* Priority Section */}
        {currentTask.priority && (
          <div className="detail-section">
            <label>Priority</label>
            <span 
              className="priority-badge"
              style={{ color: getPriorityColor(currentTask.priority.priority) }}
            >
              {currentTask.priority.priority}
            </span>
          </div>
        )}

        {/* Description Section */}
        <div className="detail-section">
          <label>Description</label>
          {state.editingField === 'description' ? (
            <textarea
              value={state.localChanges.description || currentTask.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancel();
              }}
              rows={4}
              autoFocus
            />
          ) : (
            <div 
              className="description-content editable"
              onClick={() => handleEdit('description')}
            >
              {currentTask.description || 'No description provided. Click to add.'}
            </div>
          )}
        </div>

        {/* Assignees Section */}
        {currentTask.assignees && currentTask.assignees.length > 0 && (
          <div className="detail-section">
            <label>Assignees</label>
            <div className="assignees-list">              {currentTask.assignees.map((assignee, index) => (
                <div key={index} className="assignee-item">
                  {typeof assignee === 'string' ? assignee : assignee.username}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Due Date Section */}
        {currentTask.dueDate && (
          <div className="detail-section">
            <label>Due Date</label>
            <div className={`due-date ${currentTask.dueDate < Date.now() ? 'overdue' : ''}`}>
              {formatDate(currentTask.dueDate)}
            </div>
          </div>
        )}

        {/* Tags Section */}
        {currentTask.tags && currentTask.tags.length > 0 && (
          <div className="detail-section">
            <label>Tags</label>
            <div className="tags-list">
              {currentTask.tags.map((tag, index) => (
                <span key={index} className="tag-item">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-buttons">
          {state.isEditing && (
            <>
              <button className="btn btn-primary" onClick={handleSave}>
                Save Changes
              </button>
              <button className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </>
          )}
          <button 
            className="btn btn-outline"
            onClick={() => {
              const url = `https://app.clickup.com/t/${currentTask.id}`;
              // Send message to extension to open external URL
              if (typeof window !== 'undefined' && (window as any).vscode) {
                (window as any).vscode.postMessage({
                  command: 'openExternal',
                  url
                });
              }
            }}
          >
            Open in ClickUp
          </button>
        </div>
      </div>      <style>{`
        .task-detail-panel {
          padding: 0;
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          font-family: var(--vscode-font-family);
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .task-detail-panel.no-task {
          justify-content: center;
          align-items: center;
          text-align: center;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editor-background);
        }

        .task-title-section {
          flex: 1;
        }

        .task-title {
          margin: 0;
          font-size: 1.5em;
          font-weight: 600;
          color: var(--vscode-editor-foreground);
        }

        .task-title input {
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          padding: 4px 8px;
          font-size: inherit;
          font-weight: inherit;
          width: 100%;
        }

        .task-id {
          font-size: 0.9em;
          color: var(--vscode-descriptionForeground);
          margin-top: 4px;
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
        }

        .close-btn:hover {
          color: var(--vscode-errorForeground);
        }

        .panel-content {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
        }

        .detail-section {
          margin-bottom: 20px;
        }

        .detail-section label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--vscode-editor-foreground);
        }

        .status-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-badge, .priority-badge {
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 0.85em;
          font-weight: 500;
          color: white;
        }

        .priority-badge {
          background: var(--vscode-button-background);
        }

        .change-status-btn {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
        }

        .change-status-btn:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .description-content {
          background: var(--vscode-input-background);
          padding: 12px;
          border-radius: 4px;
          min-height: 60px;
          border: 1px solid var(--vscode-input-border);
          white-space: pre-wrap;
        }

        .description-content.editable:hover {
          border-color: var(--vscode-focusBorder);
          cursor: text;
        }

        .description-content textarea {
          width: 100%;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          padding: 8px;
          border-radius: 4px;
          resize: vertical;
        }

        .assignees-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .assignee-item {
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.85em;
        }

        .due-date {
          font-weight: 500;
        }

        .due-date.overdue {
          color: var(--vscode-errorForeground);
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tag-item {
          background: var(--vscode-textCodeBlock-background);
          color: var(--vscode-editor-foreground);
          padding: 2px 8px;
          border-radius: 8px;
          font-size: 0.8em;
          border: 1px solid var(--vscode-panel-border);
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--vscode-panel-border);
        }

        .btn {
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
          border: none;
        }

        .btn-primary {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }

        .btn-primary:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-outline {
          background: transparent;
          color: var(--vscode-button-foreground);
          border: 1px solid var(--vscode-button-background);
        }

        .btn-outline:hover {
          background: var(--vscode-button-background);
        }

        .editable {
          cursor: pointer;
        }        .editable:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default TaskDetailPanel;
