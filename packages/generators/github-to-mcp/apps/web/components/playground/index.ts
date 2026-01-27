/**
 * Playground Components - Re-export all playground UI components
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

// Types
export type {
  TransportType,
  TransportConfig,
  McpCapabilities,
  ServerInfo,
  ConnectionStatus,
  McpTool,
  McpResource,
  McpPrompt,
  PromptArgument,
  LogEntry,
  JsonSchema,
  CapabilityTab,
  ResourceContents,
  PromptMessage,
} from './types';

// Legacy exports (keep for backwards compatibility)
export { default as ServerStatus } from './ServerStatus';
export type { ServerStatusProps } from './ServerStatus';

export { default as ExecutionLog } from './ExecutionLog';
export type { ExecutionLogProps } from './ExecutionLog';

// Configuration & Connection
export { default as TransportConfigurator } from './TransportConfigurator';
export type { TransportConfiguratorProps } from './TransportConfigurator';

export { default as ConnectionStatusV2 } from './ConnectionStatusV2';
export type { ConnectionStatusProps as ConnectionStatusV2Props } from './ConnectionStatusV2';

// Navigation
export { default as CapabilityTabs } from './CapabilityTabs';
export type { CapabilityTabsProps } from './CapabilityTabs';

// Form & Display
export { default as SchemaForm } from './SchemaForm';
export type { SchemaFormProps } from './SchemaForm';

export { default as JsonViewer } from './JsonViewer';
export type { JsonViewerProps } from './JsonViewer';

// Capability Panels
export { default as ToolsPanel } from './ToolsPanel';
export type { ToolsPanelProps } from './ToolsPanel';

export { default as ResourcesPanel } from './ResourcesPanel';
export type { ResourcesPanelProps } from './ResourcesPanel';

export { default as PromptsPanel } from './PromptsPanel';
export type { PromptsPanelProps } from './PromptsPanel';

// Execution & Debugging
export { default as ExecutionLogV2 } from './ExecutionLogV2';
export type { ExecutionLogV2Props } from './ExecutionLogV2';

// Layout
export { default as PlaygroundLayout } from './PlaygroundLayout';
export type { PlaygroundLayoutProps } from './PlaygroundLayout';

// Empty States
export { default as EmptyStates, FirstTimeGuide, ConnectingState, ErrorState } from './EmptyStates';
export type { EmptyStatesProps, EmptyStateType } from './EmptyStates';

// Share Functionality
export { default as ShareButton } from './ShareButton';
export type { ShareButtonProps } from './ShareButton';
