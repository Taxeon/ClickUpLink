import React from 'react';
import { createRoot } from 'react-dom/client';
import TaskDetailPanel from './TaskDetailPanel';
import StatusSelector from './StatusSelector';
import QuickActions from './QuickActions';

// Global interface for webview communication
declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage(message: any): void;
      setState(state: any): void;
      getState(): any;
    };
    initializeWebview(componentName: string, props: any): void;
  }
}

// Initialize webview based on component type
window.initializeWebview = function(componentName: string, props: any) {
  const container = document.getElementById('root');
  if (!container) {
    console.error('Root container not found');
    return;
  }

  const root = createRoot(container);

  switch (componentName) {
    case 'TaskDetailPanel':
      root.render(
        <TaskDetailPanel
          task={props.task}
          onStatusChange={props.onStatusChange}
          onTaskUpdate={props.onTaskUpdate}
          onClose={props.onClose}
        />
      );
      break;

    case 'StatusSelector':
      root.render(
        <StatusSelector
          currentStatus={props.currentStatus}
          availableStatuses={props.availableStatuses}
          onStatusChange={props.onStatusChange}
          onCancel={props.onCancel}
          taskName={props.taskName}
        />
      );
      break;

    case 'QuickActions':
      root.render(
        <QuickActions
          taskId={props.taskId}
          taskName={props.taskName}
          currentStatus={props.currentStatus}
          availableActions={props.availableActions}
          onActionExecute={props.onActionExecute}
          onClose={props.onClose}
          position={props.position}
        />
      );
      break;

    default:
      console.error(`Unknown component: ${componentName}`);
      break;
  }
};

// Export components for direct use if needed
export { TaskDetailPanel, StatusSelector, QuickActions };
